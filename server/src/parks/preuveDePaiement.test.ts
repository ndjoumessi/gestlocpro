import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { NOM_COOKIE } from '../auth/session.js'
import { leStockage, remplacerStockage } from '../stockage/stockage.js'
import { StockageLocal } from '../stockage/local.js'

/**
 * LA PREUVE D'UN PAIEMENT, ET LES TROIS CHOSES QUE LA BASE NE TIENT PAS.
 *
 * ═══ CE QUE CETTE TABLE CORRIGE ═══
 *
 * `Payment` portait une `reference` et une `note`, en texte. Sur les marchés
 * visés, la pièce réellement échangée n'est pas la référence : c'est la CAPTURE
 * D'ÉCRAN du transfert mobile. Le produit demandait de recopier à la main un
 * numéro lu sur une image qui continuait de circuler ailleurs — et c'est cette
 * image, pas le numéro, qu'un locataire produit quand il conteste.
 *
 * ═══ LES TROIS RÈGLES ═══
 *
 *   1. UNE PREUVE NON CONFIRMÉE N'EST PAS SERVIE. La ligne naît avant les octets
 *      — le dépôt ne passe pas par l'API — et entre les deux elle existe sans
 *      rien prouver. La servir rendrait une adresse vers le vide.
 *   2. LE LOCATAIRE LIT LA SIENNE, et elle seule. C'est le point de la table :
 *      la preuve est ce qu'il produit le jour où l'encaissement est contesté.
 *      Celle du voisin doit rendre 404, pas 403.
 *   3. LE RETRAIT EMPORTE LES OCTETS, et laisse la trace. Rien d'autre ne dira
 *      ensuite qu'une pièce avait été versée puis reprise.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'
const T0 = new Date('2026-09-30T08:00:00.000Z').getTime()

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`inscription sans cookie — ${res.status}`)
  return trouve
}

/** Un JPEG minimal : le dépôt regarde l'en-tête, pas le contenu. */
function unJpeg(): Uint8Array {
  const octets = new Uint8Array(64)
  octets.set([0xff, 0xd8, 0xff], 0)
  return octets
}

let racine: string
let restaurerStockage: () => void

async function parcAvecUnPaiement() {
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
    .send({ unitId, fullName: 'Serge Mbarga', depositMinor: 200000, startsOn: '2026-01-01' })
  await request(serveur)
    .post(`/api/parks/${parkId}/charges`)
    .set('Cookie', cookie)
    .send({ periodStart: '2026-02-01' })

  const echeance = await prisma.rentCharge.findFirstOrThrow({
    where: { lease: { unitId } },
    select: { id: true },
    orderBy: { dueOn: 'asc' },
  })
  const paiement = await prisma.payment.create({
    data: {
      chargeId: echeance.id,
      amountMinor: 70000,
      currency: 'XAF',
      method: 'mobile',
      paidOn: new Date('2026-02-05T00:00:00.000Z'),
    },
    select: { id: true },
  })
  return { cookie, parkId, unitId, paymentId: paiement.id }
}

/** Réserve, dépose, confirme — le contrat en deux temps, en une fonction. */
async function joindreUnePreuve(parkId: string, paymentId: string, cookie: string) {
  const reservation = await request(serveur)
    .post(`/api/parks/${parkId}/payments/${paymentId}/proofs`)
    .set('Cookie', cookie)
    .send({ contentType: 'image/jpeg', sizeBytes: 64 })
  const proofId = reservation.body.proof.id as string
  /* LES OCTETS PASSENT PAR L'ADRESSE SIGNÉE, comme en production : le contrat du
     stockage n'expose pas d'écriture directe, et c'est voulu — le dépôt ne passe
     pas par l'API. Première rédaction : un `leStockage().deposer(…)` qui n'existe
     pas, et que `tsc` a refusé avant toute exécution. */
  await request(serveur)
    .put(reservation.body.envoi.url)
    .set(reservation.body.envoi.entetes)
    .send(Buffer.from(unJpeg()))
  const confirmation = await request(serveur)
    .post(`/api/parks/${parkId}/payment-proofs/${proofId}/confirmation`)
    .set('Cookie', cookie)
  return { proofId, reservation, confirmation }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  racine = await mkdtemp(join(tmpdir(), 'gestlocpro-preuves-'))
  restaurerStockage = remplacerStockage(new StockageLocal(racine, env.SESSION_SECRET, () => T0))
})

afterEach(async () => {
  restaurerStockage()
  await rm(racine, { recursive: true, force: true })
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('la preuve d’un paiement', () => {
  it('N’EST PAS SERVIE TANT QU’ELLE N’EST PAS CONFIRMÉE', async () => {
    const { cookie, parkId, paymentId } = await parcAvecUnPaiement()

    const reservation = await request(serveur)
      .post(`/api/parks/${parkId}/payments/${paymentId}/proofs`)
      .set('Cookie', cookie)
      .send({ contentType: 'image/jpeg', sizeBytes: 64 })
    expect(reservation.status, JSON.stringify(reservation.body)).toBe(201)
    const proofId = reservation.body.proof.id as string

    /* LA LIGNE EXISTE ET NE PROUVE RIEN : les octets ne sont pas montés. La
       servir rendrait une adresse vers le vide. */
    const avant = await request(serveur)
      .get(`/api/parks/${parkId}/payment-proofs/${proofId}`)
      .set('Cookie', cookie)
    expect(avant.status).toBe(404)

    await request(serveur)
      .put(reservation.body.envoi.url)
      .set(reservation.body.envoi.entetes)
      .send(Buffer.from(unJpeg()))
    await request(serveur)
      .post(`/api/parks/${parkId}/payment-proofs/${proofId}/confirmation`)
      .set('Cookie', cookie)

    const apres = await request(serveur)
      .get(`/api/parks/${parkId}/payment-proofs/${proofId}`)
      .set('Cookie', cookie)
    expect(apres.status, JSON.stringify(apres.body)).toBe(200)
    expect(apres.body.lecture.url).toBeTruthy()
    /* LA CLÉ NE SORT JAMAIS : elle n'apparaît que dans l'adresse signée. */
    expect(apres.body.proof.storageKey).toBeUndefined()
  })

  it('SORT AVEC LE PAIEMENT dans le portefeuille, une fois confirmée', async () => {
    const { cookie, parkId, paymentId } = await parcAvecUnPaiement()
    await joindreUnePreuve(parkId, paymentId, cookie)

    const portefeuille = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    /* `leaseCharges` — PLATE et non groupée par bail, le serveur l'écrit à sa
       ligne : « un objet indexé rendrait la réponse illisible au débogage pour
       la seule économie d'une boucle ». Deux rédactions fausses avant celle-ci,
       `receipts` puis `echeances` : le nom de la clé servie ne se devine pas, il
       se lit. */
    const echeances = portefeuille.body.leaseCharges as {
      payments: { id: string; proofId: string | null }[]
    }[]
    const versements = echeances.flatMap((e) => e.payments)
    /* L'IDENTIFIANT DU PAIEMENT ET SA PREUVE : sans le premier, la rangée ne
       pouvait adresser aucun versement — c'est ce que ce lot a découvert. */
    expect(versements.some((v) => v.id === paymentId && v.proofId !== null)).toBe(true)
  })

  it('EST LUE PAR LE LOCATAIRE SUR SON PROPRE PAIEMENT', async () => {
    const { cookie, parkId, unitId, paymentId } = await parcAvecUnPaiement()
    const { proofId } = await joindreUnePreuve(parkId, paymentId, cookie)

    const invite = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant', unitId, email: 'loc@example.com' })
    const loc = await request(serveur).post('/api/auth/signup').send({
      email: 'loc@example.com',
      password: MDP,
      fullName: 'Serge Mbarga',
      confirmLegal: true,
    })
    const cookieLoc = cookieDe(loc)
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieLoc)
      .send({ invitationCode: invite.body.code })

    const vue = await request(serveur)
      .get(`/api/parks/${parkId}/payment-proofs/${proofId}`)
      .set('Cookie', cookieLoc)
    /* C'EST LE POINT DE LA TABLE : la preuve est ce que le locataire produit le
       jour où l'encaissement est contesté. La lui cacher reviendrait à ranger la
       pièce dans un tiroir qu'il ne peut pas ouvrir. */
    expect(vue.status, JSON.stringify(vue.body)).toBe(200)
  })

  it('EST REFUSÉE AU LOCATAIRE DU VOISIN, par 404 et non par 403', async () => {
    const { cookie, parkId, paymentId } = await parcAvecUnPaiement()
    const { proofId } = await joindreUnePreuve(parkId, paymentId, cookie)

    /* UN SECOND LOGEMENT, UN SECOND LOCATAIRE. Sans lui, le cas précédent est
       POSITIF SEUL : il passe aussi sur un serveur qui ne cloisonne rien, et
       c'est exactement le défaut que la doctrine du dépôt appelle « vert à
       vide ». Le cloisonnement ne se prouve que par le refus. */
    const b1 = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Villa Bastos', district: 'Bastos' })
    const z9 = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${b1.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'Z9', type: 'T1', surfaceSqm: 30, baseRentMinor: 30000 })
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({
        unitId: z9.body.unit.id,
        fullName: 'Nadia Belinga',
        depositMinor: 50000,
        startsOn: '2026-01-01',
      })
    const invite = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant', unitId: z9.body.unit.id, email: 'voisine@example.com' })
    const voisine = await request(serveur).post('/api/auth/signup').send({
      email: 'voisine@example.com',
      password: MDP,
      fullName: 'Nadia Belinga',
      confirmLegal: true,
    })
    const cookieVoisine = cookieDe(voisine)
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieVoisine)
      .send({ invitationCode: invite.body.code })

    const refus = await request(serveur)
      .get(`/api/parks/${parkId}/payment-proofs/${proofId}`)
      .set('Cookie', cookieVoisine)
    /* 404 et non 403 : un 403 confirmerait que la pièce du voisin existe. */
    expect(refus.status).toBe(404)
  })

  it('PART AVEC SES OCTETS, ET LAISSE SA TRACE', async () => {
    const { cookie, parkId, paymentId } = await parcAvecUnPaiement()
    const { proofId } = await joindreUnePreuve(parkId, paymentId, cookie)
    const cle = (
      await prisma.paymentProof.findUniqueOrThrow({
        where: { id: proofId },
        select: { storageKey: true },
      })
    ).storageKey

    const retrait = await request(serveur)
      .delete(`/api/parks/${parkId}/payment-proofs/${proofId}`)
      .set('Cookie', cookie)
    expect(retrait.status).toBe(204)

    expect(await prisma.paymentProof.count({ where: { id: proofId } })).toBe(0)
    /* LES OCTETS AUSSI — et c'est l'ADRESSE qu'on éprouve, pas la méthode.
       `lire` compose une adresse signée sans regarder si la clé existe : elle ne
       peut donc pas rejeter, et la première rédaction l'attendait à tort. Ce qui
       se vérifie est que l'adresse ne sert plus rien. */
    const adresse = await leStockage().lire(cle)
    const apresRetrait = await request(serveur).get(adresse.url)
    expect(apresRetrait.status).toBe(404)
    expect(
      await prisma.auditEvent.count({
        where: { action: 'payment.proof_delete', entityId: proofId },
      }),
    ).toBe(1)
  })
})
