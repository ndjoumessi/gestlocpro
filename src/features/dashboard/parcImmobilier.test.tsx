import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
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

  /**
   * LES TROIS ÉNUMÉRATIONS SONT DEVENUES UNE.
   *
   * Trois cas vivaient ici : les pastilles de filtre portaient le NOM de
   * l'immeuble et non son quartier, elles retenaient les bonnes lignes, et
   * `?immeuble=` les pilotait depuis l'adresse.
   *
   * Les pastilles sont parties. Le parc énumérait ses immeubles TROIS fois sur
   * le même écran — en cartes, en pastilles, et dans une colonne redite à chaque
   * ligne ; il ne les énumère plus qu'en en-têtes de groupe. Le filtre n'avait
   * plus d'interface pour se poser, et il était devenu FAUX : `ordre` déclarant
   * tous les immeubles pour que celui sans logement garde ses gestes, un filtre
   * actif ne retirait pas les autres blocs, il les VIDAIT — deux en-têtes suivis
   * de rien au milieu de la liste.
   *
   * CE QUI EST PERDU, ET IL FAUT LE DIRE : `/demo/parc?immeuble=…` n'est plus
   * une adresse partageable. C'est la contrepartie assumée du groupement.
   *
   * CE QUE CES CAS GARDENT — et pourquoi ils ne sont pas simplement supprimés :
   * la distinction NOM / QUARTIER, qui était leur vrai sujet. « Villa Deïdo » est
   * dans le quartier « Deïdo » mais « Immeuble Akwa Nord » est dans « Akwa » :
   * les deux libellés diffèrent, ce qui rend lisible lequel s'affiche où.
   */
  it('nomme l’immeuble par son nom, et le situe par son quartier', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc', { largeur: 1280 })
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    const blocs = Array.from(document.querySelectorAll('[data-groupe]'))
    const akwa = blocs.find((b) => b.querySelector('h3')?.textContent === 'Immeuble Akwa Nord')
    expect(akwa, 'le bloc porte le NOM en titre').toBeTruthy()
    // Et le quartier, en second : il situe sans tenir la place du nom.
    expect(within(akwa as HTMLElement).getByText('Akwa')).toBeInTheDocument()
  })

  it('n’écrit plus le nom de l’immeuble une fois par logement', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc', { largeur: 1280 })
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    /* CINQ LOGEMENTS, UN SEUL NOM. C'est le gain que le groupement achète, et
       ce compte est ce qui rougit le jour où la colonne revient. */
    expect(screen.getAllByText('Résidence Bonamoussadi')).toHaveLength(1)
  })
})