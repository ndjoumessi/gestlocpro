import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '@/test/render'
import { useState } from 'react'
import { Input } from './Input'

/**
 * LE REFUS SE VOYAIT, IL NE SE DISAIT PAS.
 *
 * ═══ CE QUE LE FILTRE FAISAIT, ET CE QU'IL NE FAISAIT PAS ═══
 *
 * `useSaisieFiltree` refuse en bloc une saisie qui sort du mode déclaré, et
 * remet la valeur précédente à la main — son commentaire dit « pour que le
 * refus se voie ». Ce qui se voit est l'ABSENCE du caractère, pas le refus :
 * sur un clavier physique, taper « 1o3 » rend un champ qui semble avaler une
 * touche au hasard, et un lecteur d'écran n'annonce rien puisque rien n'a
 * changé.
 *
 * ═══ POURQUOI UNE CLÉ QUI AVANCE ═══
 *
 * Une région vivante n'annonce que ce qui CHANGE. Deux refus de suite portent
 * le même texte : le second resterait muet. Un nœud dont la clé avance est
 * remonté à chaque refus, et l'annonce repart — sans minuterie à nettoyer.
 * C'est la moitié du lot qu'un cas naïf oublierait, et le troisième cas
 * ci-dessous est là pour elle.
 */

/** Un champ contrôlé, comme tous ceux du produit — le filtre n'agit que là. */
function ChampNumerique() {
  const [valeur, setValeur] = useState('')
  return (
    <>
      <label htmlFor="montant">Montant</label>
      <Input
        id="montant"
        inputMode="numeric"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
      />
    </>
  )
}

/** La région vivante du champ — vide au repos. */
function annonce(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[aria-live="polite"]')
  expect(region, 'le champ ne porte aucune région vivante').not.toBeNull()
  return region!
}

describe('la frappe refusée', () => {
  it('se dit à qui écoute la page, au lieu d’être absorbée en silence', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChampNumerique />)

    /* AU REPOS, RIEN : une région montée avec son texte dedans n'annonce rien,
       et une région qui parle sans qu'on ait rien fait parle pour ne rien
       dire. */
    expect(annonce().textContent?.trim(), 'la région parle avant toute frappe').toBe('')

    const champ = screen.getByLabelText('Montant')
    await user.type(champ, '1o')

    expect((champ as HTMLInputElement).value, 'la lettre est entrée dans le champ').toBe('1')
    expect(annonce().textContent, 'le refus reste muet').toMatch(/chiffres/i)
  })

  it('se tait dès que la frappe suivante est acceptée', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChampNumerique />)
    const champ = screen.getByLabelText('Montant')

    await user.type(champ, 'o')
    expect(annonce().textContent).toMatch(/chiffres/i)

    /* L'ANNONCE A DIT CE QU'ELLE AVAIT À DIRE. La laisser traîner la ferait
       relire à chaque relecture du champ, longtemps après la faute. */
    await user.type(champ, '5')
    expect(annonce().textContent?.trim(), 'le message traîne après une frappe juste').toBe('')
  })

  it('reparle au second refus, que le même texte rendrait muet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChampNumerique />)
    const champ = screen.getByLabelText('Montant')

    await user.type(champ, 'o')
    const premier = annonce().querySelector('span')

    await user.type(champ, 'x')
    const second = annonce().querySelector('span')

    /* LE NŒUD A ÉTÉ REMONTÉ : c'est ce que la région observe, le texte ne
       changeant pas d'un refus à l'autre. Sans cela, le second refus serait
       silencieux — le cas le plus probable en vrai, puisqu'on ne se trompe
       jamais une seule fois. */
    expect(second, 'le nœud porteur de la clé a disparu').not.toBeNull()
    expect(second, 'le second refus ne se réannonce pas').not.toBe(premier)
  })
})
