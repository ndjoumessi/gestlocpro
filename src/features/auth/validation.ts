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

/** Met en forme la saisie du code au fil de la frappe : loc1234abcd -> LOC-1234-ABCD */
export function formatInviteCode(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = clean.startsWith('LOC') ? clean.slice(3) : clean
  const parts = ['LOC']
  if (body.length) parts.push(body.slice(0, 4))
  if (body.length > 4) parts.push(body.slice(4, 8))
  return parts.join('-')
}

/** `true` si aucun champ n'est en erreur. */
export function isClean(errors: Record<string, FieldError>): boolean {
  return Object.values(errors).every((error) => error === null)
}
