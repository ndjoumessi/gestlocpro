import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * DEMANDER L'ACCÈS FERMAIT LA PORTE DU CODE.
 *
 * ═══ L'IMPASSE ═══
 *
 * Le gestionnaire sans code envoie une demande d'accès — le chemin que le
 * produit lui a ouvert ce matin. Une adhésion naît, `status: 'requested'`, et
 * attend l'arbitrage du propriétaire.
 *
 * Celui-ci a DEUX gestes à sa disposition, et le produit les propose tous les
 * deux : le bouton « Accorder » du registre des accès, ou l'émission d'un code
 * d'invitation. Le premier fonctionne. Le second répondait 409 `already_member`
 * à celui qui saisissait le code — parce que `/api/join` cherche une adhésion
 * `findFirst({ userId, parkId })` SANS REGARDER LE STATUT, et qu'une demande en
 * attente est une ligne comme une autre pour ce filtre.
 *
 * Le demandeur se voyait donc refuser l'entrée au motif qu'il était déjà
 * membre, alors qu'il ne l'était pas — il avait seulement demandé à l'être. Et
 * le code émis restait dans le registre des accès, valable et inutilisable.
 *
 * ═══ C'EST LA TROISIÈME FOIS, ET C'EST LE MÊME FILTRE ═══
 *
 * La branche LOCATAIRE a été réparée en son temps : « le code restait en
 * attente dans le registre des accès, valable et inutilisable ». Puis le membre
 * RÉVOQUÉ, au commit `0e4ffd0` : « retirer l'accès était une porte à sens
 * unique ». Le demandeur est le troisième état que ce `findFirst` sans statut
 * ramasse, et il a été introduit APRÈS les deux corrections — un état neuf
 * dans un schéma dont une route ancienne lisait déjà toutes les lignes.
 *
 * ═══ POURQUOI UN CODE VAUT UN ACCORD ═══
 *
 * Émettre un code de gestionnaire pour un parc EST la décision que la demande
 * attendait. Le propriétaire ne peut pas émettre ce code par accident : il le
 * fabrique depuis son registre, pour un rôle qu'il choisit. Refuser d'honorer
 * ce geste au prétexte qu'une demande dort à côté ferait du produit le gardien
 * d'une distinction que l'utilisateur ne voit pas.
 *
 * LE RÔLE VIENT DU CODE, pas de la demande. C'est la règle de tout ce chemin,
 * et elle compte ici : la demande naît toujours `manager`, alors que le
 * propriétaire choisit le rôle qu'il émet.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`sans cookie — ${res.status} ${String(res.text).slice(0, 200)}`)
  return trouve
}

async function codeDeGestionnaire(cookie: string, parkId: string): Promise<string> {
  const res = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  expect(res.status, `code non émis : ${String(res.text).slice(0, 160)}`).toBe(201)
  return res.body.code as string
}

/** Un propriétaire, et un gestionnaire dont la DEMANDE dort en attente. */
async function uneDemandeEnAttente() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Nelson D',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookieProprio = cookieDe(proprio)
  const parkId = (await prisma.park.findFirstOrThrow()).id

  const demandeur = await request(serveur).post('/api/auth/signup').send({
    email: 'gestion@example.com',
    password: MDP,
    fullName: 'Gestion Aire',
    acceptTerms: true,
  })
  const cookieDemandeur = cookieDe(demandeur)

  const demande = await request(serveur)
    .post('/api/access-requests')
    .set('Cookie', cookieDemandeur)
    .send({ ownerEmail: 'proprio@example.com' })
  expect(demande.status).toBe(202)

  const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })
  expect(adhesion.status, 'le montage est faux : la demande n’est pas en attente').toBe('requested')

  return { cookieProprio, cookieDemandeur, parkId, adhesionId: adhesion.id }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('le gestionnaire dont la demande dort', () => {
  it('entre par le code, au lieu du 409 qui le disait déjà membre', async () => {
    const { cookieProprio, cookieDemandeur, parkId, adhesionId } = await uneDemandeEnAttente()

    const retour = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieDemandeur)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })

    expect(
      retour.status,
      `le code émis restait inutilisable : ${String(retour.text).slice(0, 160)}`,
    ).toBe(201)
    const apres = await prisma.membership.findUniqueOrThrow({ where: { id: adhesionId } })
    expect(apres.status, 'la demande est restée en attente malgré le code honoré').toBe('active')
  })

  it('entre DÉCLARÉ, comme s’il avait été accordé au registre', async () => {
    const { cookieProprio, cookieDemandeur, parkId, adhesionId } = await uneDemandeEnAttente()
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieDemandeur)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })

    const apres = await prisma.membership.findUniqueOrThrow({ where: { id: adhesionId } })
    expect(apres.scope, 'entrer par un code ne donne pas le parc entier').toBe('declared')
    expect(
      await prisma.membershipBuilding.count({ where: { membershipId: adhesionId } }),
      'rien ne lui a été confié : le rattachement ne doit rien inventer',
    ).toBe(0)
  })

  it('DISPARAÎT de la file des demandes du propriétaire', async () => {
    /* La file se lit sur `status: 'requested'`. Si l'entrée par code laissait
       la ligne en attente, le propriétaire garderait éternellement une décision
       à prendre sur quelqu'un qui est déjà entré. */
    const { cookieProprio, cookieDemandeur, parkId } = await uneDemandeEnAttente()
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieDemandeur)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })

    const registre = await request(serveur)
      .get(`/api/parks/${parkId}/access`)
      .set('Cookie', cookieProprio)
    expect(registre.status).toBe(200)
    expect(
      registre.body.requests,
      'une décision restait à prendre sur quelqu’un déjà entré',
    ).toHaveLength(0)
    expect(
      registre.body.members.some((m: { email: string }) => m.email === 'gestion@example.com'),
      'entré, il devrait figurer parmi les membres',
    ).toBe(true)
  })
})

describe('ce que ce lot ne doit pas lever', () => {
  it('un membre ACTIF se voit toujours refuser un second code', async () => {
    /* Le 409 existe pour une bonne raison. Ce lot ne l'ouvre que pour une
       demande en attente, jamais pour une adhésion vivante. */
    const { cookieProprio, cookieDemandeur, parkId } = await uneDemandeEnAttente()
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieDemandeur)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })

    const second = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieDemandeur)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('already_member')
  })
})
