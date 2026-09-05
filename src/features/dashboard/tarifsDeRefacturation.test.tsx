import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within, cliquerAction } from '@/test/render'
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
    await renderApp('/app/releves', { session: sessionDuRole('owner') })
    await attendreLeChargement()

    expect(await screen.findByText(/610/)).toBeInTheDocument()
    expect(screen.getByText(/112/)).toBeInTheDocument()
    expect(screen.queryByText(/520/)).not.toBeInTheDocument()
  })

  it('disparaissent quand le parc n’en a posé aucun', async () => {
    servir({ water: null, power: null })
    await renderApp('/app/releves', { session: sessionDuRole('owner') })
    await attendreLeChargement()

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
    // `closest` et non deux sauts de parent : la carte a gagné un niveau
    // intermédiaire le jour où les indicateurs ont pris une tuile d'icône, et ce
    // cas s'est alors mis à lire l'intitulé au lieu de la carte. Un chemin qui
    // compte les sauts mesure la structure ; celui-ci nomme sa cible.
    const total = screen.getByText('Total refacturé').closest('[data-indicateur]')!
    expect(total.textContent).toContain('—')
    expect(total.textContent).not.toMatch(/0\s?FCFA/)
  })
})

describe('ce que le locataire lit de ses charges', () => {
  it('voit son montant quand le prix existe', async () => {
    servir({ water: 610, power: 112 })
    await renderApp('/app/mon-espace', { session: sessionDuRole('tenant') })
    await attendreLeChargement()

    // 16 m³ à 610 : la moitié positive, sans laquelle un écran qui n'afficherait
    // plus jamais de montant satisferait le cas suivant.
    expect(await screen.findByText(/9\s?760/)).toBeInTheDocument()
  })

  it('lit un tiret plutôt qu’un montant que personne ne lui a accordé', async () => {
    servir({ water: null, power: null })
    await renderApp('/app/mon-espace', { session: sessionDuRole('tenant') })
    await attendreLeChargement()

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
    /*
      ON REMONTE À LA CARTE PAR SON MARQUEUR, et c'est le gain de ce lot.

      `parentElement` désignait la boîte qui entoure l'intitulé — une carte
      écrite à la main n'offrait rien de mieux. Elle passe désormais par
      `StatCard`, donc elle PORTE `data-indicateur`, et le cas peut viser la
      carte plutôt qu'un saut de parent qui casse au premier niveau
      intermédiaire. C'est exactement ce que ce commentaire réclamait juste
      au-dessus : « un motif de vérification doit désigner ce qu'il vise ».
    */
    const eau = screen.getByText('Eau').closest('[data-indicateur]')!
    expect(eau.textContent).toContain('—')
    expect(eau.textContent).not.toContain('FCFA')
  })
})

describe('poser un prix', () => {
  beforeEach(() => {
    servir({ water: null, power: null })
    serveur.quand('GET', `/parks/${PARC}/tariffs`, { status: 200, body: { tariffs: [] } })
  })

  async function ouvrirLesTarifs() {
    await renderApp('/app/releves', { session: sessionDuRole('owner') })
    await attendreLeChargement()
    await cliquerAction('Prix de refacturation')
    return screen.findByRole('dialog')
  }

  it('n’est proposé qu’au propriétaire', async () => {
    await renderApp('/app/releves', { session: sessionDuRole('manager') })
    await attendreLeChargement()

    // Fixer un prix engage l'argent du locataire — même partage que la
    // validation d'un devis. Le serveur refuse déjà ; l'écran ne propose pas.
    expect(screen.queryByRole('button', { name: 'Prix de refacturation' })).not.toBeInTheDocument()
  })

  it('dit ce qu’un parc sans prix affiche, plutôt que de montrer une liste vide', async () => {
    const dialogue = await ouvrirLesTarifs()
    expect(
      within(dialogue).getByText(/Aucun prix posé. Les relevés affichent les quantités/),
    ).toBeInTheDocument()
  })

  it('envoie le prix saisi, daté', async () => {
    const dialogue = await ouvrirLesTarifs()
    serveur.quand('POST', `/parks/${PARC}/tariffs`, {
      status: 201,
      body: {
        tariff: { id: 't-1', utility: 'water', unitPriceMinor: 610, effectiveFrom: '2026-08-01' },
      },
    })

    const user = userEvent.setup()
    await user.type(within(dialogue).getByLabelText(/Prix unitaire/), '610')
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer ce prix' }))
    await screen.findByText('Prix enregistré')

    const appel = serveur.appels.find((a) => a.methode === 'POST' && a.chemin.endsWith('/tariffs'))
    expect(appel?.corps).toMatchObject({ utility: 'water', unitPriceMinor: 610 })
    // La date d'effet part au format jour, jamais un instant : un tarif entre
    // en vigueur un jour, et le lire à travers un fuseau le décalerait.
    /* `!` ET NON `?.` : le `toMatchObject` du dessus a déjà échoué si l'appel
       manquait. Voir `immeublesConfies.test.tsx` pour le raisonnement entier. */
    expect((appel!.corps as { effectiveFrom: string }).effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('refuse un prix nul avant même d’appeler', async () => {
    const dialogue = await ouvrirLesTarifs()
    const user = userEvent.setup()
    await user.type(within(dialogue).getByLabelText(/Prix unitaire/), '0')
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer ce prix' }))

    // « Je refacture gratuitement » se dit en ne posant pas de prix : un zéro
    // afficherait « 0 FCFA » sous les yeux du locataire.
    await screen.findByText(/prix entier supérieur à zéro/)
    expect(serveur.appels.some((a) => a.methode === 'POST' && a.chemin.endsWith('/tariffs'))).toBe(
      false,
    )
  })

  it('explique le refus d’un doublon, au lieu d’une panne', async () => {
    const dialogue = await ouvrirLesTarifs()
    serveur.quand('POST', `/parks/${PARC}/tariffs`, {
      status: 409,
      body: { error: 'tariff_exists' },
    })

    const user = userEvent.setup()
    await user.type(within(dialogue).getByLabelText(/Prix unitaire/), '610')
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer ce prix' }))

    // Le 409 a une cause précise et un remède précis. Le confondre avec « une
    // action a échoué » obligerait à deviner ce qu'il faut changer.
    expect(await screen.findByText(/Un prix existe déjà pour cette énergie/)).toBeInTheDocument()
  })

  /**
   * LE LIBELLÉ DIT LA CAUSE, et les deux causes n'appellent pas le même geste.
   *
   * La colonne affichait « Relevé manquant » aussi bien quand le relevé
   * manquait que quand le TARIF n'était pas fixé. Or un relevé manquant
   * déclenche une tournée — l'écran chiffre lui-même ce coût — tandis qu'un
   * tarif se saisit en trente secondes sans que personne se déplace. Envoyer
   * quelqu'un sur le terrain parce qu'un prix n'a pas été saisi est le genre de
   * méprise qu'un libellé approximatif finance.
   */
  it('distingue un tarif non fixé d’un relevé manquant', async () => {
    servir({ water: null, power: null })
    await renderApp('/app/releves', { session: sessionDuRole('owner') })
    await attendreLeChargement()

    // Les relevés SONT là — c'est le tarif qui manque.
    expect(await screen.findByText('16')).toBeInTheDocument()
    expect(screen.getAllByText('Tarif non fixé').length).toBeGreaterThan(0)
    expect(screen.queryByText('Relevé manquant')).toBeNull()
  })
})