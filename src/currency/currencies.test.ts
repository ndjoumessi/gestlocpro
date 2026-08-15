import { describe, expect, it } from 'vitest'
import { CURRENCIES, CURRENCY_DEFS, formatMoney } from './currencies'
import { COUNTRIES } from '@/lib/countries'

/**
 * Formatage monétaire et cohérence des devises.
 *
 * Deux règles de produit sont verrouillées ici. D'abord l'absence de conversion
 * de change : un même montant s'affiche tel quel dans toutes les devises, seuls
 * le formatage et le symbole changent. Ensuite la distinction XAF/XOF, qui a
 * été un arbitrage explicite : ce sont deux codes ISO distincts partageant le
 * nom « FCFA », et les confondre reviendrait à mal rattacher sept pays.
 */

describe('formatage', () => {
  it('n’applique aucune conversion de change', () => {
    // La valeur numérique est identique partout ; seule la présentation varie.
    // `round` est nécessaire : sans lui, l'euro rend « 1 000,00 » et retirer
    // les non-chiffres concatènerait la partie décimale en « 100000 ».
    const rendus = CURRENCIES.map((code) =>
      formatMoney(1000, code, { omitSymbol: true, round: true }),
    )
    const chiffres = rendus.map((r) => r.replace(/\D/g, ''))
    expect(new Set(chiffres)).toEqual(new Set(['1000']))
  })

  it('place le symbole selon la convention de la devise', () => {
    // L'espace entre montant et symbole est elle aussi insécable : « 1 000 »
    // ne doit pas se retrouver séparé de « FCFA » en fin de ligne.
    expect(formatMoney(1000, 'XAF', { round: true })).toBe('1\u202f000\u202fFCFA')
    // Le dollar suit `en-US` et sépare donc les milliers par une virgule, là
    // où le franc CFA et l'euro emploient une espace.
    expect(formatMoney(1000, 'USD', { round: true })).toBe('$\u202f1,000')
  })

  it('n’ajoute pas de sous-unité aux francs CFA', () => {
    // Le centime de franc CFA n'a pas cours.
    expect(formatMoney(1500, 'XAF')).not.toContain(',')
    expect(formatMoney(1500, 'XOF')).not.toContain(',')
  })

  it('conserve les sous-unités des devises qui en ont', () => {
    expect(formatMoney(1500.5, 'EUR')).toContain('1\u202f500,50')
  })

  it('arrondit sur demande, pour les indicateurs compacts', () => {
    expect(formatMoney(1500.5, 'EUR', { round: true })).not.toContain(',50')
  })

  it('sépare les milliers par une espace insécable étroite', () => {
    // Une espace ordinaire autoriserait une coupure de ligne au milieu d'un
    // montant, dans un tableau où les colonnes sont déjà serrées.
    const rendu = formatMoney(1415000, 'XAF', { round: true })
    expect(rendu).toContain('\u202f')
    expect(rendu).not.toMatch(/\d \d/)
  })
})

describe('XAF et XOF restent distincts', () => {
  it('portent deux codes et deux libellés', () => {
    expect(CURRENCY_DEFS.XAF.label).not.toBe(CURRENCY_DEFS.XOF.label)
    expect(CURRENCY_DEFS.XAF.label).toContain('XAF')
    expect(CURRENCY_DEFS.XOF.label).toContain('XOF')
  })

  it('couvrent des pays disjoints', () => {
    const xaf = COUNTRIES.filter((c) => c.currency === 'XAF').map((c) => c.code)
    const xof = COUNTRIES.filter((c) => c.currency === 'XOF').map((c) => c.code)

    expect(xaf.length).toBeGreaterThan(0)
    expect(xof.length).toBeGreaterThan(0)
    expect(xaf.filter((code) => xof.includes(code))).toEqual([])
  })

  it('rattache le Cameroun au XAF et le Sénégal au XOF', () => {
    expect(COUNTRIES.find((c) => c.code === 'CM')?.currency).toBe('XAF')
    expect(COUNTRIES.find((c) => c.code === 'SN')?.currency).toBe('XOF')
  })
})

describe('cohérence de la liste des pays', () => {
  it('n’attache aucun pays à une devise non prise en charge', () => {
    for (const country of COUNTRIES) {
      expect(CURRENCIES).toContain(country.currency)
    }
  })

  it('donne à chaque pays un indicatif bien formé', () => {
    for (const country of COUNTRIES) {
      expect(country.dial).toMatch(/^\+\d{1,4}$/)
    }
  })

  it('n’a pas de code pays en double', () => {
    const codes = COUNTRIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('nomme chaque pays dans les deux langues', () => {
    for (const country of COUNTRIES) {
      expect(country.nameFr.length).toBeGreaterThan(1)
      expect(country.nameEn.length).toBeGreaterThan(1)
    }
  })
})
