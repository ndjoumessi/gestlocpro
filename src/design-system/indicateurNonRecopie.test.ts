import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * DANS L'APPLICATION, UN INDICATEUR EST `StatCard` — ET RIEN D'AUTRE.
 *
 * ═══ CE QUE LA RECOPIE COÛTE, ET CE N'EST PAS L'ESTHÉTIQUE ═══
 *
 * L'espace du locataire porte trois cartes qui RESSEMBLENT à un indicateur : un
 * surtitre en `eyebrow`, un grand nombre en `text-kpi`, une note grise dessous.
 * C'est la maquette de `StatCard`, recopiée à la main. Elles se voient pareil,
 * et elles ne SONT pas pareil :
 *
 *   · pas de `data-indicateur`. Or c'est ce marqueur, et lui seul, que les
 *     gardes interrogent — la rangée d'indicateurs, la comparaison au passé, le
 *     rognage des intitulés, « les écrans comptent à voix haute ». Le seul écran
 *     que le LOCATAIRE voit était donc invisible à toutes ;
 *   · pas de `data-intitule`, donc son libellé n'est pas mesuré au rognage ;
 *   · pas de tuile d'icône, pas de bordure d'état, pas de pastille de variation,
 *     pas de ligne de comparaison — quatre choses que la primitive sait faire et
 *     que la recopie devra réécrire une par une, ou ne fera jamais.
 *
 * ═══ LA VITRINE EST HORS DU CHAMP, ET C'EST UNE DÉCISION ═══
 *
 * `Hero`, `PricingSection` et `ValueProps` peignent aussi `text-kpi`. Ce ne sont
 * pas des indicateurs : ce sont des compositions de page d'accueil, avec leur
 * propre rythme, et `PricingSection` écrit d'ailleurs pourquoi elle emprunte ce
 * jeton — « pour prendre le rang qui leur revient ». Leur imposer une primitive
 * de tableau de bord y poserait une tuile d'icône et une bordure d'état dont
 * elles n'ont que faire.
 *
 * La frontière est donc le DOSSIER, pas le jeton : sous `features/dashboard/`,
 * un grand nombre est un indicateur du produit ; ailleurs, c'est de la
 * typographie.
 *
 * ═══ POURQUOI UNE GARDE DE SOURCE ═══
 *
 * Une recopie ne casse rien. Elle passe le rendu, le contraste, la géométrie —
 * elle ne se voit qu'en comparant deux fichiers, ce que personne ne fait. C'est
 * exactement la forme que `branchesMortes.test.ts` traque un cran plus loin : un
 * maillon qui existe et que rien n'appelle. Ici c'est l'inverse — un maillon
 * qu'on n'appelle pas et qu'on refait.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/**
 * Le jeton du grand nombre d'un indicateur.
 *
 * Assemblé plutôt qu'écrit en clair : Tailwind lit les fichiers de test comme du
 * texte et fabriquerait la classe citée. Le piège a déjà coûté une classe
 * fantôme dans le CSS livré — voir `graisses.test.ts`.
 */
const GRAND_NOMBRE = ['text', 'kpi'].join('-')

/** La primitive qui a le droit de le peindre. */
const PRIMITIVE = 'components/primitives/Charts.tsx'

function sources(dossier: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) sources(chemin, trouves)
    else if (/\.tsx$/.test(entree.name) && !entree.name.includes('.test.')) trouves.push(chemin)
  }
  return trouves
}

/** Les commentaires ont le droit de citer le jeton qu'ils expliquent. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('les cartes d’indicateur de l’application', () => {
  const ecrans = sources(join(SRC, 'features', 'dashboard'))

  /* GARDE DE LA GARDE — un dossier renommé viderait le balayage, et zéro
     fichier passeraient zéro contrôle en se déclarant verts. */
  it('sont cherchées dans une source non vide', () => {
    expect(ecrans.length, 'aucun écran d’application balayé').toBeGreaterThan(20)
  })

  /* GARDE DE LA GARDE — et la primitive doit VRAIMENT peindre ce jeton, sans
     quoi la règle interdirait une classe que plus personne n'emploie. */
  it('reposent sur une primitive qui peint bien ce jeton', () => {
    const primitive = readFileSync(join(SRC, PRIMITIVE), 'utf8')
    expect(primitive, 'la primitive ne peint plus le grand nombre').toContain(GRAND_NOMBRE)
  })

  it('ne sont jamais recopiées à la main', () => {
    const fautifs = ecrans
      .filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes(GRAND_NOMBRE))
      .map((f) => f.replace(SRC + '/', ''))

    expect(
      fautifs,
      'ces écrans peignent un grand nombre sans passer par `StatCard` — donc sans ' +
        '`data-indicateur`, et invisibles à toutes les gardes qui l’interrogent',
    ).toEqual([])
  })
})
