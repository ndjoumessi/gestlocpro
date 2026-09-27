import { describe, expect, it } from 'vitest'
import { indexCible, ordreReconcilie } from './ordreDuRail'

/**
 * LA GÉOMÉTRIE DU RAIL, SORTIE DU COMPOSANT POUR ÊTRE MESURABLE.
 *
 * Réordonner des fiches à la souris est un calcul de POSITIONS : où le curseur
 * tombe-t-il par rapport aux fiches en place. Or jsdom ne fait aucune mise en
 * page — tous les rectangles y valent zéro —, donc ce calcul est exactement la
 * partie qu'un test de rendu ne peut pas juger. Laissé dans le composant, il
 * serait couvert par rien.
 *
 * Il vit donc dans une fonction pure, qui prend des nombres et rend un index.
 * Le composant lui passe de vrais rectangles ; ces cas lui passent des nombres
 * choisis. Ce que ça N'ÉPROUVE PAS : que le composant lise les bons rectangles,
 * ni qu'il les relise quand le rail défile. Cela se regarde à l'écran.
 */
describe('l’index d’arrivée', () => {
  /** Trois fiches de 200 px, côte à côte : centres à 100, 300, 500. */
  const CENTRES = [100, 300, 500]

  it('tombe sur la fiche dont on a dépassé le centre', () => {
    expect(indexCible(CENTRES, 350)).toBe(2)
    expect(indexCible(CENTRES, 250)).toBe(1)
  })

  it('ne sort pas du rail par la gauche', () => {
    /* Le curseur peut passer AVANT la première fiche — on tire vers le bord.
       Sans bornage, l'index deviendrait négatif et l'ordre se casserait. */
    expect(indexCible(CENTRES, -400)).toBe(0)
  })

  it('ne sort pas du rail par la droite', () => {
    expect(indexCible(CENTRES, 9000)).toBe(2)
  })

  it('rend zéro quand il n’y a rien à ranger', () => {
    /* Un immeuble sans logement : la garde du garde de cette fonction. Sans ce
       cas, un `Math.max` sur un tableau vide rendrait `-Infinity` en silence. */
    expect(indexCible([], 120)).toBe(0)
  })
})

/**
 * L'ORDRE RETENU SURVIT AUX MOUVEMENTS DU PARC.
 *
 * L'ordre ne se persiste pas — c'est la décision du lot — mais il vit le temps
 * de la visite, et pendant ce temps le parc bouge : on attribue un locataire, on
 * ajoute un logement, on en retire un. Un ordre gardé tel quel montrerait alors
 * des fiches disparues et cacherait les neuves.
 */
describe('la réconciliation de l’ordre', () => {
  it('garde l’ordre choisi pour ce qui existe encore', () => {
    expect(ordreReconcilie(['C', 'A', 'B'], ['A', 'B', 'C'])).toEqual(['C', 'A', 'B'])
  })

  it('laisse tomber ce qui n’existe plus', () => {
    expect(ordreReconcilie(['C', 'A', 'B'], ['A', 'C'])).toEqual(['C', 'A'])
  })

  it('ajoute les nouvelles à la fin, et le dit', () => {
    /* À LA FIN, ET NON À LEUR PLACE NATURELLE. Un logement neuf n'a pas de
       place dans un ordre que quelqu'un vient de composer à la main : l'insérer
       au milieu déplacerait ce qu'on venait de ranger. Il se montre au bout,
       visible, et le rechargement rend de toute façon l'ordre du parc. */
    expect(ordreReconcilie(['C', 'A'], ['A', 'B', 'C', 'D'])).toEqual(['C', 'A', 'B', 'D'])
  })

  it('part de l’ordre du parc quand rien n’a été rangé', () => {
    expect(ordreReconcilie([], ['A', 'B', 'C'])).toEqual(['A', 'B', 'C'])
  })
})
