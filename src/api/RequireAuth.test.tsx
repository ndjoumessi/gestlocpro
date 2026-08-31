import { describe, expect, it } from 'vitest'
import { SESSION_ANONYME, renderApp, screen, userEvent, attendreLeChargement, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import { chargerEspaceApplicatif } from '@/App'

/** Un parc minimal : le tableau de bord rend sa vue consolidée, pas son accueil. */
const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Résidence de test',
      district: 'Bastos',
      units: [
        {
          id: 'unite-1',
          label: 'A1',
          type: 'T2',
          surfaceSqm: 52,
          rentMinor: 90000,
          /* UN LOGEMENT LOUÉ, et non vacant : sur un parc sans aucun bail, le
             tableau de bord rend son état d'accueil — « le parc est neuf » —
             qui REMPLACE la vue consolidée. Ces cas portent sur la navigation,
             pas sur cet état-là. */
          tenant: { id: 'loc-1', fullName: 'Charles Ngassa', phoneE164: null },
          status: 'paid',
          leaseId: 'bail-1',
          leaseStartsOn: '2025-03-01T00:00:00.000Z',
          paidMinor: 90000,
          overdueDays: null,
        },
      ],
    },
  ],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
  leaseCharges: [],
}

const PARC = '99999999-1111-4222-8333-444444444444'

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
    await renderApp('/app', { session: SESSION_ANONYME })

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /content de vous revoir/i,
    )
    // La barre latérale ne doit pas apparaître, même un instant : la barrière
    // enveloppe la coquille et non chaque écran.
    expect(screen.queryByRole('navigation', { name: /navigation principale/i })).not.toBeInTheDocument()
  })

  it('protège aussi les écrans profonds', async () => {
    await renderApp('/app/cautions', { session: SESSION_ANONYME })
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /content de vous revoir/i,
    )
  })

  it('laisse passer un compte connecté', async () => {
    await renderApp('/app')
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
    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })

    // `session: undefined` force le provider à interroger le serveur.
    await renderApp('/app', { session: { statut: 'inconnu' } })

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
    /* LE PORTEFEUILLE EST STUBÉ AVANT LE RENDU, et l'ordre n'est pas
       cosmétique : posé après le montage, le faux serveur ne le sert pas — la
       page reste sur « Chargement… », mesuré. */
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })

    const user = userEvent.setup()
    await renderApp('/app/cautions', { session: SESSION_ANONYME })
    await screen.findByRole('heading', { name: /content de vous revoir/i })

    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    /* LE MODULE DE `/app` EST PRÉCHARGÉ AVANT LE CLIC, et ce n'est pas une
       attente déguisée : `renderApp` fait exactement cela pour les routes qui
       commencent sous `/app`. Partant de `/connexion`, la frontière paresseuse
       ne se résout qu'À LA NAVIGATION — la sonde l'a montré, aucune requête de
       portefeuille ne partait et la page restait sur « Chargement… ». On
       résout la frontière, on n'allonge aucun budget d'horloge. */
    await chargerEspaceApplicatif()
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    // Le titre ATTENDU est cherché, et non « le premier h1 venu » : celui de
    // la connexion est encore là au moment du clic, et `findByRole` le rendrait
    // aussitôt sans jamais attendre la navigation.
    await attendreLeChargement()
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /cautions/i })).toBeInTheDocument(),
    )
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
    /* LE PORTEFEUILLE EST STUBÉ AVANT LE RENDU, et l'ordre n'est pas
       cosmétique : posé après le montage, le faux serveur ne le sert pas — la
       page reste sur « Chargement… », mesuré. */
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })

    const user = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME, state: { from: 'https://mechant.example' } })

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    /* LE MODULE DE `/app` EST PRÉCHARGÉ AVANT LE CLIC, et ce n'est pas une
       attente déguisée : `renderApp` fait exactement cela pour les routes qui
       commencent sous `/app`. Partant de `/connexion`, la frontière paresseuse
       ne se résout qu'À LA NAVIGATION — la sonde l'a montré, aucune requête de
       portefeuille ne partait et la page restait sur « Chargement… ». On
       résout la frontière, on n'allonge aucun budget d'horloge. */
    await chargerEspaceApplicatif()
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    // On atterrit sur le tableau de bord, jamais à l'extérieur.
    /* `waitFor` ET NON `findByRole`, et ce n'est pas un goût. Mesuré trois fois
       dans ce lot : `findByRole` REJETTE en quelques dizaines de millisecondes,
       bien avant son budget, sur un élément qui finit par apparaître — et
       `waitFor`, au budget PAR DÉFAUT, le trouve. La cause n'est pas établie ;
       le fait l'est, et il fait passer un écran présent pour un écran absent. */
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /vue consolidée/i })).toBeInTheDocument(),
    )
  })
})
