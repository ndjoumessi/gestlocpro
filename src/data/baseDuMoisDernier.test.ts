import { describe, expect, it } from 'vitest'
import { variationDesEncaissements } from './kpis'

/**
 * « LE MOIS DERNIER » DOIT ÊTRE LE MOIS DERNIER.
 *
 * ═══ CE QUE LA BASE ÉTAIT, ET POURQUOI C'ÉTAIT UN PARI ═══
 *
 * La base se prenait à l'AVANT-DERNIÈRE entrée de la série, au motif que la
 * dernière est le mois courant. Ce motif n'est pas une propriété de la donnée :
 * le serveur ne rend que les périodes qui PORTENT une échéance, et aucune
 * n'existe tant que l'appel des loyers n'a pas eu lieu. Or `Park.autoRentCall`
 * naît à `false` sur tout parc — un propriétaire qui n'a pas allumé son
 * automatisme, ou qui a oublié son appel du mois, a une série qui s'arrête
 * AVANT le mois où nous sommes.
 *
 * Relevé sur un parc réel le 2026-10-20 : série d'août et septembre, aucune
 * échéance d'octobre. L'avant-dernière entrée était AOÛT, et la carte affichait
 * « vs. … au même jour LE MOIS DERNIER » au-dessus d'une base vieille de deux
 * mois. Le chiffre était juste, sa phrase était fausse, et rien ne les
 * départageait à l'écran.
 *
 * ═══ CE QUE LA RÈGLE DEVIENT ═══
 *
 * On NOMME le mois cherché — celui qui précède le mois courant — et on le
 * cherche dans la série. Présent, il sert de base ; absent, on ne dit rien.
 * C'est la règle que `variationDesEncaissements` s'était déjà donnée pour
 * `rentToDate` : « ne rien dire est la seule réponse honnête ».
 *
 * L'HORLOGE EST UN PARAMÈTRE, et ces cas la fixent. Une série construite
 * relativement à `new Date()` vieillirait avec la machine qui la joue ; une
 * série écrite en dur sous une horloge réelle vieillirait au mois suivant.
 */

/** Le 20 octobre 2026 — le jour du relevé en production. */
const MAINTENANT = new Date(Date.UTC(2026, 9, 20))

/** `month` est indexé à zéro dans tout le produit : 7 = août. */
const mois = (m: number, rentToDate: number) => ({
  year: 2026,
  month: m,
  rent: rentToDate,
  rentToDate,
})

describe('la base de la comparaison au mois dernier', () => {
  it('prend le mois précédent quand la série s’arrête sur lui', () => {
    /* LE CAS DE PRODUCTION. Août et septembre, rien pour octobre : septembre
       EST le mois dernier, et il est la DERNIÈRE entrée — pas l'avant-dernière.
       La lecture par position rendait août, soit 100. */
    const variation = variationDesEncaissements(
      120,
      [mois(7, 100), mois(8, 200)],
      MAINTENANT,
    )

    expect(variation?.base, 'la base doit être septembre, pas août').toBe(200)
  })

  it('ne dit rien quand le mois précédent manque à la série', () => {
    /* Juin et juillet vus depuis octobre : septembre n'existe nulle part. Une
       base tirée de l'avant-dernière entrée aurait comparé octobre à JUIN sous
       une étiquette qui dit « le mois dernier ». */
    expect(
      variationDesEncaissements(120, [mois(5, 100), mois(6, 200)], MAINTENANT),
      'aucune base n’est préférable à une base qui ment sur son mois',
    ).toBeNull()
  })

  it('prend l’avant-dernière quand la série va jusqu’au mois courant', () => {
    /* L'AUTRE SENS, et c'est le cas nominal : un parc dont l'appel des loyers
       tourne a bien le mois courant en queue de série. Le mois précédent est
       alors l'avant-dernière entrée, et la nouvelle règle doit retomber
       exactement dessus — sans quoi le correctif aurait éteint la carte sur
       tous les parcs qui vont bien. */
    const variation = variationDesEncaissements(
      300,
      [mois(8, 200), mois(9, 150)],
      MAINTENANT,
    )

    expect(variation?.base, 'la base doit être septembre').toBe(200)
    expect(variation?.pourcentage, '300 contre 200').toBe(50)
  })

  it('compare encore quand le mois précédent est la SEULE entrée', () => {
    /* La borne `< 2` était un artefact de la lecture par position : il fallait
       deux entrées pour qu'une avant-dernière existe. Avec le mois NOMMÉ, un
       parc né le mois dernier a tout ce qu'il faut pour être comparé. */
    expect(variationDesEncaissements(120, [mois(8, 200)], MAINTENANT)?.base).toBe(200)
  })

  it('ne dit rien quand la base du mois précédent est absente ou nulle', () => {
    /* Les deux refus que la fonction portait déjà, et que le correctif ne doit
       pas emporter : un serveur plus ancien ne rend pas `rentToDate`, et une
       base à zéro ferait une division par zéro. */
    expect(
      variationDesEncaissements(120, [{ year: 2026, month: 8, rent: 200 }], MAINTENANT),
    ).toBeNull()
    expect(variationDesEncaissements(120, [mois(8, 0)], MAINTENANT)).toBeNull()
  })
})
