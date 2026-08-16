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
