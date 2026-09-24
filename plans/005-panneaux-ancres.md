# 005 — Donner aux menus ancrés une entrée, une sortie et la bonne origine

- **Status**: TODO
- **Depends on**: 001 (`useSortieDifferee`), 003 (`animate-pop-out`)
- **Commit**: e410d47
- **Severity**: MEDIUM
- **Category**: Cohesion · Origin · Interruptibility
- **Estimated scope**: 4 fichiers (~60 lignes)

## Problem

Dix surfaces ancrées, trois comportements. Deux s'ouvrent en `animate-pop`,
cinq n'ont AUCUNE entrée, et aucune des sept n'a de sortie :

```tsx
// src/components/primitives/MenuDeDebordement.tsx:179 — entre, ne sort pas
'animate-pop absolute right-0 flex w-64 …',
versLeHaut ? 'bottom-full mb-2' : 'top-full mt-2',
```

```tsx
// src/components/layout/AppShell.tsx:1748 — le menu du COMPTE, aucune entrée
className="absolute right-0 mt-2 flex w-64 flex-col gap-1 rounded-md …"
```

C'est le seul chemin vers la déconnexion et le changement de parc, et il
apparaît d'une image quand le menu de débordement, lui, grandit.

Et `gl-pop` ne pose AUCUN `transform-origin` (`tokens.css:1233`) : les deux qui
s'animent grandissent depuis leur propre CENTRE. `MenuDeDebordement` bascule
même entre `top-full` et `bottom-full` (`:184`) sans que l'origine suive — il ne
vient de son déclencheur dans aucune des deux orientations.

## Périmètre — ce qui est DEHORS, et pourquoi

**La liste du `Combobox` n'entre pas dans ce lot, et ce n'est pas un oubli.**
Elle s'ouvre sur `onChange` (`Combobox.tsx:353`), c'est-à-dire À CHAQUE FRAPPE,
en plus du focus et du clic. Une surface qui se rouvre pendant qu'on tape ne
s'anime pas : le mouvement arriverait en retard sur la lettre suivante. Elle
reste donc SYMÉTRIQUE — rien à l'entrée, rien à la sortie —, ce qui est cohérent
et non défectueux.

**Les deux panneaux du `DatePicker` non plus.** Ils sont portés dans `body` à
une position CALCULÉE puis BORNÉE à la fenêtre (`DatePicker.tsx:176-177` :
`Math.max(MARGE, Math.min(souhaite, …))`). Ils ne basculent pas au-dessus du
champ, ils glissent : leur rapport au déclencheur varie continûment, et aucune
origine fixe n'est juste plus d'une fois sur deux. Les animer demande de MESURER
d'abord où le panneau tombe par rapport à son champ. Ce lot ne le fait pas.

Restent CINQ menus, tous ancrés en DOM avec une origine lisible dans leurs
classes.

## Target

Aucune nouvelle image clé, aucun nouveau jeton. Ce lot réemploie
`animate-pop` (200 ms) et `animate-pop-out` (150 ms) — les 75 % que
`docs/PLAN.md:119` demande — et n'ajoute que l'ORIGINE et la SORTIE.

```tsx
/* cible, par panneau */
className={cn(
  sortant ? 'animate-pop-out' : 'animate-pop',
  'absolute right-0 …',
)}
style={{ transformOrigin: versLeHaut ? 'bottom right' : 'top right' }}
```

Correspondance des ancres :

| classes du panneau | `transform-origin` |
| --- | --- |
| `right-0` + `top-full` (ou `mt-*`) | `top right` |
| `right-0` + `bottom-full` (ou `mb-*`) | `bottom right` |
| `left-0` + `top-full` | `top left` |
| pleine largeur sous un en-tête | `top center` |

## Repo conventions to follow

- **Exemplaire à imiter : `src/components/primitives/Modal.tsx`**, lot 003. Il
  montre la forme entière — `useSortieDifferee(open, 150)`, `if (!monte) return
  null`, la classe qui bascule sur `sortant`, et `aria-hidden` + l'étalement
  `INERTE` sur le nœud que cherche une requête par rôle.
- **React 18.3.1 ne connaît pas `inert` en JSX.** Déclarer localement
  `const INERTE = { inert: '' } as unknown as { inert?: string }` et l'étaler ;
  voir `AppShell.tsx:41` et `PublicHeader.tsx:173`.
- La durée passée au crochet doit refléter `animate-pop-out`, soit 150 ms.
- Les jetons de mouvement vivent dans `tokens.css` ; ce lot n'en ajoute aucun.

## Steps

Pour CHACUN des cinq panneaux — `MenuDeDebordement.tsx:179`,
`CurrencySwitcher.tsx:114`, `AppShell.tsx:1578` (réglages),
`AppShell.tsx:1748` (compte), `PublicHeader.tsx:442` (menu mobile de la
vitrine) :

1. Lire les classes du panneau et en DÉDUIRE l'ancre. Ne pas supposer : deux
   d'entre eux peuvent basculer.
2. Poser `transform-origin` en accord avec cette ancre.
3. Brancher `useSortieDifferee(ouvert, 150)`, remplacer `{ouvert && …}` par
   `{monte && …}`, et faire basculer la classe sur `sortant`.
4. Pendant `sortant` : `aria-hidden`, `INERTE`, `pointer-events-none` sur le
   panneau lui-même — c'est lui que cherche une requête par rôle, pas son
   parent.
5. Ce qui ferme au clic extérieur, à Échap ou au changement de route doit
   rester accroché à l'état OUVERT, jamais à l'état monté : un menu qui s'en va
   ne doit plus retenir ni le focus ni le pointeur.

## Boundaries

- NE PAS toucher `Combobox.tsx` ni `DatePicker.tsx` — voir le périmètre.
- NE PAS ajouter d'image clé, de jeton, ni de durée.
- NE PAS modifier un cas existant pour le faire passer. Un cas qui rougit est
  un CONSTAT : le rapporter avec sa ligne.
- NE PAS toucher au tiroir mobile (lot 002) ni à la modale (lot 003).
- NE PAS ajouter de dépendance.

## Verification

- **Mécanique** : `npm run build`, puis `npm run check:rapide`,
  `node scripts/modales.mjs`, `node scripts/mesure-ui.mjs`.
  Surveiller `menusLicites.test.tsx`, `menuDuCompte.test.tsx`,
  `menuMobile.test.tsx`, `clavierDesPanneaux.test.tsx`, `panneauAncre.test.tsx`.
- **Garde à écrire** : un cas qui monte un menu EN PERMANENCE et bascule son
  ouverture, affirmant qu'il quitte l'arbre d'accessibilité dès la fermeture
  tout en restant peint. Le faire rougir par mutation avant de le croire.
- **Feel check** : `npm run dev`. Pour chaque menu, ouvrir et vérifier qu'il
  grandit DEPUIS SON DÉCLENCHEUR et non depuis son centre ; le menu de
  débordement en bas de page doit grandir vers le HAUT depuis son bord bas.
  Piloter l'horloge par `getAnimations()` plutôt que d'échantillonner : le
  volet du navigateur, s'il est masqué, gèle les animations CSS.
- **Done when** : les quatre portes sont vertes, les cinq menus grandissent
  depuis leur déclencheur, et aucun ne disparaît d'une image.


## CORRECTION du 2026-09-24 — la raison donnée pour écarter le `Combobox` ÉTAIT FAUSSE

Ce plan écrit que la liste « s'ouvre sur `onChange`, donc à CHAQUE FRAPPE », et
en conclut qu'une animation arriverait toujours en retard sur la lettre
suivante. C'est faux, et le lot suivant l'a mesuré dans le code : `{ouvert &&
<ul>}` garde la liste MONTÉE tant qu'elle est ouverte, et `setOuvert(true)` sur
une frappe ultérieure ne fait rien — React abandonne le rendu sur un état
identique. L'entrée joue donc UNE FOIS PAR OUVERTURE, pas une fois par
caractère.

Ce qui survit est plus étroit : l'une des trois façons d'ouvrir cette liste est
de taper le premier caractère, et c'est un geste au CLAVIER, où l'on veut les
options filtrées tout de suite. Cela justifie une entrée COURTE — 150 ms,
`animate-pop-fast` — et non pas l'absence d'entrée.

La liste est donc animée depuis le lot du `Combobox`. Cette section reste pour
que la mauvaise raison ne soit pas relue comme une bonne.
