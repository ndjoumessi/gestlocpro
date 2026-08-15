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

/**
 * `CFA` couvre les deux zones franc, CEMAC et UEMOA.
 *
 * Elles portaient auparavant deux codes distincts, `XAF` et `XOF`. Ce sont bien
 * deux monnaies séparées — un billet XAF n'a pas cours légal en zone UEMOA —
 * mais elles partagent le nom « FCFA » et la même parité fixe avec l'euro
 * (655,957). Le produit n'affichant que des montants, sans conversion ni
 * paiement, la distinction ne changeait rien à l'écran sauf le suffixe du
 * sélecteur.
 *
 * `CFA` n'est pas un code ISO 4217 : il n'existe pas de code commun aux deux
 * zones. Une intégration comptable ou bancaire devra donc rétablir `XAF` et
 * `XOF`, et le pays de l'utilisateur — déjà connu, voir `lib/countries` — suffit
 * à retrouver lequel s'applique.
 */
export const CURRENCIES = ['CFA', 'EUR', 'CAD', 'USD'] as const

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
  CFA: {
    code: 'CFA',
    symbol: 'FCFA',
    label: 'FCFA',
    // La locale ne sert qu'au groupement des milliers, identique dans tous les
    // français ; aucune des deux zones n'est donc privilégiée par ce choix.
    locale: 'fr',
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

export const DEFAULT_CURRENCY: CurrencyCode = 'CFA'

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
