import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * ON CONFIE UN IMMEUBLE, PAS UN PARC.
 *
 * ═══ CE QUE LE PRODUIT PROMETTAIT SANS SAVOIR LE FAIRE ═══
 *
 * `Park.delegation` vaut `solo` ou `delegate` : tout ou rien, à l'échelle du
 * parc entier. Un propriétaire de trois immeubles qui confie le premier à un
 * cabinet lui ouvre les trois — les baux, les loyers, les impayés et les
 * cautions de logements dont ce cabinet n'a jamais entendu parler.
 *
 * C'est la demande qui revient depuis trois lots, et elle a été nommée trois
 * fois sans être prise : le modèle ne portait rien pour la tenir.
 *
 * ═══ LE PÉRIMÈTRE EST UNE CLAUSE DE REQUÊTE ═══
 *
 * Jamais un filtre après lecture. C'est la règle que `unitesVisibles` pose déjà
 * pour le locataire, et sa raison vaut mot pour mot ici : « filtrer en mémoire
 * suppose d'avoir d'abord tout lu, et il suffit d'un oubli sur un seul chemin
 * pour que les données des voisins sortent ».
 *
 * ═══ VIDE VEUT DIRE « TOUT LE PARC », ET C'EST DÉLIBÉRÉ ═══
 *
 * Le sens inverse serait plus intuitif — aucun immeuble confié, rien à voir —
 * et il est INAPPLICABLE : la migration aveuglerait, à la seconde du déploiement,
 * tous les gestionnaires déjà en place. Un périmètre vide est donc l'absence de
 * restriction, et ce cas-là est éprouvé ci-dessous comme les autres.
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

/** Un parc à DEUX immeubles, un gestionnaire, et un locataire dans chacun. */
async function parcADeuxImmeubles() {
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

  const creerImmeuble = async (name: string) =>
    (
      await request(serveur)
        .post(`/api/parks/${parkId}/buildings`)
        .set('Cookie', cookie)
        .send({ name, district: 'Bastos' })
    ).body.building.id as string

  const confie = await creerImmeuble('Résidence Confiée')
  const garde = await creerImmeuble('Résidence Gardée')

  const creerLogement = async (buildingId: string, label: string) =>
    (
      await request(serveur)
        .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
        .set('Cookie', cookie)
        .send({ label, type: 'T2', surfaceSqm: 60, baseRentMinor: 100000 })
    ).body.unit.id as string

  const uniteConfiee = await creerLogement(confie, 'C1')
  const uniteGardee = await creerLogement(garde, 'G1')

  const inv = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  const gestionnaire = await request(serveur).post('/api/auth/signup').send({
    email: 'cabinet@example.com',
    password: MDP,
    fullName: 'Cabinet Njoya',
    acceptTerms: true,
    invitationCode: inv.body.code,
  })

  for (const [unitId, nom] of [
    [uniteConfiee, 'Bekono Landry'],
    [uniteGardee, 'Ondoa Pierre'],
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
    confie,
    garde,
    uniteConfiee,
    uniteGardee,
    membershipId: adhesion.id,
  }
}

/** Le geste du propriétaire : il confie un immeuble, et un seul. */
const confier = (parkId: string, membershipId: string, cookie: string, buildingIds: string[]) =>
  request(serveur)
    .patch(`/api/parks/${parkId}/memberships/${membershipId}/immeubles`)
    .set('Cookie', cookie)
    .send({ buildingIds })

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

describe('un gestionnaire sans périmètre', () => {
  it('ne voit RIEN, parce qu’on ne lui a rien confié', async () => {
    /*
      LA RÈGLE A CHANGÉ DE SENS, ET CE CAS DISAIT L'ANCIENNE.

      Il affirmait « le vide n'aveugle personne », et sa raison était juste : à
      la seconde du déploiement, aucun gestionnaire en place n'avait de
      périmètre, et le sens inverse les aurait tous privés de leur parc.

      C'était vrai POUR EUX. Un gestionnaire créé quatre jours plus tard
      héritait de la même règle et voyait deux immeubles, trois logements, leurs
      locataires et leurs adresses sans qu'on lui ait rien donné — capturé sur
      un parc réel, et signalé par son propriétaire.

      Une adhésion qui NAÎT est désormais `declared` : vide y veut dire vide.
      Celles d'avant gardent `wholePark`, et le cas suivant le garde.
    */
    const { parkId, cookieGestion } = await parcADeuxImmeubles()

    const vu = await portefeuille(parkId, cookieGestion)
    expect(vu.status).toBe(200)
    expect((vu.body.buildings as unknown[]).length).toBe(0)
  })

  it('voit tout le parc quand son adhésion est d’AVANT la règle', async () => {
    /* Le refus d'aveugler les gestionnaires en place reste entier : c'est la
       seule chose que la bascule ne devait pas défaire. */
    const { parkId, cookieGestion } = await parcADeuxImmeubles()
    await prisma.membership.updateMany({
      where: { parkId, role: 'manager' },
      data: { scope: 'wholePark' },
    })

    const vu = await portefeuille(parkId, cookieGestion)
    expect((vu.body.buildings as unknown[]).length).toBe(2)
  })
})

describe('un gestionnaire à qui l’on a confié UN immeuble', () => {
  it('ne voit que celui-là dans son portefeuille', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId } = await parcADeuxImmeubles()
    expect((await confier(parkId, membershipId, cookie, [confie])).status).toBe(200)

    const vu = await portefeuille(parkId, cookieGestion)
    const immeubles = vu.body.buildings as { id: string; name: string }[]
    expect(
      immeubles.map((i) => i.name),
      'confier un immeuble ouvrait les baux et les cautions de tous les autres',
    ).toEqual(['Résidence Confiée'])
  })

  it('ne voit ni les baux ni les cautions de l’immeuble gardé', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId, uniteGardee } =
      await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const vu = await portefeuille(parkId, cookieGestion)
    /* Le PORTEFEUILLE est ce qui nourrit chaque écran : une caution qui en sort
       apparaît dans « Cautions », dans le tableau de bord et dans les
       indicateurs consolidés, sans qu'aucun de ces écrans n'ait à se tromper. */
    const cautions = vu.body.deposits as { unitId: string }[]
    expect(cautions.some((d) => d.unitId === uniteGardee)).toBe(false)
    const baux = vu.body.leaseCharges as { leaseId: string }[]
    expect(Array.isArray(baux)).toBe(true)

    const texte = JSON.stringify(vu.body)
    expect(texte, 'le locataire de l’immeuble gardé ne le concerne pas').not.toContain(
      'Ondoa Pierre',
    )
    expect(texte, 'et celui de l’immeuble confié, si').toContain('Bekono Landry')
  })

  it('ne peut pas créer un logement dans l’immeuble gardé', async () => {
    const { cookie, cookieGestion, parkId, confie, garde, membershipId } =
      await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const refuse = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${garde}/units`)
      .set('Cookie', cookieGestion)
      .send({ label: 'G2', type: 'T2', surfaceSqm: 60, baseRentMinor: 100000 })

    /* 404 et non 403 : un 403 confirmerait l'existence de l'immeuble qu'on lui
       cache — la règle que tout ce routeur applique déjà. */
    expect(refuse.status).toBe(404)

    const accepte = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${confie}/units`)
      .set('Cookie', cookieGestion)
      .send({ label: 'C2', type: 'T2', surfaceSqm: 60, baseRentMinor: 100000 })
    expect(accepte.status, 'le borner ne doit pas le paralyser sur ce qu’il gère').toBe(201)
  })

  it('ne peut pas encaisser sur un logement de l’immeuble gardé', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId, uniteGardee } =
      await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const refuse = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookieGestion)
      .send({
        unitId: uniteGardee,
        periodStart: '2026-08-01',
        amountMinor: 100000,
        method: 'cash',
      })
    expect(refuse.status, 'lire est borné, écrire doit l’être aussi').toBe(404)
  })
})

describe('le geste de confier', () => {
  it('appartient au propriétaire seul', async () => {
    const { cookieGestion, parkId, confie, membershipId } = await parcADeuxImmeubles()

    const refuse = await confier(parkId, membershipId, cookieGestion, [confie])
    expect(
      refuse.status,
      'un gestionnaire qui élargit son propre périmètre n’est plus borné du tout',
    ).toBe(403)
  })

  it('refuse un immeuble d’un AUTRE parc', async () => {
    const { cookie, parkId, membershipId } = await parcADeuxImmeubles()
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
    const etranger = await request(serveur)
      .post(`/api/parks/${autreParc}/buildings`)
      .set('Cookie', cookieVoisin)
      .send({ name: 'Immeuble étranger', district: 'Akwa' })

    const refuse = await confier(parkId, membershipId, cookie, [etranger.body.building.id])
    expect(refuse.status).toBe(404)
  })

  it('se défait : une liste vide rend le parc entier', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId } = await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])
    expect((await confier(parkId, membershipId, cookie, [])).status).toBe(200)

    const vu = await portefeuille(parkId, cookieGestion)
    expect((vu.body.buildings as unknown[]).length).toBe(2)
  })

  it('se consigne au registre des décisions', async () => {
    /* Confier un immeuble donne à quelqu'un la main sur des loyers et des
       cautions. Le registre existe pour ces gestes-là. */
    const { cookie, parkId, confie, membershipId } = await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const trace = await prisma.auditEvent.findFirst({
      where: { parkId, action: 'access.scope' },
      select: { payload: true },
    })
    expect(trace, 'un pouvoir donné sans trace ne se reprend pas').toBeDefined()
    expect((trace?.payload as { buildingIds?: string[] })?.buildingIds).toEqual([confie])
  })
})

describe('le gestionnaire borné SAIT qu’il l’est', () => {
  /**
   * ═══ POURQUOI LE PRODUIT DOIT LE DIRE ═══
   *
   * Le périmètre est STRICT : il ne voit ni les immeubles qu'on ne lui a pas
   * confiés, ni leurs chiffres. Il lit donc un tableau de bord entièrement
   * cohérent — encaissé, impayés, taux d'occupation — qui ne porte que sur SA
   * part, sans que rien ne l'en avertisse.
   *
   * Le risque n'est pas qu'il voie trop, c'est qu'il MÉSINTERPRÈTE ce qu'il
   * voit : « le parc a encaissé 1,2 million ce mois-ci » dit à un propriétaire
   * qui en attend le double. Un chiffre juste sur un périmètre inconnu est
   * plus dangereux qu'un chiffre absent.
   *
   * ═══ CE QU'IL APPREND, ET CE QU'IL N'APPREND PAS ═══
   *
   * Le FAIT de la restriction, jamais son ÉTENDUE. Pas de compte — « 2 sur 3 »
   * dirait qu'un troisième immeuble existe —, pas de nom, pas de chiffre de ce
   * qui lui est caché. Un booléen, et rien d'autre.
   *
   * C'est la ligne exacte que le périmètre strict autorise : cacher la DONNÉE
   * sans cacher le FAIT, parce que le fait est ce qui l'empêche de lire ses
   * propres chiffres de travers.
   */
  it('lit dans son portefeuille que sa vue est bornée', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId } = await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const vu = await portefeuille(parkId, cookieGestion)
    expect(
      vu.body.scoped,
      'un chiffre juste sur un périmètre inconnu est pire qu’un chiffre absent',
    ).toBe(true)
  })

  it('n’apprend NI le compte NI le nom de ce qu’on lui cache', async () => {
    const { cookie, cookieGestion, parkId, confie, membershipId } = await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const vu = await portefeuille(parkId, cookieGestion)
    const texte = JSON.stringify(vu.body)
    expect(texte, 'le nom de l’immeuble gardé n’a rien à faire dans sa réponse').not.toContain(
      'Résidence Gardée',
    )
    /* Le périmètre strict, tel qu'il a été décidé : « il ne sait pas que le 3e
       immeuble existe ». Un compte le dirait. */
    expect(Object.keys(vu.body)).not.toContain('parkBuildingCount')
  })

  it('ne le lit PAS quand rien ne le borne', async () => {
    /* « Rien ne le borne » veut dire `wholePark`, et non plus « liste vide » :
       une adhésion qui naît est bornée dès sa première minute, et l'annonce lui
       est due — sans elle, un parc vide se lirait « ce parc n'a rien » au lieu
       de « on ne vous a rien confié ». */
    const { parkId, cookieGestion } = await parcADeuxImmeubles()
    await prisma.membership.updateMany({
      where: { parkId, role: 'manager' },
      data: { scope: 'wholePark' },
    })

    const vu = await portefeuille(parkId, cookieGestion)
    expect(
      vu.body.scoped,
      'l’annoncer à qui gère tout le parc ferait chercher une restriction inexistante',
    ).toBe(false)
  })

  it('ne le lit jamais chez le propriétaire', async () => {
    const { cookie, parkId, confie, membershipId } = await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const vu = await portefeuille(parkId, cookie)
    expect(vu.body.scoped).toBe(false)
  })
})

describe('le propriétaire, lui, n’est jamais borné', () => {
  it('voit les deux immeubles quoi qu’il ait confié À UN AUTRE', async () => {
    const { cookie, parkId, confie, membershipId } = await parcADeuxImmeubles()
    await confier(parkId, membershipId, cookie, [confie])

    const vu = await portefeuille(parkId, cookie)
    expect((vu.body.buildings as unknown[]).length).toBe(2)
  })

  it('voit les deux même si une ligne le borne LUI', async () => {
    /**
     * LE CAS QUI REND LA CONDITION PORTANTE.
     *
     * `MembershipBuilding` ne porte pas le rôle dans sa clé, et la route accepte
     * n'importe quelle adhésion du parc : une ligne posée sur celle d'un
     * propriétaire est un état ATTEIGNABLE, pas une hypothèse. La lecture du
     * périmètre l'ignore explicitement — et sans ce cas, cette condition ne
     * changeait aucun verdict. Le témoin de mutation l'a dit : la retirer
     * laissait la suite au vert.
     *
     * Ce qu'elle empêche : un propriétaire borné à un immeuble ne pourrait plus
     * voir ni arbitrer les autres, et personne au-dessus de lui ne pourrait le
     * délier.
     */
    const { cookie, parkId, confie } = await parcADeuxImmeubles()
    const sienne = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'owner' },
      select: { id: true },
    })
    expect((await confier(parkId, sienne.id, cookie, [confie])).status).toBe(200)

    const vu = await portefeuille(parkId, cookie)
    expect(
      (vu.body.buildings as unknown[]).length,
      'un propriétaire borné ne pourrait plus arbitrer son propre parc',
    ).toBe(2)
  })
})
