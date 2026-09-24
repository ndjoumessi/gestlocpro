import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/render'
import { Combobox } from './Combobox'

/**
 * LA LISTE CHERCHABLE S'EN VA, ET ELLE S'EN VA DANS LE BON ORDRE.
 *
 * ═══ CE QUE CETTE GARDE TIENT ═══
 *
 * C'est la forme de `sortieDesPanneauxDeDate.test.tsx`, transposée au dernier
 * panneau ancré du dépôt : trois faits, dans cet ordre, sur le MÊME nœud et à la
 * MÊME fermeture.
 *
 *   1. dès la fermeture, la liste a quitté l'ARBRE D'ACCESSIBILITÉ — une requête
 *      par rôle ne la trouve plus, et ses OPTIONS non plus ;
 *   2. à cet instant précis, elle est pourtant encore PEINTE — elle est dans le
 *      document, en train de finir `animate-pop-out` ;
 *   3. et elle finit par partir pour de bon.
 *
 * Aucun des trois ne se suffit. Le premier seul est vrai d'une liste qui se
 * démonte d'une image — c'est l'état d'avant ce lot. Le deuxième seul décrirait
 * une surface qui s'attarde en restant lisible, tabulable et CLIQUABLE, ce qui
 * est pire que pas de sortie du tout. Le troisième seul ne dit rien d'une
 * surface qui ne serait jamais partie.
 *
 * ═══ LES OPTIONS, ET NON SEULEMENT LA LISTE ═══
 *
 * `aria-hidden` est posé sur le `<ul>` ; les `<li role="option">` sont ses
 * DESCENDANTS et ne portent rien. Le constat sur la seule liste serait donc vert
 * même si les options restaient trouvables — et `echapDansUneModale.test.tsx:54`
 * affirme `queryAllByRole('option')` vide immédiatement après Échap, sans
 * `waitFor`. Ce que ce cas-ci mesure explicitement, l'autre le suppose.
 *
 * ═══ ET UN QUATRIÈME FAIT ═══
 *
 * Ce qui FERME reste accroché à `ouvert`, jamais à l'état monté : à l'instant où
 * la liste s'en va, le champ annonce déjà `aria-expanded="false"` et ne désigne
 * plus aucune option active. Une liste en sortie dont le champ annoncerait
 * encore « développé » enverrait le lecteur d'écran vers une surface que
 * personne ne voit plus.
 *
 * ═══ POURQUOI DEUX LECTURES DU MÊME NŒUD, ET NON UNE ═══
 *
 * La requête par rôle passe par Testing Library, qui ignore par défaut ce que
 * porte `aria-hidden="true"` : c'est la vue de qui LIT le document. Le
 * `querySelector` interroge le DOM brut, qui n'en sait rien : c'est la vue de
 * qui REGARDE l'écran. La sortie différée est exactement l'écart entre ces deux
 * vues, et il n'y a pas d'autre façon de l'observer depuis jsdom, qui ne calcule
 * aucune animation.
 *
 * ═══ LE CHAMP EST MONTÉ EN PERMANENCE, SEULE SON OUVERTURE BASCULE ═══
 *
 * `Combobox` ne prend pas son ouverture en propriété : elle est interne, et on
 * la bascule donc par le geste qui l'ouvre puis par Échap, comme un utilisateur.
 * Ce qui reste monté d'un bout à l'autre est le CHAMP — de sorte que ce qui
 * entre et sort de l'arbre entre les deux relevés est la liste, et rien d'autre.
 */

const OPTIONS = [
  { value: '+237', label: 'Cameroun · +237' },
  { value: '+221', label: 'Sénégal · +221' },
  { value: '+33', label: 'France · +33' },
]

function Champ() {
  const [valeur, setValeur] = useState('+33')
  return (
    <Combobox
      aria-label="Indicatif"
      autoComplete="tel-country-code"
      options={OPTIONS}
      value={valeur}
      onChange={setValeur}
    />
  )
}

const liste = () => screen.queryByRole('listbox')
const peinte = () => document.querySelector('[role="listbox"]')

describe('la sortie de la liste cherchable', () => {
  it('quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = () => screen.getByLabelText('Indicatif')

    await user.click(champ())

    /* GARDE DU GARDE. « Elle est partie » et « elle n'est jamais venue »
       s'écrivent pareil dans un rapport vert : une liste vide rendrait VRAIE
       toute négation portant sur son contenu. */
    const ouverte = liste()
    expect(ouverte, 'la liste ne s’est pas ouverte — rien à mesurer').not.toBeNull()
    expect(
      within(ouverte!).getAllByRole('option').length,
      'la liste s’est ouverte sans une seule option',
    ).toBe(OPTIONS.length)

    await user.keyboard('{Escape}')

    expect(
      liste(),
      'la liste fermée est ENCORE dans l’arbre d’accessibilité : elle retient le focus et avale les clics pendant sa sortie',
    ).toBeNull()
    expect(
      screen.queryAllByRole('option'),
      'les OPTIONS sont encore trouvables : `aria-hidden` manque au `<ul>`, ou il est posé au mauvais étage',
    ).toHaveLength(0)
    expect(
      peinte(),
      'la liste a disparu d’une image : elle se démonte au lieu de SORTIR',
    ).not.toBeNull()

    /* LA FERMETURE EST ACCROCHÉE À `ouvert`, PAS À L'ÉTAT MONTÉ. Les deux
       constats se lisent PENDANT la sortie, la liste encore peinte : c'est le
       seul instant où l'erreur serait visible. */
    expect(
      champ(),
      'le champ annonce encore une liste développée alors qu’elle s’en va',
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      champ(),
      'le champ désigne encore une option active dans une liste qui s’en va',
    ).not.toHaveAttribute('aria-activedescendant')

    await waitFor(() =>
      expect(peinte(), 'la liste ne se démonte jamais : elle reste peinte pour toujours').toBeNull(),
    )
  })
})
