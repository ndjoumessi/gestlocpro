import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'

/**
 * Titre du document.
 *
 * Une application à page unique ne change pas de document : sans intervention,
 * le `<title>` d'`index.html` reste affiché partout. Seul l'assistant
 * d'inscription le mettait à jour — les douze écrans applicatifs, la connexion
 * et les pages de mot de passe portaient donc tous le titre de la landing, en
 * français quelle que soit la langue choisie.
 *
 * Rien de tout cela ne se voit dans la page : cela se voit dans la barre
 * d'onglets, dans l'historique, dans les signets, et cela s'entend au lecteur
 * d'écran, qui annonce le titre au changement de page.
 */
describe('titre du document', () => {
  it('nomme chaque écran, avec le produit en suffixe', async () => {
    await renderApp('/connexion')
    expect(document.title).toBe('Content de vous revoir · GestLocPro')
  })

  it('distingue deux écrans applicatifs', async () => {
    await renderApp('/app/cautions')
    expect(document.title).toBe('Cautions · GestLocPro')
  })

  it('nomme le parcours et non la seule étape à l’inscription', async () => {
    await renderApp('/inscription')
    // « Votre rôle » seul ne dirait pas qu'on crée un compte.
    expect(document.title).toBe('Votre rôle — Créer votre compte · GestLocPro')
  })

  it('suit la langue', async () => {
    const user = userEvent.setup()
    await renderApp('/connexion')

    await user.click(screen.getByRole('button', { name: /english/i }))
    expect(document.title).toBe('Good to see you again · GestLocPro')
  })

  it('laisse à la landing son titre de marque, sans suffixe redondant', async () => {
    await renderApp('/')
    expect(document.title).toBe('GestLocPro — La gestion locative tenue comme un patrimoine')
  })
})
