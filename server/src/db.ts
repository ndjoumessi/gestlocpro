import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'
import { env } from './env.js'

/**
 * Client Prisma, en un seul exemplaire.
 *
 * Chaque instance ouvre son propre pool de connexions. En développement, le
 * rechargement à chaud recrée le module à chaque sauvegarde : sans ce cache sur
 * l'objet global, on épuise les connexions de PostgreSQL en une dizaine
 * d'éditions, et l'erreur qui suit — « too many clients » — ne désigne pas sa
 * cause.
 */
const global_ = globalThis as unknown as { prisma?: PrismaClient }

/**
 * L'ADAPTATEUR de pilote, obligatoire depuis Prisma 7.
 *
 * Le client n'embarque plus son propre moteur de requêtes : il parle à la base
 * par `node-postgres`, le même pilote que n'importe quel autre code Node. Deux
 * conséquences qui se voient.
 *
 * L'URL arrive par `env`, VALIDÉE, et non par une lecture directe de
 * `process.env` : c'est ce module qui refuse de démarrer en production avec un
 * secret d'exemple, et il n'y a aucune raison que la base échappe à ce contrôle
 * quand tout le reste s'y plie. Prisma, lui, ne lit plus l'environnement du
 * tout — `prisma.config.ts` ne sert qu'aux commandes de migration.
 *
 * Le POOL suit désormais les réglages de `pg` et non ceux de Prisma. Les
 * valeurs par défaut diffèrent entre les deux ; on les laisse telles quelles
 * tant qu'aucune mesure ne dit qu'elles gênent — les régler à l'aveugle
 * remplacerait un défaut connu par un chiffre inventé.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma =
  global_.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') global_.prisma = prisma
