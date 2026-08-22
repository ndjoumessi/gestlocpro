import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * LE PIÈGE DE FOCUS, ÉCRIT UNE FOIS.
 *
 * Il vivait dans `Modal`, correct et complet, pendant que les deux panneaux de
 * la barre — réglages et compte — portaient le même motif de surface sans rien
 * en dessous. Mesuré au navigateur avant ce lot, sur le panneau des réglages :
 * quatre tabulations sur dix sortaient du panneau ouvert, et à la fermeture le
 * focus restait où il avait erré — sur un bouton de légende de graphique, à
 * l'autre bout de la page. Échap fermait ; c'était tout ce qui marchait.
 *
 * Un panneau qui laisse le focus s'échapper n'est pas « un peu moins bon » : au
 * clavier et au lecteur d'écran, il devient invisible tout en restant ouvert.
 * On tabule dans une page qu'on croit atteindre, et l'on agit derrière un voile
 * qu'on ne voit pas.
 *
 * TROIS COMPORTEMENTS, ET ILS SE COMMANDENT SÉPARÉMENT parce que les deux
 * appelants n'en veulent pas les mêmes :
 *   — le PIÈGE et le retour du focus, que les deux veulent ;
 *   — le VERROU DE DÉFILEMENT du document, qu'une modale veut et qu'un panneau
 *     ancré à son bouton ne veut pas : verrouiller la page pour un menu de
 *     trois réglages arrêterait le défilement derrière un objet de 250 px ;
 *   — la FERMETURE AU CLIC EXTÉRIEUR, qu'un panneau ancré veut et qu'une modale
 *     traite par son voile.
 *
 * `onFermer` est retenu dans une RÉFÉRENCE et jamais mis en dépendance. Le lier
 * à l'identité de la fonction rejouait l'effet à chaque rendu de l'appelant —
 * donc à chaque frappe dans un champ contrôlé —, et le nettoyage rendait alors
 * le focus au bouton d'ouverture au milieu de la saisie. Le symptôme observé
 * était « le champ n'accepte qu'un caractère », et il a coûté cher à trouver.
 */
export interface OptionsDuPiege {
  /** Verrouille le défilement du document. Une modale, oui ; un panneau, non. */
  verrouillerLeDefilement?: boolean
  /** Ferme sur un clic hors du conteneur. Un panneau ancré, oui ; une modale, non. */
  fermerAuClicExterieur?: boolean
  /**
   * Ce qui reçoit le focus à l'ouverture.
   *   'premier-non-bouton' — le premier champ, à défaut le conteneur. C'est ce
   *      que veut une modale : sans cela le focus se pose sur la croix, donc sur
   *      le geste d'abandon, dans toute modale sans champ.
   *   'premier'            — le premier focalisable, quel qu'il soit. C'est ce
   *      que veut un panneau de commandes, dont TOUT le contenu est des boutons.
   *   'aucun'              — le focus reste où il est.
   */
  focusInitial?: 'premier-non-bouton' | 'premier' | 'aucun'
}

/**
 * Invisible : lui-même ou l'un de ses ancêtres est retiré du rendu.
 *
 * LE PRÉDICAT D'ORIGINE ÉTAIT `offsetParent !== null`, ET IL AVAIT DEUX TROUS.
 *
 * 1. Dans un vrai navigateur, `offsetParent` vaut `null` pour tout élément
 *    `position: fixed`. Un focalisable épinglé dans une modale — une barre
 *    d'actions collante, un bouton flottant — était donc EXCLU du piège : le
 *    focus pouvait s'y poser sans que le cycle le compte, et la tabulation
 *    suivante repartait au début en le sautant.
 * 2. Sous jsdom, `offsetParent` vaut TOUJOURS `null` : il n'y a pas de mise en
 *    page. La liste était donc vide, le gestionnaire de Tab sortait par son
 *    `length === 0`, et le piège ne s'exécutait pas du tout. Aucun cas de test
 *    ne pouvait le voir — c'est ainsi qu'une modale a pu porter un piège
 *    « couvert » pendant tout ce temps sans qu'un seul cas ne l'exerce.
 *
 * On remonte donc la chaîne des ancêtres et l'on écarte ce qui est réellement
 * retiré : `display: none`, `visibility: hidden`, l'attribut `hidden`. Ces trois
 * lectures existent sous jsdom comme au navigateur, et aucune ne dépend d'une
 * mise en page calculée.
 */
function invisible(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (n.hasAttribute('hidden')) return true
    const s = getComputedStyle(n)
    if (s.display === 'none' || s.visibility === 'hidden') return true
  }
  return false
}

/** Les focalisables VISIBLES du conteneur, dans l'ordre du document. */
function focalisables(racine: HTMLElement | null): HTMLElement[] {
  if (!racine) return []
  return Array.from(
    racine.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && !invisible(el))
}

export function usePiegeDeFocus(
  ouvert: boolean,
  conteneur: RefObject<HTMLElement | null>,
  onFermer: () => void,
  options: OptionsDuPiege = {},
) {
  const {
    verrouillerLeDefilement = false,
    fermerAuClicExterieur = false,
    focusInitial = 'premier-non-bouton',
  } = options

  const fermetureRef = useRef(onFermer)
  fermetureRef.current = onFermer

  const noeuds = useCallback(() => focalisables(conteneur.current), [conteneur])

  useEffect(() => {
    if (!ouvert) return

    /* Celui qui ouvrait, pour lui rendre le focus. Lu AVANT toute chose : dès
       que le panneau se peint, `activeElement` peut avoir changé. */
    const ouvreur = document.activeElement as HTMLElement | null
    const defilementPrecedent = document.body.style.overflow
    if (verrouillerLeDefilement) document.body.style.overflow = 'hidden'

    const minuteur = window.setTimeout(() => {
      if (focusInitial === 'aucun') return
      const liste = noeuds()
      const cible =
        focusInitial === 'premier'
          ? liste[0]
          : (liste.find((el) => el.tagName !== 'BUTTON') ?? conteneur.current)
      cible?.focus()
    }, 0)

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        /* Arrêtée MÊME si l'appelant ne ferme pas : sinon elle remonterait et
           fermerait ce qui entoure au lieu de ce qu'on regarde. */
        e.stopPropagation()
        fermetureRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const liste = noeuds()
      if (liste.length === 0) return
      const premier = liste[0]
      const dernier = liste[liste.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      } else if (!conteneur.current?.contains(document.activeElement)) {
        e.preventDefault()
        premier.focus()
      }
    }

    /* Pas de voile `fixed inset-0` : un garde du système de design le refuse,
       ne pouvant distinguer un attrape-clic d'une surface peinte, et exigeant
       de toutes un rembourrage contre l'encoche. Un écouteur de document
       n'ajoute rien à l'arbre d'accessibilité et ne se pose sur aucun bord. */
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) fermetureRef.current()
    }

    document.addEventListener('keydown', auClavier)
    if (fermerAuClicExterieur) document.addEventListener('mousedown', auClic)
    return () => {
      window.clearTimeout(minuteur)
      document.removeEventListener('keydown', auClavier)
      if (fermerAuClicExterieur) document.removeEventListener('mousedown', auClic)
      if (verrouillerLeDefilement) document.body.style.overflow = defilementPrecedent
      ouvreur?.focus?.()
    }
  }, [ouvert, noeuds, conteneur, verrouillerLeDefilement, fermerAuClicExterieur, focusInitial])
}
