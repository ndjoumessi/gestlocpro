import {
  act,
  render,
  screen,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { App, chargerEspaceApplicatif } from '@/App'
import { chargerAnglais, I18nProvider } from '@/i18n/I18nProvider'
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
  /**
   * LA LARGEUR DE FENÊTRE QUE LE CAS ÉPROUVE, en pixels.
   *
   * ═══ POURQUOI LE HARNAIS DOIT LA DÉCLARER ═══
   *
   * jsdom ne calcule aucune mise en page, et sa `matchMedia` répond `false` à
   * TOUT. Tant que le produit ne lisait ses points de rupture que dans la
   * feuille de style, cela ne se voyait pas : les utilitaires responsifs
   * cachent sans retirer, donc le DOM était le même à toute largeur et les cas
   * y trouvaient ce qu'ils cherchaient.
   *
   * Ce n'est plus vrai. Les écrans-tableaux rendent désormais des FICHES sous
   * `sm` et un TABLEAU au-dessus — deux arbres différents, choisis au rendu,
   * précisément pour ne pas laisser la donnée deux fois dans le document. Un
   * harnais qui répond « faux » à toute requête ne teste alors qu'une des deux
   * formes, et sans le dire.
   *
   * ═══ LE DÉFAUT VAUT 1280, ET C'EST UN CHOIX ═══
   *
   * Ce n'est pas la largeur du marché visé — le téléphone l'est, et le dépôt le
   * répète. C'est la largeur que les cas existants SUPPOSAIENT sans l'écrire :
   * ils interrogent des `columnheader`, des `cell`, des `rowgroup`. Les faire
   * basculer en fiches d'un coup aurait réécrit une trentaine de gardes du
   * tableau — c'est-à-dire perdu la garde de la forme large en croyant gagner
   * celle de la forme étroite.
   *
   * Un cas qui veut le téléphone le DEMANDE, et `fichesDuTableau.test.tsx` le
   * fait. Les deux formes sont gardées, chacune à sa largeur.
   */
  largeur?: number
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
 * Attend la résolution du découpage paresseux — SANS EXIGER qu'il y en ait
 * un à résoudre.
 *
 * `queryByTestId`, et non `getByTestId` : `waitForElementToBeRemoved` exige
 * un élément PRÉSENT au moment de l'appel, et lui en passer un qui n'existe
 * pas LÈVE une erreur — pas un délai qui expire, une exception immédiate. Le
 * `if` n'est donc pas une garde optionnelle, c'est ce qui distingue « rien à
 * attendre » de « l'attente a échoué ».
 *
 * PROUVÉ DANS LES DEUX SENS PAR MUTATION, à ce lot :
 *  - Frontière RETIRÉE (`/app` redevient impatient, comme si ce lot n'avait
 *    jamais existé) : le marqueur n'apparaît plus jamais, `repli` vaut
 *    toujours `null`, cette fonction ne fait rien — les 1027 tests
 *    restent verts.
 *  - Attente RETIRÉE alors que la frontière EXISTE : 17 tests sur 27
 *    échouent dans le seul `screens.test.tsx`, sur des `getBy…` qui lisaient
 *    encore le repli de chargement.
 *
 * NE PAS SIMPLIFIER CE `if` au nom d'un repli « toujours présent
 * aujourd'hui » : c'est précisément le jour où une route repasse en
 * impatient qu'il cesse de l'être, et c'est ce jour-là que les 401 sites
 * d'appel de `renderApp` rougiraient d'un coup pour un non-défaut.
 *
 * CE QUI A CHANGÉ, ET POURQUOI CE N'EST PAS UN RÉGLAGE.
 *
 * Cette fonction attendait la DISPARITION du repli, par
 * `waitForElementToBeRemoved`, dont le budget d'horloge par défaut vaut mille
 * millisecondes. Ce budget est une COURSE : il tient sur une machine au repos
 * et tombe sur une machine chargée — deux portes de front, une intégration
 * continue, un portable qui compile. Trois fichiers sont tombés ainsi, et le
 * vert se rattrapait en relançant, ce qui est exactement le geste que ce
 * dépôt a passé trois lots à désapprendre.
 *
 * Le correctif ne rallonge pas le budget : il le SUPPRIME. On attend
 * désormais la promesse que la frontière elle-même expose — la technique que
 * `attendreLaLangue`, vingt lignes plus bas, applique depuis toujours à
 * l'autre frontière. Le moment cesse d'être probable pour devenir déterminé,
 * et aucune vitesse de machine ne peut plus le changer.
 *
 * MESURÉ : en ramenant le budget à 1 ms sur le fichier d'avant ce lot, 27
 * tests sur 31 échouaient sur machine au repos — 9/10 dans
 * `clavierDesModales`, 16/16 dans `origineDesTravaux`, 1/5 dans
 * `documentTitle`. Après ce correctif il n'y a plus de budget à rétrécir :
 * la mutation n'a plus de prise, ce qui est une preuve de structure et non
 * un taux de réussite.
 *
 * `act`, pour la même raison qu'`attendreLaLangue` : la résolution de `lazy`
 * provoque un rendu que React doit purger avant qu'on rende la main, sans
 * quoi le test lirait le DOM d'avant la substitution.
 */
async function attendreLEspaceApplicatif(): Promise<void> {
  const repli = screen.queryByTestId('chargement-espace-applicatif')
  if (!repli) return
  await act(async () => {
    await chargerEspaceApplicatif()
    /*
      LE TOUR DE BOUCLE, et il n'est pas un budget.

      Attendre la promesse ne suffit pas : quand elle se résout, React n'a fait
      que NOTER que le composant paresseux est prêt. Le nouveau rendu de la
      frontière `Suspense` est programmé dans la boucle d'événements, pas dans
      la micro-tâche courante — sans ce tour, `renderApp` rendait la main sur un
      DOM qui portait encore la coquille et pas `<main>`, et deux cas le
      voyaient.

      `0` : c'est un TOUR CÉDÉ, pas un délai. Il ne mesure rien et ne peut pas
      expirer, à la différence du budget de mille millisecondes qu'il remplace.
      C'est la distinction exacte que `budgetsDHorloge.test.ts` encode pour
      absoudre le `setTimeout(resolve, 0)` de `downloads.ts`.
    */
    await new Promise((resoudre) => setTimeout(resoudre, 0))
  })
}

/**
 * Attend la résolution de la SECONDE frontière paresseuse : le dictionnaire
 * anglais (voir I18nProvider.tsx). Pas de marqueur DOM ici, volontairement —
 * `I18nProvider` ne monte RIEN qui porte cette frontière tant qu'elle n'est
 * pas résolue (voir son en-tête : une chaîne vide n'est pas une absence,
 * donc le sous-arbre entier reste démonté plutôt que monté avec des trous).
 * `chargerAnglais` est donc le seul repère : sa promesse est PARTAGÉE avec
 * l'effet du fournisseur, qui y pose `setAnglais` une fois résolue.
 *
 * `act`, et non un simple `await` : `setAnglais` se pose dans l'effet
 * d'`I18nProvider`, pas ici. Sans `act`, React avertirait d'une mise à jour
 * hors de son contrôle, et rien ne garantirait que le DOM porte déjà le
 * texte anglais au retour de cette fonction — la même panne, en somme, que
 * celle qu'`attendreLEspaceApplicatif` évite pour l'autre frontière.
 *
 * APPELÉE AVANT `attendreLEspaceApplicatif`, et c'est devenu un ordre
 * OBLIGÉ : tant que cette frontière-ci n'est pas résolue, `<App/>` n'est pas
 * monté DU TOUT — son propre découpage paresseux (`/app`, `/demo`) n'a donc
 * pas encore commencé à charger, et son marqueur ne peut pas encore exister.
 * L'inverser ferait chercher `attendreLEspaceApplicatif` un marqueur qui n'a
 * pas eu la chance d'apparaître, et cette fonction rendrait la main trop tôt.
 */
async function attendreLaLangue(locale: Locale): Promise<void> {
  if (locale !== 'en') return
  await act(async () => {
    await chargerAnglais()
  })
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
 * défaut qu'`attendreLEspaceApplicatif` peut absorber seule.
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
  /*
    `matchMedia` RÉPOND PAR LA LARGEUR, au lieu de répondre « faux » à tout.

    Elle n'interprète que `min-width` en `rem` ou en pixels : ce sont les seules
    requêtes que le produit pose — `useAuDela` les écrit en `rem` exprès, pour
    suivre la feuille de style quand la police de base grossit. Toute autre
    requête garde le comportement de jsdom, `false`, plutôt qu'une réponse
    inventée : un cas qui dépendrait d'une requête non gérée doit rougir, pas
    recevoir un oui de complaisance.

    `vi.stubGlobal` : `setup.ts` appelle `unstubAllGlobals` après chaque cas, la
    fuite d'un test à l'autre est donc déjà tenue.
  */
  const largeur = preferences.largeur ?? 1280
  vi.stubGlobal('matchMedia', (requete: string) => {
    const min = /min-width:\s*([\d.]+)(rem|px)/.exec(requete)
    const seuil = min ? Number(min[1]) * (min[2] === 'rem' ? 16 : 1) : Infinity
    return {
      matches: largeur >= seuil,
      media: requete,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  })

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

  await attendreLaLangue(preferences.locale ?? 'fr')
  await attendreLEspaceApplicatif()

  return resultat
}

/** Rend un composant isolé avec les mêmes providers, sans routeur d'application. */
export function renderWithProviders(
  ui: ReactElement,
  preferences: PreferencesTest = {},
): RenderResult {
  /*
    `matchMedia` RÉPOND PAR LA LARGEUR, au lieu de répondre « faux » à tout.

    Elle n'interprète que `min-width` en `rem` ou en pixels : ce sont les seules
    requêtes que le produit pose — `useAuDela` les écrit en `rem` exprès, pour
    suivre la feuille de style quand la police de base grossit. Toute autre
    requête garde le comportement de jsdom, `false`, plutôt qu'une réponse
    inventée : un cas qui dépendrait d'une requête non gérée doit rougir, pas
    recevoir un oui de complaisance.

    `vi.stubGlobal` : `setup.ts` appelle `unstubAllGlobals` après chaque cas, la
    fuite d'un test à l'autre est donc déjà tenue.
  */
  const largeur = preferences.largeur ?? 1280
  vi.stubGlobal('matchMedia', (requete: string) => {
    const min = /min-width:\s*([\d.]+)(rem|px)/.exec(requete)
    const seuil = min ? Number(min[1]) * (min[2] === 'rem' ? 16 : 1) : Infinity
    return {
      matches: largeur >= seuil,
      media: requete,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  })

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
