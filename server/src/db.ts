import { PrismaClient } from '@prisma/client'

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

export const prisma =
  global_.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') global_.prisma = prisma
