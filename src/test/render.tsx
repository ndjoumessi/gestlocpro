import { render, screen, within, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { App } from '@/App'
import { I18nProvider } from '@/i18n/I18nProvider'
import { CurrencyProvider } from '@/currency/CurrencyProvider'
import { ToastProvider } from '@/components/primitives/Toast'
import { PortfolioProvider } from '@/data/PortfolioProvider'
import type { Role } from '@/features/auth/signupState'
import type { Locale } from '@/i18n/locales'
import type { CurrencyCode } from '@/currency/currencies'

/**
 * Rend l'application entière sur une route donnée.
 *
 * Les tests passent par l'application réelle plutôt que par des composants
 * isolés : ce qu'on veut vérifier — un locataire ne voit pas les données des
 * autres — dépend du câblage entre la barre latérale, les gardes de route et
 * les écrans. Monter un écran seul le prouverait pour cet écran et pas pour le
 * produit.
 *
 * `MemoryRouter` remplace `BrowserRouter` : pas d'URL réelle à manipuler, et
 * la route de départ se déclare en argument.
 */
export function renderApp(
  route = '/',
  preferences: { locale?: Locale; currency?: CurrencyCode; region?: string } = {},
): RenderResult {
  // Les préférences sont lues depuis `localStorage` au premier rendu : il faut
  // donc les poser avant de monter, pas après.
  //
  // La langue est posée explicitement, et par défaut en français. Sans cela,
  // `I18nProvider` se rabat sur `navigator.language`, que jsdom annonce à
  // `en-US` : les tests basculaient en anglais et dépendaient donc de
  // l'environnement d'exécution plutôt que de ce qu'ils déclarent.
  window.localStorage.setItem('gestlocpro.locale', preferences.locale ?? 'fr')
  if (preferences.currency) window.localStorage.setItem('gestlocpro.currency', preferences.currency)
  if (preferences.region) window.localStorage.setItem('gestlocpro.region', preferences.region)

  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <CurrencyProvider>
          <ToastProvider>
            <PortfolioProvider>
              <App />
            </PortfolioProvider>
          </ToastProvider>
        </CurrencyProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

/** Rend un composant isolé avec les mêmes providers, sans routeur d'application. */
export function renderWithProviders(
  ui: ReactElement,
  preferences: { locale?: Locale; currency?: CurrencyCode; region?: string } = {},
): RenderResult {
  window.localStorage.setItem('gestlocpro.locale', preferences.locale ?? 'fr')
  if (preferences.currency) window.localStorage.setItem('gestlocpro.currency', preferences.currency)
  if (preferences.region) window.localStorage.setItem('gestlocpro.region', preferences.region)

  return render(
    <MemoryRouter>
      <I18nProvider>
        <CurrencyProvider>
          <ToastProvider>
            <PortfolioProvider>{ui}</PortfolioProvider>
          </ToastProvider>
        </CurrencyProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

/**
 * Bascule le profil actif via le sélecteur de la barre latérale, comme le
 * ferait l'utilisateur. Passer par l'interface plutôt que par le contexte
 * garantit que le test échouerait aussi si le sélecteur cessait de fonctionner.
 */
export async function switchRole(role: Role): Promise<void> {
  const user = userEvent.setup()
  const radios = screen.getAllByRole('radio', { hidden: true })
  const target = radios.find((radio) => (radio as HTMLInputElement).value === role)
  if (!target) throw new Error(`Profil « ${role} » introuvable dans la barre latérale`)
  await user.click(target)
}

export { screen, userEvent, within }
