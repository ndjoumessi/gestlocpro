import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UN GESTIONNAIRE INVITÉ AUJOURD'HUI NE VOIT RIEN TANT QU'ON NE LUI A RIEN
 * CONFIÉ.
 *
 * ═══ LA RÈGLE QUI A EXPIRÉ ═══
 *
 * « Vide vaut tout le parc » est écrit au schéma, et sa justification l'est
 * aussi : « le sens inverse serait plus intuitif. Il est INAPPLICABLE : cette
 * migration ne confie rien à personne, et “aucun immeuble confié = rien à voir”
 * aveuglerait, à la seconde du déploiement, tous les gestionnaires déjà en
 * place. »
 *
 * C'était juste POUR LES GESTIONNAIRES D'AVANT. Un compte créé quatre jours
 * plus tard héritait d'une règle écrite pour des comptes qui existaient avant la
 * fonctionnalité — et voyait deux immeubles, trois logements, leurs locataires
 * et leurs adresses, sans qu'on lui ait rien donné. Capturé sur un parc réel.
 *
 * C'est la classe de défaut nommée trois fois cette semaine : une décision qui
 * affirme quelque chose sur le PASSÉ et continue de s'appliquer au présent.
 *
 * ═══ TROIS ÉTATS, LÀ OÙ IL N'Y EN AVAIT QUE DEUX ═══
 *
 * Le modèle ne savait dire que « borné » ou « pas borné » : une liste vide
 * VOULAIT dire « pas de restriction ». « Ce cabinet arrive, je ne lui ai encore
 * rien donné » ne pouvait pas s'écrire — alors que `espace-connecte` sonde cet
 * état depuis son sixième profil, qui existait dans la mesure et pas dans les
 * données.
 *
 * `scope` le dit maintenant : `wholePark` pour les adhésions d'avant,
 * `declared` pour celles qui naissent — et une liste vide y veut dire vide.
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

async function parcAvecUnGestionnaire() {
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
  await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })

  const inv = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  await request(serveur).post('/api/auth/signup').send({
    email: 'cabinet@example.com',
    password: MDP,
    fullName: 'Cabinet Njoya',
    acceptTerms: true,
    invitationCode: inv.body.code,
  })
  const gestion = await request(serveur)
    .post('/api/auth/login')
    .send({ email: 'cabinet@example.com', password: MDP })

  return { cookie, parkId, buildingId: imm.body.building.id as string, cookieGestion: cookieDe(gestion) }
}

const portefeuille = (parkId: string, cookie: string) =>
  request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)

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

describe('un gestionnaire qui vient d’arriver', () => {
  it('ne voit AUCUN immeuble tant qu’on ne lui a rien confié', async () => {
    const { parkId, cookieGestion } = await parcAvecUnGestionnaire()
    const vu = await portefeuille(parkId, cookieGestion)
    expect(
      vu.body.buildings,
      'il voyait le parc entier — baux, loyers, locataires — sans qu’on lui ait rien donné',
    ).toEqual([])
  })

  it('voit ce qu’on lui confie, et rien de plus', async () => {
    const { cookie, parkId, buildingId, cookieGestion } = await parcAvecUnGestionnaire()
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [buildingId], unitIds: [] })

    const vu = await portefeuille(parkId, cookieGestion)
    expect((vu.body.buildings as { id: string }[]).map((b) => b.id)).toEqual([buildingId])
  })

  it('est annoncé comme BORNÉ au portefeuille, dès son arrivée', async () => {
    /* `scoped` décide de la note qui lui dit qu'il ne voit pas tout. Sans elle,
       un parc vide se lit « ce parc n'a rien » au lieu de « on ne vous a rien
       confié ». */
    const { parkId, cookieGestion } = await parcAvecUnGestionnaire()
    const vu = await portefeuille(parkId, cookieGestion)
    expect(vu.body.scoped).toBe(true)
  })
})

describe('une adhésion d’avant la règle', () => {
  it('garde le parc entier', async () => {
    /* La bascule ne vaut que pour les adhésions qui NAISSENT. Aveugler les
       gestionnaires en place était précisément ce que la règle d'origine
       refusait, et ce refus reste juste. */
    const { parkId, cookieGestion } = await parcAvecUnGestionnaire()
    await prisma.membership.updateMany({
      where: { parkId, role: 'manager' },
      data: { scope: 'wholePark' },
    })

    const vu = await portefeuille(parkId, cookieGestion)
    expect((vu.body.buildings as unknown[]).length, 'aucun gestionnaire en place ne perd la vue').toBe(1)
    expect(vu.body.scoped).toBe(false)
  })
})
