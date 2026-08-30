import { describe, expect, it } from 'vitest'
import {
  LONGUEUR_MINIMALE_DU_MOT_DE_PASSE,
  scorePassword,
  validatePassword,
} from './validation'

/**
 * LA JAUGE ET LE REFUS DOIVENT TOMBER AU MÊME ENDROIT.
 *
 * ═══ CE QUI POUVAIT DÉRIVER ═══
 *
 * Deux fonctions décidaient de la même frontière avec deux littéraux :
 * `validatePassword` refusait sous huit caractères, `scorePassword` rendait 0
 * sous huit caractères, chacun avec son propre `8`. L'équivalence tenait par
 * coïncidence. Le jour où l'un des deux seuils aurait bougé, la jauge aurait
 * peint en ROUGE un mot de passe accepté — ou pire, en AMBRE un mot de passe
 * refusé, c'est-à-dire promis un passage qui n'aurait pas eu lieu.
 *
 * Rien ne l'aurait dit : les deux fonctions sont justes séparément, et aucun
 * écran ne compare leurs verdicts.
 *
 * ═══ CE QUE CE FICHIER EXIGE ═══
 *
 * L'équivalence elle-même, sur toute la plage utile, et non sur un échantillon.
 * `scorePassword(v) === 0` doit valoir exactement « `validatePassword` refuse ».
 * C'est ce qui autorise le premier niveau à s'appeler « Trop court » et à porter
 * le rouge : le rouge est une BARRIÈRE, pas un degré.
 *
 * ═══ CE QU'IL NE GARDE PAS ═══
 *
 * Que la jauge soit un bon conseil. Les niveaux 1 à 3 n'engagent rien — douze
 * caractères et la variété des classes de caractères ne conditionnent aucun
 * refus, et ce fichier ne prétend pas qu'ils devraient. Il tient la frontière,
 * et elle seule.
 */

/** Bien au-delà du seuil, pour que la plage couvre les deux côtés largement. */
const LONGUEUR_MAX_SONDEE = LONGUEUR_MINIMALE_DU_MOT_DE_PASSE * 2 + 4

describe('la jauge et le refus', () => {
  it('tombent au même caractère, sur toute la plage', () => {
    const desaccords: string[] = []
    for (let n = 0; n <= LONGUEUR_MAX_SONDEE; n++) {
      const valeur = 'a'.repeat(n)
      const auRouge = scorePassword(valeur) === 0
      const refuse = validatePassword(valeur, { requireStrong: true }) !== null
      if (auRouge !== refuse) {
        desaccords.push(`${n} car : jauge ${auRouge ? 'rouge' : 'verte'}, règle ${refuse ? 'refuse' : 'accepte'}`)
      }
    }
    expect(desaccords, desaccords.join(' · ')).toEqual([])
  })

  /*
    GARDE DU GARDE — la plage doit contenir la frontière.

    Une boucle qui ne sonderait que des longueurs acceptées, ou que des
    longueurs refusées, comparerait deux constantes et se déclarerait verte.
    On exige donc que les DEUX verdicts aient été vus.
  */
  it('a bien vu les deux côtés de la frontière', () => {
    const verdicts = new Set<boolean>()
    for (let n = 0; n <= LONGUEUR_MAX_SONDEE; n++) {
      verdicts.add(scorePassword('a'.repeat(n)) === 0)
    }
    expect(verdicts, 'la plage sondée ne traverse pas la frontière').toEqual(new Set([true, false]))
  })

  it('ne met au rouge que ce qui est refusé, jamais un mot de passe accepté', () => {
    /* Le cas qui compte le plus : juste au-dessus du seuil, sans aucune
       variété — le mot de passe le plus pauvre que la règle laisse passer. Il
       ne doit PAS porter la couleur du refus. */
    const juste = 'a'.repeat(LONGUEUR_MINIMALE_DU_MOT_DE_PASSE)
    expect(validatePassword(juste, { requireStrong: true })).toBeNull()
    expect(scorePassword(juste)).toBeGreaterThan(0)
  })
})
