import { beforeEach, describe, expect, it } from 'vitest'
import {
  attendreLeChargement,
  cliquerAction,
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UNE MODALE QUI ENREGISTRE ATTEND LA RÉPONSE AVANT DE SE FERMER.
 *
 * Trois modales — encaissement, ajout d'immeuble, ajout de logement — lançaient
 * la requête, se fermaient et annonçaient le succès DANS LE MÊME TOUR, avant que
 * le serveur ait répondu. Sur un réseau qui s'enlise, la personne lisait
 * « Paiement enregistré · quittance envoyée » pendant que la requête était
 * encore en vol ; si elle échouait, un second toast contredisait le premier et
 * le formulaire, déjà réinitialisé, avait perdu ce qui avait été saisi.
 *
 * Neuf autres modales font déjà le bon geste (`loading={envoi}`, fermeture dans
 * le `then`). Cette garde le demande aux trois qui manquaient, et aux deux
 * modales de correction qui montraient l'attente par un simple `disabled` —
 * bouton grisé, sans spinner ni `aria-busy`, ce qu'un lecteur d'écran ne peut
 * pas distinguer d'un bouton interdit.
 *
 * CE QUE LA GARDE MESURE, dans cet ordre : pendant que la réponse est retenue,
 * le bouton d'envoi est `aria-busy`, la modale est encore là, aucun succès n'est
 * annoncé, et une seule requête est partie même si l'on clique deux fois. Une
 * fois la réponse libérée, la modale se ferme et le succès s'annonce. Et sur un
 * échec, la modale reste ouverte avec la saisie intacte.
 */

const PARC = '14141414-4343-4454-8747-585858585858'
const UNITE = 'aaaaaaaa-1111-4000-8111-111111111112'
const BAIL = 'bbbbbbbb-2222-4000-8222-222222222223'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

const PORTEFEUILLE = {
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
          status: 'partial',
          leaseId: BAIL,
          leaseStartsOn: '2025-03-01T00:00:00.000Z',
          paidMinor: 45000,
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

let faux: FauxServeur

beforeEach(() => {
  faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
})

/** Les requêtes parties vers un chemin, pour compter les envois. */
const envoisVers = (methode: string, fin: string) =>
  faux.appels.filter((a) => a.methode === methode && a.chemin.endsWith(fin))

/**
 * Ce que toute modale d'enregistrement doit montrer pendant l'attente, puis
 * après la réponse. `ouvrir` libère la réponse retenue par le faux serveur.
 */
async function attendPuisSeFerme(
  dialogue: HTMLElement,
  envoyer: HTMLElement,
  ouvrir: () => void,
  requete: { methode: string; fin: string },
) {
  const clavier = userEvent.setup()
  await clavier.click(envoyer)
  await waitFor(() => expect(envoyer).toHaveAttribute('aria-busy', 'true'))
  expect(dialogue).toBeInTheDocument()

  // Le second clic, pendant l'attente, ne repart pas.
  await clavier.click(envoyer)
  expect(envoisVers(requete.methode, requete.fin)).toHaveLength(1)

  ouvrir()
  await waitFor(() => expect(dialogue).not.toBeInTheDocument())
}

describe('l’encaissement', () => {
  async function ouvrirEtRemplir() {
    await renderApp('/app/paiements', { session: SESSION })
    await attendreLeChargement()
    await cliquerAction(/Enregistrer un paiement/)
    const dialogue = screen.getByRole('dialog')
    const clavier = userEvent.setup()
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Montant/ }), '100000')
    return { dialogue, envoyer: within(dialogue).getByRole('button', { name: 'Enregistrer' }) }
  }

  it('attend la réponse avant de se fermer et d’annoncer la quittance', async () => {
    const ouvrir = faux.retenir('POST', `/parks/${PARC}/payments`, {
      status: 201,
      body: { payment: { id: 'p-1' } },
    })
    const { dialogue, envoyer } = await ouvrirEtRemplir()
    await attendPuisSeFerme(dialogue, envoyer, ouvrir, { methode: 'POST', fin: '/payments' })
    expect(await screen.findByText(/Paiement enregistré/)).toBeInTheDocument()
  })

  it('ne dit pas « enregistré » tant que rien ne l’est', async () => {
    faux.retenir('POST', `/parks/${PARC}/payments`, { status: 201, body: { payment: { id: 'p-1' } } })
    const { envoyer } = await ouvrirEtRemplir()
    await userEvent.setup().click(envoyer)
    await waitFor(() => expect(envoyer).toHaveAttribute('aria-busy', 'true'))
    expect(screen.queryByText(/Paiement enregistré/)).not.toBeInTheDocument()
  })

  it('garde la saisie ouverte et intacte quand le serveur refuse', async () => {
    faux.quand('POST', `/parks/${PARC}/payments`, { status: 500, body: { error: 'boom' } })
    const { dialogue, envoyer } = await ouvrirEtRemplir()
    await userEvent.setup().click(envoyer)
    expect(await screen.findByText(/Rien n’a été enregistré/)).toBeInTheDocument()
    expect(dialogue).toBeInTheDocument()
    expect(within(dialogue).getByRole('textbox', { name: /Montant/ })).toHaveValue('100000')
    expect(screen.queryByText(/Paiement enregistré/)).not.toBeInTheDocument()
    // Et le bouton est rendu : on peut réessayer.
    expect(envoyer).not.toHaveAttribute('aria-busy')
  })
})

describe('l’ajout d’un immeuble', () => {
  it('attend la réponse avant de se fermer', async () => {
    const ouvrir = faux.retenir('POST', `/parks/${PARC}/buildings`, {
      status: 201,
      body: { building: { id: 'imm-2', name: 'Villa Bastos', district: 'Bastos' } },
    })
    await renderApp('/app/parc', { session: SESSION })
    await attendreLeChargement()
    await cliquerAction(/Ajouter un immeuble/)
    const dialogue = screen.getByRole('dialog')
    const clavier = userEvent.setup()
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Nom/ }), 'Villa Bastos')
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Quartier/ }), 'Bastos')
    await attendPuisSeFerme(
      dialogue,
      within(dialogue).getByRole('button', { name: 'Enregistrer' }),
      ouvrir,
      { methode: 'POST', fin: '/buildings' },
    )
    expect(await screen.findByText('Villa Bastos')).toBeInTheDocument()
  })

  it('reste ouvert avec la saisie quand le serveur refuse', async () => {
    faux.quand('POST', `/parks/${PARC}/buildings`, { status: 500, body: { error: 'boom' } })
    await renderApp('/app/parc', { session: SESSION })
    await attendreLeChargement()
    await cliquerAction(/Ajouter un immeuble/)
    const dialogue = screen.getByRole('dialog')
    const clavier = userEvent.setup()
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Nom/ }), 'Villa Bastos')
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Quartier/ }), 'Bastos')
    await clavier.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/Rien n’a été enregistré/)).toBeInTheDocument()
    expect(dialogue).toBeInTheDocument()
    expect(within(dialogue).getByRole('textbox', { name: /Nom/ })).toHaveValue('Villa Bastos')
  })
})

describe('l’ajout d’un logement', () => {
  it('attend la réponse avant de se fermer', async () => {
    const ouvrir = faux.retenir('POST', `/parks/${PARC}/buildings/imm-1/units`, {
      status: 201,
      body: { unit: { id: 'u-b1' } },
    })
    await renderApp('/app/parc', { session: SESSION })
    await attendreLeChargement()
    await cliquerAction(/Ajouter un logement/)
    const dialogue = screen.getByRole('dialog')
    const clavier = userEvent.setup()
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Numéro/ }), 'B1')
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Surface/ }), '40')
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Loyer/ }), '90000')
    await attendPuisSeFerme(
      dialogue,
      within(dialogue).getByRole('button', { name: 'Enregistrer' }),
      ouvrir,
      { methode: 'POST', fin: '/units' },
    )
  })
})

describe('la correction d’un immeuble', () => {
  it('montre l’attente par aria-busy, pas par un bouton simplement grisé', async () => {
    const ouvrir = faux.retenir('PATCH', `/parks/${PARC}/buildings/imm-1`, {
      status: 200,
      body: { building: { id: 'imm-1', name: 'Résidence Essos II', district: 'Essos' } },
    })
    await renderApp('/app/parc', { session: SESSION })
    await attendreLeChargement()
    await cliquerAction(/Corriger l’immeuble/)
    const dialogue = screen.getByRole('dialog')
    const clavier = userEvent.setup()
    await clavier.type(within(dialogue).getByRole('textbox', { name: /Nom/ }), ' II')
    await attendPuisSeFerme(
      dialogue,
      within(dialogue).getByRole('button', { name: 'Enregistrer' }),
      ouvrir,
      { methode: 'PATCH', fin: '/buildings/imm-1' },
    )
  })
})
