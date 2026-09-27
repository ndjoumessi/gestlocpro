import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { MiniBarChart } from './MiniBarChart'

/**
 * LA LECTURE D'UN PETIT GRAPHE N'AVAIT PAS LA PLACE DE S'ÉCRIRE.
 *
 * ═══ CE QUE LA MESURE A DIT, ET POURQUOI ELLE SEULE POUVAIT LE DIRE ═══
 *
 * La rangée sous le graphe porte trois choses : le premier mois de la série, la
 * valeur de la colonne visée, le dernier mois. Les deux repères prenaient leur
 * largeur intrinsèque — `eyebrow`, donc sans retour à la ligne — et la lecture
 * se contentait du reste, sans même un `flex-1` pour réclamer sa part.
 *
 * Relevé au navigateur à 320 px, racine 22 px — la colonne que ce dépôt
 * reproduit —, colonne du milieu visée au clavier, AVANT :
 *
 *   /                 91 px offerts pour 189 demandés  « Apr 1 306 000 FCFA »
 *   /demo/portail      0 px offerts pour 104 demandés  « Mar 17 m³ »
 *   /demo/portail      0 px offerts pour 132 demandés  « Mar 192 kWh »
 *
 * Sur la vitrine, le montant était COUPÉ EN DEUX par l'ellipse. Sur l'espace du
 * locataire, la case valait ZÉRO : le relevé qu'on venait de toucher ne
 * s'affichait NULLE PART. C'est la promesse même de ce bloc — « la valeur
 * s'inscrit toujours au même endroit » — et elle ne tenait pas à la largeur du
 * marché visé.
 *
 * APRÈS, aux mêmes points : 208/208, 118/118, 118/132. Les deux premiers
 * tiennent entiers ; le troisième passe de rien à presque tout, et ses 14 px
 * manquants ne sont plus une affaire de cette rangée mais de la largeur de sa
 * carte — deux graphes de douze colonnes côte à côte dans 118 px, ce qui est un
 * autre lot.
 *
 * ═══ CE QUE CE FICHIER PEUT TENIR ═══
 *
 * Pas la géométrie : jsdom ne calcule aucune mise en page, toute boîte y vaut
 * zéro. Il tient le MÉCANISME qui la produit — les deux repères quittent la
 * rangée pendant qu'on lit une colonne, et reviennent quand le doigt part.
 * C'est ce mécanisme qui a rendu les pixels ci-dessus.
 */

const BARRES = [
  { key: '2026-01', label: 'jan', value: 12 },
  { key: '2026-02', label: 'fév', value: 19 },
  { key: '2026-03', label: 'mar', value: 7 },
]

function lire(v: number) {
  return `${v} m³`
}

function rangeeDeLecture(container: HTMLElement) {
  const region = container.querySelector('[aria-live="polite"]')
  if (!region?.parentElement) throw new Error('aucune rangée de lecture')
  return { region, rangee: region.parentElement }
}

describe('la lecture d’un petit graphe', () => {
  it('montre les deux repères au repos', () => {
    const { container } = renderWithProviders(
      <MiniBarChart bars={BARRES} caption="Consommation d’eau" format={lire} />,
    )
    const { rangee } = rangeeDeLecture(container)

    /* LEUR RAISON D'ÊTRE VAUT AU REPOS, et c'est le moment où ils sont là :
       « sans eux, la seule façon de savoir de quel mois on parlait était de
       survoler ». Le premier et le dernier mois de la série, donc, encadrant une
       case encore vide. */
    expect(rangee.children.length, 'les repères ont disparu du repos').toBe(3)
    expect(rangee.textContent, 'les repères ne nomment plus les bornes').toContain('jan')
    expect(rangee.textContent).toContain('mar')
  })

  it('leur fait céder la rangée entière pendant qu’on lit une colonne', async () => {
    const utilisateur = userEvent.setup()
    const { container } = renderWithProviders(
      <MiniBarChart bars={BARRES} caption="Consommation d’eau" format={lire} />,
    )
    const { region, rangee } = rangeeDeLecture(container)

    await utilisateur.hover(screen.getAllByRole('button')[1])

    /* ON NE LIT JAMAIS LES DEUX À LA FOIS. Les repères disent où la série
       COMMENCE et FINIT ; la lecture dit quel mois on TOUCHE, et elle porte déjà
       son propre libellé. Les garder pendant ce temps-là, c'est payer deux fois
       pour la même question — et c'est ce qui laissait 0 px à la réponse. */
    expect(rangee.children.length, 'les repères occupent encore la rangée').toBe(1)
    expect(region.textContent, 'la case ne lit pas la colonne visée').toContain('19 m³')
  })

  it('leur rend la rangée dès que le doigt part', async () => {
    const utilisateur = userEvent.setup()
    const { container } = renderWithProviders(
      <MiniBarChart bars={BARRES} caption="Consommation d’eau" format={lire} />,
    )
    const { rangee } = rangeeDeLecture(container)

    const colonne = screen.getAllByRole('button')[1]
    await utilisateur.hover(colonne)
    await utilisateur.unhover(colonne)

    expect(rangee.children.length, 'les repères ne reviennent pas').toBe(3)
  })

  it('réclame sa part de la rangée au lieu de se dimensionner à son contenu', () => {
    const { container } = renderWithProviders(
      <MiniBarChart bars={BARRES} caption="Consommation d’eau" format={lire} />,
    )
    const { region } = rangeeDeLecture(container)

    /* `flex-1` EST LA SECONDE MOITIÉ DU CORRECTIF, et il manquait. Sans lui, la
       case se dimensionnait à son CONTENU et n'obtenait la rangée entière que par
       accident ; avec `min-w-0`, elle prend ce qui reste et l'ellipse ne
       s'applique qu'au-delà. jsdom ne mesure pas, mais il lit la classe — et
       c'est elle qui a fait passer la vitrine de 91 px offerts à 208. */
    expect(region.className, 'la case ne réclame pas la place restante').toMatch(/flex-1/)
    expect(region.className, 'la case ne peut pas se réduire sous son contenu').toMatch(/min-w-0/)
  })
})
