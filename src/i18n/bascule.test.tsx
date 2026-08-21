import { fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { useI18n } from '@/i18n/I18nProvider'

/**
 * `en.ts` est paresseux (voir I18nProvider.tsx). Le lot précédent se
 * rabattait sur `fr` le temps que le paquet arrive ; celui-ci l'interdit —
 * `t()` rend `''` tant que le dictionnaire demandé n'est pas résolu, jamais
 * une autre langue. Les deux moments où ça se joue :
 *
 *  - le PREMIER rendu, quand la langue stockée est déjà l'anglais ;
 *  - une BASCULE en cours de page, via `setLocale`.
 */
function Sonde() {
  const { setLocale, t } = useI18n()
  return (
    <div>
      <p data-testid="texte">{t('common.close')}</p>
      <button type="button" onClick={() => setLocale('en')}>
        basculer
      </button>
    </div>
  )
}

describe('premier rendu — la langue demandée, jamais une autre', () => {
  it("n'affiche jamais le français quand l'anglais est demandé dès le montage", async () => {
    renderWithProviders(<Sonde />, { locale: 'en' })
    const texte = () => screen.getByTestId('texte')

    // Lu IMMÉDIATEMENT après le rendu, avant tout flush de promesse : c'est
    // l'instant que le lot précédent remplissait de français. `chargerAnglais`
    // rend toujours sa promesse via `.then` — même déjà résolue, `.then` ne
    // s'exécute jamais dans la même tâche synchrone que `render()` — donc cet
    // instant existe à coup sûr et cette assertion l'observe vraiment.
    expect(texte().textContent).toBe('')
    expect(texte().textContent).not.toBe('Fermer')

    await waitFor(() => expect(texte()).toHaveTextContent('Close'))
  })

  it('affiche le français immédiatement, sans la moindre attente, quand le français est demandé', () => {
    // PAS de `waitFor` ici, et c'est la preuve : si la langue impatiente
    // traversait une fenêtre de chargement, ce texte manquerait au moment de
    // l'assertion et ce test — synchrone — rougirait.
    renderWithProviders(<Sonde />, { locale: 'fr' })
    expect(screen.getByTestId('texte')).toHaveTextContent('Fermer')
  })
})

describe('bascule de langue en cours de page', () => {
  it("passe par un texte VIDE, jamais par le français, avant de rendre l'anglais", async () => {
    renderWithProviders(<Sonde />, { locale: 'fr' })
    const texte = () => screen.getByTestId('texte')
    expect(texte()).toHaveTextContent('Fermer')

    // `fireEvent`, PAS `userEvent` : `userEvent.click` enchaîne plusieurs
    // `await` internes (pointerdown, pointerup…), largement assez pour
    // qu'une promesse déjà résolue — `en.ts` a pu être chargé par un test
    // précédent du même fichier — ait le temps de poser son état avant que ce
    // test ne regarde. `fireEvent.click` est synchrone : l'assertion qui suit
    // observe l'instant qui suit IMMÉDIATEMENT le rendu déclenché par le
    // clic, avant tout flush de promesse — le même principe que le test de
    // premier rendu ci-dessus.
    fireEvent.click(screen.getByRole('button', { name: 'basculer' }))

    // Le clic vient de poser `locale = 'en'` : le dictionnaire anglais n'a
    // pas encore eu le temps d'arriver. Ni le français qui vient de
    // disparaître, ni une clé brute — un texte vide, le temps que `en.ts`
    // réponde.
    expect(texte().textContent).toBe('')
    expect(texte().textContent).not.toBe('common.close')
    await waitFor(() => expect(texte()).toHaveTextContent('Close'))
  })
})
