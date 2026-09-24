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
 * D'où la règle que ce fichier fixe : le toast quitte le flux SI ET SEULEMENT SI
 * il était le dernier en flux. Sinon il se contente de s'effacer sur place, ce
 * qui est moins bien et reste de loin préférable à un saut de 54 px.
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
const HORS_FLUX = ['abso', 'lute'].join('')
const VERS_LE_BAS = ['justify', 'end'].join('-')

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
})

afterEach(() => {
  vi.useRealTimers()
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

  it('cesse d’occuper le flux pendant qu’il sort', () => {
    const { container } = renderWithProviders(<Notificateur />)
    const toast = notifier()

    fireEvent.click(croix(toast))

    // Le nœud quitte le flux À L'INSTANT du renvoi, pas à la fin du fondu : la
    // colonne se replace une fois, PENDANT le mouvement, et non après.
    expect(toast.className).toContain(HORS_FLUX)

    /* ET LE CONTENEUR POUSSE SES ENFANTS VERS LE BAS. Les deux vont ensemble ou
       ne valent rien : la position statique d'un enfant absolu suit
       `justify-content`. En `flex-start` — le défaut — le toast sortant se
       reposerait en HAUT de la colonne, soit 54 px plus bas que sa place quand
       il y en a deux, 108 avec trois (mesuré dans Chrome, cf. l'en-tête). */
    const pile = container.parentElement!.querySelector('[aria-live="polite"]')!
    expect(pile.className).toContain(VERS_LE_BAS)
  })

  it('laisse en flux un toast qui n’est pas le dernier', () => {
    renderWithProviders(<Notificateur />)
    const premier = notifier()
    notifier()

    fireEvent.click(croix(premier))

    // Il sort — pour l'œil, c'est la même sortie.
    expect(premier.className).toContain(RISE_OUT)
    /* Mais il GARDE sa place : hors flux, sa position statique serait celle du
       dernier de la colonne, 54 px plus bas. Un saut vaut moins qu'une pause. */
    expect(premier.className).not.toContain(HORS_FLUX)
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
