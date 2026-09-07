import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE PARC, SUR BUREAU, EST UNE CARTE PAR IMMEUBLE ET UNE FICHE PAR LOGEMENT.
 *
 * Le tableau groupé portait le vide : six colonnes dont une absorbait jusqu'à
 * 396 px de blanc, et une ligne par logement où l'œil cherchait l'état parmi
 * des cellules de même poids. La forme retenue vient d'une référence que
 * Nelson a montrée le 2026-09-07 : l'immeuble est une carte avec son
 * occupation et son loyer mensuel en tête, et ses logements sont des fiches en
 * grille — numéro et état en haut, locataire, type · surface, loyer — où un
 * logement vacant porte le geste qui le remplit : « Attribuer un locataire ».
 *
 * Sous 1024 px, rien ne change : les fiches que `DataTable` rend déjà. Ce cas
 * tient la forme de BUREAU, celle qu'aucun test ne regardait autrement que
 * comme « un tableau ».
 */

const PARC = '18181818-4747-4858-8b4b-626262626262'
const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

function unite(id: string, label: string, status: string, tenant: string | null) {
  return {
    id,
    label,
    type: 'T2',
    surfaceSqm: 54,
    rentMinor: 110000,
    paidMinor: status === 'paid' ? 110000 : 0,
    status,
    leaseId: tenant ? `bail-${id}` : null,
    leaseStartsOn: tenant ? '2025-01-01T00:00:00.000Z' : null,
    overdueDays: status === 'overdue' ? 24 : null,
    tenant: tenant ? { id: `t-${id}`, fullName: tenant, phoneE164: null } : null,
  }
}

function parc() {
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
            unite('u-a1', 'A1', 'paid', 'Charles Ngassa'),
            unite('u-a2', 'A2', 'overdue', 'Serge Mbarga'),
            unite('u-a3', 'A3', 'vacant', null),
            { ...unite('u-a4', 'A4', 'partial', 'Aline Tchoumi'), paidMinor: 40000 },
          ],
        },
        { id: 'imm-2', name: 'Villa Bastos', district: 'Bastos', units: [] },
      ],
      works: [
        {
          id: 'w-1',
          reference: 'TR-1',
          unitId: 'u-a1',
          title: 'Fuite sous évier',
          trade: 'plumbing',
          status: 'reported',
          urgency: 'normal',
          quotedAmountMinor: null,
          approvedAmountMinor: null,
          reportedAt: '2026-09-01T00:00:00.000Z',
          resolvedAt: null,
        },
      ],
      deposits: [
        {
          id: 'd-1',
          unitId: 'u-a1',
          tenant: 'Charles Ngassa',
          heldMinor: 110000,
          withheldMinor: 0,
          status: 'held',
          billableMinor: 0,
        },
      ],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

describe('le parc sur bureau', () => {
  it('rend une carte par immeuble et une fiche par logement, sans tableau', async () => {
    parc()
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    const main = screen.getByRole('main')
    expect(within(main).queryByRole('table')).toBeNull()

    const essos = within(main).getByRole('region', { name: /Résidence Essos/ })
    const fiches = within(essos).getAllByRole('listitem')
    expect(fiches).toHaveLength(4)
    // Chaque fiche ouvre le dossier de son logement, par un lien nommé.
    expect(within(fiches[0]).getByRole('link', { name: /A1/ })).toBeInTheDocument()
    expect(within(fiches[0]).getByText('Charles Ngassa')).toBeInTheDocument()
    // Ce que la fiche dit en plus, seulement quand c'est vrai : depuis quand, un
    // chantier ouvert, une caution tenue. A2 n'a rien de tout ça.
    expect(within(fiches[0]).getByText(/depuis/)).toBeInTheDocument()
    expect(within(fiches[0]).getByText(/1 chantier en cours/)).toBeInTheDocument()
    expect(within(fiches[0]).getByText(/Caution/)).toBeInTheDocument()
    expect(within(fiches[1]).queryByText(/chantier|Caution/)).toBeNull()
    // Chaque puce porte le signe de l'écran où le fait se traite.
    for (const puce of [/1 chantier en cours/, /Caution/]) {
      expect(within(fiches[0]).getByText(puce).closest('span')?.querySelector('svg')).not.toBeNull()
    }
    // Un partiel montre sa part reçue, en chiffres et en barre.
    expect(within(fiches[3]).getByText(/40\s?000/)).toBeInTheDocument()
    expect(within(fiches[3]).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '36')
    expect(within(fiches[0]).queryByRole('progressbar')).toBeNull()
    // Plus d'accordéon : aucun immeuble ne se replie.
    expect(screen.queryByRole('button', { name: /(Replier|Déplier) (Résidence|Villa)/ })).toBeNull()
    // L'état et le retard, comme sur Paiements.
    expect(within(fiches[1]).getByText(/En retard/)).toBeInTheDocument()
    expect(within(fiches[1]).getByText(/24/)).toBeInTheDocument()
    // Le vacant porte son geste, et pas une pastille.
    expect(within(fiches[2]).getByText('Aucun locataire')).toBeInTheDocument()
    expect(within(fiches[2]).getByRole('button', { name: /Attribuer un locataire/ })).toBeInTheDocument()
    // Un immeuble vide reste une carte, avec son motif, sans grille.
    const bastos = within(main).getByRole('region', { name: /Villa Bastos/ })
    expect(within(bastos).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(bastos).getByText(/aucun logement/i)).toBeInTheDocument()
  })

  it('ouvre la fiche locataire sur le logement vacant, depuis sa fiche', async () => {
    parc()
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    await userEvent.setup().click(screen.getByRole('button', { name: /Attribuer un locataire/ }))
    const modale = await screen.findByRole('dialog')
    // Le logement est déjà choisi : c'est celui de la fiche, et lui seul.
    const choix = within(modale).getByRole('combobox', { name: /Unité/ })
    expect(within(choix).getAllByRole('option')).toHaveLength(1)
    expect(within(choix).getByRole('option', { name: /A3/ })).toBeInTheDocument()
  })
})

describe('le mois affiché du parc', () => {
  it('se choisit dans un sélecteur de mois, pas seulement pas à pas', async () => {
    parc()
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    const groupe = screen.getByRole('group', { name: 'Mois affiché' })
    const declencheur = within(groupe).getByRole('button', { name: /Mois affiché/ })
    expect(declencheur).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.setup().click(declencheur)
    const panneau = await screen.findByRole('dialog', { name: /mois/i })
    // Aucun mois futur n'est proposé : le mois qui suit celui d'aujourd'hui est fermé.
    const suivant = new Date()
    suivant.setMonth(suivant.getMonth() + 1)
    // En décembre, le mois suivant vit l'année d'après : on y va d'abord.
    if (suivant.getFullYear() !== new Date().getFullYear())
      await userEvent.setup().click(within(panneau).getByRole('button', { name: 'Année suivante' }))
    const nomDuSuivant = new Intl.DateTimeFormat('fr', { month: 'short' }).format(suivant)
    const boutonsFermes = within(panneau)
      .getAllByRole('button')
      .filter((b) => b.textContent?.trim() === nomDuSuivant && b.hasAttribute('disabled'))
    expect(boutonsFermes.length, 'le mois suivant est fermé').toBeGreaterThan(0)
  })

  it('s’ouvre aussi en démonstration, et n’y propose que le mois courant', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc', { largeur: 1280 })
    await attendreLeChargement()
    const declencheur = screen.getByRole('button', { name: /Mois affiché/ })
    expect(declencheur).toHaveAccessibleDescription(/démonstration/)
    await userEvent.setup().click(declencheur)
    const panneau = await screen.findByRole('dialog', { name: /mois/i })
    const mois = new Intl.DateTimeFormat('fr', { month: 'short' })
    const noms = Array.from({ length: 12 }, (_, m) => mois.format(new Date(2026, m, 1)))
    const ouverts = within(panneau)
      .getAllByRole('button')
      .filter((b) => noms.includes(b.textContent?.trim() ?? '') && !b.hasAttribute('disabled'))
    expect(ouverts.map((b) => b.textContent?.trim())).toEqual([mois.format(new Date())])
  })
})
