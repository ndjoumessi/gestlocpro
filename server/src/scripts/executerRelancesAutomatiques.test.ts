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

  describe('le mode À BLANC', () => {
      /**
     * ═══ POURQUOI IL EXISTE ═══
     *
     * Ce passage n'a JAMAIS tourné en production : aucun cron ne le lançait, ce
     * que la configuration Railway a confirmé. Le brancher enverra donc de vrais
     * courriels à de vrais locataires, au premier tour, sans que personne ait pu
     * voir ce qui partirait.
     *
     * « À blanc » rend le même parcours et la même décision, et n'envoie RIEN. Le
     * lire avant d'allumer, c'est la différence entre décider et espérer.
     *
     * IL NE POSE AUCUNE TRACE non plus. `RentReminderEmail` est la garde
     * d'idempotence quotidienne : en écrire une à blanc ferait manquer le vrai
     * envoi du même jour, et le blanc aurait consommé le tour qu'il devait
     * seulement décrire.
     */
    it('ne pose ni courriel ni trace, et dit ce qui partirait', async () => {
      await parcAvecBailAJours(7, { email: 'paul@example.com' })

      const blanc = await executerRelancesAutomatiques({ aBlanc: true })
      expect(blanc.envoyes, 'à blanc, rien ne part').toBe(0)
      expect(blanc.partiraient, 'mais il dit combien partiraient').toBe(1)
      expect(
      await prisma.rentReminderEmail.count(),
      'une trace à blanc ferait manquer le vrai envoi du jour',
    ).toBe(0)
    })

    it('laisse le vrai passage faire son travail ensuite', async () => {
      /* Le blanc ne doit rien consommer : le tour d'après, en vrai, part. */
      await parcAvecBailAJours(7, { email: 'paul@example.com' })
      /* Le blanc tourne SANS messagerie de sonde : il n'en a pas besoin, et
         c'est déjà une preuve — il ne parle à personne. */
      await executerRelancesAutomatiques({ aBlanc: true })

      const rendre = remplacerMessagerie({
        async envoyerSms() {
          return false
        },
        async envoyerEmail() {
          return true
        },
      })
      const vrai = await executerRelancesAutomatiques()
      rendre()
      expect(vrai.envoyes, 'le blanc ne doit rien avoir consommé').toBe(1)
    })
  })

})
