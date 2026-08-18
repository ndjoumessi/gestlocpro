import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * D'où vient le rôle d'un compte réel.
 *
 * La coquille l'initialisait à `'owner'` EN DUR, alors que la session porte le
 * vrai rôle depuis toujours et que `PortfolioProvider` le lisait déjà de
 * l'adhésion. Un gestionnaire ou un locataire qui se connectait recevait donc
 * la navigation d'un propriétaire : « Parc immobilier », « Cautions », « Prise
 * en main et droits ».
 *
 * Ce n'était pas une faille — le serveur vérifie l'appartenance et le rôle à
 * chaque requête, et aurait refusé les données. C'était pire à sa manière : une
 * barre latérale qui promet des écrans que le compte ne peut pas servir, et un
 * utilisateur qui apprend le refus en cliquant.
 *
 * Le défaut n'a pu se voir que le jour où il fallait masquer le sélecteur de
 * profil hors démonstration : tant qu'il s'affichait, il était le SEUL moyen
 * pour un non-propriétaire d'atteindre sa propre navigation. Le retirer sans
 * corriger la provenance du rôle aurait transformé un défaut visible en défaut
 * sans issue.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Un parc réel et minimal : l'adhésion implique un parc, donc un chargement. */
function serveurAvecParc() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

/** Entrée réservée au propriétaire seul, d'après la liste de la barre latérale. */
const RESERVEE_AU_PROPRIETAIRE = 'Prise en main et droits'
/** Entrée refusée au locataire, ouverte aux deux rôles de gestion. */
const RESERVEE_A_LA_GESTION = 'Parc immobilier'

describe('le rôle vient de l’adhésion', () => {
  it('donne au propriétaire ses deux entrées réservées', async () => {
    serveurAvecParc()
    renderApp('/app', { session: sessionDuRole('owner') })
    await screen.findByRole('heading', { level: 1 })

    expect(screen.getAllByRole('link', { name: RESERVEE_AU_PROPRIETAIRE }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: RESERVEE_A_LA_GESTION }).length).toBeGreaterThan(0)
  })

  it('retire au gestionnaire la seule entrée du propriétaire, et lui laisse le reste', async () => {
    serveurAvecParc()
    renderApp('/app', { session: sessionDuRole('manager') })
    await screen.findByRole('heading', { level: 1 })

    // Le cas tient sur ses DEUX moitiés : sans la seconde, une coquille vide le
    // satisferait, et c'est précisément ce qu'un mauvais correctif produirait.
    expect(screen.queryAllByRole('link', { name: RESERVEE_AU_PROPRIETAIRE })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: RESERVEE_A_LA_GESTION }).length).toBeGreaterThan(0)
  })

  it('retire au locataire les écrans de gestion', async () => {
    serveurAvecParc()
    renderApp('/app', { session: sessionDuRole('tenant') })
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryAllByRole('link', { name: RESERVEE_A_LA_GESTION })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: RESERVEE_AU_PROPRIETAIRE })).toHaveLength(0)
    // Et il lui reste bien une navigation — la SIENNE. « Travaux » n'en fait
    // plus partie : son contenu est remonté dans « Mon espace », et l'adresse
    // reste atteignable en direct, cloisonnée comme avant.
    expect(screen.getAllByRole('link', { name: 'Mon espace' }).length).toBeGreaterThan(0)
  })

  it('refuse au locataire l’accès direct à un écran de gestion', async () => {
    serveurAvecParc()
    renderApp('/app/parc', { session: sessionDuRole('tenant') })

    // La route porte le même filtre que la navigation : sans cela, l'adresse
    // saisie à la main contournerait la barre latérale.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Accès restreint')
  })

  it('n’offre à aucun de ces comptes un sélecteur de profil', async () => {
    serveurAvecParc()
    renderApp('/app', { session: sessionDuRole('manager') })
    await screen.findByRole('heading', { level: 1 })

    // Il ne changerait que le point de vue de la page, jamais ce que le serveur
    // accorde. Proposer à un gestionnaire de se regarder en propriétaire de son
    // parc est une promesse que rien ne tient.
    expect(screen.queryAllByRole('radio', { hidden: true })).toHaveLength(0)
  })
})
