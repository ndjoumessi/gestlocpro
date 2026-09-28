import { describe, expect, it } from 'vitest'
import { ancienneteEnMinutes, duPlusRecent } from './ordreDesAvis'
import type { RelativeStamp } from '@/data/portfolio'

/**
 * LES UNITÉS QUE L'ÉCRAN N'EXERCE PAS.
 *
 * `ordreDesAvis.test.tsx` mesure le tri sur la démonstration, qui ne porte que
 * des minutes, des heures et des jours — `relatif()` n'émet rien d'autre. Le
 * type, lui, autorise la seconde, la semaine, le mois, le trimestre et l'année,
 * AU SINGULIER COMME AU PLURIEL. Une table d'unités qui en oublierait la moitié
 * rendrait `undefined`, et le tri se tairait au lieu de rougir.
 *
 * C'est le genre de trou qu'aucun écran ne montre : il faudrait qu'un serveur
 * se mette à dater en semaines pour qu'on le découvre en production.
 */

const quand = (value: number, unit: string): RelativeStamp =>
  ({ value, unit }) as RelativeStamp

describe('l’ancienneté d’un avis', () => {
  it('range les unités longues les unes après les autres', () => {
    const croissant = [
      quand(-30, 'second'),
      quand(-2, 'minute'),
      quand(-3, 'hour'),
      quand(-2, 'day'),
      quand(-2, 'week'),
      quand(-2, 'month'),
      quand(-2, 'quarter'),
      quand(-2, 'year'),
    ]
    const ages = croissant.map(ancienneteEnMinutes)
    for (let i = 1; i < ages.length; i++) {
      expect(
        ages[i]!,
        `« ${croissant[i]!.unit} » ne se range pas après « ${croissant[i - 1]!.unit} » : la table d’unités les confond`,
      ).toBeGreaterThan(ages[i - 1]!)
    }
  })

  it('accepte le pluriel autant que le singulier', () => {
    /* `Intl.RelativeTimeFormatUnit` admet « days » comme « day ». Une table qui
       n'aurait que le singulier rendrait l'infini sur l'autre moitié des
       valeurs légales, et tous ces avis descendraient au fond ensemble. */
    for (const unite of ['second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']) {
      expect(
        ancienneteEnMinutes(quand(-2, `${unite}s`)),
        `le pluriel « ${unite}s » n’est pas reconnu`,
      ).toBe(ancienneteEnMinutes(quand(-2, unite)))
    }
  })

  it('renvoie au fond ce qu’il ne sait pas dater', () => {
    /* UN AVIS QU'ON NE SAIT PAS DATER NE S'ANNONCE PAS LE PLUS RÉCENT. Rendre
       0 le mettrait en tête de l'écran, à la place exacte où le lecteur cherche
       ce qui vient d'arriver. */
    expect(ancienneteEnMinutes(quand(-1, 'fortnight'))).toBe(Number.POSITIVE_INFINITY)
  })

  it('ne réordonne pas le tableau qu’on lui donne', () => {
    /* Le tri rend une COPIE. Muter l'entrée réordonnerait `ALERTS`, une
       constante de module partagée par la barre latérale et trois écrans. */
    const avis = [{ at: quand(-2, 'day') }, { at: quand(-1, 'hour') }]
    const premier = avis[0]!
    duPlusRecent(avis)
    expect(avis[0], 'le tableau d’origine a été réordonné sur place').toBe(premier)
  })
})
