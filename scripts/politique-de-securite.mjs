#!/usr/bin/env node
/**
 * LA POLITIQUE DE SÉCURITÉ NE CASSE AUCUN ÉCRAN — mesuré, pas espéré.
 *
 * ═══ POURQUOI CETTE PORTE EXISTE ═══
 *
 * Une politique de sécurité du contenu est le genre de réglage qui passe la
 * relecture et casse la production : elle n'échoue pas à la construction, elle
 * n'échoue pas aux tests unitaires, elle échoue dans le navigateur d'un
 * utilisateur, sur un écran que personne n'a rouvert depuis. Une police tierce
 * qui ne charge plus, un aperçu de photo qui reste blanc, un PDF qui ne s'ouvre
 * pas : trois symptômes qui ne ressemblent pas à leur cause.
 *
 * ═══ CE QU'ELLE MESURE ═══
 *
 * Elle monte LE VRAI SERVEUR — celui d'`app.ts`, en mode production, avec ses
 * en-têtes — et non `vite preview`, qui n'en pose aucun. C'est la seule des
 * portes au navigateur qui le fait, et c'est nécessaire : la politique n'existe
 * que dans la réponse du serveur.
 *
 * Puis elle ouvre chaque écran et écoute `securitypolicyviolation`, l'événement
 * que le navigateur émet quand il REFUSE quelque chose. Zéro violation, ou la
 * porte refuse en nommant la directive et l'adresse bloquée.
 *
 * ═══ CE QU'ELLE NE DIT PAS ═══
 *
 * Que la politique est BONNE. Une politique qui autorise tout ne violerait rien
 * et passerait ici. Ce qu'elle garde est l'autre moitié — que la politique
 * écrite n'empêche pas le produit de fonctionner — et c'est celle qui casse en
 * silence. La sévérité, elle, se lit dans `politiqueDeSecurite.ts`, où chaque
 * directive porte ce qu'elle paie.
 *
 * Elle ne mesure pas non plus les écrans derrière une session : la
 * démonstration ne demande pas de compte, l'espace réel oui. Les violations
 * y seraient les mêmes — mêmes composants, mêmes origines — mais ce n'est pas
 * mesuré, et c'est écrit ici plutôt que tu.
 */
import { chromium } from 'playwright'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

/* LE PAQUET AVANT TOUT LE RESTE : ce script mesure `dist/`, jamais les
   sources. Un paquet périmé rendrait un verdict sur le code d'AVANT, en
   silence — voir `paquet-a-jour.mjs`, qui porte les trois cas mesurés. */
exigerUnPaquetAJour()

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4195
const BASE = `http://127.0.0.1:${PORT}`

/** Les écrans atteignables sans session, plus la vitrine et l'authentification. */
const ADRESSES = [
  '/',
  '/connexion',
  '/inscription',
  '/demo',
  '/demo/paiements',
  '/demo/parc',
  '/demo/releves',
  '/demo/cautions',
  '/demo/locataires',
  '/demo/documents',
  '/demo/portail',
  '/demo/systeme',
]

/** Le serveur RÉEL, en production, avec le client construit. */
function servir() {
  return new Promise((resoudre, rejeter) => {
    const fils = spawn(
      'node',
      ['--input-type=module', '-e',
       `process.env.NODE_ENV='production';` +
       `process.env.CLIENT_DIST=${JSON.stringify(join(RACINE, 'dist'))};` +
       `process.env.SESSION_SECRET='un-secret-de-porte-assez-long-pour-passer';` +
       `process.env.STOCKAGE_RACINE='/tmp/gestlocpro-porte-csp';` +
       /* Une adresse SYNTAXIQUEMENT valide, qui ne sera jamais jointe : cette
          porte n'ouvre que des écrans rendus côté client. `env.ts` la valide à
          l'import et refuserait de démarrer sans elle. Le cas où l'application
          ne rendrait rien faute de base est gardé plus bas, par le compte des
          éléments — sans quoi un produit mort passerait au vert. */
       `process.env.DATABASE_URL='postgresql://porte:porte@127.0.0.1:1/porte_csp';` +
       `const {createApp}=await import(${JSON.stringify(join(RACINE, 'server/dist/src/app.js'))});` +
       `createApp().listen(${PORT});`],
      { cwd: RACINE, stdio: 'ignore' },
    )
    ;(async () => {
      for (let i = 0; i < 120; i++) {
        try {
          if ((await fetch(BASE + '/')).ok) return resoudre(fils)
        } catch {
          /* pas encore en écoute */
        }
        await new Promise((r) => setTimeout(r, 250))
      }
      fils.kill()
      rejeter(new Error('le serveur de production n’a pas démarré'))
    })()
  })
}

const plaintes = []
let inspectes = 0

/*
  LE SERVEUR EST CONSTRUIT ICI, ET SON ABSENCE N'EST PAS UNE EXCUSE.

  Cette porte est la seule qui monte `app.ts` plutôt que `vite preview` — c'est
  sa raison d'être, la politique n'existant que dans la réponse du serveur. Elle
  a donc besoin de `server/dist`, que les autres portes ignorent.

  On le construit plutôt que d'exiger qu'il le soit : une porte qui refuse pour
  un état de l'arbre de travail apprend à être sautée. Si la construction échoue
  — dépendances du serveur absentes, client Prisma non généré — on le DIT et l'on
  refuse, parce qu'une porte qu'on ne peut pas exécuter n'est pas une porte
  verte.
*/
const construction = spawnSync('npx', ['tsc', '-b'], {
  cwd: join(RACINE, 'server'),
  stdio: 'pipe',
  encoding: 'utf8',
})
if (construction.status !== 0) {
  console.error(
    '\n✗ politique-de-securite : le serveur ne se construit pas, la porte ne peut pas tourner.\n\n' +
      `${(construction.stdout || '') + (construction.stderr || '')}\n` +
      '  Il manque probablement les dépendances du serveur ou le client Prisma :\n' +
      '    npm --prefix server ci && (cd server && npx prisma generate)\n',
  )
  exit(1)
}

const serveur = await servir()

/* GARDE DU GARDE : sans en-tête, chaque écran passerait sans rien mesurer. */
const entete = (await fetch(BASE + '/')).headers.get('content-security-policy')
if (!entete) {
  console.error('\n✗ politique-de-securite : le serveur ne pose AUCUNE politique.\n')
  serveur.kill()
  exit(1)
}
console.log(`  politique servie : ${entete.slice(0, 96)}…`)

const navigateur = await chromium.launch()
try {
  for (const adresse of ADRESSES) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: 1280, height: 900 },
      locale: 'fr-FR',
    })
    const page = await contexte.newPage()
    const violations = []
    await page.exposeFunction('signalerUneViolation', (v) => violations.push(v))
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        window.signalerUneViolation({
          directive: e.effectiveDirective || e.violatedDirective,
          bloque: (e.blockedURI || '').slice(0, 80),
          ligne: e.lineNumber,
        })
      })
    })
    await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)
    /*
      L'ÉCRAN A-T-IL RENDU ? Une politique ne viole rien sur une page blanche, et
      cette porte passerait au vert en ayant mesuré le vide. On exige donc de la
      matière : le seuil est bas à dessein — on garde le FAIT d'un rendu, pas sa
      richesse, que `mesure-ui` juge déjà sur six cents points.
    */
    const rendu = await page.evaluate(() => ({
      elements: document.querySelectorAll('a, button, input, h1, h2, p').length,
      texte: (document.body.textContent ?? '').trim().length,
    }))
    if (rendu.elements < 3 || rendu.texte < 80) {
      plaintes.push(
        `${adresse} : l'écran n'a PAS rendu (${rendu.elements} éléments, ${rendu.texte} caractères).\n` +
          "   Une page vide ne viole aucune politique : ce vert-là ne vaudrait rien.",
      )
    }
    inspectes++
    process.stdout.write(
      `   ${adresse.padEnd(20)} ${violations.length === 0 ? '✓' : '✗'}  ` +
        `${rendu.elements} éléments\n`,
    )
    for (const v of violations) {
      plaintes.push(
        `${adresse} : « ${v.directive} » a BLOQUÉ ${v.bloque || '(source en ligne)'}` +
          (v.ligne ? ` (ligne ${v.ligne})` : '') +
          '\n   La politique refuse quelque chose dont le produit a besoin. Corrigez\n' +
          '   `politiqueDeSecurite.ts`, et dites dans son en-tête ce que la directive paie.',
      )
    }
    await contexte.close()
  }
} finally {
  await navigateur.close()
  serveur.kill()
}

if (inspectes !== ADRESSES.length) {
  plaintes.push(`${inspectes} écran(s) inspecté(s) pour ${ADRESSES.length} attendu(s).`)
}

if (plaintes.length > 0) {
  console.error(`\n✗ politique-de-securite : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ politique-de-securite : ${inspectes} écrans ouverts derrière le VRAI serveur,\n` +
    '  aucune violation refusée par le navigateur.\n' +
    "  Ce script ne dit RIEN de la SÉVÉRITÉ de la politique — voir son en-tête.",
)
