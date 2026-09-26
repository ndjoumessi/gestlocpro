import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * LE SEUL REPÈRE DE LIEU DU TÉLÉPHONE ÉTAIT MUET LÀ OÙ L'ON EST PERDU.
 *
 * ═══ QUATRE PLACES, DOUZE ÉCRANS ═══
 *
 * La barre basse ne tient que quatre destinations. Sur les autres — cautions,
 * relevés, locataires, décisions, mes données —, aucune pastille ne s'allumait,
 * et « Plus » ne s'allumait jamais non plus : son commentaire l'affirmait comme
 * une évidence, « Plus n'est pas une destination et ne peut donc pas être
 * l'entrée courante ».
 *
 * C'est vrai de la DESTINATION, faux du REPÈRE. « Plus » CONTIENT l'écran
 * courant quand aucune des quatre ne le porte — le tiroir qu'il déplie a
 * l'entrée allumée. Il se lit donc « vous êtes là-dedans », ce qui est vrai, et
 * c'est la seule information disponible.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * Les deux moitiés, et la seconde est celle qu'on oublie : que « Plus »
 * s'allume hors des quatre, et qu'il RESTE ÉTEINT sur les quatre — sans quoi
 * deux cibles se diraient courantes en même temps, ce qui est pire que zéro.
 */

/** Le bouton « Plus » de la barre basse, et son état de repère. */
function boutonPlus(): HTMLElement {
  const barre = screen.getByRole('navigation', { name: /rapide|quick/i })
  return within(barre).getByRole('button', { name: /plus|more/i })
}

describe('le repère de la barre basse', () => {
  it('allume « Plus » quand l’écran courant n’a pas sa place dans les quatre', async () => {
    /* LES CAUTIONS NE SONT PAS DANS `BOTTOM_ORDER` : c'est exactement le cas
       où la barre ne disait rien du lieu. */
    /* `largeur: 360` : la barre basse est `lg:hidden`, et c'est la largeur que
       les autres cas de ce dossier emploient pour l'atteindre. */
    await renderApp('/demo/cautions', { largeur: 360 })
    await attendreLeChargement()

    expect(
      boutonPlus().getAttribute('aria-current'),
      'l’écran courant n’est signalé nulle part sur téléphone',
    ).toBe('true')
  })

  it('le laisse éteint quand l’écran courant est l’une des quatre', async () => {
    /* LE CONTREPOIDS, et il est la moitié du lot : les paiements ont leur
       place dans la barre, donc c'est LEUR cible qui porte le repère. Deux
       cibles courantes à la fois vaudraient moins que zéro. */
    await renderApp('/demo/paiements', { largeur: 360 })
    await attendreLeChargement()

    expect(
      boutonPlus().getAttribute('aria-current'),
      '« Plus » se dit courant alors qu’une destination l’est déjà',
    ).toBeNull()

    const barre = screen.getByRole('navigation', { name: /rapide|quick/i })
    const courants = within(barre)
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
    expect(courants, 'la destination courante n’est plus signalée').toHaveLength(1)
  })
})
