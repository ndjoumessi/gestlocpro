import { useSearchParams } from 'react-router-dom'

/**
 * UN TRI QUI VIT DANS L'ADRESSE, ET NULLE PART AILLEURS.
 *
 * Cinq écrans ont reçu un groupe de filtres en deux jours — locataires,
 * signalements, cautions, travaux, accès — et les cinq commits portent la même
 * phrase sous « Ce que je peux avoir raté » : le tri ne se retenait pas dans
 * l'adresse. Un sixième écran l'avait pourtant tranché avant eux, et son
 * argument tient toujours : le mois du parc y est « parce qu'il désigne une
 * vue stable qu'on partage, qu'on met en favori, et qui doit survivre à
 * l'aller-retour ».
 *
 * ═══ CE QUI N'Y VA PAS ═══
 *
 * La RECHERCHE reste locale, pour la raison inverse et déjà écrite chez le
 * parc : « une frappe en cours de saisie est éphémère ». Une adresse réécrite
 * à chaque caractère n'est pas une vue partageable, c'est un journal de
 * frappe.
 *
 * ═══ PAS DE `useState` EN DOUBLURE, ET C'EST LE POINT ═══
 *
 * La valeur se RELIT de l'adresse à chaque rendu. Un état local synchronisé
 * par un effet donnerait deux sources pour une même chose, et c'est toujours
 * la mauvaise qui gagne au moment où l'on ne regarde pas — un retour arrière,
 * un lien collé, un rechargement.
 *
 * ═══ TROIS RÈGLES, ET CHACUNE A COÛTÉ QUELQUE CHOSE À QUELQU'UN ═══
 *
 * 1. LE DÉFAUT NE S'ÉCRIT PAS. Revenir à « Toutes » RETIRE la clé au lieu
 *    d'écrire `?etat=all` : une adresse partagée doit dire ce qu'on a choisi,
 *    pas énumérer ce qu'on n'a pas choisi.
 *
 * 2. UNE VALEUR INADMISE RETOMBE SUR LE DÉFAUT. Une adresse partagée
 *    VIEILLIT : `?etat=settling` envoyé un mardi peut arriver sur un parc où
 *    plus rien n'est en arbitrage. Les options de ces écrans se dérivent des
 *    valeurs PRÉSENTES — la pastille n'existe alors plus — et appliquer le tri
 *    quand même rendrait une liste vide sous aucune pastille pressée. On
 *    retombe donc sur tout, ce qui est faux mais lisible, plutôt que sur rien,
 *    qui est illisible. `admis` se calcule sur la donnée CHARGÉE : pendant le
 *    chargement il est vide, la valeur retombe sur le défaut, et l'adresse —
 *    qu'on ne réécrit jamais à la lecture — la rend dès que la donnée arrive.
 *
 * 3. `replace` ET NON `push`. Choisir un filtre n'est pas une navigation. Le
 *    bouton « retour » doit ramener à l'écran d'où l'on vient, jamais dérouler
 *    à l'envers les sept pastilles qu'on a essayées. Même arbitrage que le
 *    mois du parc, et pour la même raison.
 */
export function useTriDansLAdresse<T extends string>(
  cle: string,
  defaut: T,
  admis: readonly T[],
): [T, (valeur: T) => void] {
  const [parametres, setParametres] = useSearchParams()
  const brut = parametres.get(cle)
  const valeur =
    brut !== null && (admis as readonly string[]).includes(brut) ? (brut as T) : defaut

  const poser = (suivante: T) => {
    const suite = new URLSearchParams(parametres)
    if (suivante === defaut) suite.delete(cle)
    else suite.set(cle, suivante)
    setParametres(suite, { replace: true })
  }

  return [valeur, poser]
}
