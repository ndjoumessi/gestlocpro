import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'

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
  await user.type(await screen.findByLabelText(/nom de votre parc/i), 'Parc Bonamoussadi')
  await user.click(screen.getByRole('button', { name: /continuer/i }))
  await screen.findByRole('heading', { name: /tout est correct/i })
  // Sans cette case, l'assistant refuse de soumettre — et c'est le
  // comportement voulu : l'acceptation est exigée avant toute création.
  await user.click(screen.getByLabelText(/j’accepte les conditions/i))
}

describe('connexion', () => {
  it('appelle le serveur et ouvre le tableau de bord', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/login', { status: 200, body: { user: COMPTE_FICTIF } })
    serveur.quand('GET', '/auth/me', { status: 200, body: { user: COMPTE_FICTIF, memberships: [] } })

    const user = userEvent.setup()
    renderApp('/connexion')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    const appel = serveur.appels.find((a) => a.chemin === '/auth/login')
    expect(appel).toBeDefined()
    expect(appel?.corps).toEqual({
      email: 'sarah@example.com',
      password: 'un-mot-de-passe-assez-long',
    })

    expect(await screen.findByRole('heading', { level: 1, name: /vue consolidée/i })).toBeInTheDocument()
  })

  it('rend un seul message pour un identifiant refusé, sur le formulaire', async () => {
    // Le serveur ne dit délibérément pas lequel des deux champs est faux : les
    // distinguer ferait de la connexion un oracle d'existence de comptes.
    // Poser l'erreur sous le champ e-mail rétablirait à l'écran ce que l'API
    // refuse de dire.
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/login', { status: 401, body: { error: 'invalid_credentials' } })

    const user = userEvent.setup()
    renderApp('/connexion')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'ce-n-est-pas-le-bon')
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
    renderApp('/connexion')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'un-mot-de-passe-assez-long')
    await user.click(screen.getByRole('button', { name: /^se connecter$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/injoignable/i)
  })

  it('n’annonce plus que l’authentification n’est pas branchée', async () => {
    renderApp('/connexion')
    expect(screen.queryByText(/pas encore branchée/i)).not.toBeInTheDocument()
  })
})

describe('inscription', () => {
  it('transmet au serveur les champs que l’assistant collectait puis jetait', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 201, body: { user: COMPTE_FICTIF } })
    serveur.quand('GET', '/auth/me', { status: 200, body: { user: COMPTE_FICTIF, memberships: [] } })

    const user = userEvent.setup()
    renderApp('/inscription/proprietaire')
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
    serveur.quand('GET', '/auth/me', { status: 200, body: { user: COMPTE_FICTIF, memberships: [] } })

    const user = userEvent.setup()
    renderApp('/inscription/proprietaire')
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

  it('ramène à l’étape où le champ existe quand l’adresse est prise', async () => {
    // Afficher l'erreur sur le récapitulatif la poserait là où le champ n'est
    // pas : l'utilisateur lirait le problème sans pouvoir le corriger.
    const serveur = installerFauxServeur()
    serveur.quand('POST', '/auth/signup', { status: 409, body: { error: 'email_taken' } })

    const user = userEvent.setup()
    renderApp('/inscription/proprietaire')
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
    renderApp('/inscription/proprietaire')
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
    renderApp('/inscription/proprietaire')
    await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
    await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
    await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /continuer/i }))
    await user.type(await screen.findByLabelText(/nom de votre parc/i), 'Parc Bonamoussadi')
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
    serveur.quand('GET', '/auth/me', { status: 200, body: { user: COMPTE_FICTIF, memberships: [] } })

    const user = userEvent.setup()
    renderApp('/inscription/proprietaire')
    await remplirIdentite(user)
    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))

    await screen.findByText(/votre espace est prêt/i)
    // Le compte EST créé : l'écran ne peut pas prétendre le contraire.
    expect(screen.queryByText(/pas encore branchée/i)).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(/votre compte est créé/i)
  })
})
