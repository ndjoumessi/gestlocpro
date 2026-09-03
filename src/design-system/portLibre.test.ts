/**
/**
 * ON ÉPROUVE LE VERDICT, PAS `fetch`.
 *
 * La première rédaction ouvrait un vrai port, le fermait, et regardait ce que
 * l'instrument en disait. Elle échouait — et j'ai cru successivement tenir un
 * défaut de l'instrument, puis un effet du disque saturé. C'était
 * l'ENVIRONNEMENT : sous jsdom, un `fetch` vers un port fermé ne se comporte
 * pas comme sous Node, et cette suite tourne sous jsdom.
 *
 * Ce comportement-là appartient à Node, pas à ce dépôt. Ce qui nous appartient
 * est la DÉCISION — répond, on refuse ; ne répond pas, on passe — et une sonde
 * injectée la met à l'épreuve dans les deux sens, sans socket.
 */
import { describe, expect, it } from 'vitest'
// @ts-expect-error — script Node en JavaScript, hors du projet TypeScript.
import { exigerUnPortLibre } from '../../scripts/port-libre.mjs'

/**
 * UNE PORTE NE MESURE PAS UN SERVEUR QU'ELLE N'A PAS LANCÉ.
 *
 * ═══ CE QUE L'ABSENCE DE CE CONTRÔLE A COÛTÉ ═══
 *
 * `espace-connecte.mjs` démarre son propre serveur puis attend qu'une adresse
 * réponde. Il ne vérifiait pas que le port était LIBRE. Un serveur orphelin
 * d'un passage précédent y répondait donc à sa place : le fils mourait en
 * silence sur `EADDRINUSE` — `stdio: 'ignore'` —, le `fetch` réussissait contre
 * l'intrus, et la porte rendait VERT sur du code vieux de trois heures.
 *
 * Mesuré le 2026-09-03 : un orphelin de 3 h 43 tenait le port 4197. Toutes les
 * exécutions de cette porte, ce matin-là, ont été vertes à tort. Le premier
 * passage contre un serveur frais a immédiatement trouvé un vrai défaut de
 * produit, que ces verts avaient caché.
 *
 * ═══ POURQUOI CE CONTRÔLE-CI ET PAS UN AUTRE ═══
 *
 * Surveiller la mort du fils NE SUFFIT PAS, et ses frères le documentent : la
 * réponse de l'intrus arrive avant que la mort ne remonte. « Le seul contrôle
 * qui ne court pas est celui qui précède. »
 *
 * ═══ POURQUOI UN MODULE, ET NON UNE HUITIÈME COPIE ═══
 *
 * Le motif est recopié dans SEPT scripts. Une copie ne s'éprouve pas — elle se
 * relit, et une garde de forme casse au premier remaniement sans rien dire du
 * comportement. Celui-ci s'exécute : on occupe un port, et l'on regarde ce
 * qu'il fait.
 */

const REPOND = async () => ({ ok: true })
const NE_REPOND_PAS = async () => {
  throw new Error('ECONNREFUSED')
}

describe('l’exigence d’un port libre', () => {
  it('REFUSE quand quelque chose répond déjà', async () => {
    await expect(
      exigerUnPortLibre('porte-de-sonde', 'http://127.0.0.1:4197', 4197, REPOND),
    ).rejects.toThrow(/répond déjà/)
  })

  it('nomme la porte ET le geste qui identifie l’intrus', async () => {
    /* Un refus qui dit seulement « port occupé » laisse chercher. Celui-ci
       donne la commande — c'est ainsi qu'on a trouvé l'orphelin de 3 h 43. */
    const erreur = await exigerUnPortLibre('porte-de-sonde', 'http://127.0.0.1:4197', 4197, REPOND)
      .then(() => null)
      .catch((e: Error) => e)
    expect(erreur?.message).toContain('porte-de-sonde')
    expect(erreur?.message).toContain('lsof -nP -iTCP:4197')
  })

  it('laisse passer quand rien ne répond', async () => {
    /* Le sens inverse, et il compte autant : une exigence qui refuse TOUJOURS
       arrêterait toutes les portes, et l'on retirerait l'exigence plutôt que
       l'intrus. */
    await expect(
      exigerUnPortLibre('porte-de-sonde', 'http://127.0.0.1:4197', 4197, NE_REPOND_PAS),
    ).resolves.toBeUndefined()
  })
})
