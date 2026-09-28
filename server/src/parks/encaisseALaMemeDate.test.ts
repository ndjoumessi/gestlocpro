import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * CHAQUE MOIS PORTE DEUX TOTAUX, ET LE SECOND EST CE QUI REND LA COMPARAISON
 * HONNÊTE.
 *
 * ═══ LE DÉFAUT ═══
 *
 * Le dernier mois de `collections` est le mois COURANT — le tableau de bord le
 * hachure et écrit « encore ouvert ». Sa carte d'encaissement le comparait
 * pourtant au TOTAL du mois précédent, c'est-à-dire un mois entamé à un mois
 * complet. La pastille annonçait donc une baisse TOUS LES MOIS, maximale le 3,
 * sur un parc qui va parfaitement bien. Mesuré sur la démonstration au
 * 28 septembre 2026 : « −24 % vs 1 250 000 le mois dernier », en rouge, alors
 * que les loyers du mois étaient déjà rentrés.
 *
 * ═══ CE QUE LA ROUTE REND MAINTENANT ═══
 *
 * `rentToDate` : ce que le mois avait encaissé AU MÊME JOUR DU MOIS
 * qu'aujourd'hui. Les versements se filtrent par leur jour, ils ne se
 * proratisent pas — le loyer n'arrive pas régulièrement mais dans les premiers
 * jours, et un prorata fabriquerait un nombre au lieu d'en mesurer un.
 *
 * ═══ POURQUOI CE FICHIER NE FIXE AUCUNE DATE ═══
 *
 * Il tourne un jour quelconque du mois. Les deux versements se posent donc
 * RELATIVEMENT à ce jour : l'un au 1er, toujours écoulé ; l'autre au lendemain
 * du jour courant, jamais écoulé — sauf le 31, où il n'existe pas de lendemain
 * dans le mois et où le total entier EST la réponse juste. Ce cas-limite se
 * déclare plutôt que de se sauter : un `it` sauté un jour sur trente et un est
 * un vert qu'on n'a pas gagné.
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

/**
 * Le mois de comparaison : JANVIER, choisi pour ses 31 jours.
 *
 * Un mois court ne peut pas porter un versement au 30, et le cas perdrait son
 * versement « non écoulé » un tiers de l'année sans que rien ne le dise.
 */
const MOIS = '2026-01'
const JOUR_COURANT = new Date().getDate()
/** Le lendemain d'aujourd'hui, borné au mois. Égal au jour courant le 31. */
const JOUR_TARDIF = Math.min(JOUR_COURANT + 1, 31)
/** Vrai le 31 seulement : plus aucun jour du mois ne reste à venir. */
const MOIS_ENTIEREMENT_ECOULE = JOUR_TARDIF <= JOUR_COURANT

const TOT = 30000
const TARD = 25000

async function parcAvecDeuxVersements() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Djoumessi Nelson',
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
    .send({ name: 'Residence Djoumessi', district: 'Bastos' })
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekonoo Landry', phoneE164: '+237690000001', startsOn: '2025-12-01' })

  /* DEUX VERSEMENTS SUR LA MÊME PÉRIODE, de part et d'autre du jour courant.
     Un seul ne distinguerait rien : c'est leur ÉCART qui porte la règle. */
  const jj = (j: number) => String(j).padStart(2, '0')
  for (const [montant, jour] of [
    [TOT, 1],
    [TARD, JOUR_TARDIF],
  ] as const) {
    const reponse = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({
        unitId,
        periodStart: `${MOIS}-01`,
        amountMinor: montant,
        method: 'cash',
        paidOn: `${MOIS}-${jj(jour)}`,
      })
    expect(reponse.status, `versement du ${jour} refusé — ${JSON.stringify(reponse.body)}`).toBe(201)
  }

  return { cookie, parkId }
}

async function moisDeJanvier(cookie: string, parkId: string) {
  const vue = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
  expect(vue.status).toBe(200)
  const mois = (vue.body.collections as { year: number; month: number; rent: number; rentToDate: number }[]).find(
    (m) => m.year === 2026 && m.month === 0,
  )
  if (!mois) throw new Error(`janvier absent de la série — ${JSON.stringify(vue.body.collections)}`)
  return mois
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('l’encaissé du mois à la même date', () => {
  it('écarte le versement qui n’est pas encore écoulé', async () => {
    const { cookie, parkId } = await parcAvecDeuxVersements()
    const janvier = await moisDeJanvier(cookie, parkId)

    expect(janvier.rent, 'le total du mois a changé — il doit rester la somme des DEUX versements').toBe(TOT + TARD)

    if (MOIS_ENTIEREMENT_ECOULE) {
      /* LE 31 : plus rien ne reste à venir, et les deux totaux se rejoignent.
         C'est la réponse juste, pas une tolérance. */
      expect(
        janvier.rentToDate,
        'le 31, tout le mois est écoulé : les deux totaux doivent coïncider',
      ).toBe(TOT + TARD)
    } else {
      expect(
        janvier.rentToDate,
        `le versement du ${JOUR_TARDIF} est compté alors que nous ne sommes que le ${JOUR_COURANT} : la base compare un mois entamé à un mois entier`,
      ).toBe(TOT)
    }
  })

  it('ne dépasse jamais le total du mois', async () => {
    /* L'INVARIANT QUI TIENT TOUS LES JOURS, y compris le 31 où le cas
       précédent bascule sur son autre branche. Un `rentToDate` supérieur au
       total signifierait qu'on compte deux fois, et la pastille annoncerait
       alors une hausse imaginaire. */
    const { cookie, parkId } = await parcAvecDeuxVersements()
    const janvier = await moisDeJanvier(cookie, parkId)
    expect(janvier.rentToDate).toBeLessThanOrEqual(janvier.rent)
  })
})
