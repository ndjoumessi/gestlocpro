import { useMemo } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import {
  formatDayMonth,
  formatFullDate,
  formatMonthShort,
  formatMonthYear,
  formatRelative,
} from './dates'
import type { DateParts, RelativeStamp } from '@/data/portfolio'

/**
 * Formateurs de date liés à la langue et au pays courants.
 *
 * Les écrans appellent `d.dayMonth(work.reportedAt)` plutôt que de reconstruire
 * l'étiquette et d'éclater la date en trois arguments à chaque usage. Un seul
 * endroit connaît la résolution langue + pays, donc un seul endroit à corriger.
 */
export function useDates() {
  const { dateLocale } = useI18n()

  return useMemo(
    () => ({
      /** Étiquette BCP-47 effective — utile pour déboguer ou formater autre chose. */
      tag: dateLocale,
      monthYear: (d: Pick<DateParts, 'year' | 'month'>) =>
        formatMonthYear(d.year, d.month, dateLocale),
      dayMonth: (d: DateParts) => formatDayMonth(d.year, d.month, d.day, dateLocale),
      fullDate: (d: DateParts) => formatFullDate(d.year, d.month, d.day, dateLocale),
      monthShort: (d: Pick<DateParts, 'year' | 'month'>) =>
        formatMonthShort(d.year, d.month, dateLocale),
      relative: (stamp: RelativeStamp) => formatRelative(stamp.value, stamp.unit, dateLocale),
    }),
    [dateLocale],
  )
}
