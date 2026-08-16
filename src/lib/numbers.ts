import { useMemo } from 'react'
import { useI18n } from '@/i18n/I18nProvider'

/**
 * Formatage des nombres qui ne sont pas des montants.
 *
 * `currency/currencies` couvre l'argent, `lib/dates` couvre les dates — mais
 * rien ne couvrait les entiers ordinaires : index de compteur, consommations,
 * décomptes. Chaque écran improvisait donc une interpolation directe, et
 * `{4120}` s'affichait « 4120 » dans les deux langues, là où le français écrit
 * « 4 120 » et l'anglais « 4,120 ».
 *
 * Le défaut est discret parce qu'il ne se voit qu'à partir de quatre chiffres :
 * les jeux de démonstration à trois chiffres passent la relecture, et le
 * premier relevé réel ne passe pas.
 *
 * Ces fonctions prennent une **étiquette BCP-47 complète**, comme celles de
 * `lib/dates` et pour la même raison : le groupement dépend du pays autant que
 * de la langue — `fr-FR` groupe par espace insécable étroite, `fr-CH` par
 * apostrophe, `en-US` par virgule.
 */

/**
 * Entier groupé selon la langue et le pays : « 4 120 » / « 4,120 ».
 *
 * L'espace insécable étroite produite par `Intl` est conservée telle quelle —
 * c'est justement elle qui empêche un nombre de se couper en fin de cellule.
 */
export function formatInteger(value: number, tag: string): string {
  return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(value)
}

/**
 * Liste énumérée dans la langue : « A5 et C2 » / « A5 and C2 ».
 *
 * On concaténait avec `', '`, ce qui rend « A5, C2 » partout — lisible, mais
 * c'est une liste anglaise en français et une liste française en anglais.
 * `Intl.ListFormat` connaît la conjonction de chaque langue.
 */
export function formatList(items: string[], tag: string): string {
  return new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' }).format(items)
}

/** Formateurs de nombres liés à la langue et au pays courants. */
export function useNumbers() {
  const { dateLocale } = useI18n()

  return useMemo(
    () => ({
      integer: (value: number) => formatInteger(value, dateLocale),
      list: (items: string[]) => formatList(items, dateLocale),
    }),
    [dateLocale],
  )
}
