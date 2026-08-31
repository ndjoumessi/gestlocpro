import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * RELIER UNE FICHE LOCATAIRE À UN COMPTE DÉJÀ MEMBRE.
 *
 * ═══ UNE PROMESSE SANS MÉCANISME ═══
 *
 * L'espace du locataire sans fiche affiche, mot pour mot : « Demandez à votre
 * propriétaire ou à votre gestionnaire de relier votre fiche locataire à ce
 * compte. » CE GESTE N'EXISTAIT PAS. Aucune route, aucun écran. Le produit
 * envoyait le locataire réclamer une action introuvable, ce qui est pire que de
 * ne rien dire : il fait douter celui qui cherche.
 *
 * Le cas se produit dès qu'un compte rejoint le parc AVANT que sa fiche existe
 * — invitation sur un logement vacant, puis création de la fiche —, et pour
 * tous ceux entrés avant que la consommation du code ne rattache quoi que ce
 * soit. Constaté sur la production : un locataire membre du parc, un bail actif
 * à son nom, et « aucun logement rattaché à votre compte ».
 *
 * ═══ CE QUE LA ROUTE REFUSE, ET POURQUOI CHAQUE REFUS COMPTE ═══
 *
 * Relier, c'est donner à quelqu'un la vue d'un bail, de ses quittances et de
 * ses relevés. Un lien posé sur la mauvaise personne ouvre les données d'un
 * locataire à un autre — c'est la faute la plus grave que cet écran puisse
 * commettre, et elle est silencieuse.
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

/** Un parc, un logement, une fiche SANS compte, et un locataire membre. */
async function parcAvecUneFicheOrpheline() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
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
  const log = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
  const unitId = log.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekono Landry', phoneE164: '+237677000001' })

  /* Le locataire entre par un code SANS logement : c'est le chemin qui laisse
     la fiche orpheline, et celui que l'aide du champ d'invitation recommande. */
  const inv = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant' })
  const locataire = await request(serveur).post('/api/auth/signup').send({
    email: 'romel@example.com',
    password: MDP,
    fullName: 'Bekono Landry',
    acceptTerms: true,
    invitationCode: inv.body.code,
  })

  const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
  return {
    cookie,
    parkId,
    unitId,
    cookieLocataire: cookieDe(locataire),
    userId: locataire.body.user.id as string,
    acces: acces.body,
  }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
  await new Promise((resoudre) => serveur.close(resoudre))
})

describe('le registre des accès', () => {
  it('DIT quelles fiches n’ont pas de compte, sans quoi rien n’est réparable', async () => {
    const { acces } = await parcAvecUneFicheOrpheline()
    expect(
      acces.unlinkedTenants,
      'le registre ne nomme aucune fiche orpheline : l’écran n’a rien à proposer',
    ).toHaveLength(1)
    expect(acces.unlinkedTenants[0].fullName).toBe('Bekono Landry')
    expect(acces.unlinkedTenants[0].unitLabel).toBe('A1')
  })

  it('dit aussi quel membre n’a PAS de fiche', async () => {
    const { acces, userId } = await parcAvecUneFicheOrpheline()
    const membre = acces.members.find((m: { role: string }) => m.role === 'tenant')
    expect(membre.userId, 'le membre ne porte pas son compte').toBe(userId)
    expect(membre.tenantId, 'le membre est présenté comme relié alors qu’il ne l’est pas').toBeNull()
  })
})

describe('relier une fiche à un compte', () => {
  it('rend au locataire son logement', async () => {
    const { cookie, parkId, unitId, cookieLocataire, userId, acces } =
      await parcAvecUneFicheOrpheline()

    const avant = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieLocataire)
    expect(
      (avant.body.buildings as { units: unknown[] }[]).flatMap((b) => b.units),
      'le locataire voyait déjà son logement : le montage du cas est faux',
    ).toHaveLength(0)

    const lien = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${acces.unlinkedTenants[0].id}/compte`)
      .set('Cookie', cookie)
      .send({ userId })
    expect(lien.status, String(lien.text).slice(0, 160)).toBe(204)

    const apres = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieLocataire)
    const logements = (apres.body.buildings as { units: { id: string }[] }[]).flatMap((b) => b.units)
    expect(logements, 'le lien est posé et le locataire ne voit toujours rien').toHaveLength(1)
    expect(logements[0]!.id).toBe(unitId)
  })

  it('REFUSE un compte qui n’est pas membre de ce parc', async () => {
    /* Sans ce refus, un identifiant de compte deviné ouvrirait le bail d'un
       locataire à n'importe quel compte du produit. C'est le refus qui compte
       le plus de la route. */
    const { cookie, parkId, acces } = await parcAvecUneFicheOrpheline()
    const etranger = await request(serveur).post('/api/auth/signup').send({
      email: 'etranger@example.com',
      password: MDP,
      fullName: 'Quelqu’un d’autre',
      acceptTerms: true,
    })

    const lien = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${acces.unlinkedTenants[0].id}/compte`)
      .set('Cookie', cookie)
      .send({ userId: etranger.body.user.id })
    expect(lien.status).toBe(404)
  })

  it('REFUSE un membre qui n’est pas locataire', async () => {
    /* Un propriétaire relié à une fiche deviendrait le locataire de son propre
       parc : `unitesVisibles` le bornerait alors à ce seul logement. */
    const { cookie, parkId, acces } = await parcAvecUneFicheOrpheline()
    const proprietaire = acces.members.find((m: { role: string }) => m.role === 'owner')

    const lien = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${acces.unlinkedTenants[0].id}/compte`)
      .set('Cookie', cookie)
      .send({ userId: proprietaire.userId })
    expect(lien.status).toBe(409)
  })

  it('REFUSE de relier une fiche DÉJÀ reliée', async () => {
    /* Réécrire un lien retirerait son espace à la personne qui l'avait. */
    const { cookie, parkId, userId, acces } = await parcAvecUneFicheOrpheline()
    const ficheId = acces.unlinkedTenants[0].id

    await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
      .set('Cookie', cookie)
      .send({ userId })

    const second = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
      .set('Cookie', cookie)
      .send({ userId })
    expect(second.status).toBe(409)
  })

  it('n’est pas offerte au LOCATAIRE lui-même', async () => {
    /* Se relier soi-même à la fiche de son choix est exactement l'escalade que
       ce lot ne doit pas ouvrir. */
    const { parkId, cookieLocataire, userId, acces } = await parcAvecUneFicheOrpheline()
    const lien = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${acces.unlinkedTenants[0].id}/compte`)
      .set('Cookie', cookieLocataire)
      .send({ userId })
    expect(lien.status).toBe(403)
  })
})
