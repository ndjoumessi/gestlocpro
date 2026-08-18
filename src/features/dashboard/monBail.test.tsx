import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement } from '@/test/render'

/**
 * « Mon bail », carte que la maquette du portail met en évidence.
 *
 * Le locataire lisait son loyer du mois et sa consommation, jamais les TERMES
 * de son contrat : ce qu'il paie chaque mois, et ce qu'il a versé en caution.
 * Cette dernière est SON argent, et il ne pouvait le lire nulle part — c'est
 * exactement ce que ce produit reproche aux pratiques qu'il remplace.
 */
describe('mon bail', () => {
  it('montre au locataire son loyer et sa caution', async () => {
    renderApp('/demo')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent(/mon loyer mensuel/i)
    expect(main).toHaveTextContent(/ma caution versée/i)
  })

  it('ne les montre pas au bailleur, qui voit le parc entier', async () => {
    renderApp('/demo')
    await attendreLeChargement()

    /**
     * Le pendant négatif : ces deux cartes disent « MON » loyer et « MA »
     * caution. Servies au propriétaire, elles désigneraient un bail parmi douze
     * sans dire lequel.
     */
    expect(screen.getByRole('main')).not.toHaveTextContent(/mon loyer mensuel/i)
  })
})
