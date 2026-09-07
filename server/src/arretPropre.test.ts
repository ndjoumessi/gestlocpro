import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { installerArretPropre } from './arretPropre.js'

/**
 * L'ARRÊT PROPRE N'A JAMAIS EU LIEU EN PRODUCTION.
 *
 * `index.ts` installe un gestionnaire de `SIGTERM` depuis longtemps, avec son
 * motif écrit : « sans cela, `docker stop` et les redéploiements coupent les
 * requêtes en cours au milieu — y compris une transaction d'écriture ». Il ne
 * s'exécutait jamais.
 *
 * ═══ CE QUE LE JOURNAL DE RAILWAY A DIT, ET CE QU'IL FALLAIT EN TIRER ═══
 *
 * Un déploiement s'est affiché `CRASHED` le 2026-09-07 à 22:10. Le journal
 * disait `npm error signal SIGTERM` sur `sh -c prisma migrate deploy && node
 * dist/src/index.js`. Ce n'était PAS une panne — la relève tuait l'ancien
 * conteneur — mais ce n'était pas non plus un faux positif à classer : le
 * message dit que c'est le SHELL qui est mort du signal, donc que Node ne l'a
 * jamais reçu.
 *
 * ═══ MESURÉ AVANT DE CORRIGER ═══
 *
 * La chaîne réelle, `npm` → `sh` → `node`, signal envoyé à `npm` comme Docker
 * le fait au PID 1 : code de sortie 143 — tué par le signal — et le
 * gestionnaire de Node MUET. La même chaîne avec `exec` : code 0, et le
 * gestionnaire s'exécute. `sh` lancé sur `a && b` ne remplace pas son
 * processus : il attend `b`, meurt du signal, et emporte tout avec lui.
 *
 * ═══ DEUX COÛTS, ET LE SECOND EST LE PIRE ═══
 *
 * Les requêtes en vol sont coupées à chaque déploiement, transactions
 * comprises. Et surtout : CHAQUE RELÈVE S'INSCRIT COMME UN CRASH. Le jour
 * d'une vraie panne, rien ne la distinguera d'un déploiement ordinaire — un
 * signal d'alerte qui crie tout le temps ne dit plus rien.
 *
 * ═══ CE QUE CE CAS GARDE, ET POURQUOI PAS UNE CHAÎNE DE CARACTÈRES ═══
 *
 * Il ne cherche pas le mot `exec` dans le `package.json` : il REJOUE la forme
 * du script de démarrage. Les commandes sont remplacées par des doublures — la
 * migration par `true`, le serveur par un faux qui journalise son signal — mais
 * la STRUCTURE reste celle de la production : le `&&`, l'enchaînement, la
 * présence ou l'absence de la passation. On mesure donc ce qui compte, le
 * comportement, et non une orthographe.
 */

/** Un faux serveur qui dit s'il a reçu son signal. */
const FAUX_SERVEUR = `
process.on('SIGTERM', () => { console.log('ARRET_PROPRE'); process.exit(0) })
setInterval(() => {}, 1000)
console.log('PRET')
`

/**
 * Le script `start` réel, ses commandes remplacées par des doublures.
 *
 * `prisma migrate deploy` devient `true` : ce cas mesure la PASSATION du
 * signal, pas la migration, et une base n'a rien à faire ici. Le serveur
 * devient le faux. Tout le reste — l'enchaînement, le `exec` s'il est là — est
 * celui de la production.
 */
function scriptDeDemarrageDoublé(faux: string): string {
  const paquet = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { scripts: { start: string } }
  return paquet.scripts.start
    .replace(/prisma migrate deploy/, 'true')
    .replace(/node dist\/src\/index\.js/, `node ${JSON.stringify(faux)}`)
}

describe('l’arrêt propre du serveur', () => {
  it('passe SIGTERM jusqu’à Node, au lieu de le laisser mourir dans le shell', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'arret-propre-'))
    const faux = join(dossier, 'faux-serveur.js')
    writeFileSync(faux, FAUX_SERVEUR)
    writeFileSync(
      join(dossier, 'package.json'),
      JSON.stringify({
        name: 'essai-arret',
        version: '1.0.0',
        private: true,
        scripts: { start: scriptDeDemarrageDoublé(faux) },
      }),
    )

    /* `npm` EST LE PROCESSUS SIGNALÉ, comme Docker signale le PID 1 du
       conteneur. Signaler l'enveloppe plutôt que `npm` rendrait un verdict
       faux — c'est l'erreur que j'ai commise à la première mesure, et elle
       donnait « rien ne marche » des deux côtés. */
    const enfant = spawn('npm', ['start', '--silent'], { cwd: dossier })
    let sortie = ''
    enfant.stdout.on('data', (d: Buffer) => (sortie += d.toString()))
    enfant.stderr.on('data', (d: Buffer) => (sortie += d.toString()))

    await new Promise<void>((resoudre) => {
      const attendre = setInterval(() => {
        if (sortie.includes('PRET')) {
          clearInterval(attendre)
          resoudre()
        }
      }, 100)
    })

    const code = await new Promise<number | null>((resoudre) => {
      enfant.on('exit', (c) => resoudre(c))
      enfant.kill('SIGTERM')
    })

    expect(
      sortie,
      'le gestionnaire de Node ne s’est pas exécuté : le signal est mort dans le shell',
    ).toContain('ARRET_PROPRE')
    /* 143 = 128 + 15, la signature d'un processus TUÉ par SIGTERM plutôt que
       sorti de lui-même. C'est ce code que Railway affiche en « CRASHED ». */
    expect(code, 'une relève ne doit pas s’inscrire comme un crash').toBe(0)
  }, 30_000)
})

/**
 * ET LA REQUÊTE EN VOL, MESURÉE PLUTÔT QUE DÉDUITE.
 *
 * Le lot précédent a prouvé que le signal ATTEINT Node — journaux de
 * production à l'appui, un conteneur qui sort sans une ligne d'erreur. Il a
 * laissé l'autre moitié en réserve, écrite telle quelle : « je n'ai pas mesuré
 * qu'une requête EN COURS survive effectivement à la relève ; que les dix
 * secondes de grâce servent réellement reste déduit du code, pas observé ».
 *
 * ═══ DEUX MOITIÉS, DEUX INSTRUMENTS ═══
 *
 * La LIVRAISON du signal par le système d'exploitation se mesure en lançant la
 * vraie chaîne — c'est le cas du haut de ce fichier, et la production l'a
 * confirmé. Ce que le signal DÉCLENCHE une fois arrivé se mesure ici, en
 * l'émettant nous-mêmes : `process.emit` ne prouve pas la livraison, et ce
 * n'est pas ce qu'on lui demande. Chaque instrument à sa moitié ; les
 * confondre donnerait un cas qui ne prouve ni l'une ni l'autre.
 *
 * ═══ LE SERVEUR EST UNE DOUBLURE, LE CODE D'ARRÊT EST LE VRAI ═══
 *
 * `installerArretPropre` est la fonction de production, appelée telle quelle.
 * Ce qu'on remplace, c'est ce dont elle a besoin pour être observable : un
 * serveur dont on choisit la lenteur — l'API réelle n'a aucune route qui dure
 * assez pour qu'on glisse un signal dedans — et une sortie qu'on note au lieu
 * de tuer le processus de test.
 */
describe('une requête en vol survit à la relève', () => {
  it('rend sa réponse ENTIÈRE, et ne ferme qu’après elle', async () => {
    const journal: string[] = []
    const sorties: number[] = []

    /* Trois cents millisecondes : assez long pour envoyer le signal AU MILIEU,
       assez court pour que le cas ne pèse rien. */
    const serveur = createServer((_, reponse) => {
      journal.push('requête reçue')
      setTimeout(() => {
        reponse.writeHead(200, { 'content-type': 'text/plain' })
        reponse.end('REPONSE_ENTIERE')
        journal.push('réponse rendue')
      }, 300)
    })
    await new Promise<void>((pret) => serveur.listen(0, pret))
    const port = (serveur.address() as { port: number }).port

    installerArretPropre(serveur, {
      sortir: (code) => {
        journal.push(`fermeture (code ${code})`)
        sorties.push(code)
      },
      delaiDeGraceMs: 5_000,
    })

    const enVol = fetch(`http://127.0.0.1:${port}/`).then((r) => r.text())
    /* On attend que le serveur ait REÇU la requête avant de signaler : signaler
       avant la rendrait le cas trivial — il n'y aurait rien en vol à sauver. */
    await new Promise<void>((atteint) => {
      const guet = setInterval(() => {
        if (journal.includes('requête reçue')) {
          clearInterval(guet)
          atteint()
        }
      }, 10)
    })

    process.emit('SIGTERM')

    const corps = await enVol
    expect(corps, 'la réponse a été coupée par la relève').toBe('REPONSE_ENTIERE')

    /* L'ORDRE EST LA PREUVE, plus que le contenu : `close` ne rend la main
       qu'après le dernier échange. Une fermeture qui précéderait la réponse
       voudrait dire qu'on a coupé — et une transaction d'écriture s'y serait
       coupée aussi. */
    await new Promise<void>((ferme) => {
      const guet = setInterval(() => {
        if (sorties.length > 0) {
          clearInterval(guet)
          ferme()
        }
      }, 10)
    })
    expect(journal).toEqual(['requête reçue', 'réponse rendue', 'fermeture (code 0)'])
    expect(sorties, 'une fermeture après attente sort par ZÉRO, pas par le repli').toEqual([0])

    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
  }, 15_000)
})
