import { prisma } from '../db.js'

/**
 * LE DÉLAI ENTRE LA FERMETURE D'UN COMPTE ET SON EFFACEMENT.
 *
 * Trente jours, choisis par Nelson le 2026-09-16. C'est le filet : la
 * suppression est le seul geste du produit que rien ne rattrape, et une
 * reconnexion pendant ce délai annule la demande.
 *
 * ÉCRIT ICI, ET NON DANS LA ROUTE : trois endroits en dépendent — la route qui
 * ferme, le travail quotidien qui efface, et l'écran qui annonce la date. Trois
 * copies du même nombre dériveraient, et c'est l'écran qui mentirait en premier.
 */
export const DELAI_D_EFFACEMENT_JOURS = 30

/** La date d'effacement d'une fermeture demandée à cet instant. */
export function effacementPrevu(depuis: Date): Date {
  return new Date(depuis.getTime() + DELAI_D_EFFACEMENT_JOURS * 86_400_000)
}

/**
 * LES PARCS QUE L'EFFACEMENT DE CE COMPTE EMPORTERA.
 *
 * Ceux dont il est le SEUL propriétaire actif. Un parc à deux propriétaires
 * survit : effacer le bien commun parce que l'un s'en va effacerait les données
 * de l'autre, qui n'a rien demandé.
 *
 * ÉCRIT UNE FOIS, LU DEUX FOIS — par la fermeture, qui PRÉVIENT les locataires
 * et les gestionnaires, et par le balayage quotidien, qui EFFACE. Deux calculs
 * séparés dériveraient, et la dérive prendrait la forme la plus fâcheuse qui
 * soit : une fausse alerte adressée à des tiers, ou un parc effacé sans que
 * personne ait été prévenu.
 *
 * LES ADHÉSIONS ACTIVES SEULES comptent : une adhésion révoquée ne tient pas un
 * parc debout, et la lire comme telle laisserait un parc sans personne.
 */
export async function parcsEmportesParLEffacement(userId: string): Promise<string[]> {
  const siens = await prisma.park.findMany({
    where: { memberships: { some: { userId, role: 'owner', status: 'active' } } },
    select: {
      id: true,
      memberships: { where: { role: 'owner', status: 'active' }, select: { userId: true } },
    },
  })
  return siens
    .filter((parc) => parc.memberships.every((adhesion) => adhesion.userId === userId))
    .map((parc) => parc.id)
}
