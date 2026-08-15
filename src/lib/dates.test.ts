import { describe, expect, it } from 'vitest'
import { formatDayMonth, formatFullDate, formatMonthShort, formatMonthYear, formatRelative } from './dates'
import { DATE_LOCALE, resolveDateLocale } from '@/i18n/locales'

/**
 * Formatage des dates.
 *
 * Toutes les dates du produit étaient des chaînes françaises figées, y compris
 * dans l'interface anglaise. Elles passent désormais par `Intl`, avec une
 * étiquette composée de la **langue et du pays** : le format dépend du second
 * autant que du premier.
 *
 * Le piège que ces tests gardent : `fr-FR` et `en-GB` placent tous deux le jour
 * en premier, si bien qu'une régression rendant le formatage inerte passerait
 * inaperçue si l'on ne comparait que ces deux-là. D'où les cas `en-US` et
 * `fr-CA`, qui divergent réellement.
 */

// 22 juillet 2026 — mois 6, l'index partant de zéro.
const JOUR = { year: 2026, month: 6, day: 22 }

describe('résolution de l’étiquette', () => {
  it('compose langue et pays', () => {
    expect(resolveDateLocale('fr', 'CM')).toBe('fr-CM')
    expect(resolveDateLocale('en', 'US')).toBe('en-US')
  })

  it('retombe sur le repli sans pays connu', () => {
    // Visiteur de la landing, ou inscription en « Autre pays ».
    expect(resolveDateLocale('fr', null)).toBe(DATE_LOCALE.fr)
    expect(resolveDateLocale('en', undefined)).toBe(DATE_LOCALE.en)
  })

  it('refuse un code pays mal formé plutôt que de composer une étiquette invalide', () => {
    expect(resolveDateLocale('fr', 'cameroun')).toBe(DATE_LOCALE.fr)
    expect(resolveDateLocale('fr', '')).toBe(DATE_LOCALE.fr)
  })
})

describe('date complète', () => {
  it.each([
    ['fr-FR', '22/07/2026'],
    ['fr-CM', '22/07/2026'],
    ['en-GB', '22/07/2026'],
    ['en-US', '07/22/2026'],
    ['fr-CA', '2026-07-22'],
  ])('%s → %s', (tag, attendu) => {
    expect(formatFullDate(JOUR.year, JOUR.month, JOUR.day, tag)).toBe(attendu)
  })

  it('diverge réellement selon le pays, à langue égale', () => {
    // Le cœur du sujet : même langue, deux pays, deux formats.
    expect(formatFullDate(2026, 6, 22, 'en-GB')).not.toBe(formatFullDate(2026, 6, 22, 'en-US'))
  })
})

describe('mois et jour', () => {
  it('rend le mois dans la langue', () => {
    expect(formatMonthYear(2026, 7, 'fr-CM')).toBe('Août 2026')
    expect(formatMonthYear(2026, 7, 'en-GB')).toBe('August 2026')
  })

  it('capitalise le mois français, que l’Intl rend en minuscule', () => {
    expect(formatMonthYear(2026, 7, 'fr-FR').startsWith('Août')).toBe(true)
  })

  it('abrège pour les axes de graphe', () => {
    expect(formatMonthShort(2026, 1, 'fr-FR')).toBe('févr')
    expect(formatMonthShort(2026, 1, 'en-GB')).toBe('Feb')
  })

  it('inverse jour et mois entre Royaume-Uni et États-Unis', () => {
    expect(formatDayMonth(2026, 6, 22, 'en-GB')).toBe('22/07')
    expect(formatDayMonth(2026, 6, 22, 'en-US')).toBe('07/22')
  })
})

describe('horodatage relatif', () => {
  it('emploie les formes idiomatiques', () => {
    // `numeric: 'auto'` produit « avant-hier », que la donnée écrite à la main
    // rendait par « il y a 2 jours ».
    expect(formatRelative(-1, 'day', 'fr-FR')).toBe('hier')
    expect(formatRelative(-2, 'day', 'fr-FR')).toBe('avant-hier')
    expect(formatRelative(-1, 'day', 'en-GB')).toBe('yesterday')
  })

  it('rend les durées ordinaires dans la langue', () => {
    expect(formatRelative(-2, 'hour', 'fr-FR')).toBe('il y a 2 heures')
    expect(formatRelative(-2, 'hour', 'en-GB')).toBe('2 hours ago')
  })
})
