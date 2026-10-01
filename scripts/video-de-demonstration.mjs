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
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
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
/*
  CE QU'ON SERT, et qui entre dans le dépôt — UN FILM PAR LANGUE.

  Le nom porte la langue, parce que rien d'autre ne la porte : un MP4 ne se
  compile pas, aucune porte ne sait lire ce qui y est peint, et `visite-du-
  produit.mp4` a servi un film français à des visiteurs anglophones pendant une
  journée sans que rien ne rougisse. Mesuré le 2026-10-01.
*/
const SERVI = (code) => `public/visite-du-produit.${code}.mp4`
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
const AFFICHE = (code) => `public/visite-affiche.${code}.jpg`
const SECONDE_DE_L_AFFICHE = '3'
/* CRF 30 : relevé sur une image de la modale « Bail et sûretés » à 1280 px —
   le texte des champs et des notes reste net. 28 pèse 2,43 Mo pour un gain
   invisible, 32 descend à 1,72 et commence à baver sur les libellés gris. */
const QUALITE = '30'

/** 1280 × 800 : la forme d'un écran de bureau ordinaire, et un poids tenable. */
const TAILLE = { width: 1280, height: 800 }

/**
 * LES LANGUES, ET POURQUOI ELLES SE TOURNENT ENSEMBLE.
 *
 * Une seule commande les filme toutes, et c'est la garde contre la dérive :
 * aucune des deux visites ne peut être refaite seule, donc elles décrivent
 * toujours le même état du produit. C'est tout ce qu'on sait garantir — qu'un
 * film décrive encore le produit n'est tenu par personne, et le registre
 * `visiteFilmee.ts` l'avoue.
 *
 * `etiquette` est ce que lit `navigator.language`, et c'est LUI qui décide :
 * mesuré le 2026-10-01, un contexte `en-US` sans stockage rend `<html lang>` à
 * `en`. On pose aussi la clé de stockage, par ceinture — avec son VRAI nom,
 * `gestlocpro.locale` : `modales.mjs` en écrit un autre, qui ne sert à rien.
 */
const LANGUES = [
  { code: 'fr', etiquette: 'fr-FR' },
  { code: 'en', etiquette: 'en-US' },
]
const CLE_DE_LANGUE = 'gestlocpro.locale'

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
  {
    adresse: '/demo/parc/A1',
    pause: 3500,
    geste: { fr: /^Bail et sûretés$/, en: /^Lease and sureties$/ },
    apresLeGeste: 5000,
  },
  {
    adresse: '/demo/paiements',
    pause: 4000,
    geste: { fr: /^Quittance/, en: /^Receipt/ },
    apresLeGeste: 4500,
  },
  { adresse: '/demo/depenses', pause: 3500, defiler: true },
  {
    adresse: '/demo/vacance',
    pause: 3000,
    geste: { fr: /^Ouvrir une annonce$/, en: /^Open a listing$/ },
    apresLeGeste: 4500,
  },
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

const navigateur = await chromium.launch()

/**
 * UNE LANGUE, UN FILM.
 *
 * LA LANGUE EST VÉRIFIÉE, PAS SUPPOSÉE. Poser `locale` sur le contexte est un
 * RÉGLAGE ; ce qui compte est ce que la page peint. Un produit qui retomberait
 * sur sa langue par défaut donnerait deux films français nommés différemment —
 * exactement le défaut qu'on referme, en pire, puisqu'il porterait alors le nom
 * de l'anglais. On lit donc `<html lang>` sur le premier plan.
 */
async function filmerUneLangue(langue) {
  const plaintes = []
  let plansJoues = 0

  const contexte = await navigateur.newContext({
    ...SANS_AGENT_DE_SERVICE,
    viewport: TAILLE,
    locale: langue.etiquette,
    recordVideo: { dir: BRUTES, size: TAILLE },
  })
  const page = await contexte.newPage()
  await page.addInitScript(
    ([cle, code]) => {
      try {
        localStorage.setItem(cle, code)
      } catch {
        /* stockage refusé : l'étiquette du contexte décide, et elle suffit */
      }
    },
    [CLE_DE_LANGUE, langue.code],
  )

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

      if (plansJoues === 0) {
        const peinte = await page.evaluate(() => document.documentElement.lang)
        if (peinte !== langue.code) {
          plaintes.push(
            `la page est peinte en « ${peinte} » alors qu'on filme « ${langue.code} ».\n` +
              `   Le film porterait le nom d'une langue qu'il ne parle pas.`,
          )
        }
      }

      if (plan.defiler) await defilerDoucement(page)

      const motif = plan.geste?.[langue.code]
      if (plan.geste && !motif) {
        plaintes.push(
          `${plan.adresse} : aucun motif de geste déclaré pour « ${langue.code} ».\n` +
            `   Le plan serait filmé sans son geste, et nul ne le verrait.`,
        )
      } else if (motif) {
        const bouton = await trouverLeGeste(page, motif)
        if (!bouton) {
          plaintes.push(
            `${plan.adresse} : le geste ${motif} est introuvable en ${langue.code}.\n` +
              `   La visite filmerait un clic manqué, ce qui est pire qu'un plan en moins.`,
          )
        } else {
          await bouton.click()
          await page.waitForTimeout(plan.apresLeGeste ?? 3000)
          await page.keyboard.press('Escape').catch(() => {})
          await page.waitForTimeout(600)
        }
      }
      plansJoues++
    } catch (erreur) {
      plaintes.push(`${plan.adresse} (${langue.code}) : ${String(erreur).split('\n')[0]}`)
    }
  }

  /* LA VIDÉO N'EXISTE QU'APRÈS LA FERMETURE DU CONTEXTE : Playwright l'écrit à ce
     moment-là, sous un nom aléatoire. On la renomme ensuite. */
  await contexte.close()

  const brutes = readdirSync(BRUTES)
    .filter((f) => f.endsWith('.webm') && !f.startsWith('visite-'))
    .map((f) => ({ f, t: statSync(join(BRUTES, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)

  let brute = null
  if (brutes.length > 0) {
    const horodatage = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    brute = `visite-${langue.code}-${horodatage}.webm`
    renameSync(join(BRUTES, brutes[0].f), join(BRUTES, brute))
  }

  /* GARDE DU GARDE : « aucune plainte » et « rien de filmé » s'écrivent pareil. */
  if (plansJoues !== PLANS.length) {
    plaintes.push(`${plansJoues} plan(s) joué(s) pour ${PLANS.length} déclarés en ${langue.code}.`)
  }
  if (!brute) {
    plaintes.push(`aucun fichier vidéo écrit en ${langue.code} — l'enregistrement n'a pas eu lieu.`)
  }

  return { plaintes, plansJoues, brute }
}

/**
 * LA BRUTE, PUIS CE QU'ON SERT.
 *
 * Playwright écrit un WebM. On le ré-encode en H.264 vers `public/`, et l'on
 * GARDE la brute : c'est la source du prochain ré-encodage si l'on veut changer
 * de qualité sans refilmer.
 *
 * SANS `ffmpeg`, ON NE SERT PAS LA BRUTE. Cinq mégaoctets non optimisés dans
 * `public/` seraient pires que pas de vidéo : le dépôt les porterait pour
 * toujours. On le DIT, on garde la brute, et l'on sort en 1 — c'est un échec de
 * production, pas un avertissement.
 *
 * ET L'ON DÉPOSE DANS `dist/`, CE QUI N'EST PAS UNE COMMODITÉ.
 *
 * La caméra filme `vite preview`, qui sert `dist/` — jamais `public/`, jamais
 * les sources. Un fichier écrit dans `public/` après la construction est donc
 * INVISIBLE à la caméra. Mesuré le 2026-10-01 : la première rédaction refilmait
 * la langue neuve en croyant lui montrer sa visite, et `dist/` n'a jamais porté
 * que le français — le manuel anglais s'est filmé avec un lecteur vide, et le
 * défaut était cuit dans le film livré. Raisonner sur l'ORDRE des passes ne
 * touchait pas la cause, qui est la RACINE SERVIE.
 */
function encoder(langue, brute) {
  const video = join(RACINE_DU_DEPOT, SERVI(langue.code))
  const affiche = join(RACINE_DU_DEPOT, AFFICHE(langue.code))
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', join(BRUTES, brute),
       '-c:v', 'libx264', '-crf', QUALITE, '-preset', 'slow',
       '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
       video],
      { stdio: 'pipe' },
    )
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-ss', SECONDE_DE_L_AFFICHE, '-i', video,
       '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '9',
       affiche],
      { stdio: 'pipe' },
    )
    /* Vers la racine servie, pour que la passe suivante puisse les voir. */
    for (const fichier of [video, affiche]) {
      const servi = join(RACINE_DU_DEPOT, 'dist', basename(fichier))
      if (existsSync(dirname(servi))) copyFileSync(fichier, servi)
    }

    return { video: statSync(video).size, affiche: statSync(affiche).size, plainte: null }
  } catch (erreur) {
    return {
      video: null,
      affiche: null,
      plainte:
        `le ré-encodage de ${langue.code} a échoué : ${String(erreur.message ?? erreur).split('\n')[0]}\n` +
        `   La brute reste dans ${BRUTES}/${brute}. Sans \`ffmpeg\`, on ne pose rien\n` +
        `   dans \`public/\` : cinq mégaoctets non optimisés y resteraient pour toujours.`,
    }
  }
}

/*
  LA VISITE SE FILME ELLE-MÊME, et il faut parfois deux passes pour que ce soit
  vrai.

  Le dernier plan est `/demo/manuel`, qui PORTE le lecteur de la visite de sa
  langue. Si ce fichier n'était pas encore dans `dist/` au moment du tournage, on
  a filmé un lecteur vide là où le produit montre une affiche — et le défaut est
  cuit dans le film livré, invisible à toute porte.

  LA CONDITION PORTE SUR `dist/`, PAS SUR `public/`, et c'est la correction d'une
  première rédaction fausse : écrire dans `public/` après la construction ne
  montre rien à la caméra. On relève donc, AVANT chaque tournage, ce que la
  racine servie portait vraiment ; `encoder` l'y dépose ensuite, ce qui rend la
  seconde passe possible dans la même exécution.
*/
const AVEUGLES = new Set()

const plaintes = []
const rapports = []

for (const passe of [1, 2]) {
  for (const langue of LANGUES) {
    if (passe === 1) {
      const dansLaRacineServie = existsSync(
        join(RACINE_DU_DEPOT, 'dist', basename(SERVI(langue.code))),
      )
      if (!dansLaRacineServie) AVEUGLES.add(langue.code)
    } else if (!AVEUGLES.has(langue.code)) continue

    const { plaintes: dites, plansJoues, brute } = await filmerUneLangue(langue)
    plaintes.push(...dites)
    if (!brute) continue

    const { video, affiche, plainte } = encoder(langue, brute)
    if (plainte) {
      plaintes.push(plainte)
      continue
    }
    /* Le rapport de la SECONDE passe remplace celui de la première. */
    const deja = rapports.findIndex((r) => r.code === langue.code)
    const rapport = { code: langue.code, plansJoues, brute, video, affiche, passe }
    if (deja >= 0) rapports[deja] = rapport
    else rapports.push(rapport)
  }
  if (AVEUGLES.size === 0) break
}

serveur.kill()
await navigateur.close()

if (plaintes.length > 0) {
  console.error(`\n✗ visite : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

const mo = (o) => (o / 1_048_576).toFixed(2)
console.log(`\n✓ visite : ${LANGUES.length} langue(s) filmées sur le paquet de cet arbre.\n`)
for (const r of rapports) {
  console.log(
    `  ${r.code} — ${r.plansJoues} plans, ${SERVI(r.code)} à ${mo(r.video)} Mo en H.264,\n` +
      `       depuis ${mo(statSync(join(BRUTES, r.brute)).size)} Mo de brute ;\n` +
      `       ${AFFICHE(r.code)} à ${Math.round(r.affiche / 1024)} Ko, sans quoi le lecteur\n` +
      `       est un rectangle gris sous un titre qui promet une visite.` +
      (r.passe === 2
        ? `\n       Seconde passe : la racine servie ne portait pas cette visite\n` +
          `       au premier tournage, le manuel s'y filmait avec un lecteur vide.`
        : ''),
  )
}
console.log(
  `\n  ${TAILLE.width}×${TAILLE.height}, sans son, sans sous-titres.\n\n` +
    `  CES FICHIERS ENTRENT DANS LE DÉPÔT : committez-les avec le lot, et relancez\n` +
    `  les portes — ils changent la hauteur de l'écran du manuel et son poids.\n` +
    `  Les brutes restent dans ${BRUTES}/, qui est exclu : elles servent à\n` +
    `  ré-encoder sans refilmer.\n`,
)
