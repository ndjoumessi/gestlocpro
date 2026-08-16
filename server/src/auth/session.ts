import type { Request, Response } from 'express'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { creerJeton, empreinteJeton, expirationDepuis, DUREE_SESSION_MS } from './token.js'

/**
 * Cycle de vie d'une session.
 *
 * Le cookie porte le jeton en clair, la base n'en garde que l'empreinte — voir
 * `token.ts`. Ce module est le seul endroit qui connaît le nom du cookie et ses
 * attributs : deux endroits qui posent un cookie de session finissent toujours
 * par diverger sur un attribut, et c'est celui qu'on oublie qui compte.
 */

export const NOM_COOKIE = 'gestlocpro_session'

/**
 * Attributs du cookie.
 *
 * `httpOnly` : inaccessible à JavaScript, donc hors de portée d'une injection
 * de script. C'est la raison même de préférer un cookie à un jeton rangé dans
 * `localStorage`, que la moindre XSS exfiltre.
 *
 * `sameSite: 'lax'` : le cookie n'accompagne pas les requêtes croisées écrivant
 * — ce qui coupe la falsification de requête inter-site sans coûter la
 * navigation depuis un lien externe. En développement, le client (5173) et
 * l'API (3001) sont deux origines : `lax` suffit car le navigateur les traite
 * comme le même site (`localhost`).
 *
 * `secure` seulement hors développement : un cookie `secure` n'est pas posé sur
 * `http://localhost`, et la connexion échouerait sans rien dire.
 */
function optionsCookie(maintenant = new Date()) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: expirationDepuis(maintenant),
  }
}

export async function ouvrirSession(
  res: Response,
  userId: string,
  contexte: { userAgent?: string | undefined; ipAddress?: string | undefined } = {},
): Promise<void> {
  const { clair, empreinte } = creerJeton()
  const maintenant = new Date()

  await prisma.session.create({
    data: {
      userId,
      tokenHash: empreinte,
      expiresAt: expirationDepuis(maintenant),
      userAgent: contexte.userAgent ?? null,
      ipAddress: contexte.ipAddress ?? null,
    },
  })

  res.cookie(NOM_COOKIE, clair, optionsCookie(maintenant))
}

/**
 * Résout la session présentée, ou `null`.
 *
 * Une session expirée ou révoquée est traitée comme absente : la distinction
 * n'intéresse que l'attaquant.
 *
 * L'échéance est **glissante** — reconduite à chaque requête servie, mais pas à
 * chaque requête : réécrire la ligne à chaque appel produirait une écriture par
 * requête pour ne gagner que quelques secondes de durée de vie. On ne la
 * repousse qu'au-delà d'un seuil.
 */
const SEUIL_PROLONGATION_MS = 24 * 60 * 60 * 1000

export async function lireSession(req: Request) {
  const brut: unknown = req.cookies?.[NOM_COOKIE]
  if (typeof brut !== 'string' || brut.length === 0) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: empreinteJeton(brut) },
    include: { user: true },
  })
  if (!session) return null

  const maintenant = new Date()
  if (session.revokedAt || session.expiresAt <= maintenant) return null
  // Un compte désactivé garde ses sessions en base ; il ne doit plus passer.
  if (session.user.disabledAt) return null

  if (session.expiresAt.getTime() - maintenant.getTime() < DUREE_SESSION_MS - SEUIL_PROLONGATION_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: expirationDepuis(maintenant), lastSeenAt: maintenant },
    })
  }

  return session
}

/**
 * Ferme la session présentée.
 *
 * On révoque **et** on efface le cookie. Effacer le cookie seul laisse une
 * session vivante en base, réutilisable par quiconque a intercepté le jeton :
 * la déconnexion serait cosmétique.
 */
export async function fermerSession(req: Request, res: Response): Promise<void> {
  const brut: unknown = req.cookies?.[NOM_COOKIE]
  if (typeof brut === 'string' && brut.length > 0) {
    await prisma.session.updateMany({
      where: { tokenHash: empreinteJeton(brut), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  res.clearCookie(NOM_COOKIE, { ...optionsCookie(), expires: new Date(0) })
}
