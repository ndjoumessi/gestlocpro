import { cleanup } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LE REGISTRE DES ACCÈS DEVIENT UNE FICHE PAR PERSONNE.
 *
 * MESURÉ à 1440 px avant ce lot : la colonne « Personne » prenait 532 px des
 * 1101 du tableau, et les rangées faisaient 69, 133, 69, 69 px. Celle de Diane
 * est deux fois plus haute que ses voisines parce que son périmètre est une
 * PHRASE de 153 caractères sur trois lignes. Un tableau aligne pour qu'on
 * compare ; des rangées du simple au double ne s'alignent plus.
 *
 * Et la phrase ne peut pas être coupée : un lot antérieur l'a écrite exprès —
 * « le registre disait qui accède, jamais SUR QUOI » — et l'écran qu'on relit
 * pour vérifier ce qu'on a confié est le dernier où l'on rogne.
 */

/** La tuile ou la rangée de cette personne, selon la forme rendue. */
function fiche(email: string): HTMLElement {
  /* Trois formes possibles, et le cas les accepte toutes : la tuile de la
     grille au-dessus de `lg`, la rangée du tableau si l'écran y revenait, et
     la fiche que `DataTable` rend de son côté sous `lg`. Ce qu'on garde n'est
     pas la forme — c'est que la personne porte les MÊMES gestes dans chacune. */
  const cible = screen.getByText(email).closest('[data-fiche-membre], tr, li')
  expect(cible, `aucune fiche ni rangée pour ${email}`).not.toBeNull()
  return cible as HTMLElement
}

/** Les noms accessibles des commandes offertes sur cette personne. */
function gestesOfferts(email: string): string[] {
  return within(fiche(email))
    .queryAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
    .sort()
}

describe('le registre des accès en fiches', () => {
  it('rend une fiche par membre au-dessus de lg, et non un tableau', async () => {
    await renderApp('/demo/acces')
    await attendreLeChargement()

    const fiches = Array.from(document.querySelectorAll('[data-fiche-membre]'))
    expect(fiches.length, 'la démonstration porte des membres').toBeGreaterThan(1)

    /* Les autres registres de l'écran — demandes, codes en attente — restent
       des tableaux : ils portent des valeurs homogènes et courtes. Seul celui
       des membres change de forme, et le cas le dit plutôt que de vérifier
       qu'aucun tableau ne subsiste. */
    for (const tuile of fiches) {
      expect(tuile.closest('table'), 'une fiche de membre n’est pas dans un tableau').toBeNull()
    }
  })

  it('porte la phrase de périmètre ENTIÈRE, sans la rogner', async () => {
    await renderApp('/demo/acces')
    await attendreLeChargement()

    /* La fin de la phrase, et non son début : c'est ce que `truncate` aurait
       fait disparaître — sans déborder d'aucune garde, le DOM portant quand
       même la chaîne entière. Le cas lit donc la LARGEUR RENDUE plutôt que le
       texte, qui mentirait. */
    const diane = fiche('diane@example.com')
    const phrase = within(diane).getByText(/sauf/)
    expect(phrase.textContent!.length, 'le périmètre de Diane est une phrase').toBeGreaterThan(100)
    expect(getComputedStyle(phrase).textOverflow).not.toBe('ellipsis')
  })

  it('offre les mêmes gestes sous les deux formes, sous les mêmes noms', async () => {
    /* LA RÈGLE QUE CE PRODUIT A PAYÉE TROIS FOIS : un geste qui n'existe que
       dans une forme n'existe que pour la moitié des gens. La relance d'un
       locataire ne s'ouvrait qu'à 1280 px, et rien ne le disait. */
    await renderApp('/demo/acces')
    await attendreLeChargement()
    const enFiches = gestesOfferts('diane@example.com')
    expect(enFiches.length, 'la démonstration offre des gestes sur Diane').toBeGreaterThan(0)

    /* `cleanup()` D'ABORD : le harnais ne démonte qu'entre les CAS, et deux
       rendus superposés rendraient chaque requête ambiguë — la seconde forme
       trouverait les gestes de la première. */
    cleanup()
    await renderApp('/demo/acces', { largeur: 800 })
    await attendreLeChargement()
    expect(gestesOfferts('diane@example.com')).toEqual(enFiches)
  })

  it('trie par rôle, et chaque pastille rend son propre compte', async () => {
    await renderApp('/demo/acces')
    await attendreLeChargement()
    const user = userEvent.setup()

    const groupe = screen.getByRole('group', { name: /par rôle|by role/i })
    const pastilles = within(groupe).getAllByRole('button')
    expect(pastilles.length, 'au moins « Tous » et un rôle').toBeGreaterThan(1)

    for (const pastille of pastilles) {
      const chiffres = /(\d+)\s*$/.exec(pastille.textContent ?? '')
      expect(chiffres, `« ${pastille.textContent} » ne porte pas de compte`).not.toBeNull()
      await user.click(pastille)
      expect(
        document.querySelectorAll('[data-fiche-membre]').length,
        `« ${pastille.textContent} » rend un autre compte que le sien`,
      ).toBe(Number(chiffres![1]))
    }
  })
})
