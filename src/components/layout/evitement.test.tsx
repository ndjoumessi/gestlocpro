import { describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * Lien d'évitement de l'espace connecté.
 *
 * La vitrine en avait un, l'application non. Chaque page imposait donc de
 * tabuler la barre latérale entière — une dizaine de liens, le sélecteur de
 * rôle, le repli du rail — avant d'atteindre la première chose qu'on était venu
 * lire. Le défaut se répétait à chaque navigation, puisque le focus repart du
 * début du document.
 *
 * Ce qui est vérifié ici, c'est la POSITION dans l'ordre de tabulation et non
 * la seule présence du lien : un lien d'évitement placé après ce qu'il fait
 * éviter ne sert à rien, et c'est un défaut qu'une relecture de diff ne voit
 * pas — le lien y est, il a la bonne cible, il est simplement au mauvais
 * endroit du DOM.
 */
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
})

describe('lien d’évitement de l’application', () => {
  it('vise le contenu principal', async () => {
    await renderApp('/app')

    const lien = screen.getByRole('link', { name: 'Aller au contenu' })
    expect(lien).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('est la toute première tabulation, avant la navigation', async () => {
    const user = userEvent.setup()
    await renderApp('/app')

    await user.tab()
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveFocus()
  })

  /**
   * SON TEXTE SUIT LA LANGUE, ce qui n'a pas toujours été vrai.
   *
   * Il était écrit en dur dans le composant — seul texte du produit hors
   * dictionnaire — et le garde-fou des chaînes ne pouvait pas le voir : il
   * repère une chaîne visible à ses caractères accentués, et « Aller au
   * contenu » n'en porte aucun. Un visiteur anglophone lisait donc du français
   * à la PREMIÈRE tabulation de chaque page.
   *
   * Ce cas ne vérifie pas une traduction particulière — il vérifie que le texte
   * CHANGE. C'est la seule chose qu'une chaîne en dur ne sait pas faire.
   */
  it('dit son libellé dans la langue de l’utilisateur', async () => {
    await renderApp('/app', { locale: 'fr' })
    const enFrancais = screen.getByRole('link', { name: /aller au contenu/i })
    expect(enFrancais).toBeInTheDocument()

    cleanup()
    await renderApp('/app', { locale: 'en' })
    expect(screen.queryByRole('link', { name: /aller au contenu/i })).toBeNull()
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument()
  })
})