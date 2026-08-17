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

    /**
     * La carte ne se VIDE pas pour autant, et c'est le correctif :
     * « ce qui demande une décision » listait les seuls devis de travaux et
     * taisait les cautions à arbitrer — la prérogative qui définit pourtant le
     * propriétaire. Deux attendent dans le jeu de démonstration. L'état vide
     * ment tant qu'il en reste une.
     */
    expect(screen.getByRole('main')).not.toHaveTextContent('Rien à arbitrer pour le moment')
    expect(screen.getByRole('main')).toHaveTextContent('Caution à arbitrer · Serge Mbarga')
  })

  it('ne montre l’état vide qu’une fois les DEUX natures traitées', async () => {
    const user = userEvent.setup()
    renderApp('/app/travaux')
    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    // Les deux cautions en attente sont arbitrées à leur tour. La liste se
    // recompose après chaque arbitrage : on la relit plutôt que de garder des
    // références devenues caduques.
    await allerA(/^cautions/i)
    while (screen.queryAllByRole('button', { name: /^arbitrer$/i }).length > 0) {
      await user.click(screen.getAllByRole('button', { name: /^arbitrer$/i })[0])
      await user.type(screen.getByLabelText(/justification/i), 'Réserves de l’état des lieux.')
      await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))
    }

    await allerA(/tableau de bord/i)
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

/**
 * Enregistrement local du parcours.
 *
 * Deux défauts sont passés sous les tests précédents et n'ont été vus qu'en
 * navigateur : l'application écrivait dès l'ouverture, et le bouton d'effacement
 * réécrivait aussitôt ce qu'il venait d'effacer. Tous deux tiennent à la même
 * chose — savoir si l'état a réellement été modifié — d'où ces trois cas.
 */
describe('parcours enregistré', () => {
  const CLE = 'gestlocpro.portfolio'

  it('n’écrit rien tant que rien n’a été modifié', () => {
    renderApp('/app/systeme')

    expect(window.localStorage.getItem(CLE)).toBeNull()
    // La carte explique le mécanisme dans tous les cas ; c'est le bouton qui
    // n'a pas lieu d'être, puisqu'il n'y a rien à effacer.
    expect(screen.getByText(/Rien n’a encore été modifié/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /repartir du jeu de démonstration/i }),
    ).not.toBeInTheDocument()
  })

  it('enregistre dès la première modification', async () => {
    const user = userEvent.setup()
    renderApp('/app/travaux')

    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    const enregistre = JSON.parse(window.localStorage.getItem(CLE) ?? 'null')
    expect(enregistre.etat.works.find((w: { id: string }) => w.id === 'SIG-2026-042').status).toBe(
      'approved',
    )
  })

  it('efface sur demande, et n’enregistre pas de nouveau dans la foulée', async () => {
    const user = userEvent.setup()
    renderApp('/app/travaux')

    await user.click(screen.getByRole('button', { name: /valider le devis/i }))
    await allerA(/états du système/i)
    await user.click(screen.getByRole('button', { name: /repartir du jeu de démonstration/i }))

    expect(window.localStorage.getItem(CLE)).toBeNull()
    expect(
      screen.queryByRole('button', { name: /repartir du jeu de démonstration/i }),
    ).not.toBeInTheDocument()

    // Et le devis est bien redevenu à arbitrer.
    await allerA(/^travaux/i)
    expect(screen.getByRole('button', { name: /valider le devis/i })).toBeInTheDocument()
  })
})
