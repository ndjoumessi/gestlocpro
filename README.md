# GestLocPro

Application SaaS de gestion locative — immeubles, unités, locataires, paiements,
relevés de compteurs, états des lieux, travaux et cautions. Multi-devises et
bilingue FR/EN.

Deux paquets dans un dépôt : le client React (Vite) à la racine, et l'API
Express + Prisma sur PostgreSQL dans `server/`. En production, un seul conteneur
Railway sert les deux (`Dockerfile`) ; Vercel ne fait que relayer vers lui
(`vercel.json`).

## Démarrer

Prérequis : **Node 20** — la version du `Dockerfile` et de l'intégration
continue — et **Docker**, pour la base.

```bash
git clone https://github.com/ndjoumessi/gestlocpro.git && cd gestlocpro

npm ci                                 # dépendances du client
npm --prefix server ci                 # dépendances de l'API
cp server/.env.example server/.env     # configuration locale, jamais commitée

npm run db:up                          # PostgreSQL 17 dans Docker, port 5433
(cd server && npx prisma generate)     # client Prisma : généré, pas versionné
(cd server && npx prisma migrate deploy)  # applique les migrations existantes
npm --prefix server run db:test:setup  # crée et migre la base gestlocpro_test

npx playwright install chromium        # seulement pour npm run check
```

Puis deux terminaux :

```bash
npm --prefix server run dev   # API sur http://localhost:3001
npm run dev                   # client sur http://localhost:5173
```

Le client relaie `/api` vers le port 3001 (`vite.config.ts`) : ouvrir
http://localhost:5173 suffit, et `/api/health` doit y répondre `{"ok":true}`.

Trois gestes de la liste se trompent facilement :

- **`cd server` et non `--prefix` pour Prisma.** `--prefix` dit à npm où trouver
  le paquet, pas dans quel répertoire lancer le programme : Prisma chercherait
  alors `prisma/schema.prisma` à la racine et ne le trouverait pas.
- **`migrate deploy` et non `migrate dev`** sur une copie neuve : on applique les
  migrations du dépôt, on n'en fabrique pas. `migrate dev` sert à celui qui
  modifie `schema.prisma`.
- **La base de test est distincte.** La suite serveur efface ce qu'elle trouve
  avant chaque cas ; `server/.env.test` l'envoie sur `gestlocpro_test`, et un
  garde-fou refuse toute base dont le nom ne finit pas par `_test`.

## Routes

| Public | Authentification | Application (`/app`) |
| --- | --- | --- |
| `/` landing | `/inscription` | `/app` tableau de bord |
| | `/inscription/:role` | `/app/parc` · `/paiements` · `/releves` |
| | `/connexion` | `/app/etats-des-lieux` · `/travaux` · `/cautions` |
| | `/mot-de-passe-oublie` | `/app/locataires` · `/signalements` · `/onboarding` |
| | `/reinitialiser?jeton=` | |
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
npm run check         # tout : types, lint, i18n, lectures, tests, navigateur
npm run check:rapide  # types, lint, i18n, lectures d'inventaire, 1600+ tests
npm run check:server  # le serveur, derrière une vraie base PostgreSQL
```

CETTE SECTION A MENTI PENDANT DES LOTS. Elle décrivait `npm run check` comme
« types + lint + chaînes en dur » alors qu'il enchaîne quinze portes au
navigateur et plus de mille six cents cas. Une commande qu'on croit légère parce
que sa documentation l'est se lance moins souvent qu'elle ne le devrait.

`check:rapide` tient les types, le lint, les gardes i18n, les lectures
d'inventaire et la suite de tests. `check:navigateur` ouvre un vrai Chromium sur
le paquet construit : débordement, contraste, cibles, modales, poids, politique
de sécurité, et l'espace connecté derrière un vrai serveur. Chacune sort en 1
quand elle trouve quelque chose.

`npm run check` DEMANDE MAINTENANT LA BASE DE DÉVELOPPEMENT. Deux portes au
navigateur montent le vrai serveur — `politique-de-securite` pour lire ses
en-têtes, `espace-connecte` pour ouvrir les quinze écrans de `/app` derrière
trois vraies sessions — et la seconde a besoin de PostgreSQL :

```bash
npm run db:up      # le conteneur gestlocpro-db, une fois
```

Elle crée sa propre base, `gestlocpro_porte`, détruite et remontée à chaque
passage : elle ne touche ni celle du développement ni celle des tests.

## Documentation

- [docs/PLAN.md](docs/PLAN.md) — décisions de conception, jetons, défauts trouvés,
  hypothèses à valider.
- [scripts/contrast-audit.js](scripts/contrast-audit.js) — audit de contraste.
  Se colle dans la console du navigateur, et `npm run check` le lance de
  lui-même via [scripts/mesure-ui.mjs](scripts/mesure-ui.mjs), qui l'évalue sur
  le paquet construit en deux thèmes et deux langues. Une seule source pour les
  deux usages : une copie dériverait sans que personne l'apprenne.
