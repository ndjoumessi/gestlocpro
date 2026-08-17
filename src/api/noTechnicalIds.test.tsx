import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from './SessionProvider'

/**
 * Aucun identifiant technique ne doit atteindre l'écran.
 *
 * Deux défauts identiques ont traversé toute la suite : le tableau de bord a
 * affiché « A3 · aaa63f51-0283-4ffb-b981-af2e271ddeb9 », et les dix écrans ont
 * un temps montré l'`uuid` d'une unité au lieu de son libellé.
 *
 * Les 270 autres tests ne pouvaient pas les voir, et c'est structurel : ils
 * tournent sur le jeu de démonstration, où l'identifiant VAUT le libellé —
 * « A1 » est à la fois la clé et ce qui s'affiche. La confusion y est
 * indétectable par construction.
 *
 * Ce fichier sert donc une charge à la forme du serveur : identifiants `uuid`,
 * libellés distincts. Il ne vérifie pas ce qui s'affiche, mais ce qui ne doit
 * JAMAIS s'afficher — un filet, pas une assertion de contenu.
 */

export const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export const PARK = '11111111-2222-4333-8444-555555555555'
export const IMMEUBLE = 'aaaaaaaa-2222-4333-8444-555555555555'
export const U1 = 'bbbbbbbb-2222-4333-8444-555555555555'
export const U2 = 'cccccccc-2222-4333-8444-555555555555'

export const SESSION_AVEC_PARC: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARK, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Charge à la forme du serveur : tout identifiant y est un `uuid`. */
/** Forme de la charge, assez lâche pour qu'un test la modifie librement. */
interface ChargeApi {
  collections: { year: number; month: number; rent: number; water: number; power: number }[]
  buildings: {
    id: string
    name: string
    district: string
    units: {
      id: string
      label: string
      type: string
      surfaceSqm: number
      rentMinor: number
      tenant: { id: string; fullName: string; phoneE164: string | null } | null
      status: string
      paidMinor: number
      overdueDays: number | null
    }[]
  }[]
  works: Record<string, unknown>[]
  deposits: Record<string, unknown>[]
  readings: Record<string, unknown>[]
  inspections: Record<string, unknown>[]
  notifications: Record<string, unknown>[]
}

export function portefeuille(): ChargeApi {
  return {
    collections: [{ year: 2026, month: 7, rent: 255000, water: 9000, power: 7000 }],
    buildings: [
      {
        id: IMMEUBLE,
        name: 'Résidence Bonamoussadi',
        district: 'Bonamoussadi',
        units: [
          {
            id: U1,
            label: 'A1',
            type: 'T3',
            surfaceSqm: 78,
            rentMinor: 145000,
            tenant: { id: 'dddddddd-2222-4333-8444-555555555555', fullName: 'Charles Ngassa', phoneE164: '+237677214408' },
            status: 'paid',
            paidMinor: 145000,
            overdueDays: null,
          },
          {
            id: U2,
            label: 'A3',
            type: 'T2',
            surfaceSqm: 56,
            rentMinor: 115000,
            tenant: { id: 'eeeeeeee-2222-4333-8444-555555555555', fullName: 'Serge Mbarga', phoneE164: null },
            status: 'overdue',
            paidMinor: 0,
            overdueDays: 24,
          },
        ],
      },
    ],
    works: [
      {
        id: 'ffffffff-2222-4333-8444-555555555555',
        reference: 'SIG-2026-001',
        unitId: U2,
        title: 'Fuite sous l’évier de la cuisine',
        trade: 'plumbing',
        status: 'quoted',
        urgency: 'blocking',
        quotedAmountMinor: 45000,
        approvedAmountMinor: null,
        reportedAt: '2026-07-12T00:00:00.000Z',
      },
    ],
    deposits: [
      {
        id: '99999999-2222-4333-8444-555555555555',
        unitId: U1,
        tenant: 'Charles Ngassa',
        heldMinor: 290000,
        withheldMinor: 0,
        status: 'held',
      },
    ],
    readings: [
      { unitId: U1, utility: 'water', indexValue: 358, previousIndex: 342, readAt: '2026-08-20T00:00:00.000Z' },
      { unitId: U1, utility: 'power', indexValue: 4298, previousIndex: 4120, readAt: '2026-08-20T00:00:00.000Z' },
      { unitId: U2, utility: 'water', indexValue: null, previousIndex: 415, readAt: null },
      { unitId: U2, utility: 'power', indexValue: null, previousIndex: 5210, readAt: null },
    ],
    inspections: [
      {
        id: '88888888-2222-4333-8444-555555555555',
        unitId: U1,
        kind: 'entry',
        performedOn: '2024-05-15T00:00:00.000Z',
        rooms: 4,
        issues: 2,
        signedAt: '2024-05-15T00:00:00.000Z',
      },
    ],
    notifications: [
      {
        id: '77777777-2222-4333-8444-555555555555',
        kind: 'payment',
        messageKey: 'rentOverdue',
        params: { unitId: 'A3', tenant: 'Serge Mbarga', count: 24, on: { year: 2026, month: 7, day: 4 } },
        severity: 'high',
        unitId: U2,
        createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
        read: false,
      },
    ],
  }
}

const ECRANS: [string, RegExp][] = [
  ['/app', /vue consolidée/i],
  ['/app/parc', /parc immobilier/i],
  ['/app/paiements', /suivi des paiements/i],
  ['/app/releves', /relevé des compteurs/i],
  ['/app/etats-des-lieux', /états des lieux/i],
  ['/app/travaux', /travaux/i],
  ['/app/cautions', /cautions/i],
  ['/app/locataires', /locataires/i],
  ['/app/signalements', /signalements/i],
]

describe('aucun identifiant technique à l’écran', () => {
  it.each(ECRANS)('%s', async (route, titre) => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })

    renderApp(route, { session: SESSION_AVEC_PARC })
    // On attend que la charge du serveur ait remplacé le jeu local : sans cela
    // le test passerait sur les constantes, c'est-à-dire sur rien.
    await screen.findByRole('heading', { level: 1, name: titre })
    await screen.findAllByText(/A1|A3|Charles Ngassa|Serge Mbarga/)

    const texte = document.body.textContent ?? ''
    const trouves = texte.match(new RegExp(UUID, 'gi')) ?? []
    expect(trouves, `identifiant technique visible sur ${route}`).toEqual([])
  })

  it('affiche bien le libellé et la référence, et non leurs clés', async () => {
    // Le pendant positif : refuser les `uuid` ne suffirait pas si l'écran
    // n'affichait plus rien du tout.
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })

    renderApp('/app/travaux', { session: SESSION_AVEC_PARC })
    expect(await screen.findByText(/SIG-2026-001/)).toBeInTheDocument()
    expect(screen.getByText(/Fuite sous l’évier/)).toBeInTheDocument()
  })

  it('échouerait si un écran rendait l’identifiant', () => {
    // Garde du garde : la détection elle-même doit fonctionner. Un test qui ne
    // sait pas reconnaître ce qu'il cherche passe toujours.
    expect(UUID.test(U1)).toBe(true)
    expect(UUID.test('A1')).toBe(false)
    expect(UUID.test('SIG-2026-001')).toBe(false)
  })
})
