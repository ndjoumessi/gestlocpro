#!/usr/bin/env node
/**
 * AUCUN MODULE IMPATIENT NE CITE UNE CLÉ `app.*`.
 *
 * ═══ CE QUE CETTE GARDE REND POSSIBLE ═══
 *
 * La section `app` du dictionnaire français est chargée PARESSEUSEMENT, par la
 * même promesse que l'espace applicatif (`chargerEspaceApplicatif`, `App.tsx`)
 * et que l'annonce publique. Un visiteur de la vitrine ne télécharge donc plus
 * les mots des écrans de gestion qu'il n'ouvrira jamais.
 *
 * LE PRIX DE CETTE SCISSION EST UNE FAUTE QUI NE SE VOIT PAS. Un module du
 * paquet d'entrée qui appelle `t('app.quelquechose')` s'exécute AVANT que le
 * morceau paresseux n'existe : `resolve()` ne trouve rien, et `t()` rend la clé
 * BRUTE — « app.crash.title » en toutes lettres, sur l'écran de panne, au pire
 * moment. Rien dans le typage ne le dit : `MessageKey` reste dérivé du
 * dictionnaire ENTIER des deux côtés de la frontière, et c'est voulu — un écran
 * applicatif doit pouvoir nommer ses clés normalement.
 *
 * C'est exactement l'échec que `premier-chargement.mjs` décrivait en refusant la
 * scission : « Une scission faite À MOITIÉ marche, et échoue SILENCIEUSEMENT si
 * l'on en oublie une ». Cette garde est la condition qu'il posait.
 *
 * ═══ CE QU'ELLE MESURE, ET COMMENT ELLE DÉCIDE QUI EST IMPATIENT ═══
 *
 * Elle marche le graphe d'imports depuis `src/main.tsx` et s'arrête à tout
 * `import()` DYNAMIQUE — c'est lui, et lui seul, qui crée un morceau séparé.
 * Tout ce qu'elle atteint part dans le paquet d'entrée.
 *
 * ELLE IGNORE LES IMPORTS DE TYPE, et ce n'est pas un détail de confort : c'est
 * la seule façon d'être juste. `src/lib/useDates.ts` écrit
 * `import type { DateParts } from '@/data/portfolio'`, et `portfolio.ts` cite
 * HUIT clés `app.*`. Compté comme un import réel, il faisait de ce fichier un
 * module impatient fautif — un faux positif qui aurait fait déplacer huit clés
 * pour rien. Vérifié dans le paquet construit le 2026-10-09 :
 * `app.payments.methodMobile` apparaît ZÉRO fois dans `index.js` et deux fois
 * dans `EspaceApplicatif.js`. Un `import type` est effacé à la compilation.
 *
 * ═══ CE QU'ELLE NE VOIT PAS, ET IL FAUT LE DIRE ═══
 *
 * Elle lit des CHAÎNES. Une clé construite à l'exécution —
 * `` t(`app.${section}.titre`) `` — lui échappe. Le dépôt n'en écrit pas dans un
 * module impatient aujourd'hui, et le préfixe nu `'app.'` est refusé comme une
 * clé entière pour que la tentative la plus simple ne passe pas.
 *
 * Elle ne vérifie pas non plus que les deux frontières paresseuses ATTENDENT
 * réellement le dictionnaire : c'est `App.tsx` qui le tient, et
 * `dictionnaireApplicatif.test.tsx` qui le garde.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve as resoudreChemin } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = resoudreChemin(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(RACINE, 'src')
const ENTREE = join(SRC, 'main.tsx')

/** Un spécificateur vers un fichier du dépôt, ou `null` (paquet npm, absent). */
function resoudreSpecificateur(depuis, spec) {
  let base
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resoudreChemin(dirname(depuis), spec)
  else return null
  const essais = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  for (const essai of essais) if (existsSync(essai) && statSync(essai).isFile()) return essai
  return null
}

/** Les spécificateurs que ce fichier charge DYNAMIQUEMENT — les frontières. */
function frontieresDe(source) {
  return new Set([...source.matchAll(/(?<!\w)import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]))
}

/**
 * Les imports STATIQUES et porteurs de valeur d'un fichier.
 *
 * `import type …` et `export type …` sont écartés : effacés à la compilation,
 * ils ne tirent rien dans le paquet. Voir l'en-tête pour le faux positif que
 * cette distinction a évité.
 */
function importsDeValeur(source) {
  return [...source.matchAll(/^\s*(?:import|export)\s+(?!type\s)[^;]*?from\s*['"]([^'"]+)['"]/gm)]
    .map((m) => m[1])
}

/** L'ensemble des modules qui partent dans le paquet d'entrée. */
function modulesImpatients(entree = ENTREE) {
  const atteints = new Set()
  const file = [entree]
  while (file.length) {
    const fichier = file.shift()
    if (atteints.has(fichier)) continue
    atteints.add(fichier)
    const source = readFileSync(fichier, 'utf8')
    const frontieres = frontieresDe(source)
    for (const spec of importsDeValeur(source)) {
      if (frontieres.has(spec)) continue
      const cible = resoudreSpecificateur(fichier, spec)
      if (cible && !cible.includes('.test.')) file.push(cible)
    }
  }
  return atteints
}

/**
 * Les clés `app.*` qu'une source cite.
 *
 * Le préfixe NU — `'app.'` sans suite — est rendu lui aussi : c'est la forme
 * qu'une clé construite prend le plus souvent (`'app.' + section`), et la
 * laisser passer rouvrirait le trou par sa porte la plus simple.
 */
function clesApplicativesDe(source) {
  return [...source.matchAll(/['"`](app\.[A-Za-z0-9_.]*)['"`]/g)].map((m) => m[1])
}

/* ═══ LE TÉMOIN, en deux moitiés, parce que la garde a deux moitiés ═══

   Un détecteur cassé rend une liste vide, et une liste vide s'écrit comme un
   dépôt sain. Les deux contrôles ci-dessous distinguent ces deux phrases :
   le premier prouve que le LECTEUR DE CLÉS sait voir ce qu'il cherche, le
   second que la MARCHE DU GRAPHE range chaque module du bon côté — y compris
   le cas du `import type`, qui est précisément celui qu'on a failli rater. */

const TEMOIN_SOURCE = [
  "const t = useT()",
  "t('app.crash.title')",
  "t('app.' + section)",
  "t('common.cancel')",
  "// app.pas.une.chaine",
].join('\n')
const TEMOIN_ATTENDU = ['app.crash.title', 'app.']

const obtenu = clesApplicativesDe(TEMOIN_SOURCE)
if (JSON.stringify(obtenu) !== JSON.stringify(TEMOIN_ATTENDU)) {
  console.error('✗ TÉMOIN du lecteur de clés :', JSON.stringify(obtenu))
  console.error('  attendu :', JSON.stringify(TEMOIN_ATTENDU))
  exit(1)
}

const impatients = modulesImpatients()
const relatif = (f) => relative(RACINE, f)
const estImpatient = (chemin) => impatients.has(join(RACINE, chemin))

/**
 * Trois ancres impatientes, deux paresseuses, une par `import type`.
 *
 * `src/data/portfolio.ts` est l'ancre qui compte : elle n'est atteignable que
 * par un import de type, elle cite huit clés `app.*`, et une marche de graphe
 * qui la rangerait du mauvais côté rendrait huit plaintes imaginaires.
 */
const ANCRES = [
  ['src/App.tsx', true],
  ['src/routes/Landing.tsx', true],
  ['src/i18n/I18nProvider.tsx', true],
  ['src/app/EspaceApplicatif.tsx', false],
  ['src/features/dashboard/Dashboard.tsx', false],
  ['src/data/portfolio.ts', false],
]
const ancresFautives = ANCRES.filter(([chemin, attendu]) => estImpatient(chemin) !== attendu)
if (ancresFautives.length) {
  console.error('✗ TÉMOIN de la marche du graphe : les ancres suivantes ont changé de côté.\n')
  for (const [chemin, attendu] of ancresFautives)
    console.error(`  ${chemin} — attendu ${attendu ? 'IMPATIENT' : 'PARESSEUX'}, trouvé l'inverse`)
  console.error('\n  Soit la frontière a bougé — et ce relevé doit suivre —, soit le marcheur')
  console.error('  est cassé. Dans les deux cas, ce qu’il rend ci-dessous ne vaut rien.')
  exit(1)
}

/**
 * LA SECONDE MOITIÉ DE LA RÈGLE, et sans elle la première se contourne sans
 * effort : un module peut importer `fr-app` et lire `frApp.app.portfolio.title`
 * sans jamais écrire la chaîne `'app.…'`. Le lecteur de clés ne verrait rien, et
 * le morceau paresseux serait tiré dans le paquet d'entrée — la scission défaite
 * en silence, par un import qui a l'air anodin.
 *
 * Un import de TYPE reste permis : `I18nProvider` en a besoin pour `MessageKey`,
 * et il ne tire rien.
 */
const IMPORT_DU_MORCEAU = /^\s*import\s+(?!type\s)[^;]*?from\s*['"][^'"]*fr-app['"]/m

const plaintes = []
for (const fichier of [...impatients].sort()) {
  // Les dictionnaires eux-mêmes NOMMENT les clés : ce n'est pas les citer.
  if (fichier.startsWith(join(SRC, 'i18n'))) continue
  const source = readFileSync(fichier, 'utf8')
  for (const cle of clesApplicativesDe(source)) plaintes.push(`${relatif(fichier)} · ${cle}`)
  if (IMPORT_DU_MORCEAU.test(source))
    plaintes.push(`${relatif(fichier)} · importe \`fr-app\` autrement qu'en type`)
}

if (plaintes.length) {
  console.error(
    `✗ ${plaintes.length} citation(s) de \`app.*\` dans un module du paquet d'entrée :\n`,
  )
  for (const p of plaintes) console.error('  ' + p)
  console.error(
    '\n  La section `app` du dictionnaire arrive avec l’espace applicatif, donc APRÈS\n' +
      '  ces modules-là. La clé s’afficherait en toutes lettres à l’écran.\n\n' +
      '  Le remède n’est pas d’importer le morceau plus tôt — ce serait défaire la\n' +
      '  scission — mais de SORTIR la clé de `app.` : un texte que le paquet d’entrée\n' +
      '  prononce n’appartient pas aux écrans de gestion. `common.crash.*` et\n' +
      '  `marketing.*` sont les deux sections qui l’ont déjà accueilli.',
  )
  exit(1)
}

console.log(
  `✓ Témoin classé, et aucun des ${impatients.size} modules du paquet d'entrée ne cite \`app.*\`.`,
)
