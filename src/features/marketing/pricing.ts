import type { CurrencyCode } from '@/currency/currencies'

/**
 * Grille tarifaire — abonnement + prix par unité gérée.
 *
 * ── Pourquoi une formule et non des paliers d'unités ──────────────────────
 * La grille précédente bornait chaque palier par un nombre d'unités : ≤10 puis
 * ≤50. Elle produisait deux ruptures.
 *
 * En haut, passer de 10 à 11 unités triplait la facture : le coût par unité
 * bondissait de 250 à 682 FCFA, et il fallait atteindre 30 unités pour
 * retrouver le coût unitaire qu'on avait à 10. Vingt unités de croissance pour
 * revenir au point de départ.
 *
 * En bas — le défaut le plus grave, et le moins visible — le prix d'entrée
 * était forfaitaire : un bailleur d'UNE unité payait autant qu'un bailleur de
 * dix, soit 1,83 % de son loyer encaissé contre 0,18 %. Dix fois plus cher en
 * proportion, sur le segment le plus nombreux de ces marchés.
 *
 * La formule supprime les deux ruptures : le coût par unité décroît de façon
 * monotone sur toute la plage, et l'écart de traitement entre le client le
 * plus lourdement facturé et le plus légèrement tombe de x16,7 à x9,2.
 *
 * ── Calage ────────────────────────────────────────────────────────────────
 * Les coefficients d'Essentiel retombent exactement sur les prix précédents
 * aux deux points d'ancrage : 2 500 FCFA à 10 unités, 7 500 à 50. Le
 * repositionnement ne déplace donc pas le niveau de prix, il redistribue.
 * Contrepartie assumée : le milieu de gamme paie nettement moins qu'avant
 * (20 unités : 7 500 -> 3 750 FCFA). Ce segment subventionnait les gros parcs.
 *
 * ── HYPOTHÈSE restante ────────────────────────────────────────────────────
 * Seule la courbe d'Essentiel a été validée sur données. Le supplément de Pro
 * est un forfait de fonctionnalités (relances automatiques, gestionnaires
 * délégués, export comptable) posé à dire d'expert, au même prix marginal par
 * unité pour que le choix entre les deux paliers porte sur les fonctions et
 * jamais sur la taille du parc. Ce supplément reste à confronter au marché.
 */
export type PlanId = 'essential' | 'pro' | 'cabinet'

export interface PlanPricing {
  /** Abonnement mensuel, indépendant du nombre d'unités. */
  base: Record<CurrencyCode, number>
  /** Coût mensuel de chaque unité gérée. */
  perUnit: Record<CurrencyCode, number>
}

export interface Plan {
  id: PlanId
  /** `null` = sur devis. */
  pricing: PlanPricing | null
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'essential',
    pricing: {
      base: { XAF: 1250, XOF: 1250, EUR: 4, CAD: 6, USD: 4 },
      perUnit: { XAF: 125, XOF: 125, EUR: 0.5, CAD: 0.7, USD: 0.5 },
    },
  },
  {
    id: 'pro',
    popular: true,
    pricing: {
      base: { XAF: 3750, XOF: 3750, EUR: 12, CAD: 17, USD: 12 },
      perUnit: { XAF: 125, XOF: 125, EUR: 0.5, CAD: 0.7, USD: 0.5 },
    },
  },
  { id: 'cabinet', pricing: null },
]

/** Bornes du sélecteur d'unités de la page tarifs. */
export const UNITS_MIN = 1
export const UNITS_MAX = 60
export const UNITS_DEFAULT = 12

/** Au-delà, on bascule sur un devis plutôt que d'extrapoler la formule. */
export const UNITS_QUOTE_THRESHOLD = UNITS_MAX

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

/**
 * Prix mensuel pour un parc donné, remise annuelle incluse le cas échéant.
 * Renvoie `null` pour les paliers sur devis.
 */
export function planPrice(
  plan: Plan,
  currency: CurrencyCode,
  period: 'monthly' | 'yearly',
  units: number,
): number | null {
  if (!plan.pricing) return null

  const raw = plan.pricing.base[currency] + plan.pricing.perUnit[currency] * units
  const value = period === 'monthly' ? raw : raw * (1 - YEARLY_DISCOUNT)

  // Les francs CFA n'ont pas de sous-unité : on arrondit à la centaine, sans
  // quoi la formule produirait des montants comme « 3 062 FCFA », qui ne
  // ressemblent pas à un prix.
  return currency === 'XAF' || currency === 'XOF'
    ? Math.round(value / 100) * 100
    : Math.round(value * 100) / 100
}
