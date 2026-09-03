import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE REGISTRE DES ACCÈS DISAIT L'INVERSE DE LA VÉRITÉ.
 *
 * ═══ LES DEUX VIDES QU'ON NE DISTINGUAIT PAS ═══
 *
 * `/parks/:id/access` rend `buildingIds` et `unitIds`, et l'écran conclut :
 * listes vides ⇒ « Gère tout le parc ». C'était juste tant qu'un seul état
 * produisait des listes vides.
 *
 * Il y en a DEUX depuis le lot de la portée :
 *
 *   `wholePark` + vide  → gère réellement tout le parc ;
 *   `declared`  + vide  → ne voit RIEN, et c'est l'état de NAISSANCE de tout
 *                         gestionnaire invité.
 *
 * Le registre affichait donc « Gère tout le parc » à propos de quelqu'un qui ne
 * voit rien — l'inverse exact —, et c'est le seul écran d'où un propriétaire
 * peut s'en apercevoir. La donnée qui les sépare existe en base et ne voyageait
 * pas : `scope` n'était dans aucune projection.
 *
 * ═══ CE QUE CETTE GARDE TIENT, ET CE QU'ELLE NE TIENT PAS ═══
 *
 * Elle tient le VOYAGE de la portée, pas son affichage : que l'écran en fasse
 * une phrase juste est éprouvé côté client. Ici, on exige seulement que les
 * deux états cessent d'être indiscernables sur le fil.
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

async function parcAvecUnGestionnaireNeuf() {
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

  const code = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookieProprio)
    .send({ role: 'manager' })
  await request(serveur).post('/api/auth/signup').send({
    email: 'gestion@example.com',
    password: MDP,
    fullName: 'Gestion Aire',
    acceptTerms: true,
    invitationCode: code.body.code,
  })

  return { cookieProprio, parkId }
}

interface MembreDuRegistre {
  role: string
  scope?: string
  buildingIds: string[]
}

const gestionnaireDe = (corps: { members: MembreDuRegistre[] }) =>
  corps.members.find((m) => m.role === 'manager')

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('la portée d’une adhésion', () => {
  it('voyage jusqu’au registre des accès', async () => {
    const { cookieProprio, parkId } = await parcAvecUnGestionnaireNeuf()
    const registre = await request(serveur)
      .get(`/api/parks/${parkId}/access`)
      .set('Cookie', cookieProprio)
    expect(registre.status).toBe(200)
    expect(
      gestionnaireDe(registre.body)?.scope,
      'sans elle, l’écran ne peut pas distinguer « tout le parc » de « rien »',
    ).toBe('declared')
  })

  it('sépare les DEUX vides, que rien ne distinguait', async () => {
    const { cookieProprio, parkId } = await parcAvecUnGestionnaireNeuf()

    const neuf = gestionnaireDe(
      (await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookieProprio)).body,
    )
    expect(neuf?.scope).toBe('declared')
    /* Les deux états produisent EXACTEMENT les mêmes listes : c'est pour cela
       que l'écran ne pouvait pas les séparer. */
    expect(neuf?.buildingIds).toEqual([])

    /* L'adhésion d'AVANT la fonctionnalité, celle qu'on ne peut plus créer par
       une route : elle porte `wholePark` et des listes vides elle aussi. */
    await prisma.membership.updateMany({
      where: { parkId, role: 'manager' },
      data: { scope: 'wholePark' },
    })
    const ancien = gestionnaireDe(
      (await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookieProprio)).body,
    )
    expect(ancien?.buildingIds).toEqual([])
    expect(
      ancien?.scope,
      'mêmes listes, portée opposée : c’est le seul signal qui les sépare',
    ).toBe('wholePark')
  })
})
