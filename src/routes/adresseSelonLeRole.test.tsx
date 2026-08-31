import { describe, expect, it } from 'vitest'
import { SESSION_ANONYME, renderApp, screen, userEvent, attendreLeChargement, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import { chargerEspaceApplicatif } from '@/App'

/**
 * L'ADRESSE DEMANDÉE NE DÉPOSE PERSONNE SUR L'ÉCRAN D'UN AUTRE RÔLE.
 *
 * ═══ CE QUI ARRIVAIT, ET IL A ÉTÉ CAPTURÉ EN PRODUCTION ═══
 *
 * `RequireAuth` retient l'adresse qu'on voulait, `Login` y revient après coup —
 * et c'est un bon mécanisme : sans lui, un lien reçu par message dépose sur le
 * tableau de bord quelqu'un qui ne sait même plus où il allait.
 *
 * Il retient POURTANT une adresse dont le rôle n'est pas encore connu. Un poste
 * partagé où le locataire s'est connecté la veille, un lien vers `/app/mon-espace`
 * transmis à la mauvaise personne, un onglet resté ouvert : le propriétaire se
 * connecte, la barrière le renvoie fidèlement à `/app/mon-espace`, et le garde
 * de rôle — juste, lui — lui rend « Écran introuvable ». Sa première seconde
 * dans le produit est un mur, sous une barre latérale complète.
 *
 * ═══ CE QU'ON REFUSE DE FAIRE À LA PLACE ═══
 *
 * Ouvrir `mon-espace` au propriétaire : c'est ce que le lot précédent a fermé,
 * et pour une bonne raison — il y lisait « aucun bail ne porte votre nom ».
 * Le 404 reste JUSTE pour une adresse tapée à la main ; ce qui ne l'est pas,
 * c'est de l'infliger à quelqu'un qui n'a rien demandé d'autre que d'entrer.
 */

const PARC = '99999999-1111-4222-8333-444444444444'

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
          /* Un logement LOUÉ : sur un parc sans bail, le tableau de bord rend
             son état d'accueil au lieu de la vue consolidée, et ces cas
             mesureraient un écran d'absence au lieu de la navigation. */
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

/** Le harnais de la connexion, tel que `RequireAuth` la met en place. */
async function seConnecterDepuis(demandee: string, role: 'owner' | 'manager' | 'tenant') {
  const serveur = installerFauxServeur({ authentifie: false })
  serveur.quand('POST', '/auth/login', { status: 200, body: { user: COMPTE_FICTIF } })
  /* Stubé AVANT le rendu : posé après le montage, le faux serveur ne le sert
     pas et la page reste sur « Chargement… ». */
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  serveur.quand('GET', '/auth/me', {
    status: 200,
    body: {
      user: COMPTE_FICTIF,
      memberships: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
    },
  })

  const user = userEvent.setup()
  await renderApp('/connexion', { session: SESSION_ANONYME, state: { from: demandee } })
  await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
  await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
  /* La frontière paresseuse de `/app` ne se résout qu'à la navigation : on la
     résout ici, ce n'est pas une attente déguisée. */
  await chargerEspaceApplicatif()
  await user.click(screen.getByRole('button', { name: /^se connecter$/i }))
  await attendreLeChargement()
}

describe('l’adresse retenue et le rôle du compte', () => {
  it('ne dépose pas le propriétaire sur l’espace du locataire', async () => {
    await seConnecterDepuis('/app/mon-espace', 'owner')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(/introuvable/i),
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/vue consolidée/i)
  })

  it('ne dépose pas le locataire sur un écran de gestion', async () => {
    await seConnecterDepuis('/app/locataires', 'tenant')

    /* Sur l'ONGLET COURANT et non sur le titre : l'espace du locataire porte le
       nom de son logement en `h1` — « Résidence de test — A1 » —, ce qui dépend
       du parc servi. L'onglet marqué `aria-current` dit où l'on est, quel que
       soit le bail. */
    await waitFor(() =>
      expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent(/mon espace/i),
    )
  })

  it('rend au locataire l’adresse qui est la sienne', async () => {
    await seConnecterDepuis('/app/documents', 'tenant')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/pièces et quittances/i),
    )
  })
})
