# 002 — Faire entrer et sortir le tiroir de navigation mobile

- **Status**: DONE (exécuté le 2026-09-24, commit 031e99c)
- **Depends on**: 001 (`useSortieDifferee`)
- **Commit**: f1d9aab
- **Severity**: HIGH
- **Category**: Missing motion
- **Estimated scope**: 2 fichiers (~40 lignes)

## Problem

Le tiroir de navigation mobile n'a AUCUN mouvement. Un panneau de 288 px et un
voile plein écran à 55 % d'opacité apparaissent et disparaissent sur une seule
image :

```tsx
// src/components/layout/AppShell.tsx:598-618 — actuel
{drawerOpen && (
  <>
    <button
      type="button"
      aria-label={t('common.close')}
      onClick={() => setDrawerOpen(false)}
      className="fixed inset-0 cursor-default bg-scrim lg:hidden"
      style={{ zIndex: 'var(--z-overlay)' }}
    />
    <Sidebar
      role={role}
      setRole={setRole}
      railed={false}
      onToggleRail={() => setDrawerOpen(false)}
      className="fixed inset-y-0 left-0 flex w-72 lg:hidden"
      style={{ zIndex: 'var(--z-overlay)' }}
      dialogLabel={t('nav.primaryNav')}
      innerRef={drawerRef}
    />
  </>
)}
```

C'est la navigation principale sur la plateforme visée, et rien ne dit d'où
elle vient ni où elle repart.

## Ce que ce plan ne rouvre PAS

`AppShell.tsx:1175-1193` documente, avec mesure, pourquoi le RAIL de bureau se
replie instantanément : `width` est une propriété de mise en page, et le contenu
du panneau est remplacé d'un bloc. **Cette décision reste entière.**

Elle ne couvre pas le tiroir : l'objection y est que « la barre POUSSE le
contenu, donc un `translateX` laisserait un trou ». Le tiroir, lui, est
`fixed` et RECOUVRE — il ne pousse rien, et aucun trou n'est possible. C'est
précisément le cas où `translateX` est la bonne réponse, et il ne coûte aucun
relayout.

## Target

```css
/* src/design-system/tokens.css — à ajouter dans @theme, près de --ease-out:631 */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

```css
/* src/design-system/tokens.css — nouvelles images clés, section Animations */
@keyframes gl-drawer-in {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
@keyframes gl-drawer-out {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}
@keyframes gl-voile-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes gl-voile-out { from { opacity: 1; } to { opacity: 0; } }

@utility animate-drawer-in  { animation: gl-drawer-in  var(--duration-slow) var(--ease-drawer) both; }
@utility animate-drawer-out { animation: gl-drawer-out var(--duration-base) var(--ease-drawer) both; }
@utility animate-voile-in   { animation: gl-voile-in   var(--duration-slow) var(--ease-out) both; }
@utility animate-voile-out  { animation: gl-voile-out  var(--duration-base) var(--ease-out) both; }
```

Entrée 300 ms (`--duration-slow`), sortie 200 ms (`--duration-base`) : 67 %,
c'est le `~70 %` que `docs/PLAN.md:119` demande. La courbe est celle d'iOS,
copiée telle quelle depuis le catalogue de règles — NE PAS l'arrondir.

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

- Toutes les images clés et tous les `@utility` de mouvement vivent dans
  `src/design-system/tokens.css`, section « Animations » (ligne ~1220), nommés
  `gl-*` pour les unes et `animate-*` pour les autres.
- **Exemplaire à imiter : `tokens.css:1456-1462`** — `@utility animate-rise` et
  `animate-pop`, qui composent `animation: <clés> var(--duration-*) var(--ease-*) both`.
- Les durées écrites en dur sont interdites par `src/design-system/durees.test.ts`,
  qui lit ce fichier : n'employer que des `var(--duration-*)`.
- `--ease-drawer` DOIT aller à l'intérieur du bloc `@theme` (ouvert ligne 145,
  fermé ligne 647), sinon Tailwind ne l'expose pas. `--ease-out:631` est dedans ;
  se placer juste après.

## Steps

1. `src/design-system/tokens.css` : ajouter `--ease-drawer` juste après
   `--ease-in` (ligne 631), DANS `@theme`. Un commentaire dit d'où vient la
   courbe (Ionic / iOS) et pourquoi le tiroir ne prend pas `--ease-out`.

2. `src/design-system/tokens.css`, section Animations : ajouter les quatre
   images clés et les quatre `@utility` ci-dessus.

3. `src/components/layout/AppShell.tsx` : importer `useSortieDifferee` depuis
   `@/lib/useSortieDifferee` et remplacer le bloc `{drawerOpen && (…)}` par :

```tsx
const { monte: tiroirMonte, sortant: tiroirSortant } = useSortieDifferee(drawerOpen, 200)

{tiroirMonte && (
  <>
    <button
      type="button"
      aria-label={t('common.close')}
      onClick={() => setDrawerOpen(false)}
      aria-hidden={tiroirSortant || undefined}
      {...(tiroirSortant ? INERTE : {})}
      className={cn(
        'fixed inset-0 cursor-default bg-scrim lg:hidden',
        tiroirSortant ? 'animate-voile-out pointer-events-none' : 'animate-voile-in',
      )}
      style={{ zIndex: 'var(--z-overlay)' }}
    />
    <Sidebar
      role={role}
      setRole={setRole}
      railed={false}
      onToggleRail={() => setDrawerOpen(false)}
      className={cn(
        'fixed inset-y-0 left-0 flex w-72 lg:hidden',
        tiroirSortant ? 'animate-drawer-out pointer-events-none' : 'animate-drawer-in',
      )}
      style={{ zIndex: 'var(--z-overlay)' }}
      dialogLabel={t('nav.primaryNav')}
      innerRef={drawerRef}
    />
  </>
)}
```

   `Sidebar` accepte déjà `className` et `style` (`AppShell.tsx:1104-1119`) :
   aucune signature à changer.

4. `aria-hidden` et `INERTE` pendant la sortie ne sont pas cosmétiques : ils
   retirent le tiroir de l'arbre d'accessibilité dès la fermeture, ce dont
   dépendent les cas existants de `drawer.test.tsx` et `menuMobile.test.tsx`
   qui affirment l'absence sans attendre.

## Boundaries

- NE PAS toucher au rail de bureau (`railed`, `AppShell.tsx:1104-1200`), ni au
  commentaire qui justifie son repli instantané.
- NE PAS toucher `PublicHeader.tsx` — son menu mobile est le même défaut, mais
  il est hors lot.
- Le `Sidebar` PREND UNE PROPRIÉTÉ DE PLUS, `sortant?: boolean` — cette
  frontière a été levée le 2026-09-24, voir la correction en fin de plan. Rien
  d'autre de sa structure ne change.
- NE PAS ajouter de dépendance.
- Si `AppShell.tsx:598-618` ne correspond pas à l'extrait ci-dessus, S'ARRÊTER.

## Verification

- **Mécanique** :
  - `npm run build` (≈ 1,2 s) AVANT toute porte navigateur — les portes lisent
    `dist/`, pas les sources.
  - `npm run check:rapide` — vert. Surveiller `drawer.test.tsx`,
    `menuMobile.test.tsx`, `clavierDesPanneaux.test.tsx`, `panneauAncre.test.tsx`.
    Si l'un rougit sur une affirmation d'absence, c'est que `aria-hidden`/`inert`
    manque à l'étape 3 — corriger là, pas dans le test.
  - `node scripts/modales.mjs` et `node scripts/mesure-ui.mjs` — vert.
- **Feel check** : `npm run dev`, fenêtre à 375 px de large, ouvrir le tiroir
  depuis « Plus » de la barre basse.
  - le panneau vient du bord GAUCHE, il n'apparaît pas sur place ;
  - le voile s'assombrit EN MÊME TEMPS que le panneau glisse — pas avant ;
  - à la fermeture, les deux repartent ensemble, plus vite qu'ils ne sont venus ;
  - ouvrir-fermer-ouvrir rapidement ne laisse jamais de panneau fantôme ni de
    voile orphelin ;
  - dans l'onglet Animations de DevTools, lecture à 10 % : le panneau ne
    tressaute pas à mi-course et le voile n'a pas une image d'avance.
  - Rendering → `prefers-reduced-motion: reduce` : le tiroir apparaît et
    disparaît instantanément, sans nœud qui traîne.
- **Done when** : les trois portes ci-dessus sont vertes, et le tiroir glisse
  dans les deux sens à 375 px.


## CORRECTION du 2026-09-24 — le panneau doit lui aussi quitter l'arbre

Découvert à l'exécution : `drawer.test.tsx` « rend le focus au bouton
d'ouverture à la fermeture » affirme
`expect(screen.queryByRole('dialog')).not.toBeInTheDocument()` et trouvait
l'`<aside role="dialog" aria-modal="true">` encore là pendant ses 200 ms de
sortie.

L'étape 3 posait `aria-hidden` et `INERTE` sur le SEUL voile. C'est une faute
du plan : le panneau est ce que la requête par rôle va chercher. Et `Sidebar`
(`AppShell.tsx:1104-1136`) a une liste de propriétés fermée, sans étalement —
il ne peut pas recevoir ces attributs de l'extérieur.

Deux modifications, donc :

1. `Sidebar` prend `sortant?: boolean` en plus de `className`, `style`,
   `dialogLabel` et `innerRef`. Sur son `<aside>`, quand `sortant` est vrai :
   `aria-hidden` et l'étalement `{...INERTE}` (forme React 18, voir plus haut).
2. L'appel du tiroir passe `sortant={tiroirSortant}`.

Le voile garde les siens. Les deux nœuds sortent ensemble de l'arbre
d'accessibilité dès la fermeture, et seuls leurs pixels s'attardent.


## Relevé d'exécution — 2026-09-24

| Porte | Résultat |
| --- | --- |
| `npm run build` | vert |
| `npm run check:rapide` | vert — 299 fichiers, 2077 cas |
| `node scripts/modales.mjs` | vert — 20 fichiers de modale |
| `node scripts/mesure-ui.mjs` | vert |

Les trois cas d'abord rouges — `drawer.test.tsx` « prend le focus à
l'ouverture » et « rend le focus au bouton d'ouverture à la fermeture »,
`barreBasse.test.tsx` « ouvre le tiroir par « Plus » » — sont verts.

### Vérification à 375 px, pilotée par l'horloge de l'animation

| t (ms) | x du panneau | opacité du voile |
| --- | --- | --- |
| 0 | −288 | 0 |
| 75 | −64 | 0,76 |
| 150 | −13 | 0,96 |
| 225 | −2 | 1,00 |
| 300 | 0 | 1 |

Entrée 300 ms, sortie 200 ms (67 %). Sortie : 0 → −275 à 100 ms → −288 à
200 ms. Pendant la sortie, `aria-hidden="true"` ET `inert` sont posés, et une
requête par rôle ne trouve plus rien alors que le panneau est encore peint —
c'est exactement le mécanisme que ce lot promettait.

### LE PIÈGE DE MESURE, à connaître avant de refaire ce relevé

Le volet du navigateur était MASQUÉ, et Chrome gèle les animations CSS d'un
document caché. Le premier relevé montrait le tiroir immobile à −288 et le
voile à 0 quatre cents millisecondes après l'ouverture — un produit
parfaitement cassé, et rien n'était cassé. La signature à reconnaître :
`playState` vaut « running » pendant que `currentTime` reste à 0.

`tabs_select` ne suffit pas : il met un onglet au premier plan DANS le volet,
il n'affiche pas le volet. Ce qui marche est de ne pas dépendre de l'horloge du
navigateur — prendre l'animation par `getAnimations()`, lui imposer
`currentTime`, et lire la géométrie à chaque pas. C'est déterministe, immunisé
à la visibilité, et cela rend une COURBE là où un échantillon au hasard ne rend
qu'un point.
