import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rendreLEnvironnementIntact } from './test/environnementRendu.js'

/**
 * UN FICHIER DONT LE NOM CHANGE AVEC SON CONTENU NE SE REVALIDE JAMAIS.
 *
 * La police des titres vit sous `/polices/`, nommée avec sa version : un
 * contenu neuf porte un nom neuf, donc une adresse neuve. Relevé sur la
 * production le 2026-09-07 : elle partait avec `max-age=3600`, la valeur que
 * `express.static` pose sur TOUT `dist/`. Un navigateur sans agent de service
 * — première visite, navigation privée, agent refusé — la redemandait donc
 * chaque heure pour s'entendre répondre 304 : un aller-retour entier vers
 * l'origine, sur le réseau visé, pour vingt-sept kilo-octets qui ne peuvent
 * pas avoir changé.
 *
 * `immutable` dit au navigateur de ne pas revalider, même sur un rechargement
 * demandé ; un an est la borne haute que les navigateurs honorent. La promesse
 * ne tient que si le nom bouge avec le contenu — c'est ce que garde
 * `policeAutoHebergee.test.ts` côté client, sur le fichier réel.
 *
 * `/assets/` suit, pour la même raison : Vite y range le code et la feuille de
 * style sous un nom haché d'après leur contenu (`index-RA4dXI1m.js`), et
 * `index.html` — lui revalidé — pointe toujours vers le nom du jour. Un
 * déploiement produit des noms neufs ; les anciens ne changent jamais.
 *
 * ═══ CE QU'ON NE GARDE PAS ═══
 *
 * Tout ce qui vit à la RACINE de `dist/` reste revalidable : `index.html`, le
 * seul fichier dont le nom ne change jamais et dont le contenu change à chaque
 * déploiement ; `sw.js`, l'agent de service, dont un exemplaire figé un an
 * servirait d'anciens actifs à jamais ; le manifeste et les icônes, sans
 * hachage. Rendre `index.html` immuable figerait un client périmé pour un an.
 * Les cas ci-dessous tiennent cette limite pour qu'un élargissement de la
 * règle ne passe pas sans être vu.
 */

try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}

rendreLEnvironnementIntact()

async function appEnProduction(clientDist: string) {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  process.env.CLIENT_DIST = clientDist
  process.env.SESSION_SECRET = 'un-secret-de-test-assez-long-pour-passer'
  process.env.STOCKAGE_RACINE = '/tmp/gestlocpro-stockage-de-test'
  const { createApp } = await import('./app.js')
  return createApp()
}

function clientDeTest() {
  const dir = mkdtempSync(join(tmpdir(), 'gestlocpro-cache-'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ok</title>')
  writeFileSync(join(dir, 'sw.js'), 'self.addEventListener("fetch", () => {})')
  mkdirSync(join(dir, 'polices'))
  writeFileSync(join(dir, 'polices', 'titres-v12-latin.woff2'), 'wOF2 pas vraiment une police')
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'assets', 'index-RA4dXI1m.js'), 'export const paquet = 1')
  return dir
}

describe('le cache des actifs servis en production', () => {
  it('rend une police immuable pour un an', async () => {
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir)).get('/polices/titres-v12-latin.woff2')
      expect(reponse.status).toBe(200)
      expect(reponse.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rend un actif haché par Vite immuable pour un an', async () => {
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir)).get('/assets/index-RA4dXI1m.js')
      expect(reponse.status).toBe(200)
      expect(reponse.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('laisse l’agent de service revalidable', async () => {
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir)).get('/sw.js')
      expect(reponse.status).toBe(200)
      expect(reponse.headers['cache-control']).not.toContain('immutable')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('laisse index.html revalidable', async () => {
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir)).get('/index.html')
      expect(reponse.status).toBe(200)
      expect(reponse.headers['cache-control']).not.toContain('immutable')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
