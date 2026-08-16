import 'node:process'
import { defineConfig } from 'prisma/config'

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
