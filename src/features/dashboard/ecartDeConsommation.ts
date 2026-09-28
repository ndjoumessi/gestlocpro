import type { ConsumptionPoint } from '@/data/portfolio'

/**
 * LE RELEVÉ QUI MÉRITE UN SECOND REGARD.
 *
 * ═══ CE QUE CET ÉCRAN NE SAVAIT PAS DIRE ═══
 *
 * Les relevés sont la donnée la plus chère de la gestion locative, et pour une
 * raison unique : une fuite non vue coûte plus que tout le reste de l'écran
 * réuni. La colonne montrait dix consommations et leur filet proportionnel —
 * de quoi comparer les logements ENTRE EUX — sans jamais comparer un logement
 * à SON PROPRE PASSÉ. Or c'est là qu'une fuite se voit : pas dans le fait qu'un
 * appartement consomme plus que son voisin, mais dans le fait qu'il consomme
 * soudain le double de ce qu'il consommait.
 *
 * ═══ POURQUOI LE DOUBLE, ET PAS UN SEUIL RÉGLÉ ═══
 *
 * « Au moins le double » est une règle qu'on peut NOMMER à l'écran et vérifier
 * de tête. Tout seuil plus fin — 40 %, 65 % — serait un nombre réglé sur le jeu
 * de démonstration, que personne ne pourrait défendre devant un locataire.
 * Le profil saisonnier de ce produit monte à 1,20 en pleine saison sèche : le
 * double est très au-dessus de ce que le climat explique, et très en dessous de
 * ce qu'une fuite produit.
 *
 * ═══ ON NE COMPARE QU'UN LOGEMENT À LUI-MÊME ═══
 *
 * `Meters` a écrit la borne, et elle tient : « une forte consommation n'est pas
 * une anomalie, c'est une consommation forte — la qualifier en rouge accuserait
 * un locataire de quatre personnes d'un défaut qui n'existe pas ». Le filet
 * compare les voisins et ne porte donc aucun sens. Ici la référence est le mois
 * précédent DU MÊME LOGEMENT : un ménage de quatre personnes n'y devient pas
 * suspect, il reste égal à lui-même.
 *
 * ═══ CE QUE L'ÉCART NE DIT PAS ═══
 *
 * Ni « fuite », ni « fraude ». Il dit qu'un nombre a doublé, ce qui arrive
 * aussi quand l'index est mal recopié ou qu'un visiteur s'est installé un mois.
 * C'est un motif de VÉRIFIER, et le libellé de l'écran ne va pas plus loin.
 */

/** Le multiple à partir duquel on signale. Nommé parce qu'il se dit à l'écran. */
export const AU_MOINS_LE_DOUBLE = 2

export interface EcartDeConsommation {
  /** Le multiple observé, arrondi au dixième — « ×2,4 ». */
  facteur: number
  /** La consommation de référence, que l'écran doit NOMMER : sans elle, le
      multiple est un pourcentage flottant, la même faute que la pastille du
      tableau de bord a coûtée. */
  reference: number
}

/**
 * La consommation du mois précédent DU CALENDRIER, ou `null`.
 *
 * Le mois précédent du calendrier et non le point précédent de la série : si
 * février manque, janvier ne devient pas la référence de mars. `consommations`
 * pose déjà cette règle pour la même raison, et la contredire ici ferait
 * paraître anormal un mois qui ne l'est pas.
 */
export function referenceDuMoisPrecedent(
  serie: readonly ConsumptionPoint[],
  periode: { year: number; month: number },
  fluide: 'water' | 'power',
): number | null {
  const avant =
    periode.month === 0
      ? { year: periode.year - 1, month: 11 }
      : { year: periode.year, month: periode.month - 1 }
  const point = serie.find((p) => p.year === avant.year && p.month === avant.month)
  return point ? point[fluide] : null
}

/**
 * L'écart notable entre une consommation et sa référence, ou `null`.
 *
 * UNE RÉFÉRENCE NULLE OU ZÉRO NE SIGNALE RIEN. Doubler zéro n'a pas de sens, et
 * la règle marquerait alors tout logement entré dans le mois — un emménagement
 * n'est pas une fuite, et c'est le cas le plus fréquent des deux.
 */
export function ecartNotable(
  courante: number | null,
  reference: number | null,
): EcartDeConsommation | null {
  if (courante === null || reference === null || reference <= 0) return null
  if (courante < reference * AU_MOINS_LE_DOUBLE) return null
  return {
    facteur: Math.round((courante / reference) * 10) / 10,
    reference,
  }
}
