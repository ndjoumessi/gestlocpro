import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `railway.json` EST PARTAGÉ PAR DEUX SERVICES, ET C'EST TOUT LE DANGER.
 *
 * Il est à la RACINE du dépôt, et deux services Railway construisent ce même
 * dépôt : `gestlocpro`, qui sert le produit en continu, et `relances`, une
 * tâche planifiée qui passe une fois par jour et s'arrête. Ce qu'on écrit ici
 * s'applique aux DEUX, sans qu'aucun ne le demande.
 *
 * ═══ CE QU'UN `cronSchedule` FERAIT ICI ═══
 *
 * Railway ne distingue pas un service planifié par sa nature mais par ce
 * réglage : poser un `cronSchedule` CONVERTIT un service en tâche planifiée.
 * Écrit dans ce fichier, il convertirait aussi le service WEB — le produit
 * cesserait d'être servi entre deux passages, c'est-à-dire presque toujours.
 *
 * La planification des relances vit donc dans les réglages de SON service, et
 * nulle part ici. C'est le seul endroit qui ne s'applique qu'à lui.
 *
 * ═══ ET UNE ÉCHÉANCE QUI NE S'ANNONCERA PAS TOUTE SEULE ═══
 *
 * La documentation de Railway porte, depuis peu : « Config as Code is
 * deprecated […] Existing `railway.json` / `railway.toml` files continue to
 * work for services that already use them until 2026-12-01 (hard cutoff). »
 *
 * Passé cette date, ce fichier cesse d'être lu SANS RIEN CASSER DE VISIBLE : le
 * déploiement retombe sur les réglages du tableau de bord, qui disent
 * aujourd'hui `RAILPACK`. Or ce dépôt se construit par `Dockerfile`, et
 * l'en-tête du Dockerfile explique pourquoi — son prédécesseur a échoué deux
 * fois, pour deux raisons nommées. Un constructeur qui n'a JAMAIS bâti ce dépôt
 * prendrait la relève un matin de décembre, sans que personne ait rien poussé.
 *
 * Le successeur est `.railway/railway.ts` (Infrastructure as Code), et la
 * migration touche la façon dont la PRODUCTION se construit : elle se décide,
 * elle ne se glisse pas dans un lot du soir. Ce cas la réclame un mois avant
 * l'échéance, pour qu'elle soit décidée et non subie.
 */
const RACINE = join(import.meta.dirname, '..', '..')
const config = JSON.parse(readFileSync(join(RACINE, 'railway.json'), 'utf8')) as {
  build?: { builder?: string; dockerfilePath?: string }
  deploy?: Record<string, unknown>
}

describe('la configuration de déploiement, partagée par les deux services', () => {
  it('ne planifie RIEN : un cron ici convertirait aussi le service web', () => {
    expect(
      Object.keys(config.deploy ?? {}),
      'la planification vit dans les réglages du service « relances », jamais ici',
    ).not.toContain('cronSchedule')
  })

  it('ne fixe pas de commande de démarrage : les deux services n’en lancent pas la même', () => {
    /* Le web sert l'API, `relances` exécute un script et s'arrête. Une commande
       commune en écraserait forcément une des deux. */
    expect(Object.keys(config.deploy ?? {})).not.toContain('startCommand')
  })

  it('désigne un Dockerfile qui existe', () => {
    /* Un constructeur qui pointe un fichier absent ne se voit qu'au déploiement
       suivant, c'est-à-dire au pire moment. */
    expect(config.build?.builder).toBe('DOCKERFILE')
    expect(existsSync(join(RACINE, config.build?.dockerfilePath ?? 'Dockerfile'))).toBe(true)
  })

  it('est migré avant l’arrêt du 2026-12-01', () => {
    /* UN MOIS DE MARGE, délibérément : la migration change la construction de
       la production, et se décide de jour, pas la veille de l'échéance. */
    const rappel = new Date('2026-11-01T00:00:00Z')
    expect(
      new Date() < rappel,
      'Config as Code s’arrête le 2026-12-01 : migrer vers `.railway/railway.ts`, ' +
        'sans quoi la production retombera sur le constructeur du tableau de bord (RAILPACK), ' +
        'qui n’a jamais bâti ce dépôt.',
    ).toBe(true)
  })
})
