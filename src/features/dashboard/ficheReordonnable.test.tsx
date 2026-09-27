import { describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { attendreLeChargement, renderApp, renderWithProviders, screen, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { RailDeLogements } from './RailDeLogements'

/**
 * UNE FICHE SE DÉPLACE PARMI LES AUTRES.
 *
 * ═══ CE QUE LE LOT PRÉCÉDENT AVAIT LIVRÉ, ET POURQUOI CE N'ÉTAIT PAS ÇA ═══
 *
 * Le rail se saisissait pour être POUSSÉ — un panoramique. La demande était que
 * la FICHE se déplace parmi les autres. Les deux gestes commencent par le même
 * appui de souris dans la même zone : ils ne peuvent pas coexister au même
 * endroit. Le panoramique se replie donc sur le FOND du rail, et la fiche prend
 * l'appui qui la concerne. Les deux derniers cas tiennent ce partage, et ils
 * comptent autant que les premiers — sans eux, un correctif qui prendrait tous
 * les appuis passerait au vert.
 *
 * ═══ L'ORDRE NE SURVIT PAS, ET C'EST LA DÉCISION ═══
 *
 * Rien n'est écrit : au rechargement, le parc retrouve son ordre. C'est un geste
 * d'INSPECTION — mettre deux logements côte à côte pour les comparer — pas un
 * réglage. Ces cas ne mesurent donc jamais une persistance ; le champ qui la
 * porterait n'existe pas en base.
 *
 * ═══ LA GÉOMÉTRIE EST POSÉE À LA MAIN, ET IL FAUT LE DIRE ═══
 *
 * jsdom ne fait aucune mise en page : tous les rectangles y valent zéro. Sans
 * rien, le calcul d'index recevrait trois centres à 0 et rendrait toujours le
 * dernier — un cas qui passerait POUR UNE MAUVAISE RAISON. On pose donc des
 * rectangles, ce qui rend l'assertion vraie du calcul plutôt que de l'absence de
 * mise en page. Ce que ça n'éprouve pas : que le composant lise les bons
 * rectangles au bon moment. `ordreDuRail.test.ts` tient le calcul, l'écran tient
 * le reste.
 */

const LARGEUR = 200

function RailSonde() {
  return (
    <RailDeLogements libelle="Logements de l’immeuble témoin">
      {['A1', 'A2', 'A3'].map((nom) => (
        <li key={nom} data-fiche-logement>
          <a href={`/parc/${nom}`}>{nom}</a>
        </li>
      ))}
    </RailDeLogements>
  )
}

function rail(): HTMLElement {
  return screen.getByRole('list', { name: 'Logements de l’immeuble témoin' })
}

function fiches(): HTMLElement[] {
  return Array.from(rail().querySelectorAll<HTMLElement>('[data-fiche-logement]'))
}

/** L'ordre affiché, lu sur le DOM. */
function ordre(): string[] {
  return fiches().map((li) => li.textContent?.trim() ?? '')
}

/** Trois fiches de 200 px côte à côte : centres à 100, 300, 500. */
function poserLaGeometrie() {
  fiches().forEach((li, i) => {
    li.getBoundingClientRect = () =>
      ({ left: i * LARGEUR, right: (i + 1) * LARGEUR, width: LARGEUR, top: 0, bottom: 100, height: 100, x: i * LARGEUR, y: 0, toJSON: () => ({}) }) as DOMRect
  })
}

describe('une fiche se déplace parmi les autres', () => {
  it('suit le curseur et prend la place qu’elle a dépassée', () => {
    renderWithProviders(<RailSonde />)
    poserLaGeometrie()
    const [premiere] = fiches()

    fireEvent.pointerDown(premiere!, { clientX: 100, button: 0, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(premiere!, { clientX: 350, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(premiere!, { clientX: 350, pointerId: 1, pointerType: 'mouse' })

    expect(ordre(), 'la fiche n’a pas changé de place').toEqual(['A2', 'A3', 'A1'])
  })

  it('ne bouge pas sous un geste du doigt', () => {
    renderWithProviders(<RailSonde />)
    poserLaGeometrie()
    const [premiere] = fiches()

    fireEvent.pointerDown(premiere!, { clientX: 100, button: 0, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerMove(premiere!, { clientX: 350, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerUp(premiere!, { clientX: 350, pointerId: 1, pointerType: 'touch' })

    expect(ordre(), 'le doigt a réordonné : il ne peut plus faire défiler').toEqual(['A1', 'A2', 'A3'])
  })

  it('ne bouge pas sous le seuil', () => {
    renderWithProviders(<RailSonde />)
    poserLaGeometrie()
    const [premiere] = fiches()

    fireEvent.pointerDown(premiere!, { clientX: 100, button: 0, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(premiere!, { clientX: 102, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(premiere!, { clientX: 102, pointerId: 1, pointerType: 'mouse' })

    expect(ordre(), 'deux pixels ont réordonné le rail').toEqual(['A1', 'A2', 'A3'])
  })

  it('supprime le clic du lien après un déplacement', () => {
    renderWithProviders(<RailSonde />)
    poserLaGeometrie()
    const [premiere] = fiches()
    const lien = screen.getByRole('link', { name: 'A1' })

    fireEvent.pointerDown(lien, { clientX: 100, button: 0, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(premiere!, { clientX: 350, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(premiere!, { clientX: 350, pointerId: 1, pointerType: 'mouse' })

    expect(fireEvent.click(lien), 'déplacer une fiche ouvre le logement').toBe(false)
  })

  it('laisse le FOND du rail se pousser comme avant', () => {
    renderWithProviders(<RailSonde />)
    const boite = rail()
    boite.scrollLeft = 200

    fireEvent.pointerDown(boite, { clientX: 500, button: 0, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(boite, { clientX: 380, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(boite, { clientX: 380, pointerId: 1, pointerType: 'mouse' })

    expect(boite.scrollLeft, 'le panoramique du fond a été perdu').toBe(320)
  })

  it('ne pousse plus le rail quand l’appui vient d’une fiche', () => {
    renderWithProviders(<RailSonde />)
    poserLaGeometrie()
    const boite = rail()
    const [premiere] = fiches()
    boite.scrollLeft = 200

    fireEvent.pointerDown(premiere!, { clientX: 500, button: 0, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(premiere!, { clientX: 380, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(premiere!, { clientX: 380, pointerId: 1, pointerType: 'mouse' })

    expect(
      boite.scrollLeft,
      'les deux gestes se disputent l’appui : la rangée bouge pendant qu’on range une fiche',
    ).toBe(200)
  })
})

/**
 * L'ALTERNATIVE À UN SEUL POINTEUR, SUR L'ÉCRAN RÉEL.
 *
 * WCAG 2.5.7 : une fonction obtenue par glissement doit être obtenable
 * autrement. Les cas plus haut mesurent le GESTE ; celui-ci mesure que
 * l'alternative existe là où elle doit être — dans le menu d'une vraie fiche,
 * sur l'écran du parc — et qu'elle fait la même chose.
 *
 * Il monte l'écran entier plutôt que le rail seul, et c'est délibéré : ce qui
 * est éprouvé ici est le CÂBLAGE entre le menu, qui vit chez l'appelant, et
 * l'ordre, qui vit dans le rail. Un rail monté seul avec un enfant de
 * circonstance ne dirait rien de ce raccord.
 */
describe('déplacer une fiche sans glisser', () => {
  it('propose les deux sens dans le menu de la fiche, et les exécute', async () => {
    const user = userEvent.setup()
    installerFauxServeur()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const rangee = screen.getByRole('list', { name: /Résidence Bonamoussadi/i })
    const avant = Array.from(rangee.querySelectorAll('[data-fiche-logement]')).map(
      (li) => li.querySelector('a')?.textContent?.trim() ?? '',
    )

    await user.click(screen.getByRole('button', { name: 'Actions du logement A1' }))
    const menu = await screen.findByRole('menu', { name: 'Actions du logement A1' })
    await user.click(within(menu).getByRole('menuitem', { name: /Déplacer à droite/ }))

    const apres = Array.from(rangee.querySelectorAll('[data-fiche-logement]')).map(
      (li) => li.querySelector('a')?.textContent?.trim() ?? '',
    )
    expect(apres, 'le menu n’a pas déplacé la fiche').not.toEqual(avant)
    expect(apres[1], 'la fiche n’a pas pris la place de sa voisine de droite').toBe(avant[0])
  })
})
