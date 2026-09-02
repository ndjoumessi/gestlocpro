/**
 * CE QUE VOIT UN VISITEUR, SUR L'HÔTE VIVANT.
 *
 * ══════════════════ CE N'EST PAS UNE PORTE ══════════════════
 *
 * Et c'est dit ici pour que personne ne l'ajoute à `check:navigateur` sans y
 * penser. Les seize portes de ce dépôt sont HERMÉTIQUES : elles construisent,
 * servent et mesurent en local, sans réseau ni production. C'est ce qui leur
 * permet d'être exigées avant chaque commit, et ce qui les rend dignes de
 * confiance quand elles rougissent.
 *
 * Cet outil-ci fait l'inverse : il interroge un hôte RÉEL, donc il dépend du
 * réseau, du déploiement et de l'humeur d'un tiers. Le mettre dans une porte
 * ferait rougir un commit parce qu'un DNS a hoqueté. Il se lance À LA MAIN,
 * après un déploiement, et son verdict porte sur ce moment-là.
 *
 * ══════════════════ POURQUOI IL EXISTE ══════════════════
 *
 * Le 2026-09-02, TROIS FOIS D'AFFILÉE, les seize portes étaient vertes et
 * l'hôte était cassé :
 *
 *   1. Vercel a refusé un dossier de sortie vide — build en erreur en trois
 *      secondes, et l'ANCIEN déploiement est resté en place ;
 *   2. la commande de construction dépassait 256 caractères — déploiement
 *      refusé, journal vide ;
 *   3. un `index.html` de remplissage était servi DEVANT le relais : la page
 *      d'accueil affichait trois paragraphes expliquant pourquoi personne ne
 *      les lirait jamais.
 *
 * Le troisième a été trouvé par l'utilisateur, sur son propre produit. Et il
 * avait échappé à ma vérification pour une raison précise : j'avais mesuré que
 * `/` rendait 200. IL LE RENDAIT. « 200 » et « la bonne page » sont deux faits
 * différents.
 *
 * ══════════════════ CE QU'IL MESURE, DONC ══════════════════
 *
 * Du CONTENU RENDU, jamais un code ni le document servi. La distinction a été
 * apprise en écrivant cet outil : sa première version lisait le HTML par
 * `fetch`, et n'y trouvait aucun des textes attendus — ils sont peints par React
 * dans le NAVIGATEUR, la coquille servie n'en porte aucun.
 *
 * Pire : cette coquille porte un `<title>` STATIQUE, identique sur toutes les
 * routes. La veille, j'avais « vérifié le contenu » en lisant ce titre sur
 * quatre adresses et en le trouvant juste partout. Il l'était — il l'aurait été
 * sur une page blanche. Une seconde vérification creuse, après celle des codes
 * 200 qu'elle prétendait corriger.
 *
 * Cet outil ouvre donc un vrai navigateur, comme les seize portes.
 *
 * Et le PAQUET référencé par la page est chargé pour de bon : c'est le seul
 * contrôle qui attrape la dérive des empreintes entre deux hôtes qui
 * construisent séparément — le défaut qui a fait choisir le relais total plutôt
 * que partiel, et qui aurait cassé la page à chaque déploiement.
 */
import { exit, argv } from 'node:process'
import { chromium } from 'playwright'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

/**
 * L'hôte interrogé.
 *
 * Écrit ici et non deviné : cet outil sert précisément à vérifier une adresse
 * PUBLIQUE, et la lui faire découvrir depuis la configuration reviendrait à
 * mesurer la configuration une seconde fois. Le premier argument le remplace,
 * pour interroger Railway directement ou un déploiement de prévisualisation.
 */
const HOTE = argv[2] ?? 'https://gestlocpro.vercel.app'

/** Ce qu'aucune page du produit ne doit jamais porter. */
const REMPLISSAGE = /SORTIE que Vercel exige|Output Directory|vercel-vide/i

const plaintes = []
let controles = 0

const navigateur = await chromium.launch()
const contexte = await navigateur.newContext({
  ...SANS_AGENT_DE_SERVICE,
  viewport: { width: 1280, height: 900 },
  locale: 'fr-FR',
})
const page = await contexte.newPage()

/** Un écran doit porter SON texte PEINT, pas seulement un code de réponse. */
async function ecran(chemin, attendu, ceQueCaVeutDire) {
  controles++
  try {
    const reponse = await page.goto(`${HOTE}${chemin}`, { waitUntil: 'networkidle' })
    const statut = reponse?.status() ?? 0
    if (statut >= 400) {
      plaintes.push(`${chemin} : ${statut}. ${ceQueCaVeutDire}`)
      return null
    }
    const texte = await page.evaluate(() => document.body.innerText ?? '')
    if (REMPLISSAGE.test(texte)) {
      plaintes.push(
        `${chemin} : montre un texte de REMPLISSAGE. Un fichier statique passe ` +
          `devant le relais — c'est le défaut du 2026-09-02, revenu.`,
      )
      return null
    }
    if (!attendu.test(texte)) {
      plaintes.push(
        `${chemin} : répond ${statut} et ne PEINT pas ${attendu}.\n` +
          `   ${ceQueCaVeutDire}\n` +
          `   C'est l'écart entre « 200 » et « la bonne page ».`,
      )
      return null
    }
    return { statut, reponse }
  } catch (erreur) {
    plaintes.push(`${chemin} : injoignable — ${String(erreur).split('\n')[0]}`)
    return null
  }
}

console.log(`\nfumée : ${HOTE}\n`)

const accueil = await ecran(
  '/',
  /tenu comme un patrimoine|held like an estate/,
  "La page d'accueil ne montre pas la vitrine.",
)

/* LE PAQUET RÉFÉRENCÉ, CHARGÉ POUR DE BON. Deux hôtes qui construisent
   séparément rendent des empreintes différentes ; un document qui réclame un
   fichier que l'hôte n'a pas donne une page blanche, et le document, lui,
   répond 200. Le navigateur le charge vraiment : on lit ce qu'il a obtenu. */
controles++
if (accueil) {
  const echecs = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.initiatorType === 'script' || r.initiatorType === 'link')
      .filter((r) => r.responseStatus >= 400)
      .map((r) => r.name),
  )
  if (echecs.length > 0) {
    plaintes.push(
      `/ : ${echecs.length} fichier(s) réclamé(s) par le document et NON servi(s) — ` +
        `${echecs.join(', ')}.\n` +
        `   Page blanche pour tout le monde, sur un document qui répond 200.`,
    )
  }
}

await ecran(
  '/demo/parc',
  /Parc immobilier|Portfolio/,
  'Un lien profond ne peint pas le SPA : la réécriture ou le relais est tombé.',
)

await ecran(
  '/connexion',
  /Content de vous revoir|Good to see you/,
  "L'écran de connexion ne se peint pas — personne ne peut entrer.",
)

/* L'API, ET SES DEUX RÉPONSES ATTENDUES. Par le contexte du navigateur, donc
   avec les mêmes cookies et la même origine qu'un visiteur. */
controles++
try {
  const r = await contexte.request.get(`${HOTE}/api/version`)
  const corps = await r.text()
  if (!r.ok() || !/"paquet"/.test(corps)) {
    plaintes.push(`/api/version : ${r.status()} — l'API ne répond pas derrière l'adresse.`)
  }
} catch (erreur) {
  plaintes.push(`/api/version : injoignable — ${String(erreur).split('\n')[0]}`)
}

controles++
try {
  const r = await contexte.request.get(`${HOTE}/api/auth/me`)
  if (r.status() !== 401) {
    plaintes.push(
      `/api/auth/me : ${r.status()} au lieu de 401.\n` +
        `   401 est la réponse JUSTE à un visiteur anonyme : le serveur répond et ` +
        `dit « personne n'est connecté ». Un 404 dirait qu'il n'y a pas de serveur.`,
    )
  }
} catch (erreur) {
  plaintes.push(`/api/auth/me : injoignable — ${String(erreur).split('\n')[0]}`)
}

/* UNE SEULE POLITIQUE DE SÉCURITÉ. Deux en-têtes s'appliquent en INTERSECTION,
   et le résultat n'est écrit nulle part — personne ne l'a voulu ni relu. */
controles++
try {
  const r = await contexte.request.get(`${HOTE}/`)
  const brut = r.headersArray().filter((h) => h.name.toLowerCase() === 'content-security-policy')
  if (brut.length !== 1) {
    plaintes.push(
      `/ : ${brut.length} politique(s) de sécurité au lieu d'une. Deux en-têtes ` +
        `s'appliquent en intersection, et personne n'a écrit le résultat.`,
    )
  }
} catch (erreur) {
  plaintes.push(`/ : en-têtes illisibles — ${String(erreur).split('\n')[0]}`)
}

await contexte.close()
await navigateur.close()

/**
 * GARDE DU GARDE — le compte est écrit à la main.
 *
 * « Aucune plainte » et « rien de contrôlé » s'écrivent pareil dans un
 * terminal, et c'est exactement le piège que cet outil existe pour ne pas
 * reproduire : une erreur avalée, une boucle qui ne tourne pas, et il rendrait
 * vert sur un hôte mort.
 */
const CONTROLES_ATTENDUS = 7
if (controles !== CONTROLES_ATTENDUS) {
  plaintes.push(
    `${controles} contrôle(s) exécuté(s) pour ${CONTROLES_ATTENDUS} attendus. ` +
      `« Aucune plainte » et « rien de contrôlé » s'écrivent pareil.`,
  )
}

if (plaintes.length > 0) {
  console.log(`✗ fumée : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.log(`  ▸ ${p}\n`)
  exit(1)
}

console.log(
  `✓ fumée : ${controles} contrôles sur l'hôte VIVANT, dans un vrai navigateur —\n` +
    `  la vitrine, un lien profond et l'écran de connexion PEINTS, aucun fichier\n` +
    `  réclamé et non servi, les deux réponses de l'API, une seule politique.\n` +
    `  Du contenu rendu, jamais un code ni un titre statique.\n`,
)
