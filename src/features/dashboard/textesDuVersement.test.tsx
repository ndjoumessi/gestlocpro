import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, waitFor, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LES DEUX TEXTES DU VERSEMENT.
 *
 * `reference` était saisie à l'encaissement, écrite en base et rendue à
 * personne : le bailleur tapait « MM-4471 » et ne le revoyait jamais. `note`
 * n'avait même pas de champ. C'est le manque de `withheldReason` sur la
 * caution, deux colonnes plus loin — le texte qui expliquerait la ligne six mois
 * après était le seul qu'on ne gardait pas.
 */

const PARC = '13131313-4242-4353-8646-575757575757'
const UNITE = 'aaaaaaaa-1111-4000-8111-111111111111'
const BAIL = 'bbbbbbbb-2222-4000-8222-222222222222'

function session(role: 'owner' | 'tenant'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** `note` absente = ce que le serveur envoie au locataire. */
function installer(versement: Record<string, unknown>): FauxServeur {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
              label: 'A3',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 145000,
              tenant: { id: 'loc-1', fullName: 'Serge Mbarga', phoneE164: null },
              status: 'paid',
              leaseId: BAIL,
              leaseStartsOn: '2025-03-01T00:00:00.000Z',
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
      leaseCharges: [
        {
          leaseId: BAIL,
          periodStart: '2026-08-01T00:00:00.000Z',
          dueOn: '2026-08-05T00:00:00.000Z',
          rentMinor: 145000,
          waterMinor: 0,
          powerMinor: 0,
          paidMinor: 145000,
          payments: [
            {
              amountMinor: 145000,
              method: 'mobile',
              paidOn: '2026-08-03T00:00:00.000Z',
              ...versement,
            },
          ],
        },
      ],
    },
  })
  return faux
}

describe('la référence revient sous les yeux du bailleur', () => {
  it('la montre au dossier du logement', async () => {
    installer({ reference: 'MM-4471', note: null })
    await renderApp(`/app/parc/${UNITE}`, { session: session('owner') })
    await attendreLeChargement()

    expect(await screen.findByText(/réf\. MM-4471/)).toBeInTheDocument()
  })

  /**
   * Les espèces ne produisent pas de référence. « réf. — » ferait chercher une
   * donnée manquante là où il n'y a rien à trouver — c'est la moitié sans
   * laquelle afficher la mention en permanence satisferait le cas précédent.
   */
  it('n’écrit rien quand le versement n’en porte pas', async () => {
    installer({ reference: null, note: null })
    await renderApp(`/app/parc/${UNITE}`, { session: session('owner') })
    await attendreLeChargement()

    await waitFor(() => expect(screen.queryByText(/réf\./)).not.toBeInTheDocument())
  })

  it('montre la note au bailleur', async () => {
    installer({ reference: 'MM-4471', note: 'Solde promis le 15.' })
    await renderApp(`/app/parc/${UNITE}`, { session: session('owner') })
    await attendreLeChargement()

    expect(await screen.findByText('Solde promis le 15.')).toBeInTheDocument()
  })
})

describe('la saisie', () => {
  it('envoie la note avec le versement', async () => {
    const faux = installer({ reference: null, note: null })
    faux.quand('POST', `/parks/${PARC}/payments`, { status: 201, body: { payment: { id: 'p-1' } } })
    await renderApp('/app/paiements', { session: session('owner') })
    await attendreLeChargement()

    const clavier = userEvent.setup()
    await clavier.click(screen.getByRole('button', { name: /Enregistrer un paiement/ }))
    await clavier.type(screen.getByRole('textbox', { name: /Montant/ }), '145000')
    await clavier.type(screen.getByRole('textbox', { name: /Note interne/ }), 'Solde promis le 15.')
    await clavier.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      const appel = faux.appels.find((a) => a.methode === 'POST' && a.chemin.endsWith('/payments'))
      expect((appel?.corps as { note?: string })?.note).toBe('Solde promis le 15.')
    })
  })
})
