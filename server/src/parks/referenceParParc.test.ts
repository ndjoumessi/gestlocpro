import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * « SIG-2026-001 » APPARTIENT À UN PARC, PAS AU PRODUIT.
 *
 * ═══ LE DÉFAUT, RELEVÉ LE 2026-09-16 ═══
 *
 * `WorkOrder.reference` était unique GLOBALEMENT, et le compteur qui la
 * fabrique est par parc et par année (`WorkReferenceCounter`, clé
 * `[parkId, year]`). Le commentaire du schéma disait déjà « allouée par parc et
 * par année » ; la contrainte le démentait.
 *
 * Conséquence, reproduite par le geste réel du produit : le parc A ouvre son
 * premier signalement et obtient `SIG-2026-001` ; le parc B fait le même geste
 * et reçoit une ERREUR 500. Le premier signalement de tout nouveau client
 * échouait, et le second jeu de démonstration avec lui.
 *
 * Personne ne l'avait vu parce que la production n'a qu'un parc.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 *  1. DEUX PARCS PEUVENT PORTER LA MÊME RÉFÉRENCE. C'est le défaut lui-même,
 *     et le cas rejoue le geste du produit plutôt que d'écrire en base.
 *  2. UN MÊME PARC NE PEUT PAS LA RÉPÉTER. Sans ce second cas, retirer la
 *     contrainte sans rien mettre à la place passerait au vert — et deux
 *     signalements d'un même bailleur porteraient le même numéro.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`aucun cookie de session — ${res.status}`)
  return trouve
}

/** Un parc monté par les gestes du produit, avec un logement prêt à signaler. */
async function parcAvecUnLogement(email: string, nom: string) {
  const inscription = await request(serveur).post('/api/auth/signup').send({
    email,
    password: MDP,
    fullName: 'Djoumessi Nelson',
    confirmLegal: true,
    parkName: nom,
    countryCode: 'CM',
  })
  expect(inscription.status, JSON.stringify(inscription.body)).toBe(201)
  const cookie = cookieDe(inscription)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Résidence', district: 'Bastos' })
  const unite = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 50, baseRentMinor: 100000 })

  return { cookie, parkId, unitId: unite.body.unit.id as string }
}

const signaler = (parc: { cookie: string; parkId: string; unitId: string }, titre: string) =>
  request(serveur)
    .post(`/api/parks/${parc.parkId}/units/${parc.unitId}/works`)
    .set('Cookie', parc.cookie)
    .send({ title: titre, trade: 'plumbing', urgency: 'normal' })

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

describe('la référence d’un signalement', () => {
  it('se répète d’un parc à l’autre, sans gêner personne', async () => {
    const premier = await parcAvecUnLogement('premier@example.com', 'Parc premier')
    const second = await parcAvecUnLogement('second@example.com', 'Parc second')

    const a = await signaler(premier, 'Fuite sous l’évier')
    expect(a.status, JSON.stringify(a.body)).toBe(201)

    /* LE GESTE QUI RENDAIT 500. Un bailleur qui vient de s'inscrire déclare son
       premier signalement : il n'a aucune raison d'échouer parce qu'un AUTRE
       parc en a déclaré un avant lui. */
    const b = await signaler(second, 'Volet cassé')
    expect(b.status, JSON.stringify(b.body)).toBe(201)

    expect(a.body.work.reference).toBe(b.body.work.reference)
  })

  it('ne se répète pas DANS un parc', async () => {
    const parc = await parcAvecUnLogement('premier@example.com', 'Parc premier')

    const a = await signaler(parc, 'Fuite sous l’évier')
    const b = await signaler(parc, 'Volet cassé')
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(a.body.work.reference).not.toBe(b.body.work.reference)
  })

  it('laisse le second parc semer sa démonstration', async () => {
    const commun = {
      password: MDP,
      fullName: 'Djoumessi Nelson',
      confirmLegal: true,
      countryCode: 'CM',
      seedDemo: true,
    }
    const a = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...commun, email: 'demo-a@example.com', parkName: 'Parc A' })
    const b = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...commun, email: 'demo-b@example.com', parkName: 'Parc B' })

    expect(a.status).toBe(201)
    /* Le jeu de démonstration ouvre plusieurs interventions : c'est le même
       défaut, vu par le chemin qui l'a révélé. */
    expect(b.status, JSON.stringify(b.body)).toBe(201)
    expect(await prisma.workOrder.count()).toBeGreaterThan(2)
  })
})
