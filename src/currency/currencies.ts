/**
 * Devises supportées.
 *
 * Aucune conversion de change n'est appliquée : un montant est affiché tel quel,
 * avec le formatage et le symbole de la devise en vigueur.
 *
 * Ce parti pris se réclamait d'un avertissement, « signalé à l'utilisateur par
 * `MoneyBasisNote` » — composant qui n'a jamais existé. La justification était
 * donc invoquée sans être tenue, et un parc camerounais pouvait s'afficher en
 * euros parce que le navigateur l'avait retenu.
 *
 * Ce qui le rend tenable aujourd'hui n'est pas une note mais une contrainte :
 * la devise vient du PARC (voir `AppShell`), et le sélecteur ne survit qu'en
 * démonstration, où les montants sont fictifs. Sans conversion, il n'y a qu'une
 * devise juste pour un parc — la sienne.
 * Les tarifs de la landing, eux, sont ancrés indépendamment par devise (voir
 * `features/marketing/pricing.ts`) et ne sont donc pas concernés.
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
  /**
   * Forme COMPACTE — le déclencheur du menu, la pastille de la vitrine.
   *
   * Ce n'est PAS le nom de la devise. Le nom se traduit, donc il vit dans le
   * dictionnaire (`common.currencyNames`) et c'est lui que portent les LISTES :
   * l'en-tête, l'inscription, la correction du parc. Ici on ne cherche qu'une
   * étiquette courte pour un espace contraint, où le code fait l'affaire parce
   * que le choix courant est déjà connu de celui qui l'a fait.
   */
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
 *
 * DEUX espaces insécables différentes, et la distinction se voit à l'écran.
 *
 * Les milliers prennent la FINE (U+202F), qui est la convention française et
 * qui empêche un montant de se couper en fin de cellule.
 *
 * Le symbole, lui, prend l'insécable PLEINE (U+00A0). Il portait la fine aussi,
 * ce qui a tenu tant que les montants étaient composés en chasse fixe : une
 * police à chasse fixe donne à chaque glyphe la même avance, espaces comprises,
 * donc la fine y occupait la largeur d'un chiffre. Le passage à la police
 * proportionnelle l'a ramenée à sa vraie valeur — 1,7 px contre 3,6 pour la
 * pleine — et « 231 178 FCFA » se lisait « 231 178FCFA », la devise soudée au
 * montant. L'usage français veut de toute façon une espace pleine devant une
 * unité, et une fine seulement entre les tranches de chiffres.
 */
/**
 * D'UNITÉS MINEURES EN UNITÉS D'USAGE.
 *
 * Le serveur compte en mineures — colonnes `Int`, schémas `z.number().int()`,
 * champs `…Minor`. Les écrans lisent des unités d'usage. La division vit ici,
 * nommée, parce que deux appelants en ont besoin : la mise en forme et l'export
 * calculable. Écrite deux fois, elle aurait donné un tableur qui ne dit pas ce
 * que l'écran affiche.
 *
 * En franc CFA, `10 ** 0` vaut un : la fonction est l'identité, et c'est
 * pourquoi tout le reste du produit ne bronche pas.
 */
export function enUniteDUsage(mineur: number, currency: CurrencyCode): number {
  return mineur / 10 ** CURRENCY_DEFS[currency].decimals
}

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
    .format(enUniteDUsage(amount, currency))
    // Uniformise les séparateurs de milliers en espace insécable étroit.
    .replace(/[  \s]/g, ' ')

  if (options.omitSymbol) return number
  return def.position === 'before'
    ? `${def.symbol} ${number}`
    : `${number} ${def.symbol}`
}

/**
 * Lit un montant saisi au clavier et le rend en UNITÉS MINEURES.
 *
 * La conversion vit ici et dans `formatMoney`, les deux fonctions par lesquelles
 * tout montant du produit passe déjà — voir l'en-tête d'`unités mineures` dans
 * les cas. En franc CFA, `10 ** 0` vaut un : rien ne change.
 *
 * Le code appelait `amount.replace(',', '.')` : la virgule était traitée comme
 * un séparateur décimal, toujours. En français c'est exact — « 1 450,50 ». En
 * anglais c'est le séparateur des **milliers**, si bien qu'un utilisateur qui
 * tapait `1,450` enregistrait **1,45**. Silencieusement : le montant est un
 * nombre valide et positif, donc aucune validation ne se déclenchait. Le
 * paiement était simplement enregistré cent fois trop bas.
 *
 * Les séparateurs ne sont pas devinés mais **demandés à `Intl`**, qui est déjà
 * la source de vérité de `formatMoney` : les deux fonctions ne peuvent donc pas
 * diverger. Écrire les séparateurs à la main ici aurait recréé le même défaut,
 * une couche plus bas.
 *
 * Rend `null` quand la saisie ne contient aucun nombre lisible, plutôt que le
 * `NaN` de `Number('')` — un appelant qui teste `!parsed` confondrait sinon
 * zéro et illisible.
 */
export function parseMoney(input: string, currency: CurrencyCode): number | null {
  const def = CURRENCY_DEFS[currency]
  const parts = new Intl.NumberFormat(def.locale).formatToParts(12345.6)
  const group = parts.find((p) => p.type === 'group')?.value ?? ''
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'

  let cleaned = input.trim()
  // Les espaces sous toutes leurs formes servent de séparateur de milliers en
  // français, y compris l'insécable étroite que `formatMoney` produit : un
  // montant recopié depuis l'écran doit pouvoir être resaisi tel quel.
  if (group) cleaned = cleaned.split(group).join('')
  cleaned = cleaned.replace(/[\s  ]/g, '')
  cleaned = cleaned.split(decimal).join('.')
  // Tout le reste — symbole monétaire, lettres, ponctuation — est écarté.
  cleaned = cleaned.replace(/[^\d.-]/g, '')

  if (!/\d/.test(cleaned)) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null

  /* ARRONDI, ET NON TRONQUÉ : une saisie « 900,505 » vaut 90 051 centimes et
     non 90 050. Sur une devise sans sous-unité, l'arrondi ramène « 900,50 » à
     901 — un centime de franc CFA n'a pas cours, et transmettre 900,5 dans un
     champ que le serveur exige entier le ferait refuser sans explication. */
  return Math.round(value * 10 ** def.decimals)
}
