import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * UNE SEULE ADRESSE : `gestlocpro.vercel.app` RELAIE TOUT VERS RAILWAY.
 *
 * ═══ POURQUOI LE RELAIS EST TOTAL, ET NON PARTIEL ═══
 *
 * La forme précédente était hybride : Vercel servait la vitrine et la
 * démonstration, et renvoyait le reste. Elle ne pouvait pas tenir, et c'est une
 * MESURE qui l'a dit — les deux hôtes rendaient des paquets d'empreintes
 * différentes (`index-BcyMtQDt.js` contre `index-CuVnKUgX.js`). Or un HTML
 * relayé depuis Railway réclame SES fichiers : servis par Vercel, ils
 * n'existent pas. La page casse.
 *
 * Deux hôtes qui construisent séparément ne se déploient jamais à la même
 * seconde. Le relais total supprime la question : tout vient de Railway, y
 * compris le document et ses fichiers, et rien ne peut diverger.
 *
 * ═══ CE QUE VERCEL NE FAIT PLUS ═══
 *
 * Il ne CONSTRUIT plus rien — un paquet que personne ne sert est du gâchis
 * silencieux — et il ne pose plus d'en-têtes : la politique de sécurité vient
 * de Railway avec chaque réponse, et en poser une seconde ferait appliquer
 * l'INTERSECTION des deux, donc une politique que personne n'a écrite.
 *
 * ═══ CE QUE CE FICHIER GARDE ═══
 *
 * La seule chose qui reste à vérifier localement : que la configuration dit
 * bien « tout, vers cet hôte-là ». Le reste appartient au déploiement, et
 * aucune porte de ce dépôt n'interroge un hôte tiers.
 */
const RACINE = join(import.meta.dirname, '../..')

function config() {
  return JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8')) as {
    rewrites: { source: string; destination: string }[]
    headers?: unknown
    redirects?: unknown
  }
}

describe('le relais de la vitrine', () => {
  it('attrape TOUTES les adresses, sans exception', () => {
    /* Une exception — `/assets/`, `/api/` — ferait revivre la divergence des
       empreintes que ce relais existe pour supprimer. */
    const regles = config().rewrites
    expect(regles).toHaveLength(1)
    const motif = new RegExp('^' + regles[0]!.source + '$')
    for (const chemin of ['/', '/connexion', '/demo/parc', '/api/auth/me', '/assets/index-a.js']) {
      expect(motif.test(chemin), `${chemin} doit être relayé`).toBe(true)
    }
  })

  it('conserve le chemin demandé', () => {
    /* `$1` et non une adresse fixe : un relais qui perdrait le chemin
       renverrait tout le monde à l'accueil. */
    expect(config().rewrites[0]!.destination).toMatch(/\/\$1$/)
  })

  it('ne pose NI en-tête NI redirection', () => {
    /* Deux politiques de sécurité sur la même réponse s'appliquent en
       INTERSECTION : le résultat n'est écrit nulle part, et personne ne l'a
       voulu. Railway pose la sienne, Vercel se tait. */
    const c = config()
    expect(c.headers, 'la politique vient de Railway').toBeUndefined()
    expect(c.redirects, 'un relais ne redirige pas — c’est tout son objet').toBeUndefined()
  })
})
