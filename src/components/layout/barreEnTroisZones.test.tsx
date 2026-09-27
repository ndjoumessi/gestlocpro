import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LA BARRE LATÉRALE DÉFILAIT D'UN BLOC, ET EMPORTAIT SON PIED AVEC ELLE.
 *
 * ═══ CE QUI A ÉTÉ MESURÉ ═══
 *
 * `overflow-y-auto` était posé sur l'`<aside>` tout entier : logo, navigation et
 * pied dans le même conteneur défilant. Relevé au navigateur sur `/demo`, fenêtre
 * de 1440 px de large, sur le paquet construit :
 *
 *   hauteur 1080, racine 16   contenu à ras           pied visible
 *   hauteur  900, racine 16   déborde de 176 px       pied 37 px SOUS le bord
 *   hauteur  800, racine 16   déborde de 276 px       pied 137 px sous le bord
 *   hauteur  900, racine 22   déborde de 580 px       pied 389 px sous le bord
 *   hauteur  640, racine 22   déborde de 840 px       pied 649 px sous le bord
 *
 * 800 px de haut est un portable ordinaire, cadre du navigateur retiré. Ce qui
 * tombait sous le bord : les DEUX entrées de pied — le portail du locataire, les
 * états du système —, les dernières entrées de section avec elles, et, barre
 * repliée, le bouton qui la déplie. La barre basse qui porte les mêmes
 * destinations est `lg:hidden` : au-delà de 1024 px, plus rien ne les offrait.
 *
 * Après le lot, aux quinze mêmes points : panneau à 0 px de débordement, la zone
 * du milieu absorbe de 13 à 863 px, et le pied est VISIBLE partout.
 *
 * ═══ CE QUE CES CAS PEUVENT TENIR, ET CE QU'ILS NE PEUVENT PAS ═══
 *
 * PAS LA GÉOMÉTRIE : le harnais ne met rien en page, aucune hauteur n'y existe.
 * Les nombres ci-dessus sont un relevé de navigateur, gardé par les portes de
 * mesure et par cet en-tête.
 *
 * MAIS LE CONTRAT, OUI, et c'est lui qui produit la géométrie : trois zones, deux
 * fixes et une mobile, le pied HORS de celle qui défile. Un lot qui remettrait le
 * pied dans la zone mobile rendrait les nombres d'avant, et ces cas le refusent
 * sans avoir besoin de mesurer un pixel.
 */

/** Le panneau de bureau — pas le tiroir, qui n'est monté qu'à l'ouverture. */
async function barre() {
  await attendreLeChargement()
  const panneaux = screen.getAllByRole('complementary', { hidden: true })
  const panneau = panneaux[0]
  if (!panneau) throw new Error('aucune barre latérale')
  return panneau as HTMLElement
}

const zone = (panneau: HTMLElement, nom: 'entete' | 'navigation' | 'pied') => {
  const el = panneau.querySelector(`[data-zone="${nom}"]`)
  if (!el) throw new Error(`la barre n’a pas de zone « ${nom} »`)
  return el as HTMLElement
}

describe('la barre latérale en trois zones', () => {
  it('range son contenu en trois zones, dans cet ordre', async () => {
    await renderApp('/demo')
    const panneau = await barre()

    /* TROIS ENFANTS DIRECTS ET PAS QUATRE : c'est ce qui fait que la zone du
       milieu prend la place restante par `flex-1`. Un quatrième bloc posé à côté
       se partagerait cette place et rendrait le pied flottant. */
    const zones = Array.from(panneau.children).map((z) => z.getAttribute('data-zone'))
    expect(zones, 'la barre n’est plus faite de trois zones marquées').toEqual([
      'entete',
      'navigation',
      'pied',
    ])
  })

  it('garde le pied HORS de ce qui défile', async () => {
    await renderApp('/demo')
    const panneau = await barre()

    /* LE DÉFAUT MESURÉ, EN UNE ASSERTION. « Prise en main et droits » est une
       entrée de pied : tant qu'elle vivait dans la zone défilante, elle passait
       sous le bord de la fenêtre dès 900 px de haut. Le pied porte DEUX entrées,
       les deux vitrines : le portail du locataire et les états du système. */
    const portail = within(zone(panneau, 'pied')).getByRole('link', {
      name: /portail locataire/i,
    })
    expect(portail).toBeInTheDocument()

    /* ET ELLE N'EST PAS AUSSI DANS LA NAVIGATION : le cas serait vert si les
       deux zones portaient la même entrée, ce qui est précisément la forme que
       prendrait une régression maladroite. */
    expect(
      within(zone(panneau, 'navigation')).queryByRole('link', { name: /portail locataire/i }),
      'l’entrée de pied est aussi rendue dans la zone qui défile',
    ).toBeNull()
  })

  it('ne fait pas changer de place au bouton qui replie la barre', async () => {
    await renderApp('/demo')
    const panneau = await barre()

    /*
      IL ÉTAIT DANS L'EN-TÊTE DÉPLIÉ ET DANS LE PIED REPLIÉ.

      Le seul bouton dont on a besoin pour revenir en arrière se trouvait ailleurs
      que là où on l'avait laissé — et, replié, dans la zone qui passait sous le
      bord de la fenêtre. On le cherchait donc à l'endroit où il n'était plus, sur
      la taille d'écran où l'on travaille la journée.
    */
    const bascule = () =>
      within(zone(panneau, 'entete')).getByRole('button', { name: /replier|déplier|navigation/i })

    expect(bascule(), 'la bascule n’est pas dans l’en-tête quand la barre est dépliée').toBeVisible()
    await userEvent.click(bascule())
    expect(bascule(), 'la bascule a quitté l’en-tête en repliant la barre').toBeVisible()

    /* UNE SEULE, et c'est l'autre moitié : le pied en portait une seconde, donc
       deux boutons de même nom coexistaient dans le même panneau — ce que la
       règle d'homonymie du dépôt refuse par ailleurs. */
    expect(
      within(panneau).getAllByRole('button', { name: /replier|déplier|navigation/i }).length,
      'la barre porte plus d’une bascule',
    ).toBe(1)
  })

  it('garde les groupes visibles quand la barre est repliée', async () => {
    await renderApp('/demo')
    const panneau = await barre()
    const avant = zone(panneau, 'navigation').querySelectorAll('a').length

    await userEvent.click(
      within(zone(panneau, 'entete')).getByRole('button', { name: /replier|déplier|navigation/i }),
    )

    /* REPLIER NE PERD AUCUNE DESTINATION. Les intitulés de section partent — ils
       ne tiennent pas dans 72 px — et c'est un filet qui les remplace ; les
       entrées, elles, restent toutes. */
    expect(
      zone(panneau, 'navigation').querySelectorAll('a').length,
      'replier la barre a fait disparaître des entrées',
    ).toBe(avant)
  })
})
