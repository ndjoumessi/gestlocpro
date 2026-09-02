import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * RETIRER L'ACCÈS ÉTAIT UNE PORTE À SENS UNIQUE.
 *
 * ═══ L'IMPASSE, MESURÉE ═══
 *
 * Le propriétaire retire l'accès d'un gestionnaire, puis se ravise et lui émet
 * un nouveau code. Le gestionnaire le saisit, et `/api/join` répondait 409
 * `already_member`. Le code restait dans le registre des accès, valable et
 * inutilisable, à côté d'un gestionnaire qui ne pouvait plus entrer. Relevé sur
 * la vraie base avant ce lot :
 *
 *     révocation                : 204  ligne encore là  status=revoked
 *     2nd chemin POST /api/join : 409  {"error":"already_member"}
 *
 * La cause : `revoke` ne SUPPRIME pas l'adhésion, il pose `status: 'revoked'`.
 * Or cette route cherchait `findFirst({ userId, parkId })` sans regarder le
 * statut, et trouvait la ligne morte.
 *
 * C'EST LA FORME EXACTE DU DÉFAUT DÉJÀ CORRIGÉ POUR LES LOCATAIRES, deux cents
 * lignes plus haut : « le code restait en attente dans le registre des accès,
 * valable et inutilisable ». La branche locataire a été réparée en son temps ;
 * le membre RÉVOQUÉ, lui, ne l'a jamais été.
 *
 * ═══ IL REVIENT À ZÉRO, ET C'EST LE POINT DÉLICAT ═══
 *
 * Réactiver la ligne telle quelle rendrait au gestionnaire le périmètre qu'il
 * avait AVANT qu'on le retire — silencieusement, par la seule saisie d'un code.
 * Un propriétaire qui retire un accès puis rouvre une porte plus étroite se
 * retrouverait avec la porte d'avant.
 *
 * Il revient donc `declared` et SANS RATTACHEMENT : la doctrine du lot qui a
 * posé la portée — « un gestionnaire qui arrive ne voit RIEN tant qu'on ne lui
 * a rien confié » — vaut aussi pour celui qui revient.
 *
 * ═══ ET LE DÉFAUT QUI SE CACHAIT DERRIÈRE ═══
 *
 * La création d'adhésion de cette route ne passait AUCUN `scope`, là où
 * l'inscription pose `declared`. Le défaut du schéma étant `wholePark`, un
 * compte qui rejoignait un parc par code — celui qui s'était inscrit avant de
 * recevoir son invitation — obtenait le parc ENTIER. Le commentaire du schéma
 * affirme pourtant qu'« une adhésion créée par invitation naît `declared` » :
 * c'était vrai d'un seul des deux chemins.
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

/** Un parc, un immeuble, et un gestionnaire à qui cet immeuble est confié. */
async function parcAvecUnGestionnaireBorne() {
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

  const gestionnaire = await request(serveur).post('/api/auth/signup').send({
    email: 'gestion@example.com',
    password: MDP,
    fullName: 'Gestion Aire',
    acceptTerms: true,
    invitationCode: await codeDeGestionnaire(cookieProprio, parkId),
  })
  const cookieGestion = cookieDe(gestionnaire)
  const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })

  // On lui CONFIE l'immeuble : sans cela, « il revient à zéro » ne prouverait rien.
  const perimetre = await request(serveur)
    .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
    .set('Cookie', cookieProprio)
    .send({ buildingIds: [immeuble.body.building.id] })
  expect(perimetre.status, `périmètre non posé : ${String(perimetre.text).slice(0, 160)}`).toBe(200)

  return { cookieProprio, cookieGestion, parkId, adhesionId: adhesion.id }
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

describe('le gestionnaire révoqué', () => {
  it('revient par un NOUVEAU code, au lieu du 409 qui fermait la porte', async () => {
    const { cookieProprio, cookieGestion, parkId, adhesionId } = await parcAvecUnGestionnaireBorne()
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesionId}/revoke`)
      .set('Cookie', cookieProprio)
      .send({})

    const retour = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieGestion)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })

    expect(retour.status, `le code émis restait inutilisable : ${String(retour.text).slice(0, 160)}`)
      .toBe(201)
    const apres = await prisma.membership.findUniqueOrThrow({ where: { id: adhesionId } })
    expect(apres.status).toBe('active')
  })

  it('revient À ZÉRO : déclaré, et sans le périmètre d’avant', async () => {
    const { cookieProprio, cookieGestion, parkId, adhesionId } = await parcAvecUnGestionnaireBorne()
    expect(
      await prisma.membershipBuilding.count({ where: { membershipId: adhesionId } }),
      'le montage est faux : rien ne lui était confié avant le retrait',
    ).toBe(1)

    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesionId}/revoke`)
      .set('Cookie', cookieProprio)
      .send({})
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieGestion)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })

    const apres = await prisma.membership.findUniqueOrThrow({ where: { id: adhesionId } })
    expect(apres.scope, 'un revenant ne voit rien tant qu’on ne lui a rien reconfié').toBe('declared')
    expect(
      await prisma.membershipBuilding.count({ where: { membershipId: adhesionId } }),
      'la saisie d’un code lui rendait son ancien périmètre, en silence',
    ).toBe(0)
  })

  it('ne rouvre RIEN à un membre encore actif', async () => {
    /* Non-régression : le 409 existe pour une bonne raison, et ce lot ne le
       lève que pour une adhésion morte. */
    const { cookieProprio, cookieGestion, parkId } = await parcAvecUnGestionnaireBorne()
    const retour = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieGestion)
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })
    expect(retour.status).toBe(409)
    expect(retour.body.error).toBe('already_member')
  })
})

describe('le compte qui rejoint un parc sans y avoir jamais été', () => {
  it('naît DÉCLARÉ, comme à l’inscription', async () => {
    /* Le défaut latent : cette route créait l'adhésion sans `scope`, donc au
       défaut du schéma — `wholePark`. Le compte qui s'était inscrit AVANT de
       recevoir son code obtenait le parc entier. */
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

    // Un compte qui existe déjà, avec son propre parc, et aucune adhésion ici.
    const autre = await request(serveur).post('/api/auth/signup').send({
      email: 'autre@example.com',
      password: MDP,
      fullName: 'Autre Compte',
      acceptTerms: true,
      parkName: 'Son propre parc',
      countryCode: 'CM',
    })

    const entree = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieDe(autre))
      .send({ invitationCode: await codeDeGestionnaire(cookieProprio, parkId) })
    expect(entree.status, String(entree.text).slice(0, 160)).toBe(201)

    const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })
    expect(adhesion.scope, 'le schéma promet `declared` pour toute adhésion née d’une invitation')
      .toBe('declared')
  })
})

describe('le LOCATAIRE révoqué', () => {
  it('retrouve sa fiche en revenant, et ne rentre pas dans un espace vide', async () => {
    /* Le retrait libère `Tenant.userId` — c'est un lot antérieur, et il a ses
       raisons : la fiche doit pouvoir passer au locataire suivant. Le revenant
       doit donc la RÉCUPÉRER, sans quoi il rentrerait dans un espace qui lui
       dit « aucun logement rattaché à votre compte », pour la même raison que
       le défaut d'à côté. */
    const proprio = await request(serveur).post('/api/auth/signup').send({
      email: 'proprio@example.com', password: MDP, fullName: 'Nelson D',
      acceptTerms: true, parkName: 'Parc Bastos', countryCode: 'CM',
    })
    const cookieProprio = cookieDe(proprio)
    const parkId = (await prisma.park.findFirstOrThrow()).id

    const immeuble = await request(serveur).post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookieProprio).send({ name: 'Résidence Bastos', district: 'Bastos' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookieProprio)
      .send({ label: 'B1', type: 'T3', surfaceSqm: 120, baseRentMinor: 70000 })
    const unitId = logement.body.unit.id as string
    await request(serveur).post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookieProprio)
      .send({ unitId, fullName: 'Paul Kamga', phoneE164: '+237677111111' })

    const codePourSonLogement = async () => {
      const res = await request(serveur).post(`/api/parks/${parkId}/invitations`)
        .set('Cookie', cookieProprio).send({ role: 'tenant', unitId })
      expect(res.status, String(res.text).slice(0, 160)).toBe(201)
      return res.body.code as string
    }

    const locataire = await request(serveur).post('/api/auth/signup').send({
      email: 'locataire@example.com', password: MDP, fullName: 'Paul Kamga',
      acceptTerms: true, invitationCode: await codePourSonLogement(),
    })
    const cookieLocataire = cookieDe(locataire)
    const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'tenant' } })
    expect(
      (await prisma.tenant.findFirstOrThrow({ where: { parkId } })).userId,
      'le montage est faux : la fiche n’a jamais été reliée',
    ).not.toBeNull()

    await request(serveur).patch(`/api/parks/${parkId}/memberships/${adhesion.id}/revoke`)
      .set('Cookie', cookieProprio).send({})
    expect(
      (await prisma.tenant.findFirstOrThrow({ where: { parkId } })).userId,
      'le retrait doit libérer la fiche — c’est le lot antérieur',
    ).toBeNull()

    const retour = await request(serveur).post('/api/join')
      .set('Cookie', cookieLocataire).send({ invitationCode: await codePourSonLogement() })
    expect(retour.status, String(retour.text).slice(0, 160)).toBe(201)
    expect(
      (await prisma.tenant.findFirstOrThrow({ where: { parkId } })).userId,
      'il revient dans un espace vide : sa fiche ne lui a pas été rendue',
    ).not.toBeNull()
  })
})
