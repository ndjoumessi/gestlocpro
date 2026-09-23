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
 * Plusieurs cas existants affirment l'ABSENCE immédiatement après la fermeture,
 * sans `waitFor` — ainsi
 * `src/components/primitives/echapDansUneModale.test.tsx:54` :
 *
 *     expect(screen.queryAllByRole('option')).toHaveLength(0)
 *
 * Un nœud encore monté 200 ms de plus ferait rougir ces cas, qui n'ont pourtant
 * découvert aucun défaut. La réponse n'est pas de raccourcir la durée ni de
 * réécrire ces gardes : c'est que PENDANT `sortant`, l'appelant sorte le nœud de
 * l'arbre d'accessibilité — `aria-hidden`, `inert`, `pointer-events-none`.
 * Testing Library ignore par défaut ce que porte `aria-hidden="true"` : une
 * requête par rôle rend donc `null` dès la fermeture, pendant que les pixels,
 * eux, finissent leur course. Le nœud est parti pour qui lit le document et pour
 * qui navigue au clavier ; il ne s'attarde que pour l'œil. Un appelant qui
 * oublierait ces attributs ne casserait pas l'animation — il casserait les tests
 * des autres, ce qui est bien plus long à diagnostiquer.
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
 * `typeof matchMedia !== 'function'` : jsdom fournit bien la fonction et répond
 * `false` à cette requête, ce qui est le comportement voulu sous le harnais — la
 * sortie différée doit y être observable. Le garde-fou vise les environnements
 * qui ne la fournissent pas du tout, et il est ÉCRIT DANS L'EFFET et non dans un
 * initialiseur d'état : la préférence peut changer entre deux fermetures, et la
 * lire au montage la figerait pour la vie du composant.
 *
 * LE MONTAGE EST SYNCHRONE — AJUSTEMENT EN PHASE DE RENDU, PAS EFFET. Monter
 * depuis l'effet coûtait une image : à celle où `ouvert` devient vrai, la
 * surface n'était pas encore rendue, `ref.current` valait donc `null` pour
 * l'appelant, et son effet de focus ne se rejouait pas puisque `ouvert`, lui,
 * n'avait plus changé. Mesuré le 2026-09-24 : trois cas existants rouges d'un
 * coup, le focus jamais posé à l'ouverture du tiroir. Le défaut n'est pas propre
 * au focus, il frappe tout appelant qui doit toucher le nœud à peine monté —
 * verrou de défilement, mesure, piège de tabulation. D'où la condition écrite
 * dans le corps du composant : React relance le rendu avant de valider, et elle
 * devient fausse aussitôt, ce qui referme la boucle. La FERMETURE, elle, reste
 * dans l'effet : personne n'a besoin de toucher un nœud qui s'en va.
 *
 * RÉOUVRIR PENDANT LA SORTIE ANNULE LA MINUTERIE, et c'est le cas qui compte.
 * Ouvrir, fermer, rouvrir en moins de `dureeMs` est un geste ordinaire — une
 * main hésitante sur un menu. Sans annulation, la minuterie de la première
 * fermeture arriverait à terme après la seconde ouverture et démonterait une
 * surface que l'utilisateur vient de rouvrir : un nœud fantôme, qui disparaît
 * tout seul sans que personne ne l'ait demandé. L'annulation est portée par le
 * NETTOYAGE de l'effet, que React exécute avant de le rejouer au changement de
 * `ouvert` : la branche d'ouverture n'a donc rien à annuler elle-même. D'où la
 * `ref` : le nettoyage et la passe suivante doivent viser la MÊME minuterie, et
 * elle survit aux rendus là où une variable locale ne survivrait qu'à une passe.
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
