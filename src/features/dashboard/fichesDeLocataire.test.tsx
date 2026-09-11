import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LES LOCATAIRES, SUR BUREAU, SONT UNE FICHE PAR PERSONNE.
 *
 * Le tableau portait six colonnes de même poids — locataire, unité, type,
 * contact, loyer, ce mois — et taisait tout le reste : pour savoir ce qu'un
 * locataire DOIT, ce qu'on tient de lui et ce qui traîne sur son logement, il
 * fallait ouvrir Paiements, Cautions et Travaux. Ces trois choses arrivent
 * pourtant dans la MÊME réponse que le parc.
 *
 * La forme vient d'une référence que Nelson a montrée le 2026-09-07 : l'état en
 * tête, quatre faits en grille, les gestes en bas. Sous 1024 px, rien ne
 * change : `DataTable` rend déjà des fiches.
 */

const PARC = '24242424-4747-4858-8b4b-626262626262'
const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

function unite(
  id: string,
  label: string,
  status: string,
  tenant: string,
  paidMinor: number,
  sansCompte = false,
) {
  return {
    id,
    label,
    type: 'T2',
    surfaceSqm: 54,
    rentMinor: 110000,
    paidMinor,
    status,
    leaseId: `bail-${id}`,
    leaseStartsOn: '2025-01-01T00:00:00.000Z',
    overdueDays: status === 'overdue' ? 24 : null,
    tenant: {
      id: `t-${id}`,
      fullName: tenant,
      phoneE164: '+237677000000',
      ...(sansCompte ? { hasAccount: false } : {}),
    },
  }
}

/** Une échéance du mois courant : c'est d'elle que se déduit le solde cumulé. */
function echeance(leaseId: string, paidMinor: number) {
  const maintenant = new Date()
  const mois = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`
  return {
    leaseId,
    periodStart: `${mois}-01T00:00:00.000Z`,
    dueOn: `${mois}-05T00:00:00.000Z`,
    rentMinor: 110000,
    waterMinor: 0,
    powerMinor: 0,
    paidMinor,
    payments: [],
  }
}

function parc() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      leaseCharges: [echeance('bail-u-a1', 110000), echeance('bail-u-a2', 0)],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Essos',
          district: 'Essos',
          units: [
            unite('u-a1', 'A1', 'paid', 'Charles Ngassa', 110000),
            unite('u-a2', 'A2', 'overdue', 'Serge Mbarga', 0, true),
          ],
        },
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
          heldMinor: 220000,
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

describe('les locataires sur bureau', () => {
  it('rend une fiche par locataire, sans tableau, avec ses quatre faits', async () => {
    parc()
    await renderApp('/app/locataires', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    const main = screen.getByRole('main')
    expect(within(main).queryByRole('table')).toBeNull()

    /* `[data-fiche-locataire]` et non `listitem` : la file des demandes de
       pièces est une liste elle aussi, et un parc qui en porte ferait compter
       ses lignes ici. */
    const fiches = Array.from(main.querySelectorAll<HTMLElement>('[data-fiche-locataire]'))
    expect(fiches).toHaveLength(2)

    // La fiche à jour : caution consignée, un chantier ouvert, solde nul.
    const charles = fiches[0]
    expect(within(charles).getByText('Charles Ngassa')).toBeInTheDocument()
    expect(within(charles).getByText(/A1/)).toBeInTheDocument()
    for (const libelle of [/Loyer/, /Caution/, /Solde cumulé/, /Travaux/]) {
      expect(within(charles).getByText(libelle)).toBeInTheDocument()
    }
    expect(within(charles).getByText(/220\s?000/)).toBeInTheDocument()
    expect(within(charles).getByText('1')).toBeInTheDocument()

    // La fiche en retard : le solde porte son signe, et il est dû.
    const serge = fiches[1]
    expect(within(serge).getByText(/En retard/)).toBeInTheDocument()
    expect(within(serge).getByText(/−\s?110\s?000/)).toBeInTheDocument()
    // Aucune caution tenue sur ce logement : un tiret, pas un zéro inventé.
    expect(within(serge).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('cherche et filtre, et dit ce qu’il ne rend pas', async () => {
    /**
     * DIX FICHES TIENNENT À L'ŒIL, CINQUANTE NON.
     *
     * L'écran n'offrait que de faire défiler — pas même la recherche que le
     * parc immobilier a depuis toujours. Nelson l'a demandé le 2026-09-07.
     *
     * LES OPTIONS SE DÉRIVENT DES ÉTATS PRÉSENTS : ce parc de test porte un
     * bail à jour et un impayé, donc trois pastilles et pas cinq. Une liste
     * figée offrirait des filtres vides et, plus grave, en omettrait —
     * un état sans pastille rendrait son locataire inatteignable.
     */
    parc()
    await renderApp('/app/locataires', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    const main = screen.getByRole('main')
    const user = userEvent.setup()
    const fiches = () => Array.from(main.querySelectorAll<HTMLElement>('[data-fiche-locataire]'))

    const groupe = within(main).getByRole('group', { name: /Ce mois|Rent status/i })
    expect(
      within(groupe)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Tous2', 'En retard1', 'À jour1'])

    await user.click(within(groupe).getByRole('button', { name: /En retard/ }))
    expect(fiches()).toHaveLength(1)
    expect(fiches()[0]!.textContent).toContain('Serge Mbarga')

    // La recherche porte sur ce que la fiche MONTRE : le nom, le logement, le
    // numéro. Elle se combine à l'état plutôt que de le remplacer.
    await user.click(within(groupe).getByRole('button', { name: /Tous/ }))
    await user.type(within(main).getByRole('searchbox'), 'A1')
    expect(fiches()).toHaveLength(1)
    expect(fiches()[0]!.textContent).toContain('Charles Ngassa')

    // Ce que le filtre ne rend pas se dit, et le geste pour en sortir efface
    // les DEUX filtres — c'est leur combinaison qui a pu tout écarter.
    await user.clear(within(main).getByRole('searchbox'))
    await user.type(within(main).getByRole('searchbox'), 'zzz')
    expect(fiches()).toHaveLength(0)
    expect(within(main).getByText(/Aucun locataire ne correspond/)).toBeInTheDocument()
    await user.click(within(main).getByRole('button', { name: /Effacer les filtres/ }))
    expect(fiches()).toHaveLength(2)
  })

  it('n’offre la relance que sur un impayé, et la confirme avant d’envoyer', async () => {
    const serveur = parc()
    serveur.quand('POST', `/parks/${PARC}/reminders`, {
      status: 200,
      body: { sent: ['bail-u-a2'], skipped: [] },
    })
    await renderApp('/app/locataires', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    const fiches = Array.from(
      document.querySelectorAll<HTMLElement>('[data-fiche-locataire]'),
    )
    // Un locataire à jour n'a rien à relancer.
    expect(within(fiches[0]).queryByRole('button', { name: /Relancer/ })).toBeNull()

    await userEvent.setup().click(within(fiches[1]).getByRole('button', { name: /Relancer/ }))
    const modale = await screen.findByRole('dialog')
    // Elle SORT : le geste se confirme, avec le nom de qui la reçoit.
    expect(within(modale).getByText('Serge Mbarga')).toBeInTheDocument()
    expect(within(modale).getByText(/déjà relancé aujourd’hui/)).toBeInTheDocument()
  })

  /**
   * L'IDENTITÉ D'ABORD, L'ÉTAT ENSUITE — ET LES DEUX ÉTATS ENSEMBLE.
   *
   * La pastille de paiement partageait la rangée du nom : sur une fiche de
   * 320 px, relevé sur un parc réel le 2026-09-11, le nom se coupait
   * (« DJOUMESSI MAR… ») et « En retard » se pliait sur deux lignes — chacun
   * cédait à l'autre. Elle rejoint « Sans compte » sous l'identité : le nom a
   * toute la largeur, et les deux états de la personne se lisent d'un regard.
   *
   * L'ORDRE DE LECTURE est ce que ce cas éprouve, parce que c'est ce qu'un
   * lecteur d'écran entend : qui, où, comment le joindre, puis ce qui ne va pas.
   */
  it('dit qui, où et comment le joindre avant son état, et range ses deux états ensemble', async () => {
    parc()
    await renderApp('/app/locataires', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    const serge = Array.from(
      document.querySelectorAll<HTMLElement>('[data-fiche-locataire]'),
    )[1]!
    const texte = serge.textContent ?? ''
    const numero = texte.indexOf('+237')
    expect(numero, 'prémisse : le numéro est dans la fiche').toBeGreaterThan(-1)
    expect(texte.indexOf('En retard'), 'l’état se lit avant le numéro').toBeGreaterThan(numero)

    const retard = within(serge).getByText(/En retard/).closest('[data-ton]')
    const sansCompte = within(serge).getByText(/Sans compte/).closest('[data-ton]')
    expect(retard, 'prémisse : la pastille de paiement').not.toBeNull()
    expect(sansCompte, 'prémisse : la pastille sans compte').not.toBeNull()
    expect(retard!.parentElement, 'les deux états vivent sur deux rangées').toBe(
      sansCompte!.parentElement,
    )
  })

  /**
   * LE NUMÉRO SE LIT GROUPÉ, S'APPELLE EXACT, ET SE CHERCHE COMME IL SE LIT.
   *
   * Sous 1024 px c'est `DataTable` qui rend les fiches : même numéro, même
   * forme — deux formes d'un même écran ne l'écrivent pas de deux façons.
   */
  for (const largeur of [1280, 375]) {
    it(`écrit le numéro groupé et appelle le numéro exact, à ${largeur} px`, async () => {
      parc()
      await renderApp('/app/locataires', { session: SESSION, largeur })
      await attendreLeChargement()
      const main = screen.getByRole('main')

      const liens = within(main).getAllByRole('link', { name: '+237 6 77 00 00 00' })
      expect(liens).toHaveLength(2)
      for (const lien of liens) expect(lien).toHaveAttribute('href', 'tel:+237677000000')

      /* Taper ce qu'on LIT doit trouver : la recherche portait sur le brut, et
         « 77 00 00 » recopié de l'écran n'aurait rien rendu. */
      await userEvent.setup().type(within(main).getByRole('searchbox'), '77 00 00')
      expect(within(main).queryByText(/Aucun locataire ne correspond/)).toBeNull()
      expect(within(main).getAllByRole('link', { name: '+237 6 77 00 00 00' })).toHaveLength(2)
    })
  }
})
