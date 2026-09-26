import { beforeEach, describe, expect, it } from 'vitest'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import { renderApp, screen, userEvent, SESSION_ANONYME } from '@/test/render'
import { chargerEspaceApplicatif } from '@/App'

/**
 * ═══ LE MÊME DÉFAUT QUE L'INSCRIPTION, SUR L'AUTRE PORTE ═══
 *
 * `connecter` enchaîne `POST /auth/login` puis `GET /auth/me` — on relit la
 * session plutôt que de se fier au corps de la réponse, parce que les adhésions
 * n'y sont pas. Les deux `await` ne se distinguaient pas : l'échec du second se
 * lisait comme un échec du premier, et le formulaire annonçait « Une erreur
 * inattendue est survenue » à quelqu'un qui VENAIT DE S'AUTHENTIFIER, cookie
 * posé.
 *
 * ═══ POURQUOI LE REMÈDE N'EST PAS CELUI DE L'INSCRIPTION ═══
 *
 * L'écran de succès de l'inscription ANNONCE le compte créé et renvoie se
 * connecter, parce que là-bas le danger est le réessai : il bute sur 409, et
 * l'utilisateur conclut que son adresse est prise par un inconnu.
 *
 * Ici, rien n'est détruit par un réessai — et surtout, la coquille sait déjà
 * traiter ce cas. `RequireAuth` porte DEUX écrans terminaux pour une session
 * qu'on n'a pas pu lire : « serveur injoignable » et « échec de la session »,
 * chacun avec un bouton de reprise qui rejoue `/auth/me` SANS redemander le mot
 * de passe. Le défaut n'était donc pas qu'il manquait un écran, c'est que la
 * connexion refusait d'y mener : elle retenait l'utilisateur devant un
 * formulaire en lui disant que sa connexion avait échoué, alors qu'il lui
 * suffisait d'appuyer sur « Réessayer » de l'autre côté.
 *
 * On ne rend donc PAS un message de plus : on laisse passer vers l'endroit qui
 * porte la reprise.
 */
describe('la session qui échoue après la connexion', () => {
  let serveur: FauxServeur

  beforeEach(() => {
    serveur = installerFauxServeur({ authentifie: false })
  })

  /**
   * Le parcours, repris de `wiring.test.tsx` — même formulaire, mêmes raisons.
   * `SESSION_ANONYME` parce que c'est l'état de qui se connecte, et la frontière
   * paresseuse de `/app` est résolue AVANT le clic : partant de `/connexion`
   * elle ne se résout qu'à la navigation, et la page resterait sur
   * « Chargement… » sans allonger aucun budget d'horloge.
   */
  async function seConnecter(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await chargerEspaceApplicatif()
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))
  }

  it('ne reproche plus une erreur au formulaire quand l’identification a réussi', async () => {
    serveur.quand('POST', '/auth/login', { status: 200, body: { user: COMPTE_FICTIF } })
    // Le serveur accepte les identifiants puis s'absente : l'ordre est tout.
    serveur.quand('GET', '/auth/me', { status: 500 })

    const user = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await seConnecter(user)

    /* L'ÉCRAN DE REPRISE, et non le formulaire : la session est ouverte côté
       serveur, c'est sa LECTURE qui a manqué. */
    expect(
      await screen.findByRole('button', { name: /réessayer/i }),
      'la reprise n’est pas proposée',
    ).toBeInTheDocument()

    expect(
      screen.queryByText(/la connexion a échoué/i),
      'le formulaire reproche encore une erreur qui n’a pas eu lieu',
    ).toBeNull()
    expect(
      screen.queryByText(/mot de passe incorrect/i),
      'le formulaire met en doute des identifiants que le serveur a acceptés',
    ).toBeNull()
  })

  it('garde le refus quand ce sont les IDENTIFIANTS qui sont refusés', async () => {
    /* LE CONTREPOIDS, et il est la moitié du lot. Laisser passer un 401 ferait
       entrer dans l'application quelqu'un que le serveur vient d'éconduire —
       le défaut inverse, et le seul des deux qui touche à l'accès. */
    serveur.quand('POST', '/auth/login', { status: 401 })

    const user = userEvent.setup()
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await seConnecter(user)

    expect(
      await screen.findByText(/mot de passe incorrect/i),
      'le refus d’identifiants ne se lit plus',
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /réessayer/i }),
      'un refus d’identifiants propose une reprise de session',
    ).toBeNull()
  })
})
