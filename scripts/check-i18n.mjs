#!/usr/bin/env node
/**
 * Garde-fou contre les chaînes destinées à l'utilisateur écrites en dur.
 *
 * Le typage de `en.ts` contre `fr.ts` garantit qu'aucune clé du dictionnaire ne
 * reste sans traduction. Il ne peut rien, en revanche, contre une chaîne écrite
 * directement dans le JSX : `aria-label="Indicatif"` a traversé toute la
 * construction et se faisait entendre en français au milieu d'un formulaire
 * anglais, sans qu'aucun outil ne bronche.
 *
 * On contrôle les attributs qui produisent un nom accessible ou un texte visible.
 * `aria-label` était le cas signalé, mais `placeholder`, `title` et `alt`
 * appartiennent à la même famille : ils s'affichent ou se prononcent, donc ils
 * se traduisent.
 *
 *   node scripts/check-i18n.mjs     ·     npm run lint:i18n
 *
 * Sortie 1 si une chaîne littérale est trouvée, pour bloquer en intégration.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { argv } from 'node:process'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

/** Attributs dont la valeur est lue ou entendue par l'utilisateur. */
const ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt', 'aria-description']

/**
 * Exemptions.
 *
 * `KitchenSink` est la page de contrôle du système de design : ses libellés
 * décrivent les composants eux-mêmes et ne sont pas du produit. Tout autre
 * ajout ici doit être justifié — une exemption facile vide le garde-fou de son
 * sens.
 */
const EXEMPT_FILES = ['src/routes/KitchenSink.tsx']

/**
 * Les FICHIERS DE TEST, et eux seuls parmi les sources.
 *
 * Un `aria-label="Indicatif"` dans un test n'est pas un libellé de produit :
 * c'est la FIXTURE que le test interroge ensuite. Le faire passer par le
 * dictionnaire ferait asserter le test contre lui-même — il vérifierait que
 * `t('…')` rend `t('…')`, ce qui est vrai quelle que soit la traduction, et le
 * défaut d'origine (« Indicatif » entendu au milieu d'un formulaire anglais)
 * repasserait sans être vu.
 *
 * Même raisonnement que `src/data/` : ce ne sont pas des chaînes destinées à
 * l'utilisateur, et rien de ce qui vit ici n'est livré.
 */
const EST_UN_TEST = /\.test\.tsx?$/

/**
 * Répertoires exemptés du contrôle sur le TEXTE des éléments.
 *
 * `i18n` contient les dictionnaires eux-mêmes. `data` porte le jeu de
 * démonstration — « Résidence Bonamoussadi », « Serge Mbarga » : des données,
 * pas des libellés d'interface, et elles ne se traduisent pas.
 */
const EXEMPT_TEXT_DIRS = ['src/i18n/', 'src/data/']

/**
 * Valeurs littérales sans portée linguistique : ponctuation, nombres, codes
 * couleur, et **masques de format** du type `LOC-4A7B-92CD` ou `PROP-0000-0000`.
 *
 * Le critère du masque est l'absence de minuscule et d'espace : une chaîne qui
 * n'a ni l'une ni l'autre ne contient pas de mot, donc rien à traduire. Il est
 * volontairement strict — « Indicatif » ou « nom@domaine.com » ne passent pas.
 */
const HARMLESS = /^(\s*|[-–—·|/\\]+|\d+|#[0-9a-fA-F]{3,8}|[^a-z\s]+)$/

/**
 * Texte français resté dans le JSX.
 *
 * Le contrôle des attributs ne voyait pas `<th scope="col">Période</th>` : la
 * chaîne est le contenu d'un élément, pas la valeur d'un attribut. Elle a donc
 * traversé toute la construction et se prononçait en français au milieu d'une
 * table anglaise — dans un `sr-only`, donc invisible à l'œil.
 *
 * Le critère est l'ACCENT. Une chaîne d'interface française en porte presque
 * toujours un, l'anglais quasi jamais : c'est le signal le plus fiable pour un
 * coût de faux positifs très bas, là où reconnaître « du français » en général
 * demanderait un dictionnaire.
 *
 * Le motif exige au moins trois caractères de mot autour, pour ne pas se
 * déclencher sur une entité isolée ou un fragment de code.
 */
const TEXTE_ACCENTUE = />\s*([^<>{}\n]*[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][^<>{}\n]*)\s*</g

/**
 * Ce que ce garde-fou NE couvre PAS : les littéraux de chaîne.
 *
 * Les quatre noms de documents du portail locataire vivaient dans un tableau
 * JS — `['Bail signé', 'État des lieux d'entrée', …]` — donc ni dans un
 * attribut ni entre chevrons. Ils s'affichaient en français dans l'interface
 * anglaise, et seule une inspection en navigateur les a trouvés.
 *
 * Une tentative de les détecter par le même critère d'accent a produit 114
 * signalements pour deux vrais défauts : noms de tests en français, apostrophes
 * typographiques prises pour des délimiteurs, texte de commentaires. Un
 * garde-fou à ce taux de bruit se fait désactiver — ce qui est pire que son
 * absence. Le faire correctement demanderait d'analyser l'arbre syntaxique et
 * de ne retenir que les chaînes atteignant le rendu, pas une expression
 * régulière.
 */

/**
 * Les lignes qui appartiennent à un commentaire.
 *
 * L'ancien test regardait le DÉBUT de ligne — `*`, `//`, `/*`. Les commentaires
 * JSX du dépôt s'ouvrent par `{/*` puis continuent en texte nu, sans astérisque
 * de marge : leurs lignes intérieures passaient donc pour du code. Celui du
 * `Combobox` en a fait les frais — « un `<div>` enveloppé d'un `<li>` » se lit
 * comme du texte entre chevrons, et le contrôle échouait sur une PROSE, en
 * bloquant `npm run check` pour un défaut qui n'existait pas.
 *
 * On suit donc l'ouverture et la fermeture des blocs. Le décompte est
 * volontairement naïf — il ignore `/*` à l'intérieur d'une chaîne — parce qu'un
 * faux NÉGATIF ici ne coûte qu'un signalement manqué, quand un faux positif
 * bloque la porte du dépôt.
 */
function lignesEnCommentaire(lines) {
  const dedans = new Array(lines.length).fill(false)
  let ouvert = false

  lines.forEach((line, i) => {
    if (ouvert) {
      dedans[i] = true
      if (line.includes('*/')) ouvert = false
      return
    }
    // Une ligne qui COMMENCE par un marqueur de commentaire en est une, close
    // sur place ou non : `/** Rend un `<Link>` interne. */` tient sur une seule
    // ligne et n'aurait pas été vue par le seul suivi de bloc.
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) {
      dedans[i] = true
      // Ouvert seulement s'il ne se referme pas ici même.
      if (line.trimStart().startsWith('/*') && !line.includes('*/')) ouvert = true
      return
    }
    const debut = line.indexOf('/*')
    if (debut !== -1 && !line.includes('*/', debut)) {
      dedans[i] = true
      ouvert = true
    }
  })

  return dedans
}

/**
 * Analyse UNE source. Exportée pour être éprouvée : ce contrôleur a laissé
 * passer un faux positif qui a tenu `npm run check` en échec, et un garde-fou
 * que rien ne garde finit par garder de travers.
 */
export function analyser(rel, source) {
  const trouves = []
  if (EXEMPT_FILES.includes(rel) || EST_UN_TEST.test(rel)) return trouves

  const lines = source.split('\n')
  const commentaires = lignesEnCommentaire(lines)

  lines.forEach((line, index) => {
    if (commentaires[index]) return

    if (!EXEMPT_TEXT_DIRS.some((dir) => rel.startsWith(dir))) {
      for (const match of line.matchAll(TEXTE_ACCENTUE)) {
        const value = match[1].trim()
        if (value.length < 3 || HARMLESS.test(value)) continue
        trouves.push({ file: rel, line: index + 1, attribute: 'texte', value })
      }
    }

    for (const attribute of ATTRIBUTES) {
      // Ne repère que les valeurs entre guillemets : `aria-label={t('…')}` et
      // `aria-label={label}` passent, puisque la chaîne vient d'ailleurs.
      const pattern = new RegExp(`${attribute}\\s*=\\s*"([^"]*)"`, 'g')
      for (const match of line.matchAll(pattern)) {
        const value = match[1]
        if (HARMLESS.test(value)) continue
        trouves.push({ file: rel, line: index + 1, attribute, value })
      }
    }
  })

  return trouves
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (/\.(tsx|ts)$/.test(entry.name)) yield path
  }
}


/**
 * Deux QUESTIONS identiques dans un même écran.
 *
 * Deuxième défaut de cette famille, après les chaînes écrites en dur : deux
 * clés distinctes rendant le même libellé, affichées côte à côte. Il s'est
 * produit deux fois de suite. « Devis proposé » a servi au statut d'une
 * intervention ET à la nature de son montant, sur la même ligne. Puis « De quoi
 * s'agit-il ? » a désigné le titre d'un chantier ET le choix du corps de
 * métier, à quinze pixels d'écart dans le même formulaire.
 *
 * Aucun outil ne les voyait. Le typage garantit que chaque CLÉ existe et qu'elle
 * est traduite ; il ne regarde jamais la chaîne rendue. Et les tests visaient
 * les valeurs — « multi-corps », un sélecteur — jamais les questions posées.
 *
 * ── POURQUOI CE CRITÈRE, ET PAS UN AUTRE ──
 *
 * « Valeur unique dans le dictionnaire » : mesuré, 61 doublons, presque tous
 * légitimes — « Travaux » nomme une entrée de navigation et un titre d'écran,
 * c'est le même mot pour la même chose. Inutilisable.
 *
 * « Valeur unique par FICHIER » : mesuré, 10 doublons sur du code sain. « Loyer »
 * en carte et en colonne du même tableau, « Eau », « Quittance » — le même
 * concept nommé deux fois, ce qui ne gêne personne. Un garde-fou qui naît avec
 * dix exceptions n'est pas un garde-fou.
 *
 * « Deux QUESTIONS identiques dans un fichier » : mesuré, zéro sur le code
 * actuel, et il attrape la collision réelle sur le seul fichier concerné. Une
 * interrogation appelle une réponse ; deux fois la même appelle deux réponses
 * différentes, ce qui est toujours un défaut. Un nom de colonne répété, non.
 *
 * ── CE QU'IL NE VOIT PAS, ET C'EST DÉLIBÉRÉ ──
 *
 * Les clés COMPOSÉES — `t(`app.works.${statut}`)` — ne sont pas résolues. Les
 * développer par préfixe ferait remonter « Devis proposé », la première des
 * deux collisions ; mais cela signalait aussi `Signaler.tsx`, qui n'emploie
 * aucune des deux clés en cause. Un garde-fou qui désigne le mauvais fichier
 * apprend à ne pas le lire.
 *
 * Ce contrôle ne couvre donc que la moitié de ce qu'il devrait. Il vaut mieux
 * qu'une moitié juste qu'un tout approximatif — et la moitié restante est celle
 * qu'un humain voit à l'écran, comme les deux fois où elle a été trouvée.
 */
export function questionsEnDouble(dictionnaire, fichiers) {
  const trouvailles = []
  for (const [fichier, code] of fichiers) {
    const cles = new Set([...code.matchAll(/t\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]))
    const parLibelle = new Map()
    for (const cle of cles) {
      const valeur = dictionnaire.get(cle)
      // Seules les interrogations. Le point d'interrogation pleine chasse est
      // là pour le jour où le produit parlera une langue qui l'emploie.
      if (!valeur || !/[?？]\s*$/.test(valeur)) continue
      parLibelle.set(valeur, [...(parLibelle.get(valeur) ?? []), cle])
    }
    for (const [valeur, clesEnCause] of parLibelle)
      if (clesEnCause.length > 1) trouvailles.push({ fichier, valeur, cles: clesEnCause })
  }
  return trouvailles
}

/**
 * Un libellé qui AVOUE que son propre geste ne fait rien.
 *
 * Troisième défaut de cette famille, et le premier qui mentait au lieu de se
 * taire. Sous le bouton d'enregistrement du mot de passe vivait ceci :
 * « L'enregistrement n'est pas encore branché : le formulaire valide la saisie,
 * puis affiche l'écran de confirmation. » C'était vrai quand un
 * `window.setTimeout` tenait lieu d'appel. La route a été branchée deux lots
 * plus tôt, et la phrase est restée — décourageant exactement celui qui venait
 * réparer son accès, au moment le plus mauvais : après avoir reçu son lien,
 * ouvert la page et choisi un mot de passe.
 *
 * C'était le SECOND de l'espèce. Le premier annonçait que « la création de
 * compte n'est pas encore branchée » alors qu'`inscrire` était appelé. Ces
 * phrases survivent au code qu'elles décrivent parce que RIEN NE LES Y RELIE :
 * remplacer un `setTimeout` par un appel réel ne fait tomber aucun test qui
 * parle du bandeau. Il a fallu deux fois un œil humain sur l'écran.
 *
 * ── POURQUOI CES MOTIFS, ET PAS LES ÉVIDENTS ──
 *
 * Mesuré sur les 895 clés françaises et les 905 anglaises :
 *
 *   « démonstration »     12 occurrences, toutes justes — le badge, le parc
 *                         d'exemple, « Repartir du jeu de démonstration ».
 *   « demo »               4, dont deux appels à l'action du site vitrine.
 *   « pour l'instant »     3 — « Aucun encaissement pour l'instant » décrit un
 *                         état vide, pas une fonction absente.
 *   « n'est pas encore »   1 — « Laissez vide s'il n'est pas encore signé ».
 *   « not yet »            1 — « Not yet quoted ».
 *
 * Aucun de ces cinq n'est utilisable : ils désignent un ÉTAT du parc, pas un
 * aveu d'impuissance du logiciel. Un garde-fou qui naît avec cinq exceptions
 * n'en est pas un — c'est la leçon déjà tirée pour les questions en double.
 *
 * Les motifs retenus mesurent zéro sur le dictionnaire actuel et attrapent les
 * deux phrases historiques. Ils ne visent pas un vocabulaire mais un ACTE de
 * langage : dire au lecteur que ce qu'il vient de faire n'a pas eu lieu.
 *
 * ── CE QU'IL NE VOIT PAS ──
 *
 * Un aveu formulé autrement lui échappera, et il n'y a pas de remède général :
 * reconnaître « cette phrase dit que la fonction est absente » demanderait de
 * comprendre la phrase. Ce garde-fou attrape la RÉCIDIVE — la même tournure, la
 * prochaine fois — ce qui est précisément ce qui vient de se produire deux fois.
 */
const AVEUX_DE_SIMULATION = [
  /pas encore branch[ée]/i,
  /pas encore (?:impl[ée]ment|connect|reli)/i,
  /bient[oô]t disponible/i,
  /en cours de d[ée]veloppement/i,
  /ne fait rien/i,
  /sans effet r[ée]el/i,
  /simul[ée]\b|simulation/i,
  /not yet (?:wired|connected|implemented|hooked)/i,
  /coming soon/i,
  /under construction/i,
  /does nothing/i,
  /simulat(?:ed|es|ion)/i,
  /for now,? nothing/i,
]

/**
 * LES AVEUX ASSUMÉS, et pourquoi ce registre plutôt qu'un motif plus étroit.
 *
 * Un aveu peut être VRAI. « La synchronisation différée n'est pas encore
 * implémentée » l'est : ni service worker, ni file d'attente, ni stockage local
 * dans tout `src`. La carte le dit honnêtement, sur l'écran qui montre les états
 * du système. Le défaut n'est donc jamais l'aveu — c'est l'aveu DEVENU FAUX, et
 * aucune expression régulière ne distingue les deux.
 *
 * D'où ce registre plutôt qu'un motif rétréci à la seule tournure qui a récidivé.
 * Y inscrire une clé n'est pas contourner le garde-fou : c'est prendre date. Le
 * jour où la fonction est branchée, cette liste est le seul endroit du dépôt qui
 * sache qu'une phrase attend d'être retirée — et c'est précisément ce qui a
 * manqué deux fois, où rien ne reliait le texte au code qu'il décrivait.
 *
 * Une entrée ici doit donc nommer ce qu'elle attend. Si la ligne survit à la
 * fonction qu'elle annonce absente, le garde-fou n'aura servi à rien.
 */
const AVEUX_ASSUMES = new Map([
  [
    'app.system.offlineNotice',
    'Vrai au 2026-08-20 : aucun service worker, aucune file d’attente, aucun ' +
      'stockage local dans src. À RETIRER le jour où la synchronisation ' +
      'différée est branchée.',
  ],
])

/**
 * LA QUATRIÈME FAMILLE : une promesse d'envoi sur un canal qui n'existe pas.
 *
 * Symétrique exacte de la précédente. L'aveu de simulation dit « je n'ai rien
 * fait » alors que le geste a lieu ; celle-ci dit « c'est parti » alors que rien
 * ne part. Elle est la plus coûteuse des deux, parce que le lecteur AGIT sur
 * elle : le bailleur qui lisait « Fiche locataire créée · code d'invitation
 * envoyé par SMS » ne transmettait pas le code, et attendait une activation qui
 * ne pouvait pas venir. La modale le promettait trois fois — à l'ouverture, sous
 * le champ du téléphone, au succès — et la route de création n'émet aucun code.
 *
 * Le canal, lui, n'existe pas du tout : `MessagerieResend.envoyerSms` rend
 * `false` sans appeler personne, et le commentaire au-dessus dit que c'est
 * délibéré — « rendre `true` pour faire propre annoncerait un envoi qui n'a pas
 * lieu ». Tant que cette méthode est ce qu'elle est, toute phrase du produit qui
 * affirme un envoi par SMS est fausse par construction.
 *
 * ── POURQUOI CE MOTIF, ET PAS « SMS » TOUT COURT ──
 *
 * Mesuré sur les deux dictionnaires : « SMS » apparaît dans des libellés
 * parfaitement justes — « Aucun SMS n'est envoyé », « Aucun SMS n'a été envoyé :
 * transmettez le code vous-même », le nom du canal dans le journal des relances,
 * et la ligne de la grille tarifaire qui décrit une fonction à venir. Un motif
 * sur le mot seul naîtrait avec cinq exceptions, ce que les deux garde-fous
 * précédents ont déjà appris à refuser.
 *
 * On vise donc la seule tournure qui AFFIRME le départ — le participe passé et
 * son équivalent anglais, que « sera envoyé » et « will be sent » portent aussi.
 * Ces deux-là mesurent zéro sur le dictionnaire corrigé, hors la clé inscrite au
 * registre ci-dessous.
 */
const PROMESSES_DE_CANAL = [
  /envoy[ée]e?s? par SMS/i,
  /sent by SMS/i,
  /**
   * LA PROMESSE DE CALENDRIER, mesurée sur la page tarifs.
   *
   * Les deux motifs ci-dessus n'attrapent qu'une affirmation de départ, passée
   * ou future passive — « envoyé par SMS », « sera envoyé par SMS ». La page
   * tarifs promet autrement : « SMS et e-mail déclenchés à J+1, J+7, J+15 »
   * décrit un calendrier au présent, sans jamais employer « par SMS ». Mesuré
   * sur les deux dictionnaires au 2026-08-24 : ce motif ne touche que cette
   * ligne et son équivalent anglais — ni « Aucun SMS n'a été envoyé », ni le
   * nom de canal seul (`channel_sms: 'SMS'`), ni « reçu par SMS » à la
   * signature du bail.
   */
  /SMS[^.]*d[ée]clench[ée]s?/i,
  /SMS[^.]*triggered/i,
]

/**
 * LA PROMESSE ASSUMÉE, sur le modèle du registre des aveux.
 *
 * Une phrase peut affirmer un envoi sans mentir, à une condition : que ce soit le
 * SERVEUR qui l'affirme, et l'écran qui le répète. C'est le cas de la seule
 * entrée ci-dessous — `InviteModal` ne la rend que si la réponse porte
 * `envoye: true`, et choisit sinon « Aucun SMS n'a été envoyé ». Elle est donc
 * du texte en attente, pas une affirmation.
 *
 * Y inscrire une clé n'est pas contourner le garde-fou : c'est prendre date. Le
 * jour où un fournisseur de SMS est branché, cette liste est le seul endroit du
 * dépôt qui sache qu'une ligne attend d'être relue.
 */
const PROMESSES_ASSUMEES = new Map([
  [
    'app.invite.sentBySms',
    'Vrai au 2026-08-21 : cette phrase n’est rendue que si le serveur répond ' +
      '`envoye: true`, ce que `MessagerieResend.envoyerSms` — qui rend `false` ' +
      'sans appeler personne — ne peut pas produire. L’écran affiche sinon ' +
      '« Aucun SMS n’a été envoyé ». À RETIRER DU REGISTRE le jour où un ' +
      'fournisseur de SMS est branché : la phrase sera alors simplement vraie, ' +
      'et n’aura plus besoin de dérogation.',
  ],
])

/** Parcourt UN dictionnaire à plat et rend les libellés qui promettent un envoi. */
export function promessesDeCanal(langue, dictionnaire) {
  const trouvailles = []
  for (const [cle, valeur] of dictionnaire) {
    if (PROMESSES_ASSUMEES.has(cle)) continue
    const motif = PROMESSES_DE_CANAL.find((re) => re.test(valeur))
    if (motif) trouvailles.push({ langue, cle, valeur, motif: String(motif) })
  }
  return trouvailles
}

/**
 * Parcourt UN dictionnaire à plat et rend les libellés qui s'accusent.
 *
 * Les deux langues sont contrôlées, et pas seulement le français : un bandeau
 * périmé resté en anglais trompe son lecteur tout autant, et c'est même la
 * moitié qu'on relit le moins.
 */
export function aveuxDeSimulation(langue, dictionnaire) {
  const trouvailles = []
  for (const [cle, valeur] of dictionnaire) {
    if (AVEUX_ASSUMES.has(cle)) continue
    const motif = AVEUX_DE_SIMULATION.find((re) => re.test(valeur))
    if (motif) trouvailles.push({ langue, cle, valeur, motif: String(motif) })
  }
  return trouvailles
}

/**
 * Le dictionnaire à plat : « app.works.openWhat » → « Que faut-il faire ? ».
 *
 * Lu au texte plutôt qu'importé. `fr.ts` est un module TypeScript, et ce script
 * tourne sous Node sans transpilation — l'importer demanderait une étape de
 * construction pour un garde-fou dont tout l'intérêt est de tourner vite et
 * partout.
 */
export function dictionnaireAPlat(source) {
  const valeurs = new Map()
  const pile = []
  const lignes = source.split('\n')

  /**
   * LES ENTRÉES REPLIÉES, qui étaient invisibles.
   *
   * Prettier renvoie la valeur à la ligne quand elle est longue :
   *
   *     demoNotice:
   *       'Vous parcourez une démonstration…',
   *
   * Le motif d'origine exigeait clé et valeur sur la MÊME ligne. Mesuré, il
   * ratait 62 entrées françaises et 52 anglaises — et pas n'importe lesquelles :
   * exactement les longues, c'est-à-dire les phrases. Un aveu de simulation
   * étant par nature une explication, le point aveugle recouvrait précisément la
   * classe qu'on cherche à garder. Il l'a d'ailleurs démontré : le bandeau
   * historique, réintroduit tel quel pour éprouver le garde-fou, est passé sans
   * un mot.
   */
  lignes.forEach((ligne, i) => {
    const ouvre = ligne.match(/^\s+([A-Za-z_][\w]*): \{/)
    const feuille = ligne.match(/^\s+([A-Za-z_][\w]*): '((?:[^'\\]|\\.)*)',?\s*$/)
    const cleSeule = ligne.match(/^\s+([A-Za-z_][\w]*):\s*$/)
    const ferme = ligne.match(/^\s+\},?\s*$/)

    if (ouvre) pile.push(ouvre[1])
    else if (ferme) pile.pop()
    else if (feuille) valeurs.set([...pile, feuille[1]].join('.'), feuille[2])
    else if (cleSeule) {
      const suite = (lignes[i + 1] ?? '').match(/^\s+'((?:[^'\\]|\\.)*)',?\s*$/)
      if (suite) valeurs.set([...pile, cleSeule[1]].join('.'), suite[1])
    }
  })

  return valeurs
}

/**
 * Le parcours des sources ne s'exécute QUE si ce fichier est lancé lui-même.
 *
 * Sans cette garde, l'importer pour éprouver `analyser` déclenchait le scan
 * complet — et sous Vite, où `import.meta.url` n'est pas un chemin de disque,
 * il échouait avant le premier test. Un garde-fou qu'on ne peut pas éprouver
 * sans le faire tourner en entier finit par n'être éprouvé jamais.
 */
if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  const findings = []
  const sources = []

  for await (const file of walk(SRC)) {
    const rel = relative(ROOT, file)
    const code = await readFile(file, 'utf8')
    findings.push(...analyser(rel, code))
    // Les fichiers de test ne rendent rien : deux questions identiques y sont
    // deux assertions, pas deux champs voisins.
    if (!/\.test\.tsx?$/.test(rel)) sources.push([rel, code])
  }

  const fr = dictionnaireAPlat(await readFile(join(SRC, 'i18n/fr.ts'), 'utf8'))
  const en = dictionnaireAPlat(await readFile(join(SRC, 'i18n/en.ts'), 'utf8'))

  const aveux = [...aveuxDeSimulation('fr', fr), ...aveuxDeSimulation('en', en)]

  if (aveux.length > 0) {
    console.error(`✗ ${aveux.length} libellé(s) avouant que le geste ne fait rien :\n`)
    for (const a of aveux) {
      console.error(`  ${a.langue} · ${a.cle}`)
      console.error(`    « ${a.valeur} »`)
      console.error(`    → motif ${a.motif}`)
      console.error("    Si c'est faux, retirer la phrase. Si c'est vrai, brancher le geste.\n")
    }
    process.exit(1)
  }

  const promesses = [...promessesDeCanal('fr', fr), ...promessesDeCanal('en', en)]

  if (promesses.length > 0) {
    console.error(`✗ ${promesses.length} libellé(s) annonçant un envoi par SMS :\n`)
    for (const p of promesses) {
      console.error(`  ${p.langue} · ${p.cle}`)
      console.error(`    « ${p.valeur} »`)
      console.error(`    → motif ${p.motif}`)
      console.error(
        "    `envoyerSms` rend `false` : rien ne part. Retirer la phrase, ou brancher le canal.\n",
      )
    }
    process.exit(1)
  }

  const doublons = questionsEnDouble(fr, sources)

  if (doublons.length > 0) {
    console.error(`✗ ${doublons.length} question(s) posée(s) deux fois dans un même écran :\n`)
    for (const d of doublons) {
      console.error(`  ${d.fichier}`)
      console.error(`    « ${d.valeur} »`)
      console.error(`    → ${d.cles.join('  et  ')}`)
      console.error('    Deux questions distinctes appellent deux libellés distincts.\n')
    }
    process.exit(1)
  }

  if (findings.length === 0) {
    console.log(
      '✓ Aucune chaîne en dur, aucune question en double, aucun aveu de simulation, aucun envoi promis sur un canal absent.',
    )
    process.exit(0)
  }

  console.error(`✗ ${findings.length} chaîne(s) écrite(s) en dur :\n`)
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`)
    console.error(`    ${f.attribute}="${f.value}"`)
    console.error(`    → passer par le dictionnaire : ${f.attribute}={t('…')}\n`)
  }
  process.exit(1)
}
