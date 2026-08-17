import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Ce que disent les trois écrans quand ils n'ont rien à montrer.
 *
 * Travaux, signalements et états des lieux appelaient `EmptyState` avec une
 * icône et un titre, rien d'autre. Un titre seul répond « il n'y a rien » à
 * quelqu'un qui voit déjà qu'il n'y a rien : la question réelle est « est-ce
 * que ça marche, et qu'est-ce qui apparaîtra ici ». Ce sont en outre les trois
 * écrans du parcours locataire — celui qui les rencontre est celui qui connaît
 * le moins le produit.
 *
 * Deux des trois titres étaient de surcroît écrits pour le locataire (« votre
 * logement ») et servis tels quels au propriétaire, qui regarde tout le parc.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

const SESSION_LOCATAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc de test', currency: 'XAF' }],
}

/**
 * Un parc réel, mais sans le moindre travail, état des lieux ni notification.
 *
 * C'est l'état EXACT d'un compte qui vient de déclarer son premier immeuble, et
 * il dure : rien ne se signale le premier jour. Le jeu de démonstration, lui,
 * porte cinq interventions et six états des lieux — il ne montre jamais ces
 * écrans vides à personne.
 */
function parcSansRien() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'aaaaaaaa-2222-4333-8444-555555555555',
          name: 'Résidence Bonamoussadi',
          district: 'Bonamoussadi',
          units: [
            {
              id: 'bbbbbbbb-2222-4333-8444-555555555555',
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: {
                id: 'dddddddd-2222-4333-8444-555555555555',
                fullName: 'Charles Ngassa',
                phoneE164: '+237677214408',
              },
              status: 'paid',
              paidMinor: 145000,
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
    },
  })
  return serveur
}

describe('les travaux, quand il n’y en a aucun', () => {
  it('dit au bailleur d’où viennent les interventions, dans SES termes', async () => {
    parcSansRien()
    renderApp('/app/travaux', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText(/aucune intervention sur le parc/i)).toBeInTheDocument()
    // Le corps nomme l'origine — un signalement de locataire — au lieu de
    // paraphraser le titre.
    expect(screen.getByText(/naît d’un signalement de locataire/i)).toBeInTheDocument()
    // Et surtout, plus le texte du locataire : le propriétaire n'a pas « son »
    // logement, il a un parc.
    expect(screen.queryByText(/sur votre logement/i)).not.toBeInTheDocument()
  })

  it('n’offre au bailleur aucun bouton : rien ne crée une intervention ici', async () => {
    parcSansRien()
    renderApp('/app/travaux', { session: SESSION_PROPRIETAIRE })

    await screen.findByText(/aucune intervention sur le parc/i)
    /**
     * Le geste n'existe pas dans le produit : une intervention naît d'un
     * signalement, jamais d'une saisie du bailleur. Un bouton « ajouter des
     * travaux » remplirait le gabarit et ouvrirait sur rien — c'est le
     * mensonge d'interface que ces écrans passent leur temps à retirer.
     *
     * Le cas garde donc son intérêt en négatif : il tombera le jour où
     * quelqu'un croira bien faire en fabriquant l'action.
     */
    expect(screen.queryByRole('link', { name: /ajouter|nouveau|créer/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /ajouter|nouveau|créer/i })).toBeNull()
  })

  it('ramène le locataire là où ses données vivent', async () => {
    parcSansRien()
    renderApp('/app/travaux', { session: SESSION_LOCATAIRE })
    await switchRole('tenant')

    expect(await screen.findByText(/aucune intervention en cours/i)).toBeInTheDocument()
    expect(screen.getByText(/dès que votre gestionnaire enregistre/i)).toBeInTheDocument()
    // Une action réelle, et la seule honnête : le locataire n'ouvre pas
    // d'intervention lui-même, mais il n'a rien à faire sur cette page.
    expect(screen.getByRole('link', { name: /retour à mon espace/i })).toBeInTheDocument()
  })
})

describe('les notifications, quand il n’y en a aucune', () => {
  it('énumère au bailleur ce que le produit dépose ici', async () => {
    parcSansRien()
    renderApp('/app/signalements', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText(/rien à signaler sur le parc/i)).toBeInTheDocument()
    expect(screen.getByText(/loyers en retard.*devis à arbitrer/i)).toBeInTheDocument()
  })
})

describe('les états des lieux, quand il n’y en a aucun', () => {
  it('explique à quoi ils servent plutôt que de répéter qu’il n’y en a pas', async () => {
    parcSansRien()
    renderApp('/app/etats-des-lieux', { session: SESSION_PROPRIETAIRE })

    expect(await screen.findByText(/aucun état des lieux enregistré$/i)).toBeInTheDocument()
    expect(screen.getByText(/c’est leur comparaison qui justifie/i)).toBeInTheDocument()
  })

  it('ne fabrique aucune action : le produit ne sait pas en établir un', async () => {
    parcSansRien()
    renderApp('/app/etats-des-lieux', { session: SESSION_PROPRIETAIRE })

    await screen.findByText(/aucun état des lieux enregistré$/i)
    /**
     * Ni pour le bailleur ni pour le locataire. Le produit ne dispose d'aucun
     * écran de saisie d'un état des lieux — `TenantPortal` le dit déjà de son
     * côté documents. Un bouton ici mènerait au vide.
     */
    expect(screen.queryByRole('button', { name: /état des lieux/i })).toBeNull()
  })
})
