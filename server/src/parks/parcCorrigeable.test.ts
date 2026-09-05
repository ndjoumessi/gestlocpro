import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UN IMMEUBLE ET UN LOGEMENT SE CORRIGENT.
 *
 * ═══ LE MÊME MANQUE QUE LA FICHE LOCATAIRE, D'UN CRAN PLUS BAS ═══
 *
 * `ficheCorrigeable` a ouvert la correction d'une IDENTITÉ de personne, et son
 * en-tête dit ce qui la motivait : « passé le premier loyer encaissé, une faute
 * de frappe était DÉFINITIVE ». Le parc lui-même souffrait du même défaut, en
 * pire — le serveur savait créer un immeuble et un logement, supprimer un
 * immeuble VIDE, et rien d'autre. Ni `PATCH`, ni `PUT`.
 *
 * Ce que ça coûtait, en gestes réels :
 *
 * — « Résidance » au lieu de « Résidence » : l'immeuble est corrigible tant
 *   qu'il est vide, c'est-à-dire tant qu'il ne sert à rien. Dès le premier
 *   logement, la suppression rend 409 `building_not_empty` et la faute est
 *   acquise pour la vie du parc.
 * — Un logement mal numéroté, une surface fausse, un loyer de référence tapé à
 *   côté : AUCUN chemin. Pas même la suppression — le serveur n'en offre pas.
 *
 * ═══ CE QUE LA CORRECTION DU LOYER NE FAIT PAS, ET C'EST L'ESSENTIEL ═══
 *
 * `Unit.baseRentMinor` est un loyer de RÉFÉRENCE, et son schéma le dit :
 * « L'échéance réelle est figée sur chaque `RentCharge` — changer le loyer ne
 * doit pas réécrire le passé. » Le bail porte le sien, l'échéance appelée porte
 * le sien.
 *
 * Une correction qui descendrait dans les baux et les échéances refacturerait
 * juillet au tarif d'août. C'est le défaut que la route d'encaissement nomme
 * déjà — « refacturer juillet au tarif d'août est faux, et rien ne le
 * signalerait » — et un cas le tient ici.
 *
 * ═══ CE QUE LE NUMÉRO PARTAGE AVEC LE NOM D'UN LOCATAIRE ═══
 *
 * `label` doit rester unique DANS son immeuble : deux « A1 » donnent deux lignes
 * indiscernables, et le gestionnaire encaisse sur la mauvaise. La création le
 * garde déjà par un 409 `label_taken` ; la correction doit le garder aussi,
 * sans quoi on rentre par la fenêtre ce que la porte refuse.
 *
 * Et il reste unique dans SON immeuble seulement — « A1 » existe dans presque
 * tous les immeubles du monde, et un cas tient ce sens-là.
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

/** Un parc, un immeuble, un logement. */
async function parcAvecUnLogement(email = 'proprio@example.com') {
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
    .send({ name: 'Residance Djoumessi', district: 'Bastos' })
  const buildingId = imm.body.building.id as string

  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })

  return { cookie, parkId, buildingId, unitId: a1.body.unit.id as string }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('corriger un immeuble', () => {
  it('réécrit le nom et le quartier', async () => {
    const { cookie, parkId, buildingId } = await parcAvecUnLogement()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
      .send({ name: 'Residence Djoumessi', district: 'Bastos Nord' })

    expect(reponse.status).toBe(200)
    expect(reponse.body.building).toMatchObject({
      name: 'Residence Djoumessi',
      district: 'Bastos Nord',
    })

    const enBase = await prisma.building.findUniqueOrThrow({ where: { id: buildingId } })
    expect(enBase.name).toBe('Residence Djoumessi')
  })

  it('CORRIGE UN IMMEUBLE PLEIN — c’est tout l’objet de la route', async () => {
    /* La suppression, seul chemin existant, refuse un immeuble qui porte des
       logements. Si la correction s'arrêtait au même endroit, elle n'ajouterait
       rien : la faute de frappe deviendrait définitive au premier logement. */
    const { cookie, parkId, buildingId } = await parcAvecUnLogement()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
      .send({ name: 'Residence Djoumessi' })

    expect(reponse.status).toBe(200)
  })

  it('consigne l’AVANT et l’APRÈS au registre', async () => {
    const { cookie, parkId, buildingId } = await parcAvecUnLogement()

    await request(serveur)
      .patch(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
      .send({ name: 'Residence Djoumessi' })

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'building.update' },
    })
    expect(trace.entityId).toBe(buildingId)
    /* L'AVANT VIT DANS LA CHARGE UTILE. Un registre qui ne dit que le nouveau
       nom n'apprend rien à qui cherche l'immeuble dont on parle. */
    expect(trace.payload).toMatchObject({
      name: 'Residence Djoumessi',
      avant: { name: 'Residance Djoumessi' },
    })
  })

  it('n’écrit RIEN quand rien ne change', async () => {
    /* Rouvrir la modale et la refermer sans rien toucher n'est pas une
       décision, et un registre qui les compte noie celles qui comptent. */
    const { cookie, parkId, buildingId } = await parcAvecUnLogement()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
      .send({ name: 'Residance Djoumessi' })

    expect(reponse.status).toBe(200)
    expect(await prisma.auditEvent.count({ where: { parkId, action: 'building.update' } })).toBe(0)
  })

  it('refuse un corps VIDE', async () => {
    const { cookie, parkId, buildingId } = await parcAvecUnLogement()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
      .send({})

    expect(reponse.status).toBe(400)
  })

  it('rend 404 sur l’immeuble d’un AUTRE parc — jamais 403', async () => {
    /* Un 403 sur un identifiant valide confirmerait son existence. */
    const mien = await parcAvecUnLogement('a@example.com')
    const autre = await parcAvecUnLogement('b@example.com')

    const reponse = await request(serveur)
      .patch(`/api/parks/${mien.parkId}/buildings/${autre.buildingId}`)
      .set('Cookie', mien.cookie)
      .send({ name: 'Detourne' })

    expect(reponse.status).toBe(404)
    const intact = await prisma.building.findUniqueOrThrow({ where: { id: autre.buildingId } })
    expect(intact.name).toBe('Residance Djoumessi')
  })
})

describe('corriger un logement', () => {
  it('réécrit le numéro, la typologie, la surface et le loyer de référence', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLogement()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookie)
      .send({ label: 'A2', type: 'T3', surfaceSqm: 120, baseRentMinor: 85000 })

    expect(reponse.status).toBe(200)
    expect(reponse.body.unit).toMatchObject({
      label: 'A2',
      type: 'T3',
      surfaceSqm: 120,
      baseRentMinor: 85000,
    })
  })

  it('NE RÉÉCRIT PAS LE PASSÉ : ni le bail, ni l’échéance appelée', async () => {
    /* Le loyer du logement est une RÉFÉRENCE. Le bail fige le sien à la
       signature, l'échéance fige le sien à l'appel. Descendre la correction
       jusqu'à eux refacturerait juillet au tarif d'août. */
    const { cookie, parkId, unitId } = await parcAvecUnLogement()

    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekonoo Landry', phoneE164: '+237690000001' })

    const bailAvant = await prisma.lease.findFirstOrThrow({ where: { unitId } })

    await request(serveur)
      .patch(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookie)
      .send({ baseRentMinor: 85000 })

    const bailApres = await prisma.lease.findUniqueOrThrow({ where: { id: bailAvant.id } })
    expect(bailApres.rentMinor).toBe(bailAvant.rentMinor)
    expect(bailApres.rentMinor).not.toBe(85000)
  })

  it('refuse un numéro DÉJÀ PRIS dans le même immeuble', async () => {
    const { cookie, parkId, buildingId, unitId } = await parcAvecUnLogement()
    await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send({ label: 'B1', type: 'T1', surfaceSqm: 40, baseRentMinor: 30000 })

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookie)
      .send({ label: 'B1' })

    /* 409 et non 400 : la saisie est bien formée, c'est l'état du parc qui s'y
       oppose — même distinction qu'à la création. */
    expect(reponse.status).toBe(409)
    expect(reponse.body.error).toBe('label_taken')
  })

  it('accepte le MÊME numéro dans un AUTRE immeuble', async () => {
    /* « A1 » existe dans presque tous les immeubles du monde : l'unicité porte
       sur le logement DANS son immeuble, jamais dans le parc. */
    const { cookie, parkId, unitId } = await parcAvecUnLogement()
    const second = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Villa Bastos', district: 'Bastos' })
    const ailleurs = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${second.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'Z9', type: 'T1', surfaceSqm: 30, baseRentMinor: 20000 })

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/units/${ailleurs.body.unit.id}`)
      .set('Cookie', cookie)
      .send({ label: 'A1' })

    expect(reponse.status).toBe(200)
    /* Et le premier n'a pas bougé. */
    const premier = await prisma.unit.findUniqueOrThrow({ where: { id: unitId } })
    expect(premier.label).toBe('A1')
  })

  it('consigne l’AVANT et l’APRÈS au registre', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLogement()

    await request(serveur)
      .patch(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookie)
      .send({ baseRentMinor: 85000 })

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'unit.update' },
    })
    expect(trace.entityId).toBe(unitId)
    expect(trace.payload).toMatchObject({
      label: 'A1',
      baseRentMinor: 85000,
      avant: { baseRentMinor: 70000 },
    })
  })

  it('rend 404 sur le logement d’un AUTRE parc', async () => {
    const mien = await parcAvecUnLogement('a@example.com')
    const autre = await parcAvecUnLogement('b@example.com')

    const reponse = await request(serveur)
      .patch(`/api/parks/${mien.parkId}/units/${autre.unitId}`)
      .set('Cookie', mien.cookie)
      .send({ baseRentMinor: 1 })

    expect(reponse.status).toBe(404)
    const intact = await prisma.unit.findUniqueOrThrow({ where: { id: autre.unitId } })
    expect(intact.baseRentMinor).toBe(70000)
  })
})
