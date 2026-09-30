import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE CONGÉ, LA RÉVISION DE LOYER, LE GARANT.
 *
 * ═══ LA RÈGLE LA PLUS CHÈRE : UN CONGÉ N'EST PAS UNE FIN ═══
 *
 * `moveOutOn` est une date d'EFFET, et le bail reste `active` jusque-là : le
 * locataire habite encore, son loyer est encore appelé, ses charges encore
 * refacturées. Basculer `ended` à la réception du congé ferait cesser l'appel de
 * loyer sur un logement occupé — l'erreur inverse de celle que ce lot corrige, et
 * la seule des deux qui se paie en argent perdu chaque mois.
 *
 * ═══ LA RÉVISION NE RÉÉCRIT PAS LE PASSÉ, ET C'EST L'INVERSE D'UN TARIF ═══
 *
 * `RentCharge` fige son propre `rentMinor` à l'appel : une révision au 1er avril
 * laisse la quittance de mars intacte. La correction d'un TARIF de refacturation
 * fait le contraire — elle relit la table à chaque lecture et répare donc le passé
 * affiché. Les deux sont justes, pour deux raisons opposées, et transposer l'une à
 * l'autre réécrirait des documents remis.
 *
 * ═══ CE QUE LA BASE NE PEUT PAS TENIR ═══
 *
 *   * Le départ ne précède pas le congé — aucune contrainte SQL ne l'exprime.
 *   * Un garant doit être joignable : un nom sans téléphone ni courriel est
 *     inutile le seul jour où on le lit.
 *   * `previousRentMinor` est lu DANS la transaction : deux révisions simultanées
 *     liraient sinon le même « avant », et la seconde écrirait un saut qui n'a
 *     jamais eu lieu.
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
  const buildingId = imm.body.building.id as string
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Serge Mbarga', depositMinor: 200000, startsOn: '2026-01-01' })

  const bail = await prisma.lease.findFirstOrThrow({
    where: { unitId },
    select: { id: true, rentMinor: true },
  })
  return { cookie, parkId, unitId, leaseId: bail.id, loyer: bail.rentMinor }
}

function panneau(parkId: string, leaseId: string, cookie: string) {
  return request(serveur)
    .get(`/api/parks/${parkId}/leases/${leaseId}/sureties`)
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

describe('le congé', () => {
  it('NE TERMINE PAS LE BAIL : il reste actif jusqu’à la date d’effet', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()

    /* LE STATUT AVANT, et non une valeur écrite en dur : un bail neuf est
       `pending` jusqu'au premier encaissement — le schéma le pose ainsi pour ne
       pas fausser les indicateurs. Écrire `active` ici aurait fait rougir le cas
       pour une raison qui n'est pas la sienne, et l'affirmation qui compte est
       que le congé ne TOUCHE PAS au statut, quel qu'il soit. */
    const avant = await prisma.lease.findUniqueOrThrow({
      where: { id: leaseId },
      select: { status: true },
    })

    const pose = await request(serveur)
      .patch(`/api/parks/${parkId}/leases/${leaseId}/notice`)
      .set('Cookie', cookie)
      .send({ givenOn: '2026-03-01', givenBy: 'tenant', moveOutOn: '2026-05-31' })
    expect(pose.status, JSON.stringify(pose.body)).toBe(200)

    const vu = await panneau(parkId, leaseId, cookie)
    expect(vu.body.lease).toMatchObject({
      noticeGivenOn: '2026-03-01',
      noticeGivenBy: 'tenant',
      moveOutOn: '2026-05-31',
      /* LE POINT DU LOT. Un `ended` ici ferait cesser l'appel de loyer sur un
         logement encore occupé, et ce serait pire que le défaut d'origine. */
      status: avant.status,
    })
    expect(vu.body.lease.status).not.toBe('ended')
  })

  it('REFUSE UN DÉPART ANTÉRIEUR AU CONGÉ', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    const refus = await request(serveur)
      .patch(`/api/parks/${parkId}/leases/${leaseId}/notice`)
      .set('Cookie', cookie)
      .send({ givenOn: '2026-03-15', givenBy: 'landlord', moveOutOn: '2026-03-01' })
    /* 400 : le corps est mal formé. Un départ déjà consommé se dit en TERMINANT
       le bail, ce qui est un autre geste. */
    expect(refus.status).toBe(400)
    expect((await panneau(parkId, leaseId, cookie)).body.lease.noticeGivenOn).toBeNull()
  })

  it('SE RETIRE EN ENTIER, les quatre colonnes ensemble', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    await request(serveur)
      .patch(`/api/parks/${parkId}/leases/${leaseId}/notice`)
      .set('Cookie', cookie)
      .send({ givenOn: '2026-03-01', givenBy: 'tenant', moveOutOn: '2026-05-31', reason: 'Mutation' })

    const retrait = await request(serveur)
      .delete(`/api/parks/${parkId}/leases/${leaseId}/notice`)
      .set('Cookie', cookie)
    expect(retrait.status).toBe(204)

    const vu = await panneau(parkId, leaseId, cookie)
    /* LES QUATRE, et pas trois : un congé dont on garderait la date sans la date
       d'effet ne serait ni un congé ni son absence. */
    expect(vu.body.lease).toMatchObject({
      noticeGivenOn: null,
      noticeGivenBy: null,
      noticeReason: null,
      moveOutOn: null,
    })
    expect(
      await prisma.auditEvent.count({ where: { action: 'lease.notice_withdraw' } }),
    ).toBe(1)
  })
})

describe('la révision de loyer', () => {
  it('ÉCRIT LA TRACE ET LE BAIL, et laisse les échéances déjà appelées', async () => {
    const { cookie, parkId, leaseId, unitId, loyer } = await parcAvecUnBail()

    /* Une échéance appelée AVANT la révision : elle a figé son loyer. */
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-02-01' })
    const avantRevision = await prisma.rentCharge.findFirstOrThrow({
      where: { lease: { unitId } },
      select: { rentMinor: true },
      orderBy: { dueOn: 'asc' },
    })

    const revision = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/revisions`)
      .set('Cookie', cookie)
      .send({ effectiveOn: '2026-04-01', newRentMinor: loyer + 7000, reason: 'Indexation' })
    expect(revision.status, JSON.stringify(revision.body)).toBe(201)

    const vu = await panneau(parkId, leaseId, cookie)
    /* LE BAIL A CHANGÉ… */
    expect(vu.body.lease.rentMinor).toBe(loyer + 7000)
    /* …LA TRACE PORTE L'AVANT ET L'APRÈS, lisible seule… */
    expect(vu.body.revisions).toHaveLength(1)
    expect(vu.body.revisions[0]).toMatchObject({
      previousRentMinor: loyer,
      newRentMinor: loyer + 7000,
      effectiveOn: '2026-04-01',
    })
    /* …ET L'ÉCHÉANCE DE FÉVRIER N'A PAS BOUGÉ. C'est l'inverse d'un tarif de
       refacturation corrigé, qui répare le passé affiché. */
    const apresRevision = await prisma.rentCharge.findFirstOrThrow({
      where: { lease: { unitId } },
      select: { rentMinor: true },
      orderBy: { dueOn: 'asc' },
    })
    expect(apresRevision.rentMinor).toBe(avantRevision.rentMinor)
  })

  it('REFUSE UNE RÉVISION QUI NE CHANGE RIEN', async () => {
    const { cookie, parkId, leaseId, loyer } = await parcAvecUnBail()
    const refus = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/revisions`)
      .set('Cookie', cookie)
      .send({ effectiveOn: '2026-04-01', newRentMinor: loyer })
    expect(refus.status).toBe(409)
    expect(refus.body.error).toBe('same_rent')
    /* AUCUNE LIGNE D'HISTORIQUE : « de 70 000 à 70 000 » polluerait la seule
       table qui explique une hausse. */
    expect((await panneau(parkId, leaseId, cookie)).body.revisions).toHaveLength(0)
  })

  it('REFUSE DEUX RÉVISIONS À LA MÊME DATE D’EFFET', async () => {
    const { cookie, parkId, leaseId, loyer } = await parcAvecUnBail()
    const poser = (montant: number) =>
      request(serveur)
        .post(`/api/parks/${parkId}/leases/${leaseId}/revisions`)
        .set('Cookie', cookie)
        .send({ effectiveOn: '2026-04-01', newRentMinor: montant })

    expect((await poser(loyer + 5000)).status).toBe(201)
    const second = await poser(loyer + 9000)
    /* Tenu par la BASE : deux hausses le même jour rendraient indéterminable le
       loyer de ce jour-là. */
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('revision_exists')
  })

  it('EST REFUSÉE AU GESTIONNAIRE : un loyer engage le revenu du parc', async () => {
    const { cookie, parkId, leaseId, loyer } = await parcAvecUnBail()
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
      .post(`/api/parks/${parkId}/leases/${leaseId}/revisions`)
      .set('Cookie', cookieGest)
      .send({ effectiveOn: '2026-04-01', newRentMinor: loyer + 5000 })
    expect(refus.status).toBe(403)
  })
})

describe('le garant', () => {
  it('EXIGE UN MOYEN DE LE JOINDRE', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    const refus = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/guarantors`)
      .set('Cookie', cookie)
      .send({ fullName: 'Paul Etoa', relation: 'père' })
    /* Un nom sans téléphone ni courriel est un nom sur un papier : il ne sert à
       rien le seul jour où on le lit. */
    expect(refus.status).toBe(400)
    expect((await panneau(parkId, leaseId, cookie)).body.guarantors).toHaveLength(0)
  })

  it('S’AJOUTE À PLUSIEURS, dans l’ordre où ils ont signé', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    for (const nom of ['Paul Etoa', 'Marie Etoa']) {
      const ajout = await request(serveur)
        .post(`/api/parks/${parkId}/leases/${leaseId}/guarantors`)
        .set('Cookie', cookie)
        .send({ fullName: nom, phoneE164: '+237699000000', relation: 'parent' })
      expect(ajout.status, JSON.stringify(ajout.body)).toBe(201)
    }

    const vu = await panneau(parkId, leaseId, cookie)
    /* DEUX, ET DANS L'ORDRE D'AJOUT : deux parents qui se portent garants
       ensemble se lisent dans l'ordre où ils ont signé, pas alphabétique. */
    expect((vu.body.guarantors as { fullName: string }[]).map((g) => g.fullName)).toEqual([
      'Paul Etoa',
      'Marie Etoa',
    ])
  })

  it('PART AVEC SA TRACE', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    const ajout = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/guarantors`)
      .set('Cookie', cookie)
      .send({ fullName: 'Paul Etoa', email: 'paul@example.com', relation: 'père' })
    const id = ajout.body.guarantor.id as string

    expect(
      (
        await request(serveur)
          .delete(`/api/parks/${parkId}/guarantors/${id}`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(204)
    expect((await panneau(parkId, leaseId, cookie)).body.guarantors).toHaveLength(0)

    const trace = await prisma.auditEvent.findFirst({
      where: { action: 'guarantor.remove', entityId: id },
      select: { payload: true },
    })
    expect(trace!.payload).toMatchObject({ fullName: 'Paul Etoa', relation: 'père' })
  })
})
