import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'

/**
 * La préférence de thème, de bout en bout.
 *
 * Ce qui compte n'est pas qu'un bouton s'enfonce : c'est que l'attribut
 * `data-theme` de `<html>` suive, puisque c'est LUI que lisent les sélecteurs
 * de `tokens.css`. Un composant qui garderait le choix dans son état sans
 * toucher au document serait vert ici sans rien repeindre à l'écran.
 */
function racine() {
  return document.documentElement
}

describe('préférence de thème', () => {
  it('part du réglage système, sans attribut à poser', () => {
    // « Système » n'est pas une valeur d'attribut : c'est son absence, qui rend
    // la main à `@media (prefers-color-scheme: dark)`.
    renderWithProviders(<ThemeSwitcher />)
    expect(racine().hasAttribute('data-theme')).toBe(false)
    expect(screen.getByRole('button', { name: /Système/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('pose le thème sombre choisi sur le document', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeSwitcher />)

    await user.click(screen.getByRole('button', { name: /Sombre/ }))

    expect(racine()).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem('gestlocpro.theme')).toBe('dark')
  })

  it('pose le thème clair choisi, qui doit gagner sous un système sombre', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeSwitcher />)

    await user.click(screen.getByRole('button', { name: /Clair/ }))

    // C'est ce cas-là qu'on oublie : sans attribut posé, quelqu'un dont le
    // système est sombre resterait en sombre après avoir demandé le clair.
    expect(racine()).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem('gestlocpro.theme')).toBe('light')
  })

  it('rend la main au système et oublie la préférence', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeSwitcher />)

    await user.click(screen.getByRole('button', { name: /Sombre/ }))
    await user.click(screen.getByRole('button', { name: /Système/ }))

    expect(racine().hasAttribute('data-theme')).toBe(false)
    // Effacée, et non écrite à « auto » : le script d'amorçage n'a ainsi qu'un
    // seul cas à traiter, l'absence de clé.
    expect(window.localStorage.getItem('gestlocpro.theme')).toBeNull()
  })

  it('relit la préférence stockée au montage', () => {
    window.localStorage.setItem('gestlocpro.theme', 'dark')
    renderWithProviders(<ThemeSwitcher />)

    expect(racine()).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: /Sombre/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('ignore une valeur stockée qui ne veut rien dire', () => {
    window.localStorage.setItem('gestlocpro.theme', 'sépia')
    renderWithProviders(<ThemeSwitcher />)

    expect(racine().hasAttribute('data-theme')).toBe(false)
  })
})
