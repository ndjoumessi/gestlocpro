import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * ON PEUT AUSSI CONFIER DES LOGEMENTS, ET PAS SEULEMENT DES IMMEUBLES.
 *
 * ═══ CE QUE LA MAILLE PRÉCÉDENTE NE COUVRAIT PAS ═══
 *
 * Le lot de la délégation a posé le périmètre à l'IMMEUBLE, et l'a motivé :
 * « on confie un immeuble à un gestionnaire, pas trois appartements sur huit ».
 * C'est la maille du métier dans le cas général — et elle laisse dehors le cas
 * qui existe vraiment : un propriétaire qui confie DEUX studios d'une résidence
 * dont il garde le reste, parce qu'il n'habite plus la ville et que ces deux-là
 * tournent mal.
 *
 * ═══ LES DEUX MAILLES COEXISTENT, ET LEUR UNION FAIT LE PÉRIMÈTRE ═══
 *
 * Un gestionnaire voit ce qu'on lui a confié, immeubles ET logements
 * réunis. Ce n'est pas deux réglages concurrents : c'est une seule liste, écrite
 * à deux niveaux de finesse, et l'un n'annule jamais l'autre.
 *
 * VIDE DES DEUX CÔTÉS VAUT TOUJOURS « TOUT LE PARC », pour la raison écrite au
 * modèle : le sens inverse aveuglerait tous les gestionnaires en place à la
 * seconde du déploiement.
 *
 * ═══ CE QU'UN LOGEMENT CONFIÉ NE DONNE PAS ═══
 *
 * L'IMMEUBLE QUI LE PORTE apparaît — un logement sans son immeuble n'a ni nom
 * ni quartier —, mais VIDE de ses autres logements. C'est la distinction qui
 * fait tout le lot : voir le contenant n'est pas voir le contenu.
 *
 * Et CRÉER un logement dans cet immeuble reste refusé : on ne tient pas
 * l'immeuble, on tient deux de ses logements. Ajouter au parc de quelqu'un
 * d'autre n'est pas gérer le sien.
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

/** Un immeuble de trois logements, un gestionnaire, un locataire par logement. */
async function parcAUnImmeubleDeTrois() {
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
    .send({ name: 'Résidence Unique', district: 'Bastos' })
  const buildingId = imm.body.building.id as string

  const creerLogement = async (label: string) =>
    (
      await request(serveur)
        .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
        .set('Cookie', cookie)
        .send({ label, type: 'T2', surfaceSqm: 60, baseRentMinor: 100000 })
    ).body.unit.id as string

  const confie = await creerLogement('S1')
  const garde = await creerLogement('S2')
  const troisieme = await creerLogement('S3')

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
  const gestionnaire = await request(serveur)
    .post('/api/auth/login')
    .send({ email: 'cabinet@example.com', password: MDP })

  for (const [unitId, nom] of [
    [confie, 'Bekono Landry'],
    [garde, 'Ondoa Pierre'],
    [troisieme, 'Mballa Diane'],
  ] as const) {
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: nom, depositMinor: 200000 })
  }

  const adhesion = await prisma.membership.findFirstOrThrow({
    where: { parkId, role: 'manager' },
    select: { id: true },
  })

  return {
    cookie,
    cookieGestion: cookieDe(gestionnaire),
    parkId,
    buildingId,
    confie,
    garde,
    membershipId: adhesion.id,
  }
}

/** Le geste du propriétaire : la liste ENTIÈRE, aux deux mailles. */
const confier = (
  parkId: string,
  membershipId: string,
  cookie: string,
  corps: { buildingIds?: string[]; unitIds?: string[] },
) =>
  request(serveur)
    .patch(`/api/parks/${parkId}/memberships/${membershipId}/immeubles`)
    .set('Cookie', cookie)
    .send({ buildingIds: [], unitIds: [], ...corps })

const portefeuille = (parkId: string, cookie: string) =>
  request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)

const unitesVues = (corps: { buildings: { units: { id: string }[] }[] }) =>
  corps.buildings.flatMap((b) => b.units).map((u) => u.id)

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

describe('un gestionnaire à qui l’on a confié UN logement', () => {
  it('ne voit que celui-là, dans un immeuble qu’il ne tient pas', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId } = await parcAUnImmeubleDeTrois()
    expect(
      (await confier(parkId, membershipId, cookie, { unitIds: [confie] })).status,
    ).toBe(200)

    const vu = await portefeuille(parkId, cookieGestion)
    expect(
      unitesVues(vu.body),
      'confier un studio ouvrait les deux autres, leurs baux et leurs cautions',
    ).toEqual([confie])
  })

  it('voit l’immeuble qui le porte, sans quoi le logement n’a ni nom ni quartier', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId, buildingId } =
      await parcAUnImmeubleDeTrois()
    await confier(parkId, membershipId, cookie, { unitIds: [confie] })

    const vu = await portefeuille(parkId, cookieGestion)
    const immeubles = vu.body.buildings as { id: string }[]
    /* Voir le CONTENANT n'est pas voir le CONTENU : l'immeuble paraît, vide de
       ses deux autres logements. */
    expect(immeubles.map((i) => i.id)).toEqual([buildingId])
  })

  it('ne voit ni le locataire ni la caution du logement voisin', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId } = await parcAUnImmeubleDeTrois()
    await confier(parkId, membershipId, cookie, { unitIds: [confie] })

    const texte = JSON.stringify((await portefeuille(parkId, cookieGestion)).body)
    expect(texte, 'le voisin de palier ne le concerne pas').not.toContain('Ondoa Pierre')
    expect(texte).not.toContain('Mballa Diane')
    expect(texte, 'et celui du logement confié, si').toContain('Bekono Landry')
  })

  it('ne peut pas encaisser sur le logement voisin', async () => {
    const { cookie, cookieGestion, parkId, confie, garde, membershipId } =
      await parcAUnImmeubleDeTrois()
    await confier(parkId, membershipId, cookie, { unitIds: [confie] })

    const refuse = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookieGestion)
      .send({ unitId: garde, periodStart: '2026-08-01', amountMinor: 100000, method: 'cash' })
    expect(refuse.status, 'lire est borné, écrire doit l’être aussi').toBe(404)
  })

  it('ne peut pas AJOUTER un logement dans cet immeuble', async () => {
    /* Il ne tient pas l'immeuble, il tient un de ses logements. Ajouter au parc
       de quelqu'un d'autre n'est pas gérer le sien. */
    const { cookie, cookieGestion, parkId, confie, membershipId, buildingId } =
      await parcAUnImmeubleDeTrois()
    await confier(parkId, membershipId, cookie, { unitIds: [confie] })

    const refuse = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookieGestion)
      .send({ label: 'S4', type: 'T2', surfaceSqm: 60, baseRentMinor: 100000 })
    expect(refuse.status).toBe(404)
  })
})

describe('les deux mailles se cumulent', () => {
  it('un immeuble ET un logement d’ailleurs font un seul périmètre', async () => {
    const { cookie, cookieGestion, parkId, confie, garde, membershipId, buildingId } =
      await parcAUnImmeubleDeTrois()
    /* L'immeuble entier, plus rien d'autre à ajouter ici — mais la route doit
       accepter les deux listes ensemble sans que l'une n'annule l'autre. */
    await confier(parkId, membershipId, cookie, { buildingIds: [buildingId], unitIds: [confie] })

    const vu = await portefeuille(parkId, cookieGestion)
    expect(
      unitesVues(vu.body).sort(),
      'l’immeuble confié doit rendre TOUS ses logements, le logement listé compris',
    ).toEqual([confie, garde, ...unitesVues(vu.body).filter((u) => u !== confie && u !== garde)].sort())
    expect(unitesVues(vu.body)).toHaveLength(3)
  })

  it('vide des DEUX côtés rend le parc entier', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId } = await parcAUnImmeubleDeTrois()
    await confier(parkId, membershipId, cookie, { unitIds: [confie] })
    expect((await confier(parkId, membershipId, cookie, {})).status).toBe(200)

    const vu = await portefeuille(parkId, cookieGestion)
    expect(unitesVues(vu.body)).toHaveLength(3)
  })
})

describe('le geste de confier des logements', () => {
  it('refuse un logement d’un AUTRE parc', async () => {
    const { cookie, parkId, membershipId } = await parcAUnImmeubleDeTrois()
    const voisin = await request(serveur).post('/api/auth/signup').send({
      email: 'voisin@example.com',
      password: MDP,
      fullName: 'Diane Mballa',
      acceptTerms: true,
      parkName: 'Parc voisin',
      countryCode: 'CM',
    })
    const cookieVoisin = cookieDe(voisin)
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookieVoisin)
    const autreParc = moi.body.memberships[0].parkId as string
    const imm = await request(serveur)
      .post(`/api/parks/${autreParc}/buildings`)
      .set('Cookie', cookieVoisin)
      .send({ name: 'Immeuble étranger', district: 'Akwa' })
    const etranger = await request(serveur)
      .post(`/api/parks/${autreParc}/buildings/${imm.body.building.id}/units`)
      .set('Cookie', cookieVoisin)
      .send({ label: 'X1', type: 'T1', surfaceSqm: 30, baseRentMinor: 50000 })

    const refuse = await confier(parkId, membershipId, cookie, {
      unitIds: [etranger.body.unit.id],
    })
    expect(refuse.status).toBe(404)
  })

  it('consigne les DEUX listes au registre', async () => {
    const { cookie, parkId, confie, membershipId } = await parcAUnImmeubleDeTrois()
    await confier(parkId, membershipId, cookie, { unitIds: [confie] })

    const trace = await prisma.auditEvent.findFirst({
      where: { parkId, action: 'access.scope' },
      select: { payload: true },
    })
    const charge = trace?.payload as { buildingIds?: string[]; unitIds?: string[] }
    expect(charge?.unitIds, 'un pouvoir donné sans trace ne se reprend pas').toEqual([confie])
    expect(charge?.buildingIds).toEqual([])
  })
})

describe('l’exclusion — tout l’immeuble SAUF ces logements', () => {
  /**
   * ═══ CE QUE LA LISTE SEULE NE SAVAIT PAS DIRE ═══
   *
   * « Tout l'immeuble sauf le rez-de-chaussée » se disait en listant les autres
   * logements un à un — et cette liste ne SUIT PAS l'immeuble : le logement
   * ajouté le mois suivant n'y figure pas, et le gestionnaire qui devait tout
   * gérer sauf un ne voit pas le nouveau. Le lot qui a posé la maille du
   * logement l'avait nommé en dette, mot pour mot.
   *
   * L'exclusion inverse le sens : on confie l'IMMEUBLE — qui suit sa propre
   * croissance — et l'on en retranche des logements nommés. Le nouveau logement
   * entre tout seul ; l'exclu reste exclu.
   */
  it('cache le logement exclu d’un immeuble pourtant confié', async () => {
    const { cookie, cookieGestion, parkId, buildingId, confie, garde } =
      await parcAUnImmeubleDeTrois()
    const regle = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${(await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' }, select: { id: true } })).id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [buildingId], unitIds: [], excludedUnitIds: [garde] })
    expect(regle.status).toBe(200)

    const vu = await portefeuille(parkId, cookieGestion)
    const unites = unitesVues(vu.body)
    expect(unites, 'l’immeuble entier moins UN : c’est le contrat').toContain(confie)
    expect(unites, 'l’exclu doit rester dehors').not.toContain(garde)
    expect(unites).toHaveLength(2)
  })

  it('refuse d’écrire sur le logement exclu', async () => {
    const { cookie, cookieGestion, parkId, buildingId, garde } = await parcAUnImmeubleDeTrois()
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [buildingId], unitIds: [], excludedUnitIds: [garde] })

    const refuse = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookieGestion)
      .send({ unitId: garde, periodStart: '2026-08-01', amountMinor: 100000, method: 'cash' })
    expect(refuse.status, 'exclu en lecture, exclu en écriture').toBe(404)
  })

  it('un logement AJOUTÉ à l’immeuble entre tout seul, l’exclu reste exclu', async () => {
    /* Tout le point de l'exclusion : la liste inversée SUIT l'immeuble. */
    const { cookie, cookieGestion, parkId, buildingId, garde } = await parcAUnImmeubleDeTrois()
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [buildingId], unitIds: [], excludedUnitIds: [garde] })

    const neuf = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send({ label: 'S4', type: 'T1', surfaceSqm: 30, baseRentMinor: 60000 })

    const vu = await portefeuille(parkId, cookieGestion)
    const unites = unitesVues(vu.body)
    expect(unites, 'le logement du mois suivant doit entrer sans geste').toContain(
      neuf.body.unit.id,
    )
    expect(unites).not.toContain(garde)
  })

  it('refuse une exclusion hors des immeubles confiés', async () => {
    /* Exclure un logement d'un immeuble qu'on ne confie pas ne retranche rien :
       la ligne serait un fait faux au registre, et un état que personne ne peut
       expliquer. Même refus que l'immeuble d'un autre parc. */
    const { cookie, parkId, confie } = await parcAUnImmeubleDeTrois()
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    const refuse = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [], unitIds: [], excludedUnitIds: [confie] })
    expect(refuse.status).toBe(400)
    expect(refuse.body.error).toBe('exclusion_outside_scope')
  })

  it('consigne les TROIS listes au registre', async () => {
    const { cookie, parkId, buildingId, garde } = await parcAUnImmeubleDeTrois()
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [buildingId], unitIds: [], excludedUnitIds: [garde] })

    const trace = await prisma.auditEvent.findFirst({
      where: { parkId, action: 'access.scope' },
      select: { payload: true },
    })
    const charge = trace?.payload as { excludedUnitIds?: string[] }
    expect(
      charge?.excludedUnitIds,
      'un retranchement non consigné est un pouvoir repris sans trace',
    ).toEqual([garde])
  })
})
