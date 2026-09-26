import { beforeEach, describe, expect, it } from 'vitest'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * ═══ LE COMPTE EXISTE, ET L'ÉCRAN DIT QUE LA CRÉATION A ÉCHOUÉ ═══
 *
 * L'inscription ne se conclut PAS sur la réponse de `/auth/signup`. Elle
 * enchaîne sur `/auth/me` — on relit la session plutôt que de se fier au corps
 * de la réponse, et `SessionProvider` explique pourquoi : les adhésions n'y
 * sont pas, et deux chemins d'hydratation divergeraient. C'est juste.
 *
 * Ce qui ne l'est pas : `inscrire` enchaînait les deux `await` sans les
 * distinguer, si bien que l'échec du SECOND se lisait comme un échec du
 * PREMIER. Relevé au navigateur, sur ce dépôt, en simulant un serveur absent
 * après création : `POST /auth/signup` rend 201, `GET /auth/me` rend 500, et
 * l'écran affiche « La création du compte a échoué. Vos réponses sont
 * conservées : réessayez. »
 *
 * ═══ CE QUE CE MENSONGE COÛTE, ET IL S'AGGRAVE TOUT SEUL ═══
 *
 * Le marché visé est un réseau mobile lent sur appareil d'entrée de gamme —
 * c'est écrit dans la garde des poids d'écran. Une création qui passe et une
 * relecture qui expire n'y est pas un cas d'école. L'utilisateur lit un échec,
 * réessaie comme le message l'y invite, et tombe cette fois sur 409 : l'adresse
 * est déjà prise. Par la sienne. Le message est alors faux DANS LES DEUX SENS,
 * et le second est celui qui bloque.
 *
 * ═══ CE QUE CES CAS EXIGENT ═══
 *
 * Que les deux échecs se lisent différemment, parce qu'ils appellent des gestes
 * opposés : recommencer quand rien n'a été créé, se connecter quand tout l'a
 * été. Le troisième cas garde le premier échec, pour qu'on ne « répare » pas
 * celui-ci en avalant l'autre.
 */
describe('la session qui échoue après la création', () => {
  let serveur: FauxServeur

  beforeEach(() => {
    /* NON AUTHENTIFIÉ : c'est l'état de qui s'inscrit, et il fait jouer la
       résolution de session pour de bon. */
    serveur = installerFauxServeur({ authentifie: false })
  })

  /** Le parcours complet, repris de `wiring.test.tsx` — même assistant. */
  async function allerJusquAuRecapitulatif(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = await screen.findByLabelText(/^pays/i)
    await user.click(pays)
    await user.type(pays, 'camer')
    await user.click(screen.getByRole('option', { name: 'Cameroun' }))
    await user.type(screen.getByLabelText(/nom de votre parc/i), 'Parc Bonamoussadi')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    await screen.findByRole('heading', { name: /tout est correct/i })
    await user.click(screen.getByLabelText(/j’ai lu la politique de confidentialité/i))
  }

  it('ne dit plus que la création a échoué quand le compte est créé', async () => {
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })
    // Le serveur répond à la création puis s'absente : c'est l'ordre qui compte.
    serveur.quand('GET', '/auth/me', { status: 500 })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await allerJusquAuRecapitulatif(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    /* L'écran de succès, et non le récapitulatif : le compte EXISTE, le
       reproche n'a plus d'objet. */
    expect(
      await screen.findByRole('heading', { name: /votre espace est prêt/i }),
      'l’écran de succès ne s’affiche pas',
    ).toBeInTheDocument()

    expect(
      screen.queryByText(/la création du compte a échoué/i),
      'l’écran dit encore que la création a échoué',
    ).toBeNull()
  })

  it('envoie se connecter plutôt qu’au tableau de bord', async () => {
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })
    serveur.quand('GET', '/auth/me', { status: 500 })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await allerJusquAuRecapitulatif(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))
    await screen.findByRole('heading', { name: /votre espace est prêt/i })

    /* LA SORTIE SUIT L'ÉTAT RÉEL. La session n'est pas ouverte : proposer « le
       tableau de bord » enverrait sur une route gardée qui rebondirait vers la
       connexion — un aller-retour que l'écran peut s'épargner puisqu'il SAIT. */
    const sortie = screen.getByRole('link', { name: /se connecter/i })
    expect(sortie.getAttribute('href'), 'la sortie ne mène pas à la connexion').toContain(
      '/connexion',
    )
    expect(
      screen.queryByRole('link', { name: /ouvrir le tableau de bord/i }),
      'l’écran propose un tableau de bord qu’il ne peut pas ouvrir',
    ).toBeNull()
  })

  it('garde le refus quand c’est la CRÉATION qui échoue', async () => {
    /* LE CONTREPOIDS, et il est la moitié du lot. Avaler l'échec de `/auth/me`
       sans distinguer les deux appels ferait paraître une inscription réussie
       là où rien n'a été créé — le défaut inverse, et le plus grave des deux. */
    serveur.quand('POST', '/auth/signup', { status: 500 })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await allerJusquAuRecapitulatif(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    expect(
      await screen.findByText(/la création du compte a échoué/i),
      'le refus de création ne se lit plus',
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /votre espace est prêt/i }),
      'l’écran annonce un espace prêt alors que rien n’a été créé',
    ).toBeNull()
  })
})
