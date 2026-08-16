import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'

/**
 * Le journal doit dire le VRAI chemin.
 *
 * Première version, écrite trop vite : elle lisait `req.path` dans le rappel de
 * fin de réponse. Express réécrit `req.url` à chaque routeur imbriqué pour le
 * rendre relatif au point de montage, et ne le restaure pas toujours à
 * l'identique selon le chemin suivi. Deux routes voisines se journalisaient
 * `/api/api/auth/signup` et `/api/me` — l'une doublée, l'autre amputée.
 *
 * Ce n'est pas un détail cosmétique. Ce journal existe pour situer une panne
 * qu'on ne reproduit pas ; des chemins faux envoient chercher au mauvais
 * endroit, et coûtent plus que l'absence de journal.
 */
const app = createApp()

let lignes: string[]
let espion: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  lignes = []
  espion = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lignes.push(args.join(' '))
  })
})

afterEach(() => espion.mockRestore())

describe('journal des appels d’API', () => {
  it('donne le chemin complet d’une route montée dans un routeur imbriqué', async () => {
    await request(app).get('/api/auth/me')
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatch(/^GET \/api\/auth\/me → 401 \(\d+ ms\)$/)
  })

  it('donne le chemin complet quand la requête est refusée par la validation', async () => {
    // Le cas qui révélait le défaut : la réponse passe par le gestionnaire
    // d'erreurs, et `req.url` n'y est pas dans le même état.
    await request(app).post('/api/auth/signup').send({ email: 'pas-un-email' })
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatch(/^POST \/api\/auth\/signup → 400 \(\d+ ms\)$/)
  })

  it('ne journalise pas le chemin de santé', async () => {
    // Railway l'appelle sans cesse ; le laisser passer noierait tout le reste.
    await request(app).get('/api/health')
    expect(lignes).toEqual([])
  })

  it('retire la chaîne de requête', async () => {
    // Rien ne la lit ici, et c'est le premier endroit où une donnée
    // personnelle s'égare dans un journal que bien plus de gens lisent qu'une
    // base.
    await request(app).get('/api/auth/me?jeton=secret')
    expect(lignes[0]).toContain('/api/auth/me →')
    expect(lignes[0]).not.toContain('secret')
  })
})
