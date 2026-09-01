import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * TROIS MOIS APRÈS SON DÉPART, ET PAS UN DE PLUS.
 *
 * ═══ CE QUE LA RÈGLE DISAIT, ET CE QU'ELLE NE BORNAIT PAS ═══
 *
 * `unitesVisibles` ouvre à un locataire les unités dont un bail porte son
 * compte, et son commentaire justifie l'absence de borne : « un locataire parti
 * doit encore accéder à ses quittances ». C'est juste, et c'était SANS FIN.
 *
 * Un locataire sorti en 2024 gardait en 2027 la lecture de son ancien logement :
 * ses quittances, oui — mais aussi les relevés d'eau et d'électricité de qui
 * l'habite depuis, les états des lieux qui ne sont pas les siens, les
 * notifications portant sur cette unité. Le cloisonnement du produit est bâti
 * sur l'UNITÉ ; passé le départ, l'unité n'est plus la sienne, et la garde
 * continuait de la lui donner.
 *
 * ═══ TROIS MOIS, ET POURQUOI UNE BORNE PLUTÔT QU'AUCUNE ═══
 *
 * C'est la fenêtre décidée pour ce produit : le temps de récupérer ses pièces,
 * de contester une retenue de caution, de fournir une attestation à un
 * nouveau bailleur. Au-delà, ce qui se passe dans ce logement ne le regarde
 * plus.
 *
 * ELLE COURT DEPUIS `endsOn`, la fin du bail, et non depuis un statut : un bail
 * peut être marqué `ended` le jour de la signature du suivant, alors que la
 * sortie a eu lieu deux mois plus tôt. La date est un fait, le statut est une
 * saisie.
 *
 * UN BAIL SANS `endsOn` NE SE PÉRIME PAS. C'est le bail en cours, et c'est
 * l'écrasante majorité : la borne ne concerne que ceux dont le terme est écrit.
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

/** Un parc, un logement, un locataire relié — et son bail qu'on datera. */
async function parcAvecUnLocataire() {
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

  const inv = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant' })
  const locataire = await request(serveur).post('/api/auth/signup').send({
    email: 'romel@example.com',
    password: MDP,
    fullName: 'Bekono Landry',
    acceptTerms: true,
    invitationCode: inv.body.code,
  })
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekono Landry', userId: locataire.body.user.id })

  return { cookie, parkId, unitId, cookieLocataire: cookieDe(locataire) }
}

/** Termine le bail du logement à `jours` jours dans le passé. */
async function terminerLeBail(unitId: string, jours: number) {
  const fin = new Date()
  fin.setUTCDate(fin.getUTCDate() - jours)
  await prisma.lease.updateMany({
    where: { unitId },
    data: { endsOn: fin, status: 'ended' },
  })
}

const sonParc = (parkId: string, cookie: string) =>
  request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)

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

describe('la fenêtre se règle par parc', () => {
  it('un parc réglé à douze mois garde le parti plus longtemps', async () => {
    /* Trois mois est le DÉFAUT, plus la règle : une législation locale peut
       exiger davantage, et le réglage vit sur le parc. Quatre mois après le
       départ, ce parc-ci montre encore les quittances que le défaut aurait
       fermées — c'est le cas exact qui rougissait au défaut. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const regle = await request(serveur)
      .patch(`/api/parks/${parkId}`)
      .set('Cookie', cookie)
      .send({ leaseAccessMonths: 12 })
    expect(regle.status).toBe(200)
    await terminerLeBail(unitId, 120)

    const vu = await sonParc(parkId, cookieLocataire)
    const unites = (vu.body.buildings as { units: { id: string }[] }[]).flatMap((b) => b.units)
    expect(unites.map((u) => u.id)).toEqual([unitId])
  })

  it('refuse zéro : couper le jour du départ n’est pas une fenêtre', async () => {
    const { cookie, parkId } = await parcAvecUnLocataire()
    const refuse = await request(serveur)
      .patch(`/api/parks/${parkId}`)
      .set('Cookie', cookie)
      .send({ leaseAccessMonths: 0 })
    expect(refuse.status).toBe(400)
  })
})

describe('le locataire dont le bail court', () => {
  it('voit son logement, et rien de cette règle ne le gêne', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()

    const vu = await sonParc(parkId, cookieLocataire)
    const unites = (vu.body.buildings as { units: { id: string }[] }[]).flatMap((b) => b.units)
    expect(
      unites.map((u) => u.id),
      'la borne ne doit toucher que les baux dont le terme est ÉCRIT',
    ).toEqual([unitId])
  })
})

describe('le locataire parti', () => {
  it('garde ses quittances pendant trois mois', async () => {
    /* Le temps de récupérer ses pièces, de contester une retenue de caution, de
       fournir une attestation à un nouveau bailleur. */
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await terminerLeBail(unitId, 30)

    const vu = await sonParc(parkId, cookieLocataire)
    const unites = (vu.body.buildings as { units: { id: string }[] }[]).flatMap((b) => b.units)
    expect(unites.map((u) => u.id)).toEqual([unitId])
  })

  it('les garde encore la veille du terme', async () => {
    /* La borne est une DATE, pas un arrondi : quatre-vingt-neuf jours, c'est
       encore dedans, et un test qui n'éprouverait que 30 et 200 laisserait
       passer un décalage d'un mois. */
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await terminerLeBail(unitId, 89)

    const vu = await sonParc(parkId, cookieLocataire)
    const unites = (vu.body.buildings as { units: { id: string }[] }[]).flatMap((b) => b.units)
    expect(unites.map((u) => u.id)).toEqual([unitId])
  })

  it('ne voit plus rien passé trois mois', async () => {
    /* Ce qui se passe dans ce logement ne le regarde plus : ni les relevés de
       qui l'habite depuis, ni les états des lieux qui ne sont pas les siens, ni
       les notifications portant sur cette unité. */
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await terminerLeBail(unitId, 120)

    const vu = await sonParc(parkId, cookieLocataire)
    const unites = (vu.body.buildings as { units: { id: string }[] }[]).flatMap((b) => b.units)
    expect(
      unites,
      'un locataire sorti il y a quatre mois lisait encore le logement de son successeur',
    ).toEqual([])
  })

  it('lit la DATE de fin d’accès pendant la fenêtre, et jamais avant', async () => {
    /* La coupure ne doit plus surprendre : « un jour ses quittances sont là, le
       lendemain son espace dit “aucun logement rattaché” ». La date s'annonce
       dès le départ — et JAMAIS tant qu'un bail court, où elle sèmerait la
       panique pour rien. */
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()

    const avant = await sonParc(parkId, cookieLocataire)
    expect(avant.body.accessUntil, 'un bail en cours n’a rien à annoncer').toBeNull()

    await terminerLeBail(unitId, 30)
    const apres = await sonParc(parkId, cookieLocataire)
    expect(apres.body.accessUntil, 'le parti doit savoir QUAND ça ferme').toMatch(/^\d{4}-\d{2}-\d{2}$/)
    /* Fin du bail il y a 30 jours + 3 mois : la date est DEVANT nous. */
    expect(new Date(apres.body.accessUntil).getTime()).toBeGreaterThan(Date.now())
  })

  it('ne peut plus marquer comme lue une notification de ce logement', async () => {
    /* La lecture du portefeuille et le marquage partagent le même filtre, et
       c'est écrit à sa ligne : « sans lui, le geste le plus anodin du produit
       ouvrirait un accès aux impayés du voisin ». La borne doit donc valoir
       pour les deux, sans quoi elle ne vaut pour aucun. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', cookie)
      .send({ title: 'Ravalement de la façade', trade: 'painting', urgency: 'low' })
    await terminerLeBail(unitId, 120)

    const avis = await prisma.notification.findFirst({ where: { parkId }, select: { id: true } })
    if (avis) {
      const refuse = await request(serveur)
        .patch(`/api/parks/${parkId}/notifications/read`)
        .set('Cookie', cookieLocataire)
        .send({ ids: [avis.id] })
      expect(refuse.body.marked ?? 0).toBe(0)
    }
  })
})
