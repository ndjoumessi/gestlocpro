import { describe, expect, it } from 'vitest'
import { PLAFOND_PAR_OBJET_OCTETS } from './contrat.js'

/**
 * LE CHIFFRE MESURÉ EST GARDÉ, PAS SEULEMENT ÉCRIT.
 *
 * Le lot précédent a remplacé une estimation de 8 Mio par 2 Mio pesés sur deux
 * photographies CC0. Une mutation l'a aussitôt désigné : porter la constante à
 * 64 Mio laissait TOUTE la suite verte. Cinq références au plafond existaient,
 * et les cinq raisonnaient en `PLAFOND` ou `PLAFOND + 1` — elles suivaient donc
 * la valeur au lieu de la tenir. La frontière n'était ancrée nulle part, et un
 * chiffre mesuré que rien ne garde est à une modification de redevenir une
 * estimation.
 *
 * Ce cas ne garde pas une relation, il garde une VALEUR. Il est délibérément
 * fragile : il doit casser quand on déplace le plafond, et son message dit
 * alors quoi faire. C'est sa fragilité qui est utile — un cas qui survivrait au
 * déplacement ne garderait rien.
 *
 * L'ancrage en octets RÉELS, lui, est dans `local.test.ts` : la constante y est
 * confrontée au poids d'un transcodage mesuré et à celui d'un original
 * d'appareil, tous deux écrits en clair.
 */
const RECOMMENCE_LE_RELEVE =
  'Ce chiffre vient d’un relevé sur deux photographies CC0 — si tu le changes, ' +
  'refais la mesure (scripts/mesure-compression-photo.mjs) et récris le tableau ' +
  'du commentaire de PLAFOND_PAR_OBJET_OCTETS. Ne le déplace pas à vue.'

describe('le plafond par objet', () => {
  it('vaut exactement les 2 Mio du relevé', () => {
    expect(PLAFOND_PAR_OBJET_OCTETS, RECOMMENCE_LE_RELEVE).toBe(2 * 1024 * 1024)
  })

  /**
   * LES DEUX BORNES DU RELEVÉ, écrites en octets et non en multiples.
   *
   * Le pire cas mesuré est 627 Kio (façade, 2048 px, q0,90) et la cible
   * recommandée plafonne à 306 Kio (1600 px, q0,82). Le plafond doit couvrir
   * largement le premier sans devenir un seau où l'on déverse : ces deux
   * inégalités disent le rapport que le relevé a arbitré, et elles rougiraient
   * aussi bien si l'on serrait le plafond sous la mesure que si on le relâchait
   * au point qu'il ne borne plus rien.
   */
  it('couvre le pire transcodage mesuré, sans ouvrir un seau', () => {
    const PIRE_CAS_MESURE_OCTETS = 627 * 1024
    const CIBLE_RECOMMANDEE_OCTETS = 306 * 1024

    expect(PLAFOND_PAR_OBJET_OCTETS).toBeGreaterThan(PIRE_CAS_MESURE_OCTETS * 3)
    expect(PLAFOND_PAR_OBJET_OCTETS, RECOMMENCE_LE_RELEVE).toBeLessThan(
      CIBLE_RECOMMANDEE_OCTETS * 10,
    )
  })
})
