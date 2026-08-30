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
/**
 * UN POURCENTAGE, AVEC LA PONCTUATION DE SA LANGUE.
 *
 * Le produit écrivait `{value} %` à la main, dans le JSX. Deux défauts d'un
 * coup, et le second n'a jamais été signalé :
 *
 * L'ESPACE ÉTAIT SÉCABLE. « 100 » restait sur une ligne et « % » passait à la
 * suivante, dans la carte du loyer de l'espace locataire — une colonne de
 * quarante pixels qui suffisait à « 83 % » et pas à « 100 % ». `mesure-ui` ne
 * pouvait pas le voir : un texte qui passe à la ligne ne DÉBORDE de rien, il
 * est parfaitement dans sa boîte, en deux morceaux.
 *
 * ET LA PONCTUATION ÉTAIT FRANÇAISE DANS LES DEUX LANGUES. L'anglais écrit
 * « 100% », sans espace. `Intl` connaît la règle de chaque langue et pose une
 * espace INSÉCABLE là où il en faut une : le passage par lui corrige les deux à
 * la fois, et c'est déjà la doctrine de ce fichier — les séparateurs se
 * demandent, ils ne s'écrivent pas.
 *
 * La valeur est reçue en POINTS (83 pour 83 %), et non en fraction : c'est sous
 * cette forme que tous les appelants la tiennent — `aria-valuenow`, la largeur
 * de la piste, la part d'un anneau. Diviser ici évite quatre divisions ailleurs.
 */
export function formatPercent(points: number, tag: string): string {
  return (
    new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 })
      .format(points / 100)
      /*
        LA FINE DEVIENT PLEINE, et c'est une décision déjà prise et mesurée.

        `Intl` compose la française en U+202F, la fine insécable — ce que
        prescrit la typographie. `formatMoney` l'a essayée devant le symbole
        monétaire et l'a refusée, avec son relevé : « 1,7 px contre 3,6 pour la
        pleine », si bien que « 231 178 FCFA » se lisait « 231 178FCFA ». La
        fine ne tient qu'en chasse FIXE, où toute espace vaut un chiffre.

        Le même produit ne peut pas espacer « 100 % » autrement que
        « 447 000 FCFA ». On garde donc d'`Intl` ce qu'on lui demande — SAVOIR
        s'il faut une espace, ce que l'anglais tranche par la négative — et l'on
        impose seulement laquelle.
      */
      .replace(/\u202f/g, '\u00a0')
  )
}

export function formatList(items: string[], tag: string): string {
  return new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' }).format(items)
}

/** Formateurs de nombres liés à la langue et au pays courants. */
export function useNumbers() {
  const { dateLocale } = useI18n()

  return useMemo(
    () => ({
      integer: (value: number) => formatInteger(value, dateLocale),
      /** « 83 % » en français, « 83% » en anglais — et jamais coupé en deux lignes. */
      percent: (points: number) => formatPercent(points, dateLocale),
      list: (items: string[]) => formatList(items, dateLocale),
    }),
    [dateLocale],
  )
}
