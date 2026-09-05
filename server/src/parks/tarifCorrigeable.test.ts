import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UN PRIX AU MÈTRE CUBE SE CORRIGE, ET SE RETIRE.
 *
 * ═══ CE QUE LA ROUTE DE CRÉATION SAVAIT DÉJÀ, ET NE DONNAIT PAS ═══
 *
 * Elle nomme la victime dans son propre rattrapage d'erreur :
 *
 *     « un propriétaire qui CORRIGE UNE FAUTE DE FRAPPE en réémettant le même
 *       jour reçoit un 500 nu sur un geste ordinaire »
 *
 * Le 500 est devenu un 409 `tariff_exists`. Le geste, lui, restait impossible :
 * ni `PATCH`, ni `DELETE`, et l'unicité `(parc, énergie, date)` ferme la porte
 * du remplacement. Un « 1 500 » tapé pour « 150 » restait au tableau des tarifs
 * pour la vie du parc.
 *
 * ═══ CE QU'UN TARIF ATTEINT VRAIMENT AUJOURD'HUI — MESURÉ, PAS SUPPOSÉ ═══
 *
 * MOINS QUE CE QUE SON EN-TÊTE LAISSE CROIRE, et il faut l'écrire ici plutôt
 * que de laisser un lecteur le déduire :
 *
 *   — AUCUNE route n'écrit de `MeterReading`. Seule `demo.ts` en sème. Sur un
 *     parc réel, l'écran des relevés n'a rien à montrer.
 *   — AUCUNE route n'écrit `RentCharge.waterMinor` ni `powerMinor`. Une
 *     consommation refacturée n'atterrit donc sur AUCUNE quittance.
 *
 * Un tarif faux ne fait donc pas payer un locataire — il s'affiche, au tableau
 * des tarifs, indéfiniment. C'est un défaut plus petit que « on facture faux »,
 * et plus grand que rien : c'est la seule trace visible d'une décision qui
 * s'inscrit aussi au registre.
 *
 * ═══ ET C'EST L'EXACT CONTRAIRE DU LOYER DE RÉFÉRENCE ═══
 *
 * `Unit.baseRentMinor` se corrige SANS toucher au passé, parce que le bail et
 * l'échéance figent chacun le leur. Un tarif ne fige RIEN : `prixApplicable`
 * relit la table à chaque lecture et prend le plus récent dont la date précède
 * la période. Corriger un tarif RÉÉCRIT donc ce que toutes les périodes
 * suivantes affichent — et c'est précisément pourquoi il faut pouvoir le
 * corriger : un prix faux est faux pour le passé aussi.
 *
 * Poser un tarif plus RÉCENT ne suffit pas, et c'est ce qui distingue ce lot
 * d'un contournement : la période entre la mauvaise date et la correction reste
 * au mauvais prix, et la ligne fausse reste lisible.
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

/** Un parc et un prix de l'eau, tapé dix fois trop cher. */
async function parcAvecUnTarif(email = 'proprio@example.com') {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email,
    password: MDP,
    fullName: 'Djoumessi Nelson',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const pose = await request(serveur)
    .post(`/api/parks/${parkId}/tariffs`)
    .set('Cookie', cookie)
    .send({ utility: 'water', unitPriceMinor: 15000, effectiveFrom: '2026-01-01' })

  return { cookie, parkId, tariffId: pose.body.tariff.id as string }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('corriger un tarif', () => {
  it('réécrit le prix', async () => {
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)
      .send({ unitPriceMinor: 1500 })

    expect(reponse.status).toBe(200)
    expect(reponse.body.tariff).toMatchObject({ unitPriceMinor: 1500, utility: 'water' })

    /* SERVI PAR LA LECTURE, et pas seulement écrit : c'est le tableau des
       tarifs qui montre la faute de frappe, et c'est lui qu'on répare. */
    const liste = await request(serveur)
      .get(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', cookie)
    expect(liste.body.tariffs[0]).toMatchObject({ unitPriceMinor: 1500 })
  })

  it('réécrit la DATE de prise d’effet', async () => {
    /* Se tromper de date est aussi courant que se tromper de prix, et bien plus
       silencieux : le prix est juste, il s'applique au mauvais mois. */
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)
      .send({ effectiveFrom: '2026-02-01' })

    expect(reponse.status).toBe(200)
    expect(reponse.body.tariff.effectiveFrom).toBe('2026-02-01')
  })

  it('refuse une date DÉJÀ PRISE par un autre prix de la même énergie', async () => {
    /* L'unicité `(parc, énergie, date)` est juste — « deux prix valables le
       même jour rendraient indéterminable ce qu'on facture » — et la correction
       ne doit pas rentrer par la fenêtre ce que la création refuse. */
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()
    await request(serveur)
      .post(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', cookie)
      .send({ utility: 'water', unitPriceMinor: 1800, effectiveFrom: '2026-06-01' })

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)
      .send({ effectiveFrom: '2026-06-01' })

    expect(reponse.status).toBe(409)
    expect(reponse.body.error).toBe('tariff_exists')
  })

  it('accepte la MÊME date pour une AUTRE énergie', async () => {
    /* L'unicité porte sur le triplet : un prix de l'eau et un prix du courant
       peuvent — et doivent — prendre effet le même jour. */
    const { cookie, parkId } = await parcAvecUnTarif()
    const courant = await request(serveur)
      .post(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', cookie)
      .send({ utility: 'power', unitPriceMinor: 9900, effectiveFrom: '2026-03-01' })

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/tariffs/${courant.body.tariff.id}`)
      .set('Cookie', cookie)
      .send({ effectiveFrom: '2026-01-01' })

    expect(reponse.status).toBe(200)
  })

  it('consigne l’AVANT et l’APRÈS au registre', async () => {
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()

    await request(serveur)
      .patch(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)
      .send({ unitPriceMinor: 1500 })

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'tariff.update' },
    })
    expect(trace.entityId).toBe(tariffId)
    expect(trace.payload).toMatchObject({
      utility: 'water',
      unitPriceMinor: 1500,
      avant: { unitPriceMinor: 15000 },
    })
  })

  it('n’écrit RIEN quand rien ne change', async () => {
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()

    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)
      .send({ unitPriceMinor: 15000 })

    expect(reponse.status).toBe(200)
    expect(await prisma.auditEvent.count({ where: { parkId, action: 'tariff.update' } })).toBe(0)
  })

  it('refuse un corps VIDE', async () => {
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()
    const reponse = await request(serveur)
      .patch(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)
      .send({})
    expect(reponse.status).toBe(400)
  })

  it('rend 404 sur le tarif d’un AUTRE parc — jamais 403', async () => {
    const mien = await parcAvecUnTarif('a@example.com')
    const autre = await parcAvecUnTarif('b@example.com')

    const reponse = await request(serveur)
      .patch(`/api/parks/${mien.parkId}/tariffs/${autre.tariffId}`)
      .set('Cookie', mien.cookie)
      .send({ unitPriceMinor: 1 })

    expect(reponse.status).toBe(404)
    const intact = await prisma.utilityTariff.findUniqueOrThrow({ where: { id: autre.tariffId } })
    expect(intact.unitPriceMinor).toBe(15000)
  })
})

describe('retirer un tarif', () => {
  it('retire la ligne, et la lecture ne la sert plus', async () => {
    /* Une date entièrement fausse ne se corrige pas toujours : parfois la ligne
       n'aurait jamais dû exister. Sans retrait, elle resterait au tableau. */
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()

    const reponse = await request(serveur)
      .delete(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)

    expect(reponse.status).toBe(204)
    const liste = await request(serveur)
      .get(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', cookie)
    expect(liste.body.tariffs).toEqual([])
  })

  it('consigne le retrait AVEC le prix disparu', async () => {
    /* Après coup, l'identifiant ne mène nulle part : seul ce qui est consigné
       dit ce qui a disparu. Même motif que la suppression d'immeuble. */
    const { cookie, parkId, tariffId } = await parcAvecUnTarif()

    await request(serveur)
      .delete(`/api/parks/${parkId}/tariffs/${tariffId}`)
      .set('Cookie', cookie)

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'tariff.delete' },
    })
    expect(trace.payload).toMatchObject({
      utility: 'water',
      unitPriceMinor: 15000,
      effectiveFrom: '2026-01-01',
    })
  })

  it('rend 404 sur le tarif d’un AUTRE parc', async () => {
    const mien = await parcAvecUnTarif('a@example.com')
    const autre = await parcAvecUnTarif('b@example.com')

    const reponse = await request(serveur)
      .delete(`/api/parks/${mien.parkId}/tariffs/${autre.tariffId}`)
      .set('Cookie', mien.cookie)

    expect(reponse.status).toBe(404)
    expect(
      await prisma.utilityTariff.findUnique({ where: { id: autre.tariffId } }),
    ).not.toBeNull()
  })
})
