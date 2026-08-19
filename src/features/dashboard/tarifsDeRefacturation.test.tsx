import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * LE PRIX VIENT DU SERVEUR, ET DE NULLE PART AILLEURS.
 *
 * Deux constantes vivaient dans le client — 520 le mètre cube, 99 le
 * kilowattheure — et deux écrans les affichaient comme des faits : celui des
 * relevés, et l'espace du locataire, où le montant refacturé est précisément ce
 * que la personne paie. Pour tous les parcs, dans toutes les devises, sans
 * qu'aucun propriétaire ne les ait saisies.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'u-a1'

function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Un parc d'une seule unité, louée au compte connecté. */
function parcAvec(prix: { water: number | null; power: number | null }) {
  return {
    collections: [],
    buildings: [
      {
        id: 'b-1',
        name: 'Résidence Essoss',
        district: 'Bastos',
        units: [
          {
            id: UNITE,
            label: 'A1',
            type: 'apartment',
            surfaceSqm: 45,
            rentMinor: 185000,
            paidMinor: 185000,
            status: 'paid',
            leaseId: 'l-1',
            leaseStartsOn: '2026-01-01',
            overdueDays: null,
            tenant: { id: 't-1', fullName: COMPTE_FICTIF.fullName, phoneE164: '+237677214408' },
          },
        ],
      },
    ],
    works: [],
    deposits: [],
    readings: [
      {
        unitId: UNITE,
        utility: 'water',
        indexValue: 358,
        previousIndex: 342,
        readAt: '2026-07-20T00:00:00.000Z',
        unitPriceMinor: prix.water,
      },
      {
        unitId: UNITE,
        utility: 'power',
        indexValue: 4298,
        previousIndex: 4120,
        readAt: '2026-07-20T00:00:00.000Z',
        unitPriceMinor: prix.power,
      },
    ],
    inspections: [],
    notifications: [],
  }
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

function servir(prix: { water: number | null; power: number | null }) {
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: parcAvec(prix) })
}

describe('les prix affichés sur les relevés', () => {
  it('sont ceux que le serveur rend, et non deux constantes', async () => {
    // 610 et 112, délibérément DIFFÉRENTS des 520 et 99 qui vivaient dans le
    // client : un écran qui aurait gardé les constantes afficherait l'ancien
    // prix sans que rien ne le dise.
    servir({ water: 610, power: 112 })
    renderApp('/app/releves', { session: sessionDuRole('owner') })
    await screen.findByRole('heading', { level: 1 })

    expect(await screen.findByText(/610/)).toBeInTheDocument()
    expect(screen.getByText(/112/)).toBeInTheDocument()
    expect(screen.queryByText(/520/)).not.toBeInTheDocument()
  })

  it('disparaissent quand le parc n’en a posé aucun', async () => {
    servir({ water: null, power: null })
    renderApp('/app/releves', { session: sessionDuRole('owner') })
    await screen.findByRole('heading', { level: 1 })

    /**
     * La QUANTITÉ reste — 16 m³ est un fait relevé —, seul le prix s'en va.
     * Afficher « — / m³ » nommerait un tarif qui n'existe pas ; afficher 520
     * en affirmerait un que personne n'a saisi.
     */
    expect(await screen.findByText('16')).toBeInTheDocument()
    expect(screen.queryByText('/ m³')).not.toBeInTheDocument()
    expect(screen.queryByText('/ kWh')).not.toBeInTheDocument()

    // Et le TOTAL disparaît avec eux. Sans prix, la somme retombe à zéro et
    // l'écran annoncerait « 0 FCFA refacturés » — un zéro affirmé, qui a l'air
    // d'un fait mesuré, là où la vérité est qu'on ne sait pas encore combien.
    const total = screen.getByText('Total refacturé').parentElement!.parentElement!
    expect(total.textContent).toContain('—')
    expect(total.textContent).not.toMatch(/0\s?FCFA/)
  })
})

describe('ce que le locataire lit de ses charges', () => {
  it('voit son montant quand le prix existe', async () => {
    servir({ water: 610, power: 112 })
    renderApp('/app/mon-espace', { session: sessionDuRole('tenant') })
    await screen.findByRole('heading', { level: 1 })

    // 16 m³ à 610 : la moitié positive, sans laquelle un écran qui n'afficherait
    // plus jamais de montant satisferait le cas suivant.
    expect(await screen.findByText(/9\s?760/)).toBeInTheDocument()
  })

  it('lit un tiret plutôt qu’un montant que personne ne lui a accordé', async () => {
    servir({ water: null, power: null })
    renderApp('/app/mon-espace', { session: sessionDuRole('tenant') })
    await screen.findByRole('heading', { level: 1 })

    /**
     * C'est l'endroit du produit où un chiffre inventé coûte le plus cher :
     * celui qui le lit est celui qui le paie. Sa consommation reste affichée,
     * puisqu'elle est relevée ; seule la somme disparaît, du même tiret qu'un
     * relevé manquant — dans les deux cas, elle n'est pas connue.
     */
    await screen.findByText(/16/)
    expect(screen.queryByText(/8\s?320/)).not.toBeInTheDocument()
    // Ni le montant inventé, NI un zéro : « 0 FCFA » se lirait comme une charge
    // nulle, ce qui est une affirmation de plus, et fausse.
    /**
     * L'assertion porte sur LA CARTE de l'eau, et non sur la page.
     *
     * Un premier jet cherchait « 0 FCFA » partout : le motif attrapait
     * « 185 000 FCFA », le loyer, et le cas échouait pour la mauvaise raison.
     * Un motif de vérification doit désigner ce qu'il vise, faute de quoi il
     * finit par juger autre chose.
     */
    const eau = screen.getByText('Eau').parentElement!
    expect(eau.textContent).toContain('—')
    expect(eau.textContent).not.toContain('FCFA')
  })
})
