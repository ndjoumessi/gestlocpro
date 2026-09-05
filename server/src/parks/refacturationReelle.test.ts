import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * « REFACTURÉ » EST UN PARTICIPE PASSÉ, ET RIEN NE L'AVAIT JAMAIS ÉTÉ.
 *
 * ═══ LA COQUILLE, MESURÉE ═══
 *
 * L'écran des relevés affiche « Refacturé » par ligne et « Total refacturé » en
 * pied. Derrière, au 2026-09-05 :
 *
 *   — AUCUNE route n'écrivait de `MeterReading`. Seule `demo.ts` en semait :
 *     sur un parc réel, l'écran n'avait rien à montrer, JAMAIS.
 *   — AUCUNE route n'écrivait `RentCharge.waterMinor` ni `powerMinor`. La
 *     quittance les sert pourtant déjà, et les additionne au loyer pour son
 *     `dueMinor` : le tuyau d'aval était posé, il ne recevait rien.
 *
 * C'est exactement le mensonge que la route d'encaissement nomme pour elle-même
 * — « l'écran affichait "Paiement enregistré · quittance envoyée" sans rien
 * écrire nulle part » — un cran plus loin : ici c'est le mot qui promet.
 *
 * ═══ LE PREMIER RELEVÉ NE FACTURE RIEN, ET C'EST LE CŒUR ═══
 *
 * Le client calculait `previousIndex ?? 0`. Sur un premier relevé, il n'y a pas
 * d'index antérieur : la consommation devenait donc l'INDEX ENTIER du compteur.
 * Un compteur électrique à 4 120 kWh facturait 4 120 kWh le premier mois.
 *
 * Le défaut ne se voyait pas — la démonstration donne un antérieur à chacun de
 * ses relevés — et il ne coûtait rien tant que rien n'était facturé. Câbler la
 * refacturation le transforme en argent réclamé. On ne facture donc RIEN sans
 * point de départ : deux relevés font une consommation, un seul n'en fait pas.
 *
 * ═══ CE QU'UN RELEVÉ SAISI APRÈS L'APPEL DOIT FAIRE ═══
 *
 * L'appel de loyers n'écrit qu'une fois par période — `skipDuplicates`, et le
 * motif est bon : « appeler deux fois le même mois est SANS EFFET ». Un relevé
 * saisi APRÈS l'appel ne serait donc jamais facturé, et rien ne le dirait : un
 * piège silencieux dans de l'argent. Le relevé rattrape donc son échéance.
 *
 * MAIS JAMAIS UNE ÉCHÉANCE SUR LAQUELLE ON A DÉJÀ REÇU. Modifier ce qui est dû
 * après un versement déplacerait une dette que quelqu'un a commencé à solder —
 * son reçu dirait autre chose que sa quittance.
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

/** Un parc, un logement loué, et les deux prix de refacturation posés. */
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
    /* `startsOn` AU PASSÉ : un bail qui commence après la période ne lui doit
       rien — l'appel de loyers le filtre, et sans cette date le cas mesurerait un
       parc sans échéance. */
    .send({
      unitId,
      fullName: 'Bekonoo Landry',
      phoneE164: '+237690000001',
      startsOn: '2026-01-01',
    })

  /* 520 le m³, 99 le kWh — les deux constantes que le client portait en dur
     avant que la table des tarifs ne serve. */
  for (const [utility, prix] of [
    ['water', 520],
    ['power', 99],
  ] as const) {
    await request(serveur)
      .post(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', cookie)
      .send({ utility, unitPriceMinor: prix, effectiveFrom: '2026-01-01' })
  }

  return { cookie, parkId, unitId }
}

/** Pose un relevé. */
function relever(
  parkId: string,
  unitId: string,
  cookie: string,
  corps: { utility: 'water' | 'power'; periodStart: string; indexValue: number; readAt: string },
) {
  return request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/readings`)
    .set('Cookie', cookie)
    .send(corps)
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('saisir un relevé', () => {
  it('l’écrit, et le rend', async () => {
    const { cookie, parkId, unitId } = await parcLoue()

    const reponse = await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-07-01',
      indexValue: 342,
      readAt: '2026-07-20',
    })

    expect(reponse.status).toBe(201)
    expect(reponse.body.reading).toMatchObject({ utility: 'water', indexValue: 342 })
    expect(await prisma.meterReading.count({ where: { unitId } })).toBe(1)
  })

  it('refuse un SECOND relevé pour la même énergie et la même période', async () => {
    /* L'unicité `(logement, énergie, période)` est au schéma. Deux index pour le
       même mois rendraient indéterminable la consommation facturée. */
    const { cookie, parkId, unitId } = await parcLoue()
    const corps = {
      utility: 'water' as const,
      periodStart: '2026-07-01',
      indexValue: 342,
      readAt: '2026-07-20',
    }
    await relever(parkId, unitId, cookie, corps)

    const reponse = await relever(parkId, unitId, cookie, { ...corps, indexValue: 350 })
    expect(reponse.status).toBe(409)
    expect(reponse.body.error).toBe('reading_exists')
  })

  it('refuse un index qui RECULE', async () => {
    /* Un compteur ne redescend pas. Un index inférieur au précédent est une
       faute de frappe — et l'accepter facturerait une consommation négative,
       donc un AVOIR silencieux sur la quittance du locataire. */
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-06-01',
      indexValue: 342,
      readAt: '2026-06-20',
    })

    const reponse = await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-07-01',
      indexValue: 300,
      readAt: '2026-07-20',
    })
    expect(reponse.status).toBe(409)
    expect(reponse.body.error).toBe('index_recule')
  })

  it('rend 404 sur le logement d’un AUTRE parc', async () => {
    const mien = await parcLoue('a@example.com')
    const autre = await parcLoue('b@example.com')

    const reponse = await relever(mien.parkId, autre.unitId, mien.cookie, {
      utility: 'water',
      periodStart: '2026-07-01',
      indexValue: 1,
      readAt: '2026-07-20',
    })
    expect(reponse.status).toBe(404)
    expect(await prisma.meterReading.count({ where: { unitId: autre.unitId } })).toBe(0)
  })

  it('consigne le relevé au registre', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, {
      utility: 'power',
      periodStart: '2026-07-01',
      indexValue: 4120,
      readAt: '2026-07-20',
    })

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'reading.record' },
    })
    expect(trace.payload).toMatchObject({ utility: 'power', indexValue: 4120 })
  })
})

describe('la consommation devient une somme appelée', () => {
  /** Deux mois de relevés : juin sert de point de départ, juillet se facture. */
  async function deuxMois(parkId: string, unitId: string, cookie: string) {
    await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-06-01',
      indexValue: 342,
      readAt: '2026-06-20',
    })
    await relever(parkId, unitId, cookie, {
      utility: 'power',
      periodStart: '2026-06-01',
      indexValue: 4120,
      readAt: '2026-06-20',
    })
    await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-07-01',
      indexValue: 358,
      readAt: '2026-07-20',
    })
    await relever(parkId, unitId, cookie, {
      utility: 'power',
      periodStart: '2026-07-01',
      indexValue: 4298,
      readAt: '2026-07-20',
    })
  }

  it('porte l’eau et le courant sur l’échéance appelée', async () => {
    const { cookie, parkId, unitId } = await parcLoue()
    await deuxMois(parkId, unitId, cookie)

    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })

    const echeance = await prisma.rentCharge.findFirstOrThrow({
      where: { periodStart: new Date('2026-07-01T00:00:00Z') },
    })
    /* 358 − 342 = 16 m³ à 520 ; 4 298 − 4 120 = 178 kWh à 99. */
    expect(echeance.waterMinor).toBe(16 * 520)
    expect(echeance.powerMinor).toBe(178 * 99)
  })

  it('NE FACTURE RIEN sur un PREMIER relevé — pas de point de départ', async () => {
    /* Le défaut que ce lot ferme : `previousIndex ?? 0` faisait de l'index
       entier une consommation. 342 m³ au premier mois, sur un compteur qui
       tourne depuis des années. */
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-07-01',
      indexValue: 342,
      readAt: '2026-07-20',
    })

    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })

    const echeance = await prisma.rentCharge.findFirstOrThrow({})
    expect(echeance.waterMinor).toBe(0)
  })

  it('ne facture pas une consommation SANS TARIF, et garde le relevé', async () => {
    /* Un prix absent n'est pas un prix nul. Le relevé existe, l'écran montre la
       quantité, et rien n'est réclamé. */
    const proprio = await request(serveur).post('/api/auth/signup').send({
      email: 'sanstarif@example.com',
      password: MDP,
      fullName: 'Sans Tarif',
      acceptTerms: true,
      parkName: 'Parc nu',
      countryCode: 'CM',
    })
    const cookie = cookieDe(proprio)
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = moi.body.memberships[0].parkId as string
    const imm = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Immeuble', district: 'Bastos' })
    const a1 = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T2', surfaceSqm: 60, baseRentMinor: 50000 })
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({
        unitId: a1.body.unit.id,
        fullName: 'Locataire',
        phoneE164: '+237690000002',
        startsOn: '2026-01-01',
      })
    await deuxMois(parkId, a1.body.unit.id, cookie)

    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })

    const echeance = await prisma.rentCharge.findFirstOrThrow({})
    expect(echeance.waterMinor).toBe(0)
    expect(await prisma.meterReading.count()).toBe(4)
  })

  it('LA QUITTANCE PORTE LA SOMME, et le locataire qui ne paie que le loyer n’est pas quitte', async () => {
    /* Le bout de la chaîne, et la seule preuve qui compte : « Refacturé »
       cesse d'être un participe passé sans passé. */
    const { cookie, parkId, unitId } = await parcLoue()
    await deuxMois(parkId, unitId, cookie)
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

    const quittance = await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', kind: 'receipt' })

    expect(quittance.status).toBe(201)
    expect(quittance.body.document.waterMinor).toBe(16 * 520)
    expect(quittance.body.document.dueMinor).toBe(70000 + 16 * 520 + 178 * 99)
    expect(quittance.body.document.balanceMinor).toBeGreaterThan(0)
  })

  it('un relevé saisi APRÈS l’appel rattrape l’échéance', async () => {
    /* `skipDuplicates` fait qu'un second appel est sans effet — c'est voulu.
       Sans ce rattrapage, un relevé en retard ne serait jamais facturé, et rien
       ne le dirait. */
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-06-01',
      indexValue: 342,
      readAt: '2026-06-20',
    })
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-07-01' })

    await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-07-01',
      indexValue: 358,
      readAt: '2026-07-25',
    })

    const echeance = await prisma.rentCharge.findFirstOrThrow({
      where: { periodStart: new Date('2026-07-01T00:00:00Z') },
    })
    expect(echeance.waterMinor).toBe(16 * 520)
  })

  it('NE TOUCHE PAS une échéance sur laquelle on a déjà reçu', async () => {
    /* Déplacer ce qui est dû après un versement ferait dire à un reçu autre
       chose qu'à la quittance qui le suit. */
    const { cookie, parkId, unitId } = await parcLoue()
    await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-06-01',
      indexValue: 342,
      readAt: '2026-06-20',
    })
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

    const reponse = await relever(parkId, unitId, cookie, {
      utility: 'water',
      periodStart: '2026-07-01',
      indexValue: 358,
      readAt: '2026-07-25',
    })

    /* Le relevé est ÉCRIT — c'est un fait de terrain, il ne se refuse pas —
       mais l'échéance ne bouge pas, et la réponse le dit. */
    expect(reponse.status).toBe(201)
    expect(reponse.body.charge).toMatchObject({ updated: false, reason: 'already_paid' })
    const echeance = await prisma.rentCharge.findFirstOrThrow({
      where: { periodStart: new Date('2026-07-01T00:00:00Z') },
    })
    expect(echeance.waterMinor).toBe(0)
  })
})
