import { randomInt } from 'node:crypto'
import type { Prisma } from '../generated/prisma/client.js'
import { empreinteJeton } from '../auth/token.js'

/**
 * Codes d'invitation : émission et lecture.
 *
 * Le modèle les décrivait depuis l'origine — empreinte seule, indice de quatre
 * caractères, expiration, acceptation, révocation — et rien ne les écrivait.
 * L'assistant d'inscription en réclamait pourtant un, et le validait ; il
 * n'existait aucun code valide à saisir.
 *
 * Seule l'EMPREINTE est stockée, comme pour les sessions. Un code lisible en
 * base serait rejouable par quiconque la lit — sauvegarde, journal d'erreur,
 * copie de développement — alors qu'il donne accès au parc de quelqu'un.
 */

/**
 * Alphabet sans caractères ambigus.
 *
 * Ni `O` ni `0`, ni `I` ni `1`, ni `L`. Ces codes se dictent au téléphone et se
 * recopient depuis un SMS : une confusion de lecture coûte un aller-retour
 * entre le propriétaire et son locataire, pour un gain d'entropie négligeable.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Longueur de la partie aléatoire, hors préfixe. */
const LONGUEUR = 8

/**
 * Un code lisible, de la forme `LOC-4A7B-92CD`.
 *
 * Le préfixe dit le rôle invité : `LOC` pour un locataire, `GES` pour un
 * gestionnaire. Il ne porte aucune autorité — le serveur lit le rôle en base,
 * jamais dans le code — mais il évite au propriétaire d'envoyer une invitation
 * de gestionnaire à un locataire sans s'en apercevoir.
 */
export function creerCode(role: 'tenant' | 'manager'): { clair: string; hash: string; indice: string } {
  const prefixe = role === 'tenant' ? 'LOC' : 'GES'
  let corps = ''
  for (let i = 0; i < LONGUEUR; i += 1) {
    // `randomInt` et non `Math.random` : ce code protège l'accès à un parc, et
    // un générateur prévisible se devine hors ligne.
    corps += ALPHABET[randomInt(ALPHABET.length)]
  }
  const clair = `${prefixe}-${corps.slice(0, 4)}-${corps.slice(4)}`
  return {
    clair,
    hash: empreinteJeton(clair),
    // Les quatre derniers caractères : assez pour que le propriétaire
    // reconnaisse le code qu'il a envoyé, trop peu pour le rejouer.
    indice: corps.slice(4),
  }
}

/** Durée de validité. Au-delà, le code ne vaut plus rien. */
export const DUREE_INVITATION_MS = 14 * 24 * 60 * 60 * 1000

export function expirationInvitation(maintenant: Date): Date {
  return new Date(maintenant.getTime() + DUREE_INVITATION_MS)
}

/**
 * Normalise une saisie avant comparaison.
 *
 * Un code se recopie à la main : on tolère la casse et les espaces, jamais le
 * contenu. Sans cela, « loc-4a7b-92cd » — ce que produit une saisie mobile avec
 * majuscule automatique désactivée — serait refusé alors qu'il est correct.
 */
export function normaliserCode(saisie: string): string {
  return saisie.trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * LE CODE RATTACHE LA FICHE, ET PAS SEULEMENT L'ADHÉSION.
 *
 * ═══ CE QUI MANQUAIT, ET DEPUIS L'ORIGINE ═══
 *
 * Les deux chemins qui consomment un code — l'inscription et `/api/join` —
 * créaient une `Membership` et rien d'autre. `Invitation.unitId` était écrit à
 * l'émission et n'était RELU nulle part.
 *
 * Or tout ce qu'un locataire voit passe par `tenant: { userId }` — `guards.ts`
 * et une douzaine de lectures de `parks/routes.ts`. Sa fiche gardant
 * `userId: null`, chacune de ces requêtes ne trouvait rien : compte valide,
 * adhésion valide, bail existant, et un espace vide. Signalé sur la production
 * dans ces termes, et le schéma le promettait déjà — `Tenant.userId` porte
 * « renseigné quand l'invitation a été utilisée ».
 *
 * ═══ CE QU'ELLE RATTACHE, ET CE QU'ELLE REFUSE DE TOUCHER ═══
 *
 * Le bail du logement VISÉ par l'invitation, dont la fiche n'a pas encore de
 * compte. Trois conditions, chacune pour une raison distincte :
 *
 *  · `role === 'tenant'` — un gestionnaire opère tout le parc et n'a pas de
 *    fiche ; lui en attacher une lui donnerait le périmètre d'un locataire ;
 *  · `userId: null` sur la fiche — une fiche déjà rattachée appartient à
 *    quelqu'un, et la réécrire retirerait son espace à cette personne-là ;
 *  · le compte n'a AUCUNE fiche ailleurs — `Tenant.userId` est unique sur toute
 *    la base, donc un même compte ne peut être locataire que d'un seul parc.
 *    C'est une limite du schéma, pas un choix de ce lot : sans ce contrôle,
 *    Prisma lèverait un P2002 qui ferait échouer toute l'inscription.
 *
 * ═══ ELLE NE HURLE PAS QUAND ELLE NE TROUVE RIEN ═══
 *
 * Une invitation sans unité est LICITE — la modale le dit : « sans logement, il
 * rejoint le parc sans bail, vous l'y rattacherez ensuite ». Un logement vacant
 * l'est tout autant. Faire échouer l'inscription dans ces cas retirerait un
 * parcours que le produit propose, pour une donnée qui n'a jamais existé.
 */
export async function rattacherLaFicheLocataire(
  tx: Prisma.TransactionClient,
  { invitationId, userId }: { invitationId: string; userId: string },
): Promise<string | null> {
  const invitation = await tx.invitation.findUnique({
    where: { id: invitationId },
    select: { role: true, unitId: true },
  })
  if (!invitation || invitation.role !== 'tenant' || !invitation.unitId) return null

  // Un compte n'a qu'une fiche sur toute la base : voir l'en-tête.
  const dejaLocataire = await tx.tenant.findFirst({ where: { userId }, select: { id: true } })
  if (dejaLocataire) return null

  /* Le bail le PLUS RÉCENT du logement, parmi ceux qui courent ou vont courir.
     Un logement relouté en porte plusieurs, dont d'anciens `ended` : rattacher
     le nouvel arrivant à la fiche de l'ancien occupant lui donnerait l'historique
     de quelqu'un d'autre. */
  const bail = await tx.lease.findFirst({
    where: {
      unitId: invitation.unitId,
      status: { in: ['active', 'pending'] },
      tenant: { userId: null },
    },
    orderBy: { startsOn: 'desc' },
    select: { tenantId: true },
  })
  if (!bail) return null

  /* `updateMany` avec `userId: null` DANS le filtre, et non `update` : entre la
     lecture et l'écriture, un second code peut avoir rattaché la même fiche.
     Le compteur à zéro dit alors « quelqu'un est passé avant », sans lever. */
  const { count } = await tx.tenant.updateMany({
    where: { id: bail.tenantId, userId: null },
    data: { userId },
  })
  return count === 1 ? bail.tenantId : null
}
