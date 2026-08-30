import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rendreLEnvironnementIntact } from './test/environnementRendu.js'

try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}

/* Voir `test/environnementRendu.ts` : la photographie se prend par CAS, et non
   au chargement du fichier, sans quoi elle capture l'état laissé par celui qui
   précède — les fichiers de cette suite tournent dans le même processus. */
rendreLEnvironnementIntact()

async function appAvecClient(html: string | null) {
  const dir = mkdtempSync(join(tmpdir(), 'gestlocpro-version-'))
  if (html !== null) writeFileSync(join(dir, 'index.html'), html)
  vi.resetModules()
  process.env.CLIENT_DIST = dir
  const { createApp } = await import('./app.js')
  return { app: createApp(), dir }
}

/**
 * La version annoncée est le NOM du paquet servi.
 *
 * Une application React ne recharge pas son code en naviguant : un onglet
 * ouvert avant un déploiement garde le sien indéfiniment. Une après-midi
 * entière a été perdue à cela — plusieurs allers-retours ont porté sur du code
 * déjà remplacé, corrigé et déployé.
 *
 * Le nom haché par Vite fait une version exacte que personne n'a à tenir à
 * jour. Un numéro écrit à la main aurait fini par mentir.
 */
describe('version servie', () => {
  it('rend le nom du paquet lu dans index.html', async () => {
    const { app, dir } = await appAvecClient(
      '<!doctype html><script type="module" src="/assets/index-AbC123_x.js"></script>',
    )
    try {
      const reponse = await request(app).get('/api/version')
      expect(reponse.status).toBe(200)
      expect(reponse.body).toEqual({ paquet: 'index-AbC123_x.js' })
      // Jamais mis en cache : une réponse gardée une heure annoncerait
      // l'ancienne version pendant une heure — l'inverse du service rendu.
      expect(reponse.headers['cache-control']).toContain('no-store')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rend null quand il n’y a pas de client construit', async () => {
    // Développement, ou déploiement incomplet. On ne conclut pas : annoncer une
    // mise à jour inexistante userait l'avertissement, et un avertissement usé
    // ne se lit plus.
    const { app, dir } = await appAvecClient(null)
    try {
      const reponse = await request(app).get('/api/version')
      expect(reponse.status).toBe(200)
      expect(reponse.body).toEqual({ paquet: null })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rend null plutôt que de deviner quand le html ne porte pas de paquet', async () => {
    const { app, dir } = await appAvecClient('<!doctype html><title>sans script</title>')
    try {
      expect((await request(app).get('/api/version')).body).toEqual({ paquet: null })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
