import type { CurrencyCode } from '@/currency/currencies'

/**
 * Grille tarifaire. Facturation à l'unité gérée, trois paliers.
 *
 * Chaque devise porte son propre montant : ce ne sont pas des conversions d'un
 * prix de référence. Attention toutefois — le franc CFA est en **parité fixe**
 * avec l'euro (1 EUR = 655,957 XAF comme XOF, sans flottement) : un prix en
 * FCFA est donc mécaniquement un prix en euros, et prétendre l'avoir « ancré
 * indépendamment du taux du jour » n'aurait aucun sens. Seuls EUR, CAD et USD
 * sont réellement ancrés les uns par rapport aux autres.
 *
 * Le calage se fait sur la **part du loyer encaissé**, pas sur le taux de
 * change : c'est le loyer que le produit administre, donc la valeur qu'il
 * délivre. Avec un loyer moyen de 136 667 FCFA à Douala contre ~700 € pour un
 * bailleur privé européen, les montants ci-dessous représentent 0,18 % du
 * quittancé en zone FCFA contre 0,13 % en zone euro.
 *
 * Ils valaient auparavant 4 900 et 14 900 FCFA, soit 0,36 % et 0,22 % : une
 * remise nominale de 17 % sur le prix affiché, mais une surtaxe de 2,8x
 * rapportée au chiffre d'affaires du bailleur — sur le marché au pouvoir
 * d'achat le plus faible. Le rapport restant (1,4x plutôt que la parité
 * stricte, qui donnerait ~1 800 FCFA) couvre le coût réel des relances SMS et
 * du support sur ces marchés.
 *
 * Les montants tombent sur des coupures composables en espèces et en mobile
 * money (500 · 1 000 · 2 000 · 5 000 · 10 000). La terminaison en « 9 » des
 * prix occidentaux n'a pas cours sur ces marchés.
 *
 * HYPOTHÈSE PRODUIT restante : le niveau absolu des prix en zone euro, ainsi
 * que la frontière à 10 unités — passer de 10 à 11 unités triple la facture,
 * ce qui est inhérent aux paliers mais tombe sur une taille de parc répandue.
 */
export type PlanId = 'essential' | 'pro' | 'cabinet'

export interface Plan {
  id: PlanId
  /** `null` = sur devis. */
  monthly: Record<CurrencyCode, number> | null
  units: number | 'unlimited'
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'essential',
    units: 10,
    monthly: { XAF: 2500, XOF: 2500, EUR: 9, CAD: 13, USD: 9 },
  },
  {
    id: 'pro',
    units: 50,
    popular: true,
    monthly: { XAF: 7500, XOF: 7500, EUR: 29, CAD: 39, USD: 29 },
  },
  {
    id: 'cabinet',
    units: 'unlimited',
    monthly: null,
  },
]

/** Remise appliquée au paiement annuel. */
export const YEARLY_DISCOUNT = 0.2

export type FeatureValue = boolean | 'manual' | 'auto' | 'email' | 'priority' | 'dedicated' | string

export interface FeatureRow {
  key: string
  values: Record<PlanId, FeatureValue>
}

export const FEATURE_MATRIX: FeatureRow[] = [
  { key: 'rent', values: { essential: true, pro: true, cabinet: true } },
  { key: 'meters', values: { essential: true, pro: true, cabinet: true } },
  { key: 'portal', values: { essential: true, pro: true, cabinet: true } },
  { key: 'reminders', values: { essential: 'manual', pro: 'auto', cabinet: 'auto' } },
  { key: 'inspections', values: { essential: true, pro: true, cabinet: true } },
  { key: 'managers', values: { essential: false, pro: '3', cabinet: 'illimité' } },
  { key: 'exports', values: { essential: false, pro: true, cabinet: true } },
  { key: 'multiCompany', values: { essential: false, pro: false, cabinet: true } },
  { key: 'support', values: { essential: 'email', pro: 'priority', cabinet: 'dedicated' } },
]

/** Prix mensuel affiché, remise annuelle incluse le cas échéant. */
export function planPrice(
  plan: Plan,
  currency: CurrencyCode,
  period: 'monthly' | 'yearly',
): number | null {
  if (!plan.monthly) return null
  const base = plan.monthly[currency]
  if (period === 'monthly') return base

  const discounted = base * (1 - YEARLY_DISCOUNT)
  // Les francs CFA n'ont pas de sous-unité : on arrondit à la centaine, sans
  // quoi la remise annuelle produirait des montants comme « 5 984 FCFA », qui
  // ne ressemblent pas à un prix. Avec la grille actuelle la remise tombe
  // juste : 2 500 -> 2 000 et 7 500 -> 6 000, deux coupures courantes.
  return currency === 'XAF' || currency === 'XOF'
    ? Math.round(discounted / 100) * 100
    : Math.round(discounted * 100) / 100
}
