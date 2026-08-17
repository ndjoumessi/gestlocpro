import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'
import { empreinteJeton } from './token.js'

/**
 * Inscription, connexion, session.
 *
 * Ce qui est gardé ici n'est pas « on peut se connecter » — c'est l'ensemble
 * des propriétés dont l'absence ne se voit jamais à l'usage : le cookie
 * inaccessible au script, la session réellement révoquée à la déconnexion,
 * l'impossibilité de savoir si une adresse existe.
 */
const app = createApp()
/**
 * Un serveur unique pour le fichier : `request(serveur)` en ouvrait un par appel.
 * Voir `parks/routes.test.ts`, où la collision de ports éphémères se voyait —
 * une exécution sur trois, jamais au même endroit.
 */
const serveur = app.listen(0)

const INSCRIPTION = {
  email: 'sarah@example.com',
  password: 'un-mot-de-passe-assez-long',
  fullName: 'Sarah Ngassa',
  acceptTerms: true,
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await new Promise((resoudre) => serveur.close(resoudre))
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
})

/** Extrait la valeur du cookie de session d'une réponse. */
function cookieDe(res: request.Response): string | undefined {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  return liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
}

describe('inscription', () => {
  it('crée le compte, ouvre la session et ne rend jamais l’empreinte', async () => {
    const res = await request(serveur).post('/api/auth/signup').send(INSCRIPTION)

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('sarah@example.com')
    // La réponse ne doit contenir aucune trace du secret, sous aucun nom.
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt|un-mot-de-passe/)
    expect(cookieDe(res)).toBeDefined()
  })

  it('pose un cookie hors de portée du script', async () => {
    // C'est la raison même de préférer un cookie à `localStorage` : la moindre
    // injection de script exfiltrerait un jeton rangé côté client.
    const cookie = cookieDe(await request(serveur).post('/api/auth/signup').send(INSCRIPTION))
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//)
  })

  it('n’enregistre pas le jeton remis, seulement son empreinte', async () => {
    const res = await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    const valeur = decodeURIComponent(cookieDe(res)!.split('=')[1]!.split(';')[0]!)

    const parEmpreinte = await prisma.session.findUnique({
      where: { tokenHash: empreinteJeton(valeur) },
    })
    expect(parEmpreinte).not.toBeNull()

    // Une fuite de la table des sessions ne doit livrer aucune session utilisable.
    const enClair = await prisma.session.findFirst({ where: { tokenHash: valeur } })
    expect(enClair).toBeNull()
  })

  it('normalise la casse de l’adresse', async () => {
    await request(serveur).post('/api/auth/signup').send({ ...INSCRIPTION, email: 'Sarah@Example.COM' })
    const compte = await prisma.userAccount.findUnique({ where: { email: 'sarah@example.com' } })
    expect(compte).not.toBeNull()
  })

  it('refuse une adresse déjà prise, quelle qu’en soit la casse', async () => {
    await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'SARAH@EXAMPLE.COM' })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'email_taken' })
    expect(await prisma.userAccount.count()).toBe(1)
  })

  it('exige une acceptation explicite des conditions', async () => {
    // `false` et l'absence sont refusés tous les deux : c'est la première chose
    // à conserver juridiquement, et le client la collecte déjà sans que rien ne
    // l'enregistre.
    for (const acceptTerms of [false, undefined]) {
      const res = await request(serveur)
        .post('/api/auth/signup')
        .send({ ...INSCRIPTION, acceptTerms })
      expect(res.status).toBe(400)
    }
    expect(await prisma.userAccount.count()).toBe(0)
  })

  it('horodate l’acceptation', async () => {
    await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    const compte = await prisma.userAccount.findFirstOrThrow()
    expect(compte.termsAcceptedAt).toBeInstanceOf(Date)
  })

  it('nomme les champs fautifs plutôt qu’un message global', async () => {
    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'pas-une-adresse', password: 'court' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_failed')
    const champs = res.body.fields.map((f: { path: string }) => f.path)
    // Le client doit pouvoir rattacher l'erreur au bon champ.
    expect(champs).toContain('email')
    expect(champs).toContain('password')
  })
})

describe('connexion', () => {
  beforeEach(async () => {
    await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    // L'inscription ouvre une session ; on repart d'un état propre.
    await prisma.session.deleteMany()
  })

  it('accepte les bons identifiants', async () => {
    const res = await request(serveur)
      .post('/api/auth/login')
      .send({ email: 'sarah@example.com', password: INSCRIPTION.password })

    expect(res.status).toBe(200)
    expect(res.body.user.fullName).toBe('Sarah Ngassa')
    expect(cookieDe(res)).toBeDefined()
  })

  it('ne distingue pas un compte inconnu d’un mot de passe faux', async () => {
    // Les distinguer transforme le formulaire en oracle d'existence de comptes.
    const inconnu = await request(serveur)
      .post('/api/auth/login')
      .send({ email: 'personne@example.com', password: INSCRIPTION.password })
    const mauvais = await request(serveur)
      .post('/api/auth/login')
      .send({ email: 'sarah@example.com', password: 'ce-n-est-pas-le-bon' })

    expect(inconnu.status).toBe(401)
    expect(mauvais.status).toBe(401)
    expect(inconnu.body).toEqual(mauvais.body)
  })

  it('ne trahit pas l’existence d’un compte par son temps de réponse', async () => {
    // Sans hachage factice sur le compte inconnu, la réponse serait immédiate
    // là où un compte réel coûte ~100 ms : le message uniforme ne fermerait
    // l'oracle qu'en apparence.
    const chrono = async (email: string) => {
      const debut = performance.now()
      await request(serveur).post('/api/auth/login').send({ email, password: 'quelconque' })
      return performance.now() - debut
    }

    const inconnu = await chrono('personne@example.com')
    const connu = await chrono('sarah@example.com')

    // Seuil large à dessein : on garde l'ordre de grandeur, pas la milliseconde.
    // Un écart d'un facteur dix signerait le retour du hachage conditionnel.
    expect(Math.max(inconnu, connu) / Math.max(1, Math.min(inconnu, connu))).toBeLessThan(5)
  })

  it('refuse un compte désactivé', async () => {
    await prisma.userAccount.updateMany({ data: { disabledAt: new Date() } })
    const res = await request(serveur)
      .post('/api/auth/login')
      .send({ email: 'sarah@example.com', password: INSCRIPTION.password })
    expect(res.status).toBe(401)
  })
})

describe('session', () => {
  let cookie: string

  beforeEach(async () => {
    const res = await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    cookie = cookieDe(res)!
  })

  it('reconnaît le porteur du cookie', async () => {
    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('sarah@example.com')
  })

  it('refuse sans cookie', async () => {
    const res = await request(serveur).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'unauthenticated' })
  })

  it('refuse un jeton forgé', async () => {
    const res = await request(serveur)
      .get('/api/auth/me')
      .set('Cookie', `${NOM_COOKIE}=jeton-invente-de-toutes-pieces`)
    expect(res.status).toBe(401)
  })

  it('révoque réellement à la déconnexion', async () => {
    // Effacer le cookie sans révoquer laisserait une session vivante en base,
    // réutilisable par quiconque a intercepté le jeton : la déconnexion serait
    // cosmétique. On rejoue donc le MÊME cookie après coup.
    await request(serveur).post('/api/auth/logout').set('Cookie', cookie).expect(204)

    const rejoue = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(rejoue.status).toBe(401)

    const session = await prisma.session.findFirst()
    expect(session?.revokedAt).toBeInstanceOf(Date)
  })

  it('accepte une déconnexion sans session', async () => {
    // Se déconnecter deux fois n'est pas une erreur : l'appelant n'a rien à
    // corriger.
    await request(serveur).post('/api/auth/logout').expect(204)
  })

  it('refuse une session expirée', async () => {
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.status).toBe(401)
  })

  it('rend les rôles depuis le serveur, jamais depuis le client', async () => {
    const compte = await prisma.userAccount.findFirstOrThrow()
    const park = await prisma.park.create({
      data: { name: 'Parc de Douala', countryCode: 'CM', currency: 'XAF' },
    })
    await prisma.membership.create({
      data: { userId: compte.id, parkId: park.id, role: 'owner' },
    })

    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.body.memberships).toEqual([
      { parkId: park.id, role: 'owner', parkName: 'Parc de Douala', currency: 'XAF' },
    ])
  })

  it('ignore une adhésion seulement demandée', async () => {
    // La « demande d'accès » du gestionnaire est une décision en attente chez
    // le propriétaire, pas un droit.
    const compte = await prisma.userAccount.findFirstOrThrow()
    const park = await prisma.park.create({
      data: { name: 'Parc', countryCode: 'CM', currency: 'XAF' },
    })
    await prisma.membership.create({
      data: { userId: compte.id, parkId: park.id, role: 'manager', status: 'requested' },
    })

    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.body.memberships).toEqual([])
  })
})
