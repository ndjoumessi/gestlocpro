import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * La devise vient du PARC.
 *
 * `CurrencyProvider` ne lisait que `localStorage`. La devise du parc, portée par
 * l'adhésion depuis toujours, n'était lue nulle part : un parc camerounais
 * s'affichait dans la dernière devise choisie sur cette machine — et une
 * QUITTANCE imprimait « 50,00 € » pour 50 000 FCFA, soit un écart de 655 fois
 * sur un document opposable au locataire.
 *
 * Le produit ne convertit rien, et c'est un parti pris assumé du module de
 * devises. Il ne tient que si la devise affichée EST celle du parc : sans
 * conversion, en changer ne fait que mentir sur l'unité.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function session(currency: string): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency }],
  }
}

function parcVide() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'aaaaaaaa-2222-4333-8444-555555555555',
          name: 'Résidence Makepe',
          district: 'Makepe',
          units: [
            {
              id: 'cccccccc-1111-4111-8111-111111111111',
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: { id: 'dddddddd-1111-4111-8111-111111111111', fullName: 'Charles Ngassa', phoneE164: null },
              leaseId: 'bbbbbbbb-1111-4111-8111-111111111111',
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

describe('devise de la quittance', () => {
  it('imprime celle du DOCUMENT, pas celle de l’écran', async () => {
    /**
     * Une quittance atteste d'un fait passé. Le parc pourrait changer de devise
     * demain sans que ce fait change — et deux postes réglés différemment ne
     * doivent pas imprimer deux monnaies pour un seul versement.
     *
     * Ici tout pousse vers l'euro : la préférence de la machine ET la devise du
     * parc. Le document, lui, dit franc CFA. C'est lui qui gagne.
     */
    const serveur = parcVide()
    serveur.quand('POST', `/parks/${PARC}/receipts`, {
      status: 201,
      body: {
        document: {
          kind: 'quittance',
          currency: 'XAF',
          periodStart: '2026-07-01',
          tenant: 'Charles Ngassa',
          unit: 'A1',
          building: 'Résidence Makepe',
          district: 'Makepe',
          rentMinor: 145000,
          waterMinor: 0,
          powerMinor: 0,
          dueMinor: 145000,
          paidMinor: 145000,
          balanceMinor: 0,
          payments: [{ amountMinor: 145000, method: 'cash', paidOn: '2026-07-03', reference: null }],
        },
      },
    })

    const user = userEvent.setup()
    renderApp('/app/paiements', { session: session('EUR'), currency: 'EUR' })
    await screen.findByText('A1')
    await user.click(screen.getByRole('button', { name: /quittance/i }))

    const dialogue = await screen.findByRole('dialog')
    expect(dialogue.textContent).toMatch(/FCFA|CFA/)
    expect(dialogue.textContent).not.toMatch(/€/)
  })
})

describe('devise d’affichage', () => {
  it('suit le parc, et non la dernière préférence de la machine', async () => {
    // La préférence stockée dit euro ; le parc dit franc CFA. C'est le parc qui
    // décide : les montants ne sont pas convertis.
    parcVide()
    renderApp('/app/parc', { session: session('XAF'), currency: 'EUR' })
    await screen.findByText('A1')

    expect(screen.getByRole('main').textContent).toMatch(/FCFA|CFA/)
    expect(screen.getByRole('main').textContent).not.toMatch(/€/)
  })

  it('affiche l’euro pour un parc en euro', async () => {
    // Le pendant positif : sans lui, un produit qui n'afficherait JAMAIS l'euro
    // satisferait le cas précédent.
    parcVide()
    renderApp('/app/parc', { session: session('EUR'), currency: 'CFA' })
    await screen.findByText('A1')

    expect(screen.getByRole('main').textContent).toMatch(/€/)
  })

  it('n’offre pas d’en changer sur un compte réel', async () => {
    parcVide()
    renderApp('/app/parc', { session: session('XAF') })
    await screen.findByText('A1')

    /**
     * Offrir de changer de devise sans convertir n'offre pas un choix : cela
     * ment sur l'unité. Il n'y a qu'une devise juste pour un parc — la sienne.
     */
    expect(screen.queryByRole('button', { name: /devise/i })).not.toBeInTheDocument()
  })

  it('le garde en démonstration, où les montants sont fictifs', async () => {
    renderApp('/demo/parc')
    await attendreLeChargement()

    expect(screen.getAllByRole('button', { name: /devise/i }).length).toBeGreaterThan(0)
  })
})
