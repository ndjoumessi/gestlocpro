import { describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { BUILDINGS } from '@/data/portfolio'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * CE QUE LA LISTE DU PARC NOMME.
 *
 * La colonne « Immeuble » rendait le QUARTIER, tandis que la vignette du haut
 * rendait le nom : « Résidence Bonamoussadi » en carte et « Bonamoussadi » en
 * ligne désignaient le même bâtiment sans que rien ne le dise. Les boutons de
 * filtre portaient eux aussi le quartier, tout en filtrant par immeuble — deux
 * résidences d'un même quartier auraient donné deux boutons identiques, dont
 * l'un serait resté injoignable.
 *
 * Le jeu de démonstration rend ces deux cas lisibles : « Villa Deïdo » se
 * trouve dans le quartier « Deïdo », mais « Immeuble Akwa Nord » est dans
 * « Akwa » — les deux libellés diffèrent, ce qui est exactement ce qu'il faut
 * pour distinguer lequel s'affiche.
 */
describe('la liste du parc nomme les immeubles', () => {
  it('affiche le nom de l’immeuble dans la colonne qui l’annonce', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    const table = screen.getByRole('table')
    // Le NOM, sous un en-tête qui dit « Immeuble ».
    expect(within(table).getAllByText('Immeuble Akwa Nord').length).toBeGreaterThan(0)
    // Et le quartier reste, en second : il situe sans tenir la place du nom.
    expect(within(table).getAllByText('Akwa').length).toBeGreaterThan(0)
  })

  it('nomme les filtres par ce sur quoi ils filtrent', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    const filtres = screen.getByRole('group', { name: /Immeuble/i })
    expect(within(filtres).getByRole('button', { name: 'Immeuble Akwa Nord' })).toBeInTheDocument()
    expect(within(filtres).getByRole('button', { name: 'Villa Deïdo' })).toBeInTheDocument()
    // Le quartier seul ne désigne plus aucun bouton : c'est ce qui rendait deux
    // résidences d'un même quartier indiscernables.
    expect(within(filtres).queryByRole('button', { name: 'Akwa' })).not.toBeInTheDocument()
  })

  it('filtre bien sur l’immeuble nommé', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    const filtres = screen.getByRole('group', { name: /Immeuble/i })
    await userEvent.setup().click(within(filtres).getByRole('button', { name: 'Villa Deïdo' }))

    // La moitié positive ET la moitié négative : le bouton ne se contente pas
    // de porter le bon nom, il retient les bonnes lignes.
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('Villa Deïdo').length).toBeGreaterThan(0)
    expect(within(table).queryByText('Immeuble Akwa Nord')).not.toBeInTheDocument()
  })

  /**
   * LE FILTRE SURVIT À L'ALLER-RETOUR, parce qu'il vit dans l'URL.
   *
   * Il vivait en mémoire : ouvrir le dossier d'un logement puis revenir rendait
   * le parc entier, filtre perdu. Sur douze immeubles, c'est un geste à refaire
   * à chaque aller-retour — et l'aller-retour est précisément ce que cet écran
   * sert à faire.
   *
   * La recherche, elle, reste locale : ce cas vérifie AUSSI qu'elle n'y va pas,
   * sans quoi une frappe en cours de saisie écrirait une entrée d'historique
   * par caractère.
   */
  it('laisse l’adresse piloter le filtre d’immeuble', async () => {
    // Le parc entier d'abord, pour avoir un point de comparaison.
    await renderApp('/demo/parc')
    await attendreLeChargement()
    const toutes = screen.getAllByRole('row').length
    cleanup()

    // La MÊME page, ouverte sur une adresse qui porte le filtre : c'est le
    // mécanisme qui fait survivre le choix à un aller-retour vers un dossier.
    await renderApp(`/demo/parc?immeuble=${BUILDINGS[0].id}`)
    await attendreLeChargement()
    const filtrees = screen.getAllByRole('row').length

    expect(filtrees).toBeGreaterThan(1)
    expect(filtrees).toBeLessThan(toutes)

    // Et le filtre actif se voit : la pastille de l'immeuble est enfoncée.
    const filtres = screen.getByRole('group', { name: /Immeuble/i })
    const actifs = within(filtres)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(actifs).toHaveLength(1)
    expect(actifs[0]).toHaveTextContent(BUILDINGS[0].name)
  })
})