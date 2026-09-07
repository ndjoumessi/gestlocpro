import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * UN ÉCRAN DE TRI DOIT PORTER SON OUTIL DE TRI.
 *
 * « Signalements et notifications » range onze éléments par date, six non lus,
 * trois prioritaires — et n'offrait aucun moyen de n'en voir qu'une part. Deux
 * cartes d'indicateur donnaient les comptes sans rien en faire, dont une
 * — « Déjà lues · rien à faire dessus » — occupait la moitié de la largeur
 * pour annoncer qu'il n'y avait rien à faire.
 *
 * Les pastilles de filtre disent les MÊMES comptes et agissent : un seul
 * mécanisme au lieu de deux, et c'est celui que Paiements et Locataires
 * emploient déjà.
 *
 * LES OPTIONS SE DÉRIVENT DE CE QUI EXISTE, comme sur Locataires : pas de
 * pastille « Non lues » quand tout est lu, pas de « Prioritaires » sans
 * priorité. Une pastille qui ne rend rien n'est pas un filtre, c'est un piège.
 */

/** Le compte affiché sur une pastille — « Non lues6 » rend 6. */
function compteDe(bouton: HTMLElement): number {
  const chiffres = /(\d+)\s*$/.exec(bouton.textContent ?? '')
  expect(chiffres, `la pastille « ${bouton.textContent} » ne porte pas de compte`).not.toBeNull()
  return Number(chiffres![1])
}

describe('le tri des signalements', () => {
  it('remplace les deux cartes par des pastilles qui filtrent', async () => {
    await renderApp('/demo/signalements')
    await attendreLeChargement()
    const main = screen.getByRole('main')
    const user = userEvent.setup()

    // Les cartes d'indicateur ont disparu : elles disaient sans agir.
    expect(main.querySelectorAll('[data-indicateur]')).toHaveLength(0)

    const groupe = within(main).getByRole('group', { name: /Signalements|Reports/ })
    const pastilles = within(groupe).getAllByRole('button')
    expect(pastilles.map((b) => b.textContent?.replace(/\d+$/, '').trim())).toEqual([
      'Toutes',
      'Non lues',
      'Prioritaires',
    ])

    /* LE COMPTE D'UNE PASTILLE EST CELUI DE LA LISTE QU'ELLE REND, et c'est la
       propriété qui vaut d'être gardée : deux rendus indépendants — le compteur
       et la liste — doivent tomber d'accord. Un compte figé dans le cas ne
       dirait rien, le jeu de démonstration suivant l'horloge. */
    const liste = () => within(main).getAllByRole('listitem').length
    for (const pastille of pastilles) {
      const attendu = compteDe(pastille)
      await user.click(pastille)
      expect(liste(), `« ${pastille.textContent} » rend un autre compte que le sien`).toBe(attendu)
    }

    // Et le tri sert vraiment : les non lues sont MOINS nombreuses que toutes.
    expect(compteDe(pastilles[1]!)).toBeLessThan(compteDe(pastilles[0]!))
  })

  it('revient à « Toutes » quand la lecture vide le filtre en cours', async () => {
    /* Sans cela, « tout marquer comme lu » depuis « Non lues » laisserait une
       liste vide sous une pastille qui vient de disparaître. */
    await renderApp('/demo/signalements')
    await attendreLeChargement()
    const main = screen.getByRole('main')
    const user = userEvent.setup()
    const groupe = within(main).getByRole('group', { name: /Signalements|Reports/ })

    await user.click(within(groupe).getByRole('button', { name: /Non lues/ }))
    await user.click(screen.getByRole('button', { name: /Tout marquer comme lu/ }))

    expect(within(main).queryByRole('button', { name: /Non lues/ })).toBeNull()
    expect(within(main).getAllByRole('listitem').length).toBeGreaterThan(0)
  })
})
