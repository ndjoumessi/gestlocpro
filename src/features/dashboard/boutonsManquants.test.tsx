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

describe('gestes atteignables sans le toast', () => {
  it('offre de chiffrer une intervention déclarée', async () => {
    const user = userEvent.setup()
    renderApp('/demo/travaux')
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
    renderApp('/demo/travaux')
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
    renderApp('/demo/travaux')
    await attendreLeChargement()

    // Aucun toast n'a été déclenché : le geste doit exister par lui-même.
    expect(screen.queryByRole('status')).not.toHaveTextContent(/annuler/i)
    expect(screen.getAllByRole('button', { name: /^rouvrir$/i }).length).toBeGreaterThan(0)
  })

  it('offre de retirer une validation, hors de tout message', async () => {
    renderApp('/demo/travaux')
    await attendreLeChargement()

    expect(
      screen.getAllByRole('button', { name: /retirer la validation/i }).length,
    ).toBeGreaterThan(0)
  })

  it('ne propose ni chiffrage ni réouverture au locataire', async () => {
    renderApp('/demo/travaux')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: /^chiffrer$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^rouvrir$/i })).not.toBeInTheDocument()
  })
})

describe('défaire un arbitrage de caution, hors du toast', () => {
  it('offre le geste sur une caution déjà arbitrée', async () => {
    const user = userEvent.setup()
    renderApp('/demo/cautions')
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
