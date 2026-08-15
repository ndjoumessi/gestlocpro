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
 * ── Pourquoi le supplément de Pro est proportionnel ───────────────────────
 * Il a d'abord été posé en forfait : +2 500 FCFA, quel que soit le parc. Un
 * forfait plat est un supplément régressif — il représentait +182 % du prix
 * d'Essentiel à une unité contre +33 % à cinquante, soit un effort d'upgrade
 * 5,5 fois plus lourd pour un petit parc. La décision de passer à Pro dépendait
 * donc massivement de la taille, ce que la formule de base venait précisément
 * de corriger.
 *
 * Pire, la valeur va dans l'autre sens. Le supplément achète surtout les
 * relances automatiques : avec environ 30 % de baux en incident, un parc d'une
 * unité a 0,3 locataire à relancer par mois, un parc de cinquante en a quinze.
 * Le gros parc valorise le plus la fonction et la payait le moins cher.
 *
 * Pro vaut désormais 1,6 x Essentiel — même facteur sur l'abonnement et sur le
 * prix unitaire. L'effort d'upgrade est constant à +60 % sur toute la plage, et
 * le choix entre les deux paliers porte enfin sur les fonctions seules.
 * Contrepartie assumée : sous ~22 unités Pro coûte moins qu'avant, au-dessus il
 * coûte davantage.
 *
 * ── HYPOTHÈSE restante ────────────────────────────────────────────────────
 * Le NIVEAU du supplément (60 %) reste posé à dire d'expert : c'est sa
 * proportionnalité qui a été validée, pas son montant. À confronter au marché.
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
      // Base et prix unitaire multiples de 100 : le total mensuel tombe donc
      // juste, et la formule affichée sous le prix se vérifie. Cela ne vaut que
      // pour le mensuel — voir `priceIsRounded`.
      //
      // Les deux zones franc CFA suivent la même grille : les faire diverger
      // ici créerait deux tarifs pour un même montant nominal.
      base: { XAF: 1200, XOF: 1200, EUR: 4, CAD: 6, USD: 4 },
      perUnit: { XAF: 100, XOF: 100, EUR: 0.5, CAD: 0.7, USD: 0.5 },
    },
  },
  {
    id: 'pro',
    popular: true,
    // 1,6 x Essentiel sur le prix unitaire, dans toutes les devises : l'effort
    // d'upgrade ne croît donc plus avec la taille du parc.
    //
    // En franc CFA, 160 n'est pas multiple de 100 : le total mensuel de Pro
    // décroche à nouveau de sa formule, 48 positions du curseur sur 60. Les deux
    // objectifs sont incompatibles à cette échelle de prix — pour qu'un prix
    // unitaire et son 1,6 soient tous deux multiples de 100, il faudrait un
    // multiple de 500. La mention d'arrondi couvre l'écart.
    //
    // L'abonnement, lui, garde un rapport de 1,667 (2 000 / 1 200) : le ramener
    // à 1,6 demanderait 1 920, qui décrocherait à son tour.
    pricing: {
      base: { XAF: 2000, XOF: 2000, EUR: 6, CAD: 9, USD: 6 },
      perUnit: { XAF: 160, XOF: 160, EUR: 0.8, CAD: 1.1, USD: 0.8 },
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
  const value = exactPlanPrice(plan, currency, period, units)
  if (value === null) return null

  // Les francs CFA n'ont pas de sous-unité : on arrondit à la centaine, sans
  // quoi la formule produirait des montants comme « 3 062 FCFA », qui ne
  // ressemblent pas à un prix.
  return currency === 'XAF' || currency === 'XOF'
    ? Math.round(value / 100) * 100
    : Math.round(value * 100) / 100
}

/** Résultat brut de la formule, avant tout arrondi d'affichage. */
export function exactPlanPrice(
  plan: Plan,
  currency: CurrencyCode,
  period: 'monthly' | 'yearly',
  units: number,
): number | null {
  if (!plan.pricing) return null

  const raw = plan.pricing.base[currency] + plan.pricing.perUnit[currency] * units
  return period === 'monthly' ? raw : raw * (1 - YEARLY_DISCOUNT)
}

/**
 * `true` quand le montant affiché s'écarte de la formule affichée sous lui.
 *
 * La formule est là pour que le prix soit vérifiable ; l'arrondi à la centaine
 * la contredisait sans le dire, et le prospect qui posait le calcul trouvait un
 * écart inexpliqué — pire que de n'avoir rien affiché.
 *
 * En franc CFA, base et prix unitaire sont désormais multiples de 100 : le
 * **mensuel** tombe donc toujours juste. Le **annuel** non, et c'est structurel.
 * La remise de 20 % revient à multiplier par 4/5 : pour qu'un montant reste
 * multiple de 100 après cette opération, il doit être multiple de 125 — donc de
 * 500 pour l'être avant et après. Aucun prix unitaire réaliste ne satisfait cela
 * pour toute taille de parc. La mention d'arrondi garde donc son emploi, sur la
 * seule période annuelle.
 *
 * La tolérance écarte le bruit de la virgule flottante : en euros, la remise
 * annuelle produit des valeurs comme 8.000000000000002, qui ne sont pas un
 * arrondi visible et ne doivent donc rien déclencher.
 */
export function priceIsRounded(
  plan: Plan,
  currency: CurrencyCode,
  period: 'monthly' | 'yearly',
  units: number,
): boolean {
  const exact = exactPlanPrice(plan, currency, period, units)
  const shown = planPrice(plan, currency, period, units)
  if (exact === null || shown === null) return false
  return Math.abs(shown - exact) > 0.005
}
