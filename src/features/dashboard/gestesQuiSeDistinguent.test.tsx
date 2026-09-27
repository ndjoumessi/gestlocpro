import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * DIX BOUTONS DU MÊME NOM DANS UNE MÊME LISTE.
 *
 * ═══ LA RÈGLE ÉTAIT ÉCRITE DEUX FOIS, GARDÉE NULLE PART ═══
 *
 *   « douze boutons "Corriger" à la suite ne disent pas lequel on active »
 *     — `Meters.tsx`, colonne de geste
 *   « "A1" seul, dans une liste de dix liens, ne dit pas où l'on va »
 *     — `Portfolio.tsx`, lien de logement
 *
 * Deux écrans l'appliquaient. Relevé au navigateur sur la démonstration, quatre
 * ne l'appliquaient pas :
 *
 *   /demo/paiements    10 × « Quittance », 3 × « Mettre en demeure »
 *   /demo/locataires   10 × « Dossier »
 *   /demo/acces         4 × « Retirer l’accès »
 *   /demo/documents     6 × « Télécharger »
 *
 * Les deux gestes les plus lourds du produit en faisaient partie : la mise en
 * demeure, et le retrait de l'accès de quelqu'un. On atteint ces boutons l'un
 * après l'autre à la tabulation, et rien n'est prononcé entre eux — le nom est la
 * seule chose qui les sépare.
 *
 * LE LIBELLÉ VISIBLE NE CHANGE PAS. Il garde son mot court, qui est juste dans une
 * colonne étroite ; c'est `aria-label` qui reçoit le complément. Ces cas tiennent
 * donc les deux moitiés : le nom accessible distingue, le texte affiché non.
 *
 * ═══ CE QUE CES CAS AJOUTENT À LA PORTE ═══
 *
 * `mesure-ui` refuse désormais trois commandes homonymes dans une même liste, sur
 * les vingt-neuf écrans et les deux langues — c'est la garde qui empêche le
 * cinquième écran. Ceux-ci nomment les QUATRE cas trouvés, écran par écran : une
 * porte qui compte dit qu'il y a un défaut, elle ne dit pas lequel a été corrigé.
 */

/** Les noms accessibles des commandes d'une liste ou d'un tableau. */
function nomsDesGestes(groupe: HTMLElement, motif: RegExp) {
  const dedans = within(groupe)
  return [...dedans.queryAllByRole('button'), ...dedans.queryAllByRole('link')]
    .map((c) => c.getAttribute('aria-label') ?? c.textContent ?? '')
    .filter((n) => motif.test(n))
}

/** Aucun nom n'est porté deux fois — et il y en a bien plusieurs à comparer. */
function tousDistincts(noms: string[], attendus: number) {
  expect(noms.length, 'les gestes attendus ne sont pas rendus').toBeGreaterThanOrEqual(attendus)
  expect(new Set(noms).size, `« ${noms[0]} » est porté par plusieurs gestes`).toBe(noms.length)
}

describe('les gestes d’une liste se distinguent par leur nom', () => {
  it('nomme chaque quittance et chaque mise en demeure par son logement', async () => {
    await renderApp('/demo/paiements')
    await attendreLeChargement()
    const principal = screen.getByRole('main')

    /* LES DEUX GESTES DE LA MÊME COLONNE. La mise en demeure ne s'offre que sur
       un retard, la quittance sur tout logement loué : les deux populations
       diffèrent, et les deux étaient homonymes chacune de son côté. */
    tousDistincts(nomsDesGestes(principal, /quittance/i), 3)
    tousDistincts(nomsDesGestes(principal, /demeure/i), 2)
  })

  it('garde le mot court à l’écran', async () => {
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    /* LE COMPLÉMENT NE SE VOIT PAS. Écrire « Quittance — A1 » dans une colonne de
       tableau la ferait enfler de la largeur du libellé le plus long, et le
       logement est déjà la première colonne de la ligne. Seule la voix le reçoit. */
    const boutons = within(screen.getByRole('main'))
      .getAllByRole('button', { name: /quittance/i })
      .filter((b) => (b.getAttribute('aria-label') ?? '').length > 0)
    expect(boutons.length, 'aucun bouton de quittance nommé').toBeGreaterThan(0)
    for (const bouton of boutons) {
      expect(bouton.textContent?.trim(), 'le libellé visible a gagné le complément').toMatch(
        /^Quittance$/,
      )
    }
  })

  it('nomme chaque dossier de locataire par son logement', async () => {
    await renderApp('/demo/locataires')
    await attendreLeChargement()

    /* SON VOISIN L'AVAIT DÉJÀ : le bouton « Relancer » de la même carte porte le
       nom du locataire depuis un lot antérieur, et celui-ci ne portait rien. */
    tousDistincts(nomsDesGestes(screen.getByRole('main'), /dossier/i), 3)
  })

  it('nomme chaque retrait d’accès par la personne', async () => {
    await renderApp('/demo/acces')
    await attendreLeChargement()

    /* LE GESTE OÙ L'HOMONYMIE COÛTE LE PLUS CHER : quatre boutons identiques, et
       celui qu'on active retire l'accès de quelqu'un. La boîte de confirmation
       nommait déjà la personne ; le bouton, non. */
    tousDistincts(nomsDesGestes(screen.getByRole('main'), /retirer l’accès|remove/i), 3)
  })

  it('nomme chaque téléchargement de quittance par sa période', async () => {
    await renderApp('/demo/documents')
    await attendreLeChargement()

    /* LA PÉRIODE, et non le montant : c'est le mois qui identifie la quittance,
       le montant la qualifie. Six lignes, six boutons. */
    tousDistincts(nomsDesGestes(screen.getByRole('main'), /télécharger — |download — /i), 3)
  })
})
