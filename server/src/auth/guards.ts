import type { NextFunction, Request, Response } from 'express'
import type { ParkRole, Prisma } from '../generated/prisma/client.js'
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
    adhesion?: {
      parkId: string
      role: ParkRole
      /**
       * Les immeubles CONFIÉS, ou `null` quand rien ne borne.
       *
       * `null` et non un tableau vide, parce que les deux états ne veulent PAS
       * dire la même chose et qu'un tableau vide les confondrait : « aucun
       * immeuble » se lirait comme « rien à voir » alors qu'il signifie « tout
       * le parc ». Le type porte la distinction pour qu'aucun appelant n'ait à
       * s'en souvenir.
       */
      immeubles: string[] | null
    }
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
    select: {
      parkId: true,
      role: true,
      /* Lu ICI plutôt qu'à chaque route : le périmètre est une propriété de
         l'adhésion, au même titre que le rôle, et le chercher route par route
         suffirait à ce qu'un chemin l'oublie. */
      buildings: { select: { buildingId: true } },
    },
  })

  if (!adhesion) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  /**
   * SEUL LE GESTIONNAIRE SE BORNE, et le propriétaire jamais.
   *
   * Le rôle n'est pas dans la clé de `MembershipBuilding` : une ligne posée
   * pour un propriétaire y est possible. On l'ignore explicitement plutôt que
   * de compter sur le fait que personne n'en écrira — une garde qui repose sur
   * ce que personne ne fera n'en est pas une.
   *
   * Le locataire, lui, est déjà borné plus finement par `unitesVisibles` : le
   * borner en plus par immeuble ne retirerait rien et ajouterait une clause à
   * tenir d'accord avec l'autre.
   */
  const confies = adhesion.buildings.map((b) => b.buildingId)
  req.adhesion = {
    parkId: adhesion.parkId,
    role: adhesion.role,
    immeubles: adhesion.role === 'manager' && confies.length > 0 ? confies : null,
  }
  next()
}

/**
 * LE PÉRIMÈTRE, EN CLAUSE DE REQUÊTE — pour `Building`.
 *
 * Rendue en fragment de `where` et jamais appliquée après lecture, pour la
 * raison que `unitesVisibles` donne déjà : « filtrer en mémoire suppose d'avoir
 * d'abord tout lu, et il suffit d'un oubli sur un seul chemin pour que les
 * données des voisins sortent ».
 *
 * Le dépôt écrit `building: { parkId }` à huit endroits du portefeuille et sur
 * la plupart des routes d'écriture. Cette fonction se glisse au même endroit,
 * ce qui rend l'application MÉCANIQUE et relisable : `{ parkId, ...portee }`.
 */
export function porteeDesImmeubles(adhesion: {
  immeubles: string[] | null
}): Prisma.BuildingWhereInput {
  /**
   * SOUS `AND`, ET NON SOUS `id` — le piège que ce dépôt a déjà payé une fois.
   *
   * La route d'ouverture d'une intervention le raconte à sa ligne : un
   * `...spread` y écrasait la clé `id`, « la requête cherchait donc n'importe
   * lequel de mes logements au lieu du logement demandé ; un locataire visant
   * celui du voisin recevait 201, et le signalement était créé sur le sien ».
   *
   * Ce périmètre se compose avec des clauses qui portent DÉJÀ un `id` —
   * `{ id: buildingId, parkId, ...portee }` sur la création d'un logement. Rendu
   * sous `id`, il l'écrasait exactement de la même façon : le gestionnaire visait
   * l'immeuble qu'on lui cache et créait le logement dans celui qu'on lui a
   * confié. Ni refus, ni erreur, ni trace — et la garde de ce lot l'a pris.
   *
   * `AND` ne peut rien écraser : il s'ajoute aux conditions au lieu de s'y
   * substituer, et c'est la seule forme de ce fragment qui soit sûre partout.
   */
  return adhesion.immeubles ? { AND: [{ id: { in: adhesion.immeubles } }] } : {}
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

/**
 * Les états des lieux que le porteur de la session peut LIRE, dans ce parc.
 *
 * Rendue en CLAUSE DE REQUÊTE, pour la raison que `unitesVisibles` donne déjà :
 * un filtre appliqué après lecture suppose d'avoir tout lu, et il suffit d'un
 * chemin oublié pour que le voisin sorte.
 *
 * ─── POURQUOI LE BAIL, ET NON L'UNITÉ ────────────────────────────────────
 *
 * `unitesVisibles` borne à l'UNITÉ, et retient le logement d'un locataire même
 * après son départ — c'est voulu : ses quittances lui restent dues. Mais une
 * unité a une HISTOIRE. L'état des lieux de sortie du locataire précédent porte
 * la description et le coût de ce que LUI a abîmé ; celui d'entrée du suivant
 * décrit un logement que le partant n'occupe plus. Borner à l'unité montrerait
 * donc à chaque occupant les affaires de tous les autres — et depuis le lot des
 * photos, leurs photographies.
 *
 * `leaseId: null` reste visible, et ce n'est pas un trou. Une entrée précède
 * souvent la signature — « on constate avant de remettre les clés », dit la
 * route de création —, et sur SON logement c'est la sienne. Un état des lieux
 * sans bail ne se rattache à personne : le rendre invisible à tous priverait le
 * locataire du seul document qui atteste l'état où il a reçu les clés.
 */
export function etatsDesLieuxVisibles(
  compteId: string,
  role: ParkRole,
): Prisma.InspectionWhereInput {
  // Le propriétaire et le gestionnaire lisent tout le parc : l'appartenance,
  // vérifiée en amont, est la seule frontière qui les concerne.
  if (role !== 'tenant') return {}

  return { OR: [{ lease: { tenant: { userId: compteId } } }, { leaseId: null }] }
}
