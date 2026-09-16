/**
 * LE DÉLAI ENTRE LA FERMETURE D'UN COMPTE ET SON EFFACEMENT.
 *
 * Trente jours, choisis par Nelson le 2026-09-16. C'est le filet : la
 * suppression est le seul geste du produit que rien ne rattrape, et une
 * reconnexion pendant ce délai annule la demande.
 *
 * ÉCRIT ICI, ET NON DANS LA ROUTE : trois endroits en dépendent — la route qui
 * ferme, le travail quotidien qui efface, et l'écran qui annonce la date. Trois
 * copies du même nombre dériveraient, et c'est l'écran qui mentirait en premier.
 */
export const DELAI_D_EFFACEMENT_JOURS = 30

/** La date d'effacement d'une fermeture demandée à cet instant. */
export function effacementPrevu(depuis: Date): Date {
  return new Date(depuis.getTime() + DELAI_D_EFFACEMENT_JOURS * 86_400_000)
}
