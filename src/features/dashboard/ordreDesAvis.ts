import type { RelativeStamp } from '@/data/portfolio'

/**
 * L'ANCIENNETÉ D'UN AVIS, EN MINUTES, POUR LES CLASSER ENTRE EUX.
 *
 * Un horodatage relatif porte une valeur ET son unité — « −40 minute »,
 * « −2 hour », « −1 day ». Comparer les valeurs entre elles range donc 40 après
 * 2, et c'est exactement ce que l'écran des avis rendait : une fuite de quarante
 * minutes sous trois avis de la veille.
 *
 * ON RAMÈNE TOUT À LA MINUTE plutôt que de trier par unité puis par valeur : le
 * second demande une table d'ordre des unités, qui est la même information dite
 * deux fois et qui se désaccorde.
 *
 * LES UNITÉS LONGUES SONT APPROCHÉES — 30 jours pour un mois, 365 pour une
 * année. C'est faux pour une date, juste pour un CLASSEMENT : aucun mois ne
 * peut passer avant une semaine ni après un trimestre par cet arrondi. La
 * fonction ne sert qu'à ordonner, et son nom le dit.
 */
const MINUTES: Record<string, number> = {
  second: 1 / 60,
  minute: 1,
  hour: 60,
  day: 1440,
  week: 10080,
  month: 43200,
  quarter: 129600,
  year: 525600,
}

export function ancienneteEnMinutes(at: RelativeStamp): number {
  /* `Intl.RelativeTimeFormatUnit` admet le PLURIEL — « days » autant que
     « day ». Une table qui n'aurait que le singulier rendrait `undefined` sur
     la moitié des valeurs légales, et le tri se tairait au lieu de rougir. */
  const unite = at.unit.replace(/s$/, '')
  const facteur = MINUTES[unite]
  /* UNE UNITÉ INCONNUE PART AU FOND, elle ne se range pas en tête. Un avis
     qu'on ne sait pas dater ne doit pas s'annoncer comme le plus récent. */
  if (facteur === undefined) return Number.POSITIVE_INFINITY
  /* Les valeurs sont NÉGATIVES — « il y a » —, et l'ancienneté est leur
     grandeur. `Math.abs` plutôt qu'un signe inversé : un avis daté du futur,
     qu'aucun écran ne produit mais que le type autorise, se rangerait sinon
     avant tout le reste avec une ancienneté négative. */
  return Math.abs(at.value) * facteur
}

/**
 * Les avis du plus récent au plus ancien — l'ordre que l'écran ANNONCE.
 *
 * Trié ici et non dans la donnée : `ALERTS` est un tableau écrit à la main, que
 * ranger à la main laisserait se dérégler au prochain avis ajouté, sans un mot.
 * L'écran qui promet un ordre est celui qui doit l'établir.
 */
export function duPlusRecent<T extends { at: RelativeStamp }>(avis: readonly T[]): T[] {
  return [...avis].sort((a, b) => ancienneteEnMinutes(a.at) - ancienneteEnMinutes(b.at))
}
