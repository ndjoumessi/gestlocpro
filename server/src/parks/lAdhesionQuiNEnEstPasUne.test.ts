import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * DEUX ROUTES TRANCHAIENT SUR CE QUI N'EST PAS ENCORE UNE ADHÉSION.
 *
 * ═══ CE QU'ELLES LISAIENT ═══
 *
 * `PATCH …/memberships/:id/immeubles` et `PATCH …/memberships/:id/revoke`
 * cherchent toutes deux `findFirst({ id, parkId })` — SANS regarder le statut.
 * C'est la forme exacte du défaut que `/api/join` portait trois fois de suite,
 * et ces deux-là l'ont gardée.
 *
 * Une DEMANDE en attente est une ligne comme une autre pour ce filtre.
 *
 * ═══ CE QUE ÇA PERMETTAIT, ET CE QUE ÇA NE PERMETTAIT PAS ═══
 *
 * PAS ATTEIGNABLE DEPUIS L'ÉCRAN, et je le dis avant tout le reste : le
 * registre des accès lit ses membres sur `status: 'active'` et ses demandes sur
 * `requested`, dans deux requêtes distinctes. La commande de périmètre n'est
 * rendue que pour un membre, et une demande n'offre que « Accorder » et
 * « Refuser ». Il faut appeler l'API directement pour y arriver.
 *
 * Ce sont donc des invariants de serveur, pas des défauts vécus. Ils comptent
 * quand même, pour deux raisons distinctes :
 *
 * LE PÉRIMÈTRE POSÉ SURVIVRAIT À L'ACCORD. La route de décision fait passer la
 * demande à `active` et ne nettoie AUCUN rattachement — elle n'a jamais eu à le
 * faire. Un périmètre posé pendant l'attente serait donc là au réveil, et le
 * registre qui promet « rien ne lui est encore confié » à un gestionnaire qui
 * arrive dirait faux.
 *
 * LE REGISTRE DES DÉCISIONS MENTIRAIT. Retirer une demande la fait passer
 * `revoked` — exactement ce que « refuser » produit — mais consigne
 * `access.revoke`, « Accès repris ». Le journal dirait qu'on a repris un accès
 * à quelqu'un qui n'en a jamais eu. Un registre qui fait autorité ne peut pas
 * nommer un geste par un autre.
 *
 * ═══ POURQUOI LES DEUX CORRECTIFS NE SONT PAS SYMÉTRIQUES ═══
 *
 * Le périmètre exige `active`, strictement. Le retrait, lui, doit continuer
 * d'accepter une adhésion DÉJÀ RÉVOQUÉE : son commentaire d'écriture le dit
 * noir sur blanc — « deux écrans ouverts sur le même registre suffiraient à
 * produire une erreur là où il n'y a qu'un état déjà atteint ». On exclut donc
 * `requested` et rien d'autre.
 *
 * L'asymétrie n'est pas une inconséquence : re-révoquer, c'est réaffirmer un
 * état atteint ; poser un périmètre, c'est écrire une donnée neuve. L'idempotence
 * protège la première, elle n'a rien à dire de la seconde.
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

/** Un parc, un immeuble, une DEMANDE en attente, et un membre bien vivant. */
async function unParcAvecUneDemandeEtUnMembre() {
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

  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookieProprio)
    .send({ name: 'Résidence Bonamoussadi', district: 'Bonamoussadi' })
  expect(immeuble.status).toBe(201)
  const buildingId = immeuble.body.building.id as string

  // Celui qui DEMANDE, et n'a donc rien.
  const demandeur = await request(serveur).post('/api/auth/signup').send({
    email: 'demandeur@example.com',
    password: MDP,
    fullName: 'Demande Eur',
    acceptTerms: true,
  })
  await request(serveur)
    .post('/api/access-requests')
    .set('Cookie', cookieDe(demandeur))
    .send({ ownerEmail: 'proprio@example.com' })
  const demande = await prisma.membership.findFirstOrThrow({ where: { parkId, status: 'requested' } })

  // Celui qui EST membre, par un code : le témoin de non-régression.
  const invitation = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookieProprio)
    .send({ role: 'manager' })
  await request(serveur).post('/api/auth/signup').send({
    email: 'membre@example.com',
    password: MDP,
    fullName: 'Membre Vif',
    acceptTerms: true,
    invitationCode: invitation.body.code,
  })
  const membre = await prisma.membership.findFirstOrThrow({
    where: { parkId, status: 'active', role: 'manager' },
  })

  return { cookieProprio, parkId, buildingId, demandeId: demande.id, membreId: membre.id }
}

const poserLePerimetre = (cookie: string, parkId: string, id: string, buildingIds: string[]) =>
  request(serveur)
    .patch(`/api/parks/${parkId}/memberships/${id}/immeubles`)
    .set('Cookie', cookie)
    .send({ buildingIds })

const retirer = (cookie: string, parkId: string, id: string) =>
  request(serveur).patch(`/api/parks/${parkId}/memberships/${id}/revoke`).set('Cookie', cookie).send({})

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('le périmètre d’immeubles', () => {
  it('REFUSE une demande en attente — on ne confie rien à qui n’est pas entré', async () => {
    const { cookieProprio, parkId, buildingId, demandeId } = await unParcAvecUneDemandeEtUnMembre()
    const res = await poserLePerimetre(cookieProprio, parkId, demandeId, [buildingId])

    expect(res.status, 'un périmètre se posait sur une demande non arbitrée').toBe(404)
    expect(
      await prisma.membershipBuilding.count({ where: { membershipId: demandeId } }),
      'accordée, elle aurait réveillé ce périmètre : la décision ne nettoie rien',
    ).toBe(0)
  })

  it('REFUSE une adhésion révoquée', async () => {
    const { cookieProprio, parkId, buildingId, membreId } = await unParcAvecUneDemandeEtUnMembre()
    expect((await retirer(cookieProprio, parkId, membreId)).status).toBe(204)

    const res = await poserLePerimetre(cookieProprio, parkId, membreId, [buildingId])
    expect(res.status, 'un périmètre sur une ligne morte est une donnée que rien n’explique').toBe(404)
  })

  it('accepte un membre VIVANT — non-régression', async () => {
    const { cookieProprio, parkId, buildingId, membreId } = await unParcAvecUneDemandeEtUnMembre()
    const res = await poserLePerimetre(cookieProprio, parkId, membreId, [buildingId])
    expect(res.status, `le correctif a fermé la porte à tout le monde : ${String(res.text).slice(0, 160)}`).toBe(200)
    expect(await prisma.membershipBuilding.count({ where: { membershipId: membreId } })).toBe(1)
  })
})

describe('le retrait d’accès', () => {
  it('REFUSE une demande en attente — refuser n’est pas reprendre', async () => {
    const { cookieProprio, parkId, demandeId } = await unParcAvecUneDemandeEtUnMembre()
    const res = await retirer(cookieProprio, parkId, demandeId)

    expect(res.status, 'refuser une demande passait par la route du retrait').toBe(404)
    const apres = await prisma.membership.findUniqueOrThrow({ where: { id: demandeId } })
    expect(apres.status, 'la demande a été tranchée par la mauvaise route').toBe('requested')
    expect(
      await prisma.auditEvent.count({ where: { parkId, action: 'access.revoke' } }),
      'le registre aurait dit « Accès repris » de quelqu’un qui n’en a jamais eu',
    ).toBe(0)
  })

  it('reste IDEMPOTENT sur une adhésion déjà révoquée — non-régression', async () => {
    /* Le commentaire d'écriture de cette route l'exige : « deux écrans ouverts
       sur le même registre suffiraient à produire une erreur là où il n'y a
       qu'un état déjà atteint ». Ce lot exclut `requested`, et RIEN d'autre. */
    const { cookieProprio, parkId, membreId } = await unParcAvecUneDemandeEtUnMembre()
    expect((await retirer(cookieProprio, parkId, membreId)).status).toBe(204)
    expect(
      (await retirer(cookieProprio, parkId, membreId)).status,
      'le correctif a cassé l’idempotence que la route documente',
    ).toBe(204)
  })
})
