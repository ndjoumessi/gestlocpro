import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { renderWithProviders, screen } from '@/test/render'
import { useToast } from './Toast'

/**
 * LE TOAST SORT, ET IL CESSE D'OCCUPER LE FLUX À L'INSTANT OÙ IL CESSE D'ÊTRE VU.
 *
 * Deux choses à garder, et la seconde est la seule qui vaille le détour :
 *
 *  1. le nœud reste PEINT le temps de sa sortie, puis disparaît — la moitié
 *     facile, celle que `sortieDeModale.test.tsx` tient déjà pour la modale ;
 *  2. pendant cette sortie, le toast n'occupe PLUS de place dans la colonne.
 *     Sans ce second point, une sortie différée EMPIRE ce qu'elle prétend
 *     adoucir : aujourd'hui le toast disparaît et ceux qui restent se replacent
 *     dans la même image — un seul saut. Un fondu de 150 ms suivi du même saut
 *     en fait deux, et la pause attire l'œil pile sur le saut.
 *
 * ═══ CE QUE JSDOM NE PEUT PAS DIRE, ET OÙ LA PREUVE A ÉTÉ PRISE ═══
 *
 * « N'occupe plus le flux » est une affirmation GÉOMÉTRIQUE, et jsdom ne calcule
 * aucune mise en page : toute boîte y mesure zéro. Ce fichier ne peut donc tenir
 * que le MÉCANISME — la classe `absolute` et le `justify-end` sans lequel elle
 * est fausse. La géométrie, elle, a été mesurée dans Chrome sur une
 * reproduction du conteneur (375 × 812 puis 1280 × 800, trois toasts de 46 px,
 * gap de 8) :
 *
 *   — DERNIER EN FLUX sorti du flux : boîte inchangée au pixel (haut 666,
 *     gauche 920, largeur 336 avant comme après), et les deux autres se
 *     replacent AUSSITÔT. C'est le cas voulu.
 *   — AVANT-DERNIER : téléporté de 54 px vers le bas. PREMIER de trois : 108 px.
 *     La position statique d'un enfant absolu d'une boîte flexible se calcule
 *     « comme s'il était le seul élément », donc au bord du conteneur — et ce
 *     conteneur, ancré par le BAS et haut de son contenu, rétrécit au moment
 *     même où l'enfant le quitte.
 *
 * ═══ CE QUI A CHANGÉ LE 2026-09-25 : LA PILE EST MESURÉE ═══
 *
 * Ce fichier fixait donc une règle BOITEUSE — quitter le flux si et seulement si
 * l'on était le dernier —, et son unique justification était qu'aucune règle
 * statique ne sait dire « la place que j'occupais ». C'est vrai, et c'est pourquoi
 * il n'y a plus de règle statique : les hauteurs sont LUES, et chaque toast est
 * posé à un décalage calculé. Tous quittent la pile à l'instant du renvoi, quel
 * que soit leur rang, et les 54 px de saut n'existent plus — ils étaient la
 * différence entre une place devinée et une place mesurée.
 *
 * jsdom ne calcule aucune disposition : `offsetHeight` y vaut zéro partout, donc
 * tous les décalages vaudraient zéro et les cas seraient vrais à vide. On POSE
 * donc une hauteur, la vraie — 46 px relevés dans Chrome, plus les 8 de l'écart,
 * d'où les 54 de l'en-tête. Le mécanisme est alors intégralement vérifiable ici ;
 * ce que jsdom ne dira jamais, c'est que 46 est encore la bonne hauteur.
 *
 * ═══ LES MINUTERIES SONT FAUSSES ET NUES ═══
 *
 * Même précaution que `sortieDeModale.test.tsx` : les gestes partent d'un
 * `fireEvent` SYNCHRONE, rien n'attend, et un temps qui avancerait tout seul
 * rendrait le premier constat dépendant de la vitesse de la machine — les 150 ms
 * de la sortie peuvent s'écouler pendant un `await` sur une machine chargée.
 */

/** Miroir de `SORTIE_MS` dans `Toast.tsx`, lui-même miroir de `--duration-fast`. */
const SORTIE_MS = 150

/** Miroir de `DURATION` dans `Toast.tsx`. */
const EFFACEMENT_MS = 4500

/*
  ASSEMBLÉES, JAMAIS ÉCRITES D'UN TENANT — même précaution qu'à
  `etatsAccessibles.test.tsx:16`. Tailwind v4 balaie les fichiers de test et
  fabrique le CSS de tout motif qu'il y reconnaît ; une classe citée en clair
  entrerait dans la feuille livrée au seul titre d'avoir servi d'assertion.
*/
const RISE_OUT = ['animate', 'rise', 'out'].join('-')

/** Miroir de `ECART` dans `Toast.tsx`. */
const ECART = 8

/** La hauteur qu'on POSE sous jsdom : celle d'un toast d'une ligne, dans Chrome. */
const HAUTEUR = 46

/** Un cran de pile : une hauteur de toast plus l'écart. Les 54 px de l'en-tête. */
const CRAN = HAUTEUR + ECART

const HAUTEUR_ORIGINALE = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')

/**
 * Le décalage qu'un toast occupe, lu sur la coquille qui le place.
 *
 * Sur la COQUILLE et non sur le toast : le partage des deux nœuds est justement
 * ce qui permet à l'entrée et au replacement de porter tous deux sur `transform`
 * sans s'écraser. Lire le mauvais des deux rendrait la transformation de
 * `gl-rise`, qui ne dit rien de la pile.
 */
function coquille(toast: HTMLElement) {
  return toast.closest('[data-toast-place]') as HTMLElement
}

function decalage(toast: HTMLElement) {
  const place = coquille(toast)
  const trouve = /translate3d\(\s*0[a-z%]*\s*,\s*(-?[\d.]+)px/.exec(place.style.transform)
  if (!trouve) throw new Error(`aucun décalage lisible dans « ${place.style.transform} »`)
  // `0 - x` et non `-x` : le second rend `-0` pour un décalage nul, que
  // `toBe(0)` refuse — `Object.is(-0, 0)` est faux.
  return 0 - Number(trouve[1])
}

/*
  UN MESSAGE DIFFÉRENT À CHAQUE APPEL, et ce n'est pas de la coquetterie : le cas
  de l'avant-dernier toast en monte DEUX, et `getByText` échoue sur deux nœuds
  portant la même phrase. Le compteur vit dans une ref pour ne pas rendre à
  nouveau — le rendu du fournisseur suffit.
*/
function Notificateur() {
  const { notify } = useToast()
  const n = useRef(0)
  return (
    <button type="button" onClick={() => notify(`Quittance ${++n.current} enregistrée`)}>
      Notifier
    </button>
  )
}

let rang = 0

function notifier() {
  const declencheur = screen.getByRole('button', { name: 'Notifier' })
  fireEvent.click(declencheur)
  return screen.getByText(`Quittance ${++rang} enregistrée`).closest('[data-toast]') as HTMLElement
}

/** La croix du toast, retenue AVANT le renvoi : après, `aria-hidden` la cache. */
function croix(toast: HTMLElement) {
  return toast.querySelector('button[aria-label="Fermer la notification"]') as HTMLElement
}

beforeEach(() => {
  rang = 0
  vi.useFakeTimers()
  // Seules les coquilles de placement répondent : c'est ce que le fournisseur
  // mesure, et poser une hauteur sur TOUT élément fausserait d'autres gardes.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-toast-place') ? HAUTEUR : 0
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  if (HAUTEUR_ORIGINALE) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', HAUTEUR_ORIGINALE)
  }
})

describe('sortie du toast', () => {
  it('reste peinte et sortante après le renvoi, puis se démonte', () => {
    renderWithProviders(<Notificateur />)
    const toast = notifier()

    fireEvent.click(croix(toast))

    // POUR L'ŒIL : encore là, et en train de sortir.
    expect(toast).toBeInTheDocument()
    expect(toast.className).toContain(RISE_OUT)

    // POUR QUI LIT LE DOCUMENT ET POUR LE POINTEUR : déjà parti.
    expect(toast).toHaveAttribute('aria-hidden', 'true')
    expect(toast.className).toContain(['pointer', 'events', 'none'].join('-'))

    act(() => {
      vi.advanceTimersByTime(SORTIE_MS + 1)
    })

    expect(toast).not.toBeInTheDocument()
  })

  it('ne démonte rien avant le terme de la minuterie', () => {
    renderWithProviders(<Notificateur />)
    const toast = notifier()

    fireEvent.click(croix(toast))

    /* UNE MILLISECONDE AVANT LE TERME, et non « un peu avant » : une sortie
       raccourcie en douce ne se verrait pas autrement. */
    act(() => {
      vi.advanceTimersByTime(SORTIE_MS - 1)
    })

    expect(toast).toBeInTheDocument()
  })

  it('empile ses toasts sur des hauteurs mesurées', () => {
    renderWithProviders(<Notificateur />)
    const premier = notifier()
    const deuxieme = notifier()
    const troisieme = notifier()

    // Ancrée EN BAS : le plus récent est au ras du bord, ses aînés au-dessus.
    expect(decalage(troisieme), 'le plus récent est au ras du bord').toBe(0)
    expect(decalage(deuxieme), 'un cran au-dessus').toBe(CRAN)
    expect(decalage(premier), 'deux crans au-dessus').toBe(2 * CRAN)
  })

  it('libère sa place à l’instant du renvoi, même au milieu de la pile', () => {
    renderWithProviders(<Notificateur />)
    const premier = notifier()
    const deuxieme = notifier()
    const troisieme = notifier()

    /*
      CELUI DU MILIEU, ET C'EST TOUT L'OBJET DE LA RÉÉCRITURE. Avant elle, un
      toast qui n'était pas le dernier ne pouvait pas quitter la colonne : il
      s'effaçait sur place et son voisin du dessus attendait la fin du fondu pour
      descendre. Le mécanisme ne connaît plus de rang.
    */
    fireEvent.click(croix(deuxieme))

    expect(deuxieme.className, 'il sort').toContain(RISE_OUT)
    expect(decalage(deuxieme), 'et il sort SUR PLACE, au décalage gelé').toBe(CRAN)
    expect(decalage(premier), 'son aîné descend d’un cran AUSSITÔT').toBe(CRAN)
    expect(decalage(troisieme), 'son cadet ne bouge pas').toBe(0)
  })

  it('ne redescend pas avec la pile une fois qu’il est parti', () => {
    renderWithProviders(<Notificateur />)
    const premier = notifier()
    const deuxieme = notifier()
    const troisieme = notifier()

    fireEvent.click(croix(premier))
    fireEvent.click(croix(deuxieme))

    /*
      LE GEL EST CE QUI TIENT ICI. Sans lui, le décalage du premier se
      recalculerait au départ du deuxième et le ferait GLISSER vers le bas au
      milieu de son propre fondu — un toast qui s'en va ne doit plus bouger.
    */
    expect(decalage(premier), 'le premier reste où on l’a vu').toBe(2 * CRAN)
    expect(decalage(deuxieme), 'le deuxième aussi').toBe(CRAN)
    expect(decalage(troisieme), 'et le seul survivant garde le bord').toBe(0)
  })

  it('accorde le glissement des voisins à ce qui l’a provoqué', () => {
    renderWithProviders(<Notificateur />)
    const premier = notifier()

    /*
      LES VOISINS NE BOUGENT JAMAIS POUR EUX-MÊMES. Leur glissement appartient à
      l'arrivée ou au départ qui l'a causé, et en prend la durée — sans quoi un
      seul geste se lirait en deux temps, le partant ayant fini de s'effacer quand
      ses voisins finissent de descendre, ou l'inverse.

      Constat écrit après une MUTATION : supprimer la durée en ligne laissait les
      six autres cas au vert. Le tempo n'était tenu par rien.
    */
    const deuxieme = notifier()
    expect(coquille(premier).style.transitionDuration, 'une arrivée dure comme `animate-rise`').toBe(
      '300ms',
    )

    fireEvent.click(croix(deuxieme))
    expect(
      coquille(premier).style.transitionDuration,
      'un départ dure comme `animate-rise-out`',
    ).toBe('150ms')
  })

  it('garde l’effacement automatique sur le renvoi réel, pas sur la peinture', () => {
    renderWithProviders(<Notificateur />)
    const toast = notifier()

    /* 4 499 ms : la sortie ne se paie PAS sur le temps de lecture. Rogner les
       150 ms de la sortie sur les 4 500 du message — l'erreur naturelle — ferait
       basculer le toast ici. */
    act(() => {
      vi.advanceTimersByTime(EFFACEMENT_MS - 1)
    })
    expect(toast.className).not.toContain(RISE_OUT)

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(toast.className).toContain(RISE_OUT)
    expect(toast).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(SORTIE_MS)
    })
    expect(toast).not.toBeInTheDocument()
  })
})
