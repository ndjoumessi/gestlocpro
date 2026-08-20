import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'
import { empreinteJeton } from './token.js'
import { remplacerMessagerie } from '../messagerie/messagerie.js'

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
      {
        parkId: park.id,
        role: 'owner',
        parkName: 'Parc de Douala',
        currency: 'XAF',
        countryCode: 'CM',
        // La politique de délégation accompagne l'adhésion : c'est elle qui
        // décide si l'écran propose de recruter un gestionnaire, et cet écran
        // est monté bien avant qu'on ait listé les parcs.
        delegation: 'delegate',
      },
    ])
  })

  it('porte le pays du parc, que l’écran de correction doit pouvoir afficher', async () => {
    /**
     * Le pays est STOCKÉ sur le parc depuis l'origine, et n'était rendu nulle
     * part. L'écran qui le corrige doit d'abord le lire : sans lui, la modale
     * s'ouvrirait sur un champ vide, et le propriétaire reposerait « France »
     * une seconde fois sans le savoir.
     *
     * Le cas est écrit sur un parc né FRANÇAIS parce que c'est la situation
     * réelle en production — « Parc Bastos », un quartier de Yaoundé, créé
     * FR/EUR par un pays que personne n'avait choisi.
     */
    const compte = await prisma.userAccount.findFirstOrThrow()
    const park = await prisma.park.create({
      data: { name: 'Parc Bastos', countryCode: 'FR', currency: 'EUR' },
    })
    await prisma.membership.create({
      data: { userId: compte.id, parkId: park.id, role: 'owner' },
    })

    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.body.memberships[0].countryCode).toBe('FR')
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

/**
 * UNE INSCRIPTION REFUSÉE N'ÉCRIT RIEN.
 *
 * Le handler créait le compte AVANT d'examiner le code d'invitation, et le
 * refus ne défaisait rien : le 400 partait, le compte restait. Le défaut s'est
 * vu en faisant le ménage d'un parc de sonde en production — quatre comptes y
 * traînaient là où deux inscriptions avaient réussi ; les deux autres étaient
 * les traces de deux refus, horodatées à la milliseconde du 400.
 *
 * Le pire n'était pas la ligne morte, c'était l'adresse PRISE. Qui saisit son
 * code de travers une seule fois ne peut plus s'inscrire avec sa propre adresse
 * — il reçoit `email_taken` pour un compte dont il ignore l'existence, alors que
 * son code est valide. Et un code inventé suffisait à occuper l'adresse d'un
 * autre avant même qu'il ait reçu son invitation.
 */
describe('une inscription refusée n’écrit rien', () => {
  /** Émet un code d'invitation réel depuis un parc réel. */
  async function parcAvecCode() {
    const proprio = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'bailleur@example.com', parkName: 'Parc de test' })
    const cookie = cookieDe(proprio)!
    const parcs = await request(serveur).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id
    const invit = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant' })
    expect(invit.status, JSON.stringify(invit.body)).toBe(201)
    return { parkId, code: invit.body.code as string }
  }

  it('ne laisse aucun compte derrière un code refusé', async () => {
    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'candidat@example.com', invitationCode: 'LOC-9999-XXXX' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invitation_invalid')

    // La ligne morte n'est pas le vrai dégât, mais c'est elle qui le cause.
    expect(await prisma.userAccount.count({ where: { email: 'candidat@example.com' } })).toBe(0)
  })

  it('laisse l’adresse libre pour la seconde tentative, avec le bon code', async () => {
    const { code } = await parcAvecCode()

    await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'candidat@example.com', invitationCode: 'LOC-9999-XXXX' })
      .expect(400)

    /**
     * LE CAS QUI COMPTE. Une faute de frappe sur un code condamnait l'adresse :
     * la seconde tentative — avec le bon code, la bonne adresse — se heurtait à
     * `email_taken`, et rien à l'écran ne pouvait lui dire de se connecter
     * plutôt que de s'inscrire, puisque de son point de vue aucun compte
     * n'existait.
     */
    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'candidat@example.com', invitationCode: code })
    expect(res.status, JSON.stringify(res.body)).toBe(201)

    const me = await request(serveur).get('/api/auth/me').set('Cookie', cookieDe(res)!)
    expect(me.body.memberships).toHaveLength(1)
    expect(me.body.memberships[0].role).toBe('tenant')
  })

  it('ne consomme pas le code quand c’est l’adresse qui est déjà prise', async () => {
    const { code } = await parcAvecCode()
    await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'occupe@example.com' })
      .expect(201)

    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'occupe@example.com', invitationCode: code })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('email_taken')

    // Le code est LU avant l'écriture et marqué DANS la transaction : un échec
    // sur l'adresse annule le marquage avec le reste. Sans cela, un code
    // parfaitement valide serait brûlé par une inscription qui n'a rien créé.
    const entrant = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'entrant@example.com', invitationCode: code })
    expect(entrant.status, JSON.stringify(entrant.body)).toBe(201)
  })

  it('ne laisse entrer qu’une personne par code, et sans compte pour la seconde', async () => {
    const { code } = await parcAvecCode()
    await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'premier@example.com', invitationCode: code })
      .expect(201)

    const second = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'second@example.com', invitationCode: code })
    expect(second.status).toBe(400)
    expect(second.body.error).toBe('invitation_invalid')

    // Le perdant repart les mains vides — sans adhésion ET sans compte. Ce cas
    // éprouve l'ORDRE et non l'atomicité : le code est déjà marqué accepté au
    // moment de la lecture, donc le refus tombe avant toute écriture. La course
    // vraie, elle, est le cas suivant.
    expect(await prisma.userAccount.count({ where: { email: 'second@example.com' } })).toBe(0)
  })

  it('n’en laisse entrer qu’un quand les deux arrivent en même temps', async () => {
    const { code } = await parcAvecCode()

    /**
     * LA COURSE, pour de bon.
     *
     * Le cas précédent enchaîne les deux inscriptions : le second lit un code
     * déjà marqué et repart avant d'écrire. Ici les deux partent ENSEMBLE, les
     * deux lisent un code libre, et les deux entrent en transaction. Ce qui les
     * départage est le `updateMany` gardé par `acceptedAt: null` — le perdant
     * obtient un compteur à zéro, lève, et son compte tombe avec sa
     * transaction.
     *
     * Sans ce cas, trois mutations restaient muettes : sortir la création du
     * compte de la transaction, retirer la garde du marquage, et supprimer la
     * levée. Le chemin qu'elles cassent n'était emprunté par aucun test.
     */
    const [a, b] = await Promise.all([
      request(serveur)
        .post('/api/auth/signup')
        .send({ ...INSCRIPTION, email: 'course-a@example.com', invitationCode: code }),
      request(serveur)
        .post('/api/auth/signup')
        .send({ ...INSCRIPTION, email: 'course-b@example.com', invitationCode: code }),
    ])

    const statuts = [a.status, b.status].sort()
    expect(statuts, `${a.status}/${JSON.stringify(a.body)} ${b.status}/${JSON.stringify(b.body)}`)
      .toEqual([201, 400])

    // Une seule adhésion, et un seul compte : le perdant n'a pas même pris son
    // adresse. C'est l'atomicité, celle que le handler ne tenait pas.
    expect(
      await prisma.userAccount.count({
        where: { email: { in: ['course-a@example.com', 'course-b@example.com'] } },
      }),
    ).toBe(1)
    expect(await prisma.membership.count({ where: { role: 'tenant' } })).toBe(1)
  })

  it('crée toujours le compte sans parc de qui n’a ni code ni parc à fonder', async () => {
    /**
     * La moitié POSITIVE, sans laquelle un correctif trop zélé passerait au
     * vert en refusant tout. Un compte sans parc est un état servi : l'écran de
     * prise en main lui propose de rejoindre un parc par code.
     */
    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'seul@example.com' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)

    const me = await request(serveur).get('/api/auth/me').set('Cookie', cookieDe(res)!)
    expect(me.body.memberships).toEqual([])
  })
})

/**
 * LA RÉINITIALISATION DE MOT DE PASSE, qui n'existait pas.
 *
 * Les deux écrans du parcours étaient écrits et simulaient leur travail par un
 * `window.setTimeout` ; la table `PasswordReset` figurait au schéma avec sa
 * migration, et pas une ligne du serveur ne la touchait. Un propriétaire qui
 * perdait son mot de passe lisait « un lien vient de vous être envoyé » et
 * perdait l'accès à son parc sans recours.
 */
describe('réinitialisation du mot de passe', () => {
  /** Capture les courriels au lieu de les envoyer, et rend le lien émis. */
  function messagerieQuiCapture() {
    const envoyes: { destinataire: string; texte: string; html: string }[] = []
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail(destinataire: string, _sujet: string, corps: { texte: string; html: string }) {
        envoyes.push({ destinataire, ...corps })
        return true
      },
    })
    return {
      envoyes,
      rendre,
      jeton: () => envoyes.at(-1)?.texte.match(/jeton=([\w-]+)/)?.[1] ?? '',
      html: () => envoyes.at(-1)?.html ?? '',
    }
  }

  async function compteExistant(email = 'sarah@example.com') {
    const res = await request(serveur).post('/api/auth/signup').send({ ...INSCRIPTION, email })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return cookieDe(res)!
  }

  it('répond exactement pareil à une adresse connue et à une inconnue', async () => {
    await compteExistant()

    const connue = await request(serveur)
      .post('/api/auth/forgot')
      .send({ email: 'sarah@example.com' })
    const inconnue = await request(serveur)
      .post('/api/auth/forgot')
      .send({ email: 'personne@example.com' })

    /**
     * Sans cette égalité, le formulaire devient un oracle : on y essaie des
     * adresses pour savoir qui possède un compte, et sur un produit qui gère
     * des biens immobiliers, cette liste-là se revend.
     */
    expect(connue.status).toBe(inconnue.status)
    expect(connue.body).toEqual(inconnue.body)

    // Et rien n'est écrit pour l'inconnue : l'égalité des réponses ne doit pas
    // être obtenue en créant une demande pour une adresse qui n'existe pas.
    expect(await prisma.passwordReset.count()).toBe(1)
  })

  it('n’enregistre que l’empreinte du jeton, jamais le jeton', async () => {
    await compteExistant()
    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      const clair = m.jeton()
      expect(clair.length).toBeGreaterThan(16)

      // Le même raisonnement que pour les sessions : une fuite de cette table
      // ne doit livrer aucun lien utilisable.
      const enregistre = await prisma.passwordReset.findFirstOrThrow()
      expect(enregistre.tokenHash).not.toBe(clair)
      expect(enregistre.tokenHash).toBe(empreinteJeton(clair))
    } finally {
      m.rendre()
    }
  })

  it('porte le lien dans un attribut, que nul repli de ligne ne coupe', async () => {
    /**
     * L'INCIDENT DE PRODUCTION, gardé.
     *
     * Le premier message n'avait qu'un corps texte. Son lien de 112 caractères
     * est arrivé mutilé dans le navigateur : l'écran a rendu « lien expiré »
     * sans qu'aucune requête ne parte, alors que le jeton émis, le paquet
     * client servi et le contrôle qui le lit étaient tous les trois justes.
     * Repli de ligne, encodage, auto-détection : la cause exacte n'a jamais été
     * établie, et c'est pourquoi ce cas ne garde aucune d'elles — il garde que
     * l'adresse vit dans un ATTRIBUT, où rien de tout cela ne l'atteint.
     */
    await compteExistant()
    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      const jeton = m.jeton()
      const html = m.html()

      // Le jeton ENTIER dans le href, et le href sur une seule pièce.
      expect(html).toContain(`href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/reinitialiser?jeton=${jeton}"`)

      // Et le corps texte le porte toujours : le HTML ne le remplace pas, il
      // lui retire seulement la charge d'être la seule chance du lien.
      expect(m.envoyes.at(-1)?.texte).toContain(`jeton=${jeton}`)
    } finally {
      m.rendre()
    }
  })

  it('échappe le nom, qui vient de l’inscription et non de nous', async () => {
    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...INSCRIPTION, email: 'balise@example.com', fullName: '<script>alert(1)</script>' })
    expect(res.status).toBe(201)

    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'balise@example.com' })

      // Une balise dans un `fullName` s'exécuterait chez le destinataire. Le
      // lien, lui, n'est pas échappé — il est fabriqué ici, rien n'y vient de
      // l'extérieur.
      expect(m.html()).not.toContain('<script>')
      expect(m.html()).toContain('&lt;script&gt;')
    } finally {
      m.rendre()
    }
  })

  it('change le mot de passe, et le nouveau seul ouvre la porte', async () => {
    await compteExistant()
    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      const res = await request(serveur)
        .post('/api/auth/reset')
        .send({ token: m.jeton(), password: 'un-nouveau-mot-de-passe' })
      expect(res.status, JSON.stringify(res.body)).toBe(204)

      // Les DEUX moitiés : le nouveau ouvre, et l'ancien ne doit plus.
      await request(serveur)
        .post('/api/auth/login')
        .send({ email: 'sarah@example.com', password: 'un-nouveau-mot-de-passe' })
        .expect(200)
      await request(serveur)
        .post('/api/auth/login')
        .send({ email: 'sarah@example.com', password: INSCRIPTION.password })
        .expect(401)
    } finally {
      m.rendre()
    }
  })

  it('éjecte les sessions ouvertes, y compris celle de l’intrus', async () => {
    /**
     * LE POINT QU'ON OUBLIE. On réinitialise souvent parce qu'un autre est
     * entré. Rendre son mot de passe à quelqu'un sans couper les sessions ne
     * lui rend rien : l'intrus garde son cookie, valable trente jours.
     */
    const ancienne = await compteExistant()
    await request(serveur).get('/api/auth/me').set('Cookie', ancienne).expect(200)

    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      await request(serveur)
        .post('/api/auth/reset')
        .send({ token: m.jeton(), password: 'un-nouveau-mot-de-passe' })
        .expect(204)
    } finally {
      m.rendre()
    }

    expect((await request(serveur).get('/api/auth/me').set('Cookie', ancienne)).status).toBe(401)
  })

  it('ne sert le lien qu’une fois', async () => {
    await compteExistant()
    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      const jeton = m.jeton()
      await request(serveur)
        .post('/api/auth/reset')
        .send({ token: jeton, password: 'un-nouveau-mot-de-passe' })
        .expect(204)

      // `usedAt` est le champ que rien n'écrivait. Sans lui, le lien reste
      // rejouable toute son heure : qui lit la boîte aux lettres plus tard
      // reprend le compte que son porteur vient de récupérer.
      const rejeu = await request(serveur)
        .post('/api/auth/reset')
        .send({ token: jeton, password: 'un-troisieme-mot-de-passe' })
      expect(rejeu.status).toBe(400)
      expect(rejeu.body.error).toBe('reset_invalid')

      await request(serveur)
        .post('/api/auth/login')
        .send({ email: 'sarah@example.com', password: 'un-nouveau-mot-de-passe' })
        .expect(200)
    } finally {
      m.rendre()
    }
  })

  it('n’en sert qu’un quand le même lien est joué deux fois en même temps', async () => {
    /**
     * LA COURSE, pour de bon.
     *
     * Le cas précédent enchaîne les deux tentatives : la seconde lit un jeton
     * déjà marqué et repart avant d'écrire. Ici les deux partent ENSEMBLE, les
     * deux lisent un jeton libre, et les deux entrent en transaction. Ce qui les
     * départage est le `updateMany` gardé par `usedAt: null`. Sans lui, deux
     * mots de passe seraient posés l'un après l'autre et le dernier
     * l'emporterait — celui qui a demandé le lien se retrouverait avec un mot
     * de passe qu'il n'a pas choisi, sans que rien ne le lui dise.
     */
    await compteExistant()
    const m = messagerieQuiCapture()
    let jeton = ''
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      jeton = m.jeton()
    } finally {
      m.rendre()
    }

    const [a, b] = await Promise.all([
      request(serveur).post('/api/auth/reset').send({ token: jeton, password: 'le-premier-choisi' }),
      request(serveur).post('/api/auth/reset').send({ token: jeton, password: 'le-second-choisi' }),
    ])

    expect([a.status, b.status].sort(), `${a.status}/${b.status}`).toEqual([204, 400])

    // Un seul des deux mots de passe ouvre — celui du gagnant, quel qu'il soit.
    const ouvre = await Promise.all(
      ['le-premier-choisi', 'le-second-choisi'].map(async (mdp) => {
        const res = await request(serveur)
          .post('/api/auth/login')
          .send({ email: 'sarah@example.com', password: mdp })
        return res.status === 200
      }),
    )
    expect(ouvre.filter(Boolean)).toHaveLength(1)
  })

  it('refuse un lien périmé, et le dit comme un lien inconnu', async () => {
    await compteExistant()
    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      const jeton = m.jeton()
      await prisma.passwordReset.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

      const perime = await request(serveur)
        .post('/api/auth/reset')
        .send({ token: jeton, password: 'un-nouveau-mot-de-passe' })
      const inconnu = await request(serveur)
        .post('/api/auth/reset')
        .send({ token: 'jeton-parfaitement-invente-mais-assez-long', password: 'un-nouveau-mot-de-passe' })

      expect(perime.status).toBe(400)
      expect(perime.body).toEqual(inconnu.body)

      // Et le mot de passe n'a pas bougé.
      await request(serveur)
        .post('/api/auth/login')
        .send({ email: 'sarah@example.com', password: INSCRIPTION.password })
        .expect(200)
    } finally {
      m.rendre()
    }
  })

  it('ne périme pas les liens précédents quand on en demande un autre', async () => {
    /**
     * Invalider les anciens serait un moyen de nuisance : il suffirait de
     * demander une réinitialisation pour l'adresse de quelqu'un afin d'annuler
     * le lien qu'il est peut-être en train d'ouvrir.
     */
    await compteExistant()
    const m = messagerieQuiCapture()
    try {
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })
      const premier = m.jeton()
      await request(serveur).post('/api/auth/forgot').send({ email: 'sarah@example.com' })

      const res = await request(serveur)
        .post('/api/auth/reset')
        .send({ token: premier, password: 'un-nouveau-mot-de-passe' })
      expect(res.status, JSON.stringify(res.body)).toBe(204)
    } finally {
      m.rendre()
    }
  })
})
