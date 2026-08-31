import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LA FICHE NAÎT RELIÉE, AU LIEU DE NAÎTRE ORPHELINE.
 *
 * ═══ LA CAUSE, ET NON PLUS LE SYMPTÔME ═══
 *
 * Deux lots ont déjà payé les conséquences de ce défaut : « relier à une fiche »
 * sur l'écran des accès, puis le code qui rattache un membre déjà entré. Les
 * deux RÉPARENT. Aucun n'empêche.
 *
 * L'ordre qui produit l'orphelin est celui que le produit RECOMMANDE. L'aide du
 * champ d'invitation dit : « sans logement, il rejoint le parc sans bail, vous
 * l'y rattacherez ensuite ». On invite donc d'abord — le compte entre —, on
 * crée la fiche ensuite. Et cette création ne regardait pas qui est déjà là :
 * elle posait `Tenant.userId = null` sans jamais demander. Le locataire, membre
 * du parc, avec un bail à son nom, lisait « aucun logement rattaché à votre
 * compte », et il fallait un troisième geste pour recoudre les deux moitiés.
 *
 * ═══ EXPLICITE, ET JAMAIS DEVINÉ ═══
 *
 * Le lien se fait sur un `userId` CHOISI, pas sur une correspondance de nom ni
 * de téléphone. Deux frères au même patronyme, un numéro de famille partagé —
 * et le mauvais compte reçoit le bail, les quittances et les relevés d'un
 * autre. C'est la faute la plus grave que ce produit puisse commettre, et elle
 * serait silencieuse. Une devinette n'a pas sa place ici.
 *
 * ═══ LES MÊMES REFUS QUE LE GESTE DE RÉPARATION ═══
 *
 * Pas une seconde liste : `compteReliable` est partagée avec
 * `POST /tenants/:id/compte`. Deux jeux de contrôles pour une même décision
 * finiraient par diverger, et c'est du côté permissif que ça se paie.
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

/** Un parc, deux logements, et un locataire ENTRÉ SANS BAIL — l'ordre recommandé. */
async function parcAvecUnMembreSansFiche() {
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
  const immeubleId = imm.body.building.id as string
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${immeubleId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
  const a2 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${immeubleId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A2', type: 'T2', surfaceSqm: 90, baseRentMinor: 30000 })

  // Le code SANS logement : c'est le chemin que l'aide du champ recommande.
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

  return {
    cookie,
    parkId,
    unitId: a1.body.unit.id as string,
    autreUnitId: a2.body.unit.id as string,
    cookieLocataire: cookieDe(locataire),
    userId: locataire.body.user.id as string,
    proprioId: proprio.body.user.id as string,
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

describe('créer une fiche pour un compte déjà membre', () => {
  it('rend au locataire son logement sans troisième geste', async () => {
    const { cookie, parkId, unitId, cookieLocataire, userId } = await parcAvecUnMembreSansFiche()

    const cree = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', phoneE164: '+237677000001', userId })
    expect(cree.status, `création refusée : ${JSON.stringify(cree.body)}`).toBe(201)

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieLocataire)
    expect(
      (vu.body.buildings as { units: { label: string }[] }[]).flatMap((b) => b.units),
      'le locataire ne voit pas le logement dont on vient de lui ouvrir le bail',
    ).toHaveLength(1)
  })

  it('ne laisse plus de fiche orpheline derrière elle', async () => {
    const { cookie, parkId, unitId, userId } = await parcAvecUnMembreSansFiche()

    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', userId })

    const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
    expect(acces.body.unlinkedTenants ?? [], 'une fiche orpheline reste à réparer').toHaveLength(0)
    const membre = acces.body.members.find((m: { role: string }) => m.role === 'tenant')
    expect(membre.tenantId, 'le membre n’est pas présenté comme relié').toBeTruthy()
  })

  it('trace le lien au registre, comme le geste de réparation', async () => {
    const { cookie, parkId, unitId, userId } = await parcAvecUnMembreSansFiche()

    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', userId })

    const journal = await request(serveur)
      .get(`/api/parks/${parkId}/decisions`)
      .set('Cookie', cookie)
    const actions = (journal.body.decisions as { action: string }[]).map((d) => d.action)
    expect(actions, 'donner un accès n’est pas tracé quand il vient d’une création').toContain(
      'access.link',
    )
  })

  /* ═══ CE QU'ELLE REFUSE, ET RIEN N'EST ÉCRIT QUAND ELLE REFUSE ═══ */

  it('refuse un compte qui n’est pas membre de ce parc', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnMembreSansFiche()
    const etranger = await request(serveur).post('/api/auth/signup').send({
      email: 'etranger@example.com',
      password: MDP,
      fullName: 'Diane Mballa',
      acceptTerms: true,
      parkName: 'Parc voisin',
      countryCode: 'CM',
    })

    const rep = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', userId: etranger.body.user.id })
    expect(rep.status, 'un compte étranger au parc a reçu un bail').toBe(404)

    const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
    expect(
      acces.body.unlinkedTenants ?? [],
      'la fiche a été créée malgré le refus : le bail existe sans son compte',
    ).toHaveLength(0)
  })

  it('refuse le propriétaire, qui n’a pas de fiche', async () => {
    const { cookie, parkId, unitId, proprioId } = await parcAvecUnMembreSansFiche()

    const rep = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', userId: proprioId })
    expect(rep.status).toBe(409)
    expect(rep.body.error).toBe('not_a_tenant')
  })

  it('refuse un compte qui porte déjà une fiche ailleurs', async () => {
    const { cookie, parkId, unitId, autreUnitId, userId } = await parcAvecUnMembreSansFiche()

    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', userId })

    // `Tenant.userId` est unique sur toute la base : un compte n'est locataire
    // que d'un seul logement. Sans ce refus, Prisma lèverait un P2002 que le
    // `catch` de la route traduirait en « logement déjà loué » — faux.
    const rep = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId: autreUnitId, fullName: 'Bekono Landry', userId })
    expect(rep.status).toBe(409)
    expect(rep.body.error).toBe('account_already_linked')
  })

  it('crée toujours une fiche sans compte quand on n’en donne pas', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnMembreSansFiche()

    // La moitié sans laquelle exiger un compte satisferait les cas précédents :
    // déclarer un locataire qui n'a pas encore de compte reste le cas courant.
    const rep = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Ondoa Pierre' })
    expect(rep.status).toBe(201)
  })
})
