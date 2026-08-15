import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { DEMO_RESET_TOKEN } from '@/features/auth/validation'

const AVEC_JETON = `/reinitialiser?jeton=${DEMO_RESET_TOKEN}`

/**
 * Réinitialisation du mot de passe.
 *
 * L'écran manquait alors que la page « mot de passe oublié » en promettait le
 * lien. Ces tests gardent surtout le comportement du jeton : un lien absent ou
 * raturé doit mener à l'écran « expiré » et non à un formulaire qui échouerait
 * après que l'utilisateur a choisi et retapé un mot de passe.
 */
describe('jeton de réinitialisation', () => {
  it.each([
    ['/reinitialiser', 'absent'],
    ['/reinitialiser?jeton=', 'vide'],
    ['/reinitialiser?jeton=court', 'trop court'],
    ['/reinitialiser?jeton=ZZZZZZZZZZZZZZZZ', 'hors hexadécimal'],
  ])('%s → écran « lien expiré » (%s)', (route) => {
    renderApp(route)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ce lien n’est plus valable')
    expect(screen.queryByLabelText(/nouveau mot de passe/i)).not.toBeInTheDocument()
  })

  it('propose d’en redemander un', () => {
    renderApp('/reinitialiser')
    expect(screen.getByRole('link', { name: /demander un nouveau lien/i })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie',
    )
  })

  it('ouvre le formulaire avec un jeton bien formé', () => {
    renderApp(AVEC_JETON)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Choisissez un nouveau mot de passe',
    )
  })
})

describe('formulaire de réinitialisation', () => {
  it('refuse un mot de passe trop court', async () => {
    const user = userEvent.setup()
    renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'court')
    await user.type(screen.getByLabelText(/^Confirmez/), 'court')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('au moins 8 caractères')
  })

  it('refuse deux saisies différentes', async () => {
    const user = userEvent.setup()
    renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'Bonamoussadi2026!')
    await user.type(screen.getByLabelText(/^Confirmez/), 'Bonamoussadi2026')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('ne correspondent pas')
  })

  it('place le focus sur le premier champ fautif', async () => {
    const user = userEvent.setup()
    renderApp(AVEC_JETON)

    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))
    expect(screen.getByLabelText(/^Nouveau mot de passe/)).toHaveFocus()
  })

  it('confirme et renvoie vers la connexion', async () => {
    const user = userEvent.setup()
    renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'Bonamoussadi2026!')
    await user.type(screen.getByLabelText(/^Confirmez/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /Mot de passe modifié/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /se connecter/i })).toHaveAttribute('href', '/connexion')
  })

  it('annonce que les autres sessions sont déconnectées', async () => {
    const user = userEvent.setup()
    renderApp(AVEC_JETON)

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'Bonamoussadi2026!')
    await user.type(screen.getByLabelText(/^Confirmez/), 'Bonamoussadi2026!')
    await user.click(screen.getByRole('button', { name: /enregistrer le mot de passe/i }))

    // Conséquence non évidente d'un changement de mot de passe : on la dit.
    expect(await screen.findByText(/sessions ouvertes ont été déconnectées/i)).toBeInTheDocument()
  })
})

describe('continuité du parcours', () => {
  it('le lien promis par l’e-mail mène bien au formulaire', async () => {
    const user = userEvent.setup()
    renderApp('/mot-de-passe-oublie')

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'sarah@example.com')
    await user.click(screen.getByRole('button', { name: /envoyer le lien/i }))
    await screen.findByRole('heading', { level: 1, name: /Vérifiez votre boîte mail/ })

    // Sans service d'envoi, le lien est exposé comme artefact de maquette :
    // c'est ce qui rend le parcours parcourable de bout en bout.
    await user.click(screen.getByRole('link', { name: /reinitialiser/i }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Choisissez un nouveau mot de passe',
    )
  })
})
