import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LE REGISTRE DES CAUTIONS RESTE UN TABLEAU, ET IL TRIE.
 *
 * Trois colonnes d'argent qu'on lit VERTICALEMENT — consigné, retenu, à
 * restituer : l'alignement des chiffres EST la fonction de cet écran, et le
 * casser en fiches remplacerait une comparaison d'un coup d'œil par cinq
 * lectures. Un registre n'est pas un annuaire.
 *
 * Ce qui manquait n'était donc pas une autre forme, mais deux choses :
 *
 * 1. UN TRI. « 2 en cours d'arbitrage » vivait dans la note d'une carte — le
 *    chiffre le plus actionnable de l'écran — sans rien pour n'afficher que
 *    ces deux-là.
 * 2. UNE COLONNE QUI NE PORTE QU'UNE CHOSE. La cellule d'état contenait la
 *    pastille ET le geste, et cette colonne gonflait à 355 px pour les loger
 *    toutes deux quand les cinq autres en font 160 (mesuré à 1440 px). Le
 *    geste vit désormais dans sa propre colonne, que `DataTable` épingle.
 */

/** Le compte affiché sur une pastille — « En cours d’arbitrage2 » rend 2. */
function compteDe(bouton: HTMLElement): number {
  const chiffres = /(\d+)\s*$/.exec(bouton.textContent ?? '')
  expect(chiffres, `la pastille « ${bouton.textContent} » ne porte pas de compte`).not.toBeNull()
  return Number(chiffres![1])
}

describe('le tri des cautions', () => {
  it('trie par état, et chaque pastille rend son propre compte', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const main = screen.getByRole('main')
    const user = userEvent.setup()

    const groupe = within(main).getByRole('group', { name: /Statut|Status/ })
    const pastilles = within(groupe).getAllByRole('button')
    expect(pastilles.length, 'au moins « Toutes » et un état').toBeGreaterThan(1)

    /* Le compte d'une pastille est celui des LIGNES qu'elle rend : deux rendus
       indépendants qui doivent tomber d'accord, plutôt qu'un nombre figé dans
       le cas — le jeu de démonstration peut changer. */
    const lignes = () => within(main).getAllByRole('row').length - 1 // l'en-tête
    for (const pastille of pastilles) {
      const attendu = compteDe(pastille)
      await user.click(pastille)
      expect(lignes(), `« ${pastille.textContent} » rend un autre compte que le sien`).toBe(attendu)
    }
  })

  it('sort le geste de la cellule d’état, dans une colonne épinglée', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const main = screen.getByRole('main')

    /* UNE colonne épinglée, pas deux : `unSeulGesteColle` tient cette règle
       pour tout le produit, et cet écran en portait zéro — son geste vivait
       dans une cellule d'état qui gonflait pour le loger. Comptée dans
       l'EN-TÊTE : l'attribut marque chaque cellule de la colonne, et compter
       le corps rendrait le nombre de lignes. */
    expect(main.querySelectorAll('thead [data-colonne-tenue]').length).toBe(1)

    const arbitrer = within(main).getAllByRole('button', { name: /Arbitrer/ })
    expect(arbitrer.length, 'la démonstration porte des cautions à arbitrer').toBeGreaterThan(0)
    for (const bouton of arbitrer) {
      const cellule = bouton.closest('td')
      expect(cellule, 'le geste est bien dans une cellule').not.toBeNull()
      // La cellule du geste ne porte AUCUNE pastille d'état : les deux natures
      // sont séparées, ce que la largeur de la colonne d'état suppose.
      expect(within(cellule!).queryByText(/En cours d’arbitrage|Consignée|Restituée/)).toBeNull()
      // Et le geste porte son signe, comme les autres commandes du produit.
      expect(bouton.querySelector('svg'), 'le geste porte une icône').not.toBeNull()
    }
  })
})
