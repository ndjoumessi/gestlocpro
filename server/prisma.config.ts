import { defineConfig } from 'prisma/config'

/**
 * Présence d'un fichier de configuration Prisma = plus de chargement
 * automatique de `.env`. Le CLI le dit (« skipping environment variable
 * loading ») mais l'échec qui suit parle d'une variable manquante, pas de la
 * cause — on le charge donc ici, comme `src/env.ts` le fait pour le serveur.
 */
try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}

/**
 * Configuration Prisma.
 *
 * Le bloc `prisma` de `package.json` fait la même chose, mais il est déprécié
 * et disparaît en Prisma 7. Le poser ici dès maintenant évite de laisser une
 * alerte au démarrage de chaque commande — une alerte qu'on finit par ne plus
 * lire, y compris le jour où elle dit autre chose.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
