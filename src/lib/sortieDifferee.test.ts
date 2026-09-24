import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { createElement, useEffect, useRef } from 'react'
import { useSortieDifferee } from './useSortieDifferee'

/**
 * Sortie différée des surfaces flottantes.
 *
 * Ces cas montent le crochet SEUL, par `renderHook`, et non par `renderApp` ni
 * `renderWithProviders` : il ne lit aucun contexte — ni langue, ni thème, ni
 * session — et l'envelopper de six fournisseurs ne prouverait que la patience
 * du harnais. Le crochet n'est encore branché à aucun composant ; c'est le
 * mécanisme lui-même qui est éprouvé ici.
 *
 * LES MINUTERIES SONT FAUSSES, et c'est la raison d'être de ce fichier. Une
 * sortie vraie de 200 ms attendue par `waitFor` serait une course : elle tient
 * sur une machine au repos et rougit sur une machine chargée. Avec
 * `vi.useFakeTimers()`, l'écoulement du temps devient un GESTE du test —
 * `advanceTimersByTime` — donc un fait, et le cas de la réouverture peut
 * affirmer qu'une minuterie annulée ne sonnera JAMAIS, ce qu'aucune attente
 * réelle ne saurait prouver.
 */

/** Miroir de `--duration-base` (`src/design-system/tokens.css:652`). */
const DUREE = 200

/**
 * Monte le crochet ET TIENT LE JOURNAL DE CE QU'IL A RENDU.
 *
 * `result.current` ne donne que le DERNIER état ; il ne dit rien de ceux qui
 * ont défilé entre deux assertions. Or la réouverture se garde précisément sur
 * un état TRANSITOIRE — voir le cas concerné, où l'état final est identique que
 * la minuterie ait été annulée ou non.
 */
function monterLeCrochet(ouvert: boolean) {
  const journal: { monte: boolean; sortant: boolean }[] = []
  const rendu = renderHook(
    ({ ouvert }) => {
      const etat = useSortieDifferee(ouvert, DUREE)
      journal.push(etat)
      return etat
    },
    { initialProps: { ouvert } },
  )
  return { ...rendu, journal }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  // `setup.ts` dégrafe déjà les globales après chaque cas ; on le redit ici pour
  // que le cas du mouvement réduit ne dépende pas d'un fichier qu'il ne nomme
  // pas — c'est lui, et lui seul, qui remplace `matchMedia`.
  vi.unstubAllGlobals()
})

describe('sortie différée', () => {
  it('monte aussitôt à l’ouverture, sans état de sortie', () => {
    const { result } = monterLeCrochet(true)

    expect(result.current).toEqual({ monte: true, sortant: false })
  })

  it('reste monté et se déclare sortant pendant toute la durée, puis se démonte', () => {
    const { result, rerender } = monterLeCrochet(true)

    rerender({ ouvert: false })
    expect(result.current).toEqual({ monte: true, sortant: true })

    // Une milliseconde avant le terme : la surface est encore là. Sans cette
    // borne, un démontage immédiat passerait le cas suivant sans être vu.
    act(() => {
      vi.advanceTimersByTime(DUREE - 1)
    })
    expect(result.current).toEqual({ monte: true, sortant: true })

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toEqual({ monte: false, sortant: false })
  })

  it('rouvrir pendant la sortie annule la minuterie et ne laisse aucun nœud fantôme', () => {
    const { result, rerender, journal } = monterLeCrochet(true)

    rerender({ ouvert: false })
    act(() => {
      vi.advanceTimersByTime(DUREE / 2)
    })
    expect(result.current).toEqual({ monte: true, sortant: true })

    rerender({ ouvert: true })
    expect(result.current).toEqual({ monte: true, sortant: false })

    // On laisse passer l'instant où la PREMIÈRE minuterie aurait sonné, et bien
    // au-delà.
    act(() => {
      vi.advanceTimersByTime(DUREE * 5)
    })
    expect(result.current).toEqual({ monte: true, sortant: false })

    /*
      LE CŒUR DU CAS, ET L'ÉTAT FINAL NE SUFFIT PAS À LE GARDER.

      MESURÉ PAR MUTATION, à l'écriture de ce fichier : en retirant les DEUX
      annulations du crochet — le `clearTimeout` de la branche ouverte et le
      nettoyage d'effet — les trois assertions ci-dessus restent VERTES. La
      minuterie orpheline sonne bien, `setMonte(false)` passe bien, mais
      l'effet se relance aussitôt sur `monte` et, voyant `ouvert` vrai,
      remonte la surface. L'état final se répare tout seul.

      Ce que la réparation laisse derrière elle est exactement le nœud fantôme
      que ce crochet promet d'éviter : une image où la surface a disparu, donc
      un démontage et un remontage réels — focus perdu, animation d'entrée
      rejouée, état interne du panneau effacé. C'est invisible dans
      `result.current` et parfaitement visible à l'œil.

      D'où le journal : on affirme que `monte` n'est JAMAIS retombé à faux
      depuis le montage. Sans annulation, ce cas rougit.
    */
    expect(journal.filter((etat) => !etat.monte)).toEqual([])
  })

  it('a déjà rendu le nœud quand l’effet de l’appelant vient le chercher', () => {
    /*
      CE CAS MONTE UN COMPOSANT, ET C'EST DÉLIBÉRÉ : `result.current` NE PEUT PAS
      GARDER CE QU'IL GARDE.

      La panne qu'il reproduit est réelle et datée — 2026-09-24, trois cas
      existants rouges d'un coup à l'exécution du lot 002 : `drawer.test.tsx`
      « prend le focus à l'ouverture », « rend le focus au bouton d'ouverture à
      la fermeture », `barreBasse.test.tsx` « ouvre le tiroir par « Plus » ».
      Quand `monte` ne passait à vrai que DANS l'effet, la surface n'était pas
      encore rendue à l'image où `ouvert` devenait vrai : `ref.current` valait
      `null` pour l'appelant, et son effet ne se rejouait pas puisque `ouvert`,
      lui, n'avait plus changé. Le focus n'était jamais posé.

      Un cas qui interrogerait `result.current` après coup resterait VERT dans
      les deux conceptions — l'état final est le même, seule l'image où il est
      atteint diffère. Il faut donc un appelant : un nœud porteur d'une `ref`, et
      un effet accroché à la SEULE propriété `ouvert`, exactement comme l'effet
      de focus du tiroir est accroché à `drawerOpen`. Ce que l'on relève n'est
      pas un état, c'est ce que l'appelant avait sous la main au moment où il a
      tendu la sienne.

      MESURÉ PAR MUTATION : en replaçant le montage dans l'effet, ce cas — et lui
      seul de ce fichier — rougit.
    */
    const releves: (HTMLElement | null)[] = []

    function Surface({ ouvert }: { ouvert: boolean }) {
      const { monte } = useSortieDifferee(ouvert, DUREE)
      const noeud = useRef<HTMLDivElement>(null)

      useEffect(() => {
        if (!ouvert) return
        releves.push(noeud.current)
      }, [ouvert])

      return monte ? createElement('div', { ref: noeud }) : null
    }

    const { rerender } = render(createElement(Surface, { ouvert: false }))
    // Rien n'est relevé tant que rien ne s'ouvre : le relevé qui suit ne peut
    // donc venir que de l'ouverture.
    expect(releves).toEqual([])

    rerender(createElement(Surface, { ouvert: true }))

    expect(releves).toHaveLength(1)
    expect(releves[0]).not.toBeNull()
  })

  it('démonte immédiatement sous mouvement réduit, sans jamais passer par la sortie', () => {
    /*
      La fausse `matchMedia` est HONNÊTE : elle ne répond `true` qu'à la requête
      du mouvement réduit, et `false` à tout le reste, comme le fait jsdom. Une
      fausse qui dirait oui à tout ferait passer ce cas pour de mauvaises
      raisons, et masquerait un crochet qui interrogerait la mauvaise requête.
    */
    vi.stubGlobal(
      'matchMedia',
      (requete: string) =>
        ({
          matches: requete === '(prefers-reduced-motion: reduce)',
          media: requete,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )

    const { result, rerender } = monterLeCrochet(true)

    rerender({ ouvert: false })
    expect(result.current).toEqual({ monte: false, sortant: false })

    // Et rien ne sonne ensuite : aucune minuterie n'a été posée du tout.
    act(() => {
      vi.advanceTimersByTime(DUREE * 5)
    })
    expect(result.current).toEqual({ monte: false, sortant: false })
  })
})
