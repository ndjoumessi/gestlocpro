import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN LOGEMENT QUI PORTE DÉJÀ UN CODE VIVANT NE SE PROPOSE PLUS.
 *
 * ═══ CE QUE LA MODALE OFFRAIT, ET QUE LE SERVEUR REFUSE ═══
 *
 * La migration `bail_unique_par_unite` pose un index unique partiel sur
 * `Invitation.unitId` là où `acceptedAt` et `revokedAt` sont nuls : UN SEUL code
 * vivant par logement. La règle est bonne — deux codes valides pour un seul
 * accès, on ne saurait plus lequel reprendre — et le serveur la traduit en 409
 * `invitation_pending`.
 *
 * La modale, elle, listait TOUT le parc. Un propriétaire dont le code pour A1
 * attend encore dans le registre voyait « A1 — BEKONO LANDRY » dans le menu,
 * le choisissait, et récoltait un refus. Signalé sur la production dans ces
 * termes : « je vois encore A1, donc je peux encore générer le code, alors que
 * le premier est toujours là — ce n'est pas logique ».
 *
 * C'est la règle que cet écran applique déjà au code de gestionnaire, et au
 * bouton « Prévenir » du fichier des locataires : ON NE PROPOSE PAS UN GESTE
 * QU'ON REFUSERA. Elle valait ici aussi.
 *
 * ═══ ET LE MENU NE SE CONTENTE PAS DE RÉTRÉCIR ═══
 *
 * Un logement qui disparaît sans un mot se lit comme une panne — c'est le
 * défaut que ce dépôt a retiré du champ de rôle, où « le champ disparaît, et
 * une note dit qui recrute ». La note nomme donc les logements retirés et
 * l'écran où l'on reprend leur code.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [
    { parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF', delegation: 'delegate' },
  ],
}

/** Le parc de la production : A1 loué, B1 loué, B2 vacant. */
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
          tenant: { id: 'loc-landry', fullName: 'Bekono Landry', phoneE164: null },
          status: 'paid',
          leaseId: 'bail-a1',
          leaseStartsOn: '2026-08-18T00:00:00.000Z',
          paidMinor: 32798,
          overdueDays: null,
        },
        {
          id: 'u-b1',
          label: 'B1',
          type: 'T3',
          surfaceSqm: 120,
          rentMinor: 69997,
          tenant: { id: 'loc-martial', fullName: 'Djoumessi Martial', phoneE164: null },
          status: 'pending',
          leaseId: 'bail-b1',
          leaseStartsOn: '2026-08-18T00:00:00.000Z',
          paidMinor: 0,
          overdueDays: null,
        },
        {
          id: 'u-b2',
          label: 'B2',
          type: 'T2',
          surfaceSqm: 90,
          rentMinor: 30000,
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

/** Un code EN ATTENTE sur A1 — celui de la capture de production. */
const REGISTRE = {
  members: [
    {
      id: 'm-moi',
      role: 'owner',
      fullName: COMPTE_FICTIF.fullName,
      email: COMPTE_FICTIF.email,
      since: '2026-08-17T09:00:00.000Z',
      userId: 'u-proprio',
      tenantId: null,
    },
  ],
  invitations: [
    {
      id: 'i-a1',
      role: 'tenant',
      codeHint: 'Q55P',
      expiresAt: '2026-09-14T10:00:00.000Z',
      issuedAt: '2026-08-31T10:00:00.000Z',
      unitId: 'u-a1',
      unitLabel: 'A1',
    },
  ],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  serveur.quand('GET', `/parks/${PARC}/access`, { status: 200, body: REGISTRE })
  serveur.quand('POST', `/parks/${PARC}/invitations`, {
    status: 201,
    body: { code: 'LOC-1234-5678', envoye: false },
  })
})

async function ouvrirLInvitation() {
  await renderApp('/app/acces', { session: SESSION })
  await attendreLeChargement()
  const utilisateur = userEvent.setup()
  await utilisateur.click(screen.getByRole('button', { name: 'Inviter par code' }))
  await screen.findByRole('dialog')
  return utilisateur
}

describe('un seul code vivant par logement', () => {
  it('retire du menu le logement dont le code attend encore', async () => {
    await ouvrirLInvitation()

    const menu = await screen.findByRole('combobox', { name: /Logement/ })
    expect(
      within(menu).queryByRole('option', { name: /A1/ }),
      'A1 est proposé alors que son code attend : le serveur rendra 409',
    ).not.toBeInTheDocument()
  })

  it('laisse les autres logements, code ou pas', async () => {
    await ouvrirLInvitation()

    // La moitié sans laquelle tout retirer satisferait le cas précédent.
    const menu = await screen.findByRole('combobox', { name: /Logement/ })
    expect(within(menu).getByRole('option', { name: /B1/ })).toBeInTheDocument()
    expect(within(menu).getByRole('option', { name: /B2/ })).toBeInTheDocument()
  })

  it('dit lesquels ont été retirés, et où reprendre leur code', async () => {
    await ouvrirLInvitation()

    /* Un logement qui disparaît sans un mot se lit comme une panne — le défaut
       même que ce dépôt a retiré du champ de rôle. */
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getByText(/A1/)).toBeInTheDocument()
    expect(
      within(dialogue).getByText(/code.*attend|attend.*code|déjà un code/i),
      'rien ne dit pourquoi A1 manque',
    ).toBeInTheDocument()
  })
})
