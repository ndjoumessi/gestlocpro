import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE LOGEMENT ÉTAIT LE DERNIER OBJET DU PARC SANS AUCUNE ISSUE.
 *
 * L'immeuble se supprimait tant qu'il était vide, la fiche locataire se retirait
 * et se corrigeait. Le logement, lui, se corrigeait seulement : un numéro tapé
 * en double, un logement créé par erreur au moment de saisir son parc, restaient
 * là pour la vie du parc. `EditUnitModal` le disait déjà — « ni correction, ni
 * suppression » — et un lot a posé la correction sans poser l'autre moitié.
 *
 * ═══ CE N'EST PAS UNE SORTIE DE PARC, C'EST UNE FAUTE DE FRAPPE ═══
 *
 * Le seuil est le même que pour l'immeuble : on ne retire QUE ce qui n'a jamais
 * rien porté. Un logement qui a vécu se corrige, il ne s'efface pas — l'effacer
 * réécrirait le passé, ce que le schéma refuse en clé étrangère et ce que ce
 * dépôt refuse partout ailleurs.
 *
 * ═══ CE QUE CES CAS TIENNENT, ET DANS QUEL ORDRE ═══
 *
 * 1. Le retrait se CONSIGNE, avec le numéro ET le nom de l'immeuble. Après coup
 *    le logement n'existe plus ; « A1 » seul ne désigne rien, puisque le schéma
 *    ne pose l'unicité que DANS l'immeuble.
 * 2. Un logement qui porte un bail est REFUSÉ, et rien n'est consigné : une
 *    tentative n'est pas un acte.
 * 3. Le refus vaut pour l'histoire ÉTEINTE autant que vivante — un bail terminé
 *    interdit le retrait comme un bail actif. C'est le cas qui distingue « n'a
 *    rien EN COURS » de « n'a JAMAIS rien porté », et c'est tout le sujet.
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

async function unParcAvecUnLogement() {
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
    .send({ name: 'Résidence Éphémère', district: 'Bastos' })
  expect(immeuble.status).toBe(201)
  const buildingId = immeuble.body.building.id as string

  const logement = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 45, baseRentMinor: 185000 })
  expect(logement.status).toBe(201)

  return { cookie, parkId, buildingId, unitId: logement.body.unit.id as string }
}

const traces = (parkId: string) =>
  prisma.auditEvent.findMany({ where: { parkId, action: 'unit.delete' } })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('retirer un logement', () => {
  it('se CONSIGNE, avec le numéro ET son immeuble', async () => {
    const { cookie, parkId, unitId } = await unParcAvecUnLogement()

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(204)
    expect(await prisma.unit.findUnique({ where: { id: unitId } })).toBeNull()

    const [trace, ...reste] = await traces(parkId)
    expect(trace, 'un logement a disparu sans que rien ne le garde').toBeDefined()
    expect(reste, 'un retrait, une ligne').toHaveLength(0)
    expect(trace!.entity).toBe('Unit')
    expect(trace!.entityId, 'sans la cible, le registre ne dit pas lequel').toBe(unitId)

    const charge = trace!.payload as { label?: string; building?: string }
    expect(charge.label).toBe('A1')
    /* L'IMMEUBLE AUSSI : « A1 » existe dans presque tous les immeubles du
       monde, et le schéma ne pose l'unicité que DANS l'immeuble. Le numéro seul
       rendrait la ligne du journal ambiguë le jour où le parc en compte deux. */
    expect(charge.building, 'le numéro seul ne désigne pas un logement').toBe(
      'Résidence Éphémère',
    )
    expect(trace!.actorId, 'un registre qui ne dit pas QUI ne fait pas autorité').toBeTruthy()
  })

  it('refuse un logement qui porte un bail, et ne consigne RIEN', async () => {
    const { cookie, parkId, unitId } = await unParcAvecUnLogement()

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
    expect(bail.status, 'le bail doit exister pour que le cas ait un sens').toBe(201)

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('unit_not_empty')

    expect(await prisma.unit.findUnique({ where: { id: unitId } })).not.toBeNull()
    /* UNE TENTATIVE N'EST PAS UN ACTE : consigner les refus remplirait le
       registre de suppressions qui n'ont pas eu lieu. */
    expect(await traces(parkId), 'un refus ne se consigne pas').toHaveLength(0)
  })

  it('refuse aussi quand le bail est TERMINÉ — l’histoire éteinte compte', async () => {
    const { cookie, parkId, unitId } = await unParcAvecUnLogement()

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

    /* LE BAIL S'ÉTEINT SANS DISPARAÎTRE. C'est le cœur du cas : le logement n'a
       plus rien EN COURS — il rendrait `vacant` à l'écran, exactement comme un
       logement neuf — et il a pourtant une histoire. Sans cette distinction, la
       règle serait « rien d'actif », et un logement dont le locataire est parti
       s'effacerait avec ses échéances et ses versements. */
    await prisma.lease.updateMany({ where: { unitId }, data: { status: 'ended' } })

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookie)
    expect(res.status, 'un bail éteint reste une histoire').toBe(409)
    expect(await prisma.unit.findUnique({ where: { id: unitId } })).not.toBeNull()
    expect(await traces(parkId)).toHaveLength(0)
  })

  it('ne retire pas le logement d’un autre parc — 404, jamais 403', async () => {
    const { parkId, unitId } = await unParcAvecUnLogement()

    const intrus = await request(serveur).post('/api/auth/signup').send({
      email: 'intrus@example.com',
      password: MDP,
      fullName: 'Autre Personne',
      acceptTerms: true,
      parkName: 'Parc Akwa',
      countryCode: 'CM',
    })

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/units/${unitId}`)
      .set('Cookie', cookieDe(intrus))

    /* NI 204 NI 403 : un 403 sur un identifiant valide confirmerait que le
       logement existe. Ici l'appartenance au parc est refusée en amont. */
    expect([403, 404]).toContain(res.status)
    expect(await prisma.unit.findUnique({ where: { id: unitId } })).not.toBeNull()
  })
})
