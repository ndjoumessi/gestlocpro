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
    expect(screen.getByRole('link', { name: /se connecter/i })).toHaveAttribute('href', '/connexion')
  })

  /**
   * LA DÉMONSTRATION DOIT S'OUVRIR, PAS DEMANDER UN MOT DE PASSE.
   *
   * Ce cas existait et épinglait `href === '/app'` : il gardait le défaut au
   * lieu de la propriété. Suivi au navigateur, ce lien menait à `/connexion` —
   * `/app` est l'espace AUTHENTIFIÉ, et `RequireAuth` y renvoie tout visiteur
   * anonyme. Or c'est le seul geste d'exploration de cette page, et celui qui la
   * voit y est arrivé PAR UN LIEN MORT : il n'a, par définition, aucune raison
   * d'avoir un compte.
   *
   * ═══ POURQUOI ON COMPARE À LA VITRINE PLUTÔT QUE D'ÉCRIRE L'ADRESSE ═══
   *
   * Réécrire `'/demo'` ici referait exactement ce qui vient d'échouer : un
   * littéral qu'on croit juste et que rien ne relie à la vérité. La vitrine, elle,
   * envoie vers la démonstration depuis toujours et à deux endroits. On lit donc
   * SA destination et on exige que le 404 rende la même — le jour où la
   * démonstration déménage, les deux bougent ensemble ou la garde rougit.
   */
  it('envoie vers la démonstration, là où la vitrine envoie', async () => {
    await renderApp('/')
    const depuisLaVitrine = document.querySelector('a[href^="/demo"]')?.getAttribute('href')
    expect(depuisLaVitrine, 'la vitrine n’offre plus de lien vers la démonstration').toBeTruthy()

    await renderApp('/nimportequoi')
    const depuisLe404 = screen.getByRole('link', { name: /ouvrir la démonstration/i })
    expect(depuisLe404).toHaveAttribute('href', depuisLaVitrine)

    /* Et jamais sous `/app`, quelle que soit l'adresse : c'est la barrière
       d'authentification, et le nom du bouton promet le contraire. */
    expect(depuisLe404.getAttribute('href')).not.toMatch(/^\/app(?:[/?]|$)/)
  })

  it('traduit l’écran', async () => {
    const user = userEvent.setup()
    await renderApp('/nimportequoi')

    /* Les trois réglages sont repliés derrière un déclencheur depuis que
       l'en-tête de cet écran a rejoint celui des pages d'authentification : il
       occupait 193 px à 360, et le `<h1>` commençait à 33 % de la fenêtre. Le
       sélecteur de langue n'est donc plus au premier rendu — il est à un geste,
       et ce cas fait ce geste. */
    await user.click(screen.getByRole('button', { name: /réglages/i }))
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

  /**
   * LE FIL D'ARIANE A DISPARU ; L'INVARIANT, LUI, RESTE.
   *
   * Ce cas gardait une chose juste : une adresse inconnue ne doit pas
   * s'annoncer « Tableau de bord ». Il la gardait sur le fil d'Ariane, que le
   * lot de la coquille a retiré — il répétait, dans un repère de navigation
   * que les lecteurs d'écran listent à part, le nom que le `<h1>` de la page
   * disait déjà quinze pixels plus bas.
   *
   * Le cas suit l'invariant là où il vit désormais : le TITRE DU DOCUMENT et
   * le `<h1>`. Ce sont les deux seuls endroits qui nomment l'écran courant, et
   * ce sont eux qui mentiraient si le repli était mal choisi.
   */
  it('ne prétend nulle part que l’on est au tableau de bord', async () => {
    await renderApp('/app/ecran-inexistant')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Écran introuvable')
    expect(document.title).toContain('Écran introuvable')
    expect(document.title).not.toContain('Tableau de bord')
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
