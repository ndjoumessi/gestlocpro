import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../db.js'
import { remplacerStockage } from '../stockage/stockage.js'
import { balayerLesReservationsMortes } from './photosJamaisMontees.js'

/**
 * UNE RÉSERVATION JAMAIS CONFIRMÉE EST UN OBJET PAYÉ POUR RIEN.
 *
 * ═══ LE DÉFAUT, ET IL EST LE SEUL À EMPIRER TOUT SEUL ═══
 *
 * La ligne d'une photo est créée AVANT que les octets n'arrivent — un arbitrage
 * assumé, dont la route porte le raisonnement entier. Une réservation qu'on ne
 * confirme jamais — l'onglet fermé pendant la montée, le réseau qui lâche —
 * laisse un objet facturé au gigaoctet-mois.
 *
 * L'en-tête de la route l'écrit noir sur blanc : « Ce qu'il ne fait PAS, et
 * qu'il faut dire : il ne balaie rien. Il rend le balayage ÉCRIVABLE ; le
 * balayage lui-même reste à faire. »
 *
 * Des trois défauts que ce même en-tête nomme, c'est le seul qui grossit sans
 * qu'on y touche.
 *
 * ═══ TROIS REFUS PLUTÔT QU'UNE CONDITION ═══
 *
 * Effacer des octets est irréversible. La fonction ne prend donc PAS ce qui :
 *
 *   · porte un `confirmedAt` — les octets sont là, la photo vit ;
 *   · est plus JEUNE que le délai — une montée en cours n'est pas une
 *     réservation morte, et un réseau lent n'est pas une panne ;
 *   · n'a pas d'objet dans le dépôt — il n'y a rien à effacer, mais la ligne
 *     part quand même : elle ne désigne plus rien.
 *
 * ═══ LES OCTETS D'ABORD, LA LIGNE ENSUITE ═══
 *
 * Si la suppression des octets échoue, la ligne RESTE — et le prochain passage
 * réessaiera. L'ordre inverse laisserait un objet que plus aucune ligne ne
 * nomme : une fuite définitive, invisible, exactement ce que ce balayage existe
 * pour empêcher.
 */

const DOUZE_HEURES = 12 * 3600_000

/** Un dépôt d'objets de sonde : il retient ce qu'on lui a demandé d'effacer. */
function stockageDeSonde(cles: Set<string>) {
  const efface: string[] = []
  const rendre = remplacerStockage({
    async reserver() {
      return { cle: '', adresse: '', champs: {} }
    },
    async confirmer() {
      return { ok: true }
    },
    async lire() {
      return { adresse: '' }
    },
    /* SANS EFFET SUR UN OBJET ABSENT, comme le contrat l'exige : « un appelant
       qui réessaie doit passer ». Le dépôt de sonde le respecte, sans quoi ces
       cas mesureraient un contrat que le produit n'a pas. */
    async supprimer(cle: string) {
      if (cles.delete(cle)) efface.push(cle)
    },
  } as never)
  return { efface, rendre }
}

async function unePhoto(opts: { cle: string; ageMs: number; confirmee: boolean }) {
  const parc = await prisma.park.create({
    data: { name: 'Parc', countryCode: 'CM', currency: 'XAF' },
  })
  const imm = await prisma.building.create({
    data: { parkId: parc.id, name: 'Imm', district: 'D' },
  })
  const unite = await prisma.unit.create({
    data: { buildingId: imm.id, label: 'A1', type: 'T2', surfaceSqm: 50, baseRentMinor: 1000 },
  })
  const etat = await prisma.inspection.create({
    data: { unitId: unite.id, kind: 'entry', performedOn: new Date(), rooms: 1 },
  })
  const reserve = await prisma.inspectionFinding.create({
    data: { inspectionId: etat.id, room: 'Salon', description: 'Trace', severity: 'minor' },
  })
  return prisma.inspectionPhoto.create({
    data: {
      findingId: reserve.id,
      storageKey: opts.cle,
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: new Date(Date.now() - opts.ageMs),
      confirmedAt: opts.confirmee ? new Date() : null,
    },
  })
}

beforeEach(async () => {
  await prisma.park.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.$disconnect()
})

describe('le balayage des réservations mortes', () => {
  it('efface les octets PUIS la ligne d’une réservation vieille et non confirmée', async () => {
    const photo = await unePhoto({ cle: 'morte', ageMs: DOUZE_HEURES * 2, confirmee: false })
    const { efface, rendre } = stockageDeSonde(new Set(['morte']))

    const bilan = await balayerLesReservationsMortes({ apresMs: DOUZE_HEURES })
    rendre()

    expect(efface).toEqual(['morte'])
    expect(bilan.effacees).toBe(1)
    expect(await prisma.inspectionPhoto.findUnique({ where: { id: photo.id } })).toBeNull()
  })

  it('ne touche PAS une photo confirmée, si vieille soit-elle', async () => {
    const photo = await unePhoto({ cle: 'vivante', ageMs: DOUZE_HEURES * 100, confirmee: true })
    const { efface, rendre } = stockageDeSonde(new Set(['vivante']))

    const bilan = await balayerLesReservationsMortes({ apresMs: DOUZE_HEURES })
    rendre()

    expect(efface, 'les octets d’une photo qui vit ne s’effacent pas').toEqual([])
    expect(bilan.effacees).toBe(0)
    expect(await prisma.inspectionPhoto.findUnique({ where: { id: photo.id } })).not.toBeNull()
  })

  it('ne touche PAS une réservation JEUNE, non confirmée', async () => {
    /* Une montée en cours n'est pas une réservation morte. Sur le marché que ce
       produit sert, un réseau lent est la norme, pas la panne. */
    const photo = await unePhoto({ cle: 'en-cours', ageMs: 60_000, confirmee: false })
    const { efface, rendre } = stockageDeSonde(new Set(['en-cours']))

    const bilan = await balayerLesReservationsMortes({ apresMs: DOUZE_HEURES })
    rendre()

    expect(efface).toEqual([])
    expect(bilan.effacees).toBe(0)
    expect(await prisma.inspectionPhoto.findUnique({ where: { id: photo.id } })).not.toBeNull()
  })

  it('retire la ligne même quand le dépôt n’a plus l’objet', async () => {
    /* Rien à effacer, mais la ligne ne désigne plus rien : la garder ferait
       croire à une photo, et le prochain passage la reverrait sans fin. Le
       contrat de `supprimer` rend ce cas silencieux — « sans effet si l'objet
       n'existe pas » — et c'est ce qui rend le balayage rejouable. */
    const photo = await unePhoto({ cle: 'absente', ageMs: DOUZE_HEURES * 2, confirmee: false })
    const { efface, rendre } = stockageDeSonde(new Set())

    const bilan = await balayerLesReservationsMortes({ apresMs: DOUZE_HEURES })
    rendre()

    expect(efface).toEqual([])
    expect(bilan.effacees).toBe(1)
    expect(await prisma.inspectionPhoto.findUnique({ where: { id: photo.id } })).toBeNull()
  })

  it('GARDE la ligne quand l’effacement des octets échoue', async () => {
    /* L'ordre compte : octets d'abord, ligne ensuite. L'inverse laisserait un
       objet que plus aucune ligne ne nomme — une fuite définitive et invisible,
       exactement ce que ce balayage existe pour empêcher. */
    const photo = await unePhoto({ cle: 'recalcitrante', ageMs: DOUZE_HEURES * 2, confirmee: false })
    const rendre = remplacerStockage({
      async reserver() {
        return { cle: '', adresse: '', champs: {} }
      },
      async confirmer() {
        return { ok: true }
      },
      async lire() {
        return { adresse: '' }
      },
      async supprimer() {
        throw new Error('le dépôt refuse')
      },
    } as never)

    const bilan = await balayerLesReservationsMortes({ apresMs: DOUZE_HEURES })
    rendre()

    expect(bilan.effacees).toBe(0)
    expect(bilan.echecs).toBe(1)
    expect(
      await prisma.inspectionPhoto.findUnique({ where: { id: photo.id } }),
      'la ligne reste, et le prochain passage réessaiera',
    ).not.toBeNull()
  })
})
