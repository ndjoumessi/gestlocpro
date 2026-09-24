# Plans de mouvement

Issus de l'audit d'animation du 2026-09-24, sur `f1d9aab`. Le constat d'ensemble
est que le mouvement de ce produit est déjà juste sur presque tous les points
qu'un audit cherche : l'utilitaire `ease-out` est bien câblé vers la courbe forte
du dépôt, aucun `ease-in` ne traîne sur une commande, aucune transition ponctuelle
ne dépasse 300 ms, aucun `scale(0)` n'existe, aucun JS ne pilote de style image
par image, et `prefers-reduced-motion` n'a aucune échappatoire.

> **Correction du 2026-09-25.** Cette phrase disait aussi, entre parenthèses, que
> « la courbe faible de Tailwind n'apparaît pas une fois dans `dist/` ». C'est faux,
> et la mesure d'origine avait cherché la mauvaise chaîne : le paquet contient
> `--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1)`, avec des
> espaces, et TOUTE transition qui ne nomme pas sa courbe y retombe — une
> cinquantaine de `transition-colors` sont dans ce cas. Ce qui est vrai, et qui
> était le point, c'est que l'utilitaire `ease-out` ne la porte pas.

Ce qui manque n'est pas un réglage : c'est un MÉCANISME. Rien, dans `src/`, ne
peut s'animer en sortant — et cette absence se voit à neuf endroits.

| N° | Titre | Sév. | Dépend de | Statut |
| --- | --- | --- | --- | --- |
| [001](001-sortie-differee.md) | Donner au produit un mécanisme de sortie | HIGH | — | **DONE** |
| [002](002-tiroir-mobile.md) | Faire entrer et sortir le tiroir de navigation mobile | HIGH | 001 | **DONE** |
| [003](003-voile-et-sortie-de-modale.md) | Faire du voile et de la fenêtre un seul geste | HIGH | 001, 002 | **DONE** |
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
jamais dire d'où ils viennent.

**Tranché depuis :** `src/index.css` porte `@source not "../plans";`. C'est la
première des deux réponses — ignorer ce dossier — et non la seconde, qui aurait
demandé d'énumérer les sources et de maintenir cette liste. Le piège reste ouvert
pour tout AUTRE dossier de prose qu'on ajouterait à la racine.

## Correction — la raison d'écarter le `Combobox` était fausse

Les lots 005 et 006 l'écartaient au motif qu'il « se rouvre à chaque frappe ».
Mesuré depuis dans le code : la liste reste MONTÉE tant qu'elle est ouverte, et
l'entrée joue une fois par ouverture. Elle est animée depuis, en 150 ms plutôt
qu'en 200 — parce que taper le premier caractère est l'une de ses trois
ouvertures, et que c'est un geste au clavier.

## Les constats sans plan — tous fermés au 2026-09-25, sauf un

L'audit avait relevé onze autres constats, exécutés sans passer par un plan écrit.
Ils sont tous refermés :

| Constat | Sort |
| --- | --- |
| modale-feuille sous `sm` | faite — `animate-feuille`, et le voile suit le tempo du tiroir |
| huit panneaux ancrés sans entrée | faits — entrée, sortie et origine prise du déclencheur |
| `gl-pop` sans `transform-origin` | fait — l'origine vient du déclencheur, calculée après le bornage |
| onglets qui s'animent au clavier | fait — la transition retirée ; le fondu du survol s'en va avec elle, c'est déclaré |
| `IconButton` dont l'enfoncement n'est pas minuté | fait — même liste, même durée, même courbe que `Button` |
| `transition-colors` mort sur chaque `<tr>` | retiré — aucune rangée ne change jamais de couleur |
| pile de toasts qui se téléporte | **à MOITIÉ** — voir ci-dessous |
| colonnes de graphe qui rejouent selon la donnée | fait — la clé porte la période, plus le libellé traduit |
| jeton `--ease-in-out` absent | fait — quintique, pour rester dans la famille du dépôt |
| `--duration-*` invisible de Tailwind | mesuré, et la remède supposé ne marchait pas : voir ci-dessous |

### Ce qui reste : le toast qui n'est pas le dernier

Le toast a maintenant une sortie, et il quitte le flux à l'instant où il commence
à partir — donc la colonne se replace UNE fois, pendant le fondu, au lieu de deux.
Mais cela ne vaut que pour le DERNIER en flux : la position statique d'un enfant
absolu d'une boîte flexible se calcule comme s'il était seul, et pour les autres
c'est un saut de 54 px (108 pour le premier de trois). Ceux-là s'effacent donc sur
place, et leur voisin du dessus attend la fin du fondu pour descendre.

Rien en CSS statique ne sait dire « la place que j'occupais ». Il faut la
réécriture de l'empilement avec décalages mesurés — c'est le seul reliquat de
l'audit, et le seul qui demande un plan.

### Ce que la mesure a corrigé sur `--duration-*`

Le constat disait « invisible de Tailwind », en supposant qu'un déplacement dans
`@theme` rendrait `duration-slow` écrivable en classe. Mesuré le 2026-09-25 :
**c'est faux.** `--duration-*` n'est pas un espace de noms de thème Tailwind, et
aucun `.duration-fast{…}` n'est généré dans `@theme` non plus. La forme qui
marche — et qui marchait déjà sans rien déplacer — est `duration-(--duration-slow)`.

Les jetons ont tout de même été déplacés dans `@theme`, pour une autre raison : la
justification écrite du contraire (« réutilisées en CSS brut ») était fausse,
`--ease-drawer` la contredisant six lignes plus haut. Coût mesuré du déplacement :
74 660 octets avant, 74 660 après, à l'octet près.
