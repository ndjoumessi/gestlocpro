import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LE RELEVÉ DES COMPTEURS COMPTAIT SANS PERMETTRE D'ALLER VOIR.
 *
 * C'est le sixième écran que Nelson a montré le 2026-09-07, et le seul des six
 * qu'aucun lot n'avait touché. Il porte pourtant le même défaut que les cinq
 * autres avaient : une note ambre annonce « 2 relevés manquants pour la
 * période — A5 et C2 », et rien ne mène à ces deux lignes-là.
 *
 * CE QUE CE CHIFFRE DÉCLENCHE, et c'est ce qui le distingue des autres
 * compteurs du produit : une TOURNÉE. Quelqu'un se déplace. Sur dix logements
 * on lit les deux noms dans la note et on les cherche à l'œil ; sur soixante,
 * la liste des unités à visiter est précisément ce qu'on vient chercher, et
 * l'écran la calculait sans jamais l'afficher comme une liste.
 */

/** Le compte porté par une pastille — « Relevé manquant2 » rend 2. */
function compteDe(bouton: HTMLElement): number {
  const chiffres = /(\d+)\s*$/.exec(bouton.textContent ?? '')
  expect(chiffres, `la pastille « ${bouton.textContent} » ne porte pas de compte`).not.toBeNull()
  return Number(chiffres![1])
}

const lignes = () => within(screen.getByRole('main')).getAllByRole('row').length - 1

describe('le tri des relevés', () => {
  it('trie par état de relevé, et chaque pastille rend son propre compte', async () => {
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const user = userEvent.setup()

    const groupe = within(screen.getByRole('main')).getByRole('group', {
      name: /relevé|reading/i,
    })
    const pastilles = within(groupe).getAllByRole('button')
    expect(pastilles.length, 'au moins « Tous » et un état').toBeGreaterThan(1)

    for (const pastille of pastilles) {
      const attendu = compteDe(pastille)
      await user.click(pastille)
      expect(lignes(), `« ${pastille.textContent} » rend un autre compte que le sien`).toBe(attendu)
    }
  })

  it('rend EXACTEMENT les logements que la note nomme', async () => {
    /*
      LE CAS QUI VAUT LE FICHIER. La note et la pastille comptent la même chose
      par deux chemins indépendants — l'une énumère des libellés dans une
      phrase, l'autre filtre des lignes — et un écran qui annonce « A5 et C2 »
      puis en rend trois est pire qu'un écran qui ne trie pas : on partirait en
      tournée sur un logement relevé.
    */
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const main = screen.getByRole('main')
    const user = userEvent.setup()

    /* La note ambre porte les libellés en toutes lettres, séparés par la
       conjonction de la langue — on lit donc les unités DANS la note plutôt que
       de réécrire sa grammaire ici. */
    const note = within(main).getByText(/relevés? manquants? pour la période|readings? missing/i)
    const phrase = note.closest('div')!.textContent ?? ''

    const manquante = within(main)
      .getAllByRole('button')
      .find((b) => /^Relevé manquant|^Reading missing/.test(b.textContent ?? ''))
    expect(manquante, 'aucune pastille ne mène aux relevés manquants').toBeDefined()
    await user.click(manquante!)

    const rendus = within(main)
      .getAllByRole('row')
      .slice(1)
      /* Le PREMIER `span` de la cellule, et non son texte entier : la colonne
         d'unité empile le libellé et, sous `sm`, le nom du locataire — « A5 »
         suivi de « Aline Tchoumi » sans séparateur dans le DOM. */
      .map((r) => r.querySelector('td span')?.textContent?.trim() ?? '')
    expect(rendus.length, 'la démonstration porte des relevés manquants').toBeGreaterThan(0)
    for (const unite of rendus) {
      expect(phrase, `la note ne nomme pas ${unite}, que la pastille rend`).toContain(unite)
    }
  })

  it('ouvre sur l’état que porte l’adresse', async () => {
    /* Comme les sept autres tris du produit : une tournée se PARTAGE — « voici
       ce qu'il reste à relever » — donc elle a une adresse. */
    await renderApp('/demo/releves?etat=manquant')
    await attendreLeChargement()

    const groupe = within(screen.getByRole('main')).getByRole('group', { name: /relevé|reading/i })
    const pressees = within(groupe)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressees).toHaveLength(1)
    expect(pressees[0]!.textContent).toMatch(/^Relevé manquant|^Reading missing/)
  })
})
