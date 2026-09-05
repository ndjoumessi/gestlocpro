import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * « EN ATTENTE » DISAIT DEUX CHOSES DIFFÉRENTES, ET UNE TROISIÈME À LA LECTURE.
 *
 * ═══ CE QUI A ÉTÉ DEMANDÉ, ET C'ÉTAIT LÉGITIME ═══
 *
 * « Pourquoi le statut de BEKONO LANDRY est-il toujours en attente, alors qu'il
 * a déjà un compte ? » — capture de la production à l'appui.
 *
 * Le statut était JUSTE : `dueDayOfMonth` vaut 5, l'échéance de septembre était
 * donc due le 5, et la question se posait le 5 au petit matin. Rien de versé,
 * rien en retard : `pending`.
 *
 * Mais rien sur cet écran ne disait de QUOI ce statut parlait. Sa colonne
 * s'appelait « Statut » ; la bannière juste au-dessus parlait de COMPTES, et la
 * ligne voisine portait un badge « Sans compte ». Lire « en attente d'un
 * compte » n'était pas une méprise du lecteur : c'est ce que la page proposait.
 *
 * ═══ ET LE MOT RECOUVRAIT DEUX ÉTATS ═══
 *
 *     aucune échéance appelée        → `pending`
 *     échéance appelée, non due      → `pending`
 *
 * Un bailleur ne pouvait pas distinguer « je n'ai rien appelé » de « c'est
 * appelé, ça arrive ». Le premier appelle un geste — appeler les loyers —, le
 * second appelle d'attendre. Le même mot pour les deux fait rater le geste.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * La séparation, dans les deux sens, sur une échéance dont la date est POSÉE et
 * non déduite du jour : un cas qui dépend de la date du jour passe onze mois sur
 * douze et ment le douzième.
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

/** Un parc, un logement, un bail — et AUCUNE échéance appelée. */
async function parcAvecUnBail() {
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

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId: a1.body.unit.id, fullName: 'Bekono Landry', startsOn: '2026-01-01' })

  return { cookie, parkId, unitId: a1.body.unit.id as string }
}

/** Le logement A1, tel que le portefeuille le rend. */
async function logement(cookie: string, parkId: string) {
  const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.buildings[0].units[0] as { status: string; paidMinor: number }
}

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

describe('le loyer du mois dit s’il a été appelé', () => {
  it('rend « non appelé » quand aucune échéance n’existe', async () => {
    const { cookie, parkId } = await parcAvecUnBail()

    expect(
      (await logement(cookie, parkId)).status,
      'un bail sans échéance se disait « en attente », comme un loyer appelé qui arrive',
    ).toBe('uncalled')
  })

  it('rend « en attente » quand l’échéance est appelée et pas encore due', async () => {
    const { cookie, parkId } = await parcAvecUnBail()
    const bail = await prisma.lease.findFirstOrThrow({ select: { id: true, rentMinor: true } })
    /* UNE DATE POSÉE, ET LOIN : un cas calé sur le jour courant passerait onze
       mois sur douze. Ce qu'on éprouve est la RÈGLE, pas le calendrier. */
    const dans30Jours = new Date(Date.now() + 30 * 86_400_000)
    await prisma.rentCharge.create({
      data: {
        leaseId: bail.id,
        periodStart: dans30Jours,
        dueOn: dans30Jours,
        rentMinor: bail.rentMinor,
      },
    })

    expect((await logement(cookie, parkId)).status).toBe('pending')
  })

  it('rend « en retard » quand l’échéance est passée et rien n’est versé', async () => {
    /* L'AUTRE BORNE, sans quoi « non appelé » pourrait avaler le retard. */
    const { cookie, parkId } = await parcAvecUnBail()
    const bail = await prisma.lease.findFirstOrThrow({ select: { id: true, rentMinor: true } })
    const ilYA30Jours = new Date(Date.now() - 30 * 86_400_000)
    await prisma.rentCharge.create({
      data: {
        leaseId: bail.id,
        periodStart: ilYA30Jours,
        dueOn: ilYA30Jours,
        rentMinor: bail.rentMinor,
      },
    })

    expect((await logement(cookie, parkId)).status).toBe('overdue')
  })
})
