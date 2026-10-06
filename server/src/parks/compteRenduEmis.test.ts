import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UN COMPTE-RENDU ÉMIS NE BOUGE PLUS.
 *
 * ═══ LA DETTE QUE CES CAS REFERMENT, ET QUI L'AVAIT ÉCRITE ═══
 *
 * La migration des honoraires a REFUSÉ une table de relevés, et nommé la
 * condition de sa levée : « un relevé ÉMIS ne doit plus bouger, c'est un
 * document remis à un mandant. Le figer demande un instantané, comme
 * `RentCharge` fige son loyer à l'appel. »
 *
 * `honorairesDeGestion.test.ts` déclarait la même absence dans sa section « ce
 * que ces cas ne couvrent pas » : « rien ici ne garde qu'un relevé de l'an
 * dernier rende le même chiffre aujourd'hui, parce que ce n'est PAS vrai ».
 * C'est vrai depuis ce lot, et sa prose a été corrigée.
 *
 * ═══ CE QUE CES CAS GARDENT, ET DANS QUEL ORDRE ═══
 *
 * Le premier est le seul qui compte vraiment : **le document ne suit pas ses
 * lignes**. On émet, on change les lignes dessous, on relit — et le chiffre est
 * celui de l'émission. Sans lui, tout le reste du lot est décoratif.
 *
 * Puis le BARÈME figé, parce que c'est l'autre moitié du lot et qu'elle est
 * moins évidente : relire le barème COURANT sous un montant d'honoraires FIGÉ
 * afficherait un taux qui n'explique pas le chiffre d'à côté. C'est aussi ce qui
 * tient lieu d'historique du barème, `ManagementFee` n'en gardant aucun.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * LA RÉÉMISSION. Rien ne réécrit un relevé émis, et c'est délibéré : corriger un
 * document déjà remis demanderait de choisir entre un avoir, un second relevé et
 * une annulation tracée, et aucune des trois n'est évidente. Le produit refuse
 * (409) au lieu de choisir la pire — l'écrasement silencieux.
 *
 * LE PÉRIMÈTRE HISTORISÉ. `managedUnits` est figé tel qu'il était à l'émission,
 * ce qui l'empêche de bouger sous le document mais ne le rend pas juste : un
 * logement confié au milieu du mois compte pour le mois entier. L'approximation
 * était déjà avouée dans le calcul ; le figeage la fige, il ne la corrige pas.
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

const BORNES = { from: '2026-02-01', to: '2026-02-28' }

/**
 * Un parc, un gestionnaire SANS périmètre borné, un loyer encaissé, un barème.
 *
 * Plus simple que le fixture de `honorairesDeGestion.test.ts`, et pour une
 * raison : là-bas le sujet est le PÉRIMÈTRE, ici c'est le FIGEAGE. Deux
 * immeubles n'y ajouteraient qu'un cas que l'autre fichier tient déjà.
 */
async function parcAvecBareme() {
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
    .send({ name: 'Residance A', district: 'Bastos' })
  const buildingId = imm.body.building.id as string
  const u = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 100000 })
  const unitId = u.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Serge Mbarga', depositMinor: 200000, startsOn: '2026-01-01' })
  await request(serveur)
    .post(`/api/parks/${parkId}/charges`)
    .set('Cookie', cookie)
    .send({ periodStart: '2026-02-01' })

  const gest = await request(serveur).post('/api/auth/signup').send({
    email: 'gest@example.com',
    password: MDP,
    fullName: 'Diane Fotso',
    confirmLegal: true,
  })
  const cookieGest = cookieDe(gest)
  const invite = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager', email: 'gest@example.com' })
  await request(serveur)
    .post('/api/join')
    .set('Cookie', cookieGest)
    .send({ invitationCode: invite.body.code })
  const adhesion = await prisma.membership.findFirstOrThrow({
    where: { parkId, role: 'manager' },
    select: { id: true },
  })

  /* UN LOYER ENCAISSÉ DANS LA PÉRIODE : sans encaissé, un barème au pourcentage
     rend zéro d'honoraires et le figeage ne figerait que des zéros. */
  const echeance = await prisma.rentCharge.findFirstOrThrow({
    where: { lease: { unitId } },
    select: { id: true },
  })
  await prisma.payment.create({
    data: {
      chargeId: echeance.id,
      amountMinor: 100000,
      currency: 'XAF',
      method: 'mobile',
      paidOn: new Date('2026-02-05T00:00:00.000Z'),
    },
  })

  await request(serveur)
    .put(`/api/parks/${parkId}/memberships/${adhesion.id}/fee`)
    .set('Cookie', cookie)
    .send({ basis: 'percentOfCollected', rateBasisPoints: 1000, startsOn: '2026-01-01' })

  return { cookie, cookieGest, parkId, membershipId: adhesion.id, unitId, chargeId: echeance.id }
}

function lire(parkId: string, membershipId: string, cookie: string) {
  return request(serveur)
    .get(`/api/parks/${parkId}/memberships/${membershipId}/statement`)
    .query(BORNES)
    .set('Cookie', cookie)
}

function emettre(parkId: string, membershipId: string, cookie: string) {
  return request(serveur)
    .post(`/api/parks/${parkId}/memberships/${membershipId}/statement`)
    .set('Cookie', cookie)
    .send(BORNES)
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('le figeage', () => {
  it('NE SUIT PLUS SES LIGNES une fois émis', async () => {
    /*
      LE CAS QUI PORTE LE LOT. Sans lui, tout le reste est décoratif.

      10 % de 100 000 encaissés = 10 000 d'honoraires, net 90 000. On émet, puis
      on AJOUTE un second encaissement de 100 000 dans la même période. Un
      document qui suivrait ses lignes rendrait 200 000 / 20 000 / 180 000 — et
      le mandataire qui a signé le premier verrait sa facture doubler sans
      qu'aucun geste ne l'ait décidé.
    */
    const { cookie, parkId, membershipId, chargeId } = await parcAvecBareme()

    const emis = await emettre(parkId, membershipId, cookie)
    expect(emis.status, JSON.stringify(emis.body)).toBe(201)
    expect(emis.body.collectedMinor).toBe(100000)
    expect(emis.body.feeMinor, '10 % de 100 000').toBe(10000)
    expect(emis.body.netMinor).toBe(90000)
    expect(emis.body.issuedAt, 'le document porte sa date').toBeTruthy()

    await prisma.payment.create({
      data: {
        chargeId,
        amountMinor: 100000,
        currency: 'XAF',
        method: 'cash',
        paidOn: new Date('2026-02-20T00:00:00.000Z'),
      },
    })

    const relu = await lire(parkId, membershipId, cookie)
    expect(relu.status).toBe(200)
    expect(relu.body.collectedMinor, 'le document n’a pas bougé').toBe(100000)
    expect(relu.body.feeMinor).toBe(10000)
    expect(relu.body.netMinor).toBe(90000)
    expect(relu.body.issuedAt).toBe(emis.body.issuedAt)
  })

  it('CALCULE ENCORE tant que rien n’est émis, et le DIT', async () => {
    /*
      L'autre moitié de la même règle. Avant émission, le compte-rendu suit ses
      lignes — c'est le bon comportement, et l'en-tête de la route l'explique
      depuis le lot des honoraires. `issuedAt: null` est ce qui permet à l'écran
      de ne pas présenter un calcul vivant comme un document arrêté.
    */
    const { cookie, parkId, membershipId, chargeId } = await parcAvecBareme()

    const avant = await lire(parkId, membershipId, cookie)
    expect(avant.body.collectedMinor).toBe(100000)
    expect(avant.body.issuedAt, 'rien n’est émis, et la réponse le dit').toBeNull()

    await prisma.payment.create({
      data: {
        chargeId,
        amountMinor: 50000,
        currency: 'XAF',
        method: 'cash',
        paidOn: new Date('2026-02-20T00:00:00.000Z'),
      },
    })

    const apres = await lire(parkId, membershipId, cookie)
    expect(apres.body.collectedMinor, 'il suit encore ses lignes').toBe(150000)
    expect(apres.body.issuedAt).toBeNull()
  })

  it('ne rend PAS le relevé du mois entier sous les bornes d’une quinzaine', async () => {
    /*
      L'unicité ne porte que sur `periodStart`. Demander le 1er au 15 février
      quand le 1er au 28 est émis doit RECALCULER sur la quinzaine, et non
      resservir le document du mois sous d'autres bornes — un chiffre juste
      sous une étiquette fausse est pire qu'une erreur visible.
    */
    const { cookie, parkId, membershipId } = await parcAvecBareme()
    expect((await emettre(parkId, membershipId, cookie)).status).toBe(201)

    const quinzaine = await request(serveur)
      .get(`/api/parks/${parkId}/memberships/${membershipId}/statement`)
      .query({ from: '2026-02-01', to: '2026-02-15' })
      .set('Cookie', cookie)
    expect(quinzaine.status).toBe(200)
    expect(quinzaine.body.issuedAt, 'ce n’est pas le document émis').toBeNull()
  })
})

describe('le barème figé', () => {
  it('garde les TERMES de l’émission, pas ceux d’aujourd’hui', async () => {
    /*
      L'AUTRE MOITIÉ DU LOT, et la moins évidente. `ManagementFee` n'a qu'un
      barème par mandat — sa migration l'assumait : « l'historique viendra avec
      le figeage des relevés, pas avant ».

      On émet à 10 %, puis on passe le barème à 20 %. Le document doit continuer
      d'afficher 1000 points de base : sinon il montrerait un taux de 20 % au-
      dessus d'un montant calculé à 10 %, soit deux chiffres dont aucun
      n'explique l'autre.

      ET C'EST CE QUI TIENT LIEU D'HISTORIQUE : la suite des relevés émis dit
      sous quel taux chaque mois a été facturé.
    */
    const { cookie, parkId, membershipId } = await parcAvecBareme()
    const emis = await emettre(parkId, membershipId, cookie)
    expect(emis.body.issuedFee.rateBasisPoints).toBe(1000)

    const change = await request(serveur)
      .put(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
      .set('Cookie', cookie)
      .send({ basis: 'percentOfCollected', rateBasisPoints: 2000, startsOn: '2026-01-01' })
    expect(change.status, JSON.stringify(change.body)).toBe(200)

    const relu = await lire(parkId, membershipId, cookie)
    expect(relu.body.issuedFee.rateBasisPoints, 'le taux de l’émission').toBe(1000)
    expect(relu.body.feeMinor, 'et le montant qu’il explique').toBe(10000)
    /* ET LE BARÈME COURANT EST SERVI À CÔTÉ, à son taux neuf : c'est lui que le
       formulaire de la modale peuple, et confondre les deux ferait éditer le
       barème en vigueur depuis un document passé. */
    expect(relu.body.fee.rateBasisPoints, 'le barème COURANT, pour le formulaire').toBe(2000)
    expect(relu.body.fee.startsOn, 'avec ses bornes, que l’instantané ne porte pas').toBe(
      '2026-01-01',
    )
  })

  it('REFUSE d’émettre sans barème convenu', async () => {
    /*
      `honorairesDus` rend 0 sans barème, et c'est juste pour une LECTURE — on
      montre un parc dont rien n'est encore facturé. Émettre un document qui
      atteste « honoraires : 0 » sous un mandat dont le barème n'a jamais été
      posé serait attester d'un accord qui n'existe pas.
    */
    const { cookie, parkId, membershipId } = await parcAvecBareme()
    await request(serveur)
      .delete(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
      .set('Cookie', cookie)

    const refus = await emettre(parkId, membershipId, cookie)
    expect(refus.status).toBe(409)
    expect(refus.body.error).toBe('no_fee')
    expect(await prisma.ownerStatement.count(), 'et rien n’a été écrit').toBe(0)
  })
})

describe('qui peut arrêter le compte', () => {
  it('REFUSE L’ÉMISSION AU GESTIONNAIRE, qui peut pourtant la LIRE', async () => {
    /*
      La lecture lui est ouverte : c'est son mandat, il doit voir ce qu'il
      facture. L'émission ne l'est pas — un document qui fige ce qu'un mandataire
      se doit à lui-même, arrêté par lui, n'a aucune valeur. C'est le mandant qui
      arrête le compte.

      LES DEUX ASSERTIONS ENSEMBLE, et c'est le point : vérifier le seul refus
      laisserait passer un code qui lui aurait aussi retiré la lecture.
    */
    const { cookieGest, parkId, membershipId } = await parcAvecBareme()

    const lu = await lire(parkId, membershipId, cookieGest)
    expect(lu.status, 'il lit son propre relevé').toBe(200)

    const refus = await emettre(parkId, membershipId, cookieGest)
    expect(refus.status).toBe(403)
    expect(await prisma.ownerStatement.count()).toBe(0)
  })

  it('REFUSE une seconde émission de la même période, sans l’écraser', async () => {
    /*
      Rien ne réémet, et c'est délibéré : corriger un document remis demanderait
      de choisir entre un avoir, un second relevé et une annulation tracée.
      Laisser une route l'écraser en silence serait choisir la pire des trois.

      LE 409 PORTE LA DATE du document déjà émis : l'écran a besoin de dire
      « émis le 6 octobre » plutôt que « l'action a échoué ».
    */
    const { cookie, parkId, membershipId } = await parcAvecBareme()
    const premier = await emettre(parkId, membershipId, cookie)
    expect(premier.status).toBe(201)

    const second = await emettre(parkId, membershipId, cookie)
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('already_issued')
    expect(second.body.issuedAt).toBe(premier.body.issuedAt)
    expect(await prisma.ownerStatement.count(), 'un seul document').toBe(1)
  })

  it('TRACE l’émission au registre, avec son net', async () => {
    /* Arrêter un compte est une décision, et le registre existe pour que le
       mandant contrôle ce qu'il a délégué. Ici la trace est DANS la transaction
       — l'inverse du choix fait pour la mise en demeure : un document sans trace
       de qui l'a émis ne s'oppose à personne, mieux vaut qu'il ne naisse pas. */
    const { cookie, parkId, membershipId } = await parcAvecBareme()
    await emettre(parkId, membershipId, cookie)

    const actes = await prisma.auditEvent.findMany({
      where: { parkId, action: 'statement.issue' },
    })
    expect(actes).toHaveLength(1)
    expect((actes[0]?.payload as { netMinor?: number })?.netMinor).toBe(90000)
    expect(actes[0]?.actorId, 'et un acteur, contrairement à l’appel automatique').toBeTruthy()
  })
})
