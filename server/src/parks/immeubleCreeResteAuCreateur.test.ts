import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UN GESTIONNAIRE PERDAIT L'IMMEUBLE QU'IL VENAIT DE DÉCLARER.
 *
 * ═══ LE DÉFAUT, MESURÉ EN BASE ═══
 *
 * `POST /parks/:parkId/buildings` est ouvert aux DEUX rôles qui constituent un
 * parc — `exigerRole('owner', 'manager')` — et n'a jamais touché au périmètre de
 * son créateur. Or une adhésion `declared` ne voit QUE ce qui lui est confié.
 *
 * Le gestionnaire déclarait donc son immeuble, le voyait apparaître par l'état
 * optimiste du client… et le perdait au premier rechargement. Relevé dans la
 * base de la porte `espace-connecte`, sur le parc du « premier geste » :
 *
 *     immeuble Résidence du Mandat · logements: —
 *     adhésion manager · scope=declared · immeubles confiés: 0
 *
 * L'immeuble EST là. Le logement qu'il croyait y avoir créé, non : le geste
 * suivant portait sur un immeuble qu'il ne voyait plus. Deux gestes réussis à
 * l'écran, un demi-résultat en base, et aucune erreur nulle part.
 *
 * ═══ POURQUOI RATTACHER PLUTÔT QUE REFUSER ═══
 *
 * Interdire au gestionnaire de déclarer un immeuble serait cohérent — le
 * propriétaire confie, le gestionnaire opère — mais ce n'est pas ce que ce
 * produit dit : l'écran lui offre le bouton, et `espace-connecte` existe
 * précisément pour mesurer « le premier geste réel d'un cabinet qui vient
 * d'accepter un mandat ». Un cabinet qui prend un mandat déclare l'immeuble
 * qu'on lui décrit au téléphone. On lui rend donc ce qu'il crée.
 *
 * LE PROPRIÉTAIRE GARDE LA MAIN : il voit le rattachement au registre des
 * accès, et peut le retirer. Créer ne devient pas s'attribuer le parc — cela
 * ne donne QUE l'immeuble créé.
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

/** Un parc, et un gestionnaire fraîchement invité — donc `declared`, sans rien. */
async function parcEtGestionnaireNeuf() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Nelson D',
    acceptTerms: true,
    parkName: 'Parc du Mandat',
    countryCode: 'CM',
  })
  const cookieProprio = cookieDe(proprio)
  const parkId = (await prisma.park.findFirstOrThrow()).id

  const code = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookieProprio)
    .send({ role: 'manager' })
  const gestion = await request(serveur).post('/api/auth/signup').send({
    email: 'gestion@example.com',
    password: MDP,
    fullName: 'Gestion Aire',
    acceptTerms: true,
    invitationCode: code.body.code,
  })
  return { cookieProprio, cookieGestion: cookieDe(gestion), parkId }
}

const declarer = (cookie: string, parkId: string, nom: string) =>
  request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: nom, district: 'Bastos' })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('l’immeuble déclaré par un gestionnaire borné', () => {
  it('lui RESTE — il le perdait au rechargement', async () => {
    const { cookieGestion, parkId } = await parcEtGestionnaireNeuf()
    const cree = await declarer(cookieGestion, parkId, 'Résidence du Mandat')
    expect(cree.status).toBe(201)

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieGestion)
    expect(
      vu.body.buildings.map((b: { name: string }) => b.name),
      'il vient de le créer, et son portefeuille ne le lui montrait plus',
    ).toEqual(['Résidence du Mandat'])
  })

  it('lui permet d’y poser un logement — le geste suivant', async () => {
    /* C'est là que le défaut se voyait vraiment : le logement n'était jamais
       créé, sur un immeuble devenu invisible à celui qui venait de le
       déclarer. */
    const { cookieGestion, parkId } = await parcEtGestionnaireNeuf()
    const cree = await declarer(cookieGestion, parkId, 'Résidence du Mandat')
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${cree.body.building.id}/units`)
      .set('Cookie', cookieGestion)
      .send({ label: 'R1', type: 'T2', surfaceSqm: 45, baseRentMinor: 120000 })
    expect(logement.status, String(logement.text).slice(0, 160)).toBe(201)
  })

  it('ne lui donne QUE celui-là', async () => {
    /* Créer n'est pas s'attribuer le parc : l'immeuble que le propriétaire
       avait déjà ne doit pas suivre. */
    const { cookieProprio, cookieGestion, parkId } = await parcEtGestionnaireNeuf()
    await declarer(cookieProprio, parkId, 'Résidence du Propriétaire')
    await declarer(cookieGestion, parkId, 'Résidence du Mandat')

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieGestion)
    expect(vu.body.buildings.map((b: { name: string }) => b.name)).toEqual(['Résidence du Mandat'])
  })
})

describe('ce que ce lot ne doit pas changer', () => {
  it('le PROPRIÉTAIRE ne reçoit aucun rattachement — il n’est pas borné', async () => {
    /* Lui poser une ligne de périmètre ne changerait rien à ce qu'il voit, et
       ferait mentir le registre des accès, qui lit ces lignes. */
    const { cookieProprio, parkId } = await parcEtGestionnaireNeuf()
    await declarer(cookieProprio, parkId, 'Résidence du Propriétaire')
    const proprio = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'owner' } })
    expect(await prisma.membershipBuilding.count({ where: { membershipId: proprio.id } })).toBe(0)
  })

  it('un gestionnaire `wholePark` n’en reçoit pas non plus', async () => {
    /* Les adhésions d'avant la portée voient tout : leur poser une ligne les
       BORNERAIT à ce seul immeuble. Le remède serait pire que le mal. */
    const { cookieGestion, parkId } = await parcEtGestionnaireNeuf()
    await prisma.membership.updateMany({
      where: { parkId, role: 'manager' },
      data: { scope: 'wholePark' },
    })
    await declarer(cookieGestion, parkId, 'Résidence du Mandat')
    const gestion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })
    expect(await prisma.membershipBuilding.count({ where: { membershipId: gestion.id } })).toBe(0)
  })
})
