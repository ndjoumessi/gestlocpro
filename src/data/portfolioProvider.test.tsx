import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * Propagation de l'état partagé.
 *
 * Chaque écran gardait sa propre copie des travaux, des cautions et des unités.
 * Valider un devis laissait donc le tableau de bord réclamer la même décision
 * dans sa carte « Ce qui demande une décision » — le propriétaire venait de
 * trancher et l'accueil lui redemandait de trancher.
 *
 * Ces tests naviguent d'un écran à l'autre **sans remonter l'application** :
 * c'est la seule façon de vérifier que l'état circule. Recharger masquerait le
 * défaut en réinitialisant tout depuis les constantes.
 */

/** Change d'écran par la barre latérale, comme le ferait l'utilisateur. */
async function allerA(nom: RegExp) {
  const user = userEvent.setup()
  const liens = screen.getAllByRole('link', { name: nom })
  await user.click(liens[0])
}

describe('validation d’un devis', () => {
  it('retire l’arbitrage de la carte du tableau de bord', async () => {
    const user = userEvent.setup()
    renderApp('/app')

    // Le tableau de bord réclame bien la décision au départ.
    expect(screen.getByRole('main')).toHaveTextContent('SIG-2026-042')

    await allerA(/^travaux/i)
    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    await allerA(/tableau de bord/i)
    expect(screen.getByRole('main')).not.toHaveTextContent('SIG-2026-042')
    expect(screen.getByRole('main')).toHaveTextContent('Rien à arbitrer pour le moment')
  })

  it('fait disparaître le bouton, puisqu’il n’y a plus rien à valider', async () => {
    const user = userEvent.setup()
    renderApp('/app/travaux')

    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    expect(screen.queryByRole('button', { name: /valider le devis/i })).not.toBeInTheDocument()
  })
})

describe('arbitrage d’une caution', () => {
  it('met à jour la ligne et les totaux', async () => {
    const user = userEvent.setup()
    renderApp('/app/cautions')

    const avant = screen.getAllByRole('button', { name: /^arbitrer$/i })
    expect(avant).toHaveLength(2)

    await user.click(avant[0])
    await user.clear(screen.getByLabelText(/montant retenu/i))
    await user.type(screen.getByLabelText(/montant retenu/i), '30000')
    await user.type(screen.getByLabelText(/justification/i), 'Réserves de l’état des lieux.')
    await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))

    // Une caution de moins à arbitrer, et le total retenu a bougé.
    expect(screen.getAllByRole('button', { name: /^arbitrer$/i })).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveTextContent('148')
  })

  it('refuse une retenue supérieure à la caution', async () => {
    const user = userEvent.setup()
    renderApp('/app/cautions')

    await user.click(screen.getAllByRole('button', { name: /^arbitrer$/i })[0])
    await user.clear(screen.getByLabelText(/montant retenu/i))
    await user.type(screen.getByLabelText(/montant retenu/i), '999999')
    await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))

    expect(screen.getByText(/ne peut pas dépasser la caution/i)).toBeInTheDocument()
  })

  it('refuse une retenue non justifiée', async () => {
    const user = userEvent.setup()
    renderApp('/app/cautions')

    await user.click(screen.getAllByRole('button', { name: /^arbitrer$/i })[0])
    await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))

    // Le locataire peut contester : un décompte sans motif est indéfendable.
    expect(screen.getByText(/Justifiez la retenue/i)).toBeInTheDocument()
  })
})

describe('création d’une fiche locataire', () => {
  it('occupe l’unité et se voit sur le parc et les paiements', async () => {
    const user = userEvent.setup()
    renderApp('/app/locataires')

    await user.click(screen.getByRole('button', { name: /créer une fiche locataire/i }))
    await user.type(screen.getByLabelText(/nom complet/i), 'Awa Diallo')
    await user.type(screen.getByLabelText(/^téléphone/i), '699445566')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    // Le bail démarre « En attente » : le loyer n'est pas encore dû.
    expect(screen.getByRole('main')).toHaveTextContent('Awa Diallo')
    expect(screen.getByRole('main')).toHaveTextContent('En attente')

    await allerA(/parc immobilier/i)
    expect(screen.getByRole('main')).toHaveTextContent('Awa Diallo')

    await allerA(/^paiements/i)
    expect(screen.getByRole('main')).toHaveTextContent('Awa Diallo')
  })

  it('refuse une fiche sans nom ni téléphone', async () => {
    const user = userEvent.setup()
    renderApp('/app/locataires')

    await user.click(screen.getByRole('button', { name: /créer une fiche locataire/i }))
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    // La modale n'annonçait « code d'invitation envoyé par SMS » qu'à condition
    // de ne rien vérifier : un SMS à un numéro vide, pour un locataire sans nom.
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
