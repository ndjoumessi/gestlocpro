import { describe, expect, it } from 'vitest'
import { AU_MOINS_LE_DOUBLE, ecartNotable, referenceDuMoisPrecedent } from './ecartDeConsommation'
import type { ConsumptionPoint } from '@/data/portfolio'

/**
 * LA RÈGLE DE L'ÉCART, ÉPROUVÉE SUR SES BORDS.
 *
 * L'écran ne peut montrer qu'un jeu à la fois ; ces cas tiennent les états que
 * la démonstration ne porte pas — la référence à zéro, le trou de calendrier,
 * la bascule exacte au double — et qui sont tous des façons de signaler à tort.
 * Un faux signalement sur cet écran coûte plus cher qu'un silence : il envoie
 * quelqu'un ouvrir un logement pour rien, et la fois d'après on ne le croit
 * plus.
 */

const point = (year: number, month: number, water: number | null, power = water): ConsumptionPoint => ({
  year,
  month,
  water,
  power,
})

describe('la référence du mois précédent', () => {
  it('prend le mois du CALENDRIER, pas le point d’avant dans la série', () => {
    /*
      LE TROU QUI FAIT MENTIR. Février manque. Prendre « le point précédent »
      donnerait janvier comme référence de mars — deux mois d'écart comparés
      comme un seul — et mars paraîtrait doublé alors qu'il ne l'est pas.
      `consommations` pose déjà cette règle en amont ; la contredire ici la
      rendrait fausse une fois sur deux.
    */
    const serie = [point(2026, 0, 12), point(2026, 2, 13)]
    expect(
      referenceDuMoisPrecedent(serie, { year: 2026, month: 2 }, 'water'),
      'janvier a été pris pour la référence de mars, par-dessus un février absent',
    ).toBeNull()
  })

  it('traverse le changement d’année', () => {
    const serie = [point(2025, 11, 20), point(2026, 0, 21)]
    expect(referenceDuMoisPrecedent(serie, { year: 2026, month: 0 }, 'water')).toBe(20)
  })

  it('lit le fluide demandé et non l’autre', () => {
    const serie = [point(2026, 5, 9, 140)]
    expect(referenceDuMoisPrecedent(serie, { year: 2026, month: 6 }, 'power')).toBe(140)
    expect(referenceDuMoisPrecedent(serie, { year: 2026, month: 6 }, 'water')).toBe(9)
  })
})

describe('l’écart notable', () => {
  it('signale au double exactement, et se tait juste en dessous', () => {
    /* LA BASCULE, DES DEUX CÔTÉS. Un seul des deux cas laisserait passer une
       comparaison stricte là où il en faut une large, ou l'inverse. */
    expect(ecartNotable(20, 10), 'le double exact ne se signale pas').not.toBeNull()
    expect(ecartNotable(19.9, 10), 'un écart sous le double se signale').toBeNull()
  })

  it('ne signale rien contre une référence nulle ou absente', () => {
    /*
      UN EMMÉNAGEMENT N'EST PAS UNE FUITE, et c'est le cas le plus fréquent des
      deux : un logement vacant le mois dernier consommait zéro, et toute
      consommation y serait un multiple infini. Sans ce garde, chaque entrée
      dans les lieux allumerait le signal.
    */
    expect(ecartNotable(30, 0)).toBeNull()
    expect(ecartNotable(30, null)).toBeNull()
    expect(ecartNotable(null, 10)).toBeNull()
  })

  it('rend le multiple ET sa référence', () => {
    /* LE MULTIPLE SEUL EST UN NOMBRE FLOTTANT : « ×2,4 » ne se vérifie pas si
       l'écran ne dit pas de quoi. C'est la faute que la pastille du tableau de
       bord a déjà coûtée une fois. */
    expect(ecartNotable(24, 10)).toEqual({ facteur: 2.4, reference: 10 })
  })

  it('n’a pas de seuil caché : le multiple nommé est celui qu’il applique', () => {
    /* Le seuil est EXPORTÉ parce que l'écran l'écrit en toutes lettres. Un
       seuil qui dériverait du libellé rendrait la phrase fausse sans qu'aucun
       cas ne le voie. */
    expect(ecartNotable(10 * AU_MOINS_LE_DOUBLE, 10)).not.toBeNull()
    expect(ecartNotable(10 * AU_MOINS_LE_DOUBLE - 0.01, 10)).toBeNull()
  })
})
