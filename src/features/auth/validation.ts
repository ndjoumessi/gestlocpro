import type { MessageKey } from '@/i18n/I18nProvider'

/**
 * Validateurs partagés par la connexion et l'inscription.
 *
 * Ils renvoient une **clé de message**, pas une chaîne : la traduction se fait
 * au rendu, si bien qu'une erreur déjà affichée change de langue avec le reste
 * de l'interface au lieu de rester figée dans celle de la saisie.
 */
export type FieldError = MessageKey | null

// Volontairement permissif : le rôle d'un formulaire n'est pas de refuser une
// adresse exotique mais valide. Le vrai contrôle est le lien de confirmation.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateName(value: string): FieldError {
  return value.trim().length < 2 ? 'auth.errors.nameRequired' : null
}

export function validateEmail(value: string): FieldError {
  if (!value.trim()) return 'auth.errors.emailRequired'
  return EMAIL.test(value.trim()) ? null : 'auth.errors.emailInvalid'
}

export function validatePassword(value: string, { requireStrong = false } = {}): FieldError {
  if (!value) return 'auth.errors.passwordRequired'
  if (requireStrong && value.length < 8) return 'auth.errors.passwordShort'
  return null
}

/**
 * Confirmation d'un mot de passe.
 *
 * Le message ne dit pas laquelle des deux saisies est fautive : elles sont
 * masquées, l'utilisateur ne peut de toute façon comparer que ce qu'il retape.
 */
export function validatePasswordConfirmation(value: string, reference: string): FieldError {
  if (!value) return 'auth.errors.confirmRequired'
  return value === reference ? null : 'auth.errors.confirmMismatch'
}

/**
 * Jeton de réinitialisation.
 *
 * Sans serveur, la validité se réduit à la forme : seize caractères
 * hexadécimaux. Un jeton absent, tronqué ou raturé mène à l'écran « lien
 * expiré » plutôt qu'à un formulaire qui échouerait à l'envoi.
 */
export function isValidResetToken(token: string | null): boolean {
  return typeof token === 'string' && /^[0-9a-f]{16}$/.test(token)
}

/** Jeton de la démonstration, fixe pour que le parcours soit rejouable. */
export const DEMO_RESET_TOKEN = 'a7f3c9e1b4d82056'

export function validatePhone(value: string): FieldError {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'auth.errors.phoneRequired'
  return digits.length < 6 ? 'auth.errors.phoneInvalid' : null
}

export function validateParkName(value: string): FieldError {
  return value.trim().length < 2 ? 'auth.errors.parkNameRequired' : null
}

/** Code d'invitation locataire : LOC-XXXX-XXXX. */
const INVITE = /^LOC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i

export function validateInviteCode(value: string): FieldError {
  if (!value.trim()) return 'auth.errors.inviteRequired'
  return INVITE.test(value.trim()) ? null : 'auth.errors.inviteInvalid'
}

/**
 * Met en forme la saisie du code au fil de la frappe : loc4a7b92cd -> LOC-4A7B-92CD
 *
 * La fonction se contente de **regrouper** ce que l'utilisateur a tapé, sans
 * rien préfixer. Une version antérieure ajoutait « LOC- » d'office, puis
 * reconsommait ce préfixe comme saisie au caractère suivant : taper le code
 * lettre à lettre donnait « LOC-LOC4-A7B9 ». Le défaut n'apparaissait pas quand
 * on posait la valeur entière d'un coup, ce qu'aucun utilisateur ne fait.
 *
 * Cette forme est idempotente — la réappliquer à son propre résultat ne change
 * rien — ce qui est la propriété qui manquait.
 */
export function formatInviteCode(value: string): string {
  const clean = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 11)

  return [clean.slice(0, 3), clean.slice(3, 7), clean.slice(7, 11)].filter(Boolean).join('-')
}

/** `true` si aucun champ n'est en erreur. */
export function isClean(errors: Record<string, FieldError>): boolean {
  return Object.values(errors).every((error) => error === null)
}

/**
 * Robustesse d'un mot de passe : 0 = faible, 3 = robuste.
 *
 * Vit ici et non dans le composant qui l'affiche : c'est une règle de
 * validation, testable sans monter d'interface, et l'y laisser aurait fini par
 * la faire diverger des autres règles du même formulaire.
 */
export function scorePassword(value: string): 0 | 1 | 2 | 3 {
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (
    /[^a-zA-Z0-9]/.test(value) ||
    (/[0-9]/.test(value) && /[a-z]/.test(value) && /[A-Z]/.test(value))
  )
    score++
  return Math.min(score, 3) as 0 | 1 | 2 | 3
}
