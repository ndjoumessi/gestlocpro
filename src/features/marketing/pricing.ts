import type { CurrencyCode } from '@/currency/currencies'

/**
 * Grille tarifaire.
 *
 * HYPOTHÈSE PRODUIT — à valider. Facturation à l'unité gérée, trois paliers.
 *
 * Les prix sont **ancrés indépendamment par devise**, ils ne sont pas convertis
 * depuis un montant de référence : 4 900 XAF n'est pas la contrepartie de 9 €
 * au taux du jour, c'est un prix pensé pour son marché. C'est aussi ce qui
 * rend cohérente l'absence de conversion de change ailleurs dans le produit.
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
    monthly: { XAF: 4900, XOF: 4900, EUR: 9, CAD: 13, USD: 9 },
  },
  {
    id: 'pro',
    units: 50,
    popular: true,
    monthly: { XAF: 14900, XOF: 14900, EUR: 29, CAD: 39, USD: 29 },
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
  // Les francs CFA n'ont pas de sous-unité : on arrondit à la centaine pour
  // éviter d'afficher « 3 920 FCFA », qui ne ressemble pas à un prix.
  return currency === 'XAF' || currency === 'XOF'
    ? Math.round(discounted / 100) * 100
    : Math.round(discounted * 100) / 100
}
