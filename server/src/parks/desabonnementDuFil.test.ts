import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { remplacerMessagerie, type Messagerie } from '../messagerie/messagerie.js'

/**
 * ON PEUT CESSER DE RECEVOIR LES COPIES, SANS CESSER D'ÊTRE PRÉVENU.
 *
 * ═══ POURQUOI CE LOT EXISTE MAINTENANT ═══
 *
 * Le canal e-mail a été ouvert sans réglage, et vérification faite des
 * variables de production, `RESEND_API_KEY` y est posée : les copies partent
 * RÉELLEMENT depuis le déploiement. Un gestionnaire qui suit trente logements
 * les reçoit toutes, et n'avait aucun moyen de dire « par le produit
 * seulement ».
 *
 * ═══ LE PRODUIT N'EST JAMAIS COUPÉ ═══
 *
 * C'est la distinction qui porte tout ce lot. Se désabonner retire la COPIE,
 * pas la notification : l'avis reste dans le produit, la pastille s'allume, le
 * fil se lit. On renonce à un doublon, pas à l'information — et un réglage qui
 * pourrait faire manquer une fuite d'eau ne serait pas un réglage, ce serait un
 * piège.
 *
 * ═══ PAR PERSONNE, PAS PAR PARC ═══
 *
 * Le choix appartient à qui reçoit. Il vit donc sur le COMPTE et vaut partout :
 * un gestionnaire de trois parcs ne veut pas répéter le même geste trois fois,
 * et un propriétaire ne décide pas de la boîte aux lettres de son cabinet.
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

/** Les adresses réellement visées par la messagerie, dans l'ordre. */
let visees: string[] = []
const messagerieDeSonde: Messagerie = {
  async envoyerSms() {
    return false
  },
  async envoyerEmail(adresse: string) {
    visees.push(adresse)
    return true
  },
}
let rétablir: () => void = () => {}

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

const signaler = (parkId: string, unitId: string, cookie: string) =>
  request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/works`)
    .set('Cookie', cookie)
    .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'normal' })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  visees = []
  rétablir = remplacerMessagerie(messagerieDeSonde)
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

describe('le réglage', () => {
  it('vaut oui par défaut — personne ne perd ce qu’il recevait', async () => {
    const { cookie } = await parcAvecUnLocataire()
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(
      moi.body.user.threadEmailOptIn,
      'un défaut à faux couperait tout le monde à la seconde du déploiement',
    ).toBe(true)
  })

  it('se coupe et se rallume par son propre compte', async () => {
    const { cookie } = await parcAvecUnLocataire()
    const coupe = await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailOptIn: false })
    expect(coupe.status).toBe(200)
    expect(coupe.body.user.threadEmailOptIn).toBe(false)

    const rallume = await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailOptIn: true })
    expect(rallume.body.user.threadEmailOptIn, 'un réglage sans retour est un piège').toBe(true)
  })
})

describe('le désabonné', () => {
  it('ne reçoit plus la copie', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailOptIn: false })

    await signaler(parkId, unitId, cookieLocataire)
    expect(visees, 'le geste doit avoir un effet sur le canal').toEqual([])
  })

  it('garde l’avis DANS le produit — on renonce au doublon, pas à l’information', async () => {
    /* Un réglage qui pourrait faire manquer une fuite d'eau ne serait pas un
       réglage, ce serait un piège. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailOptIn: false })

    await signaler(parkId, unitId, cookieLocataire)
    const avis = await prisma.notification.count({ where: { parkId } })
    expect(avis, 'la notification du produit ne dépend pas du canal e-mail').toBeGreaterThan(0)
  })

  it('ne consigne AUCUNE tentative — rien n’a été tenté', async () => {
    /* La trace dit ce qui a été tenté. Consigner une copie qu'on a choisi de ne
       pas envoyer ferait mentir le compteur du fil dans l'autre sens. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailOptIn: false })

    const w = await signaler(parkId, unitId, cookieLocataire)
    const traces = await prisma.workThreadEmail.count({ where: { workId: w.body.work.id } })
    expect(traces).toBe(0)
  })
})

describe('l’abonné voisin', () => {
  it('reçoit encore, quand un autre s’est désabonné', async () => {
    /* Le choix appartient à qui reçoit, un par un : un désabonnement qui
       éteindrait le canal pour toute l'équipe serait une décision prise à la
       place des autres. */
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const inv = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager' })
    await request(serveur).post('/api/auth/signup').send({
      email: 'cabinet@example.com',
      password: MDP,
      fullName: 'Cabinet Njoya',
      acceptTerms: true,
      invitationCode: inv.body.code,
    })
    await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ threadEmailOptIn: false })

    await signaler(parkId, unitId, cookieLocataire)
    expect(visees, 'seul le désabonné se retire').toEqual(['cabinet@example.com'])
  })
})

describe('le courriel lui-même', () => {
  /**
   * ═══ LE PIED DE MESSAGE, QUE TOUT EXPÉDITEUR PORTE ═══
   *
   * Le lot qui a posé le réglage le nommait en dette : « rien dans le COURRIEL
   * ne dit comment se désabonner — il faut ouvrir le produit et trouver le
   * menu ». Or c'est dans la boîte aux lettres qu'on décide de ne plus recevoir,
   * pas dans un produit qu'on n'a peut-être pas ouvert depuis un mois.
   *
   * UN LIEN VERS LE PRODUIT, PAS UN LIEN QUI DÉSABONNE. Une URL qui coupe le
   * canal d'un simple clic est une URL qu'un aperçu de messagerie déclenche en
   * la préchargeant, et le désabonnement le plus dangereux est celui que
   * personne n'a demandé. Le lien ouvre l'espace ; le geste reste un geste.
   */
  const gabarits: { sujet: string; texte: string; html: string }[] = []

  it('porte le pied dans ses DEUX corps', async () => {
    /* Le texte brut et le HTML sont deux messages, et un client qui n'affiche
       que le premier ne doit pas perdre le pied. */
    const { parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const capture: Messagerie = {
      async envoyerSms() {
        return false
      },
      async envoyerEmail(_adresse, _sujet, corps) {
        gabarits.push(corps as { sujet: string; texte: string; html: string })
        return true
      },
    }
    const rendre2 = remplacerMessagerie(capture)
    await signaler(parkId, unitId, cookieLocataire)
    rendre2()

    const envoye = gabarits[0]
    expect(envoye, 'aucune copie capturée').toBeDefined()
    expect(envoye!.texte, 'on décide de ne plus recevoir dans sa boîte, pas ailleurs').toMatch(
      /copies par e-mail/i,
    )
    expect(envoye!.html).toMatch(/copies par e-mail/i)
  })

  it('mène au produit, et ne désabonne pas d’un clic', async () => {
    /* Une URL qui coupe le canal est une URL qu'un aperçu de messagerie
       déclenche en la préchargeant. */
    const envoye = gabarits[0]
    expect(envoye!.html).toContain('http')
    expect(envoye!.html, 'un lien qui agit tout seul n’est pas un lien').not.toMatch(
      /unsubscribe|desabonner/i,
    )
  })
})

describe('une adresse sans compte', () => {
  /**
   * ═══ UNE RÉGRESSION QUE J'AI INTRODUITE, ET CE QU'ELLE COÛTAIT ═══
   *
   * Le filtre des abonnés a été écrit à l'envers : il ne GARDAIT que les
   * adresses trouvées dans `UserAccount` avec le drapeau à vrai. Or la route de
   * réponse vise `reportedByTenant.user?.email ?? reportedByTenant.email` — la
   * seconde branche est le courriel de la FICHE, celui d'un locataire qui n'a
   * pas de compte. Ces adresses n'étant dans aucun compte, elles tombaient
   * toutes : le locataire sans compte ne recevait plus la réponse de son
   * bailleur, silencieusement, depuis ce lot-là.
   *
   * ═══ LA RÈGLE JUSTE : ON EXCLUT LES DÉSABONNÉS, ON NE GARDE PAS LES ABONNÉS ═══
   *
   * Seul un COMPTE peut porter une préférence. Une adresse qui n'en a pas n'a
   * rien refusé — elle n'est donc pas désabonnée. Le filtre doit retrancher ce
   * qui a dit non, jamais présumer un non de ce qui n'a rien dit.
   */
  it('reçoit encore, faute de compte pour avoir dit non', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLocataire()
    /* Une fiche SANS `userId` : elle porte un courriel et aucun compte. */
    const fiche = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', cookie)
      .send({ title: 'Volet bloqué', trade: 'other', urgency: 'low' })
    await prisma.tenant.updateMany({
      where: { parkId },
      data: { userId: null, email: 'sans-compte@example.com' },
    })
    await prisma.workOrder.update({
      where: { id: fiche.body.work.id },
      data: { reportedByTenantId: (await prisma.tenant.findFirstOrThrow({ where: { parkId } })).id },
    })

    visees = []
    await request(serveur)
      .post(`/api/parks/${parkId}/works/${fiche.body.work.id}/reply`)
      .set('Cookie', cookie)
      .send({ message: 'Le menuisier passe jeudi.' })

    expect(
      visees,
      'une adresse sans compte n’a rien refusé — la présumer désabonnée la coupe',
    ).toEqual(['sans-compte@example.com'])
  })
})

describe('la langue du courriel', () => {
  /**
   * ═══ CHACUN DANS LA SIENNE, ET LE PRODUIT LA CONNAISSAIT ═══
   *
   * `UserAccount.locale` existe depuis l'origine et pilote toute l'interface.
   * Les gabarits, eux, étaient en français pour tout le monde : un locataire
   * anglophone lisait son espace en anglais et recevait ses courriels en
   * français. Le seul trou de ce canal qui atteigne des gens hors de l'équipe.
   *
   * ═══ PAR DESTINATAIRE, ET NON PAR MESSAGE ═══
   *
   * Un signalement part vers un bailleur francophone ET son gestionnaire
   * anglophone : c'est la même phrase, dans deux langues. Le gabarit se compose
   * donc une fois PAR ADRESSE, après la lecture de sa langue — un gabarit unique
   * calculé d'avance imposerait la langue du premier à tous.
   *
   * SANS COMPTE, LE FRANÇAIS. Une fiche locataire ne porte pas de langue, et le
   * défaut du produit est le français.
   */
  it('écrit à chacun dans la sienne, dans le même envoi', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnLocataire()
    const inv = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager' })
    await request(serveur).post('/api/auth/signup').send({
      email: 'cabinet@example.com',
      password: MDP,
      fullName: 'Cabinet Njoya',
      acceptTerms: true,
      invitationCode: inv.body.code,
    })
    await prisma.userAccount.update({
      where: { email: 'cabinet@example.com' },
      data: { locale: 'en' },
    })

    const corps: { adresse: string; sujet: string }[] = []
    const capture: Messagerie = {
      async envoyerSms() {
        return false
      },
      async envoyerEmail(adresse, sujet) {
        corps.push({ adresse, sujet })
        return true
      },
    }
    const rendre2 = remplacerMessagerie(capture)
    await signaler(parkId, unitId, cookieLocataire)
    rendre2()

    const fr = corps.find((c) => c.adresse === 'proprio@example.com')
    const en = corps.find((c) => c.adresse === 'cabinet@example.com')
    expect(fr?.sujet, 'le francophone garde sa langue').toContain('Nouveau signalement')
    expect(en?.sujet, 'un gabarit unique imposerait la langue du premier à tous').toContain(
      'New report',
    )
  })

  it('retombe sur le français pour une adresse sans compte', async () => {
    /* Une fiche locataire ne porte pas de langue, et le défaut du produit est le
       français. */
    const { cookie, parkId, unitId } = await parcAvecUnLocataire()
    const w = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', cookie)
      .send({ title: 'Volet bloqué', trade: 'other', urgency: 'low' })
    await prisma.tenant.updateMany({
      where: { parkId },
      data: { userId: null, email: 'sans-compte@example.com' },
    })
    await prisma.workOrder.update({
      where: { id: w.body.work.id },
      data: { reportedByTenantId: (await prisma.tenant.findFirstOrThrow({ where: { parkId } })).id },
    })

    const sujets: string[] = []
    const capture: Messagerie = {
      async envoyerSms() {
        return false
      },
      async envoyerEmail(_a, sujet) {
        sujets.push(sujet)
        return true
      },
    }
    const rendre2 = remplacerMessagerie(capture)
    await request(serveur)
      .post(`/api/parks/${parkId}/works/${w.body.work.id}/reply`)
      .set('Cookie', cookie)
      .send({ message: 'Le menuisier passe jeudi.' })
    rendre2()

    expect(sujets[0]).toContain('Réponse à votre signalement')
  })
})
