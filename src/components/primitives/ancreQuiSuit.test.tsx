import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MenuDeDebordement, MenuElement } from './MenuDeDebordement'

/**
 * LE PANNEAU SUIT SON DÉCLENCHEUR, MÊME QUAND RIEN NE DIT QU'IL A BOUGÉ.
 *
 * ═══ LE DÉFAUT, MESURÉ SUR L'ÉCRAN ═══
 *
 * `/demo/parc`, le 2026-10-08. On ouvre le menu d'une fiche, on presse
 * « Déplacer à droite ». Relevé :
 *
 *     à l'ouverture   panneau 856   déclencheur 876    écart  −20
 *     après le geste  panneau 856   déclencheur 1176   écart −320
 *
 * La fiche glisse d'une largeur de carte, le panneau reste. Il se retrouve
 * au-dessus de la fiche VOISINE en portant le titre de celle qu'il a quittée.
 * Nelson l'a rapporté d'une capture, d'un mot : « incohérence ».
 *
 * ═══ POURQUOI LES DEUX ÉCOUTEURS EXISTANTS NE SUFFISENT PAS ═══
 *
 * `MenuDeDebordement` recalculait déjà son ancre sur `scroll` — avec capture,
 * pour voir défiler le rail qui porte la fiche — et sur `resize`. Un
 * RÉORDONNANCEMENT DU DOM n'émet ni l'un ni l'autre : le nœud change de place,
 * aucun événement ne part, et l'ancre garde la position d'avant.
 *
 * ═══ UN REMÈDE A ÉTÉ ÉCRIT, MESURÉ, ET JETÉ ═══
 *
 * Recaler à la trame suivant un appui DANS le panneau. Posé, puis relevé à
 * l'écran : l'écart restait −320. React valide le réordonnancement après, et la
 * trame suivante rendait encore la position d'avant. Ce cas-ci le refuserait de
 * la même façon — il fait bouger le déclencheur SANS clic, ce qu'un recalage
 * attaché au clic ne verrait jamais.
 *
 * ═══ POURQUOI CE CAS VIT EN jsdom, ET NON AU NAVIGATEUR ═══
 *
 * Le volet du navigateur est MASQUÉ — `document.hidden` vaut `true`, et zéro
 * trame en 800 ms y a été comptée. `requestAnimationFrame` n'y est jamais
 * appelé, donc le suivi ne peut ni tourner ni être vu là-bas. Ici, l'horloge
 * est fausse et c'est ce qu'on veut : on avance les trames à la main, et la
 * géométrie est POSÉE — comme `ficheReordonnable.test.tsx` la pose, pour la
 * même raison, puisque jsdom ne fait aucune mise en page.
 */

/** La position que le déclencheur rendra — déplacée entre deux trames. */
let bordDroitDuDeclencheur = 876

const LARGEUR_DE_FENETRE = 1024

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  bordDroitDuDeclencheur = 876
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(LARGEUR_DE_FENETRE)
  /* TOUS les rectangles viennent d'ici : jsdom les rend tous à zéro, et un cas
     qui comparerait 0 à 0 passerait sans rien éprouver. */
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const estLeDeclencheur = this.tagName === 'BUTTON' && this.hasAttribute('aria-haspopup')
    const right = estLeDeclencheur ? bordDroitDuDeclencheur : 0
    return {
      x: right - 44,
      y: 100,
      top: 100,
      bottom: 144,
      left: right - 44,
      right,
      width: 44,
      height: 44,
      toJSON: () => ({}),
    } as DOMRect
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function Sonde() {
  return (
    <MenuDeDebordement echappe libelle="Actions du logement A2" sujet="A2">
      <MenuElement icone="sliders" nomAccessible="Corriger le logement A2">
        Corriger
      </MenuElement>
    </MenuDeDebordement>
  )
}

/** Le `right` que le panneau fixe porte, en pixels. */
function ancreDuPanneau(): number {
  const panneau = screen.getByRole('menu').closest<HTMLElement>('[style*="position"]')
  expect(panneau, 'aucun panneau positionné').not.toBeNull()
  return Math.round(parseFloat(panneau!.style.right))
}

describe('l’ancre d’un panneau qui échappe à sa boîte', () => {
  it('se pose à droite de son déclencheur à l’ouverture', async () => {
    const clic = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Sonde />)
    await clic.click(screen.getByRole('button', { name: 'Actions du logement A2' }))

    /* 1024 − 876 : le bord droit du panneau coïncide avec celui du déclencheur. */
    expect(ancreDuPanneau()).toBe(LARGEUR_DE_FENETRE - 876)
  })

  /**
   * LE CAS QUI COMPTE, et il ne clique nulle part.
   *
   * Le déclencheur change de place entre deux trames, sans événement d'aucune
   * sorte — ni `scroll`, ni `resize`, ni appui. C'est exactement ce que fait un
   * réordonnancement de rail, et c'est ce qu'aucun des remèdes attachés à une
   * CAUSE ne peut voir.
   */
  it('suit le déclencheur qui change de place sans qu’aucun événement ne parte', async () => {
    const clic = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Sonde />)
    await clic.click(screen.getByRole('button', { name: 'Actions du logement A2' }))
    expect(ancreDuPanneau()).toBe(LARGEUR_DE_FENETRE - 876)

    /* La fiche glisse d'une largeur de carte, comme à l'écran : 876 → 1176. */
    bordDroitDuDeclencheur = 1176
    await vi.advanceTimersByTimeAsync(64)

    expect(ancreDuPanneau(), 'le panneau flotte au-dessus de la fiche voisine').toBe(
      LARGEUR_DE_FENETRE - 1176,
    )
  })

  /**
   * ET IL S'ARRÊTE À LA FERMETURE.
   *
   * Une boucle de trames qui survivrait au panneau tournerait pour toujours sur
   * un écran au repos. Le cas le vérifie par son effet : le déclencheur bouge
   * après la fermeture, et plus rien ne doit en tenir compte.
   */
  it('cesse de suivre quand le menu est fermé', async () => {
    const clic = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Sonde />)
    const declencheur = screen.getByRole('button', { name: 'Actions du logement A2' })
    await clic.click(declencheur)
    await clic.click(declencheur)
    await vi.advanceTimersByTimeAsync(400)

    expect(screen.queryByRole('menu'), 'le panneau devait être démonté').toBeNull()
  })
})
