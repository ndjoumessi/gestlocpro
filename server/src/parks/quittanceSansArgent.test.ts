import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UNE PIÈCE QUI ATTESTE ZÉRO N'ATTESTE RIEN.
 *
 * ═══ CE QUI SORTAIT DU LOGICIEL ═══
 *
 * Relevé sur le registre des décisions d'un parc réel, le 2026-09-05 :
 *
 *     03/09  Quittance émise · Reçu de paiement · Septembre 2026 · 0 FCFA
 *     02/09  Quittance émise · Reçu de paiement · Septembre 2026 · 0 FCFA
 *     02/09  Quittance émise · Reçu de paiement · Septembre 2026 · 0 FCFA
 *     02/09  Quittance émise · Reçu de paiement · Septembre 2026 · 0 FCFA
 *
 * La route refusait déjà de fabriquer un document quand AUCUNE ÉCHÉANCE
 * n'existe — « on ne fabrique pas un document vide, qui laisserait croire à un
 * mois traité ». Elle ne refusait pas quand RIEN N'A ÉTÉ REÇU.
 *
 * Or ce papier part chez un locataire et porte la signature du bailleur. Un reçu
 * de zéro ne prouve rien, ne se conteste pas, et brouille la seule chose qu'une
 * pièce sait faire : dire ce qui est arrivé.
 *
 * ═══ CE QUE LE PRODUIT OFFRE À LA PLACE, ET IL L'OFFRE DÉJÀ ═══
 *
 * Réclamer un impayé n'est pas attester un paiement : c'est la relance, et la
 * mise en demeure — `rent.remind` et `lease.formal_notice`, tous deux au
 * registre. Refuser ici ne ferme donc aucun chemin ; cela renvoie au bon.
 *
 * ═══ LA BORNE EST « REÇU », PAS « SOLDÉ » ═══
 *
 * Un règlement PARTIEL doit continuer de s'attester : c'est même le cas où la
 * pièce compte le plus, puisque le locataire a payé sans être quitte. La règle
 * porte donc sur `paidMinor === 0`, jamais sur le solde.
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

/** Un parc, un logement, un bail — et une échéance appelée mais non réglée. */
async function parcAvecUneEcheanceImpayee(montant = 0) {
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

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekono Landry', startsOn: '2026-01-01' })

  /* L'ÉCHÉANCE EXISTE : c'est tout l'enjeu. Sans elle, la route rend 404 depuis
     toujours, et ce fichier ne mesurerait qu'un refus déjà écrit. Un versement
     de zéro n'étant pas acceptable, on passe par la base. */
  const bail = await prisma.lease.findFirstOrThrow({ select: { id: true, rentMinor: true } })
  const echeance = await prisma.rentCharge.create({
    data: {
      leaseId: bail.id,
      periodStart: new Date('2026-07-01T00:00:00Z'),
      dueOn: new Date('2026-07-05T00:00:00Z'),
      rentMinor: bail.rentMinor,
    },
  })
  if (montant > 0) {
    await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: montant, method: 'mobile' })
  }
  return { cookie, parkId, unitId, echeanceId: echeance.id }
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

describe('une pièce n’atteste que de l’argent reçu', () => {
  it('refuse d’émettre quand RIEN n’a été reçu', async () => {
    const { cookie, parkId, unitId } = await parcAvecUneEcheanceImpayee()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.error).toBe('nothing_received')
  })

  it('ne consigne AUCUNE émission quand elle refuse', async () => {
    /* Le registre porte quatre « Reçu de paiement · 0 FCFA » sur la production.
       Un refus qui laisserait sa trace en fabriquerait un cinquième. */
    const { cookie, parkId, unitId } = await parcAvecUneEcheanceImpayee()

    await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(await prisma.auditEvent.count({ where: { parkId, action: 'receipt.issued' } })).toBe(0)
  })

  it('émet toujours un REÇU sur un règlement partiel', async () => {
    /* L'AUTRE SENS, et c'est le cas où la pièce compte le plus : le locataire a
       payé sans être quitte. La borne est « reçu », jamais « soldé ». */
    const { cookie, parkId, unitId } = await parcAvecUneEcheanceImpayee(10000)

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.document.kind).toBe('recu')
    expect(res.body.document.paidMinor).toBe(10000)
  })
})
