import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'

/**
 * Adresse inconnue.
 *
 * La route attrape-tout rendait la landing page : une URL fautive s'affichait
 * comme si elle était la destination. Le défaut était silencieux — d'où le
 * premier test, qui vérifie non seulement qu'un 404 apparaît, mais que la
 * landing n'apparaît pas.
 */
describe('adresse publique inconnue', () => {
  it('affiche un 404 et non la landing', async () => {
    await renderApp('/nimportequoi')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cette page n’existe pas')
    // Le titre de la landing : sa présence signalerait le retour du défaut.
    expect(screen.queryByText(/La gestion locative, tenue comme un patrimoine/)).not.toBeInTheDocument()
  })

  it('rappelle l’adresse demandée', async () => {
    await renderApp('/parc/immeuble-inexistant')
    expect(screen.getByText('/parc/immeuble-inexistant')).toBeInTheDocument()
  })

  it('coupe une adresse démesurée plutôt que de déformer la page', async () => {
    const long = `/${'a'.repeat(400)}`
    await renderApp(long)

    expect(screen.queryByText(long)).not.toBeInTheDocument()
    expect(screen.getByText(/^\/a+…$/)).toBeInTheDocument()
  })

  it('offre une sortie vers l’accueil, la démonstration et la connexion', async () => {
    await renderApp('/nimportequoi')

    expect(screen.getByRole('link', { name: /retour à l’accueil/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /ouvrir la démonstration/i })).toHaveAttribute(
      'href',
      '/app',
    )
    expect(screen.getByRole('link', { name: /se connecter/i })).toHaveAttribute('href', '/connexion')
  })

  it('traduit l’écran', async () => {
    const user = userEvent.setup()
    await renderApp('/nimportequoi')

    await user.click(screen.getByRole('button', { name: /english/i }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page does not exist')
  })
})

/**
 * Sous `/app`, l'égarement n'est pas le même : l'utilisateur est déjà dans
 * l'espace de gestion et la barre latérale liste les écrans qui existent.
 * L'éjecter vers la landing lui ferait perdre le fil.
 */
describe('adresse inconnue dans l’espace de gestion', () => {
  it('garde la coque et sa navigation', async () => {
    await renderApp('/app/ecran-inexistant')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Écran introuvable')
    // La barre latérale est toujours là : c'est elle qui liste les écrans.
    // Nom exact, pour ne pas attraper aussi le bouton « Revenir au tableau de
    // bord » — et requête portée sur la barre latérale, la navigation basse
    // proposant la même destination sous un second lien de même nom.
    const laterale = screen.getAllByRole('navigation', { name: 'Sections du produit' })[0]
    expect(within(laterale).getByRole('link', { name: 'Tableau de bord' })).toBeInTheDocument()
  })

  it('ne prétend pas dans le fil d’Ariane que l’on est au tableau de bord', async () => {
    await renderApp('/app/ecran-inexistant')
    const fil = screen.getByRole('navigation', { name: /fil d’ariane/i })
    expect(fil).toHaveTextContent('Écran introuvable')
    expect(fil).not.toHaveTextContent('Tableau de bord')
  })

  it('ramène au tableau de bord', async () => {
    await renderApp('/app/ecran-inexistant')
    expect(screen.getByRole('link', { name: /revenir au tableau de bord/i })).toHaveAttribute(
      'href',
      '/app',
    )
  })

  it('ne se déclenche pas sur un écran qui existe', async () => {
    await renderApp('/app/travaux')
    expect(screen.queryByText(/Écran introuvable/)).not.toBeInTheDocument()
  })
})
