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
 * silencieusement : avec une base de 1 250 et 125 par unité, 12 unités donnaient
 * 2 750 pour un prix affiché à 2 800. Le prospect qui posait le calcul trouvait
 * un écart inexpliqué — pire que de n'avoir rien affiché.
 *
 * L'Essentiel est depuis aligné sur des multiples de 100, ce qui règle son
 * mensuel. Pro non, et l'annuel reste concerné partout : deux raisons
 * structurelles, détaillées plus bas.
 */
describe('arrondi des francs CFA', () => {
  const positions = Array.from({ length: 60 }, (_, i) => i + 1)

  it('affiche le résultat exact de la formule sur l’Essentiel mensuel', () => {
    expect(exactPlanPrice(essentiel, 'XAF', 'monthly', 12)).toBe(2400)
    expect(planPrice(essentiel, 'XAF', 'monthly', 12)).toBe(2400)
    expect(positions.filter((u) => priceIsRounded(essentiel, 'XAF', 'monthly', u))).toHaveLength(0)
  })

  /**
   * Pro décroche, parce que son prix unitaire vaut 1,6 fois celui de l'Essentiel
   * — 160, qui n'est pas multiple de 100.
   *
   * Les deux objectifs sont incompatibles à cette échelle : pour qu'un prix
   * unitaire et son 1,6 soient tous deux multiples de 100, il faudrait un
   * multiple de 500. On a choisi le facteur d'upgrade constant plutôt que la
   * formule exacte, et la mention d'arrondi couvre l'écart.
   */
  it('décroche sur Pro, prix unitaire de 160 oblige', () => {
    expect(positions.filter((u) => priceIsRounded(pro, 'XAF', 'monthly', u))).toHaveLength(48)

    expect(exactPlanPrice(pro, 'XAF', 'monthly', 12)).toBe(3920)
    expect(planPrice(pro, 'XAF', 'monthly', 12)).toBe(3900)
  })

  it('garde un facteur d’upgrade constant sur le prix unitaire', () => {
    // Ce que les 160 achètent : l'effort d'upgrade ne croît plus avec le parc.
    expect(pro.pricing!.perUnit.XAF / essentiel.pricing!.perUnit.XAF).toBe(1.6)
    expect(pro.pricing!.perUnit.EUR / essentiel.pricing!.perUnit.EUR).toBe(1.6)
  })

  /**
   * L'annuel, lui, décroche — et c'est structurel, non un réglage à corriger.
   *
   * La remise de 20 % revient à multiplier par 4/5 : pour qu'un montant reste
   * multiple de 100 après l'opération, il doit être multiple de 125, donc de 500
   * pour l'être avant comme après. Aucun prix unitaire réaliste ne satisfait cela
   * à toute taille de parc — c'est bien pourquoi la mention d'arrondi reste
   * nécessaire.
   */
  it('décroche en annuel, ce que la mention d’arrondi couvre', () => {
    const decroche = positions.filter((u) => priceIsRounded(essentiel, 'XAF', 'yearly', u))
    expect(decroche.length).toBeGreaterThan(0)

    expect(exactPlanPrice(essentiel, 'XAF', 'yearly', 1)).toBe(1040)
    expect(planPrice(essentiel, 'XAF', 'yearly', 1)).toBe(1000)
  })

  it('suit la même grille dans les deux zones franc CFA', () => {
    for (const units of [1, 12, 60]) {
      expect(planPrice(essentiel, 'XOF', 'monthly', units)).toBe(
        planPrice(essentiel, 'XAF', 'monthly', units),
      )
    }
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
