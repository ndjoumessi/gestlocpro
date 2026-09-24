# 006 — Les deux panneaux de date viennent de leur champ

- **Status**: DONE (exécuté le 2026-09-24)
- **Depends on**: 001 (`useSortieDifferee`), 003 (`animate-pop-out`), 005 (le motif)
- **Commit**: 76a3a66
- **Severity**: MEDIUM
- **Category**: Origin · Cohesion · Interruptibility

## Pourquoi ce lot n'a PAS été fait avec le 005

Le lot 005 les a écartés, et la raison tenait :

> Ils sont portés dans `body` à une position CALCULÉE puis BORNÉE à la fenêtre.
> Ils ne basculent pas, ils glissent : leur rapport au déclencheur varie
> continûment, et aucune origine FIXE n'est juste plus d'une fois sur deux.

C'est toujours vrai — et c'est ce qui indique la réponse. `placer()`
(`DatePicker.tsx:169-182`) tient déjà le cadre du déclencheur, décide `enHaut`,
puis BORNE `top` et `left`. L'origine se dérive donc de la MÊME géométrie, au
MÊME instant. Ce qu'une origine fixe ne pouvait pas suivre, une origine calculée
le suit par construction — y compris le bornage.

## Target

`usePanneauAncre` rend une origine en plus de la position, calculée dans
`placer()` après le bornage — jamais avant, sinon elle décrirait la position
souhaitée et non la position obtenue.

```ts
/* L'origine est le point du PANNEAU le plus proche du CHAMP. */
const x = Math.max(0, Math.min(cadre.left - left, largeur))
const y = top >= cadre.bottom ? 0 : top + hauteur <= cadre.top ? hauteur : Math.max(0, Math.min(cadre.top + cadre.height / 2 - top, hauteur))
setOrigine({ x, y })
```

- panneau SOUS le champ → `y = 0` (bord haut) ;
- panneau AU-DESSUS → `y = hauteur` (bord bas) ;
- panneau BORNÉ, donc chevauchant le champ → le milieu du champ ramené dans le
  panneau. C'est le cas que le lot 005 ne savait pas traiter.
- `x` suit le bord gauche du champ, borné à la largeur du panneau : un champ
  contre le bord droit ne fait pas grandir le panneau depuis un point hors de
  lui.

Appliqué en ligne : `style={{ …, transformOrigin: `${origine.x}px ${origine.y}px` }}`.

Entrée `animate-pop` (200 ms), sortie `animate-pop-out` (150 ms) — les mêmes
que les cinq menus du lot 005, aucun jeton ni image clé nouvelle.

## Ce qui NE change pas

- `Combobox` reste sans mouvement : sa liste s'ouvre sur `onChange`, donc à
  chaque frappe. Hors de ce lot et de tout lot.
- La logique de placement, le bornage, `enHaut`, les marges : intacts.
- Ce qui FERME — Échap, clic dehors, retour du focus au déclencheur — reste
  accroché à `ouvert`, jamais à l'état monté. Un panneau qui s'en va ne retient
  ni le focus ni le pointeur.

## Steps

1. `usePanneauAncre` : ajouter l'état `origine`, le calculer dans `placer()`
   APRÈS le bornage, le rendre avec le reste.
2. Brancher `useSortieDifferee(ouvert, 150)` dans le crochet ; rendre `monte` et
   `sortant` aux deux appelants.
3. Aux deux panneaux (`:501` jour, `:830` mois) : `{monte && position && …}`,
   la classe qui bascule sur `sortant`, `transformOrigin` en ligne, et pendant
   la sortie `aria-hidden`, l'étalement `INERTE` (React 18, voir
   `AppShell.tsx:41`) et `pointer-events-none` SUR LE PANNEAU — c'est lui que
   cherche une requête par rôle.

## Verification

- Garde écrite AVANT : monter un `DatePicker` en permanence, basculer son
  ouverture, affirmer qu'il quitte l'arbre d'accessibilité dès la fermeture tout
  en restant peint. La faire rougir par mutation.
- `npm run check:rapide`, en surveillant `datepicker.test.tsx`,
  `calendrierDansLePiege.test.tsx`, `moisCourantVisible.test.tsx`,
  `nomDuDeclencheurDeDate.test.tsx`, `echapDansUneModale.test.tsx`.
- **Mesure au navigateur, obligatoire ici** : c'est tout l'objet du lot. Ouvrir
  un panneau dans les TROIS cas — sous le champ, au-dessus, et borné — et
  relever `transformOrigin` calculé contre le cadre du champ. Piloter l'horloge
  par `getAnimations()` : un volet masqué gèle les animations CSS.
- `node scripts/modales.mjs` et `node scripts/mesure-ui.mjs` : le calendrier est
  un témoin de `mesure-ui` (`temoin: '[role="dialog"][aria-label="Calendrier"]'`).


## Relevé d'exécution — 2026-09-24

Mesuré au navigateur, trois hauteurs de fenêtre, sur le calendrier de la modale
de paiement :

| cas | origine | champ (haut/bas) | panneau (haut/bas, hauteur RÉELLE) |
| --- | --- | --- | --- |
| sous le champ | `0px 0px` | 318 / 362 | 366 / 778, h=412 |
| fenêtre à 620 | `0px 0px` | 140 / 184 | 182 / 594, h=412 |
| borné (fenêtre à 420) | `0px 146px` | 132 / 176 | 14 / 425, h=412 |

Le cas BORNÉ est celui qui justifiait ce lot : l'origine tombe à côté du champ,
là où une origine fixe se serait trompée.

### LA HAUTEUR DÉCLARÉE N'EST PAS LA HAUTEUR RENDUE

Le panneau mesure **412 px** ; la constante en annonce **430**. `hauteur` est
une ESTIMATION DE PLACEMENT, écrite par les appelants et lue AVANT que le
panneau existe, pour choisir un côté — ce n'est pas sa géométrie.

Conséquence sur la branche « au-dessus » : `y = hauteur` aurait posé l'origine
18 px SOUS le bord bas du panneau, donc hors de lui. Cette branche n'a été
ATTEINTE PAR AUCUN des trois cas — depuis la modale de paiement, le champ est
toujours assez haut pour que le panneau se pose dessous. Elle est donc réelle,
non mesurée, et fausse de 18 px quand elle est prise.

On ne l'a pas corrigée, on l'a rendue INATTEINGNABLE : l'origine verticale porte
son unité (`'0'`, `'100%'`, ou `${n}px`), et `100%` EST le bord bas, quelle que
soit la hauteur rendue.

Reste, déclaré : la branche bornée emploie encore `hauteur` comme borne haute du
`Math.min`. C'est une surestimation, pas un bord inventé — au pire 18 px de jeu
au lieu d'épingler le bord. La resserrer demanderait la hauteur rendue, soit la
dépendance qu'on vient de retirer.

Portes : check:rapide (304 fichiers, 2097 cas), modales, mesure-ui
(2924 textes, 518 cibles ; calendrier à 188/10 dans les deux thèmes).


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
