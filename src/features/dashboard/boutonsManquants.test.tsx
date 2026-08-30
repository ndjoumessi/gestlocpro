import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, userEvent, within, attendreLeChargement } from '@/test/render'

/**
 * Les gestes atteignables SANS le message de confirmation.
 *
 * Trois capacités livrées côté serveur n'existaient à l'écran que comme action
 * du toast — qui s'efface au bout de quatre secondes et demie. J'avais pourtant
 * écrit, en livrant la première, qu'« une fenêtre qui expire en silence
 * enseigne un filet qui n'existe pas ». Le filet était permanent dans l'API et
 * introuvable dans le produit passé le délai.
 *
 * Une quatrième — chiffrer un devis — n'avait aucun bouton du tout : la route
 * et la méthode du fournisseur existaient, rien ne les appelait. C'est le
 * deuxième maillon de la chaîne que le sous-titre de l'écran annonce lui-même,
 * « le locataire signale, le gestionnaire chiffre, le propriétaire arbitre ».
 *
 * Ces cas interrogent donc l'écran AU REPOS, sans qu'aucun toast soit ouvert.
 */

/**
 * UN GESTE, QU'IL SOIT SOUS LES YEUX OU REPLIÉ.
 *
 * Ces cas tiennent une règle d'EXISTENCE — « le geste existe par lui-même, hors
 * de tout message » —, pas une règle de forme. Trois d'entre eux vivent
 * désormais derrière les trois points d'une carte : ils portent `menuitem` et
 * non `button`, ce qui ne change rien à ce que le cas veut dire.
 *
 * Les entrées d'un menu fermé ne sont pas rendues : on ouvre donc tous les
 * déclencheurs de la zone principale avant de compter. C'est le geste de
 * l'utilisateur qui cherche ce qu'une ligne lui permet.
 */
async function geste(nom: RegExp): Promise<HTMLElement[]> {
  /* `userEvent` et non `element.click()` : un clic brut hors d'`act` laisse la
     mise à jour de React non appliquée, et la requête qui suit lit un DOM
     d'avant l'ouverture. Le cas rougissait alors sur un menu bel et bien
     rempli. */
  const user = userEvent.setup()
  const trouves = [...screen.queryAllByRole('button', { name: nom })]

  /*
    UN MENU À LA FOIS, ET ON REFERME.

    Les ouvrir tous d'affilée ne marche pas : le clic sur le second déclencheur
    est un clic EXTÉRIEUR pour le premier menu, qui se referme aussitôt. Seul le
    dernier restait ouvert, et le cas concluait que « Rouvrir » n'existait
    nulle part — sur un écran qui le portait.
  */
  for (const d of Array.from(document.querySelectorAll('main [aria-haspopup="menu"]'))) {
    await user.click(d as HTMLElement)
    trouves.push(...screen.queryAllByRole('menuitem', { name: nom }))
    await user.keyboard('{Escape}')
  }
  return trouves
}

describe('gestes atteignables sans le toast', () => {
  it('offre de chiffrer une intervention déclarée', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/travaux')
    await attendreLeChargement()

    const avant = screen.queryAllByText('Devis proposé').length
    await user.click(screen.getAllByRole('button', { name: /^chiffrer$/i })[0]!)

    const dialogue = screen.getByRole('dialog')
    await user.type(within(dialogue).getByRole('textbox'), '42000')
    await user.click(within(dialogue).getByRole('button', { name: /confirmer/i }))

    // Le travail passe à « devis proposé » : c'est le propriétaire qui
    // arbitrera. Le gestionnaire propose, il ne décide pas.
    expect(screen.queryAllByText('Devis proposé')).toHaveLength(avant + 1)
  })

  it('refuse un devis sans montant, et n’appelle rien', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/travaux')
    await attendreLeChargement()

    const avant = screen.queryAllByText('Devis proposé').length
    await user.click(screen.getAllByRole('button', { name: /^chiffrer$/i })[0]!)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /confirmer/i }),
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryAllByText('Devis proposé')).toHaveLength(avant)
  })

  it('offre de rouvrir un travail terminé, hors de tout message', async () => {
    await renderApp('/demo/travaux')
    await attendreLeChargement()

    // Aucun toast n'a été déclenché : le geste doit exister par lui-même.
    expect(screen.queryByRole('status')).not.toHaveTextContent(/annuler/i)
    expect((await geste(/^rouvrir$/i)).length).toBeGreaterThan(0)
  })

  it('offre de retirer une validation, hors de tout message', async () => {
    await renderApp('/demo/travaux')
    await attendreLeChargement()

    expect((await geste(/retirer la validation/i)).length).toBeGreaterThan(0)
  })

  it('ne propose ni chiffrage ni réouverture au locataire', async () => {
    await renderApp('/demo/travaux')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: /^chiffrer$/i })).not.toBeInTheDocument()
    expect(await geste(/^rouvrir$/i)).toHaveLength(0)
    /*
      ET AUCUN MENU NON PLUS, ce qui dit plus que l'absence d'un bouton.

      Les trois gestes repliés — répondre, retirer une validation, rouvrir —
      sont tous réservés au bailleur ou au gestionnaire. Sur les cartes d'un
      locataire, le menu n'a donc rien à porter, et il ne se rend pas : c'est
      exactement ce que `MenuDeDebordement` promet quand ses enfants sont tous
      absents. Vérifier l'absence du DÉCLENCHEUR est plus fort que vérifier
      l'absence d'un libellé : un menu fermé ne rend pas ses entrées, donc un
      `queryByRole` seul passerait au vert sur un menu plein.
    */
    expect(document.querySelectorAll('main [aria-haspopup="menu"]')).toHaveLength(0)
  })
})

describe('défaire un arbitrage de caution, hors du toast', () => {
  it('offre le geste sur une caution déjà arbitrée', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    // Une caution est arbitrée par le test lui-même : la démonstration n'en
    // porte pas forcément une, et un garde qui dépendrait du jeu semé
    // s'éteindrait le jour où celui-ci change.
    await user.click(screen.getAllByRole('button', { name: /^arbitrer$/i })[0]!)
    await user.type(screen.getByLabelText(/justification/i), 'Réserves de l’état des lieux.')
    await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))

    const defaire = screen.getAllByRole('button', { name: /défaire l’arbitrage/i })
    expect(defaire.length).toBeGreaterThan(0)

    await user.click(defaire[0]!)
    expect(await screen.findByText(/arbitrage défait/i)).toBeInTheDocument()
  })
})
