/**
 * L'EMPREINTE DES SOURCES DE RENDU — des données, et AUCUN effet de bord.
 *
 * ═══ POURQUOI CE FICHIER EXISTE SÉPARÉMENT ═══
 *
 * `sceau-colonne-normale.mjs` ÉCRIT le sceau au niveau supérieur : c'est un
 * script, pas une bibliothèque. La première rédaction faisait importer ce
 * script par `check-sceau-colonne-normale.mjs` pour y prendre l'empreinte —
 * et l'import exécutait le scellement.
 *
 * LA VÉRIFICATION REPOSAIT DONC LE SCEAU QU'ELLE VÉRIFIAIT. Elle ne pouvait pas
 * rougir : elle comparait l'empreinte à une empreinte qu'elle venait d'écrire.
 * Trouvé à la première exécution — la sortie du scelleur s'imprimait au milieu
 * de celle du vérificateur — et non par relecture.
 *
 * C'est le piège que ce dépôt nomme « une garde d'accord avec elle-même », et
 * il a été trouvé quatre fois ailleurs sous une autre forme : un compte dérivé
 * de ce qu'il compte. Ici c'était un sceau dérivé de ce qu'il scelle.
 *
 * Ce module ne contient donc que des fonctions. Aucun des deux scripts ne peut
 * déclencher l'autre.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
export const CHEMIN_DU_SCEAU = 'scripts/colonne-normale.sceau.json'

/**
 * LES SOURCES QUI PEUVENT CHANGER UNE HAUTEUR.
 *
 * `src/` sans ses cas — un fichier de test ne rend rien —, la page d'entrée, et
 * les POLICES : un fichier de fonte change les chasses, donc les hauteurs, sans
 * qu'une seule ligne de composant ne bouge.
 */
const RACINES = ['src', 'public/polices', 'index.html']
const EXCLUS = /\.test\.[tj]sx?$|^src\/test\//

function fichiersDeRendu() {
  const trouves = []
  const descendre = (chemin) => {
    const absolu = join(RACINE, chemin)
    let etat
    try {
      etat = statSync(absolu)
    } catch {
      return /* une racine absente n'est pas une erreur : le dépôt peut bouger */
    }
    if (etat.isFile()) {
      if (!EXCLUS.test(chemin)) trouves.push(chemin)
      return
    }
    for (const entree of readdirSync(absolu).sort()) descendre(join(chemin, entree))
  }
  for (const r of RACINES) descendre(r)
  return trouves.sort()
}

/**
 * L'empreinte des sources de rendu.
 *
 * Le CHEMIN entre dans le condensat autant que le contenu : deux fichiers qui
 * échangeraient leur nom changent le rendu sans changer la somme des octets.
 */
export function empreinteDesSources() {
  const h = createHash('sha256')
  const fichiers = fichiersDeRendu()
  for (const chemin of fichiers) {
    h.update(relative(RACINE, join(RACINE, chemin)))
    h.update('\0')
    h.update(readFileSync(join(RACINE, chemin)))
    h.update('\0')
  }
  return { empreinte: h.digest('hex'), fichiers: fichiers.length }
}
