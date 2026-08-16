import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'

/**
 * Socle de l'API.
 *
 * Ces cas ne testent aucune fonctionnalité métier : ils gardent les conventions
 * sur lesquelles tout le reste s'appuie. Une API qui rend du HTML sur une route
 * inconnue, ou qui laisse fuir une trace d'exception, casse ses appelants d'une
 * façon qui ne se voit qu'en production.
 */
const app = createApp()

describe('socle', () => {
  it('répond à la sonde de santé', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('rend du JSON, et non du HTML, sur une route inconnue', async () => {
    // Le client désérialise toutes les réponses : une page d'erreur HTML
    // produirait une exception de parsing qui masquerait la vraie cause.
    const res = await request(app).get('/api/nexiste-pas')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/json/)
    expect(res.body).toEqual({ error: 'not_found' })
  })

  it('n’annonce pas la technologie du serveur', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('politique d’origine croisée', () => {
  it('autorise l’origine du client, cookies compris', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    // Sans cet en-tête, le navigateur n'enverrait jamais le cookie de session.
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('refuse une origine étrangère', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://mechant.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('ne répond jamais par un joker quand les cookies sont autorisés', async () => {
    // La spécification interdit `*` avec `credentials: true`, et le navigateur
    // rejette alors la réponse en silence — un défaut qui ne se voit qu'à
    // l'exécution, dans la console du client.
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).not.toBe('*')
  })

  it('termine le préambule sans passer par les routes', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
    expect(res.status).toBe(204)
  })
})
