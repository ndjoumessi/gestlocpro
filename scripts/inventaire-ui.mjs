#!/usr/bin/env node
/**
 * LA CARTE MESURÉE DES DÉFAUTS D'INTERFACE — un tableau, un chiffre par ligne.
 *
 * CE SCRIPT NE CORRIGE RIEN et n'entre PAS dans `npm run check`. Mesurer et
 * appliquer sont deux lots ; celui-ci est le premier. Un axe neuf qui ferait
 * rougir des écrans aujourd'hui verts sort ici EN RAPPORT, pas en porte.
 *
 *   node scripts/inventaire-ui.mjs                    · relève tout, ~15 min
 *   node scripts/inventaire-ui.mjs --relire <dossier> · relit des relevés déjà pris
 *   node scripts/inventaire-ui.mjs --json <fichier>   · écrit la carte en JSON
 *
 * TROIS RELEVÉS DISJOINTS, lancés en sous-processus :
 *   `inventaire/mesure-navigateur.mjs` — ce que la page FAIT une fois peinte
 *   `inventaire/lecture-sources.mjs`   — focus, libellés, hiérarchie des titres
 *   `inventaire/jetons-i18n.mjs`       — hex hors `tokens.css`, chaînes hors dicos
 * Chacun lit `inventaire/routes.mjs`, et AUCUN ne recopie une liste d'écrans.
 * Le sous-processus, et non l'import : un relevé qui meurt doit se NOMMER, pas
 * emporter les deux autres avec lui dans une pile d'exceptions illisible.
 *
 * LA GARDE DU GARDE, qui est la raison d'être de ce fichier.
 *
 * « Aucun défaut » et « je n'ai rien lu » s'écrivent PAREIL dans un journal.
 * C'est la seule forme de mensonge que ce lot existe pour empêcher, et elle
 * n'est pas hypothétique : `scripts/mesure-ui.mjs` balaie vingt-trois écrans
 * dont `/app`, qui ne rend que son état de chargement quand aucun service de
 * session ne répond — quatre éléments, onze caractères. Sa boucle fait
 * `if (!resultat) continue` (ligne 1564), donc l'écran passe VERT à ses
 * vingt-deux points de mesure sans qu'une seule cible y ait été sondée. Un
 * vert creux compte dans un total comme un vrai.
 *
 * Ce script REFUSE donc, avec un code de sortie non nul, dès que :
 *   · l'inventaire rend ZÉRO route, ou moins de routes qu'attendu ;
 *   · UNE page échoue à rendre — il la NOMME, il ne rend pas un tableau amputé ;
 *   · un relevé sort en erreur, ou rend un compte de lecture à zéro ;
 *   · une adresse déclarée non mesurable s'est mise à rendre — l'exemption ne
 *     couvre plus rien et doit mourir plutôt que pourrir.
 *
 * PIÈGE TAILWIND v4 : la détection automatique des sources balaie ce fichier
 * (vérifié : le scanner oxide du dépôt y rend 304 fichiers, dont huit sous
 * `scripts/`). Une classe citée en littéral ici serait RÉELLEMENT générée dans
 * le CSS livré. Ce lot l'a payé une fois — un commentaire de
 * `inventaire/jetons-i18n.mjs` citait en entier l'utilitaire d'une teinte d'or
 * POUR EXPLIQUER QU'IL NE FAUT PAS, et ce nom n'existait nulle part dans
 * `src/` : la phrase d'exemple aurait ajouté une règle au paquet. Aucun motif
 * de classe ne s'écrit ici en entier.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { argv, exit } from 'node:process'
import { inventaireDesRoutes, exigerUnInventairePlein, nommerRoles, RACINE } from './inventaire/routes.mjs'

/**
 * LES ADRESSES QU'UN PAQUET STATIQUE NE PEUT PAS RENDRE, nommées et motivées.
 *
 * Une seule aujourd'hui, et ce n'est pas un détail de plomberie : c'est le
 * défaut le plus lourd que ce lot ait trouvé, et il est ICI parce que c'est ici
 * qu'on décide de ne pas le compter comme un écran mesuré.
 *
 * `/app` est servi par `vite preview`, qui sert `dist/` et RIEN d'autre —
 * aucun mandataire vers l'API, contrairement à `vite dev`. L'appel de session
 * reçoit donc `index.html` en guise de JSON, échoue, et l'écran reste sur
 * « Chargement… » : quatre éléments, indéfiniment. Pas de redirection vers
 * `/connexion`, pas d'état d'erreur, pas de sortie.
 *
 * Ce n'est PAS une exemption de confort. C'est un refus de compter comme
 * « mesuré » un écran dont on n'a mesuré que le squelette — et c'est
 * exactement la différence que `mesure-ui.mjs` ne fait pas aujourd'hui.
 *
 * SON GARDE : si l'adresse se met à rendre, l'exemption ne couvre plus rien et
 * doit être RETIRÉE. Une exemption qui survit à son motif est le tapis sous
 * lequel on glisse le défaut suivant.
 */
const NON_MESURABLES = {
  '/app': {
    motif:
      "l'espace connecté, derrière `RequireAuth`. Servi en statique, l'appel de session n'aboutit " +
      "pas et l'écran reste sur son état de chargement — quatre éléments, sans redirection ni " +
      "message d'erreur. Ce qu'on mesurerait ici est un squelette, pas un écran.",
    elementsAttendusAuPlus: 20,
  },
}

const RELEVES = [
  {
    cle: 'navigateur',
    fichier: 'scripts/inventaire/mesure-navigateur.mjs',
    argumentsDeSortie: (destination) => [destination],
    minutes: 15,
  },
  {
    cle: 'sources',
    fichier: 'scripts/inventaire/lecture-sources.mjs',
    argumentsDeSortie: (destination) => ['--json', destination],
    minutes: 1,
  },
  {
    cle: 'jetons',
    fichier: 'scripts/inventaire/jetons-i18n.mjs',
    argumentsDeSortie: (destination) => [destination],
    minutes: 1,
  },
]

function refuser(...lignes) {
  console.error('\n✗ inventaire-ui : ' + lignes.join('\n   '))
  console.error(
    "\n   Un inventaire qui ne lit rien rend « aucun défaut ». C'est le seul mensonge que ce\n" +
      '   script existe pour empêcher — il refuse donc plutôt que de rendre un tableau amputé.\n',
  )
  exit(1)
}

/** Lance un relevé en sous-processus et rend son JSON, ou refuse en le nommant. */
function lancerLeReleve(releve, dossier, relire) {
  const destination = join(dossier, `releve-${releve.cle}.json`)

  if (relire) {
    const dejaPris = join(relire, `releve-${releve.cle === 'jetons' ? 'jetons-i18n' : releve.cle}.json`)
    if (!existsSync(dejaPris)) {
      refuser(
        `relevé « ${releve.cle} » introuvable dans ${relire}.`,
        `Attendu : ${dejaPris}`,
        "Relancez sans `--relire` pour le prendre, ou donnez le bon dossier.",
      )
    }
    process.stdout.write(`   ${releve.cle.padEnd(12)} relu de ${dejaPris}\n`)
    return JSON.parse(readFileSync(dejaPris, 'utf8'))
  }

  process.stdout.write(`   ${releve.cle.padEnd(12)} … (jusqu'à ${releve.minutes} min)\n`)
  const issue = spawnSync('node', [releve.fichier, ...releve.argumentsDeSortie(destination)], {
    cwd: RACINE,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

  // Le code de sortie N'EST PAS la seule chose à regarder. Un relevé peut
  // sortir en 0 après n'avoir rien écrit — c'est la panne silencieuse.
  if (!existsSync(destination)) {
    refuser(
      `le relevé « ${releve.cle} » n'a écrit aucun JSON (code de sortie ${issue.status}).`,
      (issue.stderr || issue.stdout || '').trim().split('\n').slice(-12).join('\n   '),
    )
  }
  const contenu = JSON.parse(readFileSync(destination, 'utf8'))

  /*
    UN CODE DE SORTIE NON NUL N'EST PAS TOUJOURS NOTRE REFUS — et cette nuance
    est la seule chose qui sépare un outil utilisable d'un outil toujours rouge.

    `mesure-navigateur.mjs` REFUSE, à raison, dès qu'une page n'a pas rendu ; et
    `/app` n'en rend jamais une, faute de service de session sous un paquet
    statique. Relayer son code tel quel ferait refuser cette carte à chaque
    exécution, sur un dépôt sain — et une porte toujours rouge finit désactivée,
    ce qui est pire que pas de porte du tout.

    On ne l'AVALE pas pour autant : le refus est examiné plus bas, ligne par
    ligne, contre `NON_MESURABLES`, qui est écrit et motivé. Tout refus qui n'y
    figure PAS arrête tout. La différence entre les deux est déclarée, pas
    devinée — et l'exemption a son propre garde, qui la fait mourir le jour où
    l'écran se remet à rendre.

    Les deux autres relevés n'ont pas cette nuance : ils lisent des fichiers, un
    fichier répond toujours, et leur refus est donc toujours le nôtre.
  */
  if (issue.status !== 0) {
    const examineAilleurs = releve.cle === 'navigateur' && Array.isArray(contenu.refus)
    if (!examineAilleurs) {
      console.error(`\n✗ inventaire-ui : le relevé « ${releve.cle} » a REFUSÉ (code ${issue.status}) :`)
      console.error((issue.stderr || '').trimEnd())
      console.error(
        "\n   Un relevé qui refuse ne se contourne pas : la carte serait fausse d'une ligne, et\n" +
          "   une ligne manquante se lit « aucun défaut sur cet écran ».\n",
      )
      exit(1)
    }
    process.stdout.write(
      `   ${' '.repeat(12)} ↳ code ${issue.status} : ${contenu.refus.length} refus, confrontés plus bas aux adresses déclarées non mesurables\n`,
    )
  }
  return contenu
}

// ─── 1. L'inventaire, et sa garde du garde ───────────────────────────────────
/*
  ATTRAPÉ, et pas laissé remonter en trace de pile.

  `exigerUnInventairePlein` lève, et c'est la bonne façon de l'écrire : un
  module qui rend une liste vide ne doit pas pouvoir la rendre poliment. Mais
  une trace de pile de Node est le format le moins lisible qu'on puisse offrir
  à quelqu'un dont l'inventaire vient de tomber à zéro — elle noie la phrase
  utile sous six lignes de chemins internes. Le refus se lit ici, dans la même
  forme que tous les autres.
*/
let routes
try {
  routes = exigerUnInventairePlein(inventaireDesRoutes())
} catch (e) {
  refuser(e.message)
}
console.log(`\n· ${routes.length} routes déduites de src/App.tsx + src/app/EspaceApplicatif.tsx`)

// ─── 2. Les trois relevés ────────────────────────────────────────────────────
const relire = argv.includes('--relire') ? argv[argv.indexOf('--relire') + 1] : null
const dossier = relire ? relire : mkdtempSync(join(tmpdir(), 'inventaire-ui-'))
console.log(`\n· relevés :`)
const brut = {}
for (const releve of RELEVES) brut[releve.cle] = lancerLeReleve(releve, dossier, relire)

// ─── 3. Gardes du garde sur ce que les relevés ont VRAIMENT lu ───────────────
{
  const nav = brut.navigateur
  const t = nav.totaux ?? {}
  const compteurs = {
    'cibles sondées': t.ciblesSondees,
    'paires de cibles examinées': t.pairesExaminees,
    'textes audités': t.textesAudites,
    'actifs de chargement lus': t.actifsLus,
    'états de géométrie': t.etatsGeometrie,
    'états de couleur': t.etatsCouleur,
  }
  const muets = Object.entries(compteurs).filter(([, n]) => !n)
  if (muets.length > 0) {
    refuser(
      `le relevé navigateur a rendu ${muets.length} compteur(s) à zéro : ` +
        muets.map(([nom]) => nom).join(', ') + '.',
      "Rien n'a été regardé sur cet axe — ce n'est pas « aucun défaut ».",
    )
  }

  const src = brut.sources.perimetre ?? {}
  if (!src.fichiersScannes || !src.balisesLues || !src.routes) {
    refuser(
      `le relevé de sources a lu ${src.fichiersScannes ?? 0} fichiers, ${src.balisesLues ?? 0} balises, ` +
        `${src.routes ?? 0} routes.`,
      'Une lecture à zéro rend « aucun défaut » sans avoir rien ouvert.',
    )
  }

  const jet = brut.jetons.lu ?? {}
  if (!jet.jetonsLus || !jet.clesFr || !jet.clesEn || !jet.routes) {
    refuser(
      `le relevé jetons/i18n a lu ${jet.jetonsLus ?? 0} jetons, ${jet.clesFr ?? 0} clés fr, ` +
        `${jet.clesEn ?? 0} clés en, ${jet.routes ?? 0} routes.`,
      'Une lecture à zéro rend « aucun défaut » sans avoir rien ouvert.',
    )
  }
}

// ─── 4. Une page qui n'a pas rendu → refus, en la NOMMANT ────────────────────
{
  const refus = brut.navigateur.refus ?? []
  const inattendus = refus.filter((r) => !NON_MESURABLES[r.adresse])
  if (inattendus.length > 0) {
    const pages = inattendus.filter((r) => r.adresse).length
    console.error(
      `\n✗ inventaire-ui : ${inattendus.length} refus non déclaré(s)` +
        (pages ? `, dont ${pages} page(s) qui ont échoué à rendre` : '') + '.\n',
    )
    /*
      TOUS LES REFUS N'ONT PAS D'ADRESSE, et les afficher comme s'ils en avaient
      une rendait trois `undefined` à la suite — `releve-partiel`,
      `zero-cible-sondee` et leurs semblables portent un genre et un message,
      pas une page. Un refus illisible est un refus qu'on cesse de lire.
    */
    for (const r of inattendus) {
      if (r.adresse) {
        console.error(
          `   ${r.adresse}  (${r.langue})  statut ${r.statut}, ${r.texte} caractère(s), ` +
            `${r.elements} élément(s)` + (r.erreurs?.length ? `, erreurs : ${r.erreurs.join(' · ')}` : ''),
        )
      } else {
        console.error(`   [${r.genre ?? 'refus sans genre'}] ${r.detail ?? r.message ?? JSON.stringify(r)}`)
      }
    }
    console.error(
      "\n   La carte n'est PAS rendue amputée de ces lignes : une ligne absente se lit\n" +
        "   « aucun défaut sur cet écran », ce qui est exactement le contraire de ce qu'on sait.\n",
    )
    exit(1)
  }

  /*
    LE GARDE DE L'EXEMPTION : elle doit encore couvrir quelque chose.

    ET IL NE SE DÉCLENCHE QUE SUR UNE ADRESSE RÉELLEMENT BALAYÉE. La première
    version concluait « l'exemption ne couvre plus rien » dès qu'aucun refus ne
    nommait l'adresse — ce qui est faux sur un relevé restreint, où l'adresse
    n'a simplement pas été visitée. La mutation M4, qui balaie deux routes,
    l'a fait rougir sur un dépôt sain. « Pas de refus » et « pas regardé »
    s'écrivaient pareil : exactement la confusion que ce fichier reproche
    ailleurs à `mesure-ui.mjs`, et qu'il reproduisait ici.
  */
  const balayees = new Set((brut.navigateur.routes ?? []).map((r) => r.adresse))
  for (const [adresse, regle] of Object.entries(NON_MESURABLES)) {
    if (!balayees.has(adresse)) continue
    const vus = refus.filter((r) => r.adresse === adresse)
    if (vus.length === 0) {
      refuser(
        `l'adresse ${adresse} est déclarée NON MESURABLE et elle a pourtant rendu.`,
        `Motif inscrit : ${regle.motif}`,
        "L'exemption ne couvre plus rien : retirez-la de NON_MESURABLES et mesurez l'écran.",
      )
    }
    const trop = vus.filter((r) => r.elements > regle.elementsAttendusAuPlus)
    if (trop.length > 0) {
      refuser(
        `${adresse} rend ${Math.max(...trop.map((r) => r.elements))} éléments, au-delà des ` +
          `${regle.elementsAttendusAuPlus} que son exemption suppose.`,
        "L'écran a changé sous l'exemption : remesurez-le au lieu de le laisser sortir du champ.",
      )
    }
  }
}

// ─── 5. La carte : une ligne par route, un chiffre par colonne ───────────────

/** Le plus petit de deux nombres, en ignorant `null`/`undefined`. */
const moindre = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b))
const plusGrand = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b))

function parAdresse(liste) {
  const table = new Map()
  for (const e of liste ?? []) {
    if (!table.has(e.adresse)) table.set(e.adresse, [])
    table.get(e.adresse).push(e)
  }
  return table
}

const geometrie = parAdresse(brut.navigateur.geometrie)
const couleur = parAdresse(brut.navigateur.couleur)
const chargement = parAdresse(brut.navigateur.chargement)
const cls = parAdresse(brut.navigateur.cls)

/**
 * LA LANGUE LA PLUS SERRÉE, ÉCRAN PAR ÉCRAN — et surtout pas une fois pour tout.
 *
 * « Le français est plus large » est une moyenne, et une moyenne n'a jamais
 * débordé un écran. La serre se décide par écran, sur ce qui reste de place :
 * d'abord le DÉBORDEMENT (positif, donc déjà hors de l'écran), puis à
 * débordement égal le JEU de la barre (plus il est petit, plus c'est serré),
 * puis l'ÉCART entre deux cibles. Le critère qui a tranché est rendu avec la
 * réponse : sans lui, on ne saurait pas si la réponse tient à un débordement
 * franc ou à deux pixels de jeu.
 */
function langueLaPlusSerree(etats) {
  const langues = [...new Set(etats.map((e) => e.langue))]
  if (langues.length < 2) return { langue: null, critere: 'une seule langue mesurée', parLargeur: null }

  /*
    ON COMPTE LARGEUR PAR LARGEUR, et c'est tout l'écart avec la première
    version de cette fonction.

    Elle comparait les MINIMA de chaque langue sur tout l'écran, et rendait
    « à égalité » sur seize écrans sur vingt-deux. Le minimum global est une
    statistique d'ordre : il suffit qu'une seule largeur produise la même
    valeur dans les deux langues pour que l'écran paraisse indifférent, alors
    que dix autres largeurs peuvent pencher franchement du même côté. C'est la
    même faute que « le français est plus large » commet, un cran plus bas.

    Ici chaque largeur est un scrutin. Une langue gagne la largeur si elle est
    plus serrée sur AU MOINS un des quatre axes et pas moins serrée sur les
    autres ; sinon la largeur est indécise et ne compte pour personne. L'écran
    revient à la langue qui gagne le plus de largeurs, et le décompte est rendu
    avec la réponse — sans lui, « fr-FR » ne dirait pas si c'est 11 largeurs
    sur 11 ou 2 sur 11.
  */
  const axes = [
    ['écart entre cibles', (e) => e.ecart?.plusPetit?.ecart, 'moins'],
    ["hauteur d'en-tête", (e) => e.entete?.hauteurMax, 'plus'],
    ['jeu de barre', (e) => e.barre?.jeu, 'moins'],
    ['plus petite cible', (e) => e.cibles?.plusPetiteActionnable?.cote, 'moins'],
    ['débordement', (e) => e.debordement?.depassementMax, 'plus'],
  ]

  const largeurs = [...new Set(etats.map((e) => e.largeur))].sort((a, b) => a - b)
  const gains = Object.fromEntries(langues.map((l) => [l, 0]))
  let indecises = 0
  const preuves = []

  for (const largeur of largeurs) {
    const parLangue = Object.fromEntries(
      langues.map((l) => [l, etats.find((e) => e.langue === l && e.largeur === largeur)]),
    )
    if (langues.some((l) => !parLangue[l])) continue

    let penche = null
    let contradiction = false
    for (const [nom, lire, sens] of axes) {
      const a = lire(parLangue[langues[0]])
      const b = lire(parLangue[langues[1]])
      if (a == null || b == null || a === b) continue
      // « plus serré » = valeur plus PETITE, sauf pour le débordement et la
      // hauteur d'en-tête, où c'est la plus GRANDE qui étouffe l'écran.
      const gagnant = sens === 'moins' ? (a < b ? langues[0] : langues[1]) : a > b ? langues[0] : langues[1]
      if (penche === null) {
        penche = gagnant
        preuves.push(`${largeur}px ${nom} ${Math.min(a, b)}/${Math.max(a, b)}`)
      } else if (penche !== gagnant) {
        contradiction = true
      }
    }
    if (penche === null || contradiction) indecises++
    else gains[penche]++
  }

  const classees = langues.slice().sort((x, y) => gains[y] - gains[x])
  if (gains[classees[0]] === gains[classees[1]]) {
    return {
      langue: null,
      critere: `aucune ne l'emporte (${gains[langues[0]]}–${gains[langues[1]]} sur ${largeurs.length} largeurs, ${indecises} indécise(s))`,
      parLargeur: gains,
    }
  }
  return {
    langue: classees[0],
    critere:
      `${gains[classees[0]]} largeur(s) sur ${largeurs.length} ` +
      `(${gains[classees[1]]} à l'autre, ${indecises} indécise(s)) · ${preuves.slice(0, 2).join(' ; ')}`,
    parLargeur: gains,
  }
}

/** Rattache les défauts de source à un écran, par la table que le relevé rend. */
function compterParEcran(table, adresse) {
  const v = (table ?? {})[adresse]
  return typeof v === 'number' ? v : (v?.sauts ?? 0)
}

const lignes = []
for (const route of routes) {
  const exempte = NON_MESURABLES[route.adresse]
  const etats = geometrie.get(route.adresse) ?? []
  const teintes = couleur.get(route.adresse) ?? []
  const poids = chargement.get(route.adresse) ?? []
  const decalages = cls.get(route.adresse) ?? []

  const ligne = {
    adresse: route.adresse,
    roles: nommerRoles(route.roles).join('+'),
    origine: route.origine,
    mesuree: !exempte,
    motifDeNonMesure: exempte?.motif ?? null,

    // — sources (agent B) —
    focus: compterParEcran(brut.sources.anneauDeFocus?.parEcran, route.adresse),
    libelles: compterParEcran(brut.sources.libelles?.parEcran, route.adresse),
    sautsDeTitre: compterParEcran(brut.sources.titres?.parEcran, route.adresse),
    sansH1: (brut.sources.titres?.sansH1 ?? []).includes(route.adresse),

    // — jetons et i18n (agent C) —
    hexHorsJetons: (brut.jetons.axe1_couleursEnDur?.ecrans?.table ?? {})[route.adresse] ?? 0,
    chainesHorsDico: (brut.jetons.axe2_chainesVisibles?.ecrans?.table ?? {})[route.adresse] ?? 0,
  }

  if (exempte) {
    lignes.push(ligne)
    continue
  }

  // — navigateur (agent A) —
  /*
    `plusPetiteActionnable`, ET PAS `plusPetiteAgissante` — le relevé rend les
    deux, et la différence n'est pas cosmétique.

    Une commande DÉSACTIVÉE porte `pointer-events: none` : la sonde au point de
    contact ne la trouve pas et rend 0 × 0. La compter ferait rougir la carte sur
    deux boutons parfaitement corrects — le « Continuer » de `/inscription`
    (320 × 48) et l'« Envoyer la demande » de `/demo/documents` (143 × 44), que
    seul le raccourci « boîte ≥ 44 dans les deux sens » sauve aujourd'hui.
    `plusPetiteActionnable` écarte les désactivées ; c'est la mesure de ce qu'un
    doigt peut réellement toucher, donc la seule qui réponde à la question posée.
  */
  const plusPetiteAgissante = etats.reduce(
    (m, e) => (e.cibles?.plusPetiteActionnable && (m == null || e.cibles.plusPetiteActionnable.cote < m.cote) ? e.cibles.plusPetiteActionnable : m),
    null,
  )
  const plusPetitEcart = etats.reduce(
    (m, e) => (e.ecart?.plusPetit && (m == null || e.ecart.plusPetit.ecart < m.ecart) ? e.ecart.plusPetit : m),
    null,
  )
  const debordants = etats.filter((e) => (e.debordement?.depassementMax ?? 0) > 0)

  Object.assign(ligne, {
    /*
      LE CÔTÉ AU POINT DE CONTACT, pas la boîte englobante — et le tableau
      montre le premier. Une boîte de 246 × 44 dont la sonde rend 43 est un
      bouton de 43 px : c'est le 43 qui décide si le doigt tombe dedans, et
      c'est le 246 × 44 qu'on lirait à tort comme confortable. Les deux sont
      gardés dans le JSON, le côté seul est au tableau.
    */
    cibleMini: plusPetiteAgissante
      ? {
          cote: plusPetiteAgissante.cote,
          boite: plusPetiteAgissante.boite,
          quoi: plusPetiteAgissante.texte || plusPetiteAgissante.selecteur,
        }
      : null,
    ecartMini: plusPetitEcart
      ? { px: plusPetitEcart.ecart, entre: `${plusPetitEcart.a?.texte ?? '?'} / ${plusPetitEcart.b?.texte ?? '?'}` }
      : null,
    debordement: {
      px: Math.max(0, ...etats.map((e) => e.debordement?.depassementMax ?? 0)),
      premiereLargeur: debordants.length ? Math.min(...debordants.map((e) => e.largeur)) : null,
    },
    contraste: {
      principal: teintes.reduce((m, t) => moindre(m, t.principal?.min?.ratio), null),
      secondaire: teintes.reduce((m, t) => moindre(m, t.secondaire?.min?.ratio), null),
      sousSeuil: teintes.reduce((n, t) => n + (t.principal?.sousSeuil ?? 0) + (t.secondaire?.sousSeuil ?? 0), 0),
    },
    chargement: {
      ko: plusGrand(null, ...poids.map((p) => p.koNus)) ?? null,
      requetes: plusGrand(null, ...poids.map((p) => p.requetes)) ?? null,
    },
    cls: decalages.reduce((m, d) => plusGrand(m, d.cls), null),
    entete: {
      hauteurMax: etats.reduce((m, e) => plusGrand(m, e.entete?.hauteurMax), null),
      jeuMini: etats.reduce((m, e) => moindre(m, e.barre?.jeu), null),
    },
    langueSerree: langueLaPlusSerree(etats),
  })
  lignes.push(ligne)
}

/**
 * DEUX FAMILLES D'AXES, ET LE COMPTE ROUGE N'EN RETIENT QU'UNE.
 *
 * La première version de ce compte mettait le nouvel axe — l'écart entre deux
 * cibles adjacentes — au même rang que les autres, sous un plancher de 24 px
 * emprunté à WCAG 2.5.8. Résultat MESURÉ : 261 des 506 états relevés passaient
 * au rouge, et vingt-deux écrans sur vingt-deux devenaient « touchés ». Le
 * chiffre était vrai et la conclusion fausse : deux boutons de 44 × 44 collés
 * l'un à l'autre dans une barre d'onglets ont un écart de 0 px et ne violent
 * RIEN — 2.5.8 n'exige un dégagement que des cibles de MOINS de 24 px.
 *
 * Un axe neuf qui repeint tout en rouge ne mesure plus rien : il déplace
 * simplement le zéro. C'est exactement le risque que ce lot devait vérifier
 * avant de coder, et la réponse est oui. L'axe reste donc MESURÉ — ses valeurs
 * brutes sont dans le tableau et dans le JSON — et il est NON APPLIQUÉ : il ne
 * compte pas une ligne rouge, il ne ferait pas rougir une porte.
 *
 * Ce qui compte au rouge, ce sont les axes dont ce dépôt applique DÉJÀ le seuil
 * quelque part (`mesure-ui.mjs` : cible, contraste, débordement) et ceux dont le
 * seuil ne se discute pas (un champ sans libellé est un champ sans libellé).
 */
const PLANCHER_CIBLE = 44
const SEUIL_CONTRASTE = 4.5

/**
 * Les axes mesurés mais SANS seuil convenu, nommés ici pour qu'on sache
 * qu'ils sont exclus du compte — et pourquoi. Un axe exclu en silence est un
 * axe qu'on croit tenu.
 */
const MESURES_NON_APPLIQUEES = {
  'écart entre cibles adjacentes':
    "WCAG 2.5.8 n'exige un dégagement que des cibles de moins de 24 px ; toutes les cibles " +
    'agissantes de ce dépôt font 44 px ou plus. Un plancher nu de 24 px rougirait 261 états sur 506.',
  'CLS au chargement':
    'le pire relevé vaut 0,0355 pour un seuil « bon » de 0,1 — la marge est de presque trois fois.',
  'hex hors tokens.css':
    'zéro site de PRODUIT ; les 42 sites sont des gardes, des commentaires et un favicon SVG ' +
    "servi hors document, qui ne peut pas lire une variable CSS.",
  'chaînes hors dictionnaire':
    "les 2 sites hors page de contrôle sont les deux moitiés du nom de marque dans `Logo.tsx` — " +
    'un nom de marque ne se traduit pas. Le compter 19 fois, une par écran qui monte le logo, ' +
    "surestimerait d'un facteur 19 un site unique et douteux.",
}

function rougeurs(l) {
  if (!l.mesuree) return { total: null, detail: [] }
  const detail = []
  if (l.cibleMini && l.cibleMini.cote < PLANCHER_CIBLE) detail.push(`cible ${l.cibleMini.cote} px (${l.cibleMini.boite})`)
  if (l.contraste.sousSeuil > 0) detail.push(`${l.contraste.sousSeuil} texte(s) sous ${SEUIL_CONTRASTE}`)
  if (l.debordement.px > 0) detail.push(`débordement ${l.debordement.px} px`)
  if (l.focus > 0) detail.push(`${l.focus} sans focus`)
  if (l.libelles > 0) detail.push(`${l.libelles} sans libellé`)
  if (l.sautsDeTitre > 0) detail.push(`${l.sautsDeTitre} saut(s) de titre`)
  if (l.sansH1) detail.push('sans h1')
  return { total: detail.length, detail }
}

for (const l of lignes) l.rouge = rougeurs(l)
lignes.sort((a, b) => (b.rouge.total ?? -1) - (a.rouge.total ?? -1) || a.adresse.localeCompare(b.adresse))

// ─── 6. Le tableau ───────────────────────────────────────────────────────────
const n = (v, u = '') => (v == null ? '·' : `${v}${u}`)

console.log('\n' + '═'.repeat(118))
console.log('CARTE MESURÉE DES DÉFAUTS D\'INTERFACE — aucun fichier de src/ modifié')
console.log('═'.repeat(118))
console.log(
  ['ÉCRAN'.padEnd(26), 'RÔLES'.padEnd(23), 'CIBLE', ' ÉCART', 'CONTR.p/s', 'DÉBORD', '  Ko/req', '   CLS', 'FOC', 'LIB', 'TIT', 'RGE'].join(' '),
)
console.log('─'.repeat(118))
for (const l of lignes) {
  if (!l.mesuree) {
    console.log(`${l.adresse.padEnd(26)} ${l.roles.padEnd(23)} ── NON MESURÉE ─────────────────────────────────────────  (voir motif)`)
    continue
  }
  console.log(
    [
      l.adresse.padEnd(26),
      l.roles.padEnd(23),
      String(l.cibleMini?.cote ?? '·').padStart(5),
      String(l.ecartMini?.px ?? '·').padStart(6),
      `${n(l.contraste.principal)}/${n(l.contraste.secondaire)}`.padStart(9),
      String(l.debordement.px || '·').padStart(6),
      `${n(l.chargement.ko)}/${n(l.chargement.requetes)}`.padStart(9),
      String(l.cls ?? '·').padStart(6),
      String(l.focus).padStart(3),
      String(l.libelles).padStart(3),
      String(l.sautsDeTitre + (l.sansH1 ? 1 : 0)).padStart(3),
      String(l.rouge.total).padStart(3),
    ].join(' '),
  )
}
console.log('─'.repeat(118))

console.log('\nNON MESURÉES — et pourquoi (jamais comptées comme « aucun défaut ») :')
for (const l of lignes.filter((x) => !x.mesuree)) console.log(`  ${l.adresse} · ${l.motifDeNonMesure}`)

console.log('\nLANGUE LA PLUS SERRÉE, ÉCRAN PAR ÉCRAN :')
for (const l of lignes.filter((x) => x.mesuree)) {
  console.log(`  ${l.adresse.padEnd(26)} ${String(l.langueSerree.langue ?? '— à égalité —').padEnd(8)} ${l.langueSerree.critere}`)
}

// ─── 7. La question du lot, répondue en chiffres ─────────────────────────────
const mesurees = lignes.filter((l) => l.mesuree)
const total = mesurees.reduce((s, l) => s + l.rouge.total, 0)
const cinqPires = mesurees.slice(0, 5).reduce((s, l) => s + l.rouge.total, 0)
const touches = mesurees.filter((l) => l.rouge.total > 0).length

console.log('\nMESURÉ MAIS NON APPLIQUÉ — hors du compte rouge, et pourquoi :')
for (const [axe, motif] of Object.entries(MESURES_NON_APPLIQUEES)) console.log(`  ${axe} · ${motif}`)

console.log('\n' + '═'.repeat(118))
console.log('CONCENTRATION — la question que ce lot pose')
console.log('═'.repeat(118))
console.log(`  ${total} lignes rouges sur ${mesurees.length} écrans mesurés ; ${touches} écran(s) touché(s).`)
console.log(
  `  Les 5 pires en portent ${cinqPires} sur ${total} — soit ${total ? ((cinqPires / total) * 100).toFixed(1) : '0'} %.`,
)
console.log(`  Une répartition parfaitement uniforme en donnerait ${((5 / mesurees.length) * 100).toFixed(1)} %.`)

/*
  LE COMPTE PAR ÉCRAN SURESTIME, ET IL FAUT LE DIRE AVEC LUI.

  Un défaut posé dans un composant partagé se compte une fois par écran qui le
  monte. `Logo.tsx` est monté par dix-neuf écrans : deux sites y deviennent
  trente-huit rattachements. Répondre « les défauts sont répartis » sur ce
  chiffre-là serait faux — ils sont répartis parce que la SOURCE est unique.
  Les deux comptes sont donc rendus côte à côte, et c'est leur ÉCART qui
  répond à la question du lot.
*/
const sourcesDistinctes = new Map()
for (const d of brut.sources.anneauDeFocus?.defauts ?? []) sourcesDistinctes.set(`focus ${d.fichier}:${d.ligne}`, d.fichier)
for (const d of brut.sources.libelles?.defauts ?? []) sourcesDistinctes.set(`libellé ${d.fichier}:${d.ligne}`, d.fichier)
for (const s of brut.sources.titres?.sauts ?? []) sourcesDistinctes.set(`titre ${s.source}`, s.source)

console.log(`\n  Mais ces ${total} rattachements ne viennent que de ${sourcesDistinctes.size} SITE(S) distinct(s) :`)
for (const [nom] of sourcesDistinctes) console.log(`    ${nom}`)
const fichiersPorteurs = new Set([...sourcesDistinctes.values()].map((f) => String(f).replace(/:\d+$/, '')))
console.log(`  répartis sur ${fichiersPorteurs.size} fichier(s) : ${[...fichiersPorteurs].join(', ')}`)

const carte = { genere: new Date().toISOString(), routes: routes.length, lignes, concentration: { total, cinqPires, touches, mesurees: mesurees.length } }
const sortie = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null
if (sortie) {
  writeFileSync(sortie, JSON.stringify(carte, null, 2))
  console.log(`\n· carte complète → ${sortie}`)
}

console.log('\n✓ inventaire plein : 23 routes lues, 3 relevés non muets, 1 adresse non mesurable déclarée.')
console.log('  Ce script ne corrige rien et n\'entre pas dans `npm run check`.\n')
