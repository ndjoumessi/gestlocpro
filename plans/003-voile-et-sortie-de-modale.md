# 003 — Faire du voile et de la fenêtre un seul geste

- **Status**: TODO
- **Depends on**: 001 (`useSortieDifferee`), 002 (jetons `gl-voile-*`)
- **Commit**: f1d9aab
- **Severity**: HIGH
- **Category**: Cohesion
- **Estimated scope**: 2 fichiers (~35 lignes)

## Problem

Le voile de la modale se peint d'un coup pendant que le panneau, lui, prend
200 ms à entrer. Le fond noircit à l'image zéro, la boîte de dialogue arrive
après : un seul geste rendu comme deux événements.

```tsx
// src/components/primitives/Modal.tsx:211-214 — actuel, AUCUNE transition
<button
  type="button"
  aria-label={t('common.close')}
  onClick={dismissible ? onClose : undefined}
  disabled={!dismissible}
  className="absolute inset-0 cursor-default bg-scrim"
/>
```

```tsx
// src/components/primitives/Modal.tsx:207-210 — actuel, animé sur 200 ms
className={cn(
  'animate-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
  'rounded-t-lg border border-divider bg-surface shadow-e3 sm:rounded-lg',
  SIZES[size],
)}
```

Et les deux disparaissent sur la même image :

```tsx
// src/components/primitives/Modal.tsx:129 — actuel
if (!open) return null
```

## Target

- Le voile entre en opacité sur `--duration-base` (200 ms) `var(--ease-out)`,
  EXACTEMENT la durée et la courbe de `animate-pop` — les deux doivent démarrer
  et finir ensemble.
- À la fermeture, voile et panneau sortent ensemble sur `--duration-fast`
  (150 ms), soit 75 % de l'entrée : le `~70 %` de `docs/PLAN.md:119`.
- Nouvelle image clé pour la sortie du panneau, miroir de `gl-pop` :

```css
/* src/design-system/tokens.css — section Animations */
@keyframes gl-pop-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.96); }
}

@utility animate-pop-out {
  animation: gl-pop-out var(--duration-fast) var(--ease-out) both;
}
```

`0.96` et non `0`, et c'est le même nombre qu'à l'entrée (`tokens.css:1236`) :
rien, dans le monde réel, ne se réduit à néant.

## `inert` sous React 18 — à lire avant d'écrire la moindre ligne

Ce dépôt est en **React 18.3.1**, qui ne connaît PAS `inert` comme propriété
JSX : `inert={vrai}` y déclenche un avertissement et l'attribut n'est pas posé.
Le dépôt le sait déjà et emploie l'attribut nu, impérativement :

```ts
// src/components/layout/PublicHeader.tsx:173 — l'idiome de la maison
fond.forEach((noeud) => noeud.setAttribute('inert', ''))
```

En JSX, la forme équivalente et sûre est un étalement conditionnel. Déclarer
une fois, en haut du fichier :

```ts
/** React 18 ne connaît pas `inert` en JSX : il lui faut l'attribut nu. */
const INERTE = { inert: '' } as unknown as { inert?: string }
```

puis, sur le nœud qui sort : `{...(sortant ? INERTE : {})}`.

NE PAS écrire `inert={sortant || undefined}` : c'est la forme React 19, et elle
ne fait rien ici. `panneauAncre.test.tsx:114` et `barreBasse.test.tsx:138`
vérifient déjà cet attribut par `toHaveAttribute('inert')` — la forme fautive
les ferait rougir.

## Repo conventions to follow

- **Exemplaire à imiter : `tokens.css:1233-1241` + `:1460-1462`** — `gl-pop` et
  son `@utility animate-pop`. `gl-pop-out` se pose juste à côté, même forme.
- Les voiles du plan 002 sont créés au tempo du TIROIR (300/200 ms), pas à celui
  de la modale (200/150). CORRIGÉ EN COURS DE LOT : la paire est renommée
  `animate-voile-drawer-in` / `-out`, et une paire `animate-voile-pop-in` / `-out`
  est ajoutée au tempo de `animate-pop`. Les deux partagent les MÊMES images clés
  `gl-voile-in` / `gl-voile-out` — seules les enveloppes `@utility` diffèrent,
  donc aucune logique n'est dupliquée. Un voile nomme la surface qu'il accompagne
  parce que sa durée appartient à cette surface, pas à lui.
- `src/design-system/durees.test.ts` interdit toute durée en dur dans ce
  fichier : n'employer que `var(--duration-*)`.

## Steps

1. `src/design-system/tokens.css` : ajouter `gl-pop-out` et `animate-pop-out`
   à côté de `gl-pop`.

2. `src/components/primitives/Modal.tsx` : importer `useSortieDifferee` depuis
   `@/lib/useSortieDifferee`, et remplacer le retour anticipé de la ligne 129.
   **Attention** : le commentaire de la ligne 50 dit « Avant le retour anticipé
   de `!open` : un crochet ne se saute pas » — `useSortieDifferee` doit donc
   être appelé AVEC les autres crochets, au-dessus du retour.

```tsx
const { monte, sortant } = useSortieDifferee(open, 150)
// …
if (!monte) return null
```

3. Voile — ligne 211 :

```tsx
className={cn(
  'absolute inset-0 cursor-default bg-scrim',
  sortant ? 'animate-voile-out' : 'animate-voile-in',
)}
```

4. Panneau — ligne 207 :

```tsx
className={cn(
  sortant ? 'animate-pop-out' : 'animate-pop',
  'relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
  'rounded-t-lg border border-divider bg-surface shadow-e3 sm:rounded-lg',
  SIZES[size],
)}
```

5. Sur le conteneur porté par `createPortal` (ligne 167), ajouter pendant la
   sortie `aria-hidden` et `inert`, et `pointer-events-none`. Sans cela, la
   fenêtre reste 150 ms dans l'arbre d'accessibilité et cliquable :

```tsx
aria-hidden={sortant || undefined}
{...(sortant ? INERTE : {})}
```

6. Le piège de focus (`piegeDeFocus.ts`) NE DOIT PAS courir pendant la sortie :
   vérifier que l'effet qui l'installe dépend de `open` et non de `monte`,
   faute de quoi le focus resterait retenu dans une fenêtre qui s'efface.

## Boundaries

- NE PAS transformer la modale en feuille glissante sous `sm` : c'est le
  constat n° 5 de l'audit, et il a son propre lot. Ici, `gl-pop` des deux côtés.
- NE PAS toucher `Toast.tsx` ni `MenuDeDebordement.tsx` : mêmes symptômes,
  autres lots.
- NE PAS toucher `Combobox.tsx` ni `DatePicker.tsx` : leurs panneaux sont
  symétriques (rien à l'entrée, rien à la sortie) et le restent.
- NE PAS changer `--color-scrim` ni son alpha, cuit dans le jeton
  (`tokens.css:621`) pour une raison documentée.
- NE PAS ajouter de dépendance.
- Si `Modal.tsx:129` ou `:207-214` ne correspond pas aux extraits, S'ARRÊTER.

## Verification

- **Mécanique** :
  - `npm run build` avant toute porte navigateur.
  - `npm run check:rapide` — vert. Surveiller de près `modalFocus.test.tsx`,
    `modalesImbriquees.test.tsx`, `echapDansUneModale.test.tsx`,
    `piegeDeFocus`. CORRIGÉ APRÈS MESURE : `echapDansUneModale.test.tsx:53` ne
    garde RIEN ici — ses trois modales sont `open` en dur, jamais fermées, et la
    ligne porte sur le rôle `option` d'un `Combobox`, hors périmètre. Le vrai
    témoin de l'étape 5 est `src/features/dashboard/etatDesLieux.test.tsx:128`,
    hors de `src/components/primitives/` : il meurt si les attributs manquent, et
    meurt de même s'ils sont posés sur le voile au lieu du conteneur du portail.
  - `node scripts/modales.mjs` — vert. Cette porte mesure des modales réelles
    dans un navigateur : un panneau encore peint pendant sa sortie peut être
    capturé. Si elle rougit sur une modale « fermée », le rapporter plutôt que
    d'assouplir la porte.
- **Feel check** : `npm run dev`, ouvrir n'importe quelle modale.
  - le fond s'assombrit EN MÊME TEMPS que la fenêtre grandit — pas avant ;
  - à la fermeture les deux repartent ensemble, nettement plus vite ;
  - Échap, clic sur le voile et bouton d'abandon donnent la MÊME sortie ;
  - ouvrir-fermer-ouvrir vite ne laisse aucun voile orphelin ;
  - DevTools → Animations, lecture à 10 % : voile et panneau démarrent sur la
    même image et finissent sur la même image ;
  - Rendering → `prefers-reduced-motion: reduce` : apparition et disparition
    instantanées, aucun nœud qui traîne, focus rendu correctement.
- **Done when** : `check:rapide` et `scripts/modales.mjs` verts, et voile et
  panneau démarrent sur la même image à 10 % de vitesse.
