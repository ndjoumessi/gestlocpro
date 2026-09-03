import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * ON DISAIT À UN GESTIONNAIRE DE CRÉER CE QU'ON AVAIT OMIS DE LUI CONFIER.
 *
 * ═══ CE QU'IL LISAIT ═══
 *
 * Un gestionnaire dont l'adhésion naît `declared` ne voit RIEN tant qu'on ne lui
 * a rien confié — c'est la doctrine, et le serveur l'applique. Sur l'écran du
 * parc, il lisait alors l'état vide générique :
 *
 *     « Aucun logement pour l'instant »
 *     « Déclarez un immeuble, puis ajoutez-y vos logements. »
 *
 * Sur un parc qui compte trois immeubles et douze logements. On lui prescrivait
 * de CRÉER ce qui existait déjà et qu'on avait seulement omis de lui remettre —
 * et le geste est à sa portée, puisque l'écran lui offre « Ajouter un
 * immeuble ». Le produit l'invitait à dédoubler le parc de son client.
 *
 * Et la note de périmètre, sur les écrans qui agrègent, affirmait qu'il gère
 * « une partie de ce parc ». Il n'en gère aucune.
 *
 * ═══ LE FAIT, TOUJOURS PAS L'ÉTENDUE ═══
 *
 * `NoteDePerimetre` refuse depuis l'origine de dire « 2 sur 3 » : ce serait
 * révéler qu'un troisième immeuble existe. Dire « rien ne vous a été confié » ne
 * révèle rien du parc — c'est un fait sur SON périmètre, celui qu'il constate
 * déjà en regardant des écrans vides. La règle tient.
 *
 * ET AUCUNE CONSIGNE. Le même en-tête écarte « Demandez au propriétaire » :
 * « ce serait une consigne, et le produit n'a aucun écran où un gestionnaire
 * réclame un immeuble ». Les phrases neuves énoncent, elles ne prescrivent pas.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function session(role: 'owner' | 'manager'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bastos', currency: 'XAF', countryCode: 'CM' }],
  }
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

const IMMEUBLE_CONFIE = {
  id: 'imm-1',
  name: 'Résidence Bonamoussadi',
  district: 'Bonamoussadi',
  units: [
    {
      id: 'u-1',
      label: 'A1',
      type: 'T2',
      surfaceSqm: 52,
      rentMinor: 90000,
      tenant: null,
      status: 'vacant',
      leaseId: null,
      paidMinor: 0,
      overdueDays: null,
    },
  ],
}

/**
 * `scoped` est ce que le serveur rend pour une adhésion `declared` : il ne
 * dépend pas de ce qui est confié, seulement du fait d'être borné.
 */
async function ouvrir(
  adresse: string,
  { role, scoped, immeubles }: { role: 'owner' | 'manager'; scoped: boolean; immeubles: unknown[] },
) {
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      scoped,
      accessUntil: null,
      collections: [],
      buildings: immeubles,
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
      leaseCharges: [],
    },
  })
  await renderApp(adresse, { session: session(role) })
  await attendreLeChargement()
}

describe('le gestionnaire à qui rien n’a été confié', () => {
  it('ne s’entend PLUS dire de déclarer un immeuble', async () => {
    await ouvrir('/app/parc', { role: 'manager', scoped: true, immeubles: [] })
    expect(
      screen.queryByText(/Déclarez un immeuble/i),
      'le parc en compte trois : on lui prescrivait de dédoubler celui de son client',
    ).toBeNull()
  })

  it('lit ce qu’il en est : rien ne lui a été confié', async () => {
    await ouvrir('/app/parc', { role: 'manager', scoped: true, immeubles: [] })
    expect(screen.getByText(/rien ne vous a encore été confié/i)).toBeTruthy()
  })

  it('le lit AUSSI sur un écran qui agrège, où la note disait « une partie »', async () => {
    await ouvrir('/app/paiements', { role: 'manager', scoped: true, immeubles: [] })
    expect(screen.queryByText(/qu’une partie de ce parc/i)).toBeNull()
    expect(screen.getByText(/rien ne vous a encore été confié/i)).toBeTruthy()
  })
})

describe('ce que ce lot ne doit pas casser', () => {
  it('le gestionnaire BORNÉ mais servi garde « une partie de ce parc »', async () => {
    await ouvrir('/app/paiements', {
      role: 'manager',
      scoped: true,
      immeubles: [IMMEUBLE_CONFIE],
    })
    expect(screen.getByText(/qu’une partie de ce parc/i)).toBeTruthy()
  })

  it('le PROPRIÉTAIRE d’un parc vide garde son invitation à le remplir', async () => {
    /* Lui, le parc est vraiment vide, et le geste est vraiment le sien. */
    await ouvrir('/app/parc', { role: 'owner', scoped: false, immeubles: [] })
    expect(screen.getByText(/Déclarez un immeuble/i)).toBeTruthy()
    expect(screen.queryByText(/rien ne vous a encore été confié/i)).toBeNull()
  })
})
