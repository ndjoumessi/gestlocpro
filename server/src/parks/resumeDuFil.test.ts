import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { remplacerMessagerie, type Messagerie } from '../messagerie/messagerie.js'
import { envoyerLesResumesDuFil } from './resumeDuFil.js'

/**
 * LE RÉSUMÉ SE CHOISIT, ET NE TOUCHE QUE LA COPIE.
 *
 * ═══ CE QUE LE PRODUIT PROMET, ET QU'ON NE DÉFAIT PAS ═══
 *
 * L'écran du locataire dit, mot pour mot : « Votre gestionnaire et votre
 * bailleur le reçoivent IMMÉDIATEMENT. » Grouper les envois par défaut rendrait
 * cette phrase fausse pour tout le monde, sans que personne l'ait demandé.
 *
 * Le résumé est donc un CHOIX de celui qui reçoit, jamais un réglage du parc ni
 * un défaut. Et il ne touche que la COPIE : l'avis dans le produit reste
 * immédiat, la pastille s'allume à la seconde. C'est la même distinction que le
 * désabonnement — on renonce à la promptitude d'un doublon, pas à
 * l'information.
 *
 * ═══ CE QUE LE RÉSUMÉ EST, ET CE QU'IL N'EST PAS ═══
 *
 * Il se DÉRIVE des avis reçus depuis le dernier envoi. Pas de file d'attente,
 * pas de table de messages en partance : une file serait un second endroit où
 * la vérité vit, et elle divergerait du premier. Les avis sont déjà écrits,
 * datés, et rattachés à leur destinataire.
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

let visees: { adresse: string; sujet: string }[] = []
let rétablir: () => void = () => {}
const capture: Messagerie = {
  async envoyerSms() {
    return false
  },
  async envoyerEmail(adresse, sujet) {
    visees.push({ adresse, sujet })
    return true
  },
}

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
    .send({ unitId: a1.body.unit.id, fullName: 'Bekono Landry', userId: locataire.body.user.id })

  return { cookie, parkId, unitId: a1.body.unit.id as string, cookieLocataire: cookieDe(locataire) }
}

const signaler = (parkId: string, unitId: string, cookie: string, titre: string) =>
  request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/works`)
    .set('Cookie', cookie)
    .send({ title: titre, trade: 'plumbing', urgency: 'normal' })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  visees = []
  rétablir = remplacerMessagerie(capture)
})

afterEach(() => {
  rétablir()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
  await new Promise((resoudre) => serveur.close(resoudre))
})

describe('celui qui a choisi le résumé', () => {
  it('ne reçoit RIEN sur le moment', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })

    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')
    expect(visees, 'la copie attend le résumé').toEqual([])
  })

  it('garde son avis dans le produit, immédiat', async () => {
    /* « Votre gestionnaire et votre bailleur le reçoivent IMMÉDIATEMENT. » Le
       résumé ne touche que la copie ; la promesse tient. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })

    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')
    expect(await prisma.notification.count({ where: { parkId } })).toBeGreaterThan(0)
  })

  it('reçoit UN message pour trois signalements', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })

    for (const titre of ['Fuite sous l’évier', 'Volet bloqué', 'Manque de courant']) {
      await signaler(parkId, unitId, cookieLocataire, titre)
    }
    visees = []

    const envoyes = await envoyerLesResumesDuFil()
    expect(envoyes, 'un résumé, pas trois copies').toBe(1)
    expect(visees).toHaveLength(1)
    expect(visees[0]!.adresse).toBe('proprio@example.com')
  })

  it('ne reçoit rien deux fois : le second passage n’a plus rien à dire', async () => {
    /* Sans borne, chaque passage renverrait tout l'historique. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })
    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')

    await envoyerLesResumesDuFil()
    visees = []
    expect(await envoyerLesResumesDuFil(), 'rien de neuf depuis').toBe(0)
    expect(visees).toEqual([])
  })
})

describe('celui qui n’a rien choisi', () => {
  it('reçoit sa copie sur le moment, comme avant', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')
    expect(visees.map((v) => v.adresse), 'le défaut ne change pour personne').toEqual([
      'proprio@example.com',
    ])
  })

  it('n’entre dans aucun résumé', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')
    visees = []
    expect(await envoyerLesResumesDuFil()).toBe(0)
  })
})

describe('le désabonné', () => {
  it('ne reçoit ni copie ni résumé', async () => {
    /* Les deux réglages sont distincts et le premier l'emporte : se désabonner
       veut dire « rien », pas « plus tard ». */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailOptIn: false, threadEmailDigest: true })

    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')
    visees = []
    expect(await envoyerLesResumesDuFil()).toBe(0)
    expect(visees).toEqual([])
  })
})

describe('le premier résumé d’un compte', () => {
  /**
   * ═══ IL PRENAIT TOUT L'HISTORIQUE ═══
   *
   * `lastThreadDigestAt` nul voulait dire « aucune borne », donc « tout ce que
   * ce compte a jamais reçu ». C'était écrit et assumé — et c'est déplaisant :
   * quelqu'un qui coche le réglage un mardi reçoit six mois d'échanges le
   * lendemain, dont il a déjà lu chaque ligne dans le produit.
   *
   * LE CHOIX POSE LA BORNE. Cocher « les grouper » veut dire « résume-moi ce
   * qui viendra », pas « raconte-moi ce qui fut. »
   */
  it('ne remonte pas avant le moment où le réglage a été coché', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    /* Un échange AVANT le choix : il a déjà été reçu, en copie immédiate. */
    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')

    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })

    visees = []
    expect(
      await envoyerLesResumesDuFil(),
      'le premier résumé ne doit pas raconter ce qui précède le choix',
    ).toBe(0)
  })

  it('prend ce qui arrive APRÈS le choix', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })
    await signaler(parkId, unitId, cookieLocataire, 'Volet bloqué')

    visees = []
    expect(await envoyerLesResumesDuFil()).toBe(1)
  })
})

describe('le mode à blanc', () => {
  /*
    LE BLANC EST LA SEULE LECTURE QUI PRÉCÈDE LA DÉCISION D'ALLUMER.

    Il annonçait « 0 relance PARTIRAIENT » et se taisait sur les RÉSUMÉS, qui
    partent au même passage. Un compte-rendu qui ne couvre qu'une famille de
    courriels se lit comme s'il les couvrait toutes : c'est ainsi qu'on allume
    un envoi sur une mesure partielle en croyant l'avoir mesuré.
  */
  it('compte le résumé qui PARTIRAIT, sans rien envoyer', async () => {
    /* LES DEUX ASSERTIONS TIENNENT ENSEMBLE, et c'est délibéré : le compte
       seul s'accorderait pour la mauvaise raison — un envoi RÉEL rend 1 lui
       aussi. C'est le silence de la messagerie qui distingue le blanc. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })
    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')
    visees = []

    expect(await envoyerLesResumesDuFil({ aBlanc: true }), 'un résumé attend').toBe(1)
    expect(visees, 'à blanc ne veut pas dire « presque »').toEqual([])
  })

  it('n’avance pas la borne : le vrai passage trouve encore de quoi dire', async () => {
    /* Une borne avancée à blanc ferait DISPARAÎTRE le résumé qu'on venait
       d'annoncer — la lecture aurait consommé ce qu'elle décrivait. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailDigest: true })
    await signaler(parkId, unitId, cookieLocataire, 'Fuite sous l’évier')
    visees = []

    await envoyerLesResumesDuFil({ aBlanc: true })
    expect(await envoyerLesResumesDuFil(), 'le blanc n’a rien consommé').toBe(1)
    expect(visees).toHaveLength(1)
  })
})
