import { describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithProviders, screen } from '@/test/render'
import { RailDeLogements } from './RailDeLogements'

/**
 * LE RAIL SE SAISIT À LA SOURIS.
 *
 * ═══ LA FRICTION ═══
 *
 * Le rail des logements défile horizontalement. Au doigt c'est naturel ; à la
 * souris il ne restait que deux chemins, et son propre docbloc les dit tous
 * deux mauvais : « la barre de défilement — une cible de quelques pixels — ou
 * la molette horizontale, que peu de matériels ont ». Les deux flèches ont été
 * posées pour ça, et elles avancent d'une fiche à la fois.
 *
 * On peut désormais attraper la rangée et la faire glisser.
 *
 * ═══ SOURIS SEULEMENT, ET C'EST TOUTE LA CONCEPTION ═══
 *
 * Un glissement au DOIGT sur une fiche entrerait en concurrence avec le
 * défilement natif du rail, qui fonctionne déjà et qu'aucun seuil ne peut
 * égaler — c'est le conflit de gestes le plus vicieux qui soit, et il se paie
 * sur l'Android d'entrée de gamme que ce produit vise. En bornant l'écoute à
 * `pointerType === 'mouse'`, il n'y a plus deux prétendants au même geste : le
 * doigt garde le comportement du navigateur, la souris gagne un geste qu'elle
 * n'avait pas.
 *
 * Le deuxième cas garde cette borne. Sans lui, un correctif qui écouterait tous
 * les pointeurs passerait au vert sur les trois autres.
 *
 * ═══ LE SEUIL, ET POURQUOI IL EST LA MOITIÉ DU LOT ═══
 *
 * Chaque fiche porte un LIEN vers le logement et un MENU. Sans seuil, attraper
 * le rail navigue : on relâche, le clic part, et l'écran change. Les deux
 * derniers cas tiennent les deux bords de cette règle — un clic franc passe, un
 * clic qui suit un glissement est supprimé. Un seul des deux ne dirait rien :
 * supprimer tous les clics « réussirait » le troisième.
 *
 * ═══ CE QUE JSDOM PEUT DIRE ICI ═══
 *
 * `scrollLeft` est une propriété ordinaire : elle s'écrit et se relit sans mise
 * en page. C'est donc la seule partie du défilement qui soit mesurable hors
 * navigateur, et c'est celle que ce geste pilote. Ce que ces cas NE disent pas :
 * que le rail ait quelque chose à défiler (`scrollWidth` vaut zéro sous jsdom),
 * ni que le curseur change, ni que l'accroche `snap` se comporte bien au
 * relâchement — cela se regarde à l'écran.
 */

/** Trois fiches, pour que le rail ait un contenu à faire glisser. */
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

/** Un glissement complet, du bouton enfoncé au relâchement. */
function glisser(
  boite: HTMLElement,
  { de, vers, pointeur = 'mouse' }: { de: number; vers: number; pointeur?: string },
) {
  fireEvent.pointerDown(boite, { clientX: de, button: 0, pointerId: 1, pointerType: pointeur })
  fireEvent.pointerMove(boite, { clientX: vers, pointerId: 1, pointerType: pointeur })
  fireEvent.pointerUp(boite, { clientX: vers, pointerId: 1, pointerType: pointeur })
}

describe('le rail se saisit à la souris', () => {
  /**
   * ═══ LA CAPTURE NE SE PREND PAS À L'APPUI ═══
   *
   * CE CAS EXISTE PARCE QUE LES QUATRE AUTRES ONT LAISSÉ PASSER LE DÉFAUT.
   * Premier jet du correctif : `setPointerCapture` dès `pointerdown`. Les quatre
   * cas passaient, et le lien d'une fiche ne naviguait plus — relevé à la main
   * sur `/demo/parc`, page fraîche : clic sur « A1 », l'adresse immobile.
   *
   * La spec l'explique : tant qu'un pointeur est capturé, le `click` va à
   * l'ÉLÉMENT CAPTEUR et non à la cible du survol. L'ancre ne recevait jamais
   * son clic. Et jsdom ne fournissant pas `setPointerCapture`, le garde-fou du
   * composant sautait l'appel : les cas mesuraient un monde sans capture.
   * L'angle mort ÉTAIT l'interface absente.
   *
   * On ne peut pas mesurer ici la conséquence — jsdom n'a pas de capture, donc
   * pas de détournement de clic. On mesure la CAUSE, qui est structurelle : la
   * capture ne doit pas être prise avant que le seuil soit franchi. C'est moins
   * beau qu'un cas comportemental, et c'est ce que l'outil permet.
   */
  it('ne capture pas le pointeur avant d’avoir franchi le seuil', () => {
    renderWithProviders(<RailSonde />)
    const boite = rail()
    const prises: number[] = []
    /* jsdom ne fournit pas la méthode : on la POSE, ce qui la rend observable
       et fait entrer le composant dans la branche qu'il saute d'habitude. */
    Object.assign(boite, {
      setPointerCapture: (id: number) => prises.push(id),
      releasePointerCapture: () => {},
    })

    fireEvent.pointerDown(boite, { clientX: 500, button: 0, pointerId: 7, pointerType: 'mouse' })
    expect(prises, 'la capture est prise dès l’appui : le clic d’un lien sera détourné').toEqual([])

    fireEvent.pointerMove(boite, { clientX: 502, pointerId: 7, pointerType: 'mouse' })
    expect(prises, 'deux pixels ont suffi à capturer : le seuil ne protège rien').toEqual([])

    fireEvent.pointerMove(boite, { clientX: 460, pointerId: 7, pointerType: 'mouse' })
    expect(prises, 'le glissement franc n’a pas pris la capture : il se figera au bord du rail').toEqual([7])
  })

  it('suit le curseur : tirer vers la gauche fait défiler vers la droite', () => {
    renderWithProviders(<RailSonde />)
    const boite = rail()
    boite.scrollLeft = 200

    glisser(boite, { de: 500, vers: 380 })

    /* 120 px vers la GAUCHE amènent le contenu de droite : le rail avance
       d'autant. C'est le sens d'une carte qu'on pousse, pas d'un ascenseur. */
    expect(boite.scrollLeft, 'le rail n’a pas suivi le curseur').toBe(320)
  })

  it('ne touche à rien au doigt : le défilement natif garde le geste', () => {
    renderWithProviders(<RailSonde />)
    const boite = rail()
    boite.scrollLeft = 200

    glisser(boite, { de: 500, vers: 380, pointeur: 'touch' })

    expect(
      boite.scrollLeft,
      'le rail a intercepté un geste du doigt : il double le défilement natif',
    ).toBe(200)
  })

  it('supprime le clic qui suit un glissement franc', () => {
    renderWithProviders(<RailSonde />)
    const boite = rail()
    const lien = screen.getByRole('link', { name: 'A1' })

    fireEvent.pointerDown(lien, { clientX: 500, button: 0, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(boite, { clientX: 420, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(boite, { clientX: 420, pointerId: 1, pointerType: 'mouse' })

    const clic = fireEvent.click(lien)
    expect(clic, 'le clic a survécu au glissement : attraper le rail navigue').toBe(false)
  })

  it('laisse passer un clic qui n’a pas glissé', () => {
    renderWithProviders(<RailSonde />)
    const boite = rail()
    const lien = screen.getByRole('link', { name: 'A1' })

    fireEvent.pointerDown(lien, { clientX: 500, button: 0, pointerId: 1, pointerType: 'mouse' })
    /* Deux pixels : la main qui clique n'est jamais parfaitement immobile. */
    fireEvent.pointerMove(boite, { clientX: 502, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(boite, { clientX: 502, pointerId: 1, pointerType: 'mouse' })

    const clic = fireEvent.click(lien)
    expect(clic, 'un clic immobile a été supprimé : le lien est devenu inerte').toBe(true)
  })
})
