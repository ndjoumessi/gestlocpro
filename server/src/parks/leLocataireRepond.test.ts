import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE FIL RÉPOND DANS LES DEUX SENS.
 *
 * ═══ CE QUE LA CONVERSATION FAISAIT, ET OÙ ELLE S'ARRÊTAIT ═══
 *
 * Deux lots ont construit ce fil, un maillon à la fois. `workReply` fait
 * descendre la réponse du gestionnaire vers le locataire ; `tenantReport` fait
 * monter le signalement vers le bailleur ; et l'écran du locataire affiche
 * enfin l'échange sous le signalement où il a été déclaré.
 *
 * Il s'arrêtait là. Le gestionnaire écrit « le plombier passe jeudi entre 8 h
 * et 12 h, serez-vous là ? » — et le locataire n'a AUCUN moyen de répondre.
 * Ni « oui », ni « je travaille jeudi », ni « la fuite a empiré ». La question
 * est posée dans le produit, la réponse se donne au téléphone, et la décision
 * qui en sort ne figure nulle part dans le dossier de l'intervention.
 *
 * C'est exactement le raisonnement que la route de réponse porte déjà pour
 * l'autre sens : « les échanges qui décident d'une dépense se perdaient hors du
 * dossier ». Il valait dans les deux directions ; il n'était appliqué que dans
 * une.
 *
 * ═══ CE QUE CE LOT AJOUTE, ET CE QU'IL NE CHANGE PAS ═══
 *
 * La MÊME route, ouverte au locataire. Pas de seconde route : deux chemins pour
 * un même geste, c'est deux jeux de gardes à tenir d'accord, et la borne du
 * texte, le rattachement au chantier et la trace sont identiques dans les deux
 * sens.
 *
 * Ce qui DIFFÈRE se dérive du rôle, jamais du corps de la requête — le même
 * arbitrage que l'origine d'une intervention, « un client qui pourrait
 * l'annoncer pourrait mentir » :
 *
 *  · la CLÉ — `workReply` descend, `tenantReply` monte. Deux clés et non une
 *    avec un drapeau : l'écran doit dire QUI a parlé, et une carte qui ne le
 *    dit pas transforme un échange en monologue ;
 *  · les DESTINATAIRES — le déclarant d'un côté, toute la gestion de l'autre,
 *    comme `tenantReport` ;
 *  · le PÉRIMÈTRE — la gestion répond sur n'importe quel chantier du parc, le
 *    locataire sur le sien seulement.
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

/** Un parc, un gestionnaire, deux locataires en place, et un signalement. */
async function parcAvecUnSignalement() {
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
  const creerLogement = async (label: string) =>
    (
      await request(serveur)
        .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
        .set('Cookie', cookie)
        .send({ label, type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
    ).body.unit.id as string
  const unitId = await creerLogement('A1')
  const autreUnitId = await creerLogement('A2')

  const invGes = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  const gestionnaire = await request(serveur).post('/api/auth/signup').send({
    email: 'diane@example.com',
    password: MDP,
    fullName: 'Diane Mballa',
    acceptTerms: true,
    invitationCode: invGes.body.code,
  })

  const inscrireLocataire = async (email: string, nom: string, unite: string) => {
    const inv = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant' })
    const compte = await request(serveur).post('/api/auth/signup').send({
      email,
      password: MDP,
      fullName: nom,
      acceptTerms: true,
      invitationCode: inv.body.code,
    })
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId: unite, fullName: nom, userId: compte.body.user.id })
    return { cookie: cookieDe(compte), id: compte.body.user.id as string }
  }

  const locataire = await inscrireLocataire('romel@example.com', 'Bekono Landry', unitId)
  const voisin = await inscrireLocataire('voisin@example.com', 'Ondoa Pierre', autreUnitId)

  const signalement = await request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/works`)
    .set('Cookie', locataire.cookie)
    .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'normal' })
  expect(signalement.status, `signalement refusé : ${JSON.stringify(signalement.body)}`).toBe(201)

  return {
    cookie,
    parkId,
    unitId,
    workId: signalement.body.work.id as string,
    cookieLocataire: locataire.cookie,
    cookieVoisin: voisin.cookie,
    locataireId: locataire.id,
    proprioId: proprio.body.user.id as string,
    gestionnaireId: gestionnaire.body.user.id as string,
  }
}

const repondre = (parkId: string, workId: string, cookie: string, message: string) =>
  request(serveur)
    .post(`/api/parks/${parkId}/works/${workId}/reply`)
    .set('Cookie', cookie)
    .send({ message })

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

describe('le locataire répond sur son signalement', () => {
  it('est accepté, là où il recevait un refus de rôle', async () => {
    const { parkId, workId, cookieLocataire } = await parcAvecUnSignalement()

    const reponse = await repondre(
      parkId,
      workId,
      cookieLocataire,
      'Jeudi je travaille, vendredi matin je suis là.',
    )

    expect(
      reponse.status,
      'le gestionnaire pose une question dans le produit et la réponse se donne au téléphone',
    ).toBe(201)
  })

  it('écrit une clé qui dit QUI a parlé, et non celle du gestionnaire', async () => {
    const { parkId, workId, cookieLocataire } = await parcAvecUnSignalement()
    await repondre(parkId, workId, cookieLocataire, 'La fuite a empiré depuis hier.')

    const avis = await prisma.notification.findMany({
      where: { parkId, kind: 'work' },
      select: { messageKey: true, params: true },
    })
    const montante = avis.find((a) => a.messageKey === 'tenantReply')

    expect(
      montante,
      'sans clé propre, la carte du gestionnaire annonce sa PROPRE réponse comme reçue',
    ).toBeDefined()
    expect((montante?.params as { text?: string })?.text).toBe('La fuite a empiré depuis hier.')
    expect(
      (montante?.params as { workId?: string })?.workId,
      'sans `workId`, la réponse ne dit pas de quel signalement elle parle',
    ).toBe(workId)
  })

  it('atteint le propriétaire ET le gestionnaire, comme le signalement lui-même', async () => {
    const { parkId, workId, cookieLocataire, proprioId, gestionnaireId } =
      await parcAvecUnSignalement()
    await repondre(parkId, workId, cookieLocataire, 'Je serai là vendredi matin.')

    const avis = await prisma.notification.findFirst({
      where: { parkId, messageKey: 'tenantReply' },
      select: { recipients: { select: { userId: true } } },
    })
    expect(
      (avis?.recipients ?? []).map((r) => r.userId).sort(),
      "adressée au seul propriétaire, elle manquerait celui qui fait passer l'artisan",
    ).toEqual([proprioId, gestionnaireId].sort())
  })

  it('ne lui revient PAS à lui-même', async () => {
    /* Il sait ce qu'il a écrit — son propre fil le lui montre. Un écho
       l'habituerait à ignorer ce qui se pose dans sa liste, exactement comme
       pour le signalement qu'il vient de déclarer. */
    const { parkId, workId, cookieLocataire, locataireId } = await parcAvecUnSignalement()
    await repondre(parkId, workId, cookieLocataire, 'Merci, c’est noté.')

    const avis = await prisma.notification.findFirst({
      where: { parkId, messageKey: 'tenantReply' },
      select: { recipients: { select: { userId: true } } },
    })
    expect((avis?.recipients ?? []).map((r) => r.userId)).not.toContain(locataireId)
  })

  it('refuse le signalement d’un AUTRE logement, sans confirmer qu’il existe', async () => {
    const { parkId, workId, cookieVoisin } = await parcAvecUnSignalement()

    const reponse = await repondre(parkId, workId, cookieVoisin, 'Chez moi aussi ça fuit.')

    /* 404 et non 403 : un 403 confirmerait au voisin qu'une intervention est en
       cours dans le logement d'à côté — la même règle que partout ailleurs sur
       ce routeur. */
    expect(reponse.status).toBe(404)
    const avis = await prisma.notification.count({ where: { parkId, messageKey: 'tenantReply' } })
    expect(avis, 'refusée à l’écran et écrite quand même : le pire des deux').toBe(0)
  })
})

describe('le sens descendant, inchangé', () => {
  it('garde sa clé et son unique destinataire', async () => {
    const { cookie, parkId, workId, locataireId } = await parcAvecUnSignalement()

    const reponse = await repondre(parkId, workId, cookie, 'Le plombier passe jeudi matin.')
    expect(reponse.status).toBe(201)
    expect(reponse.body.delivered).toBe(true)

    const avis = await prisma.notification.findFirst({
      where: { parkId, messageKey: 'workReply' },
      select: { recipients: { select: { userId: true } } },
    })
    expect(
      (avis?.recipients ?? []).map((r) => r.userId),
      'le sens qui marchait ne doit pas payer l’ouverture de l’autre',
      /* Le déclarant, et lui seul : c'est une réponse qui lui est adressée, pas
         une annonce au parc. */
    ).toEqual([locataireId])
  })

  it('refuse toujours de répondre à une intervention SANS déclarant', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnSignalement()

    /* Ouverte par le bailleur : un entretien planifié n'a personne à prévenir. */
    const chantier = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', cookie)
      .send({ title: 'Ravalement de la façade', trade: 'painting', urgency: 'low' })

    const reponse = await repondre(parkId, chantier.body.work.id, cookie, 'Prévu la semaine 12.')
    expect(reponse.status).toBe(409)
    expect(reponse.body.error).toBe('no_reporter')
  })
})
