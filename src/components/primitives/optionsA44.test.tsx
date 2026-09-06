import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { Combobox } from './Combobox'

/**
 * CHAQUE OPTION D'UNE LISTE DÉROULANTE FAIT 44 PX DE HAUT.
 *
 * `cibles.test.ts` tient le plancher de 44 px sur `button`, `Link` et `a`, et
 * `mesure-ui` le mesure sur les écrans de démonstration. Une option de
 * `Combobox` échappe aux deux : ce n'est pas un bouton, et la liste n'existe
 * qu'ouverte — aucune capture d'écran ne la contient. Elle faisait 38 px
 * (`px-3 py-2 text-body` : 16 + 14 × 1,55), la seule cible sous le plancher
 * de toutes les primitives, à l'endroit précis où un pouce choisit un
 * indicatif téléphonique parmi deux cents.
 *
 * jsdom ne mesure pas : on vérifie que l'option PORTE le plancher
 * (`min-h-11`), comme `cibles.test.ts` le fait pour les boutons.
 */

const OPTIONS = [
  { value: 'CM', label: 'Cameroun +237' },
  { value: 'FR', label: 'France +33' },
]

describe('les options du Combobox', () => {
  it('portent le plancher de 44 px', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Combobox aria-label="Indicatif" options={OPTIONS} value="CM" onChange={() => {}} />,
    )
    await user.click(screen.getByRole('combobox', { name: 'Indicatif' }))
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) expect(option.className).toMatch(/\bmin-h-11\b/)
  })
})
