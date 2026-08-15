import { DATE_LOCALE, type Locale } from '@/i18n/locales'

/**
 * Formatage des dates selon la langue de l'interface.
 *
 * Un nom de mois n'est pas du contenu, c'est du formatage : « Août 2026 » doit
 * se lire « August 2026 » en anglais, alors qu'un nom de locataire ou un
 * libellé de travaux reste tel qu'il a été saisi. Les données stockent donc des
 * valeurs machine — année, index de mois — et la présentation se calcule ici.
 *
 * `DATE_LOCALE` existait depuis le début sans être utilisé nulle part : les
 * dates étaient des chaînes figées au format français, y compris en anglais.
 */

/** « Août 2026 » / « August 2026 » */
export function formatMonthYear(year: number, month: number, locale: Locale): string {
  const label = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1))
  // Le français rend « août 2026 » en minuscule ; en tête de ligne on capitalise.
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** « 03/08 » en français, « 03/08 » en anglais britannique — jour puis mois. */
export function formatDayMonth(
  year: number,
  month: number,
  day: number,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(year, month, day))
}

/** « 22/07/2026 » / « 22/07/2026 » — date complète. */
export function formatFullDate(
  year: number,
  month: number,
  day: number,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month, day))
}

/** Abréviation d'axe de graphe : « août » / « Aug ». */
export function formatMonthShort(year: number, month: number, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { month: 'short' })
    .format(new Date(year, month, 1))
    .replace('.', '')
}

/**
 * Horodatage relatif : « il y a 2 heures » / « 2 hours ago ».
 *
 * `numeric: 'auto'` produit les formes idiomatiques quand elles existent —
 * « hier » plutôt que « il y a 1 jour », « yesterday » plutôt que « 1 day ago ».
 * C'est ce que l'on écrivait à la main dans les données, en français seulement.
 */
export function formatRelative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: Locale,
): string {
  return new Intl.RelativeTimeFormat(DATE_LOCALE[locale], { numeric: 'auto' }).format(value, unit)
}
