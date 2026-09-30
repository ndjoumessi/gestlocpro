import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LES ANNONCES, ET LES SEMAINES OÙ LE PRODUIT NE SERVAIT À RIEN.
 *
 * ═══ CE QUE CE LOT CORRIGE ═══
 *
 * Le produit savait dire qu'un logement était vacant — « pas de bail en cours »,
 * déduit et jamais écrit — et s'arrêtait là. À quel loyer on remet, à partir de
 * quand, qui s'est présenté, ce que la visite a appris : rien n'avait de place.
 * Ce sont pourtant les semaines les plus coûteuses de la vie d'un logement.
 *
 * ═══ LES QUATRE RÈGLES QUE CES CAS TIENNENT ═══
 *
 *   1. UN LOGEMENT OCCUPÉ NE SE REMET PAS EN ANNONCE — MAIS UN LOGEMENT DONT LE
 *      CONGÉ EST DONNÉ, SI. C'est la fenêtre qui évite réellement la vacance, et
 *      elle n'existe que depuis le lot du congé.
 *   2. LE LOYER DEMANDÉ N'EST PAS CELUI DU LOGEMENT. L'annonce porte son prix ;
 *      `Unit.baseRentMinor` n'est pas touché.
 *   3. UN CANDIDAT QU'ON NE PEUT PAS RAPPELER N'EN EST PAS UN.
 *   4. UNE ANNONCE FERMÉE NE DISPARAÎT PAS. C'est elle qui dit à quel prix on
 *      avait demandé, et combien de temps il a fallu.
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

/** Un parc avec DEUX logements : `A1` occupé, `A2` vide. */
async function parcAvecUnLogementVide() {
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
  const a2 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A2', type: 'T2', surfaceSqm: 95, baseRentMinor: 65000 })

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({
      unitId: a1.body.unit.id,
      fullName: 'Serge Mbarga',
      depositMinor: 140000,
      startsOn: '2026-01-01',
    })

  return {
    cookie,
    parkId,
    occupe: a1.body.unit.id as string,
    vide: a2.body.unit.id as string,
  }
}

const ANNONCE = {
  rentMinor: 80000,
  depositMinor: 160000,
  availableFrom: '2026-11-01',
  description: 'Deux chambres, eau et courant relevés au compteur.',
}

function publierPour(parkId: string, unitId: string, cookie: string) {
  return request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/listings`)
    .set('Cookie', cookie)
    .send(ANNONCE)
}

beforeEach(async () => {
  await prisma.userAccount.deleteMany()
  await prisma.park.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('les annonces', () => {
  it('REFUSENT UN LOGEMENT OCCUPÉ SANS DÉPART ANNONCÉ', async () => {
    const { cookie, parkId, occupe, vide } = await parcAvecUnLogementVide()

    const refus = await publierPour(parkId, occupe, cookie)
    expect(refus.status).toBe(409)
    expect(refus.body.error).toBe('logement_occupe')

    /* ET LE LOGEMENT VIDE PASSE — sans cette moitié, le cas serait vert sur une
       route qui refuse tout. */
    expect((await publierPour(parkId, vide, cookie)).status).toBe(201)
  })

  it('ACCEPTENT UN LOGEMENT DONT LE CONGÉ EST DONNÉ — la fenêtre qui évite la vacance', async () => {
    const { cookie, parkId, occupe } = await parcAvecUnLogementVide()

    const bail = await prisma.lease.findFirstOrThrow({
      where: { unitId: occupe },
      select: { id: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/leases/${bail.id}/notice`)
      .set('Cookie', cookie)
      .send({ givenOn: '2026-09-01', givenBy: 'tenant', moveOutOn: '2026-11-30' })

    /* LE BAIL RESTE `active` JUSQU'À LA DATE D'EFFET — c'est ce que le lot du
       congé a posé —, et ces trois semaines sont la seule fenêtre où publier
       évite réellement la vacance. La garde porte donc sur « occupé SANS départ
       annoncé », jamais sur « occupé ». */
    const ouverte = await publierPour(parkId, occupe, cookie)
    expect(ouverte.status, JSON.stringify(ouverte.body)).toBe(201)
  })

  it('PORTENT LEUR PROPRE LOYER, sans toucher à celui du logement', async () => {
    const { cookie, parkId, vide } = await parcAvecUnLogementVide()

    const ouverte = await publierPour(parkId, vide, cookie)
    expect(ouverte.body.listing.rentMinor).toBe(80000)

    /* `Unit.baseRentMinor` N'A PAS BOUGÉ. L'écraser pour y porter une INTENTION
       effacerait ce que le bail en cours paie réellement — et l'écart entre les
       deux est précisément ce qu'on vient lire l'année suivante. */
    const logement = await prisma.unit.findUniqueOrThrow({
      where: { id: vide },
      select: { baseRentMinor: true },
    })
    expect(logement.baseRentMinor).toBe(65000)
  })

  it('NAISSENT EN BROUILLON : une annonce publiée par accident engage un prix', async () => {
    const { cookie, parkId, vide } = await parcAvecUnLogementVide()

    const ouverte = await publierPour(parkId, vide, cookie)
    expect(ouverte.body.listing.status).toBe('draft')

    const publiee = await request(serveur)
      .patch(`/api/parks/${parkId}/listings/${ouverte.body.listing.id}`)
      .set('Cookie', cookie)
      .send({ status: 'published' })
    expect(publiee.body.listing.status).toBe('published')
  })

  it('SURVIVENT À LEUR FERMETURE, avec leurs candidats', async () => {
    const { cookie, parkId, vide } = await parcAvecUnLogementVide()
    const ouverte = await publierPour(parkId, vide, cookie)
    const listingId = ouverte.body.listing.id as string

    await request(serveur)
      .post(`/api/parks/${parkId}/listings/${listingId}/applicants`)
      .set('Cookie', cookie)
      .send({ fullName: 'Chantal Ekwalla', phoneE164: '+237677214408', appliedOn: '2026-10-05' })

    await request(serveur)
      .patch(`/api/parks/${parkId}/listings/${listingId}`)
      .set('Cookie', cookie)
      .send({ status: 'closed' })

    const lecture = await request(serveur)
      .get(`/api/parks/${parkId}/listings`)
      .set('Cookie', cookie)

    /* ELLE RESTE, ET SON CANDIDAT AUSSI : c'est elle qui dit à quel prix on
       avait demandé, et combien de temps il a fallu pour relouer. */
    expect(lecture.body.listings).toHaveLength(1)
    expect(lecture.body.listings[0].status).toBe('closed')
    expect(lecture.body.listings[0].applicants).toHaveLength(1)
  })

  it('NE MONTRENT RIEN À UN GESTIONNAIRE À QUI RIEN N’EST CONFIÉ', async () => {
    const { cookie, parkId, vide } = await parcAvecUnLogementVide()
    await publierPour(parkId, vide, cookie)

    const g = await request(serveur).post('/api/auth/signup').send({
      email: 'diane@example.com',
      password: MDP,
      fullName: 'Diane Fotso',
      confirmLegal: true,
      parkName: 'Parc de Diane',
      countryCode: 'CM',
    })
    const cookieGestionnaire = cookieDe(g)
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({
      data: { userId: compte.id, parkId, role: 'manager', scope: 'declared' },
    })

    const lecture = await request(serveur)
      .get(`/api/parks/${parkId}/listings`)
      .set('Cookie', cookieGestionnaire)

    /* UNE LISTE VIDE NE VEUT PLUS DIRE « PAS DE RESTRICTION ». Règle posée après
       qu'un gestionnaire, sur un parc réel, a vu le parc entier : rien de confié
       signifie rien de visible. */
    expect(lecture.status).toBe(200)
    expect(lecture.body.listings).toEqual([])
  })
})

describe('les candidats', () => {
  async function annonceOuverte() {
    const contexte = await parcAvecUnLogementVide()
    const ouverte = await publierPour(contexte.parkId, contexte.vide, contexte.cookie)
    return { ...contexte, listingId: ouverte.body.listing.id as string }
  }

  it('EXIGENT UN MOYEN DE RAPPELER', async () => {
    const { cookie, parkId, listingId } = await annonceOuverte()

    const sansRien = await request(serveur)
      .post(`/api/parks/${parkId}/listings/${listingId}/applicants`)
      .set('Cookie', cookie)
      .send({ fullName: 'Chantal Ekwalla', appliedOn: '2026-10-05' })
    expect(sansRien.status).toBe(400)

    /* UN TÉLÉPHONE SUFFIT, et c'est le cas le PLUS COURANT sur le marché visé :
       exiger une adresse refuserait la majorité des candidats. */
    const avecTelephone = await request(serveur)
      .post(`/api/parks/${parkId}/listings/${listingId}/applicants`)
      .set('Cookie', cookie)
      .send({ fullName: 'Chantal Ekwalla', phoneE164: '+237677214408', appliedOn: '2026-10-05' })
    expect(avecTelephone.status, JSON.stringify(avecTelephone.body)).toBe(201)

    /* UNE ADRESSE SEULE AUSSI. */
    const avecCourriel = await request(serveur)
      .post(`/api/parks/${parkId}/listings/${listingId}/applicants`)
      .set('Cookie', cookie)
      .send({ fullName: 'Paul Etoga', email: 'paul@example.com', appliedOn: '2026-10-06' })
    expect(avecCourriel.status).toBe(201)
  })

  it('SE REFUSENT SANS DISPARAÎTRE', async () => {
    const { cookie, parkId, listingId } = await annonceOuverte()
    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/listings/${listingId}/applicants`)
      .set('Cookie', cookie)
      .send({ fullName: 'Chantal Ekwalla', phoneE164: '+237677214408', appliedOn: '2026-10-05' })

    const refuse = await request(serveur)
      .patch(`/api/parks/${parkId}/applicants/${pose.body.applicant.id}`)
      .set('Cookie', cookie)
      .send({ status: 'declined', note: 'Cherche un T3.' })

    expect(refuse.body.applicant.status).toBe('declined')
    /* TROIS SEMAINES PLUS TARD, « il n'a jamais postulé » et « on lui a dit
       non » ne sont pas la même réponse à lui faire. */
    const lecture = await request(serveur)
      .get(`/api/parks/${parkId}/listings`)
      .set('Cookie', cookie)
    expect(lecture.body.listings[0].applicants).toHaveLength(1)
    expect(lecture.body.listings[0].applicants[0].note).toBe('Cherche un T3.')
  })

  it('NE DEVIENNENT PAS DES LOCATAIRES EN SE PRÉSENTANT', async () => {
    const { cookie, parkId, listingId } = await annonceOuverte()
    await request(serveur)
      .post(`/api/parks/${parkId}/listings/${listingId}/applicants`)
      .set('Cookie', cookie)
      .send({ fullName: 'Chantal Ekwalla', phoneE164: '+237677214408', appliedOn: '2026-10-05' })

    /* UN CANDIDAT N'A SIGNÉ AUCUN BAIL. Le créer comme locataire le ferait
       entrer dans les quittances, les relances et le registre des accès d'un
       parc où il n'habite pas. */
    const locataires = await prisma.tenant.findMany({
      where: { parkId },
      select: { fullName: true },
    })
    expect(locataires.map((l) => l.fullName)).toEqual(['Serge Mbarga'])
  })
})
