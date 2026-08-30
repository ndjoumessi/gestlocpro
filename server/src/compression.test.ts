import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * CE QUI PART SUR LE FIL EST COMPRESSÉ, ou le marché visé paie la différence.
 *
 * ═══ LE DÉFAUT, MESURÉ LE 2026-08-30 ═══
 *
 * `app.ts` sert le client construit par `express.static`, et rien ne le
 * compressait. Ni intergiciel, ni mandataire dans le `Dockerfile`, ni en-tête
 * `Content-Encoding` nulle part. Le paquet partait donc BRUT, et voici ce que
 * cela coûtait sur la construction du jour :
 *
 *   JS de la vitrine        426 674 o  ->  142 284 gzippés   (−284 390)
 *   feuille de style         71 435 o  ->   13 146           ( −58 289)
 *   index.html                6 977 o  ->    3 390           (  −3 587)
 *   JS de l'espace applicatif 227 189 o ->   59 980           (−167 209)
 *
 * La vitrine seule passe de 505 086 à 158 820 octets : **environ sept secondes
 * de moins à 400 kb/s**, le débit que tout ce dépôt retient comme profil du
 * marché visé. Aucune autre garde de ce dépôt ne déplace un tel nombre.
 *
 * ═══ POURQUOI PERSONNE NE L'AVAIT VU, ET C'EST LE PLUS INSTRUCTIF ═══
 *
 * Deux gardes pèsent ce produit, et elles pèsent dans DEUX UNITÉS différentes.
 * `BUDGET_PREMIER_CHARGEMENT`, dans `scripts/mesure-ui.mjs`, GZIPPE les
 * fichiers de `dist/` avant de les compter, et rendait donc « 155 430 o
 * compressés, sous le budget » — un relevé exact, d'une compression que
 * personne n'effectuait. `scripts/poids-ecrans.mjs` compte les corps de réponse
 * RÉELS, donc décompressés, et rendait 534 066 o sur la même page.
 *
 * Les deux avaient raison, et le produit tombait dans l'écart : le budget
 * décrivait un monde où l'on compresse, la mesure de poids décrivait le monde
 * réel, et aucune des deux ne pouvait dire que les deux mondes différaient. Une
 * garde qui mesure la bonne chose dans la mauvaise unité ne ment pas — elle
 * rassure, ce qui est pire.
 *
 * ═══ POURQUOI CETTE GARDE VIT ICI, ET NON DANS `scripts/` ═══
 *
 * Les portes du client mesurent `dist/` servi par `vite preview`, qui n'est pas
 * le serveur de production. Elles ne peuvent donc RIEN dire de la compression :
 * mesurer la compression du serveur de prévisualisation apprendrait ce que fait
 * un outil de développement. Le seul endroit d'où cette question se pose est
 * celui qui répond aux vraies requêtes.
 *
 * ═══ CE QUE CE FICHIER NE GARDE PAS ═══
 *
 * Le TAUX de compression, jamais : il dépend du contenu, et le verrouiller
 * ferait rougir cette porte le jour où un actif incompressible entre dans le
 * paquet. On garde le FAIT — l'en-tête est là quand le client l'accepte, il
 * n'est pas là quand le client ne l'accepte pas — parce que c'est le fait qui a
 * manqué, pas le taux.
 *
 * Et il ne dit rien de ce qu'un bord de plateforme ajouterait par-dessus. Si
 * Railway compressait déjà, cette garde resterait juste et le gain serait
 * simplement déjà acquis ; elle ne prétend pas savoir ce qui se passe hors de
 * ce processus.
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
 * Même geste que `sante.test.ts`, et pour la même raison : `env.ts` lit
 * `process.env` à l'import, il faut donc réinitialiser le registre de modules
 * pour que le changement soit vu. Le secret est forcé, sans quoi le garde de
 * production refuserait de démarrer sur la valeur d'exemple.
 */
async function appEnProduction(clientDist: string) {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  process.env.CLIENT_DIST = clientDist
  process.env.SESSION_SECRET = 'un-secret-de-test-assez-long-pour-passer'
  const { createApp } = await import('./app.js')
  return createApp()
}

/**
 * Un client construit crédible : un actif au-dessus du seuil de l'intergiciel.
 *
 * `compression` laisse passer sans toucher tout ce qui pèse moins de 1 024
 * octets — comprimer plus petit coûte plus de temps processeur qu'il ne rend
 * d'octets, et ajoute un en-tête plus long que le gain. Un actif de test sous
 * ce seuil rendrait donc cette garde VERTE avec ou sans intergiciel : elle
 * mesurerait le seuil, pas la compression.
 *
 * Le contenu est répétitif A DESSEIN. Ce qu'on garde est le FAIT d'un en-tête,
 * pas un taux ; un contenu qui compresse franchement rend le cas lisible sans
 * rien promettre sur le paquet réel.
 */
function clientDeTest() {
  const dir = mkdtempSync(join(tmpdir(), 'gestlocpro-compression-'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ok</title>')
  writeFileSync(join(dir, 'gros.js'), `/* ${'export const rembourrage = 1;'.repeat(200)} */`)
  return dir
}

describe('compression des réponses en production', () => {
  it('compresse un actif du client quand le navigateur l’accepte', async () => {
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir))
        .get('/gros.js')
        .set('Accept-Encoding', 'gzip')
      expect(reponse.status).toBe(200)
      expect(reponse.headers['content-encoding']).toBe('gzip')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ne compresse pas quand le navigateur ne l’accepte pas', async () => {
    /**
     * L'autre moitié du contrat, et elle n'est pas décorative : un serveur qui
     * compresserait sans regarder `Accept-Encoding` enverrait des octets
     * illisibles à un client qui ne sait pas les décoder. La négociation EST la
     * fonctionnalité ; sans ce cas, la garde ne verrait pas la différence entre
     * « compresse correctement » et « compresse toujours ».
     */
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir))
        .get('/gros.js')
        .set('Accept-Encoding', 'identity')
      expect(reponse.status).toBe(200)
      expect(reponse.headers['content-encoding']).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('compresse aussi les réponses de l’API, pas seulement les fichiers', async () => {
    /**
     * L'intergiciel est posé AVANT les routes, et ce cas est ce qui l'exige.
     *
     * Le posait-on juste avant `express.static` qu'il ne servirait que le
     * client. Or un parc chargé rend des listes de baux, de quittances et de
     * relevés — du JSON, c'est-à-dire ce qui compresse le mieux, et sur le
     * réseau du locataire, pas sur celui du prospect. Ce cas emploie une route
     * d'erreur parce qu'elle ne demande aucune base ; il garde la POSITION de
     * l'intergiciel, pas le poids de cette réponse-là.
     */
    const dir = clientDeTest()
    try {
      const reponse = await request(await appEnProduction(dir))
        .get('/api/nexiste-pas')
        .set('Accept-Encoding', 'gzip')
      expect(reponse.status).toBe(404)
      /* La réponse est minuscule, donc sous le seuil : ce n'est pas l'en-tête
         qu'on lit ici mais la traversée. `vary: accept-encoding` est posé par
         l'intergiciel sur TOUTE réponse qu'il a vue, comprimée ou non — c'est
         la trace qu'il était bien sur le chemin, et c'est aussi ce qui empêche
         un cache partagé de resservir une réponse brute à un client qui
         acceptait le gzip, ou l'inverse. */
      expect(reponse.headers['vary']).toMatch(/accept-encoding/i)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
