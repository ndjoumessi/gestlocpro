import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { cleanup } from '@testing-library/react'
import { installerFauxServeur } from '@/test/api'
import { SESSION_ANONYME } from '@/test/render'

/**
 * La démonstration promise par la page d'accueil doit exister.
 *
 * Défaut signalé depuis le déploiement : « Parcourir la démonstration » menait à
 * `/connexion`, dont le titre est « Content de vous revoir ». Un visiteur qui
 * n'était jamais venu était accueilli par « content de vous revoir » et sommé de
 * se connecter pour voir ce qu'on lui proposait de regarder sans compte.
 *
 * La cause était une régression : le bouton visait `/app`, placé derrière
 * `RequireAuth` en branchant la vraie authentification, sans que cette entrée
 * soit reconsidérée. Aucun test ne partait de la page d'accueil pour suivre un
 * bouton — chacun montait directement l'écran qu'il examinait.
 */

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('parcourir la démonstration', () => {
  it('mène à l’application, et non à la page de connexion', async () => {
    // LE test qui manquait : il part d'où part le visiteur.
    installerFauxServeur({ authentifie: false })

    const user = userEvent.setup()
    await renderApp('/', { session: SESSION_ANONYME })
    await user.click(await screen.findByRole('link', { name: /parcourir la démonstration/i }))

    expect(await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })).toBeInTheDocument()
    expect(screen.queryByText(/content de vous revoir/i)).not.toBeInTheDocument()
  })

  it('annonce que les données sont fictives', async () => {
    // Sans cela le visiteur lirait des loyers et des retards comme des faits.
    // Ce sont des inventions cohérentes — c'est ce qui les rend trompeuses si
    // rien ne les désigne.
    installerFauxServeur({ authentifie: false })

    await renderApp('/demo', { session: SESSION_ANONYME })
    expect(await screen.findByText(/ces immeubles, ces locataires et ces montants sont fictifs/i))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: /créer mon espace/i })).toBeInTheDocument()
  })

  it('survit à un rechargement, sans repasser par la page d’accueil', async () => {
    // La visite est conservée le temps de l'onglet : sans cela, recharger en
    // pleine démonstration renverrait à la connexion.
    installerFauxServeur({ authentifie: false })
    await renderApp('/demo', { session: null })
    await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })

    // Démontage explicite : sans lui le second arbre s'ajouterait au premier
    // dans le même document, et la requête trouverait deux tableaux de bord.
    cleanup()

    // Second montage, comme après un rechargement de `/demo`.
    installerFauxServeur({ authentifie: false })
    await renderApp('/demo', { session: null })
    expect(await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })).toBeInTheDocument()
  })

  it('n’ouvre PAS l’application à un visiteur qui n’a rien demandé', async () => {
    // Le pendant : la barrière tient toujours. Seule une entrée explicite par
    // `/demo` ouvre l'application sans compte.
    installerFauxServeur({ authentifie: false })

    await renderApp('/app/cautions', { session: SESSION_ANONYME })
    expect(await screen.findByText(/content de vous revoir/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: /cautions/i })).not.toBeInTheDocument()
  })

  it('refuse /app à une visite de démonstration', async () => {
    /**
     * L'adresse ne doit jamais mentir dans l'autre sens non plus.
     *
     * Tant que la démonstration passait la barrière, l'application s'affichait
     * sous `/app` avec des données fictives : l'adresse annonçait un espace
     * réel, le contenu y ressemblait, et seul un bandeau disait le contraire.
     * L'auteur du produit s'y est trompé deux fois.
     */
    installerFauxServeur({ authentifie: false })
    await renderApp('/app', { session: { statut: 'demo' } })

    expect(await screen.findByText(/content de vous revoir/i)).toBeInTheDocument()
    expect(screen.queryByText(/sont fictifs/i)).not.toBeInTheDocument()
  })

  it('garde l’adresse /demo, qui est le signe le plus lisible', async () => {
    // Le bandeau se lit ; l'adresse se regarde. C'est la seule différence que
    // l'on constate sans avoir rien à lire.
    installerFauxServeur({ authentifie: false })
    await renderApp('/demo/cautions', { session: { statut: 'demo' } })

    expect(await screen.findByRole('heading', { level: 1, name: /cautions/i })).toBeInTheDocument()
    expect(await screen.findByText(/sont fictifs/i)).toBeInTheDocument()
  })

  it('ne montre pas le bandeau à un compte réel', async () => {
    // Le bandeau au-dessus des vraies données d'un propriétaire serait pire
    // qu'inutile : il ferait douter de ses propres chiffres.
    installerFauxServeur({ authentifie: true })

    await renderApp('/app')
    await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })
    expect(screen.queryByText(/sont fictifs/i)).not.toBeInTheDocument()
  })
})
