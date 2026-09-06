import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * « LE STATUT PORTE SUR LE MOIS AFFICHÉ » — ET AUCUN MOIS NE S'AFFICHAIT.
 *
 * L'écran du parc annonce cette phrase en sous-titre depuis son écriture. Cette
 * route rendait TOUJOURS la dernière échéance de chaque bail — `orderBy
 * periodStart desc, take 1` — et rien, nulle part, ne permettait d'en demander
 * une autre. La page nommait une dimension qu'elle ne donnait pas.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * 1. Le mois demandé CHOISIT l'échéance. Deux mois, deux réponses : c'est la
 *    seule preuve que le paramètre agit, et non qu'il est ignoré poliment.
 * 2. Un mois SANS échéance rend `uncalled` — « rien n'a été appelé » — et non
 *    `paid` par accident d'une liste vide.
 * 3. Le retard se compte depuis AUJOURD'HUI, jamais depuis le mois consulté.
 *    Une dette de mai est réelle en septembre, et son âge est ce qu'on vient
 *    chercher. Le figer à la fin du mois rendrait un retard qui cesse de
 *    grandir — le défaut que `statut` évite déjà en refusant de le STOCKER.
 * 4. Absent, rien ne change : la dernière échéance, comme avant. Les autres
 *    appelants de cette projection n'ont pas à connaître ce paramètre.
 * 5. Un mois malformé est REFUSÉ. Sans quoi `?mois=hier` produirait des bornes
 *    `Invalid Date`, que Prisma compare sans rien trouver : la route rendrait
 *    « aucune échéance » pour une faute de frappe, ce qui se lit comme « le
 *    locataire n'a rien à payer ».
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

/**
 * UN BAIL, DEUX ÉCHÉANCES, DEUX SORTS DIFFÉRENTS.
 *
 * Mars est SOLDÉE, avril est IMPAYÉE et due depuis longtemps. C'est ce couple
 * qui fait les cas : un jeu où les deux mois se ressembleraient laisserait
 * passer une route qui ignore le paramètre.
 */
async function unParcAvecDeuxEcheances() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Nelson D',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const parkId = (await prisma.park.findFirstOrThrow()).id

  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Résidence Deux Mois', district: 'Bastos' })
  const buildingId = immeuble.body.building.id as string

  const logement = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 45, baseRentMinor: 185000 })
  const unitId = logement.body.unit.id as string

  const bail = await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({
      fullName: 'Charles Ngassa',
      phoneE164: '+237677214408',
      unitId,
      rentMinor: 185000,
      startsOn: '2026-01-01',
      dueDayOfMonth: 5,
    })
  expect(bail.status).toBe(201)
  const leaseId = (await prisma.lease.findFirstOrThrow({ where: { unitId } })).id

  /* Écrites directement : ce cas mesure la LECTURE par mois, et passer par les
     routes d'appel de loyer ferait dépendre son jeu de leur calendrier. */
  const mars = await prisma.rentCharge.create({
    data: {
      leaseId,
      periodStart: new Date(Date.UTC(2026, 2, 1)),
      dueOn: new Date(Date.UTC(2026, 2, 5)),
      rentMinor: 185000,
      waterMinor: 0,
      powerMinor: 0,
    },
  })
  await prisma.payment.create({
    data: {
      chargeId: mars.id,
      amountMinor: 185000,
      currency: 'XAF',
      method: 'cash',
      paidOn: new Date(Date.UTC(2026, 2, 4)),
      recordedById: (await prisma.userAccount.findFirstOrThrow()).id,
    },
  })
  await prisma.rentCharge.create({
    data: {
      leaseId,
      periodStart: new Date(Date.UTC(2026, 3, 1)),
      dueOn: new Date(Date.UTC(2026, 3, 5)),
      rentMinor: 185000,
      waterMinor: 0,
      powerMinor: 0,
    },
  })

  return { cookie, parkId }
}

/** Le premier logement du portefeuille, pour le mois demandé. */
async function logementAuMois(parkId: string, cookie: string, mois?: string) {
  const res = await request(serveur)
    .get(`/api/parks/${parkId}/portfolio${mois ? `?mois=${mois}` : ''}`)
    .set('Cookie', cookie)
  expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(200)
  return res.body.buildings[0].units[0] as {
    status: string
    paidMinor: number
    overdueDays: number | null
  }
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

describe('le portefeuille par mois', () => {
  it('choisit l’échéance du mois demandé', async () => {
    const { cookie, parkId } = await unParcAvecDeuxEcheances()

    const mars = await logementAuMois(parkId, cookie, '2026-03')
    expect(mars.status, 'mars est soldée').toBe('paid')
    expect(mars.paidMinor).toBe(185000)

    /* LE MÊME LOGEMENT, L'AUTRE MOIS. Deux réponses différentes : c'est la seule
       preuve que le paramètre AGIT, et non qu'il est reçu puis ignoré. */
    const avril = await logementAuMois(parkId, cookie, '2026-04')
    expect(avril.status, 'avril n’est pas réglée').toBe('overdue')
    expect(avril.paidMinor).toBe(0)
  })

  it('rend « non appelé » sur un mois sans échéance', async () => {
    const { cookie, parkId } = await unParcAvecDeuxEcheances()

    /* Février précède les deux échéances. `uncalled` et non `paid` : une liste
       vide ne veut pas dire que tout est réglé, elle veut dire qu'on n'a rien
       appelé — la distinction que `statut` porte en toutes lettres. */
    const fevrier = await logementAuMois(parkId, cookie, '2026-02')
    expect(fevrier.status).toBe('uncalled')
    expect(fevrier.paidMinor).toBe(0)
  })

  it('compte le retard depuis AUJOURD’HUI, pas depuis le mois consulté', async () => {
    const { cookie, parkId } = await unParcAvecDeuxEcheances()

    const avril = await logementAuMois(parkId, cookie, '2026-04')
    /*
      L'échéance était due le 5 avril 2026. Le retard doit donc valoir ce que
      le calendrier dit AUJOURD'HUI — largement plus qu'un mois — et non la
      distance à la fin d'avril. Une dette ne cesse pas de vieillir parce qu'on
      regarde son mois d'origine.
    */
    const attendu = Math.floor(
      (Date.now() - Date.UTC(2026, 3, 5)) / 86_400_000,
    )
    expect(avril.overdueDays).toBe(attendu)
  })

  it('rend la DERNIÈRE échéance quand aucun mois n’est demandé', async () => {
    const { cookie, parkId } = await unParcAvecDeuxEcheances()

    /* Le comportement d'avant ce lot, inchangé : les autres appelants de cette
       projection — l'espace du locataire, le tableau de bord — n'ont pas à
       connaître ce paramètre. Avril est la plus récente des deux. */
    const sansMois = await logementAuMois(parkId, cookie)
    expect(sansMois.status).toBe('overdue')
  })

  it('refuse un mois malformé, plutôt que de le lire comme un mois vide', async () => {
    const { cookie, parkId } = await unParcAvecDeuxEcheances()

    for (const faux of ['hier', '2026-13', '2026', '202603']) {
      const res = await request(serveur)
        .get(`/api/parks/${parkId}/portfolio?mois=${faux}`)
        .set('Cookie', cookie)
      /*
        400 ET NON UN MOIS VIDE. Des bornes `Invalid Date` se comparent sans
        rien trouver : la route rendrait « aucune échéance » pour une faute de
        frappe, et l'écran l'afficherait comme « rien n'a été appelé ». Un
        paramètre illisible doit se dire, pas se deviner.
      */
      expect(res.status, `« ${faux} » doit être refusé`).toBe(400)
    }
  })
})
