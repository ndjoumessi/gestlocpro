import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'
import { remplacerMessagerie, type Messagerie } from '../messagerie/messagerie.js'

/**
 * QUI D'AUTRE PERD SON ESPACE QUAND UN COMPTE SE FERME.
 *
 * ═══ LA DETTE QUE CE LOT FERME ═══
 *
 * 935bf14 et 0c2a52a l'écrivaient noir sur blanc dans leur section « ce que je
 * peux avoir raté » : « LES LOCATAIRES NE SONT PAS PRÉVENUS », « un compte qui
 * se ferme en étant seul propriétaire d'un parc où travaille un gestionnaire
 * emporte le travail de ce dernier ».
 *
 * Un locataire découvrait donc, un matin, que son portail n'existait plus — ses
 * quittances, ses états des lieux, l'historique de sa caution. Sans avertissement,
 * il n'avait eu aucune occasion d'en garder copie.
 *
 * ═══ PRÉVENIR À LA FERMETURE, PAS À L'EFFACEMENT ═══
 *
 * Choisi par Nelson le 2026-09-16 : prévenus le jour de la demande, ils ont les
 * trente jours pour exporter. Prévenir à l'effacement serait annoncer une
 * disparition déjà faite.
 *
 * ═══ CE QUE LES CAS TIENNENT ═══
 *
 *  1. CHAQUE LOCATAIRE ET CHAQUE GESTIONNAIRE du parc emporté est prévenu, avec
 *     la DATE.
 *  2. PERSONNE N'EST PRÉVENU POUR UN PARC QUI SURVIT — un parc à deux
 *     propriétaires n'est pas effacé, et annoncer sa disparition serait une
 *     fausse alerte adressée à des tiers.
 *  3. UN ENVOI QUI ÉCHOUE NE FAIT PAS ÉCHOUER LA FERMETURE. Le droit de la
 *     personne ne dépend pas de la santé d'un fournisseur de courriels.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`aucun cookie de session — ${res.status}`)
  return trouve
}

let envois: { destinataire: string; sujet: string; texte: string }[] = []
let rendre = true
let retablir: () => void

const messagerieDeSonde: Messagerie = {
  async envoyerSms() {
    return rendre
  },
  async envoyerEmail(destinataire, sujet, corps) {
    envois.push({ destinataire, sujet, texte: corps.texte })
    return rendre
  },
}

/** Un parc avec un gestionnaire, un locataire relié à un compte, et un sans compte. */
async function parcHabite() {
  const inscription = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Djoumessi Nelson',
    confirmLegal: true,
    parkName: 'Parc Bonamoussadi',
    countryCode: 'CM',
  })
  const cookie = cookieDe(inscription)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Résidence', district: 'Bastos' })
  const unite = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 50, baseRentMinor: 100000 })

  const invitationGestion = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  await request(serveur).post('/api/auth/signup').send({
    email: 'cabinet@example.com',
    password: MDP,
    fullName: 'Cabinet Njoya',
    confirmLegal: true,
    /* CE CABINET LIT L'ANGLAIS : c'est ce qui rend les cas de langue possibles,
       et le reste du parc n'en est pas affecté. */
    locale: 'en',
    invitationCode: invitationGestion.body.code,
  })

  const invitationLocataire = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant', unitId: unite.body.unit.id })
  const locataire = await request(serveur).post('/api/auth/signup').send({
    email: 'locataire@example.com',
    password: MDP,
    fullName: 'Bekono Landry',
    confirmLegal: true,
    invitationCode: invitationLocataire.body.code,
  })
  expect(locataire.status, JSON.stringify(locataire.body)).toBe(201)

  /* Une fiche SANS compte, avec une adresse : elle existe dans tout parc réel,
     et son occupant perd le même portail que les autres. */
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId: unite.body.unit.id, fullName: 'Ondoa Pierre', email: 'ondoa@example.com' })

  return { cookie, parkId }
}

const fermer = (cookie: string) =>
  request(serveur).post('/api/auth/me/closure').set('Cookie', cookie)

const seConnecter = () =>
  request(serveur)
    .post('/api/auth/login')
    .send({ email: 'proprio@example.com', password: MDP })

const seReconnecter = () =>
  request(serveur)
    .post('/api/auth/login')
    .send({ email: 'proprio@example.com', password: MDP })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  envois = []
  rendre = true
  retablir = remplacerMessagerie(messagerieDeSonde)
})

afterEach(() => {
  retablir()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
  await new Promise((resoudre) => serveur.close(resoudre))
})

describe('l’avertissement des tiers à la fermeture', () => {
  it('prévient chaque locataire et chaque gestionnaire, avec la date', async () => {
    const { cookie } = await parcHabite()

    const res = await fermer(cookie).expect(200)
    const jour = new Date(res.body.effaceLe).toISOString().slice(0, 10)

    const destinataires = envois.map((e) => e.destinataire).sort()
    /* TROIS : le gestionnaire, le locataire entré par un code — qui n'a PAS de
       fiche, et que la première rédaction oubliait —, et la fiche sans compte. */
    expect(destinataires).toEqual(
      ['cabinet@example.com', 'locataire@example.com', 'ondoa@example.com'].sort(),
    )
    /* LE PROPRIÉTAIRE N'EST PAS PRÉVENU PAR COURRIEL : il vient de le demander,
       et l'écran lui a déjà dit la date. Un courriel de plus ferait douter. */
    expect(destinataires).not.toContain('proprio@example.com')

    for (const envoi of envois) {
      expect(envoi.texte, `${envoi.destinataire} n’a pas la date`).toContain(jour)
      expect(envoi.texte).toContain('Parc Bonamoussadi')
    }
  })

  it('ne prévient personne quand le parc va survivre', async () => {
    const { cookie, parkId } = await parcHabite()
    const associe = await request(serveur).post('/api/auth/signup').send({
      email: 'associe@example.com',
      password: MDP,
      fullName: 'Associée',
      confirmLegal: true,
    })
    await prisma.membership.create({
      data: { parkId, userId: associe.body.user.id, role: 'owner', status: 'active' },
    })

    await fermer(cookie).expect(200)

    /* Le parc a un second propriétaire : l'effacement ne l'emportera pas, donc
       personne n'a à être alarmé. C'est le MÊME calcul que celui du balayage —
       prévenir plus large que ce qui sera effacé serait une fausse alerte. */
    expect(envois).toEqual([])
  })

  it('n’échoue pas quand le courriel ne part pas', async () => {
    const { cookie } = await parcHabite()
    rendre = false

    const res = await fermer(cookie)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(typeof res.body.effaceLe).toBe('string')
    /* La demande est enregistrée quoi qu'il arrive au fournisseur. */
    expect(
      (await prisma.userAccount.findUniqueOrThrow({ where: { email: 'proprio@example.com' } }))
        .closureRequestedAt,
    ).not.toBeNull()
  })
})

/**
 * L'ANNULATION SE DIT AUSSI, ET C'EST LA MOITIÉ QUI MANQUAIT.
 *
 * 4fe498d a livré l'avertissement et nommé ce trou dans sa section « ce que je
 * peux avoir raté » : « qui se reconnecte annule la fermeture, et les locataires
 * gardent un courriel qui annonce une suppression qui n'aura pas lieu ».
 *
 * Un locataire prévenu puis laissé sans nouvelle fait l'une de deux choses : il
 * déménage ses pièces pour rien, ou — pire — il attend la disparition annoncée
 * et cesse de se servir d'un portail qui existe toujours. Une alerte qu'on ne
 * lève pas est une alerte qui ment.
 */
describe('l’annonce de l’annulation', () => {
  it('prévient les mêmes personnes que la fermeture', async () => {
    const { cookie } = await parcHabite()
    await fermer(cookie).expect(200)
    const avertis = envois.map((e) => e.destinataire).sort()
    expect(avertis.length).toBeGreaterThan(0)

    envois = []
    const reconnexion = await seReconnecter()
    expect(reconnexion.body.fermetureAnnulee).toBe(true)

    expect(envois.map((e) => e.destinataire).sort()).toEqual(avertis)
    for (const envoi of envois) {
      /* LE MESSAGE LÈVE L'ALERTE, en toutes lettres : « ne sera pas supprimé ».
         Un courriel qui se contenterait de ne plus parler de date laisserait le
         lecteur avec les deux messages et aucun moyen de les départager. */
      /* Dans la langue de chacun — le cabinet lit l'anglais. La négation reste
         EXIGÉE des deux côtés : c'est elle qui lève l'alerte. */
      expect(envoi.texte, envoi.destinataire).toMatch(/ne sera pas supprimé|will not be deleted/)
      expect(envoi.texte).toContain('Parc Bonamoussadi')
    }
  })

  it('ne dit rien à une connexion ordinaire', async () => {
    const { cookie } = await parcHabite()
    expect(cookie).toBeTruthy()
    envois = []

    const reconnexion = await seReconnecter()
    expect(reconnexion.status).toBe(200)
    expect(reconnexion.body.fermetureAnnulee).toBeUndefined()
    expect(envois).toEqual([])
  })

  it('laisse entrer même si le courriel ne part pas', async () => {
    const { cookie } = await parcHabite()
    await fermer(cookie).expect(200)
    rendre = false

    const reconnexion = await seReconnecter()
    expect(reconnexion.status, JSON.stringify(reconnexion.body)).toBe(200)
    /* La fermeture est bien annulée : le droit de se raviser ne dépend pas
       davantage du fournisseur de courriels que celui de partir. */
    expect(
      (await prisma.userAccount.findUniqueOrThrow({ where: { email: 'proprio@example.com' } }))
        .closureRequestedAt,
    ).toBeNull()
  })
})

/**
 * CHACUN DANS SA LANGUE — le dernier couple de gabarits resté monolingue.
 *
 * Le fil d'un signalement et la relance de loyer parlent déjà la langue du
 * destinataire (`relanceDansSaLangue.test.ts`). Les deux courriels de fermeture,
 * eux, partaient en français à tout le monde, alors que `UserAccount.locale`
 * porte la réponse depuis l'origine — et ces messages-là annoncent la
 * disparition de documents : les envoyer dans une langue qu'on ne lit pas, c'est
 * les envoyer pour rien.
 *
 * SANS COMPTE, LE FRANÇAIS. Une fiche de locataire ne porte pas de langue ; le
 * défaut du produit s'applique, comme pour la relance.
 */
describe('la langue des courriels de fermeture', () => {
  it('écrit à chacun dans la sienne, à la fermeture comme à l’annulation', async () => {
    const { cookie } = await parcHabite()

    await fermer(cookie).expect(200)
    const anglais = envois.find((e) => e.destinataire === 'cabinet@example.com')!
    const francais = envois.find((e) => e.destinataire === 'locataire@example.com')!
    expect(anglais.sujet).toMatch(/will be deleted/)
    expect(anglais.texte).toMatch(/will be deleted on/)
    expect(francais.sujet).toMatch(/sera supprimé/)
    expect(francais.texte).toMatch(/sera supprimé de GestLocPro le/)

    envois = []
    await seReconnecter()
    const leveeAnglaise = envois.find((e) => e.destinataire === 'cabinet@example.com')!
    const leveeFrancaise = envois.find((e) => e.destinataire === 'locataire@example.com')!
    expect(leveeAnglaise.texte).toMatch(/will not be deleted/)
    expect(leveeFrancaise.texte).toMatch(/ne sera pas supprimé/)
  })

  it('écrit en français à une fiche sans compte', async () => {
    const { cookie } = await parcHabite()
    await fermer(cookie).expect(200)

    const sansCompte = envois.find((e) => e.destinataire === 'ondoa@example.com')!
    expect(sansCompte.texte).toMatch(/sera supprimé de GestLocPro le/)
  })
})

/**
 * ON DÉTROMPE CEUX QU'ON A PRÉVENUS — pas ceux qui sont là au moment où l'on
 * se ravise.
 *
 * 8495f18 recalculait la liste à l'annulation, et le nommait dans sa section
 * « ce que je peux avoir raté » : « un locataire parti entre la fermeture et
 * l'annulation ne sera pas détrompé — il gardera l'annonce d'une suppression qui
 * n'a pas eu lieu ».
 *
 * C'est la personne la plus mal placée pour deviner : elle a quitté le parc,
 * elle ne peut plus ouvrir le produit pour vérifier, et le seul message qu'elle
 * possède annonce la disparition de ses quittances.
 *
 * LA LISTE EST DONC ÉCRITE À LA FERMETURE, et relue à l'annulation.
 */
describe('la liste des prévenus', () => {
  it('détrompe un locataire retiré du parc entre-temps', async () => {
    const { cookie, parkId } = await parcHabite()
    await fermer(cookie).expect(200)
    expect(envois.map((e) => e.destinataire)).toContain('ondoa@example.com')

    /* La fiche s'en va — le bailleur la retire pendant le délai. */
    const fiche = await prisma.tenant.findFirstOrThrow({
      where: { parkId, email: 'ondoa@example.com' },
      select: { id: true },
    })
    await prisma.lease.deleteMany({ where: { tenantId: fiche.id } })
    await prisma.tenant.delete({ where: { id: fiche.id } })

    envois = []
    await seReconnecter()

    expect(envois.map((e) => e.destinataire)).toContain('ondoa@example.com')
  })

  it('ne détrompe pas un arrivant que personne n’avait prévenu', async () => {
    const { cookie, parkId } = await parcHabite()
    await fermer(cookie).expect(200)

    /* Une fiche créée APRÈS la fermeture : elle n'a reçu aucune alerte, et lui
       annoncer qu'un parc « ne sera pas supprimé » serait lui apprendre qu'on a
       failli le faire. */
    await prisma.tenant.create({
      data: { parkId, fullName: 'Arrivée Tardive', email: 'tardive@example.com' },
    })

    envois = []
    await seReconnecter()

    expect(envois.map((e) => e.destinataire)).not.toContain('tardive@example.com')
  })

  it('ne redit rien à une seconde connexion, et ne garde pas la liste', async () => {
    const { cookie } = await parcHabite()
    await fermer(cookie).expect(200)
    await seReconnecter()

    envois = []
    await seReconnecter()
    expect(envois).toEqual([])
    /* LA LISTE EST CONSOMMÉE. Le cas ci-dessus ne le prouve PAS — c'est le
       drapeau d'annulation qui l'empêche de repartir, mesuré par mutation. Ce
       qu'une liste laissée derrière soi produirait se voit à la fermeture
       SUIVANTE : elle porterait encore des adresses d'une fermeture révolue. */
    expect(await prisma.closureWarning.count()).toBe(0)
  })

  it('repart d’une liste neuve à la fermeture suivante', async () => {
    const { cookie, parkId } = await parcHabite()
    await fermer(cookie).expect(200)
    await seReconnecter()

    /* La fiche part APRÈS la première fermeture, donc après avoir été prévenue
       puis détrompée : la fermeture suivante ne la concerne plus. */
    const fiche = await prisma.tenant.findFirstOrThrow({
      where: { parkId, email: 'ondoa@example.com' },
      select: { id: true },
    })
    await prisma.lease.deleteMany({ where: { tenantId: fiche.id } })
    await prisma.tenant.delete({ where: { id: fiche.id } })

    const cookieNeuf = cookieDe(await seConnecter())
    envois = []
    await fermer(cookieNeuf).expect(200)
    expect(envois.map((e) => e.destinataire)).not.toContain('ondoa@example.com')

    envois = []
    await seReconnecter()
    expect(envois.map((e) => e.destinataire)).not.toContain('ondoa@example.com')
  })
})
