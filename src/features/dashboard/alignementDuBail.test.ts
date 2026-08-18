import { describe, expect, it } from 'vitest'
import { INSPECTIONS, UNITS } from '@/data/portfolio'

/**
 * Le début du bail et l'état des lieux d'ENTRÉE datent la même arrivée.
 *
 * Trois unités portaient un mois de moins que leur état des lieux — A1 entrait
 * le 15/05 pour un état des lieux le 15/06 —, l'écart exact d'un mois lu en
 * base 1 puis réécrit en base 0. Rien ne le voyait : les deux dates s'affichent
 * sur deux écrans différents, « Mon espace » et « Documents », et il fallait
 * les rapprocher pour que l'absurdité saute aux yeux — un locataire dont le
 * logement est constaté un mois après son emménagement.
 *
 * `DateParts.month` est indexé à ZÉRO partout ; c'est la marche la plus facile
 * à rater du modèle, et ce test est la rampe.
 */
describe('alignement du bail et de l’état des lieux', () => {
  const entrees = INSPECTIONS.filter((i) => i.kind === 'entry')

  it('trouve bien des états des lieux d’entrée à comparer', () => {
    // Garde du garde : un jeu vidé rendrait ce test vert sans rien prouver.
    expect(entrees.length).toBeGreaterThan(2)
  })

  it.each(entrees.map((i) => [i.unitId, i] as const))(
    'unité %s : le bail commence le jour de l’état des lieux',
    (unitId, entree) => {
      const unit = UNITS.find((u) => u.id === unitId)
      expect(unit, `unité ${unitId} introuvable`).toBeDefined()
      // Une unité rendue vacante depuis n'a plus de bail en cours : c'est un
      // cas légitime, et non un désalignement.
      if (!unit!.leaseStart) {
        expect(unit!.tenant).toBeNull()
        return
      }
      expect(unit!.leaseStart).toEqual(entree.date)
    },
  )

  it('ne date aucun bail sur une unité vacante', () => {
    for (const unit of UNITS.filter((u) => u.tenant === null))
      expect(unit.leaseStart, unit.id).toBeNull()
  })
})
