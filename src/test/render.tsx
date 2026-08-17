import { render, screen, within, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { App } from '@/App'
import { I18nProvider } from '@/i18n/I18nProvider'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { CurrencyProvider } from '@/currency/CurrencyProvider'
import { ToastProvider } from '@/components/primitives/Toast'
import { PortfolioProvider } from '@/data/PortfolioProvider'
import { SessionProvider, type EtatSession } from '@/api/SessionProvider'
import { COMPTE_FICTIF } from './api'
import type { Role } from '@/features/auth/signupState'
import type { Locale } from '@/i18n/locales'
import type { CurrencyCode } from '@/currency/currencies'

/** Session par défaut des tests : voir `test/api` pour le choix d'un état résolu. */
export const SESSION_CONNECTEE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [],
}

export const SESSION_ANONYME: EtatSession = { statut: 'anonyme' }

export interface PreferencesTest {
  locale?: Locale
  currency?: CurrencyCode
  region?: string
  /**
   * État de session au montage. Par défaut : connecté.
   *
   * `null` demande à ne fournir AUCUN état initial : le fournisseur résout
   * alors la session comme en production — trace de démonstration, appel à
   * `/auth/me`, bascule en anonyme. Les rares tests qui éprouvent cette
   * résolution elle-même en ont besoin ; les autres seraient ralentis pour une
   * propriété qu'ils ne testent pas.
   */
  session?: EtatSession | null
  /** État de navigation de la route de départ, comme le poserait `RequireAuth`. */
  state?: unknown
}

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
/**
 * Sépare le chemin de sa chaîne de requête.
 *
 * `MemoryRouter` accepte une chaîne — qu'il analyse — ou un objet, qu'il prend
 * tel quel. Passer `{ pathname: '/reinitialiser?jeton=abc' }` range donc la
 * requête DANS le chemin, et `useSearchParams` ne voit plus rien : huit tests
 * du parcours de réinitialisation tombaient sur un « lien expiré ».
 */
function decouper(route: string): { pathname: string; search: string } {
  const [pathname = '/', search = ''] = route.split('?')
  return { pathname, search: search ? `?${search}` : '' }
}

export function renderApp(
  route = '/',
  preferences: PreferencesTest = {},
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
    <MemoryRouter initialEntries={[{ ...decouper(route), state: preferences.state ?? null }]}>
      <I18nProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <ToastProvider>
              <SessionProvider etatInitial={preferences.session === null ? undefined : (preferences.session ?? SESSION_CONNECTEE)}>
                <PortfolioProvider>
                  <App />
                </PortfolioProvider>
              </SessionProvider>
            </ToastProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

/** Rend un composant isolé avec les mêmes providers, sans routeur d'application. */
export function renderWithProviders(
  ui: ReactElement,
  preferences: PreferencesTest = {},
): RenderResult {
  window.localStorage.setItem('gestlocpro.locale', preferences.locale ?? 'fr')
  if (preferences.currency) window.localStorage.setItem('gestlocpro.currency', preferences.currency)
  if (preferences.region) window.localStorage.setItem('gestlocpro.region', preferences.region)

  return render(
    <MemoryRouter>
      <I18nProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <ToastProvider>
              <SessionProvider etatInitial={preferences.session === null ? undefined : (preferences.session ?? SESSION_CONNECTEE)}>
                <PortfolioProvider>{ui}</PortfolioProvider>
              </SessionProvider>
            </ToastProvider>
          </CurrencyProvider>
        </ThemeProvider>
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
