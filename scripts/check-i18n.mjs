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

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (/\.(tsx|ts)$/.test(entry.name)) yield path
  }
}

const findings = []

for await (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (EXEMPT_FILES.includes(rel)) continue

  const source = await readFile(file, 'utf8')
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    // Les lignes de commentaire sont écartées : un bloc JSDoc qui décrit un
    // composant contient du français par nature, et « `<Link>` interne à la
    // place d'un `<button>` » ressemble à du texte entre chevrons.
    const commentaire = /^\s*(\*|\/\/|\/\*)/.test(line)

    if (!commentaire && !EXEMPT_TEXT_DIRS.some((dir) => rel.startsWith(dir))) {
      for (const match of line.matchAll(TEXTE_ACCENTUE)) {
        const value = match[1].trim()
        if (value.length < 3 || HARMLESS.test(value)) continue
        findings.push({ file: rel, line: index + 1, attribute: 'texte', value })
      }
    }

    for (const attribute of ATTRIBUTES) {
      // Ne repère que les valeurs entre guillemets : `aria-label={t('…')}` et
      // `aria-label={label}` passent, puisque la chaîne vient d'ailleurs.
      const pattern = new RegExp(`${attribute}\\s*=\\s*"([^"]*)"`, 'g')
      for (const match of line.matchAll(pattern)) {
        const value = match[1]
        if (HARMLESS.test(value)) continue
        findings.push({ file: rel, line: index + 1, attribute, value })
      }
    }
  })
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
