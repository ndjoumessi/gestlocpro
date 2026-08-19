# Image de production : un seul conteneur sert l'API ET le client.
#
# Nixpacks a échoué deux fois pour deux raisons distinctes, et aucune n'était
# accidentelle : il a choisi Node 18 — que Vite 7 et jsdom refusent — et son
# montage de cache sur `node_modules/.cache` fait échouer `npm ci`, qui veut
# effacer le répertoire qu'il tient ouvert. Un Dockerfile dit la version de Node
# explicitement et ne monte rien : les deux causes disparaissent.
#
# La version est celle de développement, à la mineure près. Construire avec un
# autre Node que celui où l'on éprouve les tests, c'est déployer du code que
# personne n'a exécuté.
FROM node:20-bookworm-slim

# Prisma se lie à OpenSSL pour joindre Postgres en TLS. L'image `slim` ne le
# porte pas, et l'absence ne se voit qu'au démarrage — pas à la construction.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Les manifestes d'abord, le code ensuite : Docker garde la couche des
# dépendances tant que les verrous ne bougent pas. Une correction de code se
# reconstruit alors sans réinstaller deux arbres de modules.
COPY package.json package-lock.json ./
RUN npm ci
COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci

COPY . .

# Le client se construit dans `dist/`, à la racine ; le serveur dans
# `server/dist/`. `prisma generate` s'exécute depuis `server/` : le client
# généré se pose à côté du schéma qui le décrit — et il DOIT précéder le build
# du serveur, qui compile désormais ce client avec le reste des sources.
#
# `DATABASE_URL` factice, et sur cette LIGNE seulement : depuis Prisma 7,
# `prisma.config.ts` résout la variable au chargement, et `generate` échoue donc
# sans elle — alors qu'il n'ouvre aucune connexion. La valeur ne survit pas à la
# couche ; celle du service reste la seule que le conteneur voit à l'exécution,
# et `env.ts` refuserait de démarrer sur un secret d'exemple.
RUN npm run build \
  && cd server \
  && DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build' npx prisma generate \
  && npm run build

# `env.ts` refuse de démarrer en production avec le secret d'exemple : la valeur
# vient des variables du service, jamais de l'image.
ENV NODE_ENV=production
# L'encart « Update available 6.19.3 → 7.9.1 » que Prisma écrit à chaque
# démarrage part sur STDERR, et Railway classe donc en `error` un message qui
# n'en est pas un. Sur un service qui redémarre à chaque déploiement, c'est une
# fausse erreur permanente dans les journaux — exactement le bruit qui fait
# qu'on cesse de les lire, et on vient de passer une nuit à en avoir besoin.
#
# La montée en 7 est faite depuis ; cet encart-là ne s'affichera plus. La
# variable reste pour la prochaine majeure, et pour la même raison : un rappel
# que personne ne lit — on n'ouvre pas les journaux d'un démarrage réussi — ne
# vaut pas de salir ceux qu'on ouvre quand quelque chose casse.
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

# `start` applique les migrations avant d'écouter. L'ordre importe : servir une
# base au schéma périmé rend des erreurs de colonne inconnue, plus difficiles à
# lire qu'un démarrage refusé.
CMD ["npm", "--prefix", "server", "run", "start"]
