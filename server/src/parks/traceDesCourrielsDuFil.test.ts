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
