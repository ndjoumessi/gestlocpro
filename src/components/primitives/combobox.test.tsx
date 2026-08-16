import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { Combobox } from './Combobox'

/**
 * Un combobox refait à la main ce qu'un `<select>` natif donne gratuitement.
 *
 * C'est la raison pour laquelle on ne le sort qu'à contrecœur — et la raison
 * pour laquelle il faut l'éprouver au clavier. Un combobox à moitié fait sur un
 * champ OBLIGATOIRE bloque la création de compte à qui n'utilise pas la souris.
 */
const OPTIONS = [
  { value: '+237', label: 'Cameroun · +237', groupe: 'Zone franc CFA' },
  { value: '+221', label: 'Sénégal · +221', groupe: 'Zone franc CFA' },
  { value: '+33', label: 'France · +33', groupe: 'Autres pays' },
  { value: '+49', label: 'Allemagne · +49', groupe: 'Autres pays' },
]

function Champ() {
  const [valeur, setValeur] = useState('+33')
  return <Combobox aria-label="Indicatif" options={OPTIONS} value={valeur} onChange={setValeur} />
}

describe('combobox', () => {
  it('filtre à la frappe, sur le nom comme sur l’indicatif', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    await user.click(champ)
    await user.type(champ, 'cam')
    expect(screen.getByRole('option', { name: /Cameroun/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /France/ })).not.toBeInTheDocument()

    await user.clear(champ)
    // Le libellé porte le nom ET l'indicatif : chercher « 237 » doit marcher.
    await user.type(champ, '237')
    expect(screen.getByRole('option', { name: /Cameroun/ })).toBeInTheDocument()
  })

  it('se pilote entièrement au clavier', async () => {
    /**
     * Le test qui justifie ce composant.
     *
     * Flèches pour parcourir, Entrée pour choisir. Sans cela, un champ
     * obligatoire devient infranchissable sans souris — et l'on aurait remplacé
     * un `<select>` parfaitement accessible par une régression.
     */
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    champ.focus()
    // Le focus ouvre déjà la liste : la première flèche DÉPLACE, elle n'ouvre
    // pas. C'est le comportement attendu — arriver au clavier sur un champ
    // cherchable et ne rien voir obligerait à une frappe pour rien.
    await user.keyboard('{ArrowDown}{Enter}')
    // Deuxième option de la liste non filtrée : le Sénégal.
    expect(champ).toHaveValue('Sénégal · +221')
  })

  it('annonce l’option active aux technologies d’assistance', async () => {
    // `aria-activedescendant` est ce qui fait LIRE l'option parcourue : sans
    // lui, la navigation aux flèches est silencieuse.
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    champ.focus()
    await user.keyboard('{ArrowDown}')
    expect(champ.getAttribute('aria-expanded')).toBe('true')
    expect(champ.getAttribute('aria-activedescendant')).toBeTruthy()
  })

  it('referme sur Échap sans rien changer', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = screen.getByRole('combobox', { name: 'Indicatif' })

    champ.focus()
    await user.type(champ, 'cam')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // Le choix d'origine est intact : chercher n'est pas choisir.
    expect(champ).toHaveValue('France · +33')
  })

  it('montre le choix courant plutôt qu’un champ vide', () => {
    renderWithProviders(<Champ />)
    // Un champ vide ferait croire qu'aucun choix n'est fait.
    expect(screen.getByRole('combobox', { name: 'Indicatif' })).toHaveValue('France · +33')
  })
})
