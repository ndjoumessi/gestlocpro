import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * Comportement des formulaires.
 *
 * Trois règles s'appliquent partout dans le produit et sont ici verrouillées :
 * l'erreur se signale **sous le champ** concerné et non en tête de formulaire,
 * elle **dit comment réparer** plutôt que de constater l'échec, et le focus
 * revient sur le **premier champ fautif**.
 *
 * La validation se déclenche à la sortie du champ, jamais pendant la frappe :
 * signaler une adresse invalide après trois caractères revient à harceler
 * quelqu'un qui est en train d'écrire.
 */

describe('connexion', () => {
  it('refuse une soumission vide et signale les deux champs', async () => {
    const user = userEvent.setup()
    renderApp('/connexion')

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    const alertes = screen.getAllByRole('alert')
    expect(alertes).toHaveLength(2)
    expect(alertes[0]).toHaveTextContent('Indiquez votre adresse e-mail.')
    expect(alertes[1]).toHaveTextContent('Choisissez un mot de passe.')
  })

  it('place le focus sur le premier champ fautif', async () => {
    const user = userEvent.setup()
    renderApp('/connexion')

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(screen.getByLabelText(/adresse e-mail/i)).toHaveFocus()
  })

  it('dit comment réparer, et pas seulement que c’est invalide', async () => {
    const user = userEvent.setup()
    renderApp('/connexion')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@')
    await user.tab()

    // Le message porte le format attendu, pas un « saisie invalide » sec.
    expect(screen.getByRole('alert')).toHaveTextContent('nom@domaine.com')
  })

  it('ne valide pas pendant la frappe', async () => {
    const user = userEvent.setup()
    renderApp('/connexion')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sar')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('associe chaque champ à un libellé visible', () => {
    renderApp('/connexion')
    // `getByLabelText` échoue si l'association label/champ est rompue.
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Mot de passe/)).toBeInTheDocument()
  })
})

describe('mot de passe oublié', () => {
  it('ne confirme jamais qu’un compte existe', async () => {
    const user = userEvent.setup()
    renderApp('/mot-de-passe-oublie')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    // Le conditionnel est délibéré : confirmer l'existence d'un compte
    // renseignerait un attaquant sur la liste des utilisateurs. La page doit
    // dire la même chose que l'adresse soit connue ou non.
    // `name` est indispensable : sans lui, `findByRole` se résout sur le
    // premier h1 venu — celui d'avant l'envoi — au lieu d'attendre le nouveau.
    expect(
      await screen.findByRole('heading', { level: 1, name: /Vérifiez votre boîte mail/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Si un compte existe/)).toBeInTheDocument()
  })
})

describe('inscription', () => {
  it('exige un rôle avant de continuer', () => {
    renderApp('/inscription')
    expect(screen.getByRole('button', { name: /continuer/i })).toBeDisabled()
  })

  it('saute le choix de rôle quand l’URL le porte déjà', () => {
    renderApp('/inscription/proprietaire')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vos informations')
  })

  it('met en forme le code d’invitation au fil de la frappe', async () => {
    const user = userEvent.setup()
    renderApp('/inscription/locataire')

    // Étape identité, puis contexte.
    await user.type(screen.getByLabelText(/nom complet/i), 'Charles Ngassa')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'charles@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '699112233')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'MonBail2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const champ = await screen.findByLabelText(/code d’invitation/i)
    // Le locataire recopie un code reçu par SMS : les tirets se posent seuls.
    await user.type(champ, 'loc4a7b92cd')
    expect(champ).toHaveValue('LOC-4A7B-92CD')
  })

  it('refuse un code d’invitation incomplet en donnant le format attendu', async () => {
    const user = userEvent.setup()
    renderApp('/inscription/locataire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Charles Ngassa')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'charles@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '699112233')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'MonBail2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    await user.type(await screen.findByLabelText(/code d’invitation/i), 'loc12')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('LOC-XXXX-XXXX')
  })

  it('laisse le pays pré-remplir la devise et la langue', async () => {
    const user = userEvent.setup()
    renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = await screen.findByLabelText(/^pays/i)
    await user.selectOptions(pays, 'SN')

    // Le Sénégal relevait du XOF et le Cameroun du XAF ; les deux zones franc
    // sont désormais regroupées sous une seule devise.
    expect(screen.getByLabelText(/devise/i)).toHaveValue('CFA')
  })
  /**
   * Le récapitulatif taisait les réponses propres au rôle.
   *
   * L'écran annonce « dernière vérification avant la création de votre
   * espace » et n'affichait ni le nom du parc, ni le nombre d'unités, ni le
   * mode de gestion — trois réponses saisies à l'écran précédent. Le nom du
   * parc est de surcroît ce qui s'affichera en tête de l'espace créé : c'est
   * la ligne qu'on veut relire avant de valider.
   */
  it('récapitule aussi les réponses propres au rôle', async () => {
    const user = userEvent.setup()
    renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    await user.type(await screen.findByLabelText(/nom de votre parc/i), 'Parc Bonamoussadi')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const recap = await screen.findByRole('heading', { name: /tout est correct/i })
    expect(recap).toBeInTheDocument()

    expect(screen.getByText('Parc Bonamoussadi')).toBeInTheDocument()
    expect(screen.getByText('Je gère seul')).toBeInTheDocument()

    // Libellés de récapitulatif, courts, et non ceux du formulaire : « Comment
    // gérez-vous au quotidien ? » est une question posée à qui remplit, pas le
    // nom d'une donnée qu'on relit.
    expect(screen.getByText('Gestion')).toBeInTheDocument()
    expect(screen.queryByText(/Comment gérez-vous/)).not.toBeInTheDocument()
    // Et les réponses des étapes précédentes restent présentes.
    expect(screen.getByText('arsene@example.com')).toBeInTheDocument()
  })
})

/**
 * Issue vers l'accueil.
 *
 * Les quatre pages d'authentification étaient un cul-de-sac sur ordinateur :
 * le lien de retour portait `lg:hidden` et le logo n'était pas cliquable. On y
 * entrait depuis la landing sans pouvoir y revenir autrement que par le bouton
 * du navigateur.
 *
 * jsdom n'applique pas les media queries, donc le lien y était visible même
 * avant la correction — c'est pourquoi le défaut a tenu. Ce test vérifie donc
 * ce que jsdom PEUT établir : que les deux issues existent, et que leur
 * libellé ne se confond pas avec le retour d'étape de l'inscription.
 */
describe('retour à l’accueil depuis l’authentification', () => {
  it.each(['/connexion', '/inscription', '/mot-de-passe-oublie'])(
    '%s offre un lien vers l’accueil et un logo cliquable',
    (route) => {
      renderApp(route)

      const versAccueil = screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') === '/')

      // Deux issues : le lien libellé, et le logo par convention.
      expect(versAccueil.length).toBeGreaterThanOrEqual(2)
      expect(
        screen.getByRole('link', { name: /retour à l’accueil/i }),
      ).toBeInTheDocument()
    },
  )

  it('ne confond pas le retour d’étape avec le retour à l’accueil', async () => {
    const user = userEvent.setup()
    renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    // « Retour » ramène à l'étape précédente, « Retour à l'accueil » quitte le
    // parcours. Deux destinations, deux libellés.
    expect(await screen.findByRole('button', { name: 'Retour' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /retour à l’accueil/i })).toHaveAttribute('href', '/')
  })
})
