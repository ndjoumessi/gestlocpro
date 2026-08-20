import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import type { Role } from '@/features/auth/signupState'

/**
 * LE REGISTRE DES ACCÈS.
 *
 * Les routes existaient depuis deux lots sans écran : voir les membres,
 * reprendre un code, retirer un accès se faisaient en `curl`. Le premier
 * ménage de codes de test a dû se faire à la main dans la base de production,
 * faute de cette page — c'est la meilleure mesure de ce qui manquait.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const MOI = 'm-moi'
const AUTRE = 'm-diane'
const CODE_LOC = 'i-loc'
const CODE_GES = 'i-ges'

function sessionDuRole(role: Role): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Le registre tel que le serveur le rend, avec ses deux membres et ses deux codes. */
const REGISTRE = {
  members: [
    {
      id: MOI,
      role: 'owner',
      fullName: COMPTE_FICTIF.fullName,
      // La MÊME adresse que la session : c'est ce qui identifie sa propre ligne.
      email: COMPTE_FICTIF.email,
      since: '2026-01-15T09:00:00.000Z',
    },
    {
      id: AUTRE,
      role: 'manager',
      fullName: 'Diane Mballa',
      email: 'diane@example.com',
      since: '2026-03-02T09:00:00.000Z',
    },
  ],
  invitations: [
    {
      id: CODE_LOC,
      role: 'tenant',
      codeHint: 'ANEW',
      expiresAt: '2026-09-02T10:00:00.000Z',
      issuedAt: '2026-08-19T10:00:00.000Z',
      unitId: 'u-a1',
      unitLabel: 'A1',
    },
    {
      id: CODE_GES,
      role: 'manager',
      codeHint: 'KBPA',
      expiresAt: '2026-09-02T10:00:00.000Z',
      issuedAt: '2026-08-19T10:00:00.000Z',
      unitId: null,
      unitLabel: null,
    },
  ],
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
})

async function ouvrir(role: Role) {
  renderApp('/app/acces', { session: sessionDuRole(role) })
  /**
   * ON ATTEND UNE DONNÉE DU REGISTRE, ET NON LE TITRE.
   *
   * `RegistreEnChargement` rend le MÊME `PageHeader`, avec le même titre, que
   * l'écran chargé — et c'est un bon parti pris d'interface, qui évite au
   * contenu de sauter quand les données arrivent. Mais il rendait cette attente
   * creuse : `findByRole('heading')` se satisfaisait du squelette, donc de
   * l'état où le registre n'est pas encore là. Ce n'était pas un point de
   * synchronisation, seulement l'apparence d'un.
   *
   * Les assertions synchrones qui suivent — `getByText` sur des lignes venues
   * d'un `fetch` — couraient donc contre la résolution de la promesse. Six
   * exécutions sur vingt tombaient, sur CINQ cas différents : ce n'était pas un
   * cas fragile, c'était le fichier entier qui tirait au sort.
   *
   * `attendreLeChargement` est le point de synchronisation du harnais depuis
   * toujours : il attend la disparition des régions `aria-busy`. Il était
   * AVEUGLE ici, l'écran des accès rendant son squelette nu — c'est corrigé du
   * même geste, et l'attente ne dépend plus d'une donnée choisie à la main.
   */
  await attendreLeChargement()
}

describe('le registre des accès', () => {
  it('annonce son attente, au lieu de se taire jusqu’aux données', async () => {
    /**
     * SANS `await` : on regarde le PREMIER rendu, celui où le registre n'est pas
     * encore arrivé.
     *
     * L'écran rendait alors un squelette nu — ni `role="status"` ni `aria-busy`,
     * donc muet aux technologies d'assistance pendant toute l'attente. Les onze
     * autres écrans l'annoncent ; celui-ci était le seul à ne pas le faire.
     *
     * Le manque avait un second effet, celui par lequel il a été trouvé.
     * `PageHeader` étant rendu à l'identique dans les deux états, RIEN ne
     * distinguait l'attente du chargé : `attendreLeChargement()` — qui guette la
     * disparition des régions `aria-busy` — rendait la main immédiatement, et
     * les assertions couraient contre le `fetch`. Six exécutions sur vingt
     * tombaient, sur cinq cas différents. Ce cas-ci est la garde qui empêche la
     * course de se rouvrir.
     */
    renderApp('/app/acces', { session: sessionDuRole('owner') })
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()

    // Puis on laisse l'écran finir, pour ne pas laisser un rendu en vol.
    await attendreLeChargement()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('montre qui détient une clé, et à quel titre', async () => {
    await ouvrir('owner')

    expect(screen.getByText('Diane Mballa')).toBeInTheDocument()
    expect(screen.getByText('diane@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('Gestionnaire').length).toBeGreaterThan(0)
    expect(screen.getByText('Propriétaire')).toBeInTheDocument()
  })

  it('montre les codes par leur indice, jamais en clair', async () => {
    await ouvrir('owner')

    /**
     * `codeHint` trouve ici sa raison d'être : écrit à chaque émission depuis
     * l'origine du produit, il n'avait jamais été relu. Seule l'empreinte du
     * code est en base — l'indice sert à RECONNAÎTRE un code qu'on a transmis,
     * pas à le retrouver.
     */
    expect(screen.getByText('••••-ANEW')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('Sans logement rattaché')).toBeInTheDocument()
  })

  it('n’offre pas au propriétaire de se retirer lui-même', async () => {
    await ouvrir('owner')

    // Le serveur refuse l'auto-retrait — un parc dont le dernier propriétaire
    // est parti n'est plus atteignable. L'écran ne propose pas ce qu'on
    // refusera. Les DEUX moitiés : pas de bouton sur sa ligne, un bouton sur
    // celle du gestionnaire.
    const sienne = screen.getByText(COMPTE_FICTIF.email).closest('tr')!
    expect(within(sienne).queryByRole('button', { name: /Retirer l’accès/ })).not.toBeInTheDocument()

    const celle = screen.getByText('diane@example.com').closest('tr')!
    expect(within(celle).getByRole('button', { name: /Retirer l’accès/ })).toBeInTheDocument()
  })

  it('retire un accès, puis relit le registre auprès du serveur', async () => {
    await ouvrir('owner')
    serveur.quand('PATCH', `/parks/${PARC}/memberships/${AUTRE}/revoke`, { status: 204 })
    serveur.quand('GET', `/parks/${PARC}/access`, {
      status: 200,
      body: { ...REGISTRE, members: [REGISTRE.members[0]] },
    })

    const celle = screen.getByText('diane@example.com').closest('tr')!
    await userEvent.setup().click(within(celle).getByRole('button', { name: /Retirer l’accès/ }))

    // La liste est RELUE et non retouchée en mémoire : entre-temps, un second
    // onglet a pu retirer quelqu'un d'autre, et seul le serveur sait ce qui
    // reste.
    await screen.findByText('Accès retiré')
    await waitFor(() => expect(screen.queryByText('Diane Mballa')).not.toBeInTheDocument())

    // DEUX lectures : celle du montage, et celle qui suit le geste.
    const lectures = serveur.appels.filter(
      (a) => a.methode === 'GET' && a.chemin === `/parks/${PARC}/access`,
    )
    expect(lectures).toHaveLength(2)
  })

  it('reprend un code en attente', async () => {
    await ouvrir('owner')
    serveur.quand('PATCH', `/parks/${PARC}/invitations/${CODE_LOC}/revoke`, { status: 204 })

    const ligne = screen.getByText('••••-ANEW').closest('tr')!
    await userEvent.setup().click(within(ligne).getByRole('button', { name: /Reprendre/ }))

    await screen.findByText(/Code repris/)
    const appel = serveur.appels.find((a) => a.methode === 'PATCH' && a.chemin.includes(CODE_LOC))
    expect(appel).toBeDefined()
  })
})

describe('ce que le gestionnaire y voit', () => {
  it('lui laisse le registre, et lui retire les gestes du propriétaire', async () => {
    await ouvrir('manager')

    // Il VOIT tout — c'est la moitié sans laquelle un écran vide passerait.
    expect(screen.getByText('Diane Mballa')).toBeInTheDocument()
    expect(screen.getByText('••••-ANEW')).toBeInTheDocument()
    // Et il ne retire personne.
    expect(screen.queryAllByRole('button', { name: /Retirer l’accès/ })).toHaveLength(0)
  })

  it('lui laisse reprendre un code de locataire, pas un code de gestionnaire', async () => {
    await ouvrir('manager')

    // Le partage du lot précédent, dans l'autre sens : annuler le recrutement
    // décidé par le propriétaire lui rendrait la main sur le recrutement.
    const locataire = screen.getByText('••••-ANEW').closest('tr')!
    expect(within(locataire).getByRole('button', { name: /Reprendre/ })).toBeInTheDocument()

    const gestionnaire = screen.getByText('••••-KBPA').closest('tr')!
    expect(within(gestionnaire).queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument()
  })

  it('lui dit qui retire les accès, plutôt que de le laisser deviner', async () => {
    await ouvrir('manager')
    expect(screen.getByText(/Seul le propriétaire retire un accès/)).toBeInTheDocument()
  })

  it('garde cette note pour le seul gestionnaire', async () => {
    await ouvrir('owner')
    expect(screen.queryByText(/Seul le propriétaire retire un accès/)).not.toBeInTheDocument()
  })
})

describe('l’état vide du registre', () => {
  it('dit ce que la liste ne montre pas, quand elle est vide', async () => {
    serveur.quand('GET', `/parks/${PARC}/access`, {
      status: 200,
      body: { members: REGISTRE.members, invitations: [] },
    })
    await ouvrir('owner')

    // Un code consommé, repris ou périmé n'y figure pas : sans cette phrase, un
    // propriétaire qui vient de transmettre un code et ne le voit plus croirait
    // l'avoir perdu.
    expect(screen.getByText('Aucun code en attente')).toBeInTheDocument()
    expect(screen.getByText(/ne montre que ce qui ouvre encore/)).toBeInTheDocument()
  })
})
