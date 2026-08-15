export const LOCALES = ['fr', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fr'

export const LOCALE_LABELS: Record<Locale, { short: string; long: string }> = {
  fr: { short: 'FR', long: 'Français' },
  en: { short: 'EN', long: 'English' },
}

/**
 * Repli de formatage des dates quand aucun pays n'est connu — visiteur de la
 * landing qui n'a pas encore choisi, ou inscription en « Autre pays ».
 */
export const DATE_LOCALE: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
}

/**
 * Étiquette BCP-47 de formatage, langue **et** pays.
 *
 * Le format de date dépend du pays, pas seulement de la langue : `en-GB` donne
 * 12/08, `en-US` donne 08/12, et `fr-CA` donne 2026-08-12. Se contenter de la
 * langue faisait lire à un bailleur américain des dates jour-d'abord.
 *
 * Le pays vient du choix fait à l'inscription. Sans lui, on retombe sur le
 * repli ci-dessus plutôt que d'inventer une région.
 */
export function resolveDateLocale(locale: Locale, region?: string | null): string {
  if (!region || !/^[A-Z]{2}$/.test(region)) return DATE_LOCALE[locale]
  return `${locale}-${region}`
}
