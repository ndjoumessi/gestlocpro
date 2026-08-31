import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, SESSION_ANONYME, attendreLeChargement, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import { chargerEspaceApplicatif } from '@/App'

/** Un parc minimal : le tableau de bord rend sa vue consolidée, pas son accueil. */
const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Résidence de test',
      district: 'Bastos',
      units: [
        {
          id: 'unite-1',
          label: 'A1',
          type: 'T2',
          surfaceSqm: 52,
          rentMinor: 90000,
          /* UN LOGEMENT LOUÉ, et non vacant : sur un parc sans aucun bail, le
             tableau de bord rend son état d'accueil — « le parc est neuf » —
             qui REMPLACE la vue consolidée. Ces cas portent sur la navigation,
             pas sur cet état-là. */
          tenant: { id: 'loc-1', fullName: 'Charles Ngassa', phoneE164: null },
          status: 'paid',
          leaseId: 'bail-1',
          leaseStartsOn: '2025-03-01T00:00:00.000Z',
          paidMinor: 90000,
          overdueDays: null,
        },
      ],
    },
  ],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
  leaseCharges: [],
}

const PARC_CONNEXION = '99999999-1111-4222-8333-444444444444'

/**
 * Raccordement des écrans d'authentification à l'API.
 *
 * Ce que ces tests gardent tient en une phrase : les formulaires **appellent
 * réellement le serveur**. Ils validaient neuf champs puis faisaient
 * `navigate('/app')` et `setDone(true)` — la saisie était jetée, et l'écran de
 * succès ne recouvrait rien. Un écran qui affiche « votre espace est prêt »
 * sans compte créé est le mensonge le plus coûteux du produit : l'utilisateur
 * repart en croyant avoir un accès.
 */

async function remplirIdentite(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
  await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
  await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
  await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
  await user.click(screen.getByRole('button', { name: /continuer/i }))
  /*
    Le PAYS se choisit désormais : il n'arrive plus pré-rempli, déduit de la
    devise qu'affichait la vitrine. Ce parcours de test le traversait sans le
    voir, ce qui est exactement ce que faisait l'utilisateur.
  */
  const pays = await screen.findByLabelText(/^pays/i)
  await user.click(pays)
  await user.type(pays, 'camer')
  await user.click(screen.getByRole('option', { name: 'Cameroun' }))
  await user.type(screen.getByLabelText(/nom de votre parc/i), 'Parc Bonamoussadi')
  await user.click(screen.getByRole('button', { name: /continuer/i }))
  await screen.findByRole('heading', { name: /tout est correct/i })
  // Sans cette case, l'assistant refuse de soumettre — et c'est le
  // comportement voulu : l'acceptation est exigée avant toute création.
  await user.click(screen.getByLabelText(/j’accepte les conditions/i))
}

describe('connexion', () => {
  it('appelle le serveur et ouvre le tableau de bord', async () => {
    /* NON AUTHENTIFIÉ au départ : c'est l'état de qui se connecte, et il fait
       jouer la résolution de session pour de bon. */
    const serveur = installerFauxServeur({ authentifie: false })
    serveur.quand('POST', '/auth/login', { status: 200, body: { user: COMPTE_FICTIF } })
    /* LE PORTEFEUILLE EST STUBÉ AVANT LE RENDU, et l'ordre n'est pas
       cosmétique : posé après le montage, le faux serveur ne le sert pas — la
       page reste sur « Chargement… », mesuré. */
    serveur.quand('GET', `/parks/${PARC_CONNEXION}/portfolio`, { status: 200, body: PORTEFEUILLE })
    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC_CONNEXION, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })

    const user = userEvent.setup()
    /* DEPUIS L'ÉTAT ANONYME, et non depuis la session par défaut du harnais :
       c'est ce que fait quelqu'un qui se connecte, et c'est le seul état d'où
       la résolution de session est réellement jouée. */
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    /* LE MODULE DE `/app` EST PRÉCHARGÉ AVANT LE CLIC, et ce n'est pas une
       attente déguisée : `renderApp` fait exactement cela pour les routes qui
       commencent sous `/app`. Partant de `/connexion`, la frontière paresseuse
       ne se résout qu'À LA NAVIGATION — la sonde l'a montré, aucune requête de
       portefeuille ne partait et la page restait sur « Chargement… ». On
       résout la frontière, on n'allonge aucun budget d'horloge. */
    await chargerEspaceApplicatif()
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    const appel = serveur.appels.find((a) => a.chemin === '/auth/login')
    expect(appel).toBeDefined()
    /* `toEqual` et non `toMatchObject` : ce cas garde aussi qu'AUCUN champ de
       trop ne part vers `/auth/login`. `persistent` est le choix de la case
       « rester connecté sur cet appareil » — voir `sessionDeCetAppareil`, des
       deux côtés — et il est nommé ici parce qu'il doit l'être. */
    expect(appel?.corps).toEqual({
      email: 'sarah@example.com',
      password: 'un-mot-de-passe-assez-long',
      persistent: true,
    })

    /* `attendreLeChargement` — l'aide du harnais, celle que la moitié de la
       suite emploie — et non un budget d'horloge allongé. La connexion enchaîne
       désormais UNE requête de plus : `/auth/me` rend un parc, donc le
       portefeuille se charge avant que le tableau de bord ne s'écrive. On
       attend la fin des régions occupées, pas une durée. */
    await attendreLeChargement()
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /vue consolidée/i })).toBeInTheDocument(),
    )
  })

  it('rend un seul message pour un identifiant refusé, sur le formulaire', async () => {
    // Le serveur ne dit délibérément pas lequel des deux champs est faux : les
    // distinguer ferait de la connexion un oracle d'existence de comptes.
    // Poser l'erreur sous le champ e-mail rétablirait à l'écran ce que l'API
    // refuse de dire.
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/login', { status: 401, body: { error: 'invalid_credentials' } })

    const user = userEvent.setup()
    /* DEPUIS L'ÉTAT ANONYME, et non depuis la session par défaut du harnais :
       c'est ce que fait quelqu'un qui se connecte, et c'est le seul état d'où
       la résolution de session est réellement jouée. */
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'ce-n-est-pas-le-bon')
    /* LE MODULE DE `/app` EST PRÉCHARGÉ AVANT LE CLIC, et ce n'est pas une
       attente déguisée : `renderApp` fait exactement cela pour les routes qui
       commencent sous `/app`. Partant de `/connexion`, la frontière paresseuse
       ne se résout qu'À LA NAVIGATION — la sonde l'a montré, aucune requête de
       portefeuille ne partait et la page restait sur « Chargement… ». On
       résout la frontière, on n'allonge aucun budget d'horloge. */
    await chargerEspaceApplicatif()
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(/adresse e-mail ou mot de passe incorrect/i)
    // Et on reste sur la page de connexion.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/content de vous revoir/i)
  })

  it('distingue un serveur injoignable d’un refus', async () => {
    // « Réessayez » et « corrigez votre mot de passe » n'appellent pas le même
    // geste. Les confondre produit « une erreur est survenue ».
    installerFauxServeur()
    const { vi } = await import('vitest')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entree: string | URL | Request) => {
        if (String(entree).includes('/auth/login')) throw new TypeError('Failed to fetch')
        return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
      }),
    )

    const user = userEvent.setup()
    /* DEPUIS L'ÉTAT ANONYME, et non depuis la session par défaut du harnais :
       c'est ce que fait quelqu'un qui se connecte, et c'est le seul état d'où
       la résolution de session est réellement jouée. */
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    /* LE MODULE DE `/app` EST PRÉCHARGÉ AVANT LE CLIC, et ce n'est pas une
       attente déguisée : `renderApp` fait exactement cela pour les routes qui
       commencent sous `/app`. Partant de `/connexion`, la frontière paresseuse
       ne se résout qu'À LA NAVIGATION — la sonde l'a montré, aucune requête de
       portefeuille ne partait et la page restait sur « Chargement… ». On
       résout la frontière, on n'allonge aucun budget d'horloge. */
    await chargerEspaceApplicatif()
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/injoignable/i)
  })

  it('n’annonce plus que l’authentification n’est pas branchée', async () => {
    await renderApp('/connexion')
    expect(screen.queryByText(/pas encore branchée/i)).not.toBeInTheDocument()
  })
})

describe('inscription', () => {
  /**
   * L'AVEU QUI VIVAIT ICI est levé, et seulement à moitié.
   *
   * Il disait : « le correctif — envoyer `invitationCode` au lieu de le jeter —
   * n'est PAS couvert par un test […] une condition que je n'ai pas identifiée
   * bloque la soumission dans le harnais ». La condition était le PAYS, devenu
   * requis à l'étape « contexte » depuis qu'il n'arrive plus pré-rempli : le
   * parcours de test le traversait sans le voir, exactement comme
   * l'utilisateur. `remplirIdentite` le choisit désormais, et le cas ci-dessous
   * conduit le parcours gestionnaire jusqu'à l'envoi.
   *
   * Ce que ce trou avait laissé passer, il l'a laissé passer DEUX FOIS : une
   * fois pour le locataire, une fois pour le gestionnaire, sur le même champ
   * sous deux noms. Le second est gardé ici ; le premier reste à écrire, et
   * c'est dit plutôt que tu.
   */

  it('transmet au serveur les champs que l’assistant collectait puis jetait', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })
    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC_CONNEXION, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await remplirIdentite(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    const appel = serveur.appels.find((a) => a.chemin === '/auth/signup')
    expect(appel).toBeDefined()
    const corps = appel?.corps as Record<string, unknown>

    expect(corps.email).toBe('arsene@example.com')
    expect(corps.fullName).toBe('Arsène Nkomo')
    // Le mot de passe partait nulle part : il n'existait aucun compte à créer.
    expect(corps.password).toBe('Bonamoussadi2026!')
    // L'acceptation des conditions est la première chose à conserver
    // juridiquement, et elle n'était enregistrée nulle part.
    expect(corps.acceptTerms).toBe(true)
    // Le couple indicatif + numéro est recomposé en E.164, la seule forme qui
    // se lise sans ambiguïté.
    expect(corps.phoneE164).toBe('+237677889900')
    // Le sixième champ, et le seul qui manquait encore : ce test en vérifiait
    // cinq et laissait passer celui-là. Sans lui, le compte se créait sans
    // parc, et l'application affichait le jeu de démonstration — un
    // propriétaire ne pouvait pas distinguer « mon parc est vide » de « mon
    // parc n'existe pas ».
    expect(corps.parkName).toBe('Parc Bonamoussadi')
    // Le pays par défaut est un vrai code ISO, pas la sentinelle.
    expect(corps.countryCode).toBe('CM')
  })

  it('envoie le vrai code d’un pays non desservi, plutôt qu’une sentinelle', async () => {
    /**
     * La suite du défaut qui a fait échouer la première inscription en
     * production.
     *
     * `OTHER` signifiait « mon pays n'est pas proposé » : une valeur
     * d'interface, pas un code ISO 3166-1. Envoyée telle quelle, elle butait
     * sur `length(2)` et le serveur répondait 400 sans nommer le champ. On
     * l'avait donc omise — le compte se créait alors sans pays du tout.
     *
     * La cause était en amont : une liste de vingt et un pays pour un monde qui
     * en compte deux cents. Elle en compte désormais deux cent quarante-deux, et un
     * bailleur de Harare enregistre « ZW » — un code que le serveur accepte,
     * puisqu'il n'exige que deux lettres. La sentinelle n'est plus atteignable
     * depuis l'écran ; ce que le serveur en fait reste vérifié par le contrat
     * d'inscription, côté serveur.
     */
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })
    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC_CONNEXION, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    // Le pays se choisit à l'étape « contexte », avec le nom du parc.
    const pays = await screen.findByLabelText(/^pays/i)
    await user.click(pays)
    await user.type(pays, 'zimb')
    await user.click(screen.getByRole('option', { name: 'Zimbabwe' }))
    await user.type(screen.getByLabelText(/nom de votre parc/i), 'Parc Bonamoussadi')
    await user.click(screen.getByRole('button', { name: /continuer/i }))
    await screen.findByRole('heading', { name: /tout est correct/i })
    await user.click(screen.getByLabelText(/j’accepte les conditions/i))
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    const corps = serveur.appels.find((a) => a.chemin === '/auth/signup')?.corps as Record<
      string,
      unknown
    >
    expect(corps).toBeDefined()
    // Le code ISO réel, et non une sentinelle ni un champ omis : le pays est
    // connu, seule sa devise ne l'est pas.
    expect(corps.countryCode).toBe('ZW')
  })

  it('transmet le code d’invitation du GESTIONNAIRE, et pas seulement celui du locataire', async () => {
    /**
     * Le même défaut, sur la troisième branche.
     *
     * L'envoi ne lisait que `state.inviteCode` — le champ du locataire. Le
     * gestionnaire saisit le sien dans `state.ownerCode`, un nom que le serveur
     * ne connaît pas : `grep ownerCode server/src` ne rend rien. Le code était
     * donc saisi, mis en forme au fil de la frappe, relu au récapitulatif, puis
     * jeté — et le compte se créait sans invitation ET sans parc, rattaché à
     * rien, sous l'écran « votre espace est prêt ».
     *
     * Le préfixe est `GES` et non `LOC` : c'est `creerCode` qui le pose, côté
     * serveur, selon le rôle invité.
     */
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })
    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC_CONNEXION, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })

    const user = userEvent.setup()
    await renderApp('/inscription/gestionnaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Sarah Mbala')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '699112233')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    const pays = await screen.findByLabelText(/^pays/i)
    await user.click(pays)
    await user.type(pays, 'camer')
    await user.click(screen.getByRole('option', { name: 'Cameroun' }))
    // Saisi sans tirets, comme on recopie un code depuis un SMS : c'est le
    // champ qui les place.
    await user.type(
      screen.getByLabelText(/code d’invitation du propriétaire/i),
      'ges4a7b92cd',
    )
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    await screen.findByRole('heading', { name: /tout est correct/i })
    await user.click(screen.getByLabelText(/j’accepte les conditions/i))
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    const corps = serveur.appels.find((a) => a.chemin === '/auth/signup')?.corps as Record<
      string,
      unknown
    >
    expect(corps).toBeDefined()
    // LE point du cas : le code part, sous le nom que le serveur attend.
    expect(corps.invitationCode).toBe('GES-4A7B-92CD')
    // Et il part SEUL : un code rejoint un parc, il n'en fonde pas. Le serveur
    // traite cette branche en premier et exclusivement.
    expect(corps.parkName).toBeUndefined()
  })

  it('ne propose plus une demande d’accès que rien ne reçoit', async () => {
    /**
     * La case « Je n'ai pas de code — envoyer une demande d'accès » n'avait
     * aucune route derrière elle : ni `accessRequest`, ni `joinRequest`, rien
     * dans `server/src`. La cocher désactivait le champ, laissait passer
     * l'étape, et produisait un compte rattaché à aucun parc.
     */
    const user = userEvent.setup()
    await renderApp('/inscription/gestionnaire')

    await user.type(screen.getByLabelText(/nom complet/i), 'Sarah Mbala')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '699112233')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))

    await screen.findByLabelText(/^pays/i)
    expect(screen.queryByText(/demande d’accès/i)).not.toBeInTheDocument()
    // Le champ reste, et il est le seul chemin : sans lui, on n'avance pas.
    expect(screen.getByLabelText(/code d’invitation du propriétaire/i)).toBeEnabled()
  })

  it('ramène à l’étape où le champ existe quand l’adresse est prise', async () => {
    // Afficher l'erreur sur le récapitulatif la poserait là où le champ n'est
    // pas : l'utilisateur lirait le problème sans pouvoir le corriger.
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 409, body: { error: 'email_taken' } })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await remplirIdentite(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    expect(await screen.findByText(/un compte existe déjà avec cette adresse/i)).toBeInTheDocument()
    // Retour à « Vos informations », avec la saisie conservée.
    expect(screen.getByLabelText(/adresse e-mail/i)).toHaveValue('arsene@example.com')
  })

  it('n’affiche l’écran de succès que si le compte a été créé', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 500, body: { error: 'internal_error' } })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await remplirIdentite(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/a échoué/i)
    // C'est le point : « votre espace est prêt » ne doit jamais s'afficher sans
    // compte derrière.
    expect(screen.queryByText(/votre espace est prêt/i)).not.toBeInTheDocument()
  })
})

describe('un refus doit se lire là où l’on vient de cliquer', () => {
  it('annonce la case des conditions à côté du bouton, et non seulement à côté de la case', async () => {
    /**
     * Le défaut qui a bloqué la création du premier compte du produit.
     *
     * Le message existait — « Vous devez accepter les conditions » — mais
     * uniquement à côté de la case, cent cinquante pixels au-dessus du bouton.
     * Le regard reste où le doigt a cliqué : l'utilisateur conclut que le
     * bouton ne fait rien, et il a raison de le conclure, puisque rien ne
     * change dans la zone qu'il observe.
     */
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })

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

    // La case reste DÉCOCHÉE, et on clique quand même.
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    // Deux annonces : celle de la case, et celle qui borde le bouton. Le
    // message doit exister aux deux endroits, parce qu'on ne sait pas lequel
    // des deux l'utilisateur regarde.
    const alertes = await screen.findAllByRole('alert')
    expect(alertes.length).toBeGreaterThanOrEqual(2)
    expect(alertes.every((a) => /accepter les conditions/i.test(a.textContent ?? ''))).toBe(true)

    // Et rien n'est parti au serveur : le refus est bien un refus.
    expect(serveur.appels.find((a) => a.chemin === '/auth/signup')).toBeUndefined()
  })
})

/**
 * L'écran de succès ne dit plus le contraire de ce qui vient d'arriver.
 *
 * Il annonçait « la création de compte n'est pas encore branchée » — dernier
 * vestige de l'époque où l'assistant validait neuf champs puis faisait
 * `setDone(true)`. Le texte a survécu au câblage, et le mensonge tombait au
 * pire moment : juste après avoir saisi une adresse, un mot de passe et un
 * numéro réels, l'écran affirmait que rien n'avait été enregistré. Le premier
 * compte du produit a été créé sous cette phrase.
 *
 * Le cas voisin vérifie l'inverse — que l'écran ne s'affiche PAS quand l'appel
 * échoue. Les deux se tiennent : l'un interdit d'annoncer un succès qui n'a pas
 * eu lieu, l'autre de nier un succès qui a eu lieu.
 */
describe('écran de succès', () => {
  it('n’annonce pas que la création n’est pas branchée', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })
    // `/auth/me` aussi : l'inscription ouvre une session, et le fournisseur la
    // relit dans la foulée. Sans ce stub, la réponse arrivait après la fin du
    // cas et retombait dans le suivant — la suite entière devenait instable,
    // avec un échec différent à chaque exécution.
    /* LE COMPTE A UN PARC, et c'est ce lot qui l'exige. Un compte connecté SANS
       adhésion voit désormais « aucun parc rattaché » au lieu du jeu de
       démonstration — voir `SansParc`. Ces cas-ci portent sur la NAVIGATION
       après connexion : leur donner un parc les remet sur leur sujet, au lieu
       de mesurer un écran d'absence. */
    serveur.quand('GET', '/auth/me', {
      status: 200,
      body: {
        user: COMPTE_FICTIF,
        memberships: [
          { parkId: PARC_CONNEXION, role: 'owner', parkName: 'Parc de test', currency: 'XAF' },
        ],
      },
    })

    const user = userEvent.setup()
    await renderApp('/inscription/proprietaire')
    await remplirIdentite(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    await screen.findByText(/votre espace est prêt/i)
    // Le compte EST créé : l'écran ne peut pas prétendre le contraire.
    expect(screen.queryByText(/pas encore branchée/i)).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(/votre compte est créé/i)
  })
})
