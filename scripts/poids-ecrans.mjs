#!/usr/bin/env node
/**
 * LE PLAFOND DE POIDS PAR ÉCRAN, ET LA FRAÎCHEUR DES CAPTURES.
 *
 * Deux refus, et le second est le vrai risque d'une refonte.
 *
 * 1. LE PLAFOND. Le marché visé est un réseau mobile lent sur appareil d'entrée
 *    de gamme. Une refonte qui coûte des octets est un défaut déguisé en
 *    amélioration, et elle ne se voit dans aucune capture. Le plafond est le
 *    poids MESURÉ au moment où il a été inscrit ; le dépasser arrête la porte.
 *
 * 2. LA CAPTURE PÉRIMÉE. C'est le mensonge naturel d'une refonte : on montre un
 *    « après » qui n'existe plus, parce que la capture date d'une exécution
 *    précédente. Ce script tire donc les captures DANS LA MÊME EXÉCUTION que la
 *    mesure, estampille chacune de l'identifiant de la course, et REFUSE si une
 *    capture manque ou n'a pas été réécrite maintenant. « Régénérée » et « déjà
 *    là » s'écrivent alors différemment.
 *
 *    Les captures d'une AUTRE course, elles, sont PURGÉES au démarrage plutôt
 *    que dénoncées : elles ne servaient à aucune comparaison, et comme
 *    l'estampille change à presque chaque modification de source, les dénoncer
 *    faisait rougir la porte sans le moindre défaut — ce qui n'apprend qu'à
 *    relancer. Voir le bloc de la purge pour ce que ce choix perd.
 *
 * 2 bis. CE QUE CHAQUE CHOSE COMPARE, ET CONTRE QUOI. C'est le nom de ce
 *    fichier depuis le lot qui l'a corrigé. Les captures ne se comparent qu'à
 *    ELLES-MÊMES, entre points de mesure de la même course. Les OCTETS se
 *    comparent à `plafonds-ecrans.json`, qui porte sa propre estampille de
 *    course — désormais NOMMÉE dans le rapport, car un écart d'octets dont la
 *    base est tue ne s'interprète pas : lu sans elle, le cumul de sept lots
 *    passe pour l'effet du lot en cours.
 *
 * CE QU'IL NE PROUVE PAS, ET IL FAUT LE DIRE : rien sur la HIÉRARCHIE. Aucune
 * garde ne peut établir qu'une mise en page se lit mieux. Ramenez un titre de
 * niveau 1 à la taille du corps et ce script restera vert — c'est mesuré, voir
 * le rapport du lot. Il garde le poids et la fraîcheur, rien d'autre, et le
 * dire est ce qui l'empêche de devenir une décoration.
 *
 * 3. LE CLIQUET. Un plafond qui s'inscrit sans résistance ne garde rien : un
 *    `--inscrire` distrait grave le poids gonflé du jour et rend la porte verte
 *    pour toujours. `--inscrire` ne fait donc DESCENDRE les plafonds, jamais
 *    monter. Faire monter un plafond exige un second geste, explicite et écrit :
 *    `--relever "motif"`. Le motif est GRAVÉ DANS LE FICHIER, à côté de la
 *    valeur et de l'ancienne valeur : il apparaît dans le diff, et un relecteur
 *    lit une phrase plutôt qu'un nombre qui a changé tout seul.
 *
 * 4. LE CONTENU DES CAPTURES. La fraîcheur ne dit rien de ce qu'il y a DEDANS :
 *    une capture noire, tronquée, ou tirée du même écran deux fois porte la
 *    bonne estampille et la bonne date. On vérifie donc le minimum falsifiable —
 *    les DIMENSIONS attendues, la NON-UNIFORMITÉ (une page qui n'a pas rendu est
 *    un aplat), et la DISTINCTION deux à deux (deux points de mesure qui rendent
 *    exactement la même image, c'est un écran qu'on n'a pas visité).
 *    Ce qu'on ne vérifie pas, et c'est nommé en dette : que l'image montre le
 *    BON écran. Cela demanderait une empreinte de référence par écran, donc un
 *    second cliquet à garder — le prix dépasse le défaut.
 *
 *   node scripts/poids-ecrans.mjs                     · mesure, capture, vérifie
 *   node scripts/poids-ecrans.mjs --inscrire          · descend les plafonds au réel
 *   node scripts/poids-ecrans.mjs --relever "motif"   · les fait monter, motif écrit
 *
 * PIÈGE TAILWIND v4 : ce fichier est balayé. Aucun nom d'utilitaire n'y est
 * écrit en entier — il n'en a aucun besoin, il ne lit que des octets.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { lirePNG } from './lire-png.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { argv, exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAFONDS = join(RACINE, 'scripts/plafonds-ecrans.json')
const CAPTURES = join(RACINE, 'captures')
const PORT = 4187
const BASE = `http://127.0.0.1:${PORT}`

/**
 * CE QUE LE FIL PORTE VRAIMENT — et pourquoi ce n'est pas ce qu'on comptait.
 *
 * ═══ LE DÉFAUT, ET IL EST NÉ D'UN CORRECTIF ═══
 *
 * Ce script compte les CORPS de réponse, c'est-à-dire des octets décompressés,
 * et les convertit en millisecondes à 400 kb/s. C'était exact tant que le
 * serveur n'avait aucune compression : les octets comptés étaient les octets
 * transmis. Depuis `a78b8f4`, `server/src/app.ts` porte `compression()`, et la
 * conversion s'est mise à décrire un monde disparu — elle SURESTIME désormais le
 * temps réel d'un facteur mesuré entre 3,0 et 5,4 selon la ressource.
 *
 * Un chiffre trois fois trop gros n'est pas prudent, il est faux, et il l'est
 * dans le sens le plus coûteux : il ferait refuser un lot qui ne coûte rien.
 *
 * ═══ CE QUE CE MODÈLE FAIT, ET CE QU'IL N'EST PAS ═══
 *
 * Il n'y a pas d'autre voie que le MODÈLE. Ces mesures passent par
 * `vite preview`, qui n'est pas le serveur de production : lui demander ce que
 * pèse une réponse compressée apprendrait ce que fait un outil de
 * développement. On reproduit donc les deux règles de `compression`, telles que
 * `server/src/app.ts` les emploie sans les configurer :
 *
 *   1. RIEN sous 1 024 octets. Comprimer plus petit coûte plus de temps
 *      processeur qu'il ne rend d'octets, et l'en-tête dépasse le gain.
 *   2. RIEN qui ne soit compressible — texte, JSON, JavaScript, CSS, SVG. Une
 *      image ou une police woff2 est déjà compressée ; la regzipper la ferait
 *      grossir, et `compression` ne l'essaie pas.
 *
 * LA SECONDE RÈGLE EST UNE APPROXIMATION ASSUMÉE. `compression` interroge le
 * module `compressible`, qui porte une table de types MIME ; on emploie ici une
 * expression régulière sur les familles que ce produit sert réellement. Un type
 * exotique servi un jour par ce serveur serait donc classé à côté — sans casser
 * le veto sur les requêtes, qui ne dépend pas de ceci, et sans toucher aux
 * octets bruts, qui restent le nombre GARDÉ. Seule la lecture en millisecondes
 * s'en trouverait décalée.
 *
 * ═══ LE TIERS N'EST PAS MODÉLISÉ, ET C'EST SANS CONSÉQUENCE ICI ═══
 *
 * Une réponse d'une autre origine — la police servie par Google — ne passe pas
 * par notre serveur : notre intergiciel n'a rien à y faire, et son vrai poids
 * sur le fil ne se lit pas depuis ici. On garde donc son corps tel quel. Ça ne
 * fausse aucun ARBITRAGE, parce que ce script ne rapporte que des ÉCARTS : une
 * ressource tierce constante d'un passage à l'autre s'annule des deux côtés de
 * la soustraction. Elle ne fausserait un écart que le jour où la fonderie
 * changerait de poids, et ce jour-là c'est l'adresse qui bougerait — ce que
 * `RESSOURCES_EXTERNES_PESEES`, dans `mesure-ui.mjs`, refuse déjà.
 *
 * ═══ LES OCTETS BRUTS RESTENT LE NOMBRE GARDÉ ═══
 *
 * Le plafond continue de porter sur `octets`, pas sur `octetsFil`. Deux
 * raisons. Le brut ne dépend d'aucun modèle, donc d'aucune hypothèse sur le
 * serveur : c'est la mesure la plus dure du fichier, et une garde de
 * non-régression a intérêt à s'appuyer sur elle. Et le taux de compression
 * varie avec le CONTENU — un lot qui n'ajouterait que du texte très répétitif
 * grossirait le paquet sans grossir le fil, et se cacherait derrière le modèle.
 * `octetsFil` est une LECTURE, `octets` est la garde.
 */
const SEUIL_DE_COMPRESSION = 1024
const TYPES_COMPRESSIBLES =
  /^(?:text\/|application\/(?:javascript|ecmascript|json|xml|manifest)|image\/svg\+xml)/

function octetsSurLeFil(url, corps, type) {
  if (!url.startsWith(BASE)) return corps.length
  if (corps.length < SEUIL_DE_COMPRESSION) return corps.length
  if (!TYPES_COMPRESSIBLES.test(type)) return corps.length
  return gzipSync(corps).length
}

/** Les écrans dont ce lot a touché la hiérarchie, et leurs deux largeurs. */
const ECRANS = ['/', '/demo', '/demo/paiements', '/demo/prise-en-main']
const LARGEURS = [360, 1280]

/**
 * LE PIÈGE DOCUMENTAIRE, ÉCRIT DANS LE FICHIER QU'IL CONCERNE.
 *
 * Il a déjà attrapé un lecteur, et il en attrapera d'autres : les chiffres de
 * ce fichier ne sont PAS ceux d'un premier chargement. La page est réutilisée
 * d'un écran au suivant dans la même exécution, donc le JS d'application n'est
 * téléchargé qu'une fois — il est compté sur `/`, et absent des trois autres.
 * D'où `/demo@360 : 198 072 o` ici contre 640 070 o au relevé de premier
 * chargement, pour le même écran et le même paquet. Les deux sont justes ;
 * ils ne mesurent pas la même chose.
 *
 * Ce texte vit DANS le JSON et non dans un rapport, et c'est délibéré : un
 * rapport ne se relit pas, un fichier qu'on ouvre pour changer un nombre, si.
 */
const LISEZ_MOI = [
  'Poids par écran mesuré sur une PAGE RÉUTILISÉE : le JS d’application est compté',
  'UNE SEULE FOIS, sur le premier écran visité (« / »). Ces octets ne sont donc pas',
  'comparables à un relevé de PREMIER CHARGEMENT — /demo vaut 198 072 o ici et',
  '640 070 o à froid, pour le même paquet. Ce fichier garde la NON-RÉGRESSION d’une',
  'exécution à l’autre, pas le coût réel d’une première visite.',
  'Les plafonds ne montent que par `--relever "motif"` ; le motif est gravé à côté.',
]

/**
 * L'identifiant de CETTE course. Il n'est pas dérivé du temps : `Date.now()`
 * rendrait deux courses successives indistinguables d'une capture recopiée à
 * la main. Il est dérivé du CONTENU du paquet construit — deux courses sur le
 * même paquet portent le même identifiant, et une capture faite sur un autre
 * paquet se dénonce d'elle-même.
 */
function identifiantDeCourse() {
  const actifs = readdirSync(join(RACINE, 'dist/assets')).sort().join('|')
  let h = 0
  for (const c of actifs) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h.toString(16).padStart(8, '0')
}

async function servir() {
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(BASE + '/')).ok) return fils
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error('poids-ecrans : le serveur de prévisualisation n’a pas répondu.')
}

const course = identifiantDeCourse()
/*
  L'INSTANT DE DÉPART, et il complète l'estampille au lieu de la remplacer.

  L'estampille dérive du CONTENU du paquet : elle attrape une capture faite sur
  un AUTRE paquet. Elle n'attrape pas une capture qu'on n'a pas régénérée sur le
  MÊME paquet — mesuré par mutation : en retirant l'appel à `screenshot`, la
  garde restait verte, parce que les fichiers de la course précédente portaient
  le même identifiant. Les deux questions sont distinctes :
    l'estampille demande « de quel paquet vient cette image ? » ;
    la date de modification demande « a-t-elle été écrite MAINTENANT ? ».
  Il faut les deux, et c'est la seconde qui manquait.
*/
const debutDeCourse = Date.now()
if (!existsSync(CAPTURES)) mkdirSync(CAPTURES, { recursive: true })

/*
  LA PURGE DES COURSES ÉTRANGÈRES, ET POURQUOI ELLE EST LÉGITIME.

  Ce script n'effaçait rien, `captures/` est ignoré par git, et l'estampille
  dérive du CONTENU du paquet : elle change donc à presque chaque modification
  de source. Les captures de la course précédente restaient sur le disque et
  faisaient rougir la course suivante — un rouge SANS DÉFAUT, qui n'apprend
  qu'une chose : relancer. Ce dépôt vient de consacrer trois lots à ce mécanisme
  du côté des tests intermittents ; c'était le même, du côté de l'outil.

  CE QUI L'AUTORISE : aucune comparaison de ce script ne lit une capture d'une
  AUTRE course. Le poids se compare à `plafonds-ecrans.json`, fichier versionné
  qui porte sa propre estampille. Les trois questions posées aux images —
  dimensions, non-uniformité, distinction deux à deux — se posent ENTRE les
  captures de cette course : la boucle parcourt `capturesFaites`, reconstruit à
  chaque exécution, et la table d'empreintes naît vide. Une capture étrangère
  n'était donc lue par rien ; elle ne servait qu'à faire rougir.

  AU DÉBUT, et non à la fin d'une course verte. Une course qui échoue laisserait
  sinon ses captures derrière elle, et la suivante rougirait sur la péremption au
  pire moment : celui où l'on débogue déjà autre chose. Purger ici rend
  l'invariant vrai en permanence — après une course verte comme après une rouge.

  CE QUE LE CHOIX PERD, et il faut le dire : les captures de la course
  précédente disparaissent AVANT que les nouvelles ne soient écrites. Une course
  interrompue en vol laisse donc un jeu partiel et plus rien d'hier à regarder.
  C'est un usage manuel — ouvrir l'image de la veille — qui n'a jamais été
  outillé ni gardé par quoi que ce soit, et non une mesure qu'on perdrait.
*/
const purgees = readdirSync(CAPTURES).filter(
  (f) => f.endsWith('.png') && !f.includes(`.${course}.`),
)
for (const f of purgees) unlinkSync(join(CAPTURES, f))
const serveur = await servir()
const mesures = {}
const capturesFaites = []

try {
  const navigateur = await chromium.launch()
  for (const largeur of LARGEURS) {
    const contexte = await navigateur.newContext({
      viewport: { width: largeur, height: 900 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    const page = await contexte.newPage()
    for (const adresse of ECRANS) {
      const actifs = []
      page.removeAllListeners('response')
      page.on('response', async (r) => {
        try {
          const corps = await r.body()
          actifs.push({
            octets: corps.length,
            fil: octetsSurLeFil(r.url(), corps, r.headers()['content-type'] ?? ''),
          })
        } catch {
          /* corps indisponible : redirection, ou réponse déjà consommée */
        }
      })
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      await page.waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(400)

      const cle = `${adresse}@${largeur}`
      mesures[cle] = {
        octets: actifs.reduce((s, a) => s + a.octets, 0),
        octetsFil: actifs.reduce((s, a) => s + a.fil, 0),
        requetes: actifs.length,
      }

      const nom = `${adresse.replace(/\//g, '_') || '_racine'}@${largeur}.${course}.png`
      await page.screenshot({ path: join(CAPTURES, nom), fullPage: false })
      capturesFaites.push({ nom, largeur, adresse })
    }
    await contexte.close()
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

/*
  LE CLIQUET.

  Le défaut que ce bloc corrige est celui dénoncé au lot 4, et il était ici :
  `--inscrire` écrasait le fichier avec la mesure du jour, quelle qu'elle fût.
  Un `--inscrire` distrait après une régression gravait la régression comme
  norme, et la garde redevenait verte pour toujours — verte sur un produit
  alourdi, ce qui est pire que pas de garde, parce qu'on lui fait confiance.

  Le cliquet a une seule dent : les plafonds DESCENDENT tout seuls, ils ne
  MONTENT que sur un second geste. `--relever "motif"` écrit le motif, la
  valeur d'avant et l'identifiant de course DANS le fichier, à côté de la
  valeur relevée. Le relèvement n'est donc plus un nombre qui change dans un
  diff : c'est une phrase que quelqu'un a dû taper et qu'un relecteur lit.
*/
const iInscrire = argv.indexOf('--inscrire')
const iRelever = argv.indexOf('--relever')
if (iInscrire >= 0 || iRelever >= 0) {
  const motif = iRelever >= 0 ? (argv[iRelever + 1] ?? '').trim() : ''
  if (iRelever >= 0 && (!motif || motif.startsWith('--'))) {
    console.error(
      '\n✗ poids-ecrans : `--relever` exige un motif écrit.\n\n' +
        '  ▸ node scripts/poids-ecrans.mjs --relever "ce que le poids achète"\n' +
        "    Le motif est gravé dans le fichier : c'est lui, et non le nombre, que lit un relecteur.\n",
    )
    exit(1)
  }

  const ancien = existsSync(PLAFONDS) ? JSON.parse(readFileSync(PLAFONDS, 'utf8')).mesures ?? {} : {}
  const hausses = []
  const sortie = {}
  for (const [cle, v] of Object.entries(mesures)) {
    const p = ancien[cle]
    const monte = p && (v.octets > p.octets || v.requetes > p.requetes)
    if (monte) hausses.push({ cle, de: p, a: v })
    if (monte && !motif) {
      /* Refusé : on garde l'ancien plafond, on ne grave pas la hausse. */
      sortie[cle] = p
      continue
    }
    sortie[cle] = monte
      ? { ...v, releve: { de: p.octets, requetesDe: p.requetes, motif, course } }
      : {
          octets: v.octets,
          octetsFil: v.octetsFil,
          requetes: v.requetes,
          /*
            LE MOTIF GRAVÉ SURVIT À UNE RÉINSCRIPTION QUI NE MONTE PAS.

            DÉFAUT PAYÉ EN LE FAISANT, dans ce lot même : `--inscrire` a effacé
            d'un coup les huit motifs du lot précédent. La branche qui ne monte
            pas reconstruisait l'entrée à partir des seules mesures, et le
            `releve` — la phrase que quelqu'un a dû taper, et que le cliquet
            existe pour conserver — disparaissait sans un mot.

            C'est la mémoire du cliquet, pas une décoration : un plafond relevé
            dont on a perdu la raison redevient un nombre, exactement ce que le
            motif précédent nommait comme le pire état. On le REPORTE donc, sans
            le récrire — il documente la hausse qui a eu lieu, et cette hausse
            reste vraie même quand un passage ultérieur ne bouge pas.
          */
          ...(p?.releve ? { releve: p.releve } : {}),
        }
  }

  if (hausses.length > 0 && !motif) {
    console.error(
      `\n✗ poids-ecrans : ${hausses.length} plafond(s) MONTERAIENT, et \`--inscrire\` ne fait que descendre.\n`,
    )
    for (const h of hausses) {
      console.error(
        `  ▸ ${h.cle} : ${h.de.octets} → ${h.a.octets} o (+${h.a.octets - h.de.octets}), ` +
          `${h.de.requetes} → ${h.a.requetes} requêtes`,
      )
    }
    console.error(
      '\n  Rien n\'a été écrit. Si ce poids est le prix de quelque chose, dites-le :\n' +
        '    node scripts/poids-ecrans.mjs --relever "ce que le poids achète"\n' +
        '  Le motif entre dans le fichier, donc dans le diff, donc sous les yeux du relecteur.\n',
    )
    exit(1)
  }

  const baisses = Object.entries(mesures).filter(
    ([c, v]) => ancien[c] && v.octets < ancien[c].octets,
  )
  writeFileSync(PLAFONDS, JSON.stringify({ _lisezMoi: LISEZ_MOI, course, mesures: sortie }, null, 1))
  console.log(
    `✓ plafonds inscrits pour ${Object.keys(sortie).length} points (course ${course}) : ` +
      `${baisses.length} en baisse, ${hausses.length} relevé(s)${motif ? ` — « ${motif} »` : ''}.`,
  )
  exit(0)
}

const plaintes = []
/* Ce qui se DIT sans arrêter la porte : le poids, converti en temps de
   chargement. Séparé des plaintes exprès — les deux ne se lisent pas pareil. */
const rapports = []
/** L'estampille de course du fichier de plafonds : la BASE des écarts d'octets. */
let baseDuPoids = null
/** Combien d'images ont été RELUES — déclaré ici pour que le rapport final le dise. */
let imagesInspectees = 0

/* ─── 1. Le plafond de poids ─────────────────────────────────────────────── */
if (!existsSync(PLAFONDS)) {
  plaintes.push(
    'aucun fichier de plafonds. Inscrivez-les une fois par `node scripts/poids-ecrans.mjs --inscrire`,\n' +
      "   puis relisez le diff : un plafond qu'on inscrit sans le regarder ne garde rien.",
  )
} else {
  const { mesures: plafond, course: courseDuPlafond } = JSON.parse(readFileSync(PLAFONDS, 'utf8'))
  /*
    LA BASE DE COMPARAISON SE NOMME, et c'est ce qui manquait.

    Un écart d'octets sans base nommée ne vaut rien : le lecteur voyait
    « +4 138 o » sans pouvoir savoir contre QUOI. Le fichier de plafonds porte
    pourtant son estampille de course depuis toujours — elle n'était simplement
    jamais dite. Un lot précédent a buté exactement là-dessus : il a relevé
    « +4 225 octets que personne n'a su expliquer » alors que ses propres
    touches allégeaient le texte, et la réponse tenait dans une ligne absente —
    le plafond datait de sept lots plus tôt, et l'écart était la SOMME de tout
    ce qui avait atterri depuis, pas l'effet du lot en cours.

    On dit donc toujours la base ; et quand elle vient d'un autre paquet, on dit
    que l'écart est CUMULÉ. Le nombre ne change pas ; ce qu'on peut en conclure,
    si.
  */
  baseDuPoids = courseDuPlafond ?? null
  /* Un plafond relevé porte son motif : on le REDIT à chaque passage vert.
     Un relèvement qu'on oublie est un relèvement qui devient la norme. */
  for (const [cle, p] of Object.entries(plafond)) {
    if (p.releve) {
      console.log(
        `  · ${cle} : plafond relevé de ${p.releve.de} à ${p.octets} o — « ${p.releve.motif} » ` +
          `(course ${p.releve.course}).`,
      )
    }
  }
  for (const [cle, v] of Object.entries(mesures)) {
    const p = plafond[cle]
    if (!p) {
      plaintes.push(`l'écran ${cle} n'a pas de plafond inscrit — il est mesuré et non gardé.`)
      continue
    }
    /*
      LE POIDS EST UN CHIFFRE RAPPORTÉ, PLUS UN VETO — et c'est une décision,
      pas un relâchement.

      Un veto sur les octets confond deux choses : un paquet qui grossit sans
      rien apporter, et un paquet qui grossit en achetant quelque chose. Il
      arrêtait la porte dans les deux cas, donc il ne disait rien du second — et
      c'est le second qui demande un arbitrage. Le nombre est donc converti en
      MILLISECONDES à 400 kb/s, le profil du marché visé : c'est l'unité dans
      laquelle un lecteur peut trancher « ça vaut le coup » ou « non ».

      LES REQUÊTES, ELLES, RESTENT UN VETO. Une requête de plus n'est pas un
      surcoût continu comme des octets : c'est un aller-retour, donc une latence
      entière — 300 à 800 ms sur un réseau mobile lent, quel que soit ce qu'elle
      transporte. Rien de ce qu'une refonte visuelle apporte ne paie cela, et il
      n'existe aucun cas où l'on veuille en ajouter une sans le décider
      explicitement.
    */
    /*
      LES MILLISECONDES SE CALCULENT SUR LE FIL, LES PLAFONDS SUR LE BRUT.

      Voir `octetsSurLeFil`, en tête de fichier, pour ce que « fil » modélise et
      ce qu'il n'est pas. L'écart des deux nombres est imprimé côte à côte plutôt
      que réduit à un seul : le brut dit ce que le paquet a pris, le fil dit ce
      que l'utilisateur attend, et confondre les deux est exactement la panne que
      ce lot répare.

      UNE BASE SANS `octetsFil` NE SE DEVINE PAS. Un plafond inscrit avant ce lot
      ne porte que des octets bruts ; en tirer des millisecondes demanderait
      d'appliquer le taux de compression D'AUJOURD'HUI à un paquet d'HIER, donc
      d'inventer. On le dit, et l'on s'arrête là — une réinscription rend le
      nombre au passage suivant.
    */
    const MS_PAR_OCTET = 8 / 400000 // 400 kb/s, le profil du marché visé
    const ms = (o) => Math.round(o * MS_PAR_OCTET * 1000)
    if (v.octets !== p.octets) {
      const monte = v.octets > p.octets
      const signe = monte ? '+' : '−'
      const dOctets = Math.abs(v.octets - p.octets)
      const surLeFil =
        typeof p.octetsFil === 'number'
          ? `soit ${signe}${Math.abs(v.octetsFil - p.octetsFil)} o sur le fil, ` +
            `${signe}${ms(Math.abs(v.octetsFil - p.octetsFil))} ms à 400 kb/s.`
          : 'temps non calculé : le plafond date d’avant la mesure du fil, et appliquer le ' +
            'taux du jour à un paquet d’hier serait une invention. Réinscrivez pour l’obtenir.'
      rapports.push(`${cle} : ${signe}${dOctets} o bruts (${p.octets} → ${v.octets}), ${surLeFil}`)
    }
    if (v.requetes > p.requetes) {
      plaintes.push(
        `${cle} : ${p.requetes} → ${v.requetes} REQUÊTES.\n` +
          "   Une requête de plus est un aller-retour de plus — 300 à 800 ms sur le réseau\n" +
          '   visé, quel que soit ce qu’elle transporte. Les octets se rapportent ; les\n' +
          '   requêtes se refusent.',
      )
    }
  }
  /* Garde du garde : un plafond qui ne couvre plus d'écran est un plafond mort. */
  for (const cle of Object.keys(plafond)) {
    if (!(cle in mesures)) plaintes.push(`le plafond de ${cle} ne couvre plus aucun écran mesuré.`)
  }
}

/* ─── 2. La capture périmée ──────────────────────────────────────────────── */
{
  const attendues = ECRANS.length * LARGEURS.length
  if (capturesFaites.length !== attendues) {
    plaintes.push(
      `${capturesFaites.length} capture(s) tirée(s) pour ${attendues} attendues.\n` +
        "   Une capture manquante est un « après » qu'on ne peut pas montrer.",
    )
  }
  const surDisque = readdirSync(CAPTURES).filter((f) => f.endsWith('.png'))
  const nomsFaits = capturesFaites.map((c) => c.nom)
  const decette = surDisque.filter((f) => f.includes(`.${course}.`))
  if (decette.length !== capturesFaites.length) {
    plaintes.push(
      `${decette.length} capture(s) portent l'estampille de cette course (${course}) ` +
        `pour ${capturesFaites.length} tirée(s).\n` +
        "   Une capture qui ne s'est pas régénérée dans CETTE exécution montre un état qui n'existe plus.",
    )
  }
  /* Écrite MAINTENANT, et pas seulement nommée comme si. */
  const rassies = nomsFaits.filter((nom) => {
    const chemin = join(CAPTURES, nom)
    if (!existsSync(chemin)) return true
    return statSync(chemin).mtimeMs < debutDeCourse
  })
  if (rassies.length > 0) {
    plaintes.push(
      `${rassies.length} capture(s) n'ont pas été RÉÉCRITES pendant cette exécution : ` +
        `${rassies.slice(0, 4).join(', ')}${rassies.length > 4 ? '…' : ''}\n` +
        "   Elles existent, elles portent la bonne estampille, et elles datent d'avant. C'est\n" +
        "   exactement la capture périmée qu'une refonte montre par erreur.",
    )
  }
  /*
    LE CONTENU, et non plus seulement la date.

    Les deux refus précédents demandent « d'où vient cette image ? » et « a-t-elle
    été écrite maintenant ? ». Aucun ne demande CE QU'IL Y A DEDANS. Une capture
    noire, tronquée à un bandeau, ou tirée deux fois du même écran passe les deux.
    Trois questions falsifiables, et le minimum qu'on puisse poser :
      — les DIMENSIONS sont-elles celles du point de mesure ?
      — l'image porte-t-elle plus d'un aplat ? (une page qui n'a pas rendu est unie)
      — deux points de mesure rendent-ils deux images différentes ?
    Ce qu'on NE vérifie PAS : que l'image montre le bon écran. Nommé en dette dans
    l'en-tête — il faudrait une empreinte de référence par écran, donc un second
    cliquet, pour un défaut que les trois questions ci-dessus rendent déjà étroit.
  */
  const empreintes = new Map()
  /*
    ON COMPTE LES IMAGES RÉELLEMENT OUVERTES, et pas seulement les fautes.

    « Zéro image fautive » et « zéro image ouverte » s'écrivent pareil dans un
    journal. Les deux `continue` ci-dessous — fichier absent, PNG illisible —
    sautent une image en silence : si TOUTES sautaient, les trois questions
    posées au contenu ne seraient posées à personne, et ce bloc rendrait un
    silence que le lecteur lirait comme un acquittement. C'est la panne exacte
    que `contrast-audit.js` s'est déjà vu reprocher, et que `mesure-ui.mjs`
    referme avec son plancher de textes audités. Ici comme là, le compte est la
    seule chose qui distingue « rien à redire » de « rien regardé ».
  */
  for (const { nom, largeur } of capturesFaites) {
    const chemin = join(CAPTURES, nom)
    if (!existsSync(chemin)) continue
    let png
    try {
      png = lirePNG(readFileSync(chemin))
    } catch (e) {
      plaintes.push(`${nom} : illisible comme PNG — ${e.message}`)
      continue
    }
    imagesInspectees++
    if (png.largeur !== largeur || png.hauteur !== 900) {
      plaintes.push(
        `${nom} : ${png.largeur}×${png.hauteur} px pour ${largeur}×900 attendus.\n` +
          "   Une capture tronquée montre un écran qu'on n'a pas mesuré.",
      )
    }
    /* Non-uniformité : la part du niveau de gris le plus fréquent. Un aplat —
       page blanche, page noire, écran de chargement — la pousse vers 1. Le seuil
       est LARGE (0,97) : une page légitime est très majoritairement du fond, et
       une garde qui refuserait une page aérée serait une garde qu'on désactive. */
    const seaux = new Uint32Array(32)
    let n = 0
    for (let y = 0; y < png.hauteur; y += 3) {
      for (let x = 0; x < png.largeur; x += 3) {
        const i = (y * png.largeur + x) * png.canaux
        const l = (0.2126 * png.px[i] + 0.7152 * png.px[i + 1] + 0.0722 * png.px[i + 2]) / 255
        seaux[Math.min(31, (l * 32) | 0)]++
        n++
      }
    }
    const part = Math.max(...seaux) / n
    if (part > 0.97) {
      plaintes.push(
        `${nom} : ${(part * 100).toFixed(1)} % de l'image tient dans un seul niveau de gris.\n` +
          "   C'est un aplat, pas un écran : la page n'a pas rendu, ou la capture est vide.",
      )
    }
    const empreinte = createHash('sha256').update(png.px).digest('hex').slice(0, 16)
    if (empreintes.has(empreinte)) {
      plaintes.push(
        `${nom} et ${empreintes.get(empreinte)} sont PIXEL POUR PIXEL la même image.\n` +
          "   Deux points de mesure qui rendent la même chose, c'est un écran qu'on n'a pas visité.",
      )
    }
    empreintes.set(empreinte, nom)
  }

  if (imagesInspectees !== capturesFaites.length) {
    plaintes.push(
      `${imagesInspectees} image(s) ouverte(s) pour ${capturesFaites.length} capture(s) tirée(s).\n` +
        "   Les questions posées au CONTENU — dimensions, aplat, distinction — n'ont donc pas été\n" +
        '   posées à toutes. Un bloc qui ne regarde rien rend le même silence qu’un bloc satisfait.',
    )
  }

  /*
    LA PÉREMPTION RESTE GARDÉE, bien que la purge du haut la rende improbable.

    Elle n'est plus le rouge quotidien qu'elle était — les captures étrangères
    sont retirées avant que le navigateur ne démarre — mais la garde demeure,
    car elle répond maintenant à une autre question : la purge a-t-elle bien eu
    lieu ? Un droit d'écriture refusé, un fichier réapparu pendant la course,
    et l'invariant tombe sans que rien ne le dise. Une garde qu'on croit
    inatteignable est précisément celle qu'il faut garder.
  */
  const perimees = readdirSync(CAPTURES)
    .filter((f) => f.endsWith('.png'))
    .filter((f) => !f.includes(`.${course}.`))
  if (perimees.length > 0) {
    plaintes.push(
      `${perimees.length} capture(s) PÉRIMÉE(S) ont SURVÉCU à la purge : ${perimees.slice(0, 6).join(', ')}` +
        `${perimees.length > 6 ? '…' : ''}\n` +
        '   Elles datent d’un autre paquet et auraient dû être retirées au démarrage.\n' +
        '   Ce n’est plus un ménage à faire, c’est la purge elle-même qui a échoué.',
    )
  }
}

/* LE RAPPORT SORT MÊME QUAND LA PORTE EST VERTE, et surtout alors : c'est là
   qu'un alourdissement passerait inaperçu. Il est écrit AVANT les plaintes pour
   qu'un lecteur pressé le voie même quand quelque chose d'autre a échoué. */
if (rapports.length > 0) {
  const memePaquet = baseDuPoids === course
  console.log(
    `\n  POIDS — ${rapports.length} écran(s) ont changé de taille, ` +
      `mesurés contre les plafonds de la course ${baseDuPoids ?? '(inconnue)'} :`,
  )
  for (const r of rapports) console.log('    · ' + r)
  if (!memePaquet) {
    console.log(
      "    Cette base vient d'un AUTRE paquet que celui qu'on vient de mesurer : chaque écart\n" +
        '    ci-dessus est donc CUMULÉ depuis son inscription, et non l’effet du seul lot en cours.',
    )
  }
  console.log('    Ces lignes ne ferment pas la porte. Elles sont là pour être arbitrées.')
}

if (plaintes.length > 0) {
  console.error(`\n✗ poids-ecrans : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ poids-ecrans : ${Object.keys(mesures).length} points mesurés, ` +
    `${capturesFaites.length} captures régénérées et ${imagesInspectees} relues (course ${course}),\n` +
    `  ${purgees.length} capture(s) d'une autre course purgée(s) au démarrage.\n` +
    `  Les octets sont comparés aux plafonds de la course ${baseDuPoids ?? '(inconnue)'} —\n` +
    /*
      LA PHRASE SUIT L'ÉTAT, elle ne l'affirme plus.

      Elle disait « une base d'un autre paquet rend les écarts CUMULÉS » À CHAQUE
      PASSAGE, y compris quand la base VENAIT d'être réinscrite sur le paquet
      qu'on mesure. Elle était donc fausse exactement au moment où elle cessait
      d'être nécessaire — et le lecteur qui vient de réinscrire lit qu'il ne peut
      pas se fier à ce qu'il vient de faire.

      Ce fichier a pour titre « ce que chaque chose compare, et contre quoi ». La
      moindre des choses est qu'il dise juste laquelle des deux situations il est
      dans.
    */
    (baseDuPoids === course
      ? '  la base est celle de CE paquet : les écarts ci-dessus sont imputables au lot en cours.\n'
      : '  une base d’un autre paquet rend les écarts CUMULÉS, ce que le rapport ci-dessus dit.\n') +
    '  Les OCTETS se rapportent, les REQUÊTES se refusent — voir le commentaire de la\n' +
    '  comparaison. Ce script ne dit RIEN de la hiérarchie de lecture.',
)
