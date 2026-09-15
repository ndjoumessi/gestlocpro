import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '../db.js'

/**
 * UNE SESSION NE GARDE PLUS D'ADRESSE IP.
 *
 * `Session.ipAddress` était rempli par `req.ip` à chaque connexion, et rien ne le
 * lisait — ni écran, ni limitation de tentatives. Relevé le 2026-09-15 dans les
 * journaux HTTP de Railway : les requêtes réelles arrivent toutes d'adresses AWS
 * de Paris, celles du relais `gestlocpro.vercel.app`. L'adresse gardée était donc
 * celle de Vercel pour presque tout le monde : une donnée personnelle FAUSSE, et
 * inutilisée. La lire juste aurait demandé de croire un en-tête que n'importe qui
 * peut forger en appelant le domaine Railway en direct.
 *
 * Nelson a choisi le 2026-09-15 de ne plus la collecter (minimisation, RGPD
 * art. 5). La colonne est retirée par migration, avec ce qu'elle contenait.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'generated' ? [] : sources(chemin)
    return nom.endsWith('.ts') && !nom.endsWith('.test.ts') ? [chemin] : []
  })
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('la session sans adresse IP', () => {
  it('n’a plus de colonne pour la ranger', async () => {
    const colonnes = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'Session'`
    const noms = colonnes.map((c) => c.column_name)
    expect(noms, 'la lecture du schéma est cassée, pas le produit').toContain('userAgent')
    expect(noms).not.toContain('ipAddress')
  })

  it('ne lit l’adresse du client nulle part dans le serveur', () => {
    const fautifs = sources(SRC).filter((f) => /\breq\.ips?\b|x-forwarded-for|x-real-ip/i.test(readFileSync(f, 'utf8')))
    expect(fautifs).toEqual([])
  })
})
