import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { remplacerMessagerie, type Messagerie } from '../messagerie/messagerie.js'
import { tenterRelanceEmailMilestone } from './routes.js'

/**
 * LA RELANCE DE LOYER PARLE LA LANGUE DU LOCATAIRE.
 *
 * ═══ LE DERNIER GABARIT RESTÉ MONOLINGUE ═══
 *
 * Le fil d'un signalement est bilingue depuis le lot précédent ; la relance ne
 * l'était pas, et c'est le message qui compte le PLUS pour un locataire : il
 * réclame de l'argent. Un locataire anglophone recevait une mise en demeure
 * douce dans une langue qu'il ne lit pas.
 *
 * ═══ SA LANGUE VIENT DE SON COMPTE, PAS DE SA FICHE ═══
 *
 * `Tenant` ne porte pas de langue ; `UserAccount` en porte une depuis
 * l'origine. Un locataire sans compte retombe donc sur le français — le défaut
 * du produit — comme pour le fil.
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

let sujets: string[] = []
let rétablir: () => void = () => {}
const capture: Messagerie = {
  async envoyerSms() {
    return false
  },
  async envoyerEmail(_adresse, sujet) {
    sujets.push(sujet)
    return true
  },
}

/** Un bail, son locataire, et le compte qu'on lui relie ou non. */
async function bailAvecLocataire(options: { langue?: 'fr' | 'en'; avecCompte: boolean }) {
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

  let userId: string | undefined
  if (options.avecCompte) {
    const inv = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant' })
    const compte = await request(serveur).post('/api/auth/signup').send({
      email: 'romel@example.com',
      password: MDP,
      fullName: 'Bekono Landry',
      acceptTerms: true,
      invitationCode: inv.body.code,
    })
    userId = compte.body.user.id as string
    await prisma.userAccount.update({
      where: { id: userId },
      data: { locale: options.langue ?? 'fr' },
    })
  }

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({
      unitId: a1.body.unit.id,
      fullName: 'Bekono Landry',
      ...(userId ? { userId } : {}),
    })

  /* La route de création ne prend pas de courriel — la fiche le porte, et c'est
     lui que la relance vise. On le pose donc directement, comme le fait la garde
     du désabonnement pour la même raison. */
  await prisma.tenant.updateMany({
    where: { parkId },
    data: { email: 'romel@example.com' },
  })

  const bail = await prisma.lease.findFirstOrThrow({
    where: { unit: { building: { parkId } } },
    select: { id: true, tenant: { select: { fullName: true, email: true, userId: true } } },
  })
  return bail
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  sujets = []
  rétablir = remplacerMessagerie(capture)
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

describe('la relance de loyer', () => {
  it('parle anglais à un locataire anglophone', async () => {
    const bail = await bailAvecLocataire({ langue: 'en', avecCompte: true })
    const issue = await tenterRelanceEmailMilestone(bail, 7, 90000, 'XAF')
    expect(issue).toBe('sent')
    expect(
      sujets[0],
      'le message qui réclame de l’argent est celui qu’on doit le mieux comprendre',
    ).toContain('rent is 7 days overdue')
  })

  it('garde le français pour un francophone', async () => {
    const bail = await bailAvecLocataire({ langue: 'fr', avecCompte: true })
    await tenterRelanceEmailMilestone(bail, 7, 90000, 'XAF')
    expect(sujets[0]).toContain('loyer en retard')
  })

  it('retombe sur le français quand la fiche n’a pas de compte', async () => {
    /* `Tenant` ne porte pas de langue ; sans compte, il n'y a rien à lire, et le
       défaut du produit est le français. */
    const bail = await bailAvecLocataire({ avecCompte: false })
    await tenterRelanceEmailMilestone(bail, 7, 90000, 'XAF')
    expect(sujets[0]).toContain('loyer en retard')
  })
})
