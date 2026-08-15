# GestLocPro

Application SaaS de gestion locative — immeubles, unités, locataires, paiements,
relevés de compteurs, états des lieux, travaux et cautions. Multi-devises et
bilingue FR/EN.

Maquette fonctionnelle : aucun backend n'est connecté, les formulaires
fonctionnent en état React local.

## Démarrer

```bash
npm install && npm run dev
```

## Routes

| Public | Authentification | Application (`/app`) |
| --- | --- | --- |
| `/` landing | `/inscription` | `/app` tableau de bord |
| | `/inscription/:role` | `/app/parc` · `/paiements` · `/releves` |
| | `/connexion` | `/app/etats-des-lieux` · `/travaux` · `/cautions` |
| | `/mot-de-passe-oublie` | `/app/locataires` · `/signalements` · `/onboarding` |
| | | `/app/systeme` · `/portail` |

`/kitchen-sink` affiche chaque primitive du système de design dans ses états.

## Structure

```
src/
  design-system/tokens.css   source de vérité des jetons (couleurs, typo, espacements)
  components/primitives/     bouton, carte, pastille de statut, champs, modale, graphes
  components/controls/       sélecteurs de langue et de devise
  components/layout/         en-têtes public et applicatif, gabarits
  features/marketing/        sections de la landing
  features/auth/             assistant d'inscription, validation
  features/dashboard/        les douze écrans applicatifs
  i18n/                      dictionnaires FR/EN et provider
  currency/                  XAF, XOF, EUR, CAD, USD
  data/                      jeu de démonstration
```

## Conventions

- **Aucun hex en dur dans les composants.** Tout passe par les jetons de
  `design-system/tokens.css`.
- **Un statut n'est jamais porté par la seule couleur** : couleur + icône + libellé.
- **Cibles tactiles à 44 px minimum**, écart de 8 px.
- `--color-gold` (`#C58E3E`) est un accent de marque : fond, bordure, icône, ou
  texte sur fond sombre. **Jamais du texte sur fond clair** — 2.87:1 sur blanc.
- Les clés i18n manquantes échouent à la compilation : `en.ts` est typé contre `fr.ts`.
- **Accord en nombre** : une clé interpolant `{count}` porte une variante
  `clé_one` (et `_many`… si la langue l'exige). `t()` choisit via
  `Intl.PluralRules` ; la clé de base reste la forme par défaut.
- **Aucune chaîne utilisateur en dur dans le JSX.** Le typage ne couvre pas
  `aria-label="…"` ni `placeholder="…"` — `npm run lint:i18n` s'en charge.

## Vérifications

```bash
npm run check      # types + lint + chaînes en dur
npm run lint:i18n  # chaînes utilisateur écrites en dur uniquement
```

`npm run check` enchaîne `tsc`, `oxlint` et le garde-fou i18n. À brancher en
intégration continue : le garde-fou sort en 1 quand il trouve quelque chose.

## Documentation

- [docs/PLAN.md](docs/PLAN.md) — décisions de conception, jetons, défauts trouvés,
  hypothèses à valider.
- [scripts/contrast-audit.js](scripts/contrast-audit.js) — audit de contraste à
  exécuter dans la console du navigateur.
