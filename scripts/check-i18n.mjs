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
 * Le parcours des sources ne s'exécute QUE si ce fichier est lancé lui-même.
 *
 * Sans cette garde, l'importer pour éprouver `analyser` déclenchait le scan
 * complet — et sous Vite, où `import.meta.url` n'est pas un chemin de disque,
 * il échouait avant le premier test. Un garde-fou qu'on ne peut pas éprouver
 * sans le faire tourner en entier finit par n'être éprouvé jamais.
 */
if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  const findings = []

  for await (const file of walk(SRC)) {
    const rel = relative(ROOT, file)
    findings.push(...analyser(rel, await readFile(file, 'utf8')))
  }

  if (findings.length === 0) {
    console.log('✓ Aucune chaîne utilisateur écrite en dur.')
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
