import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * CE SERVEUR COMPRESSE, QUEL QUE SOIT CE QUI LE PRÉCÈDE.
 *
 * ═══ CE QUE CE FICHIER GARDE, ET CE QU'IL NE PROUVE PAS ═══
 *
 * Il garde une propriété de CE PROCESSUS : une réponse assez grosse et
 * compressible part encodée quand le client l'accepte, et brute quand il ne
 * l'accepte pas. Il ne prouve RIEN sur ce qu'un visiteur reçoit — entre les
 * deux il y a un bord, un cache, un domaine, dont ce dépôt ne sait rien.
 *
 * LA DISTINCTION A ÉTÉ PAYÉE. Ces cas ont d'abord été écrits sur le constat
 * qu'« aucune compression n'existait », tiré de la lecture d'`app.ts` et du
 * `Dockerfile`. Le constat valait pour le processus et pas pour le site :
 * relevé sur la production le 2026-08-30, `railway-hikari` gzippait déjà,
 * 380 925 octets de JavaScript partant à 121 310. Lire le code ne dit pas ce
 * que reçoit l'utilisateur ; seule une requête vers l'adresse servie le dit.
 *
 * ═══ POURQUOI CETTE GARDE VAUT MALGRÉ TOUT ═══
 *
 * Parce que la propriété qu'elle tient est justement celle qui n'existait pas :
 * la compression du site reposait entièrement sur un comportement de bord que
 * rien ne configure et que rien ne garde. Un hébergeur qui change, un bord qui
 * cesse, et le site triple de poids en silence. Ces trois cas font de la
 * compression une propriété du dépôt plutôt qu'une propriété de la plateforme.
 *
 * ═══ POURQUOI ICI, ET NON DANS `scripts/` ═══
 *
 * Les portes du client mesurent `dist/` servi par `vite preview`, qui n'est pas
 * ce serveur : elles ne peuvent rien dire de sa compression. Et une porte qui
 * interrogerait la production ferait dépendre `npm run check` d'un réseau et
 * d'un déploiement — le défaut que `plafond-vitrine.mjs` vient de fermer pour
 * les polices. Le seul endroit d'où cette question se pose sans rien emprunter
 * au dehors est le processus lui-même.
 *
 * ═══ CE QU'ON NE GARDE PAS ═══
 *
 * Le TAUX, jamais : il dépend du contenu, et le verrouiller ferait rougir cette
 * porte au premier actif incompressible. On garde le FAIT — l'en-tête est là
 * quand le client l'accepte, absent quand il ne l'accepte pas — parce que c'est
 * le fait qui peut disparaître, pas le taux.
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
  /* Comme le secret ci-dessus, et pour la même raison : `env.ts` refuse de
     démarrer en production sans dire OÙ le stockage écrit — sans quoi les
     pièces s'écriraient dans un conteneur qui les perd. Un chemin de test
     suffit ici ; ce cas ne stocke rien. */
  process.env.STOCKAGE_RACINE = '/tmp/gestlocpro-stockage-de-test'
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
