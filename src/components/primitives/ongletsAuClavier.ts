import { useRef, type KeyboardEvent } from 'react'

/**
 * LE CLAVIER D'UNE RANGÉE D'ONGLETS, ÉCRIT UNE FOIS.
 *
 * ═══ CE QUE `role="tab"` PROMET, ET QUE LE NAVIGATEUR NE TIENT PAS ═══
 *
 * Poser `role="tablist"` sur une rangée de boutons change ce qu'un lecteur
 * d'écran ANNONCE — « onglet 2 sur 3 » — et donc ce que l'utilisateur ATTEND :
 * les flèches déplacent la sélection, la tabulation quitte le groupe. Rien de
 * cela n'est natif. Un `tablist` sans ce comportement est une promesse faite à
 * voix haute et non tenue : trois arrêts de tabulation pour traverser ce que
 * l'annonce présentait comme un seul contrôle, et des flèches qui ne font rien.
 *
 * ═══ LES DEUX DÉCISIONS QUE CE FICHIER FIGE ═══
 *
 * 1. LA SÉLECTION SUIT LE FOCUS. C'est le comportement recommandé quand changer
 *    d'onglet ne coûte rien — les panneaux sont déjà montés. L'alternative
 *    (flèche pour déplacer, Entrée pour activer) fait payer deux frappes ce que
 *    la souris obtient en un clic.
 *
 * 2. BORNAGE, JAMAIS BOUCLAGE. Au dernier onglet, `ArrowRight` ne fait rien
 *    plutôt que de revenir au premier. Une rangée qui boucle n'a pas de fin
 *    perceptible : on ne sait plus si l'on a tout vu.
 *
 * Et un seul ARRÊT DE TABULATION pour tout le groupe (`tabIndex` à 0 sur le
 * seul onglet actif) : la tabulation atteint le CONTENU du panneau, elle ne
 * traverse pas trois onglets pour y arriver.
 *
 * ═══ POURQUOI UN CROCHET ET NON UN COMPOSANT ═══
 *
 * Les deux rangées qui s'en servent n'ont aucune mise en page commune : celle
 * du portail locataire imite la barre d'onglets d'un navigateur, celle des
 * tarifs est une grille de trois prix. Un composant partagé leur imposerait une
 * apparence, et l'un des deux la contournerait dès le premier écart. Ce qui est
 * réellement commun est le CLAVIER — c'est lui, et lui seul, qu'on partage.
 */
export function useOngletsAuClavier<T>(
  onglets: readonly T[],
  onChange: (valeur: T) => void,
) {
  const references = useRef<(HTMLButtonElement | null)[]>([])

  const allerA = (index: number) => {
    const cible = onglets[index]
    if (cible === undefined) return
    onChange(cible)
    references.current[index]?.focus()
  }

  const auClavier = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const destination =
      e.key === 'ArrowRight'
        ? Math.min(index + 1, onglets.length - 1)
        : e.key === 'ArrowLeft'
          ? Math.max(index - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? onglets.length - 1
              : null

    if (destination === null) return
    /* `Home` et `End` défileraient le document, les flèches le feraient
       horizontalement dans une rangée débordante : dans les deux cas la page
       bougerait sous une commande qui ne la concerne pas. */
    e.preventDefault()
    allerA(destination)
  }

  /** À poser sur chaque onglet : `ref={(n) => referencer(index, n)}`. */
  const referencer = (index: number, noeud: HTMLButtonElement | null) => {
    references.current[index] = noeud
  }

  return { auClavier, referencer }
}
