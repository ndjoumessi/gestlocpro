import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Le contrôle de santé doit couvrir TOUT ce que le déploiement promet.
 *
 * Un déploiement a été déclaré `SUCCESS` alors que le client avait disparu de
 * l'image : `/api/health` répondait `{ ok: true }` parce que le processus
 * écoutait, et la page d'accueil rendait 500. Personne n'a été prévenu — ni la
 * plateforme, qui a validé la mise en ligne, ni l'utilisateur, qui a passé une
 * demi-heure à croire que son inscription échouait.
 *
 * Un contrôle qui ne couvre qu'une moitié du produit fait pire que rien : il
 * donne le feu vert. Ce fichier vérifie donc la seule chose que ce serveur
 * promet et qui peut manquer sans l'empêcher de démarrer — le client construit.
 */

// `env.ts` charge `.env` à son import ; ce fichier monte l'application AVANT
// que cela n'arrive, et doit donc disposer de `DATABASE_URL` par lui-même.
try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}

const originaux = { ...process.env }

afterEach(() => {
  process.env = { ...originaux }
  vi.resetModules()
})

/**
 * Monte l'application en mode production, avec un client désigné.
 *
 * `env.ts` lit `process.env` à l'import : il faut donc réinitialiser le
 * registre de modules pour que le changement soit vu. Le secret est forcé, sans
 * quoi le garde de production refuserait de démarrer sur la valeur d'exemple —
 * et ce serait un autre test.
 */
async function appEnProduction(clientDist: string) {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  process.env.CLIENT_DIST = clientDist
  process.env.SESSION_SECRET = 'un-secret-de-test-assez-long-pour-passer'
  /* Comme le secret ci-dessus, et pour la même raison : `env.ts` refuse de
     démarrer en production sans dire OÙ le stockage écrit — sans quoi les
     pièces s'écriraient dans un conteneur qui les perd. Un chemin de test
     suffit ici ; ce cas ne stocke rien. */
  process.env.STOCKAGE_RACINE = '/tmp/gestlocpro-stockage-de-test'
  const { createApp } = await import('./app.js')
  return createApp()
}

function repertoire(avecClient: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'gestlocpro-sante-'))
  if (avecClient) writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ok</title>')
  return dir
}

describe('contrôle de santé en production', () => {
  it('est sain quand le client est présent', async () => {
    const dir = repertoire(true)
    try {
      const reponse = await request(await appEnProduction(dir)).get('/api/health')
      expect(reponse.status).toBe(200)
      expect(reponse.body).toEqual({ ok: true })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('est MALADE quand le client manque, même si l’API répond', async () => {
    /**
     * Le cas qui justifie ce fichier, et le défaut exact survenu en production.
     *
     * L'API est parfaitement fonctionnelle ici — c'est bien ce qui rendait la
     * panne invisible. Le déploiement doit malgré tout échouer : servir une API
     * sans son client, c'est servir un site qui rend 500 à la racine.
     */
    const dir = repertoire(false)
    try {
      const app = await appEnProduction(dir)
      const sante = await request(app).get('/api/health')
      expect(sante.status).toBe(503)
      expect(sante.body).toEqual({ ok: false, error: 'client_absent' })

      // L'API, elle, répond normalement : la moitié saine ne doit pas suffire
      // à faire passer le contrôle.
      const api = await request(app).get('/api/inconnu')
      expect(api.status).toBe(404)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('contrôle de santé hors production', () => {
  it('ne réclame pas de client, qui est servi par Vite', async () => {
    // Exiger `dist/` en développement ferait échouer un environnement
    // parfaitement sain : personne n'y construit le client.
    const { createApp } = await import('./app.js')
    const reponse = await request(createApp()).get('/api/health')
    expect(reponse.status).toBe(200)
    expect(reponse.body).toEqual({ ok: true })
  })
})
