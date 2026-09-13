import { describe, expect, it } from 'vitest'
import { renderApp, within } from '@/test/render'
import { EDITEUR } from '@/legal/editeur'

/**
 * LES PRIX DISENT S'ILS PORTENT LA TVA.
 *
 * La grille affichait des montants sans « HT » ni « TTC ». L'éditeur est en
 * franchise en base (déclaré par Nelson le 2026-09-13) : il ne facture pas de
 * TVA, et le prospect ne pouvait pas le savoir — un professionnel lit un prix nu
 * comme hors taxes et y ajoute vingt pour cent de tête.
 *
 * LA NOTE ET LA PAGE DES MENTIONS DISENT LA MÊME CHOSE, et un cas les lie : le
 * jour où le régime change, `EDITEUR.tva` change, et la note ne peut pas rester
 * en arrière sans faire rougir ce fichier.
 */
/* La phrase française est CONSTRUITE depuis la ligne de la page des mentions :
   si `EDITEUR.tva` change, ce que le cas cherche change avec lui, et une note
   restée en arrière ne se trouve plus. */
const NOTE_FR = `TVA ${EDITEUR.tva.charAt(0).toLowerCase()}${EDITEUR.tva.slice(1)}.`
const NOTE_EN = 'VAT not applicable, article 293 B of the French General Tax Code.'

describe('la note de TVA sous les prix', () => {
  for (const largeur of [360, 1280]) {
    it(`est dite une seule fois, sous la grille, à ${largeur} px`, async () => {
      await renderApp('/', { largeur })
      const tarifs = document.getElementById('pricing')!
      /* Une par section, pas une par carte : au bureau, les trois paliers sont
         montés ensemble. */
      expect(within(tarifs).getAllByText(NOTE_FR)).toHaveLength(1)
    })
  }

  it('se traduit en anglais', async () => {
    await renderApp('/', { locale: 'en' })
    const tarifs = document.getElementById('pricing')!
    expect(within(tarifs).getAllByText(NOTE_EN)).toHaveLength(1)
  })
})
