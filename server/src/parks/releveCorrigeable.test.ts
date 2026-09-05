import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UN INDEX MAL SAISI SE CORRIGE, ET SE RETIRE.
 *
 * ═══ LE DÉFAUT QUE J'AI ROUVERT HIER ═══
 *
 * Trois lots d'affilée ont fermé la même chose : un immeuble et un logement se
 * corrigent, un prix de refacturation se corrige et se retire. Le lot de la
 * refacturation a ensuite créé `MeterReading` — et l'a créé SANS correction ni
 * retrait, l'unicité `(logement, énergie, période)` fermant même le
 * remplacement. Le commit le nommait : « un index tapé à côté est définitif ».
 *
 * Et il porte plus lourd que les précédents : un index FAUX ne se contente pas
 * de s'afficher, il entre dans une échéance et se réclame.
 *
 * ═══ UN RELEVÉ COMPTE DEUX FOIS, ET C'EST TOUT LE SUJET ═══
 *
 * Il est le point d'ARRIVÉE de son mois et le point de DÉPART du suivant.
 * Corriger le relevé de juin change donc la consommation de juin ET celle de
 * juillet. Un recalcul qui ne toucherait que la période du relevé laisserait le
 * mois d'après faux, sans que rien ne le dise.
 *
 * C'est vérifiable sur `montantsDeConsommation` : pour une période, il prend les
 * relevés qui la précèdent, le plus récent faisant le point de départ.
 *
 * ═══ LA MONOTONIE SE GARDE DANS LES DEUX SENS ═══
 *
 * La saisie refuse un index sous le précédent — « un compteur ne redescend
 * pas ». La correction doit refuser cela AUSSI, et l'inverse : un index posé
 * au-dessus du relevé SUIVANT rendrait la consommation du mois d'après négative,
 * donc un avoir silencieux sur la quittance.
 *
 * ═══ CE QU'ELLE NE CORRIGE PAS ═══
 *
 * Ni l'énergie — un compteur d'eau n'est pas un compteur électrique mal rangé —
 * ni la PÉRIODE. Déplacer un relevé d'un mois à l'autre touche DEUX échéances
 * dans deux sens opposés ; le remède est de retirer et de ressaisir, chacun des
 * deux gestes recalculant ce qui le concerne.
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

async function parcLoue(email = 'proprio@example.com') {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email,
    password: MDP,
    fullName: 'Djoumessi Nelson',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const imm = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Residence Djoumessi', district: 'Bastos' })
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({
      unitId,
      fullName: 'Bekonoo Landry',
      phoneE164: '+237690000001',
      startsOn: '2026-01-01',
    })
  await request(serveur)
    .post(`/api/parks/${parkId}/tariffs`)
    .set('Cookie', cookie)
    .send({ utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-01-01' })

  return { cookie, parkId, unitId }
}

function relever(
  parkId: string,
  unitId: string,
  cookie: string,
  periodStart: string,
  indexValue: number,
) {
  return request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/readings`)
    .set('Cookie', cookie)
    .send({ utility: 'water', periodStart, indexValue, readAt: `${periodStart.slice(0, 8)}20` })
}

const echeanceDe = (periode: string) =>
  prisma.rentCharge.findFirstOrThrow({ where: { periodStart: new Date(`${periode}T00:00:00Z`) } })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('corriger un relevé', () => {
  it('réécrit l’index et la date', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    const pose = await relever(parkId, unitId, cookie, '2026-06-01', 342)

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${pose.body.reading.id}`)
      .set('Cookie', cookie)
      .send({ indexValue: 340, readAt: '2026-06-22' })

    expect(reponse.status).toBe(200)
    expect(reponse.body.reading).toMatchObject({ indexValue: 340, readAt: '2026-06-22' })
  })

  it('refuse un index SOUS le relevé précédent', async () => {
    /* Un compteur ne redescend pas : la saisie le refuse déjà, la correction ne
       doit pas rentrer par la fenêtre ce que la porte refuse. */
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, '2026-06-01', 342)
    const juillet = await relever(parkId, unitId, cookie, '2026-07-01', 358)

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${juillet.body.reading.id}`)
      .set('Cookie', cookie)
      .send({ indexValue: 300 })

    expect(reponse.status).toBe(409)
    expect(reponse.body.error).toBe('index_recule')
  })

  it('refuse un index AU-DESSUS du relevé suivant', async () => {
    /* L'autre sens, et il n'existe qu'à la correction : la saisie n'a jamais de
       relevé postérieur. Un index trop haut rendrait la consommation du mois
       d'après NÉGATIVE — un avoir silencieux sur la quittance du locataire. */
    const { cookie, parkId, unitId } = await parcLoue()
    const juin = await relever(parkId, unitId, cookie, '2026-06-01', 342)
    await relever(parkId, unitId, cookie, '2026-07-01', 358)

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${juin.body.reading.id}`)
      .set('Cookie', cookie)
      .send({ indexValue: 400 })

    expect(reponse.status).toBe(409)
    expect(reponse.body.error).toBe('index_depasse_le_suivant')
  })

  it('RECALCULE l’échéance de sa période', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, '2026-06-01', 342)
    const juillet = await relever(parkId, unitId, cookie, '2026-07-01', 358)
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })
    expect((await echeanceDe('2026-07-01')).waterMinor).toBe(16 * 520)

    await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${juillet.body.reading.id}`)
      .set('Cookie', cookie)
      .send({ indexValue: 360 })

    expect((await echeanceDe('2026-07-01')).waterMinor).toBe(18 * 520)
  })

  it('RECALCULE AUSSI l’échéance de la période SUIVANTE', async () => {
    /* Le cœur du lot. Un relevé est le point d'ARRIVÉE de son mois et le point
       de DÉPART du suivant : corriger juin change juin ET juillet. Un recalcul
       borné à la période du relevé laisserait le mois d'après faux, en silence. */
    const { cookie, parkId, unitId } = await parcLoue()
    const juin = await relever(parkId, unitId, cookie, '2026-06-01', 342)
    await relever(parkId, unitId, cookie, '2026-07-01', 358)
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })
    expect((await echeanceDe('2026-07-01')).waterMinor).toBe(16 * 520)

    await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${juin.body.reading.id}`)
      .set('Cookie', cookie)
      .send({ indexValue: 340 })

    /* 358 − 340 = 18, et non plus 16. */
    expect((await echeanceDe('2026-07-01')).waterMinor).toBe(18 * 520)
  })

  it('NE TOUCHE PAS une échéance déjà réglée', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, '2026-06-01', 342)
    const juillet = await relever(parkId, unitId, cookie, '2026-07-01', 358)
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })
    await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({
        unitId,
        periodStart: '2026-07-01',
        amountMinor: 70000,
        method: 'cash',
        paidOn: '2026-07-05',
      })

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${juillet.body.reading.id}`)
      .set('Cookie', cookie)
      .send({ indexValue: 360 })

    expect(reponse.status).toBe(200)
    expect(reponse.body.charges).toContainEqual(
      expect.objectContaining({ updated: false, reason: 'already_paid' }),
    )
    expect((await echeanceDe('2026-07-01')).waterMinor).toBe(16 * 520)
  })

  it('consigne l’AVANT et l’APRÈS au registre', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    const pose = await relever(parkId, unitId, cookie, '2026-06-01', 342)

    await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${pose.body.reading.id}`)
      .set('Cookie', cookie)
      .send({ indexValue: 340 })

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'reading.update' },
    })
    expect(trace.payload).toMatchObject({
      utility: 'water',
      indexValue: 340,
      avant: { indexValue: 342 },
    })
  })

  it('refuse un corps VIDE', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    const pose = await relever(parkId, unitId, cookie, '2026-06-01', 342)
    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/readings/${pose.body.reading.id}`)
      .set('Cookie', cookie)
      .send({})
    expect(reponse.status).toBe(400)
  })

  it('rend 404 sur le relevé d’un AUTRE parc', async () => {
    const mien = await parcLoue('a@example.com')
    const autre = await parcLoue('b@example.com')
    const sien = await relever(autre.parkId, autre.unitId, autre.cookie, '2026-06-01', 342)

    const reponse = await request(serveur)
      .patch(`/api/parks/${mien.parkId}/readings/${sien.body.reading.id}`)
      .set('Cookie', mien.cookie)
      .send({ indexValue: 1 })

    expect(reponse.status).toBe(404)
    const intact = await prisma.meterReading.findUniqueOrThrow({
      where: { id: sien.body.reading.id },
    })
    expect(intact.indexValue).toBe(342)
  })
})

describe('retirer un relevé', () => {
  it('le retire, et le rend ressaisissable', async () => {
    /* L'unicité `(logement, énergie, période)` ferme le remplacement : sans
       retrait, un relevé posé sur le mauvais MOIS n'a aucun remède, la
       correction ne déplaçant pas la période. */
    const { cookie, parkId, unitId } = await parcLoue()
    const pose = await relever(parkId, unitId, cookie, '2026-06-01', 342)

    const reponse = await request(serveur)
      .delete(`/api/parks/${parkId}/readings/${pose.body.reading.id}`)
      .set('Cookie', cookie)

    expect(reponse.status).toBe(204)
    expect(await prisma.meterReading.count({ where: { unitId } })).toBe(0)
    /* Et la même période se ressaisit, ce qui est tout l'objet du retrait. */
    const seconde = await relever(parkId, unitId, cookie, '2026-06-01', 300)
    expect(seconde.status).toBe(201)
  })

  it('RECALCULE l’échéance de la période suivante', async () => {
    /* Retirer le point de DÉPART de juillet le prive de consommation : sans
       recalcul, l'échéance garderait un montant que plus rien ne fonde. */
    const { cookie, parkId, unitId } = await parcLoue()
    const juin = await relever(parkId, unitId, cookie, '2026-06-01', 342)
    await relever(parkId, unitId, cookie, '2026-07-01', 358)
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })
    expect((await echeanceDe('2026-07-01')).waterMinor).toBe(16 * 520)

    await request(serveur)
      .delete(`/api/parks/${parkId}/readings/${juin.body.reading.id}`)
      .set('Cookie', cookie)

    expect((await echeanceDe('2026-07-01')).waterMinor).toBe(0)
  })

  it('consigne le retrait AVEC l’index disparu', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    const pose = await relever(parkId, unitId, cookie, '2026-06-01', 342)

    await request(serveur)
      .delete(`/api/parks/${parkId}/readings/${pose.body.reading.id}`)
      .set('Cookie', cookie)

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'reading.delete' },
    })
    expect(trace.payload).toMatchObject({
      utility: 'water',
      indexValue: 342,
      periodStart: '2026-06-01',
    })
  })

  it('rend 404 sur le relevé d’un AUTRE parc', async () => {
    const mien = await parcLoue('a@example.com')
    const autre = await parcLoue('b@example.com')
    const sien = await relever(autre.parkId, autre.unitId, autre.cookie, '2026-06-01', 342)

    const reponse = await request(serveur)
      .delete(`/api/parks/${mien.parkId}/readings/${sien.body.reading.id}`)
      .set('Cookie', mien.cookie)

    expect(reponse.status).toBe(404)
    expect(await prisma.meterReading.count({ where: { unitId: autre.unitId } })).toBe(1)
  })
})
