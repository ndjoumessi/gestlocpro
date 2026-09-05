import { readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * REFUSE DE MESURER UN PAQUET PLUS VIEUX QUE LA SOURCE.
 *
 * ═══ LE FAUX VERT, MESURÉ TROIS FOIS EN UNE JOURNÉE ═══
 *
 * Les gardes de navigateur ouvrent `dist/`, servi par `vite preview`. Une seule
 * le construit — `mesure-ui`, première de la chaîne. Les autres mesurent ce qui
 * traîne sur le disque, et lancer un script SEUL après une modification mesure
 * donc le code d'AVANT, sans un mot.
 *
 * Le 2026-09-05 : `npm run modales` a rendu « 11 px de défilement, plafond 11 »
 * — vert — sur une modale qui en demandait 82 ; j'ai failli inscrire 11 comme
 * plafond mesuré, ce qui aurait gardé un écran disparu. Le même jour,
 * `notes-conditionnelles` a échoué sur un clic en délai d'attente et j'ai
 * cherché le défaut dans la garde avant de le chercher dans le paquet.
 *
 * Un faux ROUGE se lit et s'enquête. Un faux VERT se croit.
 *
 * ═══ CE QU'ELLE COMPARE ═══
 *
 * La date du fichier d'ENTRÉE le plus récent contre celle de `dist/index.html`,
 * que `vite build` réécrit à chaque passage. Les entrées sont les sources et ce
 * qui décide de leur compilation — la configuration comprise : changer
 * `vite.config.ts` change le paquet sans toucher une ligne de `src/`.
 *
 * ═══ CE QU'ELLE NE VOIT PAS, ET IL FAUT LE DIRE ═══
 *
 * — Une date de fichier n'est pas une empreinte. Un `touch` sans modification
 *   fait rougir ; une modification qui préserve la date passe. On échange un
 *   faux rouge rare et bruyant contre un faux vert silencieux, et c'est le bon
 *   sens de l'échange.
 * — `git checkout` réécrit les dates : après un changement de branche, tout est
 *   plus jeune que le paquet et la garde exige une reconstruction. C'est
 *   correct — le paquet ne correspond effectivement plus.
 * — Elle ne dit rien du CONTENU : un paquet construit depuis une source cassée
 *   reste un paquet, et c'est `tsc` qui en répond.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Ce dont le paquet dépend.
 *
 * `src/` et `public/` pour ce qui y entre, et les trois fichiers qui décident de
 * la COMPILATION : `index.html` en est le point d'entrée, `vite.config.ts` la
 * commande, `package.json` fixe les versions. Un changement de l'un d'eux change
 * le paquet sans qu'aucune ligne de `src/` ne bouge — c'est exactement le cas
 * qu'une liste bornée à `src/` laisserait passer.
 */
const ENTREES = ['src', 'public', 'index.html', 'vite.config.ts', 'package.json']

/**
 * CE QUI VIT DANS `src/` SANS ENTRER DANS LE PAQUET.
 *
 * Les cas et leur harnais ne sont importés par aucun point d'entrée : `vite
 * build` ne les voit jamais. Les compter ferait exiger une reconstruction après
 * chaque test écrit — un faux ROUGE quotidien, et une garde qu'on finit par
 * contourner est une garde morte.
 *
 * La règle tient parce qu'un fichier de cas importé par du code applicatif
 * serait déjà un défaut, et un autre l'attraperait.
 */
const HORS_PAQUET = /\.test\.(ts|tsx)$|^src\/test\//

/** Le fichier le plus récent d'un chemin, récursivement. */
function laPlusRecente(chemin) {
  const absolu = join(RACINE, chemin)
  if (!existsSync(absolu)) return null
  const etat = statSync(absolu)
  if (!etat.isDirectory()) return { chemin, quand: etat.mtimeMs }

  let record = null
  for (const entree of readdirSync(absolu, { withFileTypes: true })) {
    /* Les dossiers engendrés ne sont pas des sources : les inclure ferait
       rougir la garde à cause de sa propre mesure précédente. */
    if (entree.isDirectory() && ['node_modules', 'generated', 'dist'].includes(entree.name))
      continue
    const sous = join(chemin, entree.name)
    if (!entree.isDirectory() && HORS_PAQUET.test(sous.replaceAll('\\', '/'))) continue
    const suite = laPlusRecente(sous)
    if (suite && (!record || suite.quand > record.quand)) record = suite
  }
  return record
}

/**
 * Arrête le script si le paquet est absent ou périmé.
 *
 * Elle SORT plutôt que de lever : ces scripts sont des portes, et une porte qui
 * ne peut pas mesurer doit dire pourquoi en une phrase lisible, pas dérouler une
 * pile d'appels au-dessus d'un message que personne ne lit.
 */
export function exigerUnPaquetAJour() {
  const temoin = join(RACINE, 'dist', 'index.html')
  if (!existsSync(temoin)) {
    console.error(
      '✗ paquet ABSENT — `dist/index.html` n’existe pas.\n' +
        '   Ce script mesure le PAQUET, jamais les sources. Construisez d’abord :\n' +
        '     npm run build',
    )
    process.exit(1)
  }

  const paquet = statSync(temoin).mtimeMs
  let plusRecente = null
  for (const entree of ENTREES) {
    const trouve = laPlusRecente(entree)
    if (trouve && (!plusRecente || trouve.quand > plusRecente.quand)) plusRecente = trouve
  }
  if (!plusRecente || plusRecente.quand <= paquet) return

  const quand = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
  console.error(
    '✗ paquet PÉRIMÉ — ce script mesurerait le code d’AVANT, en silence.\n' +
      `   source la plus récente   ${quand(plusRecente.quand)}   ${relative(RACINE, join(RACINE, plusRecente.chemin))}\n` +
      `   paquet construit le      ${quand(paquet)}   dist/index.html\n` +
      '\n' +
      '   C’est un faux VERT, et il se croit là où un rouge s’enquête : le\n' +
      '   2026-09-05, `modales` a rendu « 11 px, plafond 11 » sur une modale qui en\n' +
      '   demandait 82. Reconstruisez :\n' +
      '     npm run build',
  )
  process.exit(1)
}
