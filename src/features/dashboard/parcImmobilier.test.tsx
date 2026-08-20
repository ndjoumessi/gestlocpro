import { describe, expect, it } from 'vitest'
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
    renderApp('/demo/parc')
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
    renderApp('/demo/parc')
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
    renderApp('/demo/parc')
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
})
