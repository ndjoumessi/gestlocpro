import { describe, expect, it } from 'vitest'
import { SESSION_ANONYME, renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'

/**
 * Barrière d'accès aux écrans applicatifs.
 *
 * Elle ne remplace pas le cloisonnement du serveur — la vraie protection est le
 * prédicat de chaque requête, et un visiteur qui atteindrait `/app` n'y verrait
 * aucune donnée. Ce qu'elle évite est une coquille vide : la barre latérale
 * d'un parc qui n'est pas le sien, puis des écrans qui échouent un à un.
 */
describe('accès aux écrans applicatifs', () => {
  it('renvoie un visiteur vers la connexion', async () => {
    renderApp('/app', { session: SESSION_ANONYME })

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /content de vous revoir/i,
    )
    // La barre latérale ne doit pas apparaître, même un instant : la barrière
    // enveloppe la coquille et non chaque écran.
    expect(screen.queryByRole('navigation', { name: /navigation principale/i })).not.toBeInTheDocument()
  })

  it('protège aussi les écrans profonds', async () => {
    renderApp('/app/cautions', { session: SESSION_ANONYME })
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /content de vous revoir/i,
    )
  })

  it('laisse passer un compte connecté', () => {
    renderApp('/app')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/vue consolidée/i)
  })

  it('n’attend pas la réponse du serveur pour rediriger… ni ne redirige avant', async () => {
    /**
     * Le troisième état est celui qu'on oublie.
     *
     * Entre le montage et la réponse de `/auth/me`, on ne sait pas encore.
     * Rediriger pendant ce moment-là éjecterait vers la connexion un
     * utilisateur parfaitement authentifié, à chaque rechargement — un défaut
     * qui ne se voit pas sur une machine rapide et se manifeste chez tout le
     * monde sur le réseau réel.
     *
     * Ce cas emprunte le VRAI chemin : pas d'état initial fourni, donc une
     * vraie promesse à résoudre.
     */
    const serveur = installerFauxServeur()
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: { user: COMPTE_FICTIF, memberships: [] },
    })

    // `session: undefined` force le provider à interroger le serveur.
    renderApp('/app', { session: { statut: 'inconnu' } })

    // Pendant l'attente : ni l'écran, ni la connexion — une attente annoncée.
    expect(screen.getByText(/chargement/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /content de vous revoir/i })).not.toBeInTheDocument()
  })
})

describe('retour à l’adresse demandée', () => {
  it('ramène où l’on allait après la connexion', async () => {
    // Sans cela, quelqu'un qui ouvre un lien vers `/app/cautions` atterrit sur
    // le tableau de bord — et sur un lien reçu par message, il ne sait même pas
    // où il allait.
    const serveur = installerFauxServeur({ authentifie: false })
    serveur.quand('POST', '/auth/login', { status: 200, body: { user: COMPTE_FICTIF } })

    const user = userEvent.setup()
    renderApp('/app/cautions', { session: SESSION_ANONYME })
    await screen.findByRole('heading', { name: /content de vous revoir/i })

    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: { user: COMPTE_FICTIF, memberships: [] },
    })
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    // Le titre ATTENDU est cherché, et non « le premier h1 venu » : celui de
    // la connexion est encore là au moment du clic, et `findByRole` le rendrait
    // aussitôt sans jamais attendre la navigation.
    expect(await screen.findByRole('heading', { level: 1, name: /cautions/i })).toBeInTheDocument()
  })

  it('refuse une destination qui sort du produit', async () => {
    /**
     * L'état de navigation vient du client : suivre son contenu sans le
     * valider ouvrirait une redirection ouverte. Un lien vers `/connexion`
     * portant un état pointant sur un site tiers renverrait l'utilisateur
     * dehors juste après qu'il a saisi son mot de passe — c'est le schéma
     * classique du hameçonnage par redirection.
     */
    const serveur = installerFauxServeur({ authentifie: false })
    serveur.quand('POST', '/auth/login', { status: 200, body: { user: COMPTE_FICTIF } })
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: { user: COMPTE_FICTIF, memberships: [] },
    })

    const user = userEvent.setup()
    renderApp('/connexion', { session: SESSION_ANONYME, state: { from: 'https://mechant.example' } })

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    // On atterrit sur le tableau de bord, jamais à l'extérieur.
    expect(
      await screen.findByRole('heading', { level: 1, name: /vue consolidée/i }),
    ).toBeInTheDocument()
  })
})
