import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * L'INVENTAIRE DE `?mois=`, EXÉCUTABLE PLUTÔT QU'ÉCRIT.
 *
 * Le lot qui a découplé la série des relevés a fermé son message sur une dette
 * nommée : « personne n'a relu la réponse entière en se demandant, champ par
 * champ, lequel est une vue et lequel est une histoire. Ce lot en a corrigé
 * un ; il n'a pas fait l'inventaire. » Ce fichier est cet inventaire.
 *
 * ═══ LA RÈGLE QUI CLASSE ═══
 *
 * `?mois=` désigne une VUE, jamais un droit et jamais une histoire :
 *
 *   — UNE VUE répond à « où en était-on ce mois-là ? » et suit le paramètre.
 *     Deux champs, et deux seulement : l'échéance retenue par bail — celle qui
 *     rend vraie la promesse « le statut porte sur le mois affiché » — et le
 *     tableau des relevés.
 *   — UNE HISTOIRE répond à « comment est-ce arrivé ? » et l'ignore.
 *     `collections`, `leaseCharges`, `readingHistory` : trois séries, dont
 *     deux que le tableau de bord et l'espace du locataire dessinent sur douze
 *     mois. Une histoire tronquée par la vue d'à côté n'est plus une histoire.
 *   — LE RESTE N'A PAS DE PÉRIODE : `scoped`, `accessUntil`, `leases`,
 *     `documentRequests`, `inspections`, `notifications`, `works`, `deposits`.
 *
 * ═══ POURQUOI UN CAS ET NON UN COMMENTAIRE ═══
 *
 * Une prose d'inventaire vieillit en silence : le champ ajouté demain ne sera
 * pas dans la liste, et rien ne le dira. Ce cas, lui, compare DEUX réponses —
 * avec et sans `mois` — et exige qu'elles soient identiques PARTOUT sauf sur
 * les deux vues déclarées. Un treizième champ qui se mettrait à suivre le
 * paramètre fera rougir ce fichier sans que personne ait à y penser.
 *
 * ET IL ATTRAPE LES DEUX SENS. Une histoire qui se met à suivre le mois rougit
 * — c'est le défaut d'hier. Une vue qui cesserait de le suivre rougit aussi :
 * les deux derniers cas l'exigent nommément.
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

/** Un parc avec DEUX mois d'échéances et deux mois de relevés. */
async function parcSurDeuxMois() {
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
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({
      unitId,
      fullName: 'Bekonoo Landry',
      phoneE164: '+237690000001',
      startsOn: '2026-01-01',
    })
  await request(serveur)
    .post(`/api/parks/${parkId}/tariffs`)
    .set('Cookie', cookie)
    .send({ utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-01-01' })

  for (const [periode, index] of [
    ['2026-06-01', 100],
    ['2026-07-01', 120],
    ['2026-08-01', 145],
  ] as const) {
    await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/readings`)
      .set('Cookie', cookie)
      .send({ utility: 'water', periodStart: periode, indexValue: index, readAt: periode })
    /* L'appel de loyers écrit l'échéance de la période : sans elle, `charges`
       serait vide des deux côtés et le premier cas passerait sans rien voir. */
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: periode })
  }

  return { cookie, parkId }
}

/**
 * Les seuls champs qui ont le DROIT de suivre `?mois=`.
 *
 * LA VUE 1 N'EST PAS UN CHAMP, C'EST UN TRIPLET. La réponse n'expose aucune
 * `charges` : elle APLATIT l'échéance retenue en `status`, `paidMinor` et
 * `overdueDays` par logement — c'est `statut(echeance, aujourdhui)` qui les
 * calcule. Ma première rédaction masquait `leases[].charges`, un chemin qui
 * n'existe pas dans la réponse ; le cas a rougi sur `buildings` et m'a envoyé
 * relire la projection. C'est précisément le service qu'on attend d'un
 * inventaire exécutable : il connaît la forme réelle, pas celle qu'on croit.
 *
 * `overdueDays` EN FAIT PARTIE, et c'est subtil : il se compte depuis
 * AUJOURD'HUI et non depuis le mois — la route l'écrit, « la dette est réelle
 * MAINTENANT » — mais il varie quand même avec `?mois=`, puisque c'est une
 * AUTRE échéance qu'on mesure. La date de référence ne bouge pas ; la ligne
 * mesurée, si.
 */
function sansLesDeuxVues(corps: Record<string, unknown>): Record<string, unknown> {
  const copie = JSON.parse(JSON.stringify(corps)) as Record<string, unknown> & {
    buildings?: { units?: Record<string, unknown>[] }[]
    readings?: unknown
  }
  for (const immeuble of copie.buildings ?? []) {
    for (const unite of immeuble.units ?? []) {
      unite.status = '(vue du mois)'
      unite.paidMinor = '(vue du mois)'
      unite.overdueDays = '(vue du mois)'
    }
  }
  /* LA VUE 2 — le tableau des relevés. */
  copie.readings = '(vue du mois)'
  return copie
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('l’inventaire de `?mois=`', () => {
  it('ne fait varier QUE les deux vues déclarées', async () => {
    const { cookie, parkId } = await parcSurDeuxMois()
    const avec = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio?mois=2026-06`)
      .set('Cookie', cookie)
    const sans = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    expect(avec.status).toBe(200)
    expect(sans.status).toBe(200)

    /*
      LE CAS QUI VAUT LE FICHIER, et il se lit à l'envers : tout ce qui n'est
      pas nommé comme une vue DOIT être identique. Un champ ajouté demain qui
      se mettrait à suivre le mois rougira ici sans que personne y ait pensé —
      c'est ce qu'une prose d'inventaire ne sait pas faire.
    */
    const a = sansLesDeuxVues(avec.body)
    const b = sansLesDeuxVues(sans.body)
    /* CHAMP PAR CHAMP, et non d'un bloc : un `toEqual` sur l'objet entier
       rendrait « expected {…13} to deeply equal {…13} » et laisserait le
       lecteur chercher. La liste des champs qui varient EST le rapport
       d'inventaire. */
    const varient = Object.keys(b).filter(
      (cle) => JSON.stringify(a[cle]) !== JSON.stringify(b[cle]),
    )
    expect(varient, 'ces champs suivent `?mois=` sans être déclarés comme des vues').toEqual([])
  })

  it('garde les trois séries entières — ce sont des histoires', async () => {
    const { cookie, parkId } = await parcSurDeuxMois()
    const avec = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio?mois=2026-06`)
      .set('Cookie', cookie)

    /* Le mois demandé est le PREMIER des trois : une série qui le suivrait
       perdrait donc les deux tiers de sa longueur, ce qu'aucune moyenne ne
       rattrape. */
    const corps = avec.body as {
      collections: unknown[]
      leaseCharges: unknown[]
      readingHistory: unknown[]
    }
    expect(corps.collections.length, 'les encaissements, sur trois périodes').toBe(3)
    expect(corps.leaseCharges.length, 'les échéances, sur trois périodes').toBe(3)
    expect(corps.readingHistory.length, 'les relevés, sur trois périodes').toBe(3)
  })

  it('fait bien varier la vue des relevés — sinon le paramètre ne sert à rien', async () => {
    const { cookie, parkId } = await parcSurDeuxMois()
    const juin = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio?mois=2026-06`)
      .set('Cookie', cookie)
    const dernier = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)

    const eau = (corps: { readings: { utility: string; indexValue: number | null }[] }) =>
      corps.readings.find((r) => r.utility === 'water')?.indexValue
    expect(eau(juin.body), 'juin est la période demandée').toBe(100)
    expect(eau(dernier.body), 'et août la dernière relevée').toBe(145)
  })

  it('fait bien varier l’échéance retenue — la promesse du sous-titre', async () => {
    const { cookie, parkId } = await parcSurDeuxMois()
    /* L'échéance retenue n'est lisible qu'à travers ce qu'elle PRODUIT : la
       réponse ne rend pas la ligne, elle rend son verdict. `paidMinor` est
       celui de la période choisie — juin est soldé par l'appel, août ne l'est
       pas encore au moment du cas. */
    const soldeDe = (corps: {
      buildings: { units: { status: string; paidMinor: number }[] }[]
    }) => corps.buildings[0]?.units[0]?.status

    const juin = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio?mois=2026-06`)
      .set('Cookie', cookie)
    const dernier = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)

    /* Les deux vues sont calculées sur des échéances DIFFÉRENTES : juin est
       en retard depuis longtemps, août l'est de quelques jours ou pas encore.
       Le cas n'affirme donc pas un libellé — il exige que le triplet ne soit
       pas le MÊME objet des deux côtés, ce qui est la seule chose que ce
       fichier ait à garder ici. */
    const triplet = (corps: {
      buildings: { units: { status: string; paidMinor: number; overdueDays: number | null }[] }[]
    }) => JSON.stringify(corps.buildings[0]?.units[0])
    expect(soldeDe(juin.body), 'un logement loué a un statut').toBeTruthy()
    expect(triplet(juin.body)).not.toBe(triplet(dernier.body))
  })
})
