import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { remplacerMessagerie, type Messagerie } from '../messagerie/messagerie.js'

/**
 * CHAQUE COURRIEL DU FIL LAISSE UNE TRACE.
 *
 * ═══ LA QUESTION À LAQUELLE PERSONNE NE POUVAIT RÉPONDRE ═══
 *
 * « Le courriel du 3 septembre est-il parti ? » Le lot qui a ouvert le canal
 * l'avouait : « aucune trace de l'envoi — la relance de loyer a sa table
 * `RentReminderEmail` avec `deliveredAt` ; le fil n'a rien. On ne peut donc pas
 * répondre autrement qu'en lisant les journaux. » Or les journaux tournent, et
 * un gestionnaire qui jure n'avoir jamais été prévenu d'une fuite mérite mieux
 * qu'un haussement d'épaules.
 *
 * ═══ LA MÊME RÈGLE QUE LA RELANCE, PAS UNE NOUVELLE ═══
 *
 * `deliveredAt` reste `null` tant que la messagerie n'a pas rendu `true` — mot
 * pour mot la règle de `RentReminderEmail` et de `Notification.sentAt` : « une
 * date posée par avance ferait mentir le dossier le jour où quelqu'un
 * contestera avoir été prévenu ». La tentative se consigne toujours ; la
 * livraison, seulement quand elle a eu lieu.
 *
 * ═══ CE QUE LA TRACE NE FAIT PAS ═══
 *
 * Elle n'interrompt jamais le geste : un signalement dont la trace échouerait
 * resterait un signalement, comme pour la copie elle-même.
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

let rendre = true
let rétablir: () => void = () => {}
const messagerieDeSonde: Messagerie = {
  async envoyerSms() {
    return false
  },
  async envoyerEmail() {
    return rendre
  },
}

async function parcAvecUnLocataire() {
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
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
  const unitId = a1.body.unit.id as string

  const inv = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant' })
  const locataire = await request(serveur).post('/api/auth/signup').send({
    email: 'romel@example.com',
    password: MDP,
    fullName: 'Bekono Landry',
    acceptTerms: true,
    invitationCode: inv.body.code,
  })
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekono Landry', userId: locataire.body.user.id })

  return { cookie, parkId, unitId, cookieLocataire: cookieDe(locataire) }
}

const signaler = (parkId: string, unitId: string, cookie: string) =>
  request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/works`)
    .set('Cookie', cookie)
    .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'normal' })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  rendre = true
  rétablir = remplacerMessagerie(messagerieDeSonde)
})

afterEach(() => {
  rétablir()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
  await new Promise((resoudre) => serveur.close(resoudre))
})

describe('le courriel qui part', () => {
  it('laisse une trace datée, rattachée au chantier et au destinataire', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const w = await signaler(parkId, unitId, cookieLocataire)

    const traces = await prisma.workThreadEmail.findMany({
      where: { workId: w.body.work.id },
      select: { recipient: true, deliveredAt: true },
    })
    expect(
      traces.map((t) => t.recipient).sort(),
      'sans trace, « a-t-il été prévenu ? » ne se répond qu’en lisant les journaux',
    ).toEqual(['proprio@example.com'])
    expect(traces[0]!.deliveredAt, 'livré : la date atteste').not.toBeNull()
  })
})

describe('le courriel qui ne part pas', () => {
  it('se consigne quand même, SANS date de livraison', async () => {
    /* La règle de `RentReminderEmail`, mot pour mot : une date posée par avance
       ferait mentir le dossier le jour où quelqu'un contestera avoir été
       prévenu. La TENTATIVE se consigne toujours ; la livraison, seulement
       quand elle a eu lieu. */
    rendre = false
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const w = await signaler(parkId, unitId, cookieLocataire)

    const trace = await prisma.workThreadEmail.findFirst({
      where: { workId: w.body.work.id },
      select: { deliveredAt: true },
    })
    expect(trace, 'la tentative doit exister même quand rien ne part').not.toBeNull()
    expect(trace!.deliveredAt).toBeNull()
  })
})

describe('la trace se LIT, et pas seulement s’écrit', () => {
  /**
   * ═══ UNE TABLE ÉCRITE QUE PERSONNE NE RELIT NE RÉPOND À RIEN ═══
   *
   * Le lot qui a posé `WorkThreadEmail` s'arrêtait à l'écriture. « Le courriel
   * du 3 septembre est-il parti ? » avait dès lors sa réponse en base, et aucun
   * moyen de la consulter autrement qu'en requêtant Postgres à la main — un
   * demi-lot livré comme un lot entier.
   *
   * ═══ DES COMPTES, JAMAIS DES ADRESSES ═══
   *
   * Le portefeuille rend `emailCopies` par chantier : combien de copies
   * tentées, combien remises, et QUAND la dernière tentative a eu lieu. Pas les
   * adresses : elles n'ajoutent rien à « a-t-il été prévenu ? » et sortiraient
   * de l'espace de qui les lit. La divulgation minimale qui répond à la
   * question, et rien de plus.
   *
   * ═══ ET JAMAIS AU LOCATAIRE ═══
   *
   * C'est une question de GESTION — « mon gestionnaire a-t-il reçu mon
   * signalement ? » se répond par la réponse elle-même, pas par un journal
   * d'envoi. Le locataire ne reçoit pas ce champ.
   */
  it('rend les compteurs de copies au propriétaire', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await signaler(parkId, unitId, cookieLocataire)

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    const travail = (vu.body.works as { emailCopies?: unknown }[])[0]
    expect(
      travail?.emailCopies,
      'la trace existait en base et rien ne la lisait',
    ).toEqual({ sent: 1, delivered: 1, lastAttemptAt: expect.any(String) })
  })

  it('compte la tentative NON remise sans la confondre avec une réussite', async () => {
    rendre = false
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await signaler(parkId, unitId, cookieLocataire)

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    const travail = (vu.body.works as { emailCopies?: { sent: number; delivered: number } }[])[0]
    expect(travail?.emailCopies?.sent, 'la tentative a eu lieu').toBe(1)
    expect(travail?.emailCopies?.delivered, 'et rien n’est parti').toBe(0)
  })

  it('ne dit RIEN au locataire', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await signaler(parkId, unitId, cookieLocataire)

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieLocataire)
    const travail = (vu.body.works as { emailCopies?: unknown }[])[0]
    expect(
      travail?.emailCopies,
      'un journal d’envoi est une question de gestion, pas la sienne',
    ).toBeUndefined()
  })

  it('n’expose AUCUNE adresse', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await signaler(parkId, unitId, cookieLocataire)

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    expect(
      JSON.stringify(vu.body.works),
      'les adresses n’ajoutent rien à « a-t-il été prévenu ? »',
    ).not.toContain('proprio@example.com')
  })
})

describe('la trace distingue les MESSAGES d’un fil', () => {
  /**
   * ═══ « TOUS MESSAGES CONFONDUS » ═══
   *
   * Le compteur du fil répondait « 3 copies remises · 20/08 » pour un échange
   * de cinq messages. La date était la dernière tentative, toutes confondues :
   * on ne pouvait pas savoir quand la troisième copie était partie, ni laquelle
   * des cinq n'avait pas trouvé son destinataire.
   *
   * Chaque trace porte désormais le MESSAGE qu'elle accompagne — la
   * notification qui le transporte. Le signalement initial n'en a pas : il EST
   * le fil, et son avis est écrit après la copie.
   */
  it('rattache chaque copie à son message', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const w = await signaler(parkId, unitId, cookieLocataire)

    await request(serveur)
      .post(`/api/parks/${parkId}/works/${w.body.work.id}/reply`)
      .set('Cookie', cookie)
      .send({ message: 'Le plombier passe jeudi.' })

    const traces = await prisma.workThreadEmail.findMany({
      where: { workId: w.body.work.id },
      select: { notificationId: true },
      orderBy: { createdAt: 'asc' },
    })
    expect(traces.length, 'deux envois : le signalement, puis la réponse').toBe(2)
    expect(
      traces[0]!.notificationId,
      'le signalement EST le fil : son avis est écrit après la copie',
    ).toBeNull()
    expect(
      traces[1]!.notificationId,
      'sans lui, « 3 remises » ne dit pas lesquelles',
    ).not.toBeNull()
  })

  it('rend le compte PAR message au portefeuille', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const w = await signaler(parkId, unitId, cookieLocataire)
    await request(serveur)
      .post(`/api/parks/${parkId}/works/${w.body.work.id}/reply`)
      .set('Cookie', cookie)
      .send({ message: 'Le plombier passe jeudi.' })

    const vu = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    const avis = (vu.body.notifications as { id: string; emailCopies?: unknown }[]).find(
      (n) => n.emailCopies,
    )
    expect(
      avis?.emailCopies,
      'la carte d’un message doit pouvoir dire SA copie, pas celle du fil',
    ).toEqual({ sent: 1, delivered: 1, lastAttemptAt: expect.any(String) })
  })
})
