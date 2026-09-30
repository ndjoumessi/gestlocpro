import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { remplacerMessagerie } from '../messagerie/messagerie.js'

/**
 * LE CANAL DE LA RELANCE, ET CE QUE LE PRODUIT ÉCRIT QUAND RIEN NE PART.
 *
 * ═══ CE QUE CE LOT CORRIGE ═══
 *
 * La route posait `channel: parti ? 'sms' : 'in_app'`, EN DUR. Le produit ne
 * savait relancer que par SMS, et aucun réglage ne disait le contraire. Sur le
 * marché visé, WhatsApp atteint plus de gens et coûte moins par envoi.
 *
 * ═══ LES TROIS RÈGLES QUE CES CAS TIENNENT ═══
 *
 *   1. LE CANAL VOULU N'EST PAS LE CANAL ÉCRIT. On écrit celui par lequel le
 *      message est RÉELLEMENT parti, et `in_app` quand rien n'est parti.
 *   2. UN PARC RÉGLÉ SUR WHATSAPP N'ENVOIE PAS DE SMS. Se replier sur l'autre
 *      canal serait envoyer par une voie que personne n'a choisie, et à un coût
 *      que personne n'a accepté.
 *   3. `in_app` ET `email` NE SE RÈGLENT PAS. Le premier est un CONSTAT — ce
 *      qu'on écrit quand rien n'est parti — et le choisir comme intention
 *      reviendrait à commander « n'envoie rien » sous le nom d'un canal. Le
 *      second n'a pas de rédaction de relance.
 *
 * ═══ CE QUE CES CAS NE PEUVENT PAS PROUVER ═══
 *
 * Qu'une relance WhatsApp arrive vraiment. Meta exige un MODÈLE approuvé pour
 * tout message sortant hors d'une fenêtre de 24 h ; une relance de loyer est non
 * sollicitée. La couture rend alors `false`, et c'est exactement le chemin que
 * le premier cas ci-dessous éprouve — celui où l'on écrit `in_app`.
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

let rendre: () => void = () => {}

async function parcEnRetard() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Arsène Nkolo',
    confirmLegal: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const imm = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Residance Djoumessi', district: 'Bastos' })
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Serge Mbarga', startsOn: '2026-01-01' })
  /* SANS NUMÉRO, AUCUN CANAL N'EST TENTÉ — la route le dit déjà. On en pose un
     pour que les cas portent sur le CHOIX du canal et non sur son absence. */
  await prisma.tenant.updateMany({ where: { parkId }, data: { phoneE164: '+237677214408' } })

  const bail = await prisma.lease.findFirstOrThrow({ where: { unitId }, select: { id: true } })
  /* Une échéance due il y a longtemps : la relance ne part que sur un retard. */
  const ilYALongtemps = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
  await prisma.rentCharge.create({
    data: {
      leaseId: bail.id,
      periodStart: ilYALongtemps,
      dueOn: ilYALongtemps,
      rentMinor: 70000,
    },
  })
  return { cookie, parkId, leaseId: bail.id }
}

function relancer(parkId: string, leaseId: string, cookie: string) {
  return request(serveur)
    .post(`/api/parks/${parkId}/reminders`)
    .set('Cookie', cookie)
    .send({ leaseIds: [leaseId] })
}

function traceDe(parkId: string) {
  return prisma.notification.findFirstOrThrow({
    where: { parkId, messageKey: 'rentReminder' },
    select: { channel: true, sentAt: true },
  })
}

beforeEach(async () => {
  await prisma.userAccount.deleteMany()
  await prisma.park.deleteMany()
})

afterEach(() => {
  rendre()
  rendre = () => {}
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('le canal de la relance', () => {
  it('ÉCRIT `whatsapp` quand le message est PARTI par là', async () => {
    const { cookie, parkId, leaseId } = await parcEnRetard()
    await prisma.park.update({ where: { id: parkId }, data: { reminderChannel: 'whatsapp' } })

    const vers: string[] = []
    rendre = remplacerMessagerie({
      async envoyerWhatsApp(destinataire) {
        vers.push(destinataire)
        return true
      },
      async envoyerSms() {
        throw new Error('un parc réglé sur WhatsApp ne doit pas emprunter le SMS')
      },
      async envoyerEmail() {
        return false
      },
    })

    await relancer(parkId, leaseId, cookie)

    expect(vers).toEqual(['+237677214408'])
    const trace = await traceDe(parkId)
    expect(trace.channel).toBe('whatsapp')
    expect(trace.sentAt).not.toBeNull()
  })

  it('ÉCRIT `in_app` quand WhatsApp REFUSE — le cas du modèle non approuvé', async () => {
    const { cookie, parkId, leaseId } = await parcEnRetard()
    await prisma.park.update({ where: { id: parkId }, data: { reminderChannel: 'whatsapp' } })

    rendre = remplacerMessagerie({
      /* CE QUE TWILIO REND EN CODE 63016 : un message libre hors de la fenêtre
         de 24 h, sans modèle approuvé par Meta. C'est l'état de TOUT parc qui
         n'a pas fait la démarche, et donc le chemin le plus probable. */
      async envoyerWhatsApp() {
        return false
      },
      async envoyerSms() {
        throw new Error('un refus WhatsApp ne doit pas se replier sur le SMS')
      },
      async envoyerEmail() {
        return false
      },
    })

    await relancer(parkId, leaseId, cookie)

    const trace = await traceDe(parkId)
    /* LE CANAL ÉCRIT EST LE CANAL EMPRUNTÉ, jamais celui voulu. Écrire
       `whatsapp` ici ferait croire à un envoi le jour où un locataire
       contestera avoir été prévenu — le seul jour où cette trace sert. */
    expect(trace.channel).toBe('in_app')
    expect(trace.sentAt).toBeNull()
  })

  it('EMPRUNTE LE SMS tant que le parc n’a rien réglé', async () => {
    const { cookie, parkId, leaseId } = await parcEnRetard()

    const vers: string[] = []
    rendre = remplacerMessagerie({
      async envoyerWhatsApp() {
        throw new Error('un parc non réglé ne doit pas emprunter WhatsApp')
      },
      async envoyerSms(destinataire) {
        vers.push(destinataire)
        return true
      },
      async envoyerEmail() {
        return false
      },
    })

    await relancer(parkId, leaseId, cookie)

    /* LE DÉFAUT EST EXACTEMENT L'ANCIEN COMPORTEMENT. Aucun parc ne change de
       canal le jour où le réglage apparaît — c'est ce que la migration affirme
       des lignes déjà en base, et ce cas le vérifie plutôt que le supposer. */
    expect(vers).toEqual(['+237677214408'])
    expect((await traceDe(parkId)).channel).toBe('sms')
  })

  it('REFUSE DE RÉGLER LE CANAL SUR `in_app` ou sur `email`', async () => {
    const { cookie, parkId } = await parcEnRetard()

    for (const canal of ['in_app', 'email'] as const) {
      const refus = await request(serveur)
        .patch(`/api/parks/${parkId}`)
        .set('Cookie', cookie)
        .send({ reminderChannel: canal })
      expect(refus.status, canal).toBe(400)
    }

    /* ET `whatsapp` PASSE — sans cette moitié, le cas serait vert sur une route
       qui refuse tout. */
    const accepte = await request(serveur)
      .patch(`/api/parks/${parkId}`)
      .set('Cookie', cookie)
      .send({ reminderChannel: 'whatsapp' })
    expect(accepte.status, JSON.stringify(accepte.body)).toBe(200)
    const parc = await prisma.park.findUniqueOrThrow({
      where: { id: parkId },
      select: { reminderChannel: true },
    })
    expect(parc.reminderChannel).toBe('whatsapp')
  })
})
