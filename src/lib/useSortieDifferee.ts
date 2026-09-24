import { useEffect, useRef, useState } from 'react'

/**
 * Retient une surface montée le temps qu'elle finisse de SORTIR.
 *
 * Rien, dans ce dépôt, ne pouvait s'animer en partant : chaque modale, chaque
 * menu, chaque toast se démontait à l'image exacte où il décidait de se fermer.
 * L'entrée était soignée, la sortie n'existait pas — c'est la moitié non
 * construite de la ligne `motion` du plan produit. Ce crochet est le mécanisme
 * qui manquait : `ouvert` passe à faux, le nœud reste monté `dureeMs` de plus
 * avec `sortant` vrai, puis disparaît. Il n'est branché à personne ici.
 *
 * POURQUOI `setTimeout` ET NON UN ÉCOUTEUR `transitionend` / `animationend`.
 * C'est le réflexe naturel — laisser l'animation annoncer elle-même sa fin — et
 * c'est le piège de ce dépôt. Les tests tournent sous jsdom, qui ne calcule
 * aucune mise en page et ne déclenche par conséquent NI `transitionend` NI
 * `animationend` : l'événement attendu ne viendrait jamais, le démontage ne
 * serait jamais programmé, et chaque surface fermée resterait montée pour
 * toujours sous le harnais. Un écouteur ne rendrait donc pas la suite lente, il
 * la rendrait fausse, et de la pire façon — en laissant les nœuds s'accumuler
 * au lieu de rougir franchement. La minuterie, elle, est pilotable par
 * `vi.useFakeTimers()` : la sortie devient un fait que le test décide, pas une
 * course qu'il espère gagner.
 *
 * MAIS `setTimeout` SEUL NE SUFFIT PAS, ET L'APPELANT DOIT PAYER SA PART.
 * Des cas existants affirment l'ABSENCE immédiatement après la fermeture, sans
 * `waitFor`. Le cas TÉMOIN, celui qui a été MESURÉ rouge et non supposé tel, est
 * `src/features/dashboard/etatDesLieux.test.tsx:128` :
 *
 *     expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 *
 * Un nœud encore monté 150 ms de plus fait rougir ce cas, qui n'a pourtant
 * découvert aucun défaut. La réponse n'est pas de raccourcir la durée ni de
 * réécrire la garde : c'est que PENDANT `sortant`, l'appelant sorte le nœud de
 * l'arbre d'accessibilité — `aria-hidden`, `inert`, `pointer-events-none`.
 * Testing Library ignore par défaut ce que porte `aria-hidden="true"` : une
 * requête par rôle rend donc `null` dès la fermeture, pendant que les pixels,
 * eux, finissent leur course. Le nœud est parti pour qui lit le document et pour
 * qui navigue au clavier ; il ne s'attarde que pour l'œil. Un appelant qui
 * oublierait ces attributs ne casserait pas l'animation — il casserait les tests
 * des autres, ce qui est bien plus long à diagnostiquer.
 *
 * ET C'EST LE CONTENEUR DU PORTAIL QUI PORTE CES ATTRIBUTS, PAS LE VOILE. La
 * distinction est la seule chose vraiment piégeuse ici, et elle a déjà coûté un
 * cycle rouge sur le tiroir : le nœud que la requête par rôle trouve doit
 * LUI-MÊME quitter l'arbre. Dans `Modal.tsx`, la boîte `role="dialog"` est un
 * DESCENDANT du conteneur porté par `createPortal` et un FRÈRE du voile.
 * `aria-hidden` posé sur le voile ne la couvre donc pas — mesuré : la même garde
 * meurt exactement pareil dans les deux cas, attributs absents ou attributs posés
 * au mauvais étage. Posés sur le conteneur, ils couvrent tout ce qui pend
 * dessous, voile et dialogue ensemble.
 *
 * MOUVEMENT RÉDUIT : DÉMONTAGE IMMÉDIAT, `sortant` JAMAIS VRAI. La règle globale
 * de `src/design-system/tokens.css:1163` ramène toute durée d'animation et de
 * transition à 0,001 ms sous `prefers-reduced-motion: reduce`. Garder le nœud
 * peint 200 ms de plus la contredirait exactement : l'animation serait bien
 * supprimée, mais la surface resterait à l'écran le temps d'une animation qui
 * n'a pas lieu — une attente sans rien à regarder, c'est-à-dire le défaut que le
 * réglage système demande d'éviter. On court-circuite donc la minuterie plutôt
 * que de la raccourcir.
 *
 * `typeof matchMedia !== 'function'` : CORRIGÉ le 2026-09-24. Il était écrit ici
 * que jsdom fournit la fonction ; mesuré, il ne la fournit pas du tout. Sous le
 * harnais, c'est `src/test/render.tsx:273` qui en pose une fausse, répondant à
 * la largeur (1280 px par défaut). La requête du mouvement réduit n'y trouve
 * aucune `min-width`, reçoit donc un seuil infini et rend faux — le
 * comportement voulu, mais pour une raison qui n'était pas la bonne. Le
 * garde-fou vise les environnements sans `matchMedia`, ce qu'est jsdom nu.
 */
export function useSortieDifferee(ouvert: boolean, dureeMs: number) {
  const [monte, setMonte] = useState(ouvert)
  const [sortant, setSortant] = useState(false)
  const minuterie = useRef<number | undefined>(undefined)

  /* Le montage est SYNCHRONE, et c'est un ajustement en phase de rendu et non un
     effet : à l'image où `ouvert` devient vrai, l'appelant doit pouvoir poser le
     focus sur un nœud DÉJÀ rendu. React relance le rendu avant de valider, et la
     condition devient fausse aussitôt — la boucle se referme. */
  if (ouvert && (!monte || sortant)) {
    setMonte(true)
    setSortant(false)
  }

  useEffect(() => {
    if (ouvert) return
    if (!monte) return
    const reduit =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduit) {
      setMonte(false)
      return
    }
    setSortant(true)
    minuterie.current = window.setTimeout(() => {
      setMonte(false)
      setSortant(false)
    }, dureeMs)
    return () => window.clearTimeout(minuterie.current)
  }, [ouvert, monte, dureeMs])

  return { monte, sortant }
}
