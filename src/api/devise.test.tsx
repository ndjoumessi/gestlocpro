import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
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
 * LE PRODUIT CONVERTIT DEPUIS, et la règle a changé de forme sans changer de
 * fond. La devise du parc n'est plus ce qu'on IMPOSE à l'écran : c'est la
 * devise des DONNÉES, le point de départ de toute conversion. Ce qu'on affiche
 * peut en différer — parité légale pour le franc CFA, cours de la BCE pour les
 * deux dollars — et la quittance, elle, reste dans celle du parc.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function session(currency: string, role: 'owner' | 'manager' = 'owner'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency }],
  }
}

/** Le document que le serveur rend : sa devise et l'identifiant du versement. */
function quittance(serveur: ReturnType<typeof installerFauxServeur>) {
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
        payments: [
          {
            id: 'ffffffff-1111-4111-8111-111111111111',
            amountMinor: 145000,
            method: 'cash',
            paidOn: '2026-07-03',
            reference: null,
          },
        ],
      },
    },
  })
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
          payments: [
            {
              id: 'ffffffff-1111-4111-8111-111111111111',
              amountMinor: 145000,
              method: 'cash',
              paidOn: '2026-07-03',
              reference: null,
            },
          ],
        },
      },
    })

    const user = userEvent.setup()
    await renderApp('/app/paiements', { session: session('EUR'), currency: 'EUR' })
    await screen.findByText('A1')
    await user.click(screen.getByRole('button', { name: /quittance/i }))

    const dialogue = await screen.findByRole('dialog')
    expect(dialogue.textContent).toMatch(/FCFA|CFA/)
    expect(dialogue.textContent).not.toMatch(/€/)
  })

  it('offre au propriétaire de retirer un versement fautif', async () => {
    /**
     * Le pendant manquant de l'annulation posée ailleurs. Un encaissement saisi
     * sur la mauvaise période ne se réparait que dans la base — un registre sans
     * gomme force à contourner le produit, et c'est là que les vraies erreurs
     * commencent. L'échéance, elle, reste : retirer le versement rétablit la
     * dette, il ne l'efface pas.
     */
    const serveur = parcVide()
    quittance(serveur)
    serveur.quand('DELETE', `/parks/${PARC}/payments/ffffffff-1111-4111-8111-111111111111`, {
      status: 204,
    })

    const user = userEvent.setup()
    await renderApp('/app/paiements', { session: session('XAF') })
    await screen.findByText('A1')
    await user.click(screen.getByRole('button', { name: /quittance/i }))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: /retirer ce versement/i }))

    /*
      DEUX CLICS DÉSORMAIS, et c'est le prix correct.

      Le retrait partait au premier appui, sur une gomme discrète posée à huit
      pixels du montant. Il fait réapparaître une dette : c'est de l'argent
      qu'on déclare ne plus avoir reçu, et le produit confirme partout ailleurs
      avant un geste de cette nature.

      Le premier clic n'émet RIEN — c'est ce que vérifie l'assertion
      intercalée, sans quoi ce cas ne distinguerait plus une confirmation d'un
      simple doublon de bouton.
    */
    expect(serveur.appels.some((a) => a.methode === 'DELETE')).toBe(false)

    const confirmation = await screen.findByRole('alertdialog')
    await user.click(within(confirmation).getByRole('button', { name: /confirmer/i }))

    expect(await screen.findByText(/versement retiré/i)).toBeInTheDocument()
    expect(serveur.appels.some((a) => a.methode === 'DELETE')).toBe(true)
  })

  it('ne l’offre pas au gestionnaire', async () => {
    const serveur = parcVide()
    quittance(serveur)
    const user = userEvent.setup()
    await renderApp('/app/paiements', { session: session('XAF', 'manager') })
    await screen.findByText('A1')
    await user.click(screen.getByRole('button', { name: /quittance/i }))
    await screen.findByRole('dialog')

    // Retirer un versement fait réapparaître une dette : c'est de l'argent qu'on
    // déclare ne plus avoir reçu, et le gestionnaire propose sans décider.
    expect(screen.queryByRole('button', { name: /retirer ce versement/i })).not.toBeInTheDocument()
  })
})

/**
 * CE QUE LA DEVISE DU PARC DÉCIDE, ET CE QU'ELLE NE DÉCIDE PLUS.
 *
 * Elle IMPOSAIT l'affichage, faute de conversion : offrir un autre symbole sur
 * les mêmes chiffres n'était pas un choix, c'était un mensonge sur l'unité.
 *
 * Elle décide maintenant la SOURCE — la devise dans laquelle les données sont
 * tenues, le point de départ de toute conversion. Ce qu'on affiche s'en déduit
 * par un cours, et l'écran dit lequel et de quand.
 */
describe('devise d’affichage', () => {
  it('convertit vers la devise demandée, au lieu de l’imposer', async () => {
    // La préférence dit euro ; le parc dit franc CFA. Les montants sont
    // convertis à la parité légale — 655,957 — et non ré-étiquetés.
    parcVide()
    await renderApp('/app/parc', { session: session('XAF'), currency: 'EUR' })
    await screen.findByText('A1')

    expect(screen.getByRole('main').textContent).toMatch(/€/)
  })

  it('convertit dans l’autre sens tout aussi bien', async () => {
    // Le pendant : sans lui, un produit qui n'afficherait JAMAIS le franc CFA
    // satisferait le cas précédent.
    parcVide()
    await renderApp('/app/parc', { session: session('EUR'), currency: 'CFA' })
    await screen.findByText('A1')

    expect(screen.getByRole('main').textContent).toMatch(/FCFA/)
  })



  /**
   * ON PEUT EN CHANGER, ET C'EST NOUVEAU.
   *
   * Le sélecteur était retiré des comptes réels « faute de conversion » :
   * l'offrir sans convertir ne proposait pas un choix, cela mentait sur
   * l'unité. La conversion existe, le choix redevient un choix.
   *
   * CE QUI NE CHANGE PAS est ce que la règle protégeait vraiment : la QUITTANCE
   * reste dans la devise du parc, quoi que l'écran affiche. Le cas
   * « imprime celle du DOCUMENT, pas celle de l'écran », plus haut, la garde —
   * et il vaut mieux que celui-ci, parce qu'il vise la pièce plutôt que le
   * bouton qui aurait pu la corrompre.
   */
  it('offre d’en changer, depuis que le produit convertit', async () => {
    parcVide()
    await renderApp('/app/parc', { session: session('XAF') })
    await screen.findByText('A1')

    /* Le motif est ANCRÉ (`^Devise`) et non libre : le bouton des réglages
       s'appelle « Réglages : langue, devise et thème » — il NOMME la devise
       sans en être un, et un `/devise/i` flottant le comptait pour elle. */
    await userEvent.click(screen.getByRole('button', { name: /Réglages/ }))
    expect(screen.getByRole('button', { name: /^Devise/ })).toBeInTheDocument()
  })



  it('le garde en démonstration, où les montants sont fictifs', async () => {
    await renderApp('/demo/parc')
    await attendreLeChargement()

    await userEvent.click(screen.getByRole('button', { name: /Réglages/ }))
    expect(screen.getAllByRole('button', { name: /^Devise/ }).length).toBeGreaterThan(0)
  })
})
