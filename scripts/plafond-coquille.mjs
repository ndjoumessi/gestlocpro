#!/usr/bin/env node
/**
 * LA COQUILLE NE REGROSSIT PAS.
 *
 * LE DÉFAUT, ET SA MESURE. Avant ce lot, 325 px séparaient le haut de l'écran
 * du premier pixel de contenu, à 360 px de large : un en-tête de 185 px dont
 * les trois sélecteurs se repliaient sur trois lignes, plus un bandeau de
 * démonstration de 140 px, répétés sur les 23 écrans. Sur un téléphone de
 * 780 px de haut, c'est 42 % de la fenêtre occupée avant le premier mot.
 *
 * CE QUE CE SCRIPT MESURE. La distance entre le haut du document et le haut de
 * `<main>` — donc tout ce que la coquille empile avant de céder la place. Il ne
 * mesure ni la beauté de cet en-tête, ni le bien-fondé de ce qu'il contient : il
 * mesure une hauteur, et il refuse quand elle remonte. Une garde qui
 * prétendrait juger d'une mise en page serait une décoration.
 *
 * LES PLAFONDS SONT ÉCRITS, ET NON RELEVÉS À L'EXÉCUTION. Un plafond qui
 * s'inscrit tout seul au poids du jour ne garde rien : il entérine. Ils sont
 * donc en dur ci-dessous, avec la valeur d'avant à côté — la marge est
 * lisible dans le diff, et la faire monter demande d'écrire pourquoi.
 *
 * DEUX ÉCRANS AU MOINS, ET C'EST LA GARDE DU GARDE. La coquille applicative et
 * la coquille publique ne sont pas la même, et mesurer l'une pour l'autre
 * laisserait la moitié du produit sans surveillance.
 *
 *   node scripts/plafond-coquille.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4191
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES PLAFONDS, ÉCRAN PAR ÉCRAN ET LARGEUR PAR LARGEUR.
 *
 * `avant` n'est pas décoratif : c'est la mesure d'avant le lot, gardée à côté
 * du plafond pour que le relecteur voie ce que le plafond concède. Un plafond
 * seul est un nombre ; un plafond avec l'avant est une décision.
 *
 * La marge au-dessus du mesuré est de dix pixels, pas de cent : une refonte
 * qui coûte un demi-bouton doit rougir, sinon le plafond n'est qu'un souvenir.
 */
const PLAFONDS = [
  { adresse: '/demo', largeur: 360, plafond: 132, avant: 325, mesure: 122 },
  { adresse: '/demo', largeur: 1280, plafond: 132, avant: 136, mesure: 122 },
  { adresse: '/demo/paiements', largeur: 360, plafond: 132, avant: 325, mesure: 122 },
  { adresse: '/', largeur: 360, plafond: 80, avant: 69, mesure: 69 },
  { adresse: '/connexion', largeur: 360, plafond: 300, avant: 288, mesure: 288 },
]
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS `PLAFONDS.length`.

  Le dériver de la liste surveillée rend la garde d'accord avec elle-même :
  vider `PLAFONDS`, et l'inspection compare 0 à 0 puis se déclare verte. La
  même mutation a trouvé ce piège deux lots de suite. Ajouter un écran oblige
  donc à toucher ce nombre, et le diff le montre.

  5 = tableau de bord aux deux largeurs · un écran de liste dense · la page
  publique · un écran d'authentification, dont la coquille est une troisième.
*/
const ATTENDUS = 5

async function servir() {
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE + '/')).ok) return fils
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error('plafond-coquille : le serveur de prévisualisation n’a pas répondu.')
}

const serveur = await servir()
const plaintes = []
const releve = []
let inspectes = 0

try {
  const navigateur = await chromium.launch()
  for (const point of PLAFONDS) {
    const contexte = await navigateur.newContext({
      viewport: { width: point.largeur, height: 900 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    const page = await contexte.newPage()
    await page.goto(BASE + point.adresse, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)

    const h = await page.evaluate(() => {
      const main = document.querySelector('main')
      if (!main) return null
      return Math.round(main.getBoundingClientRect().top + window.scrollY)
    })
    await contexte.close()

    const nom = `${point.adresse}@${point.largeur}`
    if (h === null) {
      plaintes.push(
        `${nom} : pas de <main> sur cet écran.\n` +
          "   La hauteur de coquille se mesure contre lui ; sans lui il n'y a pas de mesure,\n" +
          '   et une absence de mesure ne doit jamais s’écrire comme une absence de défaut.',
      )
      continue
    }
    inspectes++
    releve.push({ nom, h, ...point })
    if (h > point.plafond) {
      plaintes.push(
        `${nom} : ${h} px de coquille avant le contenu, pour un plafond de ${point.plafond}.\n` +
          `   Avant ce lot : ${point.avant} px. Ce qui remonte ici est repris sur le contenu,\n` +
          '   sur les 23 écrans à la fois.',
      )
    }
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

if (inspectes === 0) {
  plaintes.push(
    "AUCUN écran inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} écran(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}

for (const r of releve) {
  console.log(
    `  ${r.nom.padEnd(24)} ${String(r.h).padStart(4)} px  (plafond ${String(r.plafond).padStart(4)} · ` +
      `avant le lot ${String(r.avant).padStart(4)} · ` +
      `${r.avant > r.h ? `−${r.avant - r.h}` : `+${r.h - r.avant}`} px)`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ plafond-coquille : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ plafond-coquille : ${inspectes}/${ATTENDUS} écrans sous leur plafond de hauteur avant contenu.\n` +
    '  Ce script ne dit RIEN de ce que cette hauteur contient — voir son en-tête.',
)
