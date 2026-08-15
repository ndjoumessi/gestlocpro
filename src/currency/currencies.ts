/**
 * Devises supportées.
 *
 * Aucune conversion de change n'est appliquée : un montant du jeu de données
 * est affiché tel quel, avec le formatage et le symbole de la devise choisie.
 * C'est le comportement de la maquette d'origine, assumé et signalé à
 * l'utilisateur par `MoneyBasisNote`. Les tarifs de la landing, eux, sont
 * ancrés indépendamment par devise (voir `features/marketing/pricing.ts`) et
 * ne sont donc pas concernés.
 */

export const CURRENCIES = ['XAF', 'XOF', 'EUR', 'CAD', 'USD'] as const

export type CurrencyCode = (typeof CURRENCIES)[number]

export interface CurrencyDef {
  code: CurrencyCode
  /** Symbole compact affiché à côté des montants. */
  symbol: string
  /** Libellé du sélecteur. */
  label: string
  /** Locale utilisée pour le groupement des milliers. */
  locale: string
  /** Sous-unités affichées. Les francs CFA n'en ont pas. */
  decimals: 0 | 2
  /** Symbole avant ou après le nombre. */
  position: 'before' | 'after'
}

export const CURRENCY_DEFS: Record<CurrencyCode, CurrencyDef> = {
  XAF: {
    code: 'XAF',
    symbol: 'FCFA',
    label: 'FCFA (XAF)',
    locale: 'fr-CM',
    decimals: 0,
    position: 'after',
  },
  XOF: {
    code: 'XOF',
    symbol: 'FCFA',
    label: 'FCFA (XOF)',
    locale: 'fr-SN',
    decimals: 0,
    position: 'after',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    label: 'Euro (€)',
    locale: 'fr-FR',
    decimals: 2,
    position: 'after',
  },
  CAD: {
    code: 'CAD',
    symbol: '$',
    label: 'CAD ($)',
    locale: 'fr-CA',
    decimals: 2,
    position: 'after',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    label: 'USD ($)',
    locale: 'en-US',
    decimals: 2,
    position: 'before',
  },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'XAF'

export interface FormatMoneyOptions {
  /** Masque le symbole — utile quand une colonne le porte déjà en en-tête. */
  omitSymbol?: boolean
  /** Force l'absence de décimales (KPI compacts). */
  round?: boolean
}

/**
 * Formate un montant selon la devise active.
 * Utilise des espaces insécables étroits pour que les milliers ne se coupent
 * jamais en fin de ligne dans un tableau.
 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options: FormatMoneyOptions = {},
): string {
  const def = CURRENCY_DEFS[currency]
  const decimals = options.round ? 0 : def.decimals

  const number = new Intl.NumberFormat(def.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(amount)
    // Uniformise les séparateurs de milliers en espace insécable étroit.
    .replace(/[  \s]/g, ' ')

  if (options.omitSymbol) return number
  return def.position === 'before'
    ? `${def.symbol} ${number}`
    : `${number} ${def.symbol}`
}

/** Variante compacte pour les axes de graphe : 1 415 000 -> 1,4 M */
export function formatMoneyCompact(amount: number, currency: CurrencyCode): string {
  const def = CURRENCY_DEFS[currency]
  return new Intl.NumberFormat(def.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}
