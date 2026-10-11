import { createContext } from 'react'

/**
 * LA FERMETURE, PASSÉE PAR CONTEXTE PLUTÔT QUE PAR PROPRIÉTÉ.
 *
 * Une entrée de menu doit refermer le panneau en même temps qu'elle agit : un
 * menu resté ouvert au-dessus de l'écran qu'on vient de changer laisse croire
 * que rien n'a eu lieu. L'appelant, lui, ne connaît que son action — lui faire
 * porter `onClose` en plus reviendrait à lui confier une mécanique qui n'est pas
 * la sienne, et le premier oubli passerait sans bruit.
 *
 * ═══ DANS SON PROPRE MODULE, ET C'EST LE DÉCOUPAGE QUI L'A EXIGÉ ═══
 *
 * Elle vivait auprès du panneau qui la FOURNIT. Les entrées, qui la CONSOMMENT,
 * en sont sorties ; or le panneau réexporte les entrées pour que personne n'ait
 * à recâbler son import. La laisser d'un côté ou de l'autre fermait donc un
 * cycle — le panneau tirant les entrées, les entrées tirant le panneau —, et un
 * cycle ESM ne casse pas franchement : il rend `undefined` au premier qui lit
 * trop tôt, ici une fonction qu'on appelle. Un module que les deux côtés tirent
 * et qui ne tire personne supprime la question au lieu de la gérer.
 */
export const FermerLeMenu = createContext<() => void>(() => {})
