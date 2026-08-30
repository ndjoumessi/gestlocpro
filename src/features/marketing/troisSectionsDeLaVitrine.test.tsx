import { describe, expect, it } from 'vitest'
import { renderApp, within } from '@/test/render'

/**
 * TROIS SECTIONS DE LA VITRINE, TROIS DÉFAUTS DE FOND.
 *
 * Ces cas sont écrits AVANT le correctif : chacun rougit sur l'état actuel, et
 * c'est cette rougeur qui tient lieu de témoin. Voir la doctrine des lots.
 */

describe('les trois chiffres de la couverture', () => {
  /**
   * UN SIGNE IDENTIQUE ENTRE TROIS VOISINS NE DISTINGUE RIEN.
   *
   * Les trois cartes — devises, langues, pays — portaient le MÊME globe. Un
   * icône ne vaut que par ce qu'il sépare : répété à l'identique sur trois
   * cartes côte à côte, il n'apporte aucune information et occupe la place, la
   * couleur et l'attention d'un signe qui en apporterait une. C'est de la
   * décoration déguisée en repère.
   *
   * ON COMPARE LES SVG ENTIERS, ET NON LEURS CHEMINS. `Icon` ne rend pas son nom
   * dans le document, donc l'identité d'un signe est son tracé. Une première
   * rédaction relevait les `<path>` : elle exigeait trois chemins pour trois
   * cartes, et `globe` en porte DEUX — plus un `<circle>`. Le compte était donc
   * faux avant même de comparer quoi que ce soit, et la garde a rougi sur un
   * correctif juste. Elle mesurait le nombre de traits, pas le nombre de signes.
   */
  it('ne répète pas le même icône sur les trois cartes', async () => {
    await renderApp('/')
    const section = document.getElementById('international')!
    const signes = Array.from(section.querySelectorAll('dt svg')).map((s) => s.innerHTML)
    expect(signes.length, 'les cartes de couverture ont perdu leurs signes').toBe(3)
    expect(new Set(signes).size, 'le même icône est répété sur les trois cartes').toBe(3)
  })
})

describe('les quatre frictions', () => {
  /**
   * LE NUMÉRO EST LE REPÈRE, PAS UNE ÉTIQUETTE.
   *
   * « 01 » à « 04 » étaient rendus en `text-caps` — douze pixels, la taille des
   * surtitres —, c'est-à-dire au même rang que ce qui nomme une section. Or ces
   * quatre chiffres ne nomment rien : ils COMPTENT, et c'est leur seule
   * fonction. Quatre cartes blanches sur un gris clair, chacune portant une
   * phrase et un petit label bleu, se lisent comme quatre fragments sans ordre.
   */
  it('donne au numéro une échelle de repère', async () => {
    await renderApp('/')
    const section = document.getElementById('value')!
    const items = within(section).getAllByRole('listitem')
    expect(items, 'les quatre frictions ont disparu').toHaveLength(4)

    const CAPS = ['text', 'caps'].join('-')
    for (const item of items) {
      const numero = item.querySelector('[aria-hidden="true"]')
      expect(numero, 'une friction a perdu son numéro').not.toBeNull()
      expect(
        numero!.className.split(/\s+/),
        'le numéro est rendu à la taille d’un surtitre',
      ).not.toContain(CAPS)
    }
  })
})

describe('la clôture de la page', () => {
  /**
   * LA DERNIÈRE CHOSE DE LA PAGE EST UN OBJET, PAS UN CHAMP DE COULEUR.
   *
   * Le bloc de clôture et le pied partagent la même encre, sans rien entre eux :
   * le titre, ses deux boutons, puis deux cents pixels de sombre, puis le pied.
   * Rien ne dit où finit l'appel et où commence l'ourlet du site. Le lecteur
   * arrive au bout de la page et ne voit qu'une masse.
   *
   * On exige donc que l'appel soit BORNÉ — une surface à lui, distincte du fond
   * de la section qui le porte.
   */
  it('borne l’appel final au lieu de le poser sur le fond', async () => {
    await renderApp('/')
    const titre = Array.from(document.querySelectorAll('h2')).find((h) =>
      /Reprenez|Take back/i.test(h.textContent ?? ''),
    )
    expect(titre, 'le bloc de clôture a disparu').toBeDefined()

    const panneau = titre!.closest('[data-panneau-final]')
    expect(panneau, 'l’appel final n’est borné par rien').not.toBeNull()
  })
})
