import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
  type RenderResult,
} from '@testing-library/react'
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
 * L'état de session effectif d'un rendu de test.
 *
 * Une route sous `/demo` reçoit d'office une session de démonstration : sans
 * elle, `Demo` ne rend rien tant que son effet d'entrée n'a pas basculé la
 * session, et le test observe un écran vide qu'il prend pour un défaut.
 *
 * Il n'y a délibérément PAS de raccourci « rends-moi cet écran en tant que
 * gestionnaire ». Le rôle vient de l'adhésion, l'adhésion porte un `parkId`, et
 * un `parkId` déclenche la lecture du parc : un tel raccourci donnerait une
 * session cohérente à un test sans serveur, qui lirait « Chargement… » sans
 * comprendre pourquoi. Les cas qui éprouvent les rôles montent donc leur propre
 * session ET leur faux serveur — voir `roleDeLAdhesion.test.tsx`.
 */
function sessionDe(preferences: PreferencesTest, route = ''): EtatSession | undefined {
  if (preferences.session === null) return undefined
  if (preferences.session) return preferences.session
  if (route.startsWith('/demo')) return { statut: 'demo' }
  return SESSION_CONNECTEE
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

/**
 * `async`, et c'est le coût direct du découpage paresseux de l'espace
 * applicatif (voir `src/App.tsx`).
 *
 * `PortfolioProvider` NE VIT PLUS ICI : il a suivi `/app` et `/demo` dans
 * `src/app/EspaceApplicatif.tsx`, et l'y enrouler une seconde fois ferait
 * cohabiter deux instances — celle du test, jamais lue, et celle du paquet
 * paresseux, seule à compter puisque React résout un contexte par
 * l'ancêtre le plus proche. Un tel doublon prouverait moins qu'il ne cache :
 * il donnerait l'air de tester le vrai montage en en testant un autre.
 *
 * `await` de ce que `React.lazy` suspend AVANT de rendre la main au test :
 * sans lui, chaque test sous `/app` ou `/demo` devrait remplacer son premier
 * `getBy…` par `findBy…`, un changement dispersé sur toute la suite pour un
 * défaut que cette seule fonction peut absorber. `waitForElementToBeRemoved`
 * et non un délai : le marqueur `chargement-espace-applicatif` disparaît
 * exactement quand le paquet a fini de se résoudre, ni avant, ni après.
 * `queryByTestId` d'abord, car sur une route publique — ou une fois le paquet
 * déjà mis en cache par un test précédent du même fichier — il n'apparaît
 * jamais, et `waitForElementToBeRemoved` exige un élément PRÉSENT au départ.
 */
export async function renderApp(
  route = '/',
  preferences: PreferencesTest = {},
): Promise<RenderResult> {
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

  const resultat = render(
    <MemoryRouter initialEntries={[{ ...decouper(route), state: preferences.state ?? null }]}>
      <I18nProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <ToastProvider>
              <SessionProvider etatInitial={sessionDe(preferences, route)}>
                <App />
              </SessionProvider>
            </ToastProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>,
  )

  const repli = screen.queryByTestId('chargement-espace-applicatif')
  if (repli) await waitForElementToBeRemoved(repli)

  return resultat
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
              <SessionProvider etatInitial={sessionDe(preferences)}>
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
 *
 * RÉSERVÉ À `/demo` : le sélecteur ne s'affiche plus ailleurs. Sur un compte
 * réel, le rôle vient de l'adhésion — il se pose au montage, par la session.
 */
export async function switchRole(role: Role): Promise<void> {
  const user = userEvent.setup()
  const radios = screen.getAllByRole('radio', { hidden: true })
  const target = radios.find((radio) => (radio as HTMLInputElement).value === role)
  if (!target) throw new Error(`Profil « ${role} » introuvable dans la barre latérale`)
  await user.click(target)
}

/**
 * Attend la fin de l'attente DÉLIBÉRÉE de la démonstration.
 *
 * La démonstration retient les données 900 ms au premier montage, pour que les
 * squelettes soient observables sans compte — c'était le seul moyen de les
 * regarder, et l'un d'eux débordait à 375 px sans que rien ne le signale. Le
 * prix est ici : un test monté sous `/demo` lit « Chargement… » s'il assertait
 * aussitôt.
 *
 * L'attente porte sur `aria-busy`, que `Skeleton` pose sur sa région d'état.
 * C'est le même signal que reçoit un lecteur d'écran : attendre autre chose —
 * un délai fixe, un texte traduit — reviendrait à deviner.
 */
export async function attendreLeChargement(): Promise<void> {
  await waitFor(
    () => {
      const enCours = document.querySelectorAll('[aria-busy="true"]').length
      if (enCours > 0) throw new Error(`${enCours} région(s) encore en chargement`)
    },
    { timeout: 3000 },
  )
}

export { screen, userEvent, waitFor, within }
