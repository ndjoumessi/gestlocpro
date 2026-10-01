#!/usr/bin/env node
/**
 * LA VISITE FILMÉE — enregistrée depuis le PRODUIT, pas mise en scène.
 *
 * ═══ POURQUOI UN SCRIPT, ET PAS UN ENREGISTREMENT À LA MAIN ═══
 *
 * Une capture d'écran faite à la main est juste le jour où on la fait. Elle
 * vieillit en silence, exactement comme les quatre relevés chiffrés dont ce
 * dépôt garde la trace, et personne ne remarque qu'elle montre un bouton qui
 * n'existe plus — c'est déjà arrivé ici, sur un audit mené contre des captures
 * d'un déploiement en retard : trois défauts sur quatre n'existaient pas.
 *
 * Un script se RELANCE. Le jour où un écran change, on refait la visite en
 * quarante secondes, et la nouvelle vidéo montre le produit d'aujourd'hui.
 *
 * ═══ CE QU'IL FILME, ET CE QU'IL NE PEUT PAS FILMER ═══
 *
 * IL FILME `/demo` sur le paquet de CET arbre, servi en local : trois immeubles,
 * douze logements, une année de mouvements fictifs. Les gestes joués sont les
 * mêmes que ceux que `modales.mjs` ouvre dans ses portes — même chemin, mêmes
 * noms accessibles.
 *
 * IL NE FILME PAS de vraies données, et c'est non négociable : la production est
 * hors de portée de cette machine, et elle doit le rester.
 *
 * IL N'A NI SON NI SOUS-TITRES. Playwright enregistre une image, pas une voix.
 * Le manuel écrit porte le texte ; cette vidéo porte le mouvement. Dire que
 * c'est équivalent serait faux — une personne sourde n'a pas la vidéo, elle a le
 * manuel — et c'est pourquoi le manuel n'est pas optionnel.
 *
 * ═══ OÙ LE FICHIER VA, ET POURQUOI PAS DANS LE DÉPÔT ═══
 *
 * Dans `captures/visite/`, qui est DÉJÀ exclu du dépôt. Un WebM de plusieurs
 * mégaoctets dans `public/` — 76 Ko aujourd'hui, polices comprises — changerait
 * ce que chaque visiteur télécharge, et ferait entrer un binaire dérivé dans
 * chaque revue. C'est le même arbitrage que les brutes de photos, et il a déjà
 * été tranché ici.
 *
 * CE QU'IL FAUT FAIRE DU FICHIER, en deux gestes :
 *
 *   1. le déposer sur un hébergement que vous contrôlez (un espace de stockage,
 *      un sous-domaine, un CDN) ;
 *   2. poser son adresse dans `VITE_VIDEO_DEMO` à la construction. Sans elle,
 *      l'écran du manuel DIT que la visite n'est pas déposée et propose la
 *      démonstration vivante — il ne peint pas un lecteur vide.
 *
 *   node scripts/video-de-demonstration.mjs        ·     npm run visite
 *
 * ═══ CE QU'AUCUNE PORTE NE MESURE ICI ═══
 *
 * Ce script n'est pas une garde : il ne refuse rien, il PRODUIT. Il sort en 1 si
 * un geste de la visite est introuvable — auquel cas la vidéo montrerait un
 * écran figé sur un clic manqué —, et c'est la seule chose qu'il vérifie.
 */
import { chromium } from 'playwright'
import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { exit } from 'node:process'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

/*
  4181 ET NON 4190, ET LA RAISON EST MESURÉE.

  4190 était le seul trou de la plage des portes (4183–4199), et je l'ai pris
  pour cette raison. `vite preview` s'y lance et y écoute — `curl` obtient 200 —
  mais `attendreUneReponse` n'a jamais rien vu, et la visite échouait au bout de
  vingt-cinq secondes sur un serveur bel et bien debout.

  CAUSE : 4190 figure sur la liste des ports interdits du WHATWG (« sieve »), que
  `fetch` applique et que `curl` ignore. Mesuré sur un serveur HTTP nu, sans
  Vite : `fetch ✗ bad port` sur 4190, `200` sur 4181.

  Le trou de la plage n'en était donc pas un : c'est un port que ce dépôt ne peut
  pas utiliser, et le saut était juste.
*/
const PORT = 4181
const BASE = `http://127.0.0.1:${PORT}`
const SORTIE = 'captures/visite'

/** 1280 × 800 : la forme d'un écran de bureau ordinaire, et un poids tenable. */
const TAILLE = { width: 1280, height: 800 }

/**
 * LA VISITE, PLAN PAR PLAN.
 *
 * `pause` est le temps de LECTURE, pas une marge technique : un écran qui passe
 * en une seconde ne se lit pas, et une visite qu'on doit mettre en pause pour
 * suivre est une visite ratée. Les chiffres viennent d'une lecture à voix haute
 * des titres et des indicateurs de chaque écran.
 *
 * `geste` est joué APRÈS la pause : on voit l'écran, puis on voit ce qu'on en
 * fait. L'inverse montrerait une modale avant que l'œil ait situé la page.
 */
const PLANS = [
  { adresse: '/demo', pause: 4000 },
  { adresse: '/demo/parc', pause: 4000, defiler: true },
  { adresse: '/demo/parc/A1', pause: 3500, geste: /^Bail et sûretés$/, apresLeGeste: 5000 },
  { adresse: '/demo/paiements', pause: 4000, geste: /^Quittance/, apresLeGeste: 4500 },
  { adresse: '/demo/depenses', pause: 3500, defiler: true },
  { adresse: '/demo/vacance', pause: 3000, geste: /^Ouvrir une annonce$/, apresLeGeste: 4500 },
  { adresse: '/demo/manuel', pause: 4500, defiler: true },
]

/**
 * LE GESTE, MÊME REPLIÉ DERRIÈRE TROIS POINTS.
 *
 * Trois des quatre gestes de cette visite vivent dans un menu de débordement.
 * On suit le chemin de l'utilisateur, et l'on ouvre le menu de L'EN-TÊTE :
 * la coquille en porte un pour le compte, et l'ouvrir mènerait à la déconnexion.
 */
async function trouverLeGeste(page, motif) {
  const direct = page.getByRole('button', { name: motif })
  const item = page.getByRole('menuitem', { name: motif })
  const t0 = Date.now()
  do {
    if ((await direct.count()) > 0) return direct.first()
    if ((await item.count()) > 0) return item.first()
    for (const trois of await page
      .locator('[data-en-tete-de-page] [aria-haspopup="menu"], main [aria-haspopup="menu"]')
      .all()) {
      await trois.click().catch(() => {})
      await page.waitForTimeout(250)
      if ((await item.count()) > 0) return item.first()
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(400)
  } while (Date.now() - t0 < 15000)
  return null
}

/**
 * UN DÉFILEMENT LENT, et non un saut en bas de page.
 *
 * `scrollIntoView` et `window.scrollTo` déplacent la vue d'un coup : à
 * l'enregistrement, la page saute et l'œil perd le fil. On avance par petits
 * pas, ce qui donne à la vidéo le mouvement qu'une capture n'a pas.
 */
async function defilerDoucement(page) {
  await page.evaluate(async () => {
    const haut = document.documentElement.scrollHeight - window.innerHeight
    if (haut <= 0) return
    const pas = Math.max(8, Math.round(haut / 90))
    for (let y = 0; y < haut; y += pas) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    }
    window.scrollTo(0, haut)
  })
  await page.waitForTimeout(600)
}

const serveur = await servirLaPrevisualisation('visite', PORT)
mkdirSync(SORTIE, { recursive: true })

const plaintes = []
let plansJoues = 0

const navigateur = await chromium.launch()
const contexte = await navigateur.newContext({
  ...SANS_AGENT_DE_SERVICE,
  viewport: TAILLE,
  locale: 'fr-FR',
  recordVideo: { dir: SORTIE, size: TAILLE },
})
const page = await contexte.newPage()

for (const plan of PLANS) {
  try {
    await page.goto(`${BASE}${plan.adresse}`, { waitUntil: 'networkidle' })
    /* ATTENDRE LA DONNÉE, PAS L'IMMOBILITÉ : `networkidle` est satisfait par un
       squelette. On attend que le cadre porte du texte avant de compter la
       pause de lecture, sans quoi on filme un gabarit vide. */
    await page
      .locator('main')
      .filter({ hasText: /\S{20,}/ })
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => {})
    await page.waitForTimeout(plan.pause)

    if (plan.defiler) await defilerDoucement(page)

    if (plan.geste) {
      const bouton = await trouverLeGeste(page, plan.geste)
      if (!bouton) {
        plaintes.push(
          `${plan.adresse} : le geste ${plan.geste} est introuvable.\n` +
            `   La visite filmerait un clic manqué, ce qui est pire qu'un plan en moins.`,
        )
        continue
      }
      await bouton.click()
      await page.waitForTimeout(plan.apresLeGeste ?? 3000)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(600)
    }
    plansJoues++
  } catch (erreur) {
    plaintes.push(`${plan.adresse} : ${String(erreur).split('\n')[0]}`)
  }
}

/* LA VIDÉO N'EXISTE QU'APRÈS LA FERMETURE DU CONTEXTE : Playwright l'écrit à ce
   moment-là, sous un nom aléatoire. On la renomme ensuite. */
await contexte.close()
await navigateur.close()
serveur.kill()

const horodatage = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
const brutes = readdirSync(SORTIE)
  .filter((f) => f.endsWith('.webm') && !f.startsWith('visite-'))
  .map((f) => ({ f, t: statSync(join(SORTIE, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)

let fichier = null
if (brutes.length > 0) {
  fichier = `visite-${horodatage}.webm`
  renameSync(join(SORTIE, brutes[0].f), join(SORTIE, fichier))
}

/* GARDE DU GARDE : « aucune plainte » et « rien de filmé » s'écrivent pareil. */
if (plansJoues !== PLANS.length) {
  plaintes.push(`${plansJoues} plan(s) joué(s) pour ${PLANS.length} déclarés.`)
}
if (!fichier) {
  plaintes.push("aucun fichier vidéo n'a été écrit — l'enregistrement n'a pas eu lieu.")
}

if (plaintes.length > 0) {
  console.error(`\n✗ visite : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

const poids = (statSync(join(SORTIE, fichier)).size / 1_048_576).toFixed(1)
console.log(
  `\n✓ visite : ${plansJoues} plans filmés sur le paquet de cet arbre.\n` +
    `  ${SORTIE}/${fichier} — ${poids} Mo, ${TAILLE.width}×${TAILLE.height}, sans son.\n\n` +
    `  CE FICHIER N'EST PAS DANS LE DÉPÔT (\`captures/\` est exclu), et c'est voulu.\n` +
    `  Déposez-le sur un hébergement que vous contrôlez, puis posez son adresse\n` +
    `  dans VITE_VIDEO_DEMO à la construction. Sans elle, l'écran du manuel DIT\n` +
    `  que la visite n'est pas déposée et renvoie à la démonstration vivante.\n`,
)
