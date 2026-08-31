import { beforeEach, describe, expect, it } from 'vitest'
import {
  attendreLeChargement,
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA FICHE SE CRÉE RELIÉE, QUAND LE COMPTE EST DÉJÀ LÀ.
 *
 * ═══ ON S'ATTAQUE À LA CAUSE, PAS AU SYMPTÔME ═══
 *
 * Deux lots ont payé les conséquences de l'orphelin : « relier à une fiche »
 * sur le registre des accès, puis le code qui rattache un membre déjà entré.
 * Les deux RÉPARENT ; aucun n'empêche. Et l'ordre qui fabrique l'orphelin est
 * celui que le produit RECOMMANDE — « sans logement, il rejoint le parc sans
 * bail, vous l'y rattacherez ensuite ». On invite, le compte entre, on crée la
 * fiche, et la fiche ne regardait pas qui est déjà là.
 *
 * ═══ CE QUE L'ÉCRAN DOIT MONTRER, ET CE QU'IL NE DOIT PAS ═══
 *
 * Le champ ne paraît QUE s'il y a quelqu'un à relier. Un menu vide sur chaque
 * création — le cas courant de tout parc qu'on reprend en main, où personne n'a
 * encore de compte — serait un champ qui ne mène nulle part, sur la modale la
 * plus utilisée de l'écran.
 *
 * Et il ne propose QUE des membres SANS fiche : proposer quelqu'un de déjà relié
 * offrirait un geste que le serveur refuse par `account_already_linked`. On ne
 * propose pas ce qu'on refusera — c'est la règle que cet écran applique déjà au
 * code de gestionnaire.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

/** Un logement VACANT : la modale ne s'ouvre que s'il y a où loger quelqu'un. */
const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Residence Djoumessi',
      district: 'Bastos',
      units: [
        {
          id: 'u-a1',
          label: 'A1',
          type: 'T2',
          surfaceSqm: 100,
          rentMinor: 32798,
          tenant: null,
          status: 'vacant',
          leaseId: null,
          leaseStartsOn: null,
          paidMinor: 0,
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

/** Le registre : un propriétaire relié, un locataire membre SANS fiche. */
const REGISTRE = {
  members: [
    {
      id: 'm-moi',
      role: 'owner',
      fullName: COMPTE_FICTIF.fullName,
      email: COMPTE_FICTIF.email,
      since: '2026-01-15T09:00:00.000Z',
      userId: 'u-proprio',
      tenantId: null,
    },
    {
      id: 'm-landry',
      role: 'tenant',
      fullName: 'Bekono Landry',
      email: 'romel@example.com',
      since: '2026-08-18T09:00:00.000Z',
      userId: 'u-landry',
      tenantId: null,
    },
    {
      id: 'm-charles',
      role: 'tenant',
      fullName: 'Eloundou Charles',
      email: 'charles@example.com',
      since: '2026-08-18T09:00:00.000Z',
      userId: 'u-charles',
      // DÉJÀ RELIÉ : le serveur refuserait, l'écran ne doit pas le proposer.
      tenantId: 'loc-charles',
    },
  ],
  invitations: [],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
  serveur.quand('POST', `/parks/${PARC}/tenants`, { status: 201, body: { lease: { id: 'b-1' } } })
})

async function ouvrirLaCreation() {
  await renderApp('/app/locataires', { session: SESSION })
  await attendreLeChargement()
  const utilisateur = userEvent.setup()
  await utilisateur.click(screen.getByRole('button', { name: /créer une fiche locataire/i }))
  await screen.findByRole('dialog')
  return utilisateur
}

describe('créer une fiche pour un compte déjà membre', () => {
  it('propose les membres sans fiche, et eux seuls', async () => {
    await ouvrirLaCreation()

    const menu = await screen.findByRole('combobox', { name: /compte/i })
    expect(within(menu).getByRole('option', { name: /Bekono Landry/ })).toBeInTheDocument()
    // Déjà relié — le serveur rendrait `account_already_linked`.
    expect(within(menu).queryByRole('option', { name: /Eloundou Charles/ })).not.toBeInTheDocument()
    // Le propriétaire n'a pas de fiche — `not_a_tenant`.
    expect(within(menu).queryByRole('option', { name: new RegExp(COMPTE_FICTIF.fullName) })).not.toBeInTheDocument()
  })

  it('envoie le compte choisi avec la fiche', async () => {
    const utilisateur = await ouvrirLaCreation()

    await utilisateur.type(screen.getByLabelText(/nom complet/i), 'Bekono Landry')
    // Le téléphone est REQUIS : sans lui, `submit` sort avant l'appel, et le
    // cas mesurerait la validation au lieu du compte.
    await utilisateur.type(screen.getByLabelText(/téléphone/i), '677000001')
    const menu = screen.getByRole('combobox', { name: /compte/i })
    await utilisateur.selectOptions(menu, 'u-landry')
    await utilisateur.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      const appel = serveur.appels.find(
        (a) => a.methode === 'POST' && a.chemin === `/parks/${PARC}/tenants`,
      )
      expect(appel, 'la fiche n’est pas créée').toBeDefined()
      expect(
        (appel!.corps as { userId?: string }).userId,
        'la fiche part sans le compte choisi : elle naîtra orpheline',
      ).toBe('u-landry')
    })
  })

  it('n’envoie aucun compte quand on n’en choisit pas', async () => {
    const utilisateur = await ouvrirLaCreation()

    // Le cas COURANT de tout parc qu'on reprend en main : le locataire n'a pas
    // encore de compte. Exiger un choix le rendrait impossible à déclarer.
    await utilisateur.type(screen.getByLabelText(/nom complet/i), 'Ondoa Pierre')
    await utilisateur.type(screen.getByLabelText(/téléphone/i), '677000002')
    await utilisateur.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      const appel = serveur.appels.find(
        (a) => a.methode === 'POST' && a.chemin === `/parks/${PARC}/tenants`,
      )
      expect(appel).toBeDefined()
      expect(appel!.corps).not.toHaveProperty('userId')
    })
  })

  it('retire le champ quand personne n’est à relier', async () => {
    /* Un menu vide sur chaque création serait un champ qui ne mène nulle part,
       sur la modale la plus utilisée de l'écran. */
    serveur.quand('GET', `/parks/${PARC}/access`, {
      status: 200,
      body: { members: [REGISTRE.members[0]], invitations: [] },
    })
    await ouvrirLaCreation()

    expect(screen.queryByRole('combobox', { name: /compte/i })).not.toBeInTheDocument()
  })
})
