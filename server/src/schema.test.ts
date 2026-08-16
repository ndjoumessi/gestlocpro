import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db.js'

/**
 * Règles portées par la base elle-même.
 *
 * Une contrainte qu'aucun test ne met à l'épreuve est une affirmation. Celles
 * vérifiées ici ne peuvent PAS vivre dans le code applicatif : deux requêtes
 * simultanées liraient toutes deux « aucun bail actif » avant que l'une
 * n'écrive. La fenêtre est étroite, donc le défaut serait rare, donc
 * irreproductible — la pire des catégories.
 */

async function parcNeuf() {
  const park = await prisma.park.create({
    data: { name: 'Parc de test', countryCode: 'CM', currency: 'XAF' },
  })
  const building = await prisma.building.create({
    data: { parkId: park.id, name: 'Résidence de test', district: 'Bonamoussadi' },
  })
  const unit = await prisma.unit.create({
    data: {
      buildingId: building.id,
      label: 'A1',
      type: 'T3',
      surfaceSqm: 78,
      baseRentMinor: 145000,
    },
  })
  return { park, building, unit }
}

beforeEach(async () => {
  // L'ordre suit les dépendances : tout pend à `Park`, dont la cascade fait le
  // reste. `UserAccount` vit hors du parc et se nettoie à part.
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
})

describe('un seul bail en cours par unité', () => {
  it('refuse un second bail actif sur la même unité', async () => {
    const { park, unit } = await parcNeuf()
    const [a, b] = await Promise.all([
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'Charles Ngassa' } }),
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'Awa Diallo' } }),
    ])

    await prisma.lease.create({
      data: { unitId: unit.id, tenantId: a.id, startsOn: new Date('2024-05-15'), rentMinor: 145000, status: 'active' },
    })

    // Le modèle client autorisait ceci sans broncher : `Unit.tenant` est une
    // chaîne, la réécrire écrase simplement le locataire précédent.
    await expect(
      prisma.lease.create({
        data: { unitId: unit.id, tenantId: b.id, startsOn: new Date('2026-01-01'), rentMinor: 150000, status: 'active' },
      }),
    ).rejects.toThrow()
  })

  it('compte « en attente » comme occupant', async () => {
    // Le bail est signé, l'unité n'est plus disponible, même si la première
    // quittance n'est pas due — c'est ce que fait déjà `addTenant` côté client.
    const { park, unit } = await parcNeuf()
    const [a, b] = await Promise.all([
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'A' } }),
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'B' } }),
    ])
    await prisma.lease.create({
      data: { unitId: unit.id, tenantId: a.id, startsOn: new Date('2026-08-01'), rentMinor: 1, status: 'pending' },
    })
    await expect(
      prisma.lease.create({
        data: { unitId: unit.id, tenantId: b.id, startsOn: new Date('2026-08-02'), rentMinor: 1, status: 'active' },
      }),
    ).rejects.toThrow()
  })

  it('rouvre l’unité une fois le bail terminé', async () => {
    const { park, unit } = await parcNeuf()
    const [a, b] = await Promise.all([
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'A' } }),
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'B' } }),
    ])
    const premier = await prisma.lease.create({
      data: { unitId: unit.id, tenantId: a.id, startsOn: new Date('2024-01-01'), rentMinor: 1, status: 'active' },
    })
    await prisma.lease.update({
      where: { id: premier.id },
      data: { status: 'ended', endsOn: new Date('2026-06-30') },
    })

    const second = await prisma.lease.create({
      data: { unitId: unit.id, tenantId: b.id, startsOn: new Date('2026-07-01'), rentMinor: 1, status: 'active' },
    })
    expect(second.id).toBeTruthy()

    // Et l'historique reste : c'est ce que le champ `Unit.tenant` détruisait.
    expect(await prisma.lease.count({ where: { unitId: unit.id } })).toBe(2)
  })

  it('garde une caution par bail, et non par unité', async () => {
    // Le client clait `Deposit` par `unitId` : la caution du locataire suivant
    // écrasait celle de l'ancien, retenue et solde compris — alors que le jeu
    // de démonstration contenait déjà deux cautions d'anciens locataires en
    // cours d'arbitrage.
    const { park, unit } = await parcNeuf()
    const [a, b] = await Promise.all([
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'A' } }),
      prisma.tenant.create({ data: { parkId: park.id, fullName: 'B' } }),
    ])
    const ancien = await prisma.lease.create({
      data: { unitId: unit.id, tenantId: a.id, startsOn: new Date('2024-01-01'), rentMinor: 1, status: 'ended', endsOn: new Date('2026-06-30') },
    })
    const nouveau = await prisma.lease.create({
      data: { unitId: unit.id, tenantId: b.id, startsOn: new Date('2026-07-01'), rentMinor: 1, status: 'active' },
    })

    await prisma.deposit.create({
      data: { leaseId: ancien.id, heldMinor: 236000, withheldMinor: 118000, withheldReason: 'Réfection', status: 'settling' },
    })
    await prisma.deposit.create({ data: { leaseId: nouveau.id, heldMinor: 290000 } })

    const cautions = await prisma.deposit.findMany({ where: { lease: { unitId: unit.id } } })
    expect(cautions).toHaveLength(2)
    // L'arbitrage en cours de l'ancien locataire survit à l'arrivée du suivant.
    expect(cautions.find((d) => d.leaseId === ancien.id)?.withheldMinor).toBe(118000)
  })
})

describe('portée et unicité', () => {
  it('interdit deux unités du même nom dans un immeuble', async () => {
    const { building } = await parcNeuf()
    await expect(
      prisma.unit.create({
        data: { buildingId: building.id, label: 'A1', type: 'T2', surfaceSqm: 50, baseRentMinor: 1 },
      }),
    ).rejects.toThrow()
  })

  it('autorise le même nom dans deux immeubles', async () => {
    // « A1 » existe dans presque tous les immeubles du monde : c'est pourquoi
    // il est un libellé et non une clé.
    const { park } = await parcNeuf()
    const autre = await prisma.building.create({
      data: { parkId: park.id, name: 'Immeuble Akwa Nord', district: 'Akwa' },
    })
    const jumelle = await prisma.unit.create({
      data: { buildingId: autre.id, label: 'A1', type: 'T2', surfaceSqm: 54, baseRentMinor: 1 },
    })
    expect(jumelle.label).toBe('A1')
  })

  it('interdit deux échéances pour la même période', async () => {
    const { park, unit } = await parcNeuf()
    const t = await prisma.tenant.create({ data: { parkId: park.id, fullName: 'A' } })
    const bail = await prisma.lease.create({
      data: { unitId: unit.id, tenantId: t.id, startsOn: new Date('2026-01-01'), rentMinor: 145000, status: 'active' },
    })
    const periode = { leaseId: bail.id, periodStart: new Date('2026-08-01'), dueOn: new Date('2026-08-05'), rentMinor: 145000 }
    await prisma.rentCharge.create({ data: periode })
    await expect(prisma.rentCharge.create({ data: periode })).rejects.toThrow()
  })

  it('interdit deux relevés du même fluide pour la même période', async () => {
    const { unit } = await parcNeuf()
    const releve = { unitId: unit.id, utility: 'water' as const, periodStart: new Date('2026-08-01'), indexValue: 358, readAt: new Date('2026-08-20') }
    await prisma.meterReading.create({ data: releve })
    await expect(prisma.meterReading.create({ data: releve })).rejects.toThrow()
  })

  it('refuse encore de supprimer un locataire cité par un bail', async () => {
    // La contrainte a été rendue différée pour que la suppression d'un parc
    // aboutisse. C'est le moment du contrôle qui a changé, pas la règle : un
    // bail sans locataire n'est pas un bail. Sans ce test, la migration se
    // contenterait d'affirmer que la protection subsiste.
    const { park, unit } = await parcNeuf()
    const t = await prisma.tenant.create({ data: { parkId: park.id, fullName: 'Serge Mbarga' } })
    await prisma.lease.create({
      data: { unitId: unit.id, tenantId: t.id, startsOn: new Date('2026-01-01'), rentMinor: 1, status: 'active' },
    })

    await expect(prisma.tenant.delete({ where: { id: t.id } })).rejects.toThrow()
    expect(await prisma.tenant.count({ where: { id: t.id } })).toBe(1)
  })

  it('emporte tout le parc quand le parc disparaît', async () => {
    // Le cloisonnement passe par là : chaque table pend à un parc, directement
    // ou par jointure. Une table oubliée survivrait ici, orpheline.
    const { park, unit } = await parcNeuf()
    const t = await prisma.tenant.create({ data: { parkId: park.id, fullName: 'A' } })
    await prisma.lease.create({
      data: { unitId: unit.id, tenantId: t.id, startsOn: new Date('2026-01-01'), rentMinor: 1, status: 'active' },
    })

    await prisma.park.delete({ where: { id: park.id } })

    expect(await prisma.building.count()).toBe(0)
    expect(await prisma.unit.count()).toBe(0)
    expect(await prisma.tenant.count()).toBe(0)
    expect(await prisma.lease.count()).toBe(0)
  })
})

describe('les montants sont des entiers', () => {
  it('ne perd pas un centime sur une addition', async () => {
    // En flottant, 0,1 + 0,2 ne vaut pas 0,3. Une comptabilité qui dérive d'un
    // centime par ligne est indéfendable, et la dérive ne se voit qu'au bout de
    // plusieurs mois.
    const { park, unit } = await parcNeuf()
    const t = await prisma.tenant.create({ data: { parkId: park.id, fullName: 'A' } })
    const bail = await prisma.lease.create({
      data: { unitId: unit.id, tenantId: t.id, startsOn: new Date('2026-01-01'), rentMinor: 10, status: 'active' },
    })
    const charge = await prisma.rentCharge.create({
      data: { leaseId: bail.id, periodStart: new Date('2026-08-01'), dueOn: new Date('2026-08-05'), rentMinor: 30 },
    })
    const compte = await prisma.userAccount.create({
      data: { email: 'proprio@example.com', passwordHash: 'x', fullName: 'Propriétaire', termsAcceptedAt: new Date() },
    })

    for (const montant of [10, 20]) {
      await prisma.payment.create({
        data: { chargeId: charge.id, amountMinor: montant, method: 'cash', paidOn: new Date('2026-08-03'), recordedById: compte.id },
      })
    }

    const total = await prisma.payment.aggregate({ _sum: { amountMinor: true }, where: { chargeId: charge.id } })
    expect(total._sum.amountMinor).toBe(30)
    expect(Number.isInteger(total._sum.amountMinor)).toBe(true)
  })
})
