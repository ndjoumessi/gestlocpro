import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rendreLEnvironnementIntact } from './test/environnementRendu.js'

/**
 * TOUTE ADRESSE REND LA MÊME COQUILLE — et l'agent de service en dépend.
 *
 * ═══ POURQUOI CETTE GARDE EXISTE ═══
 *
 * `public/sw.js` range le document sous une clé fixe, `CLE_DE_COQUILLE`, et le
 * ressert hors ligne pour n'IMPORTE QUELLE adresse jamais visitée. C'est ce qui
 * fait qu'un gestionnaire descendu dans une cage d'escalier ouvre
 * `/demo/cautions` alors qu'il n'avait ouvert que `/demo/paiements`.
 *
 * Ce repli n'est juste qu'à UNE condition : que le serveur rende le même
 * document pour les deux. C'est le cas aujourd'hui — la règle attrape-tout
 * d'`app.ts` envoie `index.html` pour tout ce qui n'est ni `/api/` ni un actif,
 * et relevé sur la production le 2026-08-30, « / », « /demo/paiements »,
 * « /demo/cautions » et « /app/parc » rendent quatre fois la même empreinte
 * SHA-256.
 *
 * ═══ CE QUI POURRAIT LE ROMPRE, ET NE PRÉVIENDRAIT PAS ═══
 *
 * Une méta par route posée côté serveur — un titre pour le partage, une balise
 * canonique, une pré-hydratation. Le geste est banal et l'effet ne se verrait
 * PAS : en ligne, chaque page resterait juste, puisque le réseau répond. Le
 * défaut n'apparaîtrait que hors ligne, chez un utilisateur, sous la forme d'un
 * titre appartenant à un autre écran. Aucune porte au navigateur ne coupe le
 * réseau ; celle-ci garde donc la PRÉMISSE plutôt que l'effet.
 *
 * ═══ CE QU'ELLE NE DIT PAS ═══
 *
 * Que la page s'ouvre hors ligne. Elle dit que le document servi est unique.
 * L'agent lui-même n'est pas éprouvé ici — son routage l'est par
 * `src/design-system/agentDeService.test.ts`, sans navigateur.
 */

// `env.ts` charge `.env` à son import ; ce fichier monte l'application AVANT
// que cela n'arrive, et doit donc disposer de `DATABASE_URL` par lui-même.
try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}

/* Voir `test/environnementRendu.ts` : la photographie se prend par CAS, et non
   au chargement du fichier, sans quoi elle capture l'état laissé par celui qui
   précède — les fichiers de cette suite tournent dans le même processus. */
rendreLEnvironnementIntact()

/** Même geste que `compression.test.ts`, et pour la même raison. */
async function appEnProduction(clientDist: string) {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  process.env.CLIENT_DIST = clientDist
  process.env.SESSION_SECRET = 'un-secret-de-test-assez-long-pour-passer'
  process.env.STOCKAGE_RACINE = '/tmp/gestlocpro-stockage-de-test'
  const { createApp } = await import('./app.js')
  return createApp()
}

/**
 * Le document porte un MARQUEUR UNIQUE par montage.
 *
 * Comparer deux réponses vides passerait quoi qu'il arrive. Le marqueur fait que
 * l'égalité constatée dit « c'est le même fichier », et non « les deux sont
 * également vides ».
 */
function clientDeTest() {
  const dir = mkdtempSync(join(tmpdir(), 'gestlocpro-coquille-'))
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html><title>coquille</title><meta name="marqueur" content="${Math.random()}" />`,
  )
  return dir
}

/** Les familles d'adresses du produit : vitrine, démonstration, applicatif. */
const ADRESSES = ['/', '/demo', '/demo/paiements', '/demo/cautions', '/app/parc', '/connexion']

describe('la coquille servie', () => {
  it('est le MÊME document pour toutes les adresses d’écran', async () => {
    const dir = clientDeTest()
    try {
      const app = await appEnProduction(dir)
      const corps: string[] = []
      for (const adresse of ADRESSES) {
        const reponse = await request(app).get(adresse)
        expect(reponse.status, `${adresse} ne rend pas la coquille`).toBe(200)
        corps.push(reponse.text)
      }
      /* Garde du garde : un document vide rendrait l'égalité triviale. */
      expect(corps[0]!.length, 'la coquille de test est vide').toBeGreaterThan(40)
      for (let i = 1; i < corps.length; i++) {
        expect(
          corps[i],
          `${ADRESSES[i]} rend un document DIFFÉRENT de « / » — le repli hors ligne de ` +
            '`sw.js` servirait alors le mauvais document sur cette adresse',
        ).toBe(corps[0])
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ne rend PAS la coquille sous `/api/`', async () => {
    /* La contrepartie exacte : si l'API rendait le document, l'agent de service
       en cacherait un état de parc, et un loyer encaissé qui ne l'est plus se
       lirait hors ligne. `strategiePour` l'exclut déjà ; on garde ici que le
       serveur ne l'y invite pas non plus. */
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir)).get('/api/adresse-inconnue')
      expect(reponse.status).toBe(404)
      expect(reponse.type).toBe('application/json')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
