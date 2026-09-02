import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../db.js'
import { remplacerMessagerie } from '../messagerie/messagerie.js'
import { executerRelancesAutomatiques } from '../scripts/executerRelancesAutomatiques.js'

/**
 * LA RELANCE AUTOMATIQUE SE RÈGLE DEPUIS LE PRODUIT.
 *
 * ═══ LE PARTAGE DES RÔLES ═══
 *
 * Le CRON est bête : il passe tous les jours, à heure fixe. La POLITIQUE vit
 * dans le produit — faut-il relancer, et au bout de combien de jours. Mettre la
 * politique dans la planification obligerait le propriétaire à ouvrir un
 * tableau de bord d'infrastructure pour changer d'avis sur ses propres
 * locataires.
 *
 * C'est déjà la disposition de `leaseAccessMonths` : une règle de gestion vit
 * sur le parc, pas dans une constante du code ni dans un réglage d'hébergeur.
 *
 * ═══ CE QUE LE JALON ÉTAIT ═══
 *
 * `JALON_EMAIL_AUTOMATIQUE = 7`, écrit en dur, et motivé : « ni le délai serré
 * de J+1, ni la sévérité de J+15 ». Le motif reste le DÉFAUT ; il cesse d'être
 * une fatalité. Un bailleur qui relance à trois jours n'a pas tort, il a un
 * autre parc.
 */
const MDP_SANS_OBJET = null

let rendre: () => void = () => {}
let envoyes: string[] = []

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  envoyes = []
  rendre = remplacerMessagerie({
    async envoyerSms() {
      return false
    },
    async envoyerEmail(adresse) {
      envoyes.push(adresse)
      return true
    },
  })
})

afterEach(async () => {
  rendre()
})

/** Un parc, un bail en retard de `jours`, et son locataire joignable. */
async function parcAvecRetard(jours: number, reglages: Record<string, unknown> = {}) {
  const maintenant = new Date()
  const minuit = new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
  )
  const parc = await prisma.park.create({
    data: { name: 'Parc de sonde', countryCode: 'CM', currency: 'XAF', ...reglages },
  })
  const immeuble = await prisma.building.create({
    data: { parkId: parc.id, name: 'Résidence', district: 'Bastos' },
  })
  const unite = await prisma.unit.create({
    data: { buildingId: immeuble.id, label: 'A1', type: 'T2', surfaceSqm: 50, baseRentMinor: 100000 },
  })
  const locataire = await prisma.tenant.create({
    data: { parkId: parc.id, fullName: 'Paul Kamga', email: 'paul@example.com' },
  })
  const bail = await prisma.lease.create({
    data: {
      unitId: unite.id,
      tenantId: locataire.id,
      startsOn: new Date(minuit.getTime() - 200 * 86_400_000),
      rentMinor: 100000,
      status: 'active',
    },
  })
  await prisma.rentCharge.create({
    data: {
      leaseId: bail.id,
      periodStart: new Date(minuit.getTime() - jours * 86_400_000),
      dueOn: new Date(minuit.getTime() - jours * 86_400_000),
      rentMinor: 100000,
    },
  })
  void MDP_SANS_OBJET
  return parc
}

describe('le jalon du parc', () => {
  it('relance au jour que le parc a choisi, et pas au septième', async () => {
    await parcAvecRetard(3, { reminderMilestoneDays: 3 })
    const r = await executerRelancesAutomatiques()
    expect(r.envoyes, 'un bailleur qui relance à trois jours a un autre parc, pas tort').toBe(1)
  })

  it('ne relance PAS au septième quand le parc a choisi le troisième', async () => {
    await parcAvecRetard(7, { reminderMilestoneDays: 3 })
    const r = await executerRelancesAutomatiques()
    expect(r.envoyes).toBe(0)
  })

  it('garde SEPT quand le parc n’a rien choisi', async () => {
    /* Le motif du sept reste le défaut : « ni le délai serré de J+1, ni la
       sévérité de J+15 ». Il cesse d'être une fatalité, il ne cesse pas d'être
       un bon défaut. */
    await parcAvecRetard(7)
    const r = await executerRelancesAutomatiques()
    expect(r.envoyes).toBe(1)
  })
})

describe('l’interrupteur du parc', () => {
  it('coupé, rien ne part — même au bon jalon', async () => {
    await parcAvecRetard(7, { autoReminders: false })
    const r = await executerRelancesAutomatiques()
    expect(r.envoyes).toBe(0)
    expect(envoyes).toEqual([])
  })

  it('coupé, le mode à blanc n’annonce rien non plus', async () => {
    /* Le blanc doit dire ce qui PARTIRAIT : compter un envoi qu'un réglage
       interdit ferait mentir la seule lecture qui précède la décision. */
    await parcAvecRetard(7, { autoReminders: false })
    const blanc = await executerRelancesAutomatiques({ aBlanc: true })
    expect(blanc.partiraient).toBe(0)
  })

  it('allumé par défaut : aucun parc ne perd ses relances', async () => {
    await parcAvecRetard(7)
    const r = await executerRelancesAutomatiques()
    expect(r.envoyes).toBe(1)
  })
})
