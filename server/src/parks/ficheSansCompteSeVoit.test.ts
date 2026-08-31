import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE PORTEFEUILLE DIT QUELLE FICHE N'A PAS DE COMPTE.
 *
 * ═══ CE QUE LE BAILLEUR NE POUVAIT PAS VOIR ═══
 *
 * Capturé sur la production, deux écrans côte à côte : « Locataires et baux »
 * montre BEKONO LANDRY sur A1, bail actif, statut « À jour », 32 798 FCFA. Son
 * espace à lui dit « Aucun logement rattaché à votre compte ». Les deux sont
 * vrais en même temps — la fiche existe et porte le bail, elle n'a simplement
 * pas de compte — et RIEN, sur l'écran du bailleur, ne le laissait deviner.
 *
 * L'anomalie n'était visible que sur « Accès au parc », c'est-à-dire à
 * l'endroit où l'on va quand on soupçonne DÉJÀ quelque chose. Le bailleur, lui,
 * n'a aucune raison d'y aller : de son côté, tout va bien.
 *
 * ═══ LE PRÉCÉDENT QUE CE LOT SUIT ═══
 *
 * La route d'annonce le fait déjà, et son en-tête le dit : « CE QUI N'EST PAS
 * PARTI SE DIT. Un locataire sans compte ne recevra rien — il n'a pas d'espace
 * où lire. » Le portefeuille portait la même information — `Tenant.userId` —
 * et la jetait à la projection.
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

/** Deux fiches sur deux logements : l'une reliée à un compte, l'autre non. */
async function parcAvecUneFicheReliableEtUneOrpheline() {
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
  const b1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${immeubleId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'B1', type: 'T3', surfaceSqm: 120, baseRentMinor: 69997 })

  // A1 : une fiche ORPHELINE — le cas de la production.
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId: a1.body.unit.id, fullName: 'Bekono Landry' })

  // B1 : un compte entre par un code, puis sa fiche est créée AVEC le compte.
  const inv = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant' })
  const martial = await request(serveur).post('/api/auth/signup').send({
    email: 'martial@example.com',
    password: MDP,
    fullName: 'Djoumessi Martial',
    acceptTerms: true,
    invitationCode: inv.body.code,
  })
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId: b1.body.unit.id, fullName: 'Djoumessi Martial', userId: martial.body.user.id })

  return { cookie, parkId }
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

describe('le portefeuille et les fiches sans compte', () => {
  it('dit laquelle n’a pas de compte, et laquelle en a un', async () => {
    const { cookie, parkId } = await parcAvecUneFicheReliableEtUneOrpheline()

    const parc = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    const unites = (parc.body.buildings as { units: { label: string; tenant: unknown }[] }[])
      .flatMap((b) => b.units)

    const a1 = unites.find((u) => u.label === 'A1')!
    const b1 = unites.find((u) => u.label === 'B1')!

    expect(
      (a1.tenant as { hasAccount?: boolean }).hasAccount,
      'la fiche orpheline est présentée comme reliée : le bailleur ne verra rien',
    ).toBe(false)
    /* La moitié sans laquelle rendre `false` partout satisferait le cas. */
    expect((b1.tenant as { hasAccount?: boolean }).hasAccount).toBe(true)
  })

  it('ne rend pas le compte lui-même, seulement son existence', async () => {
    const { cookie, parkId } = await parcAvecUneFicheReliableEtUneOrpheline()

    /* `userId` N'A RIEN À FAIRE DANS LE PORTEFEUILLE. L'écran a besoin de
       savoir SI la fiche est reliée, jamais à qui : le registre des accès est
       le seul endroit qui nomme les comptes, et il est réservé aux deux rôles
       de gestion. Un identifiant de compte qui voyage dans une projection lue
       aussi par le locataire est une fuite qui ne sert personne. */
    const parc = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    expect(JSON.stringify(parc.body)).not.toContain('userId')
  })
})
