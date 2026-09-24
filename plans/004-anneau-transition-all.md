# 004 — Nommer ce que l'anneau anime

- **Status**: DONE (exécuté le 2026-09-24, non commité)
- **Depends on**: rien — indépendant des trois autres
- **Commit**: f1d9aab
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 fichier (~2 lignes)

## Problem

C'est le SEUL `transition-all` de tout `src/`, et il est posé sur le cercle
SVG d'un anneau de 128 px :

```tsx
// src/components/primitives/Charts.tsx:1550-1566 — actuel
<circle
  data-jauge={slice.etat}
  cx="50"
  cy="50"
  r={r}
  fill="none"
  stroke={couleur}
  strokeWidth={exterieur - interieur}
  strokeDasharray={`${fraction * c} ${(1 - fraction) * c}`}
  strokeDashoffset={-debut * c}
  className="transition-all duration-150"
  transform="rotate(-90 50 50)"
/>
```

Quatre de ces attributs changent, et `transition-all` les prend tous :

- `r` et `strokeWidth` varient au survol et au focus, via `croissance`
  (`Charts.tsx:1540` : `active === slice.etat ? 1.5 : 0`). **C'est le geste
  voulu** — l'épaississement de la part visée.
- `strokeDasharray` et `strokeDashoffset` varient dès que la DONNÉE change.
  Personne n'a demandé que les arcs balaient à chaque rafraîchissement, et c'est
  ce que `transition-all` fait aujourd'hui.

Aucune de ces propriétés ne se compose : chaque image re-rastérise l'anneau,
pour 4 cercles (`bandes()` en rend 1 pour `pleine`, 1 pour `demie`, 2 pour
`creuse` — `Charts.tsx:1439-1448`). C'est la seule décision de performance du
dépôt qu'aucun commentaire ne justifie, alors que ses voisines le sont toutes.

## Target

```tsx
/* cible */
className="transition-[r,stroke-width] duration-150 ease-out"
```

Trois changements, chacun pour sa raison :

1. **`transition-[r,stroke-width]`** — seules les deux propriétés du survol.
   Le balayage des arcs au rafraîchissement de la donnée disparaît, et avec lui
   la moitié du coût de rastérisation.
2. **`ease-out` ajouté** — sans courbe explicite, Tailwind applique
   `cubic-bezier(.4, 0, .2, 1)`, qu'aucun jeton de ce dépôt ne nomme. Vérifié
   dans le bundle : `.ease-out` résout bien vers
   `--ease-out: cubic-bezier(.22, 1, .36, 1)`, la courbe forte de la maison.
3. `duration-150` reste : 150 ms est le budget d'un retour de survol.

Noter la syntaxe : `stroke-width` en CSS, et non `strokeWidth` qui est le nom
JSX de l'attribut. Dans `transition-*` on écrit du CSS.

## Repo conventions to follow

- Le dépôt énumère déjà ses propriétés au lieu d'employer `all` — deux
  exemplaires :
  - `src/components/primitives/Button.tsx:147` —
    `'transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out'`
  - `src/components/primitives/Choice.tsx:228` —
    `'transition-[border-color,background-color,box-shadow] duration-150 ease-out'`
  Même forme, virgules sans espaces.
- Toute décision de performance porte ici un commentaire qui dit ce qui a été
  écarté. En ajouter un court au-dessus de la ligne : pourquoi `r` et
  `stroke-width` seulement, et pourquoi pas `stroke-dasharray`.

## Steps

1. `src/components/primitives/Charts.tsx:1564` : remplacer
   `className="transition-all duration-150"` par
   `className="transition-[r,stroke-width] duration-150 ease-out"`.

2. Ajouter juste au-dessus un commentaire en français disant que le balayage
   des arcs au changement de donnée n'était pas voulu, et que seul
   l'épaississement de la part visée est animé.

## Boundaries

- NE PAS toucher `data-jauge` : `scripts/couleur-non-seule.mjs` retrouve les
  parts par cet attribut et COMPTE ce qu'elle a regardé — le commentaire de la
  ligne 1546 le dit. Le retirer arrête la porte.
- NE PAS toucher aux opacités des teintes (`Charts.tsx:1555-1559`) : elles sont
  opaques pour une raison de contraste mesurée (5,47:1 à 8,51:1).
- NE PAS toucher `bandes()`, `croissance`, ni le `rotate(-90 50 50)`.
- NE PAS étendre le lot aux `transition-shadow` des colonnes : elles sont
  documentées et tenues pour réglées.
- NE PAS ajouter de dépendance.

## Verification

- **Mécanique** :
  - `npm run build` avant toute porte navigateur.
  - `npm run check:rapide` — vert.
  - `node scripts/couleur-non-seule.mjs` — vert, et son COMPTE de parts
    inchangé. C'est la porte que ce fichier peut casser.
  - `node scripts/mesure-ui.mjs` — vert.
- **Feel check** : `npm run dev`, aller sur un écran portant l'anneau de
  statut, survoler puis tabuler jusqu'à une part.
  - la part visée épaissit toujours, vers l'intérieur ET vers l'extérieur, et
    le rayon médian ne bouge pas ;
  - le geste dure toujours 150 ms et ne saute pas ;
  - changer de parc ou de période — les arcs se REDESSINENT d'un coup, ils ne
    balaient plus. C'est le changement attendu : vérifier qu'il ne se lit pas
    comme un défaut.
  - DevTools → Performance, survol répété : plus de « Paint » continu sur le
    SVG entre deux survols.
- **Done when** : `couleur-non-seule.mjs` vert avec le même compte,
  l'épaississement au survol intact, et le balayage des arcs disparu au
  changement de donnée.
