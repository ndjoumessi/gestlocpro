import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { estRondEnUniteDUsage, formatMoney, type CurrencyCode } from '@/currency/currencies'
import { PLANS, planPrice } from './pricing'

/**
 * UN PRIX AFFICHÉ EST CELUI DE LA GRILLE, DANS TOUTES LES DEVISES.
 *
 * ═══ CE QUI A CASSÉ, ET POURQUOI RIEN NE L'A VU ═══
 *
 * Le lot des unités mineures a fait de `money` une fonction qui DIVISE : elle
 * reçoit des centimes et rend des euros. C'était juste pour tout ce qui vient du
 * serveur, et faux pour la seule table de montants que le produit écrit
 * lui-même — la grille tarifaire, dont `EUR: 4` a toujours voulu dire quatre
 * euros. La page des tarifs annonçait donc quatre CENTIMES par mois.
 *
 * Les vingt-sept cas de la vitrine sont restés verts. Aucun n'affichait un prix
 * dans une devise à décimales : ils mesuraient la FORMULE — `planPrice`,
 * `exactPlanPrice`, l'arrondi du franc CFA — c'est-à-dire des nombres, jamais
 * leur mise en forme. Et le franc CFA, où la mineure vaut l'usage, ne bronche
 * pas. Le défaut vivait exactement dans l'angle mort commun aux deux.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Le pont entre la grille et l'écran, dans les quatre devises. Il ne mesure ni
 * la formule ni le formatage — chacun a déjà les siens — mais leur RACCORD, qui
 * n'appartenait à personne.
 */

const essentiel = PLANS.find((p) => p.id === 'essential')!

/** Le prix de l'Essentiel, tel que la grille l'annonce, dans chaque devise. */
const ATTENDUS: { devise: CurrencyCode; mensuel: string }[] = [
  /*
    Douze unités : la position par défaut du curseur de la page.

    AVEC LE SYMBOLE, et ce n'est pas de la décoration : « 10 » se retrouve par
    accident dans une page de vitrine, « 10 € » non. Les décimales tombent quand
    le prix est rond — c'est la règle de la page, « 4 € » et non « 4,00 € » — et
    le dollar canadien est le seul des quatre à ne pas l'être ici, ce qui en
    fait le seul à éprouver l'autre moitié de cette règle.
  */
  { devise: 'CFA', mensuel: '2 400 FCFA' },
  { devise: 'EUR', mensuel: '10 €' },
  { devise: 'CAD', mensuel: '14,40 $' },
  { devise: 'USD', mensuel: '$ 10' },
]

describe('les prix de la vitrine', () => {
  it.each(ATTENDUS)('affichent la grille en $devise, et non ses centièmes', async ({ devise, mensuel }) => {
    await renderApp('/', { currency: devise })

    const page = screen.getByRole('main').textContent ?? ''
    /* L'espace des milliers est celle qu'`Intl` compose — fine et insécable.
       On la ramène à une espace ordinaire des deux côtés pour que le cas se
       relise, plutôt que d'écrire un point de code dans une valeur attendue. */
    const lisible = page.replace(/[\s  ]/g, ' ')
    expect(lisible, `le prix mensuel de l’Essentiel en ${devise}`).toContain(mensuel)
  })

  /**
   * LA GARDE DE LA GARDE, et elle vaut mieux qu'une liste de chaînes.
   *
   * Les valeurs ci-dessus sont écrites à la main : si la grille change, elles
   * mentent et le cas rougit pour la mauvaise raison. Ce cas-ci reconstruit
   * l'attendu depuis la grille elle-même, et vérifie que les deux disent la
   * même chose. Une seule des deux moitiés peut se tromper à la fois.
   */
  it('sont ceux que la grille calcule, sans écart de mise en forme', () => {
    for (const { devise, mensuel } of ATTENDUS) {
      const prix = planPrice(essentiel, devise, 'monthly', 12)!
      // Un prix rond ne porte pas ses décimales : « 4 € », pas « 4,00 € ».
      const rendu = formatMoney(prix, devise, { round: estRondEnUniteDUsage(prix, devise) })
      expect(rendu.replace(/[\s  ]/g, ' '), `grille contre attendu en ${devise}`).toBe(
        mensuel,
      )
    }
  })
})
