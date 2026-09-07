import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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
