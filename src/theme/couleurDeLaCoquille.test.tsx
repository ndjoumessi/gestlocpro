import PAGE from '../../index.html?raw'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { ThemeProvider, useTheme, type Theme } from './ThemeProvider'

/**
 * LA BARRE D'ÉTAT SUIT LE THÈME CHOISI, PAS SEULEMENT CELUI DU SYSTÈME.
 *
 * `index.html` porte deux métas `theme-color`, une par requête média : c'est ce
 * qui teint la barre d'état Android et la coquille de l'application installée
 * AVANT toute feuille de style. Mais elles ne connaissent que le système. Sombre
 * choisi sur un téléphone clair — le cas de qui lit un relevé la nuit —, la
 * page se peignait sombre et la barre d'état restait claire : la « bande
 * étrangère » que le commentaire de ces métas dit précisément éviter.
 *
 * Deux moments, deux gardes : au montage, `ThemeProvider` aligne les deux
 * métas sur le thème forcé et les rend au système quand on y revient ; et
 * avant la première peinture, le script bloquant d'`index.html` — celui qui
 * pose déjà `data-theme` — fait la même chose, sinon la barre change de
 * couleur après la page. Les valeurs sont celles de `--color-paper`, tenues
 * par `faviconSuitLaMarque.test.ts` ; ici on ne vérifie que le GESTE.
 */

// `PAGE` arrive par `?raw` et non `node:fs` : ce cas rend du JSX dans jsdom,
// il vit dans le projet d'application, où les modules Node n'ont rien à faire.

const CLAIR = '#f6f8fb'
const SOMBRE = '#0f1319'

function metas() {
  return Array.from(document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
}

beforeEach(() => {
  // jsdom ne charge pas `index.html` : on lui prête les deux métas telles quelles.
  for (const [media, content] of [
    ['(prefers-color-scheme: light)', CLAIR],
    ['(prefers-color-scheme: dark)', SOMBRE],
  ] as const) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.media = media
    meta.content = content
    document.head.appendChild(meta)
  }
})

afterEach(() => {
  for (const meta of metas()) meta.remove()
  document.documentElement.removeAttribute('data-theme')
})

function Bascule() {
  const { setTheme } = useTheme()
  return (
    <>
      {(['auto', 'light', 'dark'] as Theme[]).map((theme) => (
        <button key={theme} type="button" onClick={() => setTheme(theme)}>
          {theme}
        </button>
      ))}
    </>
  )
}

describe('les métas theme-color', () => {
  it('prennent toutes deux la couleur du thème forcé', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ThemeProvider>
        <Bascule />
      </ThemeProvider>,
    )
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'dark' }))
    })
    expect(metas().map((m) => m.content)).toEqual([SOMBRE, SOMBRE])

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'light' }))
    })
    expect(metas().map((m) => m.content)).toEqual([CLAIR, CLAIR])
  })

  it('reviennent chacune à leur média quand on rend la main au système', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ThemeProvider>
        <Bascule />
      </ThemeProvider>,
    )
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'dark' }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'auto' }))
    })
    expect(metas().map((m) => m.content)).toEqual([CLAIR, SOMBRE])
  })
})

describe('le script de tête d’index.html', () => {
  it('teint la barre d’état avant la première peinture, comme il pose data-theme', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(PAGE)?.[1] ?? ''
    expect(script).toContain('data-theme')
    expect(script, 'le script doit toucher les métas theme-color').toContain('theme-color')
  })
})
