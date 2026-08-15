/**
 * Formatage des dates.
 *
 * Un nom de mois ou un ordre jour/mois n'est pas du contenu, c'est du
 * formatage : « Août 2026 » doit se lire « August 2026 » en anglais, alors
 * qu'un nom de locataire ou un libellé de travaux reste tel qu'il a été saisi.
 * Les données stockent donc des valeurs machine — année, index de mois — et la
 * présentation se calcule ici.
 *
 * Ces fonctions prennent une **étiquette BCP-47 complète** (`fr-CM`, `en-US`,
 * `fr-CA`…) et non une simple langue : le format dépend du pays autant que de
 * la langue. `en-GB` rend 12/08 quand `en-US` rend 08/12 et `fr-CA` 2026-08-12.
 * Utiliser `useDates()` plutôt que d'appeler ces fonctions à la main : le hook
 * résout l'étiquette depuis la langue et le pays courants.
 */

/** « Août 2026 » / « August 2026 » */
export function formatMonthYear(year: number, month: number, tag: string): string {
  const label = new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  )
  // Le français rend « août 2026 » en minuscule ; en tête de ligne on capitalise.
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Jour et mois seuls : « 12/08 » en France, « 08/12 » aux États-Unis. */
export function formatDayMonth(year: number, month: number, day: number, tag: string): string {
  return new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit' }).format(
    new Date(year, month, day),
  )
}

/** Date complète : « 22/07/2026 », « 07/22/2026 » ou « 2026-07-22 » selon le pays. */
export function formatFullDate(year: number, month: number, day: number, tag: string): string {
  return new Intl.DateTimeFormat(tag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month, day))
}

/** Abréviation d'axe de graphe : « août » / « Aug ». */
export function formatMonthShort(year: number, month: number, tag: string): string {
  return new Intl.DateTimeFormat(tag, { month: 'short' })
    .format(new Date(year, month, 1))
    .replace('.', '')
}

/**
 * Horodatage relatif : « il y a 2 heures » / « 2 hours ago ».
 *
 * `numeric: 'auto'` produit les formes idiomatiques quand elles existent —
 * « avant-hier » plutôt que « il y a 2 jours », « yesterday » plutôt que
 * « 1 day ago ». C'est ce que l'on écrivait à la main dans les données, en
 * français seulement et moins bien.
 */
export function formatRelative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  tag: string,
): string {
  return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(value, unit)
}
