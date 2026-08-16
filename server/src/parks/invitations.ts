import { randomInt } from 'node:crypto'
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
