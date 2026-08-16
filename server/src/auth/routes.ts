import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { hashPassword, needsRehash, verifyPassword } from './password.js'
import { fermerSession, lireSession, ouvrirSession } from './session.js'

export const authRouter = Router()

/**
 * L'e-mail est normalisé **à l'entrée**, à un seul endroit.
 *
 * « Sarah@… » et « sarah@… » sont la même personne. La règle pourrait vivre
 * dans un index fonctionnel côté base — c'est ce que j'avais fait, et c'était
 * une erreur : le schéma déclare `@unique` sur la colonne, donc Prisma y aurait
 * vu une dérive permanente. Un seul endroit, ici.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse e-mail invalide')
  .max(320)

/**
 * Longueur minimale, et rien d'autre.
 *
 * Pas de règle de composition — majuscule, chiffre, caractère spécial. Elles
 * réduisent l'espace de recherche au lieu de l'agrandir, et poussent à
 * « Password1! ». La longueur est ce qui compte, le NIST le dit depuis 2017.
 */
const motDePasse = z.string().min(10, 'Au moins 10 caractères').max(200)

const schemaInscription = z.object({
  email,
  password: motDePasse,
  fullName: z.string().trim().min(2, 'Au moins 2 caractères').max(120),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Numéro attendu au format international, par exemple +237677214408')
    .optional(),
  countryCode: z.string().length(2).toUpperCase().optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  /**
   * L'acceptation doit être explicite : `true` littéral, pas « présent donc
   * vrai ». C'est la première chose à conserver juridiquement, avec sa date, et
   * le client la collecte déjà sans que rien ne l'enregistre.
   */
  acceptTerms: z.literal(true),
  newsletterOptIn: z.boolean().default(false),
})

const schemaConnexion = z.object({
  email,
  // Pas de contrainte de longueur ici : refuser un mot de passe trop court à la
  // connexion renseignerait sur la politique en vigueur lors de l'inscription.
  password: z.string().min(1),
})

function contexte(req: Request) {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ipAddress: req.ip ?? undefined,
  }
}

/** Ce que le client reçoit d'un compte. Jamais l'empreinte du mot de passe. */
function vueCompte(u: {
  id: string
  email: string
  fullName: string
  locale: string
  countryCode: string | null
  phoneE164: string | null
}) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    locale: u.locale,
    countryCode: u.countryCode,
    phoneE164: u.phoneE164,
  }
}

authRouter.post('/signup', async (req: Request, res: Response) => {
  const donnees = schemaInscription.parse(req.body)

  const compte = await prisma.userAccount
    .create({
      data: {
        email: donnees.email,
        passwordHash: await hashPassword(donnees.password),
        fullName: donnees.fullName,
        phoneE164: donnees.phoneE164 ?? null,
        countryCode: donnees.countryCode ?? null,
        locale: donnees.locale,
        termsAcceptedAt: new Date(),
        newsletterOptIn: donnees.newsletterOptIn,
      },
    })
    .catch((err: unknown) => {
      // P2002 : violation d'unicité, donc e-mail déjà pris. On rend 409 avec un
      // code stable plutôt qu'un message : c'est au client de le traduire.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null
      throw err
    })

  if (!compte) {
    res.status(409).json({ error: 'email_taken' })
    return
  }

  await ouvrirSession(res, compte.id, contexte(req))
  res.status(201).json({ user: vueCompte(compte) })
})

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email: adresse, password } = schemaConnexion.parse(req.body)

  const compte = await prisma.userAccount.findUnique({ where: { email: adresse } })

  /**
   * Une seule réponse pour « compte inconnu » et « mot de passe faux ».
   *
   * Les distinguer transforme le formulaire de connexion en oracle d'existence
   * de comptes — utile pour cibler du hameçonnage, et suffisant pour établir
   * qu'une adresse est cliente du produit.
   *
   * Le hachage est exécuté **même quand le compte n'existe pas**, contre une
   * empreinte factice. Sans cela, une adresse inconnue répondrait en une
   * milliseconde et une adresse connue en cent : le temps de réponse rétablit
   * l'oracle que le message uniforme prétendait fermer.
   */
  const empreinte =
    compte?.passwordHash ??
    'scrypt$65536$8$1$Y29tcHRlLWluZXhpc3RhbnQ$Y2V0dGUtZW1wcmVpbnRlLW5lLWNvcnJlc3BvbmQtYS1yaWVu'
  const correct = await verifyPassword(password, empreinte)

  if (!compte || !correct || compte.disabledAt) {
    res.status(401).json({ error: 'invalid_credentials' })
    return
  }

  // Le seul instant où le mot de passe en clair est disponible : si les
  // paramètres de hachage ont été relevés depuis, on en profite. Sans cela, le
  // relèvement ne protégerait que les comptes créés après.
  if (needsRehash(compte.passwordHash)) {
    await prisma.userAccount.update({
      where: { id: compte.id },
      data: { passwordHash: await hashPassword(password) },
    })
  }

  await ouvrirSession(res, compte.id, contexte(req))
  res.json({ user: vueCompte(compte) })
})

authRouter.post('/logout', async (req: Request, res: Response) => {
  await fermerSession(req, res)
  // 204 et non 401 quand il n'y avait pas de session : se déconnecter deux fois
  // n'est pas une erreur, et l'appelant n'a rien à corriger.
  res.sendStatus(204)
})

authRouter.get('/me', async (req: Request, res: Response) => {
  const session = await lireSession(req)
  if (!session) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId, status: 'active' },
    select: { parkId: true, role: true, park: { select: { name: true, currency: true } } },
  })

  res.json({
    user: vueCompte(session.user),
    // Les rôles viennent du serveur et ne sont jamais transmis par le client :
    // c'est ce qui remplace le sélecteur de profil, qui reste disponible en
    // démonstration mais ne décide plus de rien.
    memberships: memberships.map((m) => ({
      parkId: m.parkId,
      role: m.role,
      parkName: m.park.name,
      currency: m.park.currency,
    })),
  })
})
