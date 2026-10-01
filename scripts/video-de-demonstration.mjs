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
 * ═══ OÙ LE FICHIER VA — DANS LE DÉPÔT, ET C'EST UN REVIREMENT ═══
 *
 * La première rédaction le laissait dans `captures/`, exclu du dépôt, à charge
 * pour quelqu'un de l'héberger et d'en poser l'adresse dans `VITE_VIDEO_DEMO`.
 * Conséquence observée : le fichier existait, le lecteur existait, et le produit
 * affichait « la visite n'est pas encore déposée ». Une vidéo qu'il faut
 * héberger à la main est une vidéo qui n'existe pas pour l'utilisateur.
 *
 * ELLE VIT DONC DANS `public/`, et le prix est mesuré, pas supposé :
 *
 *   5,20 Mo   ce que Playwright écrit — VP8, 790 kbps, non optimisé
 *   2,04 Mo   après ré-encodage H.264 (CRF 30), texte des modales intact
 *
 * H.264 ET NON WEBM : il se lit PARTOUT, Safari compris. Le marché visé est le
 * téléphone, et un bailleur sur iPhone qui ne voit rien n'a pas de visite. Un
 * second format en repli doublerait le poids du dépôt pour un cas que celui-ci
 * couvre déjà.
 *
 * `preload="metadata"` dans le produit : un visiteur du manuel qui ne lance pas
 * la vidéo n'en télécharge que l'en-tête. Le fichier pèse dans le DÉPÔT, pas
 * dans ce que reçoit quelqu'un venu chercher un geste.
 *
 * LE RÉ-ENCODAGE EST DANS CE SCRIPT, et non dans une note à suivre. L'outil qui
 * produit l'artefact doit produire CELUI QU'ON SERT ; une étape manuelle entre
 * les deux est une étape qu'on oublie, et le dépôt porterait alors les 5,2 Mo.
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
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

/* La racine, déduite de ce fichier : ce script peut être lancé d'ailleurs. */
const RACINE_DU_DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..')

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
/* LA BRUTE, hors dépôt : on ne versionne pas ce que Playwright écrit. */
const BRUTES = 'captures/visite'
/* CE QU'ON SERT, et qui entre dans le dépôt. */
const SERVI = 'public/visite-du-produit.mp4'
/*
  L'AFFICHE, ET ELLE N'EST PAS DÉCORATIVE.

  `preload="metadata"` ne peint aucune image : sans affiche, le lecteur est un
  RECTANGLE GRIS VIDE sous un titre qui promet une visite — exactement ce qu'on
  lit comme une panne. Vu sur le dernier plan du premier enregistrement, où le
  manuel se filme lui-même.

  960 px DE LARGE ET `-q:v 9`, SOIT 35 Ko. Le lecteur rend au plus ~1 100 px sur
  un écran de bureau : une affiche fixe légèrement agrandie ne se distingue pas.
  Relevé des variantes, sur l'image du tableau de bord : 1280 px → 90 Ko,
  960/q5 → 50 Ko, 960/q7 → 41, 960/q9 → 35, et le texte des cartes « À traiter »
  reste net à l'œil. En dessous, les libellés gris commencent à baver.

  CES 15 Ko COMPTENT : l'écran du manuel pèse 80 801 o au total pour un visiteur,
  dont l'affiche était la moitié. Sur le profil visé — 400 kb/s — chaque dizaine
  de kilo-octets vaut deux dixièmes de seconde.

  LA SECONDE 3 : le tableau de bord et sa file « À traiter ». C'est ce que le
  produit fait, en une image — pas un écran de titre.
*/
const AFFICHE = 'public/visite-affiche.jpg'
const SECONDE_DE_L_AFFICHE = '3'
/* CRF 30 : relevé sur une image de la modale « Bail et sûretés » à 1280 px —
   le texte des champs et des notes reste net. 28 pèse 2,43 Mo pour un gain
   invisible, 32 descend à 1,72 et commence à baver sur les libellés gris. */
const QUALITE = '30'

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
mkdirSync(BRUTES, { recursive: true })

const plaintes = []
let plansJoues = 0

const navigateur = await chromium.launch()
const contexte = await navigateur.newContext({
  ...SANS_AGENT_DE_SERVICE,
  viewport: TAILLE,
  locale: 'fr-FR',
  recordVideo: { dir: BRUTES, size: TAILLE },
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

/*
  LA BRUTE, PUIS CE QU'ON SERT.

  Playwright écrit un WebM sous un nom aléatoire à la fermeture du contexte. On
  le ré-encode en H.264 vers `public/`, et l'on GARDE la brute : c'est la source
  du prochain ré-encodage si l'on veut changer de qualité sans refilmer.
*/
const brutes = readdirSync(BRUTES)
  .filter((f) => f.endsWith('.webm') && !f.startsWith('visite-'))
  .map((f) => ({ f, t: statSync(join(BRUTES, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)

let brute = null
if (brutes.length > 0) {
  brute = `visite-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.webm`
  renameSync(join(BRUTES, brutes[0].f), join(BRUTES, brute))
}

/* GARDE DU GARDE : « aucune plainte » et « rien de filmé » s'écrivent pareil. */
if (plansJoues !== PLANS.length) {
  plaintes.push(`${plansJoues} plan(s) joué(s) pour ${PLANS.length} déclarés.`)
}
if (!brute) {
  plaintes.push("aucun fichier vidéo n'a été écrit — l'enregistrement n'a pas eu lieu.")
}

let poidsServi = null
let poidsAffiche = null
if (brute) {
  /*
    SANS `ffmpeg`, ON NE SERT PAS LA BRUTE. Cinq mégaoctets non optimisés dans
    `public/` seraient pires que pas de vidéo : le dépôt les porterait pour
    toujours. On le DIT, on garde la brute, et l'on sort en 1 — c'est un échec
    de production, pas un avertissement.
  */
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', join(BRUTES, brute),
       '-c:v', 'libx264', '-crf', QUALITE, '-preset', 'slow',
       '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
       join(RACINE_DU_DEPOT, SERVI)],
      { stdio: 'pipe' },
    )
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-ss', SECONDE_DE_L_AFFICHE, '-i', join(RACINE_DU_DEPOT, SERVI),
       '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '9',
       join(RACINE_DU_DEPOT, AFFICHE)],
      { stdio: 'pipe' },
    )
    poidsServi = statSync(join(RACINE_DU_DEPOT, SERVI)).size
    poidsAffiche = statSync(join(RACINE_DU_DEPOT, AFFICHE)).size
  } catch (erreur) {
    plaintes.push(
      `le ré-encodage a échoué : ${String(erreur.message ?? erreur).split('\n')[0]}\n` +
        `   La brute reste dans ${BRUTES}/${brute}. Sans \`ffmpeg\`, on ne pose rien\n` +
        `   dans \`public/\` : cinq mégaoctets non optimisés y resteraient pour toujours.`,
    )
  }
}

if (plaintes.length > 0) {
  console.error(`\n✗ visite : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

const mo = (o) => (o / 1_048_576).toFixed(2)
console.log(
  `\n✓ visite : ${plansJoues} plans filmés sur le paquet de cet arbre.\n` +
    `  ${SERVI} — ${mo(poidsServi)} Mo en H.264, ` +
    `depuis ${mo(statSync(join(BRUTES, brute)).size)} Mo de brute.\n` +
    `  ${AFFICHE} — ${Math.round(poidsAffiche / 1024)} Ko, sans quoi le lecteur\n` +
    `  est un rectangle gris sous un titre qui promet une visite.\n` +
    `  ${TAILLE.width}×${TAILLE.height}, sans son, sans sous-titres.\n\n` +
    `  CE FICHIER ENTRE DANS LE DÉPÔT : committez-le avec le lot, et relancez\n` +
    `  les portes — il change la hauteur de l'écran du manuel et son poids.\n` +
    `  La brute reste dans ${BRUTES}/, qui est exclu : elle sert à ré-encoder\n` +
    `  sans refilmer.\n`,
)
