import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, attendreLeChargement } from '@/test/render'

/**
 * Propagation de l'état partagé.
 *
 * Chaque écran gardait sa propre copie des travaux, des cautions et des unités.
 * Valider un devis laissait donc le tableau de bord réclamer la même décision
 * — le propriétaire venait de trancher et l'accueil lui redemandait de trancher.
 *
 * CE QUE CES CAS OBSERVENT A CHANGÉ DE FORME, PAS DE NATURE. Ils lisaient la
 * carte « ce qui demande une décision » ; elle a disparu, remplacée par la FILE
 * DU JOUR qui ouvre désormais l'écran. La propriété gardée est la même, et elle
 * est la seule qui compte : un travail traité DISPARAÎT de l'accueil, et
 * l'accueil ne se déclare tranquille qu'une fois les DEUX natures traitées.
 *
 * Ils visent `[data-file-entree]` plutôt qu'un texte de carte : la file marque
 * ses lignes, et un cas qui lirait un intitulé rougirait à la première
 * reformulation sans qu'aucun défaut n'existe.
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
  it('retire le devis de la file du jour une fois validé', async () => {
    const user = userEvent.setup()
    await renderApp('/app')

    // L'accueil réclame bien la décision au départ.
    expect(document.querySelector('[data-file-entree="devis"]')).not.toBeNull()

    await allerA(/^travaux/i)
    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    await allerA(/tableau de bord/i)
    expect(
      document.querySelector('[data-file-entree="devis"]'),
      'le devis validé réclame encore une décision',
    ).toBeNull()

    /**
     * La file ne se VIDE pas pour autant, et c'est le correctif d'origine :
     * l'ancienne carte listait les seuls devis et taisait les cautions à
     * arbitrer — la prérogative qui définit pourtant le propriétaire. Deux
     * attendent dans le jeu de démonstration. L'état vide ment tant qu'il en
     * reste une.
     */
    expect(document.querySelector('[data-file-entree="cautions"]')).not.toBeNull()
    expect(screen.getByRole('main')).not.toHaveTextContent('Rien n’attend de vous')
  })

  it('ne montre l’état vide qu’une fois les DEUX natures traitées', async () => {
    const user = userEvent.setup()
    await renderApp('/app/travaux')
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
    /* Les DEUX natures traitées : plus une seule entrée d'arbitrage dans la
       file. Les impayés et les relevés manquants, eux, y restent — ils ne
       relèvent pas de l'arbitrage, et les confondre ferait passer ce cas pour
       une garde de la file entière alors qu'il ne garde que la propagation. */
    expect(document.querySelector('[data-file-entree="devis"]')).toBeNull()
    expect(document.querySelector('[data-file-entree="cautions"]')).toBeNull()
  })

  it('fait disparaître le bouton, puisqu’il n’y a plus rien à valider', async () => {
    const user = userEvent.setup()
    await renderApp('/app/travaux')

    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    expect(screen.queryByRole('button', { name: /valider le devis/i })).not.toBeInTheDocument()
  })
})

describe('arbitrage d’une caution', () => {
  it('met à jour la ligne et les totaux', async () => {
    const user = userEvent.setup()
    await renderApp('/app/cautions')

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
    await renderApp('/app/cautions')

    await user.click(screen.getAllByRole('button', { name: /^arbitrer$/i })[0])
    await user.clear(screen.getByLabelText(/montant retenu/i))
    await user.type(screen.getByLabelText(/montant retenu/i), '999999')
    await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))

    expect(screen.getByText(/ne peut pas dépasser la caution/i)).toBeInTheDocument()
  })

  it('refuse une retenue non justifiée', async () => {
    const user = userEvent.setup()
    await renderApp('/app/cautions')

    await user.click(screen.getAllByRole('button', { name: /^arbitrer$/i })[0])
    await user.click(screen.getByRole('button', { name: /valider l’arbitrage/i }))

    // Le locataire peut contester : un décompte sans motif est indéfendable.
    expect(screen.getByText(/Justifiez la retenue/i)).toBeInTheDocument()
  })
})

describe('création d’une fiche locataire', () => {
  it('occupe l’unité et se voit sur le parc et les paiements', async () => {
    const user = userEvent.setup()
    await renderApp('/app/locataires')

    await user.click(screen.getByRole('button', { name: /créer une fiche locataire/i }))
    await user.type(screen.getByLabelText(/nom complet/i), 'Awa Diallo')
    await user.type(screen.getByLabelText(/^téléphone/i), '699445566')
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    /* Le bail démarre « À ÉCHOIR » : le loyer est appelé, sa date n'est pas
       venue. Ce cas attendait « En attente », qui disait la même chose sans dire
       de quoi — et qui recouvrait AUSSI « aucune échéance appelée », désormais
       rendu « Non appelé ». Voir `loyerAppeleOuNon.test.ts`. */
    expect(screen.getByRole('main')).toHaveTextContent('Awa Diallo')
    expect(screen.getByRole('main')).toHaveTextContent('À échoir')

    await allerA(/parc immobilier/i)
    expect(screen.getByRole('main')).toHaveTextContent('Awa Diallo')

    await allerA(/^paiements/i)
    expect(screen.getByRole('main')).toHaveTextContent('Awa Diallo')
  })

  it('refuse une fiche sans nom ni téléphone', async () => {
    const user = userEvent.setup()
    await renderApp('/app/locataires')

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

  it('n’écrit rien tant que rien n’a été modifié', async () => {
    await renderApp('/demo/systeme')

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
    await renderApp('/app/travaux')

    await user.click(screen.getByRole('button', { name: /valider le devis/i }))

    const enregistre = JSON.parse(window.localStorage.getItem(CLE) ?? 'null')
    expect(enregistre.etat.works.find((w: { id: string }) => w.id === 'SIG-2026-042').status).toBe(
      'approved',
    )
  })

  it('efface sur demande, et n’enregistre pas de nouveau dans la foulée', async () => {
    const user = userEvent.setup()
    // Sous `/demo` : « Repartir du jeu de démonstration » est un bouton de
    // VITRINE, et « États du système » ne figure plus dans la navigation d'un
    // vrai compte — c'est tout l'objet du garde `vitrineHorsDemo.test.tsx`.
    await renderApp('/demo/travaux')
    await attendreLeChargement()

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
