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
  { code: 'CG', dial: '+242', currency: 'XAF', locale: 'fr', nameFr: 'Congo', nameEn: 'Congo' },
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

  // --- Zone euro ---
  { code: 'FR', dial: '+33', currency: 'EUR', locale: 'fr', nameFr: 'France', nameEn: 'France' },
  { code: 'BE', dial: '+32', currency: 'EUR', locale: 'fr', nameFr: 'Belgique', nameEn: 'Belgium' },
  { code: 'LU', dial: '+352', currency: 'EUR', locale: 'fr', nameFr: 'Luxembourg', nameEn: 'Luxembourg' },
  { code: 'PT', dial: '+351', currency: 'EUR', locale: 'en', nameFr: 'Portugal', nameEn: 'Portugal' },
  { code: 'ES', dial: '+34', currency: 'EUR', locale: 'en', nameFr: 'Espagne', nameEn: 'Spain' },

  // --- Amérique du Nord ---
  { code: 'CA', dial: '+1', currency: 'CAD', locale: 'fr', nameFr: 'Canada', nameEn: 'Canada' },
  { code: 'US', dial: '+1', currency: 'USD', locale: 'en', nameFr: 'États-Unis', nameEn: 'United States' },

  // --- Autres marchés USD ---
  { code: 'MA', dial: '+212', currency: 'USD', locale: 'fr', nameFr: 'Maroc', nameEn: 'Morocco' },
  { code: 'GB', dial: '+44', currency: 'USD', locale: 'en', nameFr: 'Royaume-Uni', nameEn: 'United Kingdom' },
]

export const DEFAULT_COUNTRY = 'CM'

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
