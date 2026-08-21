import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * La devise vient du PARC, et le sélecteur ne survit qu'en démonstration.
 *
 * L'invariant est écrit trois fois en prose — dans `currencies.ts`, et au-dessus
 * de chacune des deux coquilles d'`AppShell` — et il ne tenait que sur deux
 * `{demo && …}`. Aucun cas du dépôt ne mentionnait ce sélecteur : la coquille du
 * locataire, écrite après la correction, a remis la garde par mémoire d'auteur.
 * C'est ce filet-là qui manquait.
 *
 * Ce qu'il a déjà coûté : le produit ne convertit rien, un parc camerounais
 * s'affichait dans la dernière devise retenue par le navigateur, et une
 * quittance imprimait « 50,00 € » pour 50 000 FCFA — 655 fois d'écart sur un
 * document opposable au locataire.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

/** Le nom accessible du sélecteur : « Devise » suivi du libellé courant. */
const selecteurDeDevise = () => screen.queryByRole('button', { name: /Devise/ })

function sessionReelle(role: 'owner' | 'tenant'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    // Un parc camerounais : c'est le cas où la devise du navigateur et celle du
    // parc divergent, et où l'écart se paie.
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bonamoussadi', currency: 'XAF' }],
  }
}

/** Un vrai parc, portant un logement à 50 000 de loyer. */
function serveurReel() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Essos',
          district: 'Essos',
          units: [
            {
              id: UNITE,
              label: 'B7',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 50000,
              tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-1',
              leaseStartsOn: '2026-01-01T00:00:00.000Z',
              paidMinor: 50000,
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

/**
 * LES DEUX CAS DE PRÉSENCE VIENNENT EN PREMIER, et ce n'est pas de la politesse.
 *
 * Sans eux, supprimer purement et simplement le composant du dépôt ferait passer
 * les cas d'absence : on garderait l'invariant en ayant perdu la fonctionnalité.
 * En démonstration le sélecteur est légitime — les montants y sont fictifs, et
 * la vitrine ancre ses tarifs par devise.
 */
describe('en démonstration, la devise se choisit', () => {
  it('offre le sélecteur au bailleur', async () => {
    await renderApp('/demo')
    await attendreLeChargement()
    expect(selecteurDeDevise()).toBeInTheDocument()
  })

  /**
   * Le locataire a sa PROPRE coquille — une barre horizontale, pas la barre
   * latérale du bailleur. Elle a son propre appel au sélecteur, donc sa propre
   * garde : c'est exactement l'endroit où l'invariant pouvait se perdre sans
   * qu'aucun cas ne bronche.
   */
  it('offre le sélecteur au locataire, dans sa coquille distincte', async () => {
    await renderApp('/demo')
    await switchRole('tenant')
    await attendreLeChargement()
    expect(selecteurDeDevise()).toBeInTheDocument()
  })
})

describe('sur un vrai parc, la devise ne se choisit pas', () => {
  it('ne propose pas d’en changer au bailleur', async () => {
    serveurReel()
    await renderApp('/app', { session: sessionReelle('owner') })
    await attendreLeChargement()
    expect(selecteurDeDevise()).toBeNull()
  })

  it('ne propose pas d’en changer au locataire', async () => {
    serveurReel()
    await renderApp('/app/mon-espace', { session: sessionReelle('tenant') })
    await attendreLeChargement()
    expect(selecteurDeDevise()).toBeNull()
  })

  /**
   * Retirer le sélecteur NE SUFFIT PAS.
   *
   * Le choix vit dans `localStorage` et survit à la navigation. Un locataire
   * arrivé par la vitrine — où le sélecteur est légitime, les tarifs y étant
   * ancrés par devise — porterait l'euro jusque dans son espace sans avoir rien
   * demandé, et lirait « 50,00 € » là où son bail dit 50 000 FCFA.
   *
   * Le parc est en `XAF` ; le navigateur, lui, arrive avec `EUR` en mémoire.
   * C'est le parc qui doit gagner.
   */
  it('affiche les montants dans la devise du parc', async () => {
    serveurReel()
    await renderApp('/app', { session: sessionReelle('owner'), currency: 'EUR' })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('FCFA')
    // Le symbole, explicitement : c'est lui qu'une quittance imprimait.
    expect(main).not.toHaveTextContent('€')
  })
})
