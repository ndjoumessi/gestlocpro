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
 * CE QU'IL REGARDE, ET CE QU'IL NE REGARDE PAS — écrit parce qu'il a d'abord
 * regardé cinq points sur deux cent cinquante-trois, sans le dire.
 *
 * IL REGARDE les 23 écrans déduits du routeur, à TROIS largeurs : 320, la plus
 * étroite du marché visé ; 360, l'appareil de référence ; 1280, le poste de
 * bureau. Soixante-neuf points.
 *
 * IL NE REGARDE PAS les huit autres largeurs de `mesure-ui`. Ce n'est pas un
 * oubli : la hauteur de coquille ne change qu'aux points de rupture, et les
 * trois familles de coquille du produit — applicative, publique,
 * authentification — les franchissent toutes entre 320 et 1280. Une quatrième
 * largeur mesurerait la même chose une quatrième fois. Si un jour une coquille
 * se replie à 700 px, ce script ne le verra pas, et c'est écrit ici.
 *
 * IL NE REGARDE PAS non plus ce que cette hauteur CONTIENT. Remplacez l'en-tête
 * par une bande vide de même hauteur et il reste vert. Il garde un nombre.
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
import { inventaireDesRoutes, exigerUnInventairePlein } from './inventaire/routes.mjs'

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
/**
 * LES PLAFONDS, PAR FAMILLE DE COQUILLE ET PAR LARGEUR.
 *
 * TROIS FAMILLES, parce qu'il y en a trois et pas vingt-trois : l'applicative
 * (barre + bandeau + barre basse), la publique (un en-tête seul), celle de
 * l'authentification (une colonne centrée sous un en-tête haut). Les 23 écrans
 * s'y rangent, et un plafond par écran serait vingt-trois fois le même nombre.
 *
 * LE PLAFOND EST LE MESURÉ, SANS MARGE — et c'est le second correctif de ce
 * fichier. La première rédaction autorisait 132 px pour un mesuré de 122 : dix
 * pixels que personne n'avait justifiés, donc dix pixels qu'une refonte
 * distraite pouvait dépenser sans que rien ne le dise. Un plafond au mesuré
 * fait rougir au premier pixel, et le faire monter demande d'écrire ici la
 * valeur d'avant et ce qu'elle achète — comme le fait `poids-ecrans` pour les
 * octets.
 *
 * `avant` garde la mesure d'avant la refonte : un plafond seul est un nombre,
 * un plafond avec l'avant est une décision.
 */
const FAMILLES = {
  applicative: {
    /* 320 : la mention de démonstration passe à deux lignes, +21 px. C'est le
       prix d'une phrase courte QUI NOMME ce qui est fictif, plutôt qu'une
       « Données fictives. » qui tient sur une ligne et n'apprend rien. */
    320: { plafond: 143, avant: 325 },
    360: { plafond: 122, avant: 325 },
    1280: { plafond: 122, avant: 136 },
  },
  publique: { 320: { plafond: 69, avant: 69 }, 360: { plafond: 69, avant: 69 }, 1280: { plafond: 69, avant: 69 } },
  /* QUATRIÈME FAMILLE, TROUVÉE EN ÉLARGISSANT — et c'est ce que l'élargissement
     valait. L'écran introuvable porte son propre en-tête, plus haut que celui
     de la vitrine : 193 px à 320 et 360, 75 px à 1280. Les cinq points de la
     première rédaction ne le voyaient pas, et il aurait passé pour « publique »
     s'il avait été rangé au jugé. Valeurs entérinées, non bénies : cet écran
     n'a pas été refondu. */
  introuvable: {
    320: { plafond: 193, avant: 193 },
    360: { plafond: 193, avant: 193 },
    1280: { plafond: 75, avant: 75 },
  },
  /* Non touchée par la refonte : la valeur est celle d'avant, et le plafond
     l'entérine sans la bénir. C'est le prochain lot qui aura à la défendre. */
  authentification: {
    320: { plafond: 288, avant: 288 },
    360: { plafond: 288, avant: 288 },
    1280: { plafond: 82, avant: 82 },
  },
}

/** À quelle famille appartient une adresse. Déduit, jamais recopié. */
function familleDe(adresse) {
  if (adresse === ADRESSE_404) return 'introuvable'
  if (adresse.startsWith('/app') || adresse.startsWith('/demo')) return 'applicative'
  if (['/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser'].includes(adresse))
    return 'authentification'
  return 'publique'
}

const LARGEURS = [320, 360, 1280]

/**
 * Les adresses qui ne rendent PAS d'écran, et pourquoi.
 *
 * `/app` redirige vers le tableau de bord du rôle : il n'a ni contenu ni
 * `<main>`, et lui demander une hauteur de coquille n'aurait pas de sens.
 * Écrite ici plutôt que devinée par l'absence de `<main>` — sans quoi un écran
 * réel qui perdrait son `<main>` par accident se sauterait tout seul.
 */
const SANS_ECRAN = ['/app']
/** L'adresse que `routes.mjs` emploie pour visiter l'écran introuvable. */
const ADRESSE_404 = '/adresse-qui-n-existe-pas'
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UN PRODUIT CALCULÉ.

  Le dériver de la liste surveillée — `ADRESSES.length * LARGEURS.length` —
  rendrait la garde d'accord avec elle-même : vider l'inventaire, et
  l'inspection comparerait 0 à 0 puis se déclarerait verte. La même mutation a
  trouvé ce piège trois lots de suite. Ajouter un écran ou une largeur oblige
  donc à toucher ce nombre, et le diff le montre.

  69 = (24 écrans déduits du routeur − 1 sans écran) × 3 largeurs.
  3  = la route `/app`, redirection sans `<main>`, à ses trois largeurs.

  Passé de 66 à 69 avec le registre des décisions. Ce nombre doit être touché à
  la main, et c'est le but : le diff montre alors qu'un écran est apparu, là où
  un compte dérivé de l'inventaire se serait mis d'accord avec lui-même.
*/
const ATTENDUS = 69
const SAUTEES_ATTENDUES = 3

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

const routes = inventaireDesRoutes()
exigerUnInventairePlein(routes)
const ADRESSES = routes.map((r) => r.adresse)

const serveur = await servir()
const plaintes = []
const releve = []
let inspectes = 0
/** Les routes déclarées sans écran, comptées pour que leur nombre soit gardé. */
let sautees = 0
/** Les points mesurés avant que les polices soient prêtes — voir plus bas. */
const policesEnRetard = []

try {
  const navigateur = await chromium.launch()
  for (const largeur of LARGEURS) {
    const contexte = await navigateur.newContext({
    /* L'AGENT DE SERVICE EST BLOQUÉ PENDANT LA MESURE.
       `main.tsx` l'enregistre en production, donc sur le paquet que ces portes
       servent. Installé, il répondrait à la place du réseau dès la deuxième
       navigation : les octets et les requêtes tomberaient, la porte annoncerait
       un gain, et ce gain serait celui d'un cache local que l'utilisateur n'a
       pas au premier chargement. On mesure le réseau, donc on écarte ce qui le
       masque. */
    serviceWorkers: 'block',
      viewport: { width: largeur, height: 900 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    const page = await contexte.newPage()
    for (const adresse of ADRESSES) {
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      /*
        ON ATTEND LES POLICES, PARCE QUE CETTE GARDE A RENDU UN FAUX ROUGE.

        Mesuré : sur la première passe suivant une reconstruction, ce script a
        rendu 128 px de coquille sur `/demo/cautions@1280` et
        `/demo/locataires@1280` pour un plafond de 122 — puis 122 aux quatre
        passages suivants, sans qu'une ligne de source ait bougé entre les deux.
        Six pixels, soit l'écart entre la boîte de ligne d'un titre rendu dans la
        police de repli et la même dans la police chargée.

        `networkidle` ne suffit pas : il dit que le réseau s'est tu, pas que le
        navigateur a fini de reconstruire ses boîtes avec la fonte arrivée. Le
        délai de 300 ms qui suit non plus — c'est un pari sur une machine, et il
        se perd exactement quand la machine est chargée. `mesure-ui.mjs` attend
        cet état depuis toujours, et c'est la seule des gardes au navigateur qui
        le faisait.

        UNE GARDE QUI ROUGIT POUR UNE RAISON QUI N'EST PAS DANS LE CODE est pire
        qu'une garde absente : elle apprend à relancer jusqu'au vert, et le jour
        où le rouge est vrai, il est relancé aussi. L'échec de l'attente est donc
        COMPTÉ et dit à la fin, plutôt qu'avalé — une police qui n'arrive jamais
        ferait revenir le même faux rouge en silence.
      */
      await page
        .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
        .catch(() => policesEnRetard.push(`${adresse}@${largeur}`))
      await page.waitForTimeout(300)

      const h = await page.evaluate(() => {
        const main = document.querySelector('main')
        if (!main) return null
        return Math.round(main.getBoundingClientRect().top + window.scrollY)
      })

      const nom = `${adresse}@${largeur}`
      /*
        LES ROUTES SANS ÉCRAN, DÉCLARÉES ET COMPTÉES À PART.

        `/app` ne rend pas un écran : il redirige vers le tableau de bord selon
        le rôle. Il n'a donc pas de `<main>`, et exiger une hauteur de coquille
        d'une redirection n'a pas de sens. La liste est ÉCRITE et son compte
        entre dans `ATTENDUS` : une route qui perdrait son `<main>` sans être
        ici fait toujours rougir, et une route qui redeviendrait un écran ferait
        chuter le compte des sautées.
      */
      if (SANS_ECRAN.includes(adresse)) {
        if (h !== null) {
          plaintes.push(
            `${nom} : déclarée sans écran, mais elle rend un <main>.\n` +
              "   La déclaration est périmée : retirez-la, l'écran veut un plafond.",
          )
        }
        sautees++
        continue
      }
      if (h === null) {
        plaintes.push(
          `${nom} : pas de <main> sur cet écran.\n` +
            "   La hauteur de coquille se mesure contre lui ; sans lui il n'y a pas de mesure,\n" +
            '   et une absence de mesure ne doit jamais s’écrire comme une absence de défaut.',
        )
        continue
      }
      const famille = familleDe(adresse)
      const p = FAMILLES[famille][largeur]
      inspectes++
      releve.push({ nom, h, famille, ...p })
      if (h > p.plafond) {
        plaintes.push(
          `${nom} (${famille}) : ${h} px de coquille avant le contenu, pour un plafond de ${p.plafond}.\n` +
            `   Avant la refonte : ${p.avant} px. Ce qui remonte ici est repris sur le contenu,\n` +
            '   sur tous les écrans de cette famille à la fois.',
        )
      }
    }
    await contexte.close()
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
if (sautees !== SAUTEES_ATTENDUES) {
  plaintes.push(
    `${sautees} route(s) sautée(s) pour ${SAUTEES_ATTENDUES} attendue(s).\n` +
      "   La liste des routes sans écran est périmée dans un sens ou dans l'autre.",
  )
}

/* Le relevé est résumé PAR FAMILLE : soixante-neuf lignes noieraient le seul
   nombre qui compte, qui est le pire de chaque famille. */
const parFamille = {}
for (const r of releve) {
  const cle = `${r.famille}@${r.nom.split('@')[1]}`
  if (!parFamille[cle] || r.h > parFamille[cle].h) parFamille[cle] = r
}
for (const [cle, r] of Object.entries(parFamille)) {
  console.log(
    `  ${cle.padEnd(26)} pire ${String(r.h).padStart(4)} px  (plafond ${String(r.plafond).padStart(4)} · ` +
      `avant la refonte ${String(r.avant).padStart(4)} · ` +
      `${r.avant > r.h ? `−${r.avant - r.h}` : `+${r.h - r.avant}`} px)   ${r.nom}`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ plafond-coquille : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ plafond-coquille : ${inspectes}/${ATTENDUS} écrans sous leur plafond de hauteur avant contenu.\n` +
    '  Ce script ne dit RIEN de ce que cette hauteur contient — voir son en-tête.' +
    (policesEnRetard.length > 0
      ? `\n  ⚠ ${policesEnRetard.length} point(s) mesuré(s) SANS que les polices soient prêtes : ` +
        `${policesEnRetard.join(', ')}.\n` +
        '  Les hauteurs de ces points sont celles de la police de repli, et le verdict ne vaut rien.'
      : ''),
)
