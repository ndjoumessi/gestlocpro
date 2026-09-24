import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { renderWithProviders, screen } from '@/test/render'
import { Modal } from './Modal'

/**
 * LA MODALE SORT, ET CE FICHIER EST LE SEUL À LE VOIR.
 *
 * Mesuré le 2026-09-24, avant d'écrire une ligne d'ici : retirer complètement la
 * sortie différée du `Modal` — `if (!open) return null` à la place de
 * `if (!monte) return null` — laissait TOUT vert. Les dix-sept fichiers de
 * `src/components/primitives/`, les gardes de `src/features/dashboard/`, la
 * vérification de types : rien ne bougeait. La sortie pouvait donc disparaître
 * d'un coup d'éditeur sans que personne ne l'apprenne.
 *
 * LA RAISON DE CET ANGLE MORT EST UNE HABITUDE DU HARNAIS, et elle vaut d'être
 * nommée : tous les cas existants montent la modale sous une condition —
 * `{ouverte && <Modal open …>}` dans `modalFocus.test.tsx:42`,
 * `{confirmation && <Modal open …>}` dans `modalesImbriquees.test.tsx:36` — ou
 * lui passent `open` EN DUR sans jamais la fermer (`echapDansUneModale.test.tsx`,
 * ses trois modales). Fermer en démontant le composant emporte le crochet avec
 * lui : `useSortieDifferee` n'est jamais atteint, la minuterie n'est jamais
 * armée, et la sortie n'a tout simplement pas lieu. Le seul geste qui l'éprouve
 * est de faire BASCULER `open` sur une modale qui, elle, reste montée. C'est ce
 * que fait ce fichier, et c'est la seule chose qu'il fait.
 *
 * LES MINUTERIES SONT FAUSSES ET NUES — `useFakeTimers()` sans
 * `shouldAdvanceTime`, contrairement à `etatsAccessibles.test.tsx`. Ce dernier a
 * besoin que le temps réel coule parce qu'il pilote `userEvent`, dont les
 * attentes internes gèleraient. Ici la fermeture part d'un `fireEvent`
 * SYNCHRONE : rien n'attend, donc rien n'a besoin d'avancer tout seul — et
 * surtout, un temps qui avance tout seul rendrait le premier constat
 * dépendant de la vitesse de la machine. Les 150 ms de la sortie peuvent
 * s'écouler pendant un `await` sur une machine chargée : le panneau serait alors
 * déjà démonté quand le cas vient l'examiner, et la garde rougirait sans qu'il y
 * ait de défaut. Le temps est ici un GESTE du test, jamais une course.
 */

/** Miroir de `SORTIE_MS` dans `Modal.tsx`, lui-même miroir de `--duration-fast`. */
const SORTIE_MS = 150

/*
  ASSEMBLÉE, JAMAIS ÉCRITE D'UN TENANT — même précaution qu'à
  `etatsAccessibles.test.tsx:16`. Tailwind v4 balaie les fichiers de test et
  fabrique le CSS de tout motif qu'il y reconnaît ; une classe citée en clair
  entrerait dans la feuille livrée au seul titre d'avoir servi d'assertion.
*/
const POP_OUT = ['animate', 'pop', 'out'].join('-')

/**
 * `open` BASCULE, la modale RESTE MONTÉE.
 *
 * Le bouton est posé hors de la modale à dessein : il ne s'agit pas d'éprouver
 * un geste de fermeture — Échap, la croix et le voile ont déjà leurs cas — mais
 * le seul passage de `true` à `false` sur un composant qui ne se démonte pas.
 */
function ModaleQuiSeFerme() {
  const [ouverte, setOuverte] = useState(true)
  return (
    <>
      <button type="button" data-fermer="" onClick={() => setOuverte(false)}>
        fermer
      </button>
      <Modal open={ouverte} onClose={() => setOuverte(false)} title="Nouveau bail">
        <p>Loyer 145 000 FCFA</p>
      </Modal>
    </>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sortie de la modale', () => {
  it('reste peinte et sortante après la fermeture, puis se démonte', () => {
    renderWithProviders(<ModaleQuiSeFerme />)

    /* Retenu AVANT la fermeture, et c'est nécessaire : une fois `sortant`, le
       conteneur du portail porte `aria-hidden`, donc plus aucune requête par
       rôle ne rendrait ce nœud. C'est précisément ce que le second constat
       ci-dessous affirme. */
    const panneau = screen.getByRole('dialog', { name: 'Nouveau bail' })

    fireEvent.click(document.querySelector('[data-fermer]') as HTMLElement)

    // POUR L'ŒIL : encore là, et en train de sortir.
    expect(panneau).toBeInTheDocument()
    expect(panneau.className).toContain(POP_OUT)

    // POUR QUI LIT LE DOCUMENT : déjà partie. Les deux constats tiennent en même
    // temps, et c'est tout l'intérêt de la manœuvre — voir le docbloc de
    // `useSortieDifferee`.
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(SORTIE_MS + 1)
    })

    expect(panneau).not.toBeInTheDocument()
  })

  it('ne démonte rien avant le terme de la minuterie', () => {
    renderWithProviders(<ModaleQuiSeFerme />)
    const panneau = screen.getByRole('dialog', { name: 'Nouveau bail' })

    fireEvent.click(document.querySelector('[data-fermer]') as HTMLElement)

    /* UNE MILLISECONDE AVANT LE TERME, et non « un peu avant ». Une sortie
       raccourcie en douce — 150 ramenés à 100 pour faire taire une garde — ne se
       verrait pas autrement : le cas précédent passerait toujours, puisqu'il
       avance au-delà des deux valeurs. */
    act(() => {
      vi.advanceTimersByTime(SORTIE_MS - 1)
    })

    expect(panneau).toBeInTheDocument()
  })
})
