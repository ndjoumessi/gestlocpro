import { describe, expect, it } from 'vitest'
import { PLANS, exactPlanPrice, planPrice, priceIsRounded } from './pricing'

const essentiel = PLANS.find((p) => p.id === 'essential')!
const pro = PLANS.find((p) => p.id === 'pro')!
const cabinet = PLANS.find((p) => p.id === 'cabinet')!

/**
 * Prix affiché contre formule affichée.
 *
 * La formule est écrite sous chaque montant pour que le prix soit vérifiable et
 * non seulement constaté. L'arrondi à la centaine des francs CFA la contredisait
 * silencieusement : 1 250 + 125 × 12 fait 2 750, et l'on affichait 2 800. Le
 * prospect qui posait le calcul trouvait un écart inexpliqué — pire que de
 * n'avoir rien affiché.
 */
describe('arrondi des francs CFA', () => {
  it('arrondit à la centaine', () => {
    expect(planPrice(essentiel, 'XAF', 'monthly', 12)).toBe(2800)
    expect(exactPlanPrice(essentiel, 'XAF', 'monthly', 12)).toBe(2750)
  })

  it('signale l’écart quand il existe', () => {
    expect(priceIsRounded(essentiel, 'XAF', 'monthly', 12)).toBe(true)
  })

  it('ne signale rien quand la formule tombe juste', () => {
    // Les coefficients de Pro sont multiples de 100 : il ne décroche jamais.
    expect(planPrice(pro, 'XAF', 'monthly', 12)).toBe(4400)
    expect(priceIsRounded(pro, 'XAF', 'monthly', 12)).toBe(false)
  })

  it('couvre les deux sens de l’arrondi', () => {
    // Vers le haut à 4 unités (1 750 → 1 800), vers le bas à 3 (1 625 → 1 600).
    expect(planPrice(essentiel, 'XAF', 'monthly', 4)).toBe(1800)
    expect(planPrice(essentiel, 'XAF', 'monthly', 3)).toBe(1600)
    expect(priceIsRounded(essentiel, 'XAF', 'monthly', 4)).toBe(true)
    expect(priceIsRounded(essentiel, 'XAF', 'monthly', 3)).toBe(true)
  })
})

describe('devises à sous-unité', () => {
  it('ne signale pas le bruit de la virgule flottante', () => {
    // La remise annuelle produit des valeurs comme 8.000000000000002 : ce n'est
    // pas un arrondi visible, et cela ne doit donc rien afficher.
    for (let units = 1; units <= 60; units += 1) {
      for (const currency of ['EUR', 'CAD', 'USD'] as const) {
        expect(priceIsRounded(essentiel, currency, 'yearly', units)).toBe(false)
        expect(priceIsRounded(pro, currency, 'yearly', units)).toBe(false)
      }
    }
  })
})

describe('paliers sur devis', () => {
  it('n’ont ni prix ni mention d’arrondi', () => {
    expect(planPrice(cabinet, 'XAF', 'monthly', 12)).toBeNull()
    expect(exactPlanPrice(cabinet, 'XAF', 'monthly', 12)).toBeNull()
    expect(priceIsRounded(cabinet, 'XAF', 'monthly', 12)).toBe(false)
  })
})
