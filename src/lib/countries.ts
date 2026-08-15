import type { CurrencyCode } from '@/currency/currencies'
import type { Locale } from '@/i18n/locales'

export interface Country {
  code: string
  /** Indicatif téléphonique international. */
  dial: string
  currency: CurrencyCode
  locale: Locale
  nameFr: string
  nameEn: string
}

/**
 * Pays proposés à l'inscription. Le pays pré-remplit la devise et la langue,
 * toutes deux modifiables ensuite.
 *
 * Les deux zones franc CFA sont distinctes : XAF (CEMAC) et XOF (UEMOA)
 * partagent le nom « FCFA » mais pas le code ISO ni la parité d'émission.
 */
export const COUNTRIES: Country[] = [
  // --- Zone CEMAC (XAF) ---
  { code: 'CM', dial: '+237', currency: 'XAF', locale: 'fr', nameFr: 'Cameroun', nameEn: 'Cameroon' },
  { code: 'GA', dial: '+241', currency: 'XAF', locale: 'fr', nameFr: 'Gabon', nameEn: 'Gabon' },
  // Qualifié : la République démocratique du Congo est un marché francophone
  // bien plus grand, et « Congo » seul ferait choisir la mauvaise entrée.
  { code: 'CG', dial: '+242', currency: 'XAF', locale: 'fr', nameFr: 'Congo-Brazzaville', nameEn: 'Republic of the Congo' },
  { code: 'TD', dial: '+235', currency: 'XAF', locale: 'fr', nameFr: 'Tchad', nameEn: 'Chad' },
  { code: 'CF', dial: '+236', currency: 'XAF', locale: 'fr', nameFr: 'République centrafricaine', nameEn: 'Central African Republic' },
  { code: 'GQ', dial: '+240', currency: 'XAF', locale: 'fr', nameFr: 'Guinée équatoriale', nameEn: 'Equatorial Guinea' },

  // --- Zone UEMOA (XOF) ---
  { code: 'SN', dial: '+221', currency: 'XOF', locale: 'fr', nameFr: 'Sénégal', nameEn: 'Senegal' },
  { code: 'CI', dial: '+225', currency: 'XOF', locale: 'fr', nameFr: "Côte d'Ivoire", nameEn: 'Ivory Coast' },
  { code: 'BJ', dial: '+229', currency: 'XOF', locale: 'fr', nameFr: 'Bénin', nameEn: 'Benin' },
  { code: 'BF', dial: '+226', currency: 'XOF', locale: 'fr', nameFr: 'Burkina Faso', nameEn: 'Burkina Faso' },
  { code: 'ML', dial: '+223', currency: 'XOF', locale: 'fr', nameFr: 'Mali', nameEn: 'Mali' },
  { code: 'TG', dial: '+228', currency: 'XOF', locale: 'fr', nameFr: 'Togo', nameEn: 'Togo' },
  { code: 'NE', dial: '+227', currency: 'XOF', locale: 'fr', nameFr: 'Niger', nameEn: 'Niger' },
  { code: 'GW', dial: '+245', currency: 'XOF', locale: 'fr', nameFr: 'Guinée-Bissau', nameEn: 'Guinea-Bissau' },

  // --- Zone euro ---
  { code: 'FR', dial: '+33', currency: 'EUR', locale: 'fr', nameFr: 'France', nameEn: 'France' },
  { code: 'BE', dial: '+32', currency: 'EUR', locale: 'fr', nameFr: 'Belgique', nameEn: 'Belgium' },
  { code: 'LU', dial: '+352', currency: 'EUR', locale: 'fr', nameFr: 'Luxembourg', nameEn: 'Luxembourg' },
  { code: 'PT', dial: '+351', currency: 'EUR', locale: 'en', nameFr: 'Portugal', nameEn: 'Portugal' },
  { code: 'ES', dial: '+34', currency: 'EUR', locale: 'en', nameFr: 'Espagne', nameEn: 'Spain' },

  // --- Amérique du Nord ---
  // Le Canada est réglé sur l'anglais : environ trois quarts de la population
  // est anglophone. Un bailleur québécois bascule en un clic.
  { code: 'CA', dial: '+1', currency: 'CAD', locale: 'en', nameFr: 'Canada', nameEn: 'Canada' },
  { code: 'US', dial: '+1', currency: 'USD', locale: 'en', nameFr: 'États-Unis', nameEn: 'United States' },
]

export const DEFAULT_COUNTRY = 'CM'

/**
 * Entrée « Autre », épinglée en fin de liste.
 *
 * Ce n'est pas un pays : elle ne pré-remplit rien. Un bailleur hors des pays
 * listés choisit lui-même sa devise et sa langue, plutôt que d'être bloqué à
 * l'inscription ou contraint de se déclarer dans un pays qui n'est pas le sien.
 */
export const OTHER_COUNTRY = 'OTHER'

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code)
}

export function countryName(country: Country, locale: Locale): string {
  return locale === 'fr' ? country.nameFr : country.nameEn
}

/** Pays triés alphabétiquement dans la langue courante. */
export function sortedCountries(locale: Locale): Country[] {
  return [...COUNTRIES].sort((a, b) =>
    countryName(a, locale).localeCompare(countryName(b, locale), locale),
  )
}

/**
 * Indicatifs uniques, triés par valeur numérique.
 *
 * Un tri de chaînes plaçait « +32 » après « +242 » : la France et la Belgique
 * se retrouvaient en fin de menu, derrière tous les indicatifs africains à
 * trois chiffres. On trie sur l'entier.
 */
export function sortedDialCodes(): string[] {
  return [...new Set(COUNTRIES.map((country) => country.dial))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  )
}
