import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * CE QUE LE MANDATAIRE FACTURE, ET CE QU'IL DOIT REVERSER.
 *
 * ═══ LA RÈGLE QUE CES CAS EXISTENT POUR TENIR ═══
 *
 * Le relevé emploie le PÉRIMÈTRE DU GESTIONNAIRE VISÉ, et non celui du
 * demandeur. C'est la seule lecture du routeur où les deux diffèrent, et s'y
 * tromper ne produit aucune erreur : un propriétaire sans périmètre obtiendrait
 * l'encaissé du parc ENTIER, donc des honoraires calculés sur des loyers que
 * personne n'a confiés à ce mandataire. Le chiffre serait faux et parfaitement
 * plausible.
 *
 * ═══ TROIS AUTRES RÈGLES QUI NE VIVENT PAS EN BASE ═══
 *
 *   1. LA BASE COMMANDE LEQUEL DES DEUX CHAMPS EST EXIGÉ. Un pourcentage sans
 *      taux rendrait `0` d'honoraires sur un document remis à un mandant.
 *      PostgreSQL ne sait pas exprimer « l'un ou l'autre selon `basis` ».
 *   2. LE NET PEUT ÊTRE NÉGATIF, et il sort négatif. Rendre `0` « parce qu'on ne
 *      reverse pas une dette » serait le premier chiffre faux de ce produit.
 *   3. UN GESTIONNAIRE NE LIT PAS LE RELEVÉ D'UN CONFRÈRE : il y verrait ce que
 *      le parc verse à un autre, donc ce que cet autre gagne.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * Le FIGEAGE d'un relevé émis. Il n'existe pas : le compte-rendu se calcule à
 * chaque lecture, et l'en-tête de la route dit pourquoi — quatre sommes stockées
 * seraient quatre compteurs. Rien ici ne garde donc qu'un relevé de l'an dernier
 * rende le même chiffre aujourd'hui, parce que ce n'est PAS vrai et que ce n'est
 * pas encore promis.
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
 * Un parc à DEUX immeubles, un locataire qui a payé dans chacun, et un
 * gestionnaire borné au PREMIER.
 *
 * Les deux immeubles sont le cœur du montage : avec un seul, le périmètre du
 * gestionnaire coïnciderait avec le parc et le cas le plus important de ce
 * fichier passerait au vert sur un code fautif.
 */
async function parcConfieAMoitie() {
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

  const immeubles: string[] = []
  const unites: string[] = []
  for (const nom of ['Residance A', 'Residance B']) {
    const imm = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: nom, district: 'Bastos' })
    const buildingId = imm.body.building.id as string
    immeubles.push(buildingId)
    const u = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send({ label: nom === 'Residance A' ? 'A1' : 'B1', type: 'T2', surfaceSqm: 100, baseRentMinor: 100000 })
    unites.push(u.body.unit.id as string)
  }

  /* Un locataire dans CHAQUE immeuble, puis l'APPEL DE LOYER du mois.
     L'appel est un geste à part — `POST /charges` — et sans lui il n'existe
     aucune échéance à laquelle raccrocher un paiement. C'est la première chose
     que ce fixture a eu fausse : créer un bail ne crée pas d'échéance. */
  for (const [i, unitId] of unites.entries()) {
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({
        unitId,
        fullName: i === 0 ? 'Serge Mbarga' : 'Nadia Belinga',
        depositMinor: 200000,
        startsOn: '2026-01-01',
      })
  }
  const appel = await request(serveur)
    .post(`/api/parks/${parkId}/charges`)
    .set('Cookie', cookie)
    .send({ periodStart: '2026-02-01' })
  if (appel.status !== 201 && appel.status !== 200)
    throw new Error(`appel de loyer refusé — ${appel.status} ${JSON.stringify(appel.body)}`)

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
  /* BORNÉ AU PREMIER IMMEUBLE, et c'est ce que tout ce fichier éprouve. */
  await request(serveur)
    .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
    .set('Cookie', cookie)
    .send({ buildingIds: [immeubles[0]] })

  return { cookie, cookieGest, parkId, membershipId: adhesion.id, immeubles, unites }
}

const BORNES = { from: '2026-01-01', to: '2026-12-31' }

function releve(parkId: string, membershipId: string, cookie: string) {
  return request(serveur)
    .get(`/api/parks/${parkId}/memberships/${membershipId}/statement`)
    .query(BORNES)
    .set('Cookie', cookie)
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('le barème d’honoraires', () => {
  it('EXIGE UN TAUX POUR UN POURCENTAGE, et rien d’autre', async () => {
    const { cookie, parkId, membershipId } = await parcConfieAMoitie()

    const sansTaux = await request(serveur)
      .put(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
      .set('Cookie', cookie)
      .send({ basis: 'percentOfCollected', startsOn: '2026-01-01' })
    expect(sansTaux.status).toBe(400)

    /* LES DEUX À LA FOIS SONT REFUSÉS : un barème qui porterait un taux ET un
       forfait laisserait indéterminable ce qu'on facture, et le lecteur du
       relevé ne pourrait pas refaire le calcul. */
    const lesDeux = await request(serveur)
      .put(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
      .set('Cookie', cookie)
      .send({
        basis: 'percentOfCollected',
        rateBasisPoints: 850,
        fixedMinor: 50000,
        startsOn: '2026-01-01',
      })
    expect(lesDeux.status).toBe(400)
  })

  it('EST IDEMPOTENT : reposer le même barème rend le même état, pas un 409', async () => {
    const { cookie, parkId, membershipId } = await parcConfieAMoitie()
    const corps = { basis: 'percentOfCollected', rateBasisPoints: 850, startsOn: '2026-01-01' }

    const premier = await request(serveur)
      .put(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
      .set('Cookie', cookie)
      .send(corps)
    const second = await request(serveur)
      .put(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
      .set('Cookie', cookie)
      .send(corps)

    expect(premier.status, JSON.stringify(premier.body)).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.fee).toMatchObject({ basis: 'percentOfCollected', rateBasisPoints: 850 })
  })

  it('EST REFUSÉ AU GESTIONNAIRE : il n’écrit pas ce qu’on lui doit', async () => {
    const { cookieGest, parkId, membershipId } = await parcConfieAMoitie()
    const refus = await request(serveur)
      .put(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
      .set('Cookie', cookieGest)
      .send({ basis: 'percentOfCollected', rateBasisPoints: 5000, startsOn: '2026-01-01' })
    /* 403 et non 404 : l'appartenance au parc est établie, c'est le rôle qui
       s'y oppose — et le gestionnaire sait parfaitement que ce parc existe. */
    expect(refus.status).toBe(403)
  })
})

describe('le compte-rendu de gestion', () => {
  it('N’ENCAISSE QUE LE PÉRIMÈTRE DU GESTIONNAIRE VISÉ, pas celui du demandeur', async () => {
    const { cookie, parkId, membershipId, unites } = await parcConfieAMoitie()

    /* Un loyer encaissé dans CHAQUE immeuble. Le gestionnaire ne tient que le
       premier : son relevé ne doit voir qu'un seul des deux. */
    for (const unitId of unites) {
      const echeances = await prisma.rentCharge.findMany({
        where: { lease: { unitId } },
        select: { id: true },
        orderBy: { dueOn: 'asc' },
        take: 1,
      })
      await prisma.payment.create({
        data: {
          chargeId: echeances[0]!.id,
          amountMinor: 100000,
          currency: 'XAF',
          method: 'mobile',
          paidOn: new Date('2026-02-05T00:00:00.000Z'),
        },
      })
    }

    const vu = await releve(parkId, membershipId, cookie)
    expect(vu.status, JSON.stringify(vu.body)).toBe(200)
    /* UN SEUL des deux encaissements. Sans le périmètre du VISÉ, ce serait
       200 000 — et les honoraires seraient calculés sur le double. */
    expect(vu.body.collectedMinor).toBe(100000)
  })

  it('CALCULE LES TROIS BASES, chacune sur sa grandeur', async () => {
    const { cookie, parkId, membershipId, unites } = await parcConfieAMoitie()
    const echeance = await prisma.rentCharge.findFirstOrThrow({
      where: { lease: { unitId: unites[0]! } },
      select: { id: true },
      orderBy: { dueOn: 'asc' },
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

    const poser = (corps: Record<string, unknown>) =>
      request(serveur)
        .put(`/api/parks/${parkId}/memberships/${membershipId}/fee`)
        .set('Cookie', cookie)
        .send({ startsOn: '2026-01-01', ...corps })

    /* 8,5 % de 100 000 = 8 500. Le taux voyage en POINTS DE BASE. */
    await poser({ basis: 'percentOfCollected', rateBasisPoints: 850 })
    expect((await releve(parkId, membershipId, cookie)).body.feeMinor).toBe(8500)

    /* UN logement dans le périmètre × 5 000 = 5 000. Le second logement est hors
       périmètre : le compter ferait 10 000, et c'est le défaut à éviter. */
    await poser({ basis: 'fixedPerUnit', fixedMinor: 5000 })
    const parUnite = await releve(parkId, membershipId, cookie)
    expect(parUnite.body.managedUnits).toBe(1)
    expect(parUnite.body.feeMinor).toBe(5000)

    /* Douze mois d'intervalle × 3 000 = 36 000. Un mandat facture le mois
       ENTAMÉ, pas au prorata des jours. */
    await poser({ basis: 'fixedPerMonth', fixedMinor: 3000 })
    expect((await releve(parkId, membershipId, cookie)).body.feeMinor).toBe(36000)
  })

  it('REND UN NET NÉGATIF quand les dépenses dépassent l’encaissé', async () => {
    const { cookie, parkId, membershipId, immeubles } = await parcConfieAMoitie()

    /* Une dépense sur l'immeuble CONFIÉ, sans aucun encaissement. */
    await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({
        category: 'tax',
        label: 'Taxe foncière',
        amountMinor: 185000,
        incurredOn: '2026-03-01',
        buildingId: immeubles[0],
      })

    const vu = await releve(parkId, membershipId, cookie)
    expect(vu.body.collectedMinor).toBe(0)
    expect(vu.body.expensesMinor).toBe(185000)
    /* NÉGATIF, ET SERVI NÉGATIF. Rendre 0 serait le premier chiffre faux du
       produit : le propriétaire doit réellement cet argent à son mandataire. */
    expect(vu.body.netMinor).toBe(-185000)
  })

  it('RESTE JUSTE SANS BARÈME : il ne retient rien, et le dit', async () => {
    const { cookie, parkId, membershipId } = await parcConfieAMoitie()
    const vu = await releve(parkId, membershipId, cookie)
    expect(vu.body.fee).toBeNull()
    expect(vu.body.feeMinor).toBe(0)
  })

  it('EST REFUSÉ À UN GESTIONNAIRE POUR LE RELEVÉ D’UN CONFRÈRE', async () => {
    const { cookie, parkId, membershipId } = await parcConfieAMoitie()

    /* Un SECOND gestionnaire, qui demande le relevé du premier. */
    const invite = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager', email: 'confrere@example.com' })
    const confrere = await request(serveur).post('/api/auth/signup').send({
      email: 'confrere@example.com',
      password: MDP,
      fullName: 'Paul Etoa',
      confirmLegal: true,
    })
    const cookieConfrere = cookieDe(confrere)
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieConfrere)
      .send({ invitationCode: invite.body.code })

    const refus = await releve(parkId, membershipId, cookieConfrere)
    /* 404 et non 403 : le relevé d'un confrère ne doit pas même être confirmé
       comme existant — son existence dit qu'un autre mandataire est payé. */
    expect(refus.status).toBe(404)
  })

  it('LIT SON PROPRE RELEVÉ, lui', async () => {
    const { cookieGest, parkId, membershipId } = await parcConfieAMoitie()
    const vu = await releve(parkId, membershipId, cookieGest)
    expect(vu.status, JSON.stringify(vu.body)).toBe(200)
  })
})
