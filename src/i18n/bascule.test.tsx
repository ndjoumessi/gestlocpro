import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/render'
import { useI18n } from '@/i18n/I18nProvider'

/**
 * `en.ts` est paresseux (voir I18nProvider.tsx) : ce test couvre le cas que
 * la mesure de ce lot ne regarde pas — non pas le PREMIER rendu, mais un
 * changement de langue APRÈS coup, quand `fr` était déjà affiché. Rien ne
 * garantissait que `setLocale('en')` ne produise pas un instant de texte
 * absent le temps que le paquet arrive.
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

describe('bascule de langue en cours de page', () => {
  it('passe au français puis à l’anglais sans jamais afficher un blanc ni une clé brute', async () => {
    renderWithProviders(<Sonde />, { locale: 'fr' })
    const texte = () => screen.getByTestId('texte')
    expect(texte()).toHaveTextContent('Fermer')

    const utilisateur = userEvent.setup()
    await utilisateur.click(screen.getByRole('button', { name: 'basculer' }))

    // Le repli français reste affiché pendant la fenêtre de chargement — ni
    // blanc, ni `common.close` brut — jusqu'à ce que l'anglais arrive et
    // remplace VRAIMENT le texte à l'écran.
    expect(texte().textContent).not.toBe('')
    expect(texte().textContent).not.toBe('common.close')
    await waitFor(() => expect(texte()).toHaveTextContent('Close'))
  })
})
