import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * L'ACCORD D'APUREMENT, ET CE QUE LA BASE NE PEUT PAS TENIR SEULE.
 *
 * ═══ CE QUE CE LOT CORRIGE ═══
 *
 * Les paiements partiels existaient de fait, la relance et la mise en demeure
 * aussi. Ce qui manquait était l'ACCORD : rien ne portait « 50 000 par mois
 * pendant quatre mois », ni le suivi de son respect. Un locataire qui respectait
 * scrupuleusement un échelonnement convenu à l'oral continuait de recevoir des
 * relances pour la totalité de sa dette. Le produit travaillait contre l'accord
 * que ses utilisateurs avaient passé sans lui.
 *
 * ═══ LES QUATRE RÈGLES ═══
 *
 *   1. CE QUI EST PAYÉ SE CALCULE, il ne se lit pas. Aucune colonne « payé » sur
 *      une échéance de plan : l'argent arrive par `Payment` sur une échéance de
 *      LOYER. L'imputation est chronologique et cumulative.
 *   2. UN SEUL PLAN ACTIF PAR BAIL, tenu par un index unique PARTIEL que Prisma
 *      ne sait pas déclarer — d'où un cas ici plutôt qu'une supposition.
 *   3. LE SURPLUS N'APPARTIENT PAS AU PLAN. Un locataire qui paie plus que son
 *      échelonnement a soldé son plan ; le reste va à ses loyers courants.
 *   4. UN PLAN CLOS NE SE ROUVRE PAS. On en convient un nouveau — ce que l'index
 *      partiel autorise dès que le précédent n'est plus actif.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`inscription sans cookie — ${res.status}`)
  return trouve
}

async function parcAvecUnBail() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Arsène Nkolo',
    confirmLegal: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const imm = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Residance Djoumessi', district: 'Bastos' })
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Serge Mbarga', depositMinor: 200000, startsOn: '2026-01-01' })
  await request(serveur)
    .post(`/api/parks/${parkId}/charges`)
    .set('Cookie', cookie)
    .send({ periodStart: '2026-02-01' })

  const bail = await prisma.lease.findFirstOrThrow({
    where: { unitId },
    select: { id: true },
  })
  return { cookie, parkId, unitId, leaseId: bail.id }
}

/** Un encaissement sur l'échéance de loyer du bail, à la date voulue. */
async function encaisser(leaseId: string, montant: number, jour: string) {
  const echeance = await prisma.rentCharge.findFirstOrThrow({
    where: { leaseId },
    select: { id: true },
    orderBy: { dueOn: 'asc' },
  })
  await prisma.payment.create({
    data: {
      chargeId: echeance.id,
      amountMinor: montant,
      currency: 'XAF',
      method: 'mobile',
      paidOn: new Date(`${jour}T00:00:00.000Z`),
    },
  })
}

const TROIS_FOIS = {
  agreedOn: '2026-03-01',
  instalments: [
    { dueOn: '2026-03-31', amountMinor: 50000 },
    { dueOn: '2026-04-30', amountMinor: 50000 },
    { dueOn: '2026-05-31', amountMinor: 50000 },
  ],
}

function lirePlan(parkId: string, leaseId: string, cookie: string) {
  return request(serveur)
    .get(`/api/parks/${parkId}/leases/${leaseId}/settlement-plan`)
    .set('Cookie', cookie)
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('un plan d’apurement', () => {
  it('IMPUTE LES ENCAISSEMENTS DANS L’ORDRE, sans colonne « payé »', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookie)
      .send(TROIS_FOIS)
    expect(pose.status, JSON.stringify(pose.body)).toBe(201)
    /* LE TOTAL EST LA SOMME DES ÉCHÉANCES, jamais un champ à part. */
    expect(pose.body.plan.totalMinor).toBe(150000)

    /* UN SEUL VERSEMENT DE 120 000, sur l'échéance de LOYER — pas sur une ligne
       de plan, qui n'en a pas. C'est le cas normal, et c'est pourquoi une colonne
       « payé » sur l'échéance divergerait. */
    await encaisser(leaseId, 120000, '2026-04-02')

    const vu = await lirePlan(parkId, leaseId, cookie)
    const echeances = vu.body.plan.instalments as { paidMinor: number }[]
    /* CHRONOLOGIQUE ET CUMULATIF : la première est soldée, la deuxième entamée,
       la troisième intacte — ce qu'un humain conclurait. */
    expect(echeances.map((e) => e.paidMinor)).toEqual([50000, 50000, 20000])
    expect(vu.body.plan.paidMinor).toBe(120000)
  })

  it('NE FAIT PAS DÉBORDER LE PLAN quand le locataire paie plus', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookie)
      .send(TROIS_FOIS)

    /* 320 000 sur un plan de 150 000 : le surplus appartient aux loyers
       courants, pas au plan. Rendre l'encaissé brut afficherait « 320 000 sur
       150 000 », ce qui n'est vrai de rien. */
    await encaisser(leaseId, 320000, '2026-04-02')

    const vu = await lirePlan(parkId, leaseId, cookie)
    expect(vu.body.plan.paidMinor).toBe(150000)
    expect(
      (vu.body.plan.instalments as { paidMinor: number }[]).map((e) => e.paidMinor),
    ).toEqual([50000, 50000, 50000])
  })

  it('IGNORE CE QUI A ÉTÉ PAYÉ AVANT L’ACCORD', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    /* Un versement ANTÉRIEUR à l'accord : il a soldé autre chose, et l'imputer
       ferait paraître honoré un plan dont rien n'a été versé. */
    await encaisser(leaseId, 90000, '2026-02-10')
    await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookie)
      .send(TROIS_FOIS)

    const vu = await lirePlan(parkId, leaseId, cookie)
    expect(vu.body.plan.paidMinor).toBe(0)
  })

  it('REFUSE UN SECOND PLAN ACTIF, et l’autorise une fois le premier clos', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    const premier = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookie)
      .send(TROIS_FOIS)

    const second = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookie)
      .send(TROIS_FOIS)
    /* Tenu par un index unique PARTIEL — `WHERE status = 'active'` —, que Prisma
       ne sait pas déclarer. C'est pourquoi ce cas existe. */
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('plan_actif')

    await request(serveur)
      .patch(`/api/parks/${parkId}/settlement-plans/${premier.body.plan.id}`)
      .set('Cookie', cookie)
      .send({ status: 'broken' })

    const troisieme = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookie)
      .send(TROIS_FOIS)
    /* UNE FOIS LE PREMIER ROMPU, un nouveau plan est possible : l'unicité ne
       porte QUE sur l'actif, et un bail peut avoir eu trois plans. */
    expect(troisieme.status, JSON.stringify(troisieme.body)).toBe(201)
  })

  it('NE ROUVRE PAS UN PLAN CLOS', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookie)
      .send(TROIS_FOIS)
    const planId = pose.body.plan.id as string

    await request(serveur)
      .patch(`/api/parks/${parkId}/settlement-plans/${planId}`)
      .set('Cookie', cookie)
      .send({ status: 'honoured' })

    const encore = await request(serveur)
      .patch(`/api/parks/${parkId}/settlement-plans/${planId}`)
      .set('Cookie', cookie)
      .send({ status: 'broken' })
    /* Un plan clos est clos : le rouvrir effacerait la raison pour laquelle il
       l'a été, et `honoured` puis `broken` raconterait deux histoires. */
    expect(encore.status).toBe(409)
    expect(encore.body.error).toBe('plan_clos')
  })

  it('REND `null` QUAND IL N’Y A PAS DE PLAN, et non un 404', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    const vu = await lirePlan(parkId, leaseId, cookie)
    /* L'absence de plan est une RÉPONSE, pas une adresse introuvable : l'écran
       doit pouvoir proposer d'en convenir un. */
    expect(vu.status).toBe(200)
    expect(vu.body.plan).toBeNull()
  })

  it('EST REFUSÉ AU GESTIONNAIRE : échelonner, c’est renoncer à exiger', async () => {
    const { cookie, parkId, unitId, leaseId } = await parcAvecUnBail()
    const invite = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager', email: 'gest@example.com' })
    const gest = await request(serveur).post('/api/auth/signup').send({
      email: 'gest@example.com',
      password: MDP,
      fullName: 'Diane Fotso',
      confirmLegal: true,
    })
    const cookieGest = cookieDe(gest)
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieGest)
      .send({ invitationCode: invite.body.code })

    const refus = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlement-plans`)
      .set('Cookie', cookieGest)
      .send(TROIS_FOIS)
    expect(refus.status).toBe(403)

    /* ON LUI CONFIE L'IMMEUBLE AVANT DE LIRE, et c'est le produit qui l'exige :
       depuis que `scope` vaut `declared`, une liste vide ne veut plus dire
       « pas de restriction » — un gestionnaire à qui l'on n'a rien confié ne voit
       rien. La règle a été posée après qu'un gestionnaire créé sur un parc réel
       a vu le parc entier. Ma première rédaction l'ignorait et attendait un 200
       sans rien confier ; c'est elle qui avait tort. */
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    const unite = await prisma.unit.findFirstOrThrow({
      where: { id: unitId },
      select: { buildingId: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [unite.buildingId] })

    /* IL LE LIT : c'est lui qui relance, et relancer quelqu'un qui respecte un
       accord est exactement ce que ce lot empêche. */
    expect((await lirePlan(parkId, leaseId, cookieGest)).status).toBe(200)
  })
})
