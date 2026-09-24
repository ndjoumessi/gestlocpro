# 001 — Donner au produit un mécanisme de sortie

- **Status**: DONE (exécuté le 2026-09-24, non commité)
- **Commit**: f1d9aab
- **Severity**: HIGH
- **Category**: Interruptibility
- **Estimated scope**: 1 nouveau fichier + 2 fichiers modifiés (~150 lignes)

## Problem

Rien, dans `src/`, ne peut s'animer en SORTANT. Il n'existe aucun
`@starting-style`, aucun `data-state`, aucun écouteur `animationend` ou
`transitionend` : vérifié par grep sur tout `src/`. Chaque surface flottante se
démonte au même moment où elle décide de se fermer.

Quatre surfaces entrent avec une animation et disparaissent d'une image :

```tsx
// src/components/primitives/Modal.tsx:129 — actuel
if (!open) return null
```

```tsx
// src/components/primitives/Toast.tsx:50 — actuel
const dismiss = useCallback((id: number) => {
  setToasts((current) => current.filter((toast) => toast.id !== id))
}, [])
```

```tsx
// src/components/primitives/MenuDeDebordement.tsx:169 — actuel
{ouvert && (
```

```tsx
// src/components/controls/CurrencySwitcher.tsx:106 — actuel
{open && (
```

Le plan du produit budgète pourtant cette sortie depuis le début :

```
docs/PLAN.md:119 — actuel
motion  fast 150 · base 200 · slow 300 ; ease-out entrée, ease-in sortie (~70 %)
```

`--ease-in` (`src/design-system/tokens.css:631`) n'est cité NULLE PART ailleurs
que dans sa propre déclaration : c'est la moitié non construite de cette ligne.

Ce plan ne corrige aucune surface. Il pose le mécanisme dont 002 et 003
dépendent.

## Décision prise en amont, à ne pas rouvrir

La ligne de `PLAN.md` dit « ease-in sortie ». **On garde le `~70 %`, on
remplace `ease-in` par `ease-out`.** Une courbe qui démarre lentement retarde
l'instant exact que l'œil regarde, y compris en sortie. La durée raccourcie
suffit à dire « ça s'en va ». `--ease-in` devient donc mort pour de bon — ne pas
le supprimer dans ce lot, 002 et 003 doivent d'abord passer.

## Target

Un seul crochet, dans `src/lib/useSortieDifferee.ts` :

```ts
export function useSortieDifferee(
  ouvert: boolean,
  dureeMs: number,
): { monte: boolean; sortant: boolean }
```

- `ouvert === true` → `{ monte: true, sortant: false }`.
- `ouvert` passe à `false` → `{ monte: true, sortant: true }` pendant `dureeMs`,
  puis `{ monte: false, sortant: false }`.
- `ouvert` repasse à `true` PENDANT la sortie → retour immédiat à
  `{ monte: true, sortant: false }`, minuterie annulée. C'est le cas qui compte :
  ouvrir-fermer-ouvrir vite ne doit jamais laisser un nœud fantôme.
- Sous `prefers-reduced-motion: reduce` → démontage IMMÉDIAT, `sortant` jamais
  vrai. La règle globale de `tokens.css:1162` ramène les durées à 0,001 ms ;
  un `setTimeout` de 200 ms la contredirait en laissant le nœud peint.

## LE PIÈGE, et il fera échouer la suite si on l'ignore

Les tests tournent sous **jsdom**, qui ne déclenche ni `transitionend` ni
`animationend` : c'est pourquoi ce crochet est piloté par `setTimeout` et NON
par un écouteur d'événement. Un écouteur laisserait chaque modale montée pour
toujours sous le harnais.

Mais `setTimeout` ne suffit pas. Plusieurs tests affirment l'absence
IMMÉDIATEMENT après la fermeture, sans `waitFor` :

```tsx
// src/components/primitives/echapDansUneModale.test.tsx:53 — actuel
expect(screen.queryAllByRole('option')).toHaveLength(0)
```

Un nœud encore monté 200 ms de plus ferait rougir ces cas. **La réponse :
pendant `sortant`, le nœud sort de l'arbre d'accessibilité** — `aria-hidden`,
`inert`, `pointer-events-none`. Testing Library ignore par défaut ce que porte
`aria-hidden="true"` : les requêtes par rôle rendent donc `null` dès la
fermeture, pendant que les pixels, eux, finissent leur course.

## Repo conventions to follow

- Les crochets partagés vivent dans `src/lib/`, nommés en français, un par
  fichier : `useAuDela.ts`, `useDates.ts`, `useDocumentTitle.ts`.
- **Exemplaire à imiter : `src/lib/useAuDela.ts`.** Même forme — un JSDoc qui
  explique le POURQUOI et nomme les solutions écartées, un garde-fou explicite
  pour jsdom, `useState` + `useEffect`, un export nommé.
- Les durées en CSS passent par `--duration-fast|base|slow`
  (`src/design-system/tokens.css:650-653`). En TypeScript, ces jetons ne sont
  pas lisibles : écrire la constante en clair à côté du composant et la
  commenter comme miroir du jeton.
- Le dépôt écrit ses commentaires en français.

## Steps

1. Créer `src/lib/useSortieDifferee.ts` avec le JSDoc exigé ci-dessus (piège
   jsdom inclus, nommément), et l'implémentation :

```ts
import { useEffect, useRef, useState } from 'react'

export function useSortieDifferee(ouvert: boolean, dureeMs: number) {
  const [monte, setMonte] = useState(ouvert)
  const [sortant, setSortant] = useState(false)
  const minuterie = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (ouvert) {
      window.clearTimeout(minuterie.current)
      setMonte(true)
      setSortant(false)
      return
    }
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
```

2. Créer `src/lib/sortieDifferee.test.ts` couvrant les quatre cas : ouverture,
   fermeture différée, réouverture pendant la sortie (aucun nœud fantôme), et
   mouvement réduit (démontage immédiat). Utiliser `vi.useFakeTimers()`.
   S'inspirer de `src/lib/dates.test.ts` pour la forme.

3. NE modifier aucun composant dans ce lot.

## Boundaries

- NE PAS toucher `Modal.tsx`, `Toast.tsx`, `MenuDeDebordement.tsx`,
  `CurrencySwitcher.tsx`, `AppShell.tsx` — c'est 002 et 003.
- NE PAS toucher `Combobox.tsx` ni `DatePicker.tsx` : leurs panneaux n'ont pas
  d'entrée non plus, donc ils sont SYMÉTRIQUES. Y ajouter une sortie seule
  créerait le défaut que ce plan répare ailleurs.
- NE PAS supprimer `--ease-in` dans ce lot.
- NE PAS ajouter de dépendance.
- Si le code trouvé ne correspond pas aux extraits ci-dessus (dérive depuis
  f1d9aab), S'ARRÊTER et le signaler.

## Verification

- **Mécanique** : `npm run check:rapide` — doit passer en entier. Le crochet
  n'étant appelé par personne, aucun test existant ne doit bouger ; si l'un
  d'eux rougit, c'est une dérive, S'ARRÊTER et signaler.
- **Feel check** : sans appelant, aucun. Il arrive en 002.
- **Done when** : `useSortieDifferee` existe, ses quatre cas sont couverts, et
  `npm run check:rapide` est vert sans qu'aucun fichier de composant ait changé.

## Relevé d'exécution — 2026-09-24

Portes lancées ici, pas rapportées par l'exécutant :

| Porte | Résultat |
| --- | --- |
| `npx vitest run src/lib/sortieDifferee.test.ts` | vert, 4 cas |
| `npm run check:rapide` | vert — 299 fichiers, 2076 cas (298 + 1, 2072 + 4) |

Les quatre gardes étant NÉES VERTES, elles ont été mutées :

| Mutation | Attendu | Mesuré |
| --- | --- | --- |
| Les DEUX annulations retirées | rouge | **rouge** — cas 3 seul, `expected [ { monte: false, sortant: false } ] to deeply equal []` |
| SEULE l'annulation de la branche ouverte retirée | — | **vert** |

### Le `clearTimeout` de la branche ouverte est INTUABLE

La seconde mutation ne rougit sous aucun cas, et ce n'est pas un trou de
couverture : le nettoyage d'effet de React annule déjà la minuterie au
changement de dépendances, si bien que cette ligne ne peut jamais s'exécuter
utilement. Elle est écrite telle quelle parce que ce plan la spécifiait ; elle
est restée parce que la retirer sortait du lot.

Ce dépôt a déjà tranché ce cas, et contre elle — `tokens.css:1104-1115`, à
propos d'une règle dont la cause était morte : « La supprimer plutôt que la
renommer est le point : une règle dont la cause est morte et qu'on garde « au
cas où » devient une coïncidence que personne n'ose plus toucher. » La même
phrase s'applique à une ligne qu'aucune mutation ne tue.

Décision non prise : la retirer, ou la garder avec un commentaire disant
qu'elle est une ceinture par-dessus les bretelles de React.


## CORRECTION du 2026-09-24 — le montage doit être SYNCHRONE

Découvert en exécutant 002, par trois cas existants devenus rouges
(`drawer.test.tsx` « prend le focus à l'ouverture », « rend le focus au bouton
d'ouverture à la fermeture », `barreBasse.test.tsx` « ouvre le tiroir par
« Plus » »).

Le crochet tel qu'écrit plus haut ne fait passer `monte` à vrai que DANS
l'effet. À l'image où `ouvert` devient vrai, la surface n'est donc pas encore
rendue : `drawerRef.current` vaut `null` quand l'effet de focus s'exécute, et
il ne se rejouera pas puisque `ouvert`, lui, n'a plus changé. Le défaut n'est
pas propre au tiroir — il frappe tout appelant qui doit toucher le nœud à peine
monté : piège de focus, verrou de défilement, mesure. Il aurait aussi cassé 003.

Le montage doit être synchrone, par un ajustement en phase de rendu — l'idiome
React pour dériver un état d'une propriété :

```ts
/* Le montage est SYNCHRONE, et c'est un ajustement en phase de rendu et non un
   effet : à l'image où `ouvert` devient vrai, l'appelant doit pouvoir poser le
   focus sur un nœud DÉJÀ rendu. React relance le rendu avant de valider, et la
   condition devient fausse aussitôt — la boucle se referme. */
if (ouvert && (!monte || sortant)) {
  setMonte(true)
  setSortant(false)
}
```

…et l'effet ne garde plus que le chemin de FERMETURE :

```ts
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
```

Cinquième cas à ajouter à `sortieDifferee.test.ts`, et il doit reproduire la
panne réelle plutôt que la paraphraser : monter un composant qui rend un nœud
porteur d'une `ref` quand `monte` est vrai, et dont un `useEffect` dépendant de
la seule propriété `ouvert` relève `ref.current`. Affirmer qu'à l'ouverture ce
relevé n'est PAS `null`. Un cas qui interrogerait seulement `result.current`
après coup resterait vert dans les deux conceptions et ne garderait rien.
