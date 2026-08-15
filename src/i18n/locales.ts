export const LOCALES = ['fr', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fr'

export const LOCALE_LABELS: Record<Locale, { short: string; long: string }> = {
  fr: { short: 'FR', long: 'Français' },
  en: { short: 'EN', long: 'English' },
}

/** Locale de formatage des dates, distincte de la locale de devise. */
export const DATE_LOCALE: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
}
