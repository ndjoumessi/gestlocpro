import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE SIGNALEMENT DU LOCATAIRE ARRIVE CHEZ LE BAILLEUR.
 *
 * ═══ UNE PROMESSE ÉCRITE, ET PAS TENUE ═══
 *
 * L'écran « Signaler un problème » affirme, en toutes lettres, sous son titre :
 * « Votre gestionnaire et votre bailleur le reçoivent IMMÉDIATEMENT. »
 *
 * Ils ne recevaient rien. La route de création d'une intervention écrit un
 * `WorkOrder` et rien d'autre — aucune `Notification`. Côté bailleur,
 * « Signalements et notifications » lit les notifications ; il affichait donc
 * « Rien à signaler sur le parc » pendant que le locataire lisait, dans son
 * propre espace, « SIG-2026-001 · Signalé ». Capturé sur la production le
 * 2026-08-31, les deux écrans côte à côte.
 *
 * Le chantier existait bel et bien, rangé dans « Travaux ». Mais un signalement
 * qu'il faut aller CHERCHER n'est pas reçu — et le locataire, lui, croit avoir
 * alerté quelqu'un. C'est la pire moitié du défaut : il ne relance pas.
 *
 * ═══ LE CHEMIN INVERSE EXISTAIT DÉJÀ ═══
 *
 * `workReply` prévient le LOCATAIRE quand le gestionnaire répond. Le sens
 * montant manquait, seul, depuis l'origine — et son absence ne se voyait pas,
 * puisque la donnée était écrite quelque part.
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

/** Un parc, un gestionnaire, et un locataire relié à son logement. */
async function parcAvecUnLocataireEnPlace() {
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

  /** Le gestionnaire : il doit recevoir le signalement, lui aussi. */
  const invGes = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  const gestionnaire = await request(serveur).post('/api/auth/signup').send({
    email: 'diane@example.com',
    password: MDP,
    fullName: 'Diane Mballa',
    acceptTerms: true,
    invitationCode: invGes.body.code,
  })

  /** Le locataire, sa fiche créée AVEC son compte. */
  const invLoc = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant' })
  const locataire = await request(serveur).post('/api/auth/signup').send({
    email: 'romel@example.com',
    password: MDP,
    fullName: 'Bekono Landry',
    acceptTerms: true,
    invitationCode: invLoc.body.code,
  })
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekono Landry', userId: locataire.body.user.id })

  return {
    cookie,
    parkId,
    unitId,
    cookieLocataire: cookieDe(locataire),
    proprioId: proprio.body.user.id as string,
    gestionnaireId: gestionnaire.body.user.id as string,
    locataireId: locataire.body.user.id as string,
  }
}

/** Le locataire signale une fuite, comme depuis son écran. */
async function signaler(parkId: string, unitId: string, cookieLocataire: string) {
  return request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/works`)
    .set('Cookie', cookieLocataire)
    .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'normal' })
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

describe('un signalement de locataire', () => {
  it('arrive dans les notifications du propriétaire', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataireEnPlace()

    const avant = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    expect(
      avant.body.notifications,
      'le montage du cas est faux : le parc portait déjà une notification',
    ).toHaveLength(0)

    const cree = await signaler(parkId, unitId, cookieLocataire)
    expect(cree.status, `signalement refusé : ${JSON.stringify(cree.body)}`).toBe(201)

    const apres = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    const notif = (apres.body.notifications as { messageKey: string }[]).find(
      (n) => n.messageKey === 'tenantReport',
    )
    expect(
      notif,
      'l’écran du bailleur dira « rien à signaler » pendant que le locataire croit avoir alerté',
    ).toBeDefined()
  })

  it('arrive aussi chez le gestionnaire, à qui l’écran le promet', async () => {
    const { parkId, unitId, cookieLocataire, gestionnaireId, proprioId } =
      await parcAvecUnLocataireEnPlace()
    await signaler(parkId, unitId, cookieLocataire)

    const notif = await prisma.notification.findFirst({
      where: { parkId, messageKey: 'tenantReport' },
      select: { recipients: { select: { userId: true } } },
    })
    const destinataires = (notif?.recipients ?? []).map((r) => r.userId).sort()
    expect(destinataires, 'le gestionnaire ne reçoit pas ce que l’écran lui promet').toEqual(
      [proprioId, gestionnaireId].sort(),
    )
  })

  it('ne revient PAS au locataire qui vient de l’écrire', async () => {
    /* Il sait ce qu'il a signalé — son espace le lui montre déjà sous « Mes
       signalements ». Une notification de sa propre déclaration ferait de sa
       liste un écho, et l'habituerait à ignorer ce qui s'y pose. */
    const { parkId, unitId, cookieLocataire, locataireId } = await parcAvecUnLocataireEnPlace()
    await signaler(parkId, unitId, cookieLocataire)

    const notif = await prisma.notification.findFirst({
      where: { parkId, messageKey: 'tenantReport' },
      select: { recipients: { select: { userId: true } } },
    })
    expect((notif?.recipients ?? []).map((r) => r.userId)).not.toContain(locataireId)
  })

  it('porte de quoi ouvrir le chantier dont il parle', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataireEnPlace()
    const cree = await signaler(parkId, unitId, cookieLocataire)

    const parc = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    const notif = (parc.body.notifications as { messageKey: string; params: Record<string, unknown>; unitId: string | null }[])
      .find((n) => n.messageKey === 'tenantReport')!

    /* Sans `workId`, la carte parle d'un signalement qu'on ne peut pas ouvrir —
       c'est la leçon déjà écrite pour `workReply`. */
    /**
     * LE LOGEMENT, PAR SON LIBELLÉ ET NON PAR SON IDENTIFIANT.
     *
     * La carte compose « Signalement {reference} · {unit} », et `{unit}` se
     * résout depuis `params.unitId` — c'est la convention que les autres avis
     * du serveur suivent déjà, où l'on trouve « A3 » et non un `uuid`. Le
     * premier jet ne posait le logement que dans la COLONNE de la
     * notification : capturé sur la production, la carte affichait
     * « Signalement SIG-2026-002 · {unit} », accolades comprises.
     */
    expect(notif.params.unitId, 'la carte affichera « {unit} » en toutes lettres').toBe('A1')
    expect(notif.params.workId).toBe(cree.body.work.id)
    expect(notif.params.reference).toBe(cree.body.work.reference)
    expect(notif.unitId, 'la carte ne dit pas de quel logement il s’agit').toBe(unitId)
  })

  it('ne se pose PAS quand c’est le bailleur qui ouvre le chantier', async () => {
    /* La moitié sans laquelle notifier tout le monde à chaque chantier
       satisferait les cas précédents. Un propriétaire qui ouvre une
       intervention n'a pas à s'annoncer à lui-même. */
    const { cookie, parkId, unitId } = await parcAvecUnLocataireEnPlace()
    await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', cookie)
      .send({ title: 'Ravalement', trade: 'painting', urgency: 'low' })

    const parc = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    expect(
      (parc.body.notifications as { messageKey: string }[]).filter(
        (n) => n.messageKey === 'tenantReport',
      ),
    ).toHaveLength(0)
  })
})
