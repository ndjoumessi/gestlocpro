import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../db.js'
import { remplacerMessagerie } from '../messagerie/messagerie.js'
import { executerRelancesAutomatiques } from './executerRelancesAutomatiques.js'

/**
 * LE POINT D'ENTRÉE DU CRON, éprouvé SANS passer par HTTP.
 *
 * `executerRelancesAutomatiques` n'a ni session ni appartenance à vérifier —
 * c'est un script, pas une route. Le construire ici directement en base plutôt
 * que par inscription HTTP colle à cette nature : rien n'y simule un
 * utilisateur qui n'existe pas pour ce déclenchement.
 */
describe('executerRelancesAutomatiques — le futur cron', () => {
  beforeEach(async () => {
    await prisma.park.deleteMany()
  })
  afterEach(async () => {
    await prisma.park.deleteMany()
  })

  /** Minuit UTC du jour courant moins `n` jours — même borne que `debutDuJour`. */
  function ilYA(joursEntiers: number): Date {
    const maintenant = new Date()
    const minuit = new Date(
      Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
    )
    return new Date(minuit.getTime() - joursEntiers * 86_400_000)
  }

  async function parcAvecBailAJours(joursDeRetard: number, options: { email?: string } = {}) {
    const parc = await prisma.park.create({
      data: { name: 'Parc', countryCode: 'CM', currency: 'XAF' },
    })
    const immeuble = await prisma.building.create({
      data: { parkId: parc.id, name: 'Résidence', district: 'Bastos' },
    })
    const unite = await prisma.unit.create({
      data: { buildingId: immeuble.id, label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 },
    })
    const locataire = await prisma.tenant.create({
      data: { parkId: parc.id, fullName: 'Paul Kamga', ...(options.email ? { email: options.email } : {}) },
    })
    const bail = await prisma.lease.create({
      data: {
        unitId: unite.id,
        tenantId: locataire.id,
        startsOn: new Date('2026-01-01T00:00:00Z'),
        rentMinor: 145000,
        status: 'active',
        charges: {
          create: {
            periodStart: new Date('2026-06-01T00:00:00Z'),
            dueOn: ilYA(joursDeRetard),
            rentMinor: 145000,
          },
        },
      },
    })
    return { parc, bail }
  }

  it('envoie le courriel des baux à J+7, à travers TOUS les parcs', async () => {
    const { bail } = await parcAvecBailAJours(7, { email: 'paul@example.com' })
    // Un second parc, sans rien à J+7 : la boucle ne doit rien lui trouver à
    // faire, et ne doit pas planter dessus.
    await parcAvecBailAJours(2, { email: 'autre@example.com' })

    let envoyes = 0
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail() {
        envoyes += 1
        return true
      },
    })
    try {
      const resultat = await executerRelancesAutomatiques()

      expect(envoyes).toBe(1)
      expect(resultat.envoyes).toBe(1)
      expect(resultat.parcsTraites).toBe(2)

      const trace = await prisma.rentReminderEmail.findFirstOrThrow({ where: { leaseId: bail.id } })
      expect(trace.milestone).toBe(7)
      expect(trace.deliveredAt).not.toBeNull()
    } finally {
      rendre()
    }
  })
})
