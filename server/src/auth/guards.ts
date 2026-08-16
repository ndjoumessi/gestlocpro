import type { NextFunction, Request, Response } from 'express'
import type { ParkRole } from '@prisma/client'
import { prisma } from '../db.js'
import { lireSession } from './session.js'

/**
 * Autorisation.
 *
 * Le client masque des boutons selon le rôle. Ce n'est pas une protection :
 * c'est de la courtoisie envers l'utilisateur, et cela ne survit pas à une
 * requête forgée. La règle est appliquée ici, où elle ne peut pas être
 * contournée.
 *
 * Deux niveaux distincts, et les confondre est le défaut habituel :
 *
 *  - **l'authentification** répond « qui êtes-vous » ;
 *  - **l'appartenance** répond « avez-vous affaire à CE parc » — c'est elle qui
 *    empêche un propriétaire parfaitement authentifié de lire le parc du
 *    voisin, ce qu'aucune vérification de rôle ne ferait.
 */

declare module 'express-serve-static-core' {
  interface Request {
    /** Renseigné par `exigerCompte`. */
    compteId?: string
    /** Renseigné par `exigerAppartenance`. */
    adhesion?: { parkId: string; role: ParkRole }
  }
}

/** Refuse une requête sans session valide. */
export async function exigerCompte(req: Request, res: Response, next: NextFunction) {
  const session = await lireSession(req)
  if (!session) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }
  req.compteId = session.userId
  next()
}

/**
 * Vérifie que le compte appartient au parc visé, et retient son rôle.
 *
 * Rend **404 et non 403** quand le parc existe mais ne le concerne pas. Un 403
 * confirmerait l'existence de l'identifiant : il suffirait alors d'énumérer
 * pour cartographier les parcs des autres. « Vous n'avez pas le droit » et
 * « cela n'existe pas » doivent se ressembler vu de l'extérieur.
 */
export async function exigerAppartenance(req: Request, res: Response, next: NextFunction) {
  // Express type un paramètre de route comme `string | string[]` : une route
  // répétée le rendrait multiple. Le passer tel quel à Prisma comparerait un
  // tableau à une colonne `uuid`, et la requête échouerait à l'exécution.
  const brut = req.params.parkId
  const parkId = typeof brut === 'string' ? brut : undefined
  if (!req.compteId || !parkId) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  const adhesion = await prisma.membership.findFirst({
    where: { userId: req.compteId, parkId, status: 'active' },
    select: { parkId: true, role: true },
  })

  if (!adhesion) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  req.adhesion = adhesion
  next()
}

/**
 * Restreint une route à certains rôles.
 *
 * Valider un devis et arbitrer une caution appartiennent au seul propriétaire —
 * c'est la règle écrite dans la matrice des droits, appliquée jusqu'ici par un
 * `canApprove = role === 'owner'` qui masquait un bouton. Un devis validé
 * engage une dépense : la règle doit tenir même quand la requête ne vient pas
 * de l'interface.
 */
export function exigerRole(...roles: ParkRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.adhesion || !roles.includes(req.adhesion.role)) {
      // 403 ici, et non 404 : l'existence du parc est déjà établie par
      // `exigerAppartenance`, il n'y a plus rien à cacher — seulement un droit
      // à refuser, et le dire aide l'appelant légitime.
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}

/**
 * Unités visibles par le porteur de la session, dans ce parc.
 *
 * Le cloisonnement du locataire est une **clause de requête**, jamais un filtre
 * appliqué après coup : filtrer en mémoire suppose d'avoir d'abord tout lu, et
 * il suffit d'un oubli sur un seul chemin pour que les données des voisins
 * sortent. Ici, la requête ne peut pas les ramener.
 *
 * Le périmètre est l'ensemble des baux rattachés au compte, et non une unité
 * unique : un locataire peut en louer deux, et un locataire parti doit encore
 * accéder à ses quittances.
 */
export async function unitesVisibles(
  parkId: string,
  compteId: string,
  role: ParkRole,
): Promise<{ id: string }[] | null> {
  // `null` signifie « aucune restriction » — le propriétaire et le
  // gestionnaire voient tout le parc.
  if (role !== 'tenant') return null

  return prisma.unit.findMany({
    where: {
      building: { parkId },
      leases: { some: { tenant: { userId: compteId } } },
    },
    select: { id: true },
  })
}
