import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA FIN D'ACCÈS S'ANNONCE AU LOCATAIRE, ELLE NE TOMBE PAS.
 *
 * La fenêtre après le bail coupait l'accès SANS PRÉVENIR — le lot qui l'a posée
 * l'avouait : « un jour ses quittances sont là, le lendemain son espace dit
 * “aucun logement rattaché” ». Le serveur rend maintenant la date, et l'espace
 * du locataire la dit — avec le GESTE, télécharger, parce qu'une date sans
 * geste laisse compter les jours au lieu d'agir.
 *
 * `notes-conditionnelles` renvoie ici : aucun balayage au navigateur ne sait
 * produire un locataire PARTI, et c'est ce fichier qui tient la note.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const A1 = 'aaaaaaaa-1111-4000-8111-111111111111'

const session: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc Bastos', currency: 'XAF' }],
}

function portefeuille(accessUntil: string | null) {
  return {
    accessUntil,
    collections: [],
    buildings: [
      {
        id: 'imm-1',
        name: 'Résidence Bonamoussadi',
        district: 'Bonamoussadi',
        units: [
          {
            id: A1,
            label: 'A1',
            type: 'T2',
            surfaceSqm: 52,
            rentMinor: 90000,
            tenant: { id: 'loc-A1', fullName: COMPTE_FICTIF.fullName, phoneE164: null },
            status: 'paid',
            leaseId: 'bail-A1',
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
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

describe('le locataire parti', () => {
  it('lit la date de fermeture ET le geste à faire', async () => {
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: portefeuille('2026-12-15'),
    })
    await renderApp('/app/mon-espace', { session })
    await attendreLeChargement()

    const note = screen.getByText(/cet espace reste ouvert jusqu’au/)
    expect(note, 'la coupure ne doit plus surprendre').toBeInTheDocument()
    /* La DATE, formatée — pas l'ISO brut, qui se lit à l'envers selon le pays. */
    expect(note.textContent).toContain('15/12/2026')
    expect(note.textContent, 'une date sans geste laisse compter les jours').toContain(
      'Téléchargez vos quittances',
    )
  })
})

describe('le locataire en place', () => {
  it('ne lit AUCUNE échéance', async () => {
    /* Tant qu'un bail court, il n'y a rien à annoncer — une date sur l'espace
       d'un locataire en place sèmerait la panique pour rien. */
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: portefeuille(null),
    })
    await renderApp('/app/mon-espace', { session })
    await attendreLeChargement()

    expect(screen.queryByText(/reste ouvert jusqu’au/)).toBeNull()
  })
})
