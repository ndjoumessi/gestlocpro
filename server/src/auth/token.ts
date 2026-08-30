import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Jetons de session.
 *
 * Un jeton opaque tiré au hasard, et non un JWT. Le JWT porte son état, donc on
 * ne peut pas le révoquer : déconnecter quelqu'un, ou couper l'accès d'un
 * gestionnaire renvoyé, demande alors une liste de révocation — c'est-à-dire la
 * base de données qu'on prétendait éviter. Ce produit interroge la base à
 * chaque requête de toute façon ; l'argument du JWT tombe.
 *
 * **Seule l'empreinte du jeton est enregistrée.** Une fuite de la table des
 * sessions ne livre alors aucune session utilisable, exactement comme une fuite
 * de la table des comptes ne livre aucun mot de passe. C'est le même
 * raisonnement, et il est trop souvent appliqué aux mots de passe seuls.
 *
 * SHA-256 sans sel ni ralentissement, ici, est le bon choix : le jeton fait
 * 256 bits d'entropie réelle, il n'y a rien à deviner par dictionnaire. Le
 * ralentissement ne protège que les secrets choisis par des humains.
 */

/** 32 octets — 256 bits. Au-delà, on paie des caractères sans rien gagner. */
const OCTETS = 32

export interface JetonEmis {
  /** Remis au client dans le cookie. Jamais enregistré. */
  clair: string
  /** Enregistré en base. Ne permet pas de retrouver le jeton. */
  empreinte: string
}

export function creerJeton(): JetonEmis {
  const clair = randomBytes(OCTETS).toString('base64url')
  return { clair, empreinte: empreinteJeton(clair) }
}

export function empreinteJeton(clair: string): string {
  return createHash('sha256').update(clair).digest('base64url')
}

/**
 * Compare deux empreintes en temps constant.
 *
 * Le gain est plus mince que pour un mot de passe — comparer des empreintes
 * n'expose que l'empreinte —, mais la fonction existe, elle est gratuite, et
 * son absence est le genre de détail qu'on ne repère jamais à la relecture.
 */
export function memeJeton(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  // `timingSafeEqual` lève sur des longueurs différentes : la comparaison
  // préalable fuite la longueur, qui est publique et constante ici.
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Durée de vie d'une session retenue : 30 jours, glissante à chaque requête. */
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Durée d'une session qu'on ne veut PAS retenir : douze heures.
 *
 * Le chiffre est un arbitrage, et il vaut d'être écrit. Plus court — deux ou
 * quatre heures — couperait une journée de travail au milieu, et le produit se
 * ferait détester par ceux-là mêmes qui ont pris la précaution de décocher.
 * Plus long ferait recouvrir la nuit, donc le lendemain, donc la personne
 * suivante devant le poste partagé : c'est précisément ce qu'on ferme.
 *
 * Douze heures couvrent la plus longue journée ouvrée et jamais deux.
 */
export const DUREE_SESSION_COURTE_MS = 12 * 60 * 60 * 1000

/** La durée d'une session selon qu'on retient l'appareil ou non. */
export function dureeSession(persistante: boolean): number {
  return persistante ? DUREE_SESSION_MS : DUREE_SESSION_COURTE_MS
}

export function expirationDepuis(maintenant: Date, persistante = true): Date {
  return new Date(maintenant.getTime() + dureeSession(persistante))
}
