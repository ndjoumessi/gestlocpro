import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { useT } from '@/i18n/I18nProvider'

/**
 * Accord en nombre.
 *
 * `t()` ne faisait que de l'interpolation : « {count} réserves » rendait
 * « 1 réserves ». Le typage ne pouvait rien y voir — la chaîne était
 * grammaticalement fausse, pas techniquement invalide.
 *
 * Le cas décisif est **zéro** : le français sélectionne la catégorie `one`
 * (« 0 réserve ») là où l'anglais sélectionne `other` (« 0 issues »). Un
 * `count === 1 ? singulier : pluriel` codé à la main produirait « 0 réserves »,
 * faux et invisible tant qu'aucun écran n'affiche zéro.
 */
function Sonde({ count }: { count: number }) {
  const t = useT()
  return <p data-testid="sonde">{t('app.inspections.issues', { count })}</p>
}

const texte = () => screen.getByTestId('sonde').textContent

describe('accord en nombre', () => {
  it.each([
    [0, '0 réserve'],
    [1, '1 réserve'],
    [2, '2 réserves'],
    [21, '21 réserves'],
  ])('français : %i → « %s »', (count, attendu) => {
    renderWithProviders(<Sonde count={count} />, { locale: 'fr' })
    expect(texte()).toBe(attendu)
  })

  it.each([
    [0, '0 issues'],
    [1, '1 issue'],
    [2, '2 issues'],
    [21, '21 issues'],
  ])('anglais : %i → « %s »', async (count, attendu) => {
    // `en.ts` est désormais paresseux (voir I18nProvider.tsx) : le premier
    // rendu se rabat sur le français le temps que le paquet arrive.
    // `waitFor` laisse cette fenêtre se refermer avant d'asserter, plutôt
    // que de lire le repli et de le prendre pour un défaut.
    renderWithProviders(<Sonde count={count} />, { locale: 'en' })
    await waitFor(() => expect(texte()).toBe(attendu))
  })

  it('diverge bien entre les deux langues à zéro', async () => {
    // La raison d'être d'Intl.PluralRules : si ces deux valeurs devenaient
    // identiques, c'est que la sélection ne dépend plus de la langue.
    renderWithProviders(<Sonde count={0} />, { locale: 'fr' })
    const fr = texte()
    renderWithProviders(<Sonde count={0} />, { locale: 'en' })
    const dernier = () => screen.getAllByTestId('sonde').at(-1)?.textContent

    expect(fr).toBe('0 réserve')
    await waitFor(() => expect(dernier()).toBe('0 issues'))
  })

  it('retombe sur la forme par défaut si la variante manque', () => {
    // `common.close` n'a pas de variante `_one` : la clé de base doit servir,
    // plutôt que de renvoyer le chemin brut à l'écran.
    function SansVariante() {
      const t = useT()
      return <p data-testid="sonde">{t('common.close', { count: 1 })}</p>
    }
    renderWithProviders(<SansVariante />, { locale: 'fr' })
    expect(texte()).toBe('Fermer')
  })
})
