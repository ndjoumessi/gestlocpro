import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * ENTRER DANS UN PARC PAR UN CODE NE LAISSAIT AUCUNE TRACE.
 *
 * ═══ UNE ASYMÉTRIE QUE J'AI CRÉÉE MOI-MÊME ═══
 *
 * Le 2026-09-03, deux lots ont été livrés dans la même journée :
 *
 *   le premier a rendu le code capable d'honorer une demande d'accès en
 *     attente — le propriétaire arbitre au bouton OU en émettant un code ;
 *   le second a fait écrire au registre des décisions ce que le BOUTON décide,
 *     `access.grant` et `access.refuse`.
 *
 * Le code, lui, n'écrivait rien. Deux chemins pour la même décision, un seul
 * tracé. Le registre disait « rien n'a été accordé » d'un parc où quelqu'un
 * venait d'entrer.
 *
 * ═══ TROIS BRANCHES, ET ON LES PREND TOUTES ═══
 *
 * `/api/join` accorde une adhésion de trois façons : elle en CRÉE une, ou elle
 * en réveille une `revoked`, ou une `requested`. Les trois font entrer
 * quelqu'un dans un parc.
 *
 * N'en tracer qu'une reproduirait exactement ce que cette journée a passé son
 * temps à défaire : le même défaut corrigé une branche à la fois, quatre fois
 * de suite, sur ce même `findFirst`.
 *
 * ═══ L'ACTEUR EST CELUI QUI A ÉMIS LE CODE ═══
 *
 * Et non celui qui le saisit. `Invitation.issuedById` porte la décision : un
 * registre qui dirait « le gestionnaire s'est accordé l'accès » mentirait sur
 * qui a ouvert la porte. C'est la même règle qu'à la route de décision, où
 * l'acteur est le propriétaire qui tranche.
 *
 * `access.join` ET NON `access.grant` : ce sont deux gestes distincts — un
 * bouton pressé dans un registre, un code consommé — et un journal qui les
 * confondrait empêcherait de répondre à « comment est-il entré ? ».
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

async function unProprietaire() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Nelson D',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookieProprio = cookieDe(proprio)
  const parc = await prisma.park.findFirstOrThrow()
  const emetteur = await prisma.membership.findFirstOrThrow({
    where: { parkId: parc.id, role: 'owner' },
    select: { userId: true },
  })
  return { cookieProprio, parkId: parc.id, emetteurId: emetteur.userId }
}

const codeDeGestionnaire = async (cookie: string, parkId: string): Promise<string> => {
  const res = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  expect(res.status, `code non émis : ${String(res.text).slice(0, 160)}`).toBe(201)
  return res.body.code as string
}

const rejoindre = (cookie: string, invitationCode: string) =>
  request(serveur).post('/api/join').set('Cookie', cookie).send({ invitationCode })

const entrees = (parkId: string) =>
  prisma.auditEvent.findMany({ where: { parkId, action: 'access.join' } })

/** Un compte qui existe, sans aucun lien avec ce parc. */
async function unCompteEtranger(email: string) {
  const res = await request(serveur).post('/api/auth/signup').send({
    email,
    password: MDP,
    fullName: 'Gestion Aire',
    acceptTerms: true,
  })
  return cookieDe(res)
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

describe('entrer dans un parc par un code', () => {
  it('se CONSIGNE quand l’adhésion est créée', async () => {
    const { cookieProprio, parkId, emetteurId } = await unProprietaire()
    const cookie = await unCompteEtranger('nouveau@example.com')
    expect((await rejoindre(cookie, await codeDeGestionnaire(cookieProprio, parkId))).status).toBe(201)

    const [trace, ...reste] = await entrees(parkId)
    expect(trace, 'quelqu’un est entré dans le parc sans que rien ne le garde').toBeDefined()
    expect(reste, 'une entrée, une ligne').toHaveLength(0)
    expect(trace!.entity).toBe('Membership')
    expect(
      trace!.actorId,
      'l’acteur est celui qui a ÉMIS le code, pas celui qui le saisit',
    ).toBe(emetteurId)
    expect((trace!.payload as { role?: string }).role).toBe('manager')

    const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })
    expect(trace!.entityId, 'sans la cible, le registre dit qu’on est entré sans dire qui').toBe(
      adhesion.id,
    )
  })

  it('se CONSIGNE quand elle honore une demande en attente', async () => {
    const { cookieProprio, parkId } = await unProprietaire()
    const cookie = await unCompteEtranger('demandeur@example.com')
    await request(serveur)
      .post('/api/access-requests')
      .set('Cookie', cookie)
      .send({ ownerEmail: 'proprio@example.com' })
    expect(
      (await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })).status,
    ).toBe('requested')

    expect((await rejoindre(cookie, await codeDeGestionnaire(cookieProprio, parkId))).status).toBe(201)
    expect(
      await entrees(parkId),
      'le bouton écrit au registre, le code n’écrivait rien — deux chemins, une décision',
    ).toHaveLength(1)
  })

  it('se CONSIGNE quand un révoqué revient', async () => {
    const { cookieProprio, parkId } = await unProprietaire()
    const cookie = await unCompteEtranger('revenant@example.com')
    await rejoindre(cookie, await codeDeGestionnaire(cookieProprio, parkId))
    const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/revoke`)
      .set('Cookie', cookieProprio)
      .send({})

    expect((await rejoindre(cookie, await codeDeGestionnaire(cookieProprio, parkId))).status).toBe(201)
    expect(
      await entrees(parkId),
      'la première entrée et le retour sont DEUX entrées ; le registre doit porter les deux',
    ).toHaveLength(2)
  })
})

describe('ce qui ne doit RIEN consigner', () => {
  it('un membre actif à qui l’on refuse un second code', async () => {
    /* Le 409 n'accorde rien. Consigner une tentative remplirait le registre de
       décisions qui n'ont pas eu lieu. */
    const { cookieProprio, parkId } = await unProprietaire()
    const cookie = await unCompteEtranger('deja@example.com')
    await rejoindre(cookie, await codeDeGestionnaire(cookieProprio, parkId))
    const avant = (await entrees(parkId)).length

    const second = await rejoindre(cookie, await codeDeGestionnaire(cookieProprio, parkId))
    expect(second.status).toBe(409)
    expect(await entrees(parkId), 'un refus n’est pas une entrée').toHaveLength(avant)
  })

  it('un code invalide', async () => {
    const { parkId } = await unProprietaire()
    const cookie = await unCompteEtranger('curieux@example.com')
    expect((await rejoindre(cookie, 'GES-0000-0000')).status).toBe(400)
    expect(await entrees(parkId)).toHaveLength(0)
  })
})
