# Plans de mouvement

Issus de l'audit d'animation du 2026-09-24, sur `f1d9aab`. Le constat d'ensemble
est que le mouvement de ce produit est déjà juste sur presque tous les points
qu'un audit cherche : `--ease-out` est bien câblé vers la courbe forte du dépôt
(vérifié dans `dist/`, la courbe faible de Tailwind n'y apparaît pas une fois),
aucun `ease-in` ne traîne sur une commande, aucune transition ponctuelle ne
dépasse 300 ms, aucun `scale(0)` n'existe, aucun JS ne pilote de style image par
image, et `prefers-reduced-motion` n'a aucune échappatoire.

Ce qui manque n'est pas un réglage : c'est un MÉCANISME. Rien, dans `src/`, ne
peut s'animer en sortant — et cette absence se voit à neuf endroits.

| N° | Titre | Sév. | Dépend de | Statut |
| --- | --- | --- | --- | --- |
| [001](001-sortie-differee.md) | Donner au produit un mécanisme de sortie | HIGH | — | **DONE** |
| [002](002-tiroir-mobile.md) | Faire entrer et sortir le tiroir de navigation mobile | HIGH | 001 | **DONE** |
| [003](003-voile-et-sortie-de-modale.md) | Faire du voile et de la fenêtre un seul geste | HIGH | 001, 002 | TODO |
| [004](004-anneau-transition-all.md) | Nommer ce que l'anneau anime | HIGH | — | **DONE** |
| [005](005-panneaux-ancres.md) | Donner aux menus ancrés une entrée, une sortie et la bonne origine | MEDIUM | 001, 003 | **DONE** |
| [006](006-panneaux-de-date.md) | Les deux panneaux de date viennent de leur champ | MEDIUM | 001, 003, 005 | **DONE** |

## Ordre d'exécution

**004 d'abord si l'on veut un gain immédiat** : deux lignes, aucune dépendance,
et c'est le seul défaut de performance non documenté du dépôt.

Puis la chaîne : **001 → 002 → 003.**

- 001 ne touche aucun composant. Il pose `useSortieDifferee` et ses tests.
- 002 s'en sert le premier, et crée au passage les `@utility` `animate-voile-*`
  dont 003 dépend.
- 003 réutilise les deux.

Ne pas inverser 002 et 003 : 003 échouerait sur des utilitaires absents.

## Le piège à connaître avant d'exécuter 001

Les tests tournent sous jsdom, qui ne déclenche **ni `transitionend` ni
`animationend`**. Une sortie différée pilotée par écouteur laisserait chaque
modale montée pour toujours sous le harnais — d'où le `setTimeout` de 001.

Et `setTimeout` seul ne suffit pas : plusieurs cas affirment l'absence
IMMÉDIATEMENT après la fermeture, sans `waitFor` (par exemple
`echapDansUneModale.test.tsx:53`). C'est pourquoi chaque plan impose
`aria-hidden` + `inert` pendant la sortie : le nœud quitte l'arbre
d'accessibilité tout de suite, pendant que les pixels finissent leur course.

Deuxième piège, dans la même zone : ce dépôt est en **React 18.3.1**, qui ne
connaît pas `inert` comme propriété JSX. La forme `inert={vrai}` ne pose rien.
002 et 003 donnent l'étalement conditionnel à employer, et `PublicHeader.tsx:173`
montre l'idiome impératif déjà en place.

## Décision prise, à ne pas rouvrir en cours de route

`docs/PLAN.md:119` écrit « ease-out entrée, ease-in sortie (~70 %) ». Les plans
gardent le `~70 %` et remplacent `ease-in` par `ease-out` : une courbe qui
démarre lentement retarde l'instant que l'œil regarde, y compris en sortie, et
la durée raccourcie dit déjà « ça s'en va ». Conséquence : `--ease-in`
(`tokens.css:631`) restera mort. Le retirer une fois 002 et 003 passés.

## Découvert en exécutant 004 — à trancher

Tailwind v4 balaie la RACINE du projet, pas `src/`. Ce dossier `plans/` a donc
nourri le scanner : le fichier `004-anneau-transition-all.md` a suffi à faire
émettre `.transition-all{transition-property:all;…}` dans le bundle de
production alors que plus aucune source ne l'employait. Mesuré :

| | `transition-property:all` | CSS |
| --- | --- | --- |
| avec `plans/` | 1 | 72 602 o |
| sans `plans/` | 0 | 72 363 o |

239 octets ici, et sans conséquence. Mais le mécanisme, lui, vaut pour toute
documentation posée dans le dépôt : de la prose peut injecter des utilitaires
morts dans ce que reçoit l'utilisateur, et `poids-ecrans.mjs` les pèserait sans
jamais dire d'où ils viennent. Deux réponses possibles — ignorer `plans/`, ou
borner explicitement les sources de Tailwind. Aucune n'a été prise.

## Non traité ici

L'audit a relevé onze autres constats — modale-feuille sous `sm`, huit panneaux
ancrés sans entrée, `gl-pop` sans `transform-origin`, pile de toasts qui se
téléporte, onglets qui s'animent au clavier, `IconButton` dont l'enfoncement
n'est pas minuté, colonnes de graphe qui rejouent selon la donnée, jeton
`--ease-in-out` absent, `transition-colors` mort sur chaque `<tr>`, `--duration-*`
invisible de Tailwind. Aucun n'a de plan : ils attendent d'être choisis.
