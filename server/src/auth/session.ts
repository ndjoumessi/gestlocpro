import type { Request, Response } from 'express'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { creerJeton, empreinteJeton, expirationDepuis, dureeSession } from './token.js'

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
 *
 * `expires` SEULEMENT si l'appareil est retenu. Sans lui, le navigateur pose un
 * cookie de session, qu'il jette en se fermant. Ce n'est pas une garantie —
 * plusieurs navigateurs les restaurent quand « reprendre là où vous en étiez »
 * est actif —, et c'est pourquoi l'échéance courte est écrite AUSSI en base,
 * où aucun réglage de navigateur ne l'atteint. Le cookie fait le cas ordinaire,
 * la base tient la promesse.
 */
function optionsCookie(maintenant = new Date(), persistante = true) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    ...(persistante ? { expires: expirationDepuis(maintenant, true) } : {}),
  }
}

export async function ouvrirSession(
  res: Response,
  userId: string,
  contexte: {
    userAgent?: string | undefined
    ipAddress?: string | undefined
    /**
     * « Rester connecté sur cet appareil », tel que l'écran l'a demandé.
     *
     * Le défaut vaut `true`, et il porte tous les appelants qui ne posent pas
     * la question : l'inscription, l'acceptation d'invitation, la
     * réinitialisation de mot de passe. Aucun de ces trois écrans n'offre la
     * case — on vient d'y saisir un secret sur un appareil qu'on a choisi —, et
     * un défaut inverse les aurait tous raccourcis en silence.
     */
    persistante?: boolean
  } = {},
): Promise<void> {
  const { clair, empreinte } = creerJeton()
  const maintenant = new Date()
  const persistante = contexte.persistante ?? true

  await prisma.session.create({
    data: {
      userId,
      tokenHash: empreinte,
      expiresAt: expirationDepuis(maintenant, persistante),
      persistent: persistante,
      userAgent: contexte.userAgent ?? null,
      ipAddress: contexte.ipAddress ?? null,
    },
  })

  res.cookie(NOM_COOKIE, clair, optionsCookie(maintenant, persistante))
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

/**
 * Le seuil d'une session COURTE ne peut pas être celui d'une longue.
 *
 * Vingt-quatre heures dépassent les douze d'une session non retenue : la
 * condition « il reste moins que la durée moins le seuil » deviendrait « il
 * reste moins que moins douze heures », donc jamais vraie. La session ne
 * glisserait plus du tout et mourrait douze heures après la connexion, en
 * pleine action. On prend donc la moitié de la durée quand elle est plus
 * serrée : six heures ici, vingt-quatre pour les trente jours.
 */
function seuilDeProlongation(duree: number): number {
  return Math.min(SEUIL_PROLONGATION_MS, duree / 2)
}

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

  // Chaque session glisse selon SA durée : celle qu'on a demandé de ne pas
  // retenir ne doit jamais se voir reconduite de trente jours.
  const duree = dureeSession(session.persistent)
  if (session.expiresAt.getTime() - maintenant.getTime() < duree - seuilDeProlongation(duree)) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: expirationDepuis(maintenant, session.persistent),
        lastSeenAt: maintenant,
      },
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
