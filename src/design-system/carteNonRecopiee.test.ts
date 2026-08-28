import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UN SQUELETTE DESSINE UNE CARTE EN APPELANT `Card`, PAS EN LA REDESSINANT.
 *
 * ═══ CE QUE LA RECOPIE COÛTE ICI, ET CE N'EST PAS L'APPARENCE ═══
 *
 * Cinq squelettes écrivaient la signature de la primitive en toutes lettres —
 * `rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5` — sur des
 * `<div>` nus. Elles étaient FIDÈLES au moment où on les a écrites : aucune ne
 * dérivait encore d'un pixel. Ce n'est pas ce qui est en cause.
 *
 * Ce qu'elles perdent est le MARQUEUR. `Card` pose `data-carte`, et ce marqueur
 * existe pour une raison précise : un squelette et la page qu'il annonce n'ont
 * en commun ni classe, ni texte, ni rôle, et il n'y avait donc aucun moyen de
 * dire « il en promet deux, il en rendra quatre ». `attenteFidele.test.tsx`
 * compte les cartes des deux côtés de l'attente — sur l'espace documents, il a
 * trouvé deux contre quatre. Un squelette qui redessine ses cartes à la main
 * reste INVISIBLE à ce compte : il n'est pas gardé, il est hors d'atteinte.
 *
 * Une divergence de classes finirait par se voir à l'œil ; un écran qui saute
 * de moitié à l'arrivée des données ne se voit qu'en attendant, et personne
 * n'attend sur sa propre machine.
 *
 * ═══ POURQUOI LA RÈGLE S'ARRÊTE AUX SQUELETTES DE `features/` ═══
 *
 * Elle ne dit rien du reste du dépôt, et c'est délibéré : plusieurs boîtes
 * portent cette allure sans être des cartes — le cadre défilant de `DataTable`,
 * les panneaux flottants du sélecteur de dates et du menu de réglages. Leur
 * imposer `Card` les coupleraient à une primitive dont elles n'ont ni le
 * rembourrage ni le rôle. Une garde qui refuse tout est désactivée dans la
 * semaine.
 *
 * `components/primitives/` est hors de portée pour une raison mesurée, et non
 * par commodité : `StatCard` REMPLACE la bordure de la carte selon son état —
 * `border-danger-border` là où `Card` pose `border-divider`. Or `cn` concatène,
 * il ne fusionne pas : les deux classes resteraient dans le balisage et c'est
 * l'ordre d'émission de la feuille qui trancherait. `SkeletonStatCard` reproduit
 * `StatCard`, `SkeletonTable` reproduit `DataTable` ; les trois disent pourquoi
 * dans leur propre en-tête.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')
const PORTEE = join(SRC, 'features')

function sources(depuis: string): string[] {
  const entrees: string[] = []
  for (const nom of readdirSync(depuis)) {
    const chemin = join(depuis, nom)
    if (statSync(chemin).isDirectory()) entrees.push(...sources(chemin))
    else if (/\.tsx$/.test(nom) && !/\.test\.tsx$/.test(nom)) entrees.push(chemin)
  }
  return entrees
}

/** Les commentaires ont le droit de citer ce qu'ils proscrivent. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/*
  ASSEMBLÉ PAR FRAGMENTS, comme dans les gardes voisines : Tailwind lit les
  fichiers de test comme des sources et fabriquerait pour de bon toute classe
  citée ici en clair. `graisses.test.ts` porte le récit de la classe fantôme que
  le dépôt a livrée pour cette raison.

  Le rayon ET l'ombre ET un fond de la famille des tons : il faut les trois, et
  chacune seule ne dit rien — le rayon est celui de tous les blocs arrondis,
  l'ombre celle de n'importe quel relief, le fond celui de n'importe quelle
  surface. C'est leur conjonction qui ne peut vouloir dire qu'une chose.

  LE FOND EST UNE ALTERNATIVE, et c'est un correctif : la première rédaction ne
  connaissait que `bg-surface`. Elle laissait passer la carte du gestionnaire de
  l'espace locataire, peinte `bg-ink` à la main — la seule des six qui avait
  DÉJÀ dérivé, avec une bordure de séparateur et une ombre là où `Card
  tone="dark"` pose une bordure transparente et aucune ombre. La marque la plus
  étroite manquait le seul défaut réel.
*/
const RAYON_ET_OMBRE = ['rounded-' + 'lg', 'shadow-' + 'e1']
const FONDS = ['bg-' + 'surface', 'bg-' + 'ink']

/**
 * Le corps réuni des fonctions `…Skeleton` d'un fichier, ou `null`. Découpé à
 * l'accolade appariée : un découpage à la ligne vide ramasserait la suite.
 * Même procédé que `squelettesFideles.test.ts`, et pour la même raison.
 */
function corpsDesFonctionsDAttente(source: string): string | null {
  const corps: string[] = []
  for (const debut of source.matchAll(/function \w*Skeleton\w*\s*\(/g)) {
    const ouvrante = source.indexOf('{', debut.index)
    if (ouvrante === -1) continue
    let profondeur = 0
    for (let i = ouvrante; i < source.length; i++) {
      if (source[i] === '{') profondeur++
      else if (source[i] === '}' && --profondeur === 0) {
        corps.push(source.slice(ouvrante, i))
        break
      }
    }
  }
  return corps.length ? corps.join('\n') : null
}

/** Les littéraux de classe qui portent les trois marques d'une carte. */
function cartesDessinees(portion: string): string[] {
  const trouvees: string[] = []
  for (const litteral of portion.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
    const classes = litteral[1]
    const estUneCarte =
      RAYON_ET_OMBRE.every((marque) => classes.includes(marque)) &&
      FONDS.some((fond) => classes.includes(fond))
    if (estUneCarte) trouvees.push(classes)
  }
  return trouvees
}

describe('les cartes d’un squelette', () => {
  const fichiers = sources(PORTEE)

  it('sont cherchées dans une source non vide', () => {
    // GARDE DE LA GARDE — un balayage vide passerait vert sans rien lire.
    expect(fichiers.length, 'aucun écran balayé').toBeGreaterThan(20)
    const avecAttente = fichiers.filter(
      (f) => corpsDesFonctionsDAttente(sansCommentaires(readFileSync(f, 'utf8'))) !== null,
    )
    // Le motif de découpage est le point fragile : cassé, il ne trouverait plus
    // une seule fonction d'attente et la liste des fautives serait vide pour la
    // pire des raisons.
    expect(avecAttente.length, 'aucune fonction d’attente reconnue').toBeGreaterThanOrEqual(6)
  })

  it('viennent de la primitive, et portent donc son marqueur', () => {
    const fautifs: string[] = []
    for (const chemin of fichiers) {
      const attente = corpsDesFonctionsDAttente(sansCommentaires(readFileSync(chemin, 'utf8')))
      if (attente === null) continue
      for (const classes of cartesDessinees(attente))
        fautifs.push(`${relative(SRC, chemin)} : « ${classes} »`)
    }

    expect(
      fautifs,
      'ces squelettes redessinent `Card` au lieu de l’appeler — sans `data-carte`, ' +
        'aucune garde ne peut comparer ce qu’ils annoncent à ce que l’écran rendra',
    ).toEqual([])
  })
})
