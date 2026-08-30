import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import request from 'supertest'
import { createApp } from '../app.js'
import { PARITE_FRANC_CFA, creerServiceDeTaux, type Devise, type SourceDeTaux } from './taux.js'

/**
 * LES TAUX, ET CE QUI DOIT ÊTRE VRAI D'EUX.
 *
 * ═══ AUCUN CAS N'APPELLE L'EXTÉRIEUR ═══
 *
 * La source est injectée. Un cas qui interrogerait la Banque centrale
 * européenne échouerait le jour où elle est en panne, un dimanche, ou derrière
 * un pare-feu d'intégration continue — et l'on chercherait le défaut dans le
 * produit. Ce que ces cas mesurent est la LOGIQUE : la parité légale, le cache,
 * et ce qui reste quand le flux tombe.
 *
 * ═══ LA PARITÉ N'EST PAS UN COURS ═══
 *
 * Le franc CFA est arrimé à l'euro par traité : 655,957, exact et permanent. Il
 * ne vient d'aucun flux et ne périme pas. C'est la moitié de la réponse qui doit
 * survivre à toute panne, et c'est celle qui sert le marché visé.
 */

/** Une source qu'on pilote : ce qu'elle rend, et combien de fois on l'a lue. */
function sourceFeinte(reponse: (() => Promise<{ date: string; parEuro: Partial<Record<Devise, number>> }>)) {
  let lectures = 0
  const source: SourceDeTaux = {
    lire: () => {
      lectures++
      return reponse()
    },
  }
  return { source, lectures: () => lectures }
}

const COURS = { date: '2026-08-28', parEuro: { CAD: 1.613, USD: 1.1643 } }

describe('le service de taux', () => {
  it('pose la parité légale du franc CFA sans rien demander', async () => {
    const { source } = sourceFeinte(async () => {
      throw new Error('flux indisponible')
    })
    const taux = await creerServiceDeTaux(source).lire()

    expect(taux.parEuro.XAF).toBe(PARITE_FRANC_CFA)
    expect(taux.parEuro.XOF).toBe(PARITE_FRANC_CFA)
    expect(taux.parEuro.EUR).toBe(1)
  })

  it('dit l’absence de cours au lieu d’en inventer', async () => {
    const { source } = sourceFeinte(async () => {
      throw new Error('flux indisponible')
    })
    const taux = await creerServiceDeTaux(source).lire()

    /* `date: null` EST la réponse. Servir un cours sans pouvoir dire de quand il
       date laisserait un montant converti se faire passer pour à jour. */
    expect(taux.date).toBeNull()
    expect(taux.parEuro.CAD).toBeUndefined()
    expect(taux.parEuro.USD).toBeUndefined()
  })

  it('sert les cours flottants avec leur date', async () => {
    const { source } = sourceFeinte(async () => COURS)
    const taux = await creerServiceDeTaux(source).lire()

    expect(taux.date).toBe('2026-08-28')
    expect(taux.parEuro.CAD).toBe(1.613)
    expect(taux.parEuro.USD).toBe(1.1643)
  })

  it('ne redemande pas les cours à chaque lecture', async () => {
    const { source, lectures } = sourceFeinte(async () => COURS)
    let horloge = 0
    const service = creerServiceDeTaux(source, () => horloge)

    await service.lire()
    await service.lire()
    expect(lectures(), 'le cache ne retient rien').toBe(1)

    // Une heure plus tard : la BCE a pu publier.
    horloge = 60 * 60 * 1000 + 1
    await service.lire()
    expect(lectures(), 'le cache ne se périme jamais').toBe(2)
  })

  /**
   * UNE PANNE NE SE MET PAS EN CACHE POUR UNE HEURE.
   *
   * Sinon le premier chargement après un incident réseau prive le produit de
   * conversion pendant une heure entière, alors que le flux est peut-être revenu
   * la seconde d'après.
   */
  it('réessaie vite après une panne, et pas après un succès', async () => {
    let tombe = true
    const { source, lectures } = sourceFeinte(async () => {
      if (tombe) throw new Error('flux indisponible')
      return COURS
    })
    let horloge = 0
    const service = creerServiceDeTaux(source, () => horloge)

    await service.lire()
    horloge = 61 * 1000
    tombe = false
    const repris = await service.lire()

    expect(lectures()).toBe(2)
    expect(repris.date, 'les cours ne reviennent pas après la panne').toBe('2026-08-28')
  })
})

/**
 * DEUX EXEMPLAIRES D'UNE CONSTANTE, ET RIEN POUR LES TENIR ENSEMBLE.
 *
 * Le client tient désormais la parité lui-même : elle est fixée par traité, et
 * la demander par le réseau ajoutait une panne possible à un nombre qui ne peut
 * pas changer — un poste sans API annonçait « cours indisponibles » pour
 * convertir des francs en euros. Voir `src/currency/pariteSansServeur`.
 *
 * Le prix est une constante écrite deux fois, dans deux paquets sans code
 * commun. Elle ne bougera pas — sa dernière révision date du passage à l'euro —
 * mais une faute de frappe ne prévient pas, et le montant qui en sortirait
 * resterait plausible.
 *
 * LA GARDE VIT ICI parce que ce paquet a les types de Node : lire un fichier
 * depuis un cas jsdom, côté client, ne compile pas. On lit le TEXTE plutôt que
 * d'importer — le module du client est du TSX résolu par un alias que ce
 * paquet-ci ne connaît pas.
 */
describe('la parité, des deux côtés', () => {
  it('vaut chez le client ce qu’elle vaut ici', () => {
    const source = readFileSync(
      new URL('../../../src/currency/currencies.ts', import.meta.url),
      'utf8',
    )
    const declaree = source.match(/PARITE_FRANC_CFA\s*=\s*([\d.]+)/)?.[1]

    expect(declaree, 'la constante a disparu ou changé de nom chez le client').toBeDefined()
    expect(Number(declaree), 'client et serveur ne disent pas la même parité').toBe(
      PARITE_FRANC_CFA,
    )
  })
})

describe('la route des taux', () => {
  it('les sert sans session, avec la parité et les cours', async () => {
    const app = createApp({ taux: { lire: async () => COURS } })
    const reponse = await request(app).get('/api/rates')

    expect(reponse.status).toBe(200)
    expect(reponse.body.date).toBe('2026-08-28')
    expect(reponse.body.parEuro.XAF).toBe(PARITE_FRANC_CFA)
    expect(reponse.body.parEuro.USD).toBe(1.1643)
  })

  it('reste servie quand le flux est tombé', async () => {
    const app = createApp({
      taux: {
        lire: async () => {
          throw new Error('flux indisponible')
        },
      },
    })
    const reponse = await request(app).get('/api/rates')

    /* PAS de 503 : l'absence de cours flottants n'est pas une panne du produit.
       Un parc de la zone franc continue de se lire en euros, et c'est la moitié
       qui sert le marché visé. */
    expect(reponse.status).toBe(200)
    expect(reponse.body.date).toBeNull()
    expect(reponse.body.parEuro.XAF).toBe(PARITE_FRANC_CFA)
  })
})
