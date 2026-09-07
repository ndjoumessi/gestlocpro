import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * L'ÉCRAN DES TRAVAUX TRIAIT SUR UN SEUL AXE, ET CE N'ÉTAIT PAS LE BON.
 *
 * « Trier par origine » répond à « qu'est-ce qu'on me signale ? ». Mais
 * l'indicateur le plus actionnable de l'écran est ailleurs : « Devis à
 * arbitrer 1 » — une décision qui attend quelqu'un —, et rien ne menait à ce
 * chantier-là. L'origine dit D'OÙ VIENT une demande, l'état dit CE QU'ELLE
 * ATTEND. Deux axes, donc deux groupes nommés.
 *
 * Ce que ce cas garde, et qui est la seule chose difficile ici : les deux
 * tris SE COMPOSENT, et chaque compte se lit sur l'autre axe. Le compte d'une
 * pastille d'état est celui des chantiers de l'origine retenue. Sans cela,
 * une pastille annoncerait un nombre que le clic ne rendrait pas.
 */

/** Le compte porté par une pastille — « Signalé3 » rend 3. */
function compteDe(bouton: HTMLElement): number {
  const chiffres = /(\d+)\s*$/.exec(bouton.textContent ?? '')
  expect(chiffres, `la pastille « ${bouton.textContent} » ne porte pas de compte`).not.toBeNull()
  return Number(chiffres![1])
}

describe('le tri des travaux par état', () => {
  it('trie par état, et chaque pastille rend son propre compte', async () => {
    await renderApp('/demo/travaux')
    await attendreLeChargement()
    const main = screen.getByRole('main')
    const user = userEvent.setup()

    const groupe = within(main).getByRole('group', { name: /par état|by status/ })
    const pastilles = within(groupe).getAllByRole('button')
    expect(pastilles.length, 'au moins « Toutes » et un état').toBeGreaterThan(1)

    const chantiers = () =>
      within(within(main).getByRole('list', { name: /Interventions|Jobs/ })).getAllByRole('listitem')
        .length

    for (const pastille of pastilles) {
      const attendu = compteDe(pastille)
      await user.click(pastille)
      expect(chantiers(), `« ${pastille.textContent} » rend un autre compte que le sien`).toBe(
        attendu,
      )
    }
  })

  it('compose les deux axes : le compte d’un état suit l’origine retenue', async () => {
    await renderApp('/demo/travaux')
    await attendreLeChargement()
    const main = screen.getByRole('main')
    const user = userEvent.setup()

    const parOrigine = within(main).getByRole('group', { name: /origine|origin/i })
    const parEtat = within(main).getByRole('group', { name: /par état|by status/ })

    /* On restreint l'origine, PUIS on relit les comptes d'état : ils doivent
       avoir bougé avec, et chacun rendre ce qu'il annonce. C'est la propriété
       qu'un filtre naïf casse — deux `useState` indépendants, deux listes
       filtrées séparément, et des pastilles qui comptent le parc entier. */
    const signalees = within(parOrigine).getAllByRole('button')[1]
    await user.click(signalees)

    const chantiers = () =>
      within(within(main).getByRole('list', { name: /Interventions|Jobs/ })).getAllByRole('listitem')
        .length

    for (const pastille of within(parEtat).getAllByRole('button')) {
      const attendu = compteDe(pastille)
      await user.click(pastille)
      expect(
        chantiers(),
        `sous « Signalées », « ${pastille.textContent} » ne rend pas son compte`,
      ).toBe(attendu)
    }
  })

  it('donne un signe aux trois décisions de l’écran', async () => {
    await renderApp('/demo/travaux')
    await attendreLeChargement()
    const main = screen.getByRole('main')

    /* Chiffrer, valider, clore : les trois décisions, et les seules commandes
       nues d'un produit qui pose une icône partout ailleurs. Une carte en
       porte jusqu'à deux côte à côte ; le glyphe les sépare avant la lecture. */
    const decisions = within(main).getAllByRole('button', {
      name: /Chiffrer|Valider le devis|Marquer terminé|^Quote$|Approve quote|Mark as done/,
    })
    expect(decisions.length, 'la démonstration porte des décisions à prendre').toBeGreaterThan(0)
    for (const bouton of decisions) {
      expect(bouton.querySelector('svg'), `« ${bouton.textContent} » ne porte pas d’icône`).not.toBeNull()
    }
  })
})
