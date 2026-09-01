import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * ON CONFIE UN IMMEUBLE, PAS UN PARC — vu du registre des accès.
 *
 * ═══ CE QUE L'ÉCRAN NE DISAIT PAS ═══
 *
 * Le registre disait qui accède, et depuis le lot précédent à quelle FICHE un
 * compte est relié. Sur QUOI il a la main, jamais : un gestionnaire borné à un
 * immeuble sur trois y figurait exactement comme celui qui les gère tous.
 *
 * Et il n'y avait rien à voir, parce qu'il n'y avait rien à borner :
 * `Park.delegation` valait `solo` ou `delegate`, tout ou rien sur le parc
 * entier. Confier le premier immeuble à un cabinet lui ouvrait les trois — les
 * baux, les loyers, les impayés et les cautions de logements dont il n'a jamais
 * entendu parler.
 *
 * ═══ CE QUE CES CAS GARDENT ═══
 *
 *  1. la rangée DIT le périmètre, et la dit dans le bon sens — vide veut dire
 *     « tout le parc », et le lire à l'envers afficherait « aucun immeuble » à
 *     un gestionnaire qui les gère tous ;
 *  2. le geste envoie la liste ENTIÈRE, jamais un ajout : c'est le seul contrat
 *     où deux écrans ouverts ne peuvent pas se contredire ;
 *  3. aucune case cochée est une VALEUR — elle rend le parc entier —, et
 *     l'écran le dit avant qu'on l'apprenne en le faisant ;
 *  4. le geste n'existe que là où il a un objet.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const BON = 'bbbbbbbb-1111-4000-8111-111111111111'
const AKW = 'aaaaaaaa-2222-4000-8222-222222222222'
const DES = 'dddddddd-3333-4000-8333-333333333333'
const S1 = '11111111-4444-4000-8444-444444444444'
const S2 = '22222222-5555-4000-8555-555555555555'

function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

/** Un parc à trois immeubles, un gestionnaire borné à deux, un autre libre. */
const REGISTRE = {
  buildings: [
    {
      id: BON,
      name: 'Résidence Bonamoussadi',
      district: 'Bonamoussadi',
      units: [
        { id: S1, label: 'S1' },
        { id: S2, label: 'S2' },
      ],
    },
    { id: AKW, name: 'Immeuble Akwa Nord', district: 'Akwa', units: [] },
    { id: DES, name: 'Villa Deïdo', district: 'Deïdo', units: [] },
  ],
  members: [
    {
      id: 'm-moi',
      role: 'owner',
      userId: 'u-proprio',
      tenantId: null,
      tenantName: null,
      tenantUnitLabel: null,
      fullName: COMPTE_FICTIF.fullName,
      email: COMPTE_FICTIF.email,
      buildingIds: [],
      since: '2026-08-17T09:00:00.000Z',
    },
    {
      id: 'm-bornee',
      role: 'manager',
      userId: 'u-diane',
      tenantId: null,
      tenantName: null,
      tenantUnitLabel: null,
      fullName: 'Diane Fotso',
      email: 'diane@example.com',
      buildingIds: [BON, AKW],
      unitIds: [],
      since: '2025-01-15T09:00:00.000Z',
    },
    {
      id: 'm-libre',
      role: 'manager',
      userId: 'u-cabinet',
      tenantId: null,
      tenantName: null,
      tenantUnitLabel: null,
      fullName: 'Cabinet Njoya',
      email: 'cabinet@example.com',
      buildingIds: [],
      since: '2025-06-01T09:00:00.000Z',
    },
    {
      id: 'm-studio',
      role: 'manager',
      userId: 'u-studio',
      tenantId: null,
      tenantName: null,
      tenantUnitLabel: null,
      fullName: 'Agence Deïdo',
      email: 'agence@example.com',
      buildingIds: [],
      /* BORNÉE À UN SEUL STUDIO — la maille que ce lot ajoute. */
      unitIds: [S1],
      since: '2025-09-01T09:00:00.000Z',
    },
    {
      id: 'm-locataire',
      role: 'tenant',
      userId: 'u-charles',
      tenantId: 'loc-A1',
      tenantName: 'Charles Ngassa',
      tenantUnitLabel: 'A1',
      fullName: 'Charles Ngassa',
      email: 'charles@example.com',
      buildingIds: [],
      since: '2026-08-18T09:00:00.000Z',
    },
  ],
  invitations: [],
  unlinkedTenants: [],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  serveur.quand('PATCH', `/parks/${PARC}/memberships/m-bornee/immeubles`, {
    status: 200,
    body: { buildingIds: [] },
  })
  serveur.quand('PATCH', `/parks/${PARC}/memberships/m-libre/immeubles`, {
    status: 200,
    body: { buildingIds: [], unitIds: [] },
  })
  serveur.quand('PATCH', `/parks/${PARC}/memberships/m-studio/immeubles`, {
    status: 200,
    body: { buildingIds: [], unitIds: [] },
  })
})

async function ouvrirLesAcces(role: Role = 'owner') {
  await renderApp('/app/acces', { session: sessionDuRole(role) })
  await attendreLeChargement()
}

function rangeeDe(nom: string) {
  const ligne = screen.getByText(nom).closest('tr')
  expect(ligne, `aucune rangée pour ${nom}`).not.toBeNull()
  return ligne!
}

const envoi = () =>
  serveur.appels.find((a) => a.methode === 'PATCH' && a.chemin.includes('/immeubles'))

describe('la rangée dit sur quoi il a la main', () => {
  it('nomme les immeubles confiés, et eux seuls', async () => {
    await ouvrirLesAcces()

    const rangee = within(rangeeDe('Diane Fotso'))
    expect(
      rangee.getByText(/Résidence Bonamoussadi/),
      'un gestionnaire borné figurait exactement comme celui qui gère tout',
    ).toBeInTheDocument()
    expect(rangee.queryByText(/Villa Deïdo/)).not.toBeInTheDocument()
  })

  it('dit « tout le parc » quand rien ne le borne, et non « aucun immeuble »', async () => {
    /* Le sens du vide vient du modèle : le lire à l'envers ici afficherait
       « aucun immeuble » à quelqu'un qui les gère tous. */
    await ouvrirLesAcces()
    expect(within(rangeeDe('Cabinet Njoya')).getByText(/tout le parc/i)).toBeInTheDocument()
  })

  it('ne l’écrit ni pour le propriétaire ni pour le locataire', async () => {
    /* Le propriétaire n'est jamais borné — écrire « gère tout le parc » sur sa
       rangée affirmerait un réglage là où il n'y a qu'une évidence. Le
       locataire est borné par son BAIL, une autre règle. */
    await ouvrirLesAcces()
    expect(within(rangeeDe(COMPTE_FICTIF.fullName)).queryByText(/tout le parc/i)).toBeNull()
    expect(within(rangeeDe('Charles Ngassa')).queryByText(/tout le parc/i)).toBeNull()
  })
})

describe('confier des LOGEMENTS', () => {
  /**
   * LA MAILLE FINE, et ce que la rangée en dit.
   *
   * Le lot de la délégation a posé le périmètre à l'immeuble, en le motivant :
   * « on confie un immeuble à un gestionnaire, pas trois appartements sur
   * huit ». C'est la maille du métier dans le cas général, et elle laisse dehors
   * le cas qui existe : un propriétaire qui confie DEUX studios d'une résidence
   * dont il garde le reste.
   */
  it('nomme le logement AVEC son immeuble, jamais seul', async () => {
    await ouvrirLesAcces()

    /* « S1 » ne dit rien sur un parc de cinq résidences : trois d'entre elles
       ont un S1. Le nom de l'immeuble est ce qui le situe. */
    expect(
      within(rangeeDe('Agence Deïdo')).getByText(/Résidence Bonamoussadi · S1/),
    ).toBeInTheDocument()
  })

  it('envoie les DEUX listes, et le logement coché avec', async () => {
    await ouvrirLesAcces()
    const user = userEvent.setup()

    await user.click(
      within(rangeeDe('Cabinet Njoya')).getByRole('button', { name: 'Confier des immeubles' }),
    )
    const modale = within(screen.getByRole('dialog'))
    await user.click(modale.getByRole('checkbox', { name: 'S2' }))
    await user.click(modale.getByRole('button', { name: 'Confier' }))

    await waitFor(() => expect(envoi()).toBeDefined())
    const corps = envoi()?.corps as { buildingIds: string[]; unitIds: string[] }
    expect(corps.unitIds, 'le logement coché n’est pas parti').toEqual([S2])
    expect(corps.buildingIds).toEqual([])
  })

  it('décocher un logement sous un immeuble coché écrit une EXCLUSION', async () => {
    /* Le lot précédent faisait DISPARAÎTRE ces cases, « pour ne pas inviter à
       décocher en croyant retirer ». Décocher retire VRAIMENT, désormais :
       « tout l'immeuble sauf celui-là », la liste inversée qui SUIT l'immeuble
       quand il grandit. */
    await ouvrirLesAcces()
    const user = userEvent.setup()

    await user.click(
      within(rangeeDe('Cabinet Njoya')).getByRole('button', { name: 'Confier des immeubles' }),
    )
    const modale = within(screen.getByRole('dialog'))
    await user.click(modale.getByRole('checkbox', { name: /Bonamoussadi/ }))
    /* Sous l'immeuble coché, les cases restent — COCHÉES : il voit tout. */
    expect((modale.getByRole('checkbox', { name: 'S1' }) as HTMLInputElement).checked).toBe(true)

    await user.click(modale.getByRole('checkbox', { name: 'S2' }))
    await user.click(modale.getByRole('button', { name: 'Confier' }))

    await waitFor(() => expect(envoi()).toBeDefined())
    const corps = envoi()?.corps as {
      buildingIds: string[]
      unitIds: string[]
      excludedUnitIds: string[]
    }
    expect(corps.buildingIds).toEqual([BON])
    expect(corps.excludedUnitIds, 'la case décochée doit retrancher').toEqual([S2])
    expect(
      corps.unitIds,
      'les logements couverts par l’immeuble ne partent pas en double',
    ).toEqual([])
    })
})

describe('confier des immeubles', () => {
  it('envoie la liste ENTIÈRE, jamais un ajout', async () => {
    await ouvrirLesAcces()
    const user = userEvent.setup()

    await user.click(
      within(rangeeDe('Diane Fotso')).getByRole('button', { name: 'Confier des immeubles' }),
    )
    /* Les deux immeubles déjà confiés sont cochés à l'ouverture : on édite un
       périmètre, on ne le repart pas de zéro. */
    const modale = within(screen.getByRole('dialog'))
    expect((modale.getByRole('checkbox', { name: /Bonamoussadi/ }) as HTMLInputElement).checked).toBe(true)
    expect((modale.getByRole('checkbox', { name: /Deïdo/ }) as HTMLInputElement).checked).toBe(false)

    await user.click(modale.getByRole('checkbox', { name: /Deïdo/ }))
    await user.click(modale.getByRole('button', { name: 'Confier' }))

    await waitFor(() => expect(envoi()).toBeDefined())
    expect(
      (envoi()?.corps as { buildingIds: string[] }).buildingIds.slice().sort(),
      'un envoi partiel laisserait un périmètre que personne n’a voulu',
    ).toEqual([BON, AKW, DES].sort())
  })

  it('rend le parc entier quand on décoche tout, et le DIT avant', async () => {
    await ouvrirLesAcces()
    const user = userEvent.setup()

    await user.click(
      within(rangeeDe('Diane Fotso')).getByRole('button', { name: 'Confier des immeubles' }),
    )
    const modale = within(screen.getByRole('dialog'))
    /* C'est le seul endroit du produit où « rien de sélectionné » veut dire
       « tout ». Le deviner à l'envers retirerait un accès en croyant l'élargir :
       la note le dit à voix haute avant le geste. */
    expect(modale.getByText(/rend le parc entier/i)).toBeInTheDocument()

    await user.click(modale.getByRole('checkbox', { name: /Bonamoussadi/ }))
    await user.click(modale.getByRole('checkbox', { name: /Akwa/ }))
    await user.click(modale.getByRole('button', { name: 'Confier' }))

    await waitFor(() => expect(envoi()).toBeDefined())
    expect((envoi()?.corps as { buildingIds: string[] }).buildingIds).toEqual([])
  })

  it('n’écrit rien quand on annule', async () => {
    /* On édite un BROUILLON : une case cochée ne doit pas atteindre le serveur
       avant qu'on confie. */
    await ouvrirLesAcces()
    const user = userEvent.setup()

    await user.click(
      within(rangeeDe('Diane Fotso')).getByRole('button', { name: 'Confier des immeubles' }),
    )
    const modale = within(screen.getByRole('dialog'))
    await user.click(modale.getByRole('checkbox', { name: /Deïdo/ }))
    await user.click(modale.getByRole('button', { name: 'Annuler' }))

    expect(envoi()).toBeUndefined()
  })

  it('n’est offert ni sur la rangée du propriétaire ni sur celle du locataire', async () => {
    await ouvrirLesAcces()
    const nom = { name: 'Confier des immeubles' }
    expect(within(rangeeDe(COMPTE_FICTIF.fullName)).queryByRole('button', nom)).toBeNull()
    expect(within(rangeeDe('Charles Ngassa')).queryByRole('button', nom)).toBeNull()
  })

  it('n’est offert à personne quand le gestionnaire consulte le registre', async () => {
    /* Un gestionnaire qui élargirait son propre périmètre ne serait pas borné du
       tout. Le serveur le refuse en 403 ; l'écran ne propose pas un geste qu'on
       refusera. */
    await ouvrirLesAcces('manager')
    expect(screen.queryByRole('button', { name: 'Confier des immeubles' })).toBeNull()
  })
})
