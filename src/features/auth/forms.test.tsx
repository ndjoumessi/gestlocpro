import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

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
    await renderApp('/connexion')

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    const alertes = screen.getAllByRole('alert')
    expect(alertes).toHaveLength(2)
    expect(alertes[0]).toHaveTextContent('Indiquez votre adresse e-mail.')
    /* « Saisissez », et non « Choisissez » : on se connecte avec le mot de passe
       qu'on a. Le message était unique pour les trois écrans, donc juste sur les
       deux où l'on en crée un et faux sur celui-ci — voir `validatePassword`. */
    expect(alertes[1]).toHaveTextContent('Saisissez votre mot de passe.')
  })

  it('place le focus sur le premier champ fautif', async () => {
    const user = userEvent.setup()
    await renderApp('/connexion')

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(screen.getByLabelText(/adresse e-mail/i)).toHaveFocus()
  })

  /**
   * LE CAS DU COMBOBOX, celui que le sélecteur ne trouvait pas.
   *
   * La règle ci-dessus était appliquée à l'inscription, et elle y échouait EN
   * SILENCE sur le pays. Le champ se cherchait par `[name="…"]`, ce qui ne
   * pouvait désigner que l'entrée CACHÉE du combobox — celle qui transporte le
   * code ISO à la soumission native. Un champ caché ne prend pas le focus :
   * l'appel ne faisait rien, et l'optionalité écrite pour jsdom rendait la
   * panne muette.
   *
   * Le pays est la PREMIÈRE clé que produit la validation de son étape, donc le
   * refus le plus fréquent de cet écran — et celui où le bouton paraissait le
   * plus inerte.
   */
  it('place le focus sur un combobox fautif, et pas sur son champ caché', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Sarah Mbala')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '699112233')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    // L'étape « contexte » s'ouvre avec un pays vide : on la soumet telle quelle.
    await screen.findByLabelText(/^pays/i)
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = screen.getByLabelText(/^pays/i)
    expect(pays).toHaveFocus()
    // Et c'est bien le champ VISIBLE : un `type="hidden"` ne se focalise pas,
    // donc l'assertion ci-dessus ne pourrait pas passer sur lui — mais on le
    // dit, parce que c'est exactement l'élément que l'ancien sélecteur trouvait.
    expect(pays).not.toHaveAttribute('type', 'hidden')
  })

  it('dit comment réparer, et pas seulement que c’est invalide', async () => {
    const user = userEvent.setup()
    await renderApp('/connexion')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@')
    await user.tab()

    // Le message porte le format attendu, pas un « saisie invalide » sec.
    expect(screen.getByRole('alert')).toHaveTextContent('nom@domaine.com')
  })

  it('ne valide pas pendant la frappe', async () => {
    const user = userEvent.setup()
    await renderApp('/connexion')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sar')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('associe chaque champ à un libellé visible', async () => {
    await renderApp('/connexion')
    // `getByLabelText` échoue si l'association label/champ est rompue.
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Mot de passe/)).toBeInTheDocument()
  })
})

describe('mot de passe oublié', () => {
  it('ne confirme jamais qu’un compte existe', async () => {
    // La demande PART désormais : l'écran ne bascule qu'une fois le 202 reçu,
    // là où un `setTimeout` annonçait un envoi qui n'avait jamais lieu. Sans
    // ce faux serveur, ce cas éprouverait l'échec de transport au lieu du
    // message qu'il vise.
    installerFauxServeur().quand('POST', '/auth/forgot', { status: 202, body: { ok: true } })
    const user = userEvent.setup()
    await renderApp('/mot-de-passe-oublie')

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
  /**
   * L'EXIGENCE RESTE, LA FAÇON DE LA DIRE A CHANGÉ.
   *
   * Le bouton était ÉTEINT tant qu'aucun rôle n'était choisi : une porte fermée
   * sans écriteau, qui ne prend pas le focus et n'énonce rien. Il reste
   * cliquable, et le refus s'écrit au groupe de rôles — voir
   * `routes/refusLisible.test.tsx`, qui tient les deux moitiés.
   *
   * Ce cas garde la moitié qui compte ici : on ne passe pas sans rôle.
   */
  it('exige un rôle avant de continuer', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription')

    await user.click(screen.getByRole('button', { name: /continuer/i }))

    expect(
      screen.getByRole('heading', { level: 1 }),
      'la première étape a été franchie sans rôle',
    ).toHaveTextContent(/Qui êtes-vous/)
  })

  it('saute le choix de rôle quand l’URL le porte déjà', async () => {
    await renderApp('/inscription/proprietaire')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Votre identité')
  })

  it('met en forme le code d’invitation au fil de la frappe', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/locataire')

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
    await renderApp('/inscription/locataire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Charles Ngassa')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'charles@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '699112233')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'MonBail2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    /*
      Le pays est choisi d'abord : il est requis depuis qu'il n'arrive plus
      pré-rempli, et sans lui l'étape porterait DEUX refus. Ce cas éprouve celui
      du code, pas le nombre de champs incomplets qu'on peut accumuler.
    */
    const pays = await screen.findByLabelText(/^pays/i)
    await user.click(pays)
    await user.type(pays, 'camer')
    await user.click(screen.getByRole('option', { name: 'Cameroun' }))
    await user.type(screen.getByLabelText(/code d’invitation/i), 'loc12')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    // Deux annonces, et c'est voulu : à côté du champ ET au bord du bouton.
    // On ne sait pas laquelle des deux zones l'utilisateur regarde — c'est ce
    // doute qui a fait passer un bouton pour inerte lors de la création du
    // premier compte du produit.
    const alertes = screen.getAllByRole('alert')
    expect(alertes.length).toBeGreaterThanOrEqual(2)
    for (const alerte of alertes) expect(alerte).toHaveTextContent('LOC-XXXX-XXXX')
  })

  it('laisse le pays pré-remplir la devise et la langue', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = await screen.findByLabelText(/^pays/i)
    await user.click(pays)
    await user.type(pays, 'France')
    await user.click(screen.getByRole('option', { name: 'France' }))

    /* La France emporte l'euro : le pré-remplissage doit se voir CHANGER, sinon
       le test se contenterait de la valeur par défaut du Cameroun.

       `/^devise/i` ANCRÉ AU DÉBUT, comme `/^pays/i` deux lignes plus haut. Le
       motif libre attrapait aussi le déclencheur des réglages, dont le nom
       accessible est « Réglages : langue, devise et thème » — deux choses qui
       portent le mot sur le même écran, et qui n'ont rien à voir : celle-ci est
       la devise du PARC qu'on crée, celle-là celle dans laquelle on LIT. */
    expect(screen.getByLabelText(/^devise/i)).toHaveValue('EUR')

    await user.click(pays)
    await user.type(pays, 'Sénég')
    await user.click(screen.getByRole('option', { name: 'Sénégal' }))

    // Le Sénégal relevait du XOF et le Cameroun du XAF ; les deux zones franc
    // sont désormais regroupées sous une seule devise.
    expect(screen.getByLabelText(/^devise/i)).toHaveValue('CFA')
  })

  /**
   * L'indicatif REMONTE vers le pays, et pas seulement l'inverse.
   *
   * Le défaut qui a produit deux réponses contradictoires sur le même écran :
   * on choisissait « France · +33 » et le récapitulatif annonçait « Pays :
   * Cameroun » — la valeur déduite de la devise au premier rendu, jamais
   * corrigée. C'est celle qu'on n'avait pas choisie qui partait au serveur,
   * entraînant la devise, la langue et le format des dates.
   *
   * Ce sens de la relation n'était tenu par aucun test : on a pu supprimer
   * `paysDeLIndicatif` en entier sans qu'une seule des 513 assertions bronche.
   */
  it('fait remonter l’indicatif vers le pays, devise comprise', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')

    const indicatif = screen.getByLabelText(/indicatif/i)
    await user.click(indicatif)
    await user.type(indicatif, 'France')
    await user.click(screen.getByRole('option', { name: /^France · \+33$/ }))

    await user.click(screen.getByRole('button', { name: /continuer/i }))

    // Le pays a suivi l'indicatif, et avec lui la devise du pays servi.
    const pays = await screen.findByLabelText(/^pays/i)
    expect(pays).toHaveValue('France')
    expect(screen.getByLabelText(/^devise/i)).toHaveValue('EUR')
  })

  /**
   * La remontée vaut sur le MONDE, pas sur les seuls pays servis.
   *
   * `+263` ne nomme que le Zimbabwe. S'en tenir aux vingt et un pays servis
   * laisserait à nouveau les deux champs se contredire, sur un pays que la
   * liste sait pourtant nommer. Ce qui reste réservé aux pays servis, c'est le
   * pré-remplissage de la devise — pas l'identification du pays.
   */
  it('remonte aussi vers un pays non desservi, sans lui inventer de devise', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')

    const indicatif = screen.getByLabelText(/indicatif/i)
    await user.click(indicatif)
    await user.type(indicatif, 'Zimb')
    await user.click(screen.getByRole('option', { name: /^Zimbabwe · \+263$/ }))

    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = await screen.findByLabelText(/^pays/i)
    expect(pays).toHaveValue('Zimbabwe')
    // Le Cameroun par défaut tient : deviner une devise pour le Zimbabwe serait
    // une invention, et une invention fausse coûte plus qu'un champ à régler.
    expect(screen.getByLabelText(/^devise/i)).toHaveValue('CFA')
  })

  /**
   * Un indicatif PARTAGÉ ne désigne rien, et doit donc ne rien changer.
   *
   * `+1` couvre vingt-cinq territoires. Deviner y serait pire que se taire,
   * puisque le pays pilote aussi la devise, la langue et le format des dates.
   */
  it('ne déduit aucun pays d’un indicatif partagé', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')

    const indicatif = screen.getByLabelText(/indicatif/i)
    await user.click(indicatif)
    await user.type(indicatif, 'Canada')
    await user.click(screen.getByRole('option', { name: /· \+1$/ }))

    await user.click(screen.getByRole('button', { name: /continuer/i }))

    /*
      Le champ reste VIDE, et c'est une assertion plus forte qu'avant : il
      portait « Cameroun » par pré-remplissage, ce qui masquait la question que
      ce cas pose. Un « +1 » est partagé par le Canada et les États-Unis — en
      déduire un pays serait tirer à pile ou face sur la devise d'un parc.
    */
    const pays = await screen.findByLabelText(/^pays/i)
    expect(pays).toHaveValue('')
  })

  /**
   * Le champ pays proposait vingt et un pays dans un menu nu, quand le
   * sélecteur d'indicatifs voisin en propose deux cent quatre et se cherche à
   * la frappe. Deux listes de tailles très différentes pour la même notion, sur
   * deux étapes voisines : un bailleur de Harare choisissait « Autre pays » —
   * donc AUCUN pays n'était enregistré — alors que son indicatif, lui, était
   * connu au caractère près.
   */
  it('ouvre le pays au monde entier, et le rend cherchable', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = await screen.findByLabelText(/^pays/i)
    await user.click(pays)
    await user.type(pays, 'zimb')
    await user.click(screen.getByRole('option', { name: 'Zimbabwe' }))

    expect(pays).toHaveValue('Zimbabwe')
    // Un pays hors du marché servi ne porte ni devise ni langue : le choix
    // précédent tient, et l'utilisateur tranche lui-même. Deviner « dollar »
    // pour le Zimbabwe serait une invention, pas un pré-remplissage.
    expect(screen.getByLabelText(/^devise/i)).toHaveValue('CFA')
  })

  it('garde le jeton de remplissage automatique sur le pays', async () => {
    // Le jeton s'était déjà perdu une fois en passant d'un menu natif à un
    // champ cherchable, sur l'indicatif. Le pays emprunte le même chemin.
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = await screen.findByLabelText(/^pays/i)
    expect(pays.getAttribute('autocomplete')).toBe('country')
  })

  /**
   * Dix lignes, dix fois le mot « Modifier », en colonne.
   *
   * La répétition noyait l'action utile : pour trouver la ligne à corriger, il
   * fallait lire dix fois la même étiquette. Le récapitulatif se lit désormais
   * par étape d'origine — rôle, identité, contexte — avec une seule issue de
   * correction par groupe, et chacune nommée pour qui ne voit pas l'écran.
   */
  it('n’offre qu’une issue de correction par étape, et la nomme', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

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

    const corrections = screen.getAllByRole('button', { name: /modifier/i })
    expect(corrections).toHaveLength(3)

    // Et chaque issue ramène à l'étape qui porte le champ.
    await user.click(screen.getByRole('button', { name: /modifier.*votre identité/i }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Votre identité')
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
    await renderApp('/inscription/proprietaire')

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
    async (route) => {
      await renderApp(route)

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
    await renderApp('/inscription/proprietaire')

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

  /**
   * LA JAUGE DE MOT DE PASSE SE DIT, au lieu de n'être que quatre barres.
   *
   * Les barres sont `aria-hidden`, et c'est juste : ce sont des formes. Mais le
   * mot qui les traduit était rendu dans un élément INERTE — un lecteur d'écran
   * n'apprenait donc jamais que le mot de passe qu'on tape est refusable, alors
   * que c'est la seule information du composant.
   *
   * Ce cas vérifie la RÉGION vivante, pas le mot.
   *
   * Sa première rédaction promettait déjà cela et faisait l'inverse : elle
   * cherchait `/faible|correct|bon|fort/i`, c'est-à-dire le barème qu'elle
   * prétendait ne pas recopier. Deux conséquences, et les deux se sont
   * produites. Le barème a dérivé sans qu'elle bronche — les libellés disent
   * « Moyen » et « Robuste », jamais « correct » ni « fort », si bien qu'elle ne
   * tenait plus que par « faible ». Puis renommer ce seul niveau en « Trop
   * court » l'a fait tomber, alors que RIEN de ce qu'elle garde n'avait bougé.
   *
   * On vise donc l'apparition de la région : rien d'annoncé tant qu'on n'a pas
   * tapé, une région polie et non vide dès qu'on tape. Le vocabulaire des
   * niveaux reste libre ; c'est `jaugeEtRefus.test.ts` qui tient leur SENS.
   */
  it('annonce le niveau du mot de passe au fil de la frappe', async () => {
    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')

    const parlantes = () =>
      Array.from(document.querySelectorAll('[aria-live]')).filter((r) => r.textContent?.trim())

    expect(parlantes(), 'une région parle avant toute frappe').toHaveLength(0)

    await user.type(screen.getByLabelText(/^Mot de passe/), 'abc')

    const jauge = parlantes()
    expect(jauge, 'rien n’est annoncé après la frappe').toHaveLength(1)
    expect(jauge[0]).toHaveAttribute('aria-live', 'polite')
  })
})