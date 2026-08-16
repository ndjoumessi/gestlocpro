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
 * Les deux zones franc — CEMAC et UEMOA — sont regroupées sous une seule devise
 * `CFA` : même nom d'usage, même parité, et le produit n'affiche des montants
 * qu'à titre indicatif. Le regroupement des pays est conservé ci-dessous, car il
 * suffit à retrouver `XAF` ou `XOF` le jour où un paiement l'exigera.
 */
export const COUNTRIES: Country[] = [
  // --- Zone CEMAC (anciennement XAF) ---
  { code: 'CM', dial: '+237', currency: 'CFA', locale: 'fr', nameFr: 'Cameroun', nameEn: 'Cameroon' },
  { code: 'GA', dial: '+241', currency: 'CFA', locale: 'fr', nameFr: 'Gabon', nameEn: 'Gabon' },
  // Qualifié : la République démocratique du Congo est un marché francophone
  // bien plus grand, et « Congo » seul ferait choisir la mauvaise entrée.
  { code: 'CG', dial: '+242', currency: 'CFA', locale: 'fr', nameFr: 'Congo-Brazzaville', nameEn: 'Republic of the Congo' },
  { code: 'TD', dial: '+235', currency: 'CFA', locale: 'fr', nameFr: 'Tchad', nameEn: 'Chad' },
  { code: 'CF', dial: '+236', currency: 'CFA', locale: 'fr', nameFr: 'République centrafricaine', nameEn: 'Central African Republic' },
  { code: 'GQ', dial: '+240', currency: 'CFA', locale: 'fr', nameFr: 'Guinée équatoriale', nameEn: 'Equatorial Guinea' },

  // --- Zone UEMOA (anciennement XOF) ---
  { code: 'SN', dial: '+221', currency: 'CFA', locale: 'fr', nameFr: 'Sénégal', nameEn: 'Senegal' },
  { code: 'CI', dial: '+225', currency: 'CFA', locale: 'fr', nameFr: "Côte d'Ivoire", nameEn: 'Ivory Coast' },
  { code: 'BJ', dial: '+229', currency: 'CFA', locale: 'fr', nameFr: 'Bénin', nameEn: 'Benin' },
  { code: 'BF', dial: '+226', currency: 'CFA', locale: 'fr', nameFr: 'Burkina Faso', nameEn: 'Burkina Faso' },
  { code: 'ML', dial: '+223', currency: 'CFA', locale: 'fr', nameFr: 'Mali', nameEn: 'Mali' },
  { code: 'TG', dial: '+228', currency: 'CFA', locale: 'fr', nameFr: 'Togo', nameEn: 'Togo' },
  { code: 'NE', dial: '+227', currency: 'CFA', locale: 'fr', nameFr: 'Niger', nameEn: 'Niger' },
  { code: 'GW', dial: '+245', currency: 'CFA', locale: 'fr', nameFr: 'Guinée-Bissau', nameEn: 'Guinea-Bissau' },

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
 * Indicatifs téléphoniques, chacun accompagné du ou des pays qu'il dessert.
 *
 * La version précédente rendait des indicatifs nus — `['+1', '+32', '+33', …]` —
 * obtenus par un `Set` qui écartait les doublons et, ce faisant, jetait le pays.
 * Le menu affichait donc quinze nombres sans moyen de savoir lequel choisir :
 * « +225 » ne dit rien à qui cherche la Côte d'Ivoire.
 *
 * Deux conséquences sur la forme retenue.
 *
 * Le **pays vient en premier** dans l'étiquette, et la liste est triée sur son
 * nom. C'est ce qui rend la recherche possible : un `<select>` natif saute à
 * l'option dont le texte commence par ce qu'on tape, donc « côt » mène à la
 * Côte d'Ivoire. Avec l'indicatif en tête, il aurait fallu connaître le numéro
 * qu'on est précisément venu chercher.
 *
 * Un indicatif partagé garde **une seule entrée**, portant tous ses pays —
 * « Canada, États-Unis · +1 ». Deux options de même valeur dans un `<select>`
 * contrôlé se marqueraient toutes deux sélectionnées, et l'utilisateur verrait
 * son choix se déplacer sur l'autre pays.
 */
/**
 * Indicatifs, la zone d'usage EN TÊTE.
 *
 * L'ordre était purement alphabétique : le Cameroun — marché principal du
 * produit — arrivait quatrième, derrière la Belgique et le Bénin, et un
 * bailleur de Douala devait faire défiler pour trouver son propre pays. Un
 * classement alphabétique paraît neutre ; il ne l'est que si l'on n'a aucune
 * idée de qui utilise le produit.
 *
 * Les deux zones franc d'abord — ce sont les pays servis —, le reste ensuite,
 * chaque groupe alphabétique. Le second groupe existe parce qu'un bailleur
 * peut résider en France ou au Canada et louer à Douala : l'écarter serait le
 * défaut inverse.
 */
export function dialOptions(locale: Locale): { dial: string; label: string; zone: 'cfa' | 'autre' }[] {
  const parIndicatif = new Map<string, string[]>()

  for (const country of COUNTRIES) {
    const noms = parIndicatif.get(country.dial) ?? []
    noms.push(countryName(country, locale))
    parIndicatif.set(country.dial, noms)
  }

  // Un indicatif appartient à la zone franc dès qu'un de ses pays s'y trouve :
  // `+1` couvre le Canada et les États-Unis, jamais la zone CFA.
  const zoneParIndicatif = new Map<string, 'cfa' | 'autre'>()
  for (const country of COUNTRIES) {
    const dansLaZone = country.currency === 'CFA'
    const connue = zoneParIndicatif.get(country.dial)
    zoneParIndicatif.set(country.dial, dansLaZone || connue === 'cfa' ? 'cfa' : 'autre')
  }

  return [...parIndicatif.entries()]
    .map(([dial, noms]) => ({
      dial,
      label: `${noms.sort((a, b) => a.localeCompare(b, locale)).join(', ')} · ${dial}`,
      zone: zoneParIndicatif.get(dial) ?? 'autre',
    }))
    .sort((a, b) => {
      if (a.zone !== b.zone) return a.zone === 'cfa' ? -1 : 1
      return a.label.localeCompare(b.label, locale)
    })
}
