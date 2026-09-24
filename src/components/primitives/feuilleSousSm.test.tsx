import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { renderWithProviders, screen } from '@/test/render'
import { Modal } from './Modal'

/**
 * SOUS `sm`, LA MODALE EST UNE FEUILLE — ET ELLE DOIT S'ANIMER COMME TELLE.
 *
 * La mise en page le disait déjà : `items-end` sous `sm`, `rounded-t-lg` sans
 * `rounded-b`, la zone sûre du bas portée par le pied. Le MOUVEMENT, lui,
 * disait l'inverse — `animate-pop`, un `scale(0.96) → 1` centré, qui n'a pas de
 * bord d'où venir. Une surface collée au bas de l'écran monte de ce bord et y
 * retombe ; c'est le même geste que le tiroir, d'où le même tempo (300/200).
 *
 * ═══ CE QUE CE CAS PEUT ET NE PEUT PAS AFFIRMER ═══
 *
 * jsdom n'évalue AUCUNE requête média de la FEUILLE DE STYLE, et ne résout pas
 * davantage les `@utility` de Tailwind. Demander ici « laquelle des deux
 * variantes GAGNE » serait donc demander à jsdom une réponse qu'il n'a pas, et
 * un cas qui prétendrait la lire mesurerait le harnais, pas le produit.
 *
 * La NUANCE, mesurée en écrivant ce fichier : `matchMedia`, elle, répond — pas
 * par jsdom, qui ne la fournit pas du tout ici (`typeof matchMedia` vaut
 * `undefined`), mais par le harnais, qui la remplace par une fonction répondant
 * à la LARGEUR déclarée (`src/test/render.tsx:333`). Ce que le produit lit en JS
 * est donc mesurable ; ce que la cascade tranche ne l'est pas. Le dernier cas
 * d'ici exploite le premier, les trois premiers s'en tiennent au second.
 *
 * Ce que le composant décide, en revanche, est entièrement dans sa portée : il
 * pose sur le nœud les DEUX variantes, `max-sm:` et `sm:`, et c'est la cascade
 * qui tranche à l'exécution. Le cas affirme donc leur PRÉSENCE, aux deux temps
 * du geste — entrée et sortie — et sur les deux nœuds qui voyagent ensemble, le
 * panneau et son voile. Retirer la variante `max-sm:` du panneau, ou remettre
 * le voile du tiroir à l'écart de son panneau, fait rougir ici.
 *
 * ASSEMBLÉES, JAMAIS ÉCRITES D'UN TENANT — même précaution qu'à
 * `sortieDeModale.test.tsx:44`. Tailwind v4 balaie les fichiers de test et
 * fabrique le CSS de tout motif qu'il y reconnaît ; une classe citée en clair
 * entrerait dans la feuille livrée au seul titre d'avoir servi d'assertion.
 */
const SOUS = ['max', 'sm:animate'].join('-')
const DES = 'sm:animate-'

const FEUILLE = [SOUS, 'feuille'].join('-')
const FEUILLE_OUT = [SOUS, 'feuille', 'out'].join('-')
const POP = `${DES}pop`
const POP_OUT = `${DES}pop-out`

const VOILE_TIROIR_IN = [SOUS, 'voile', 'drawer', 'in'].join('-')
const VOILE_TIROIR_OUT = [SOUS, 'voile', 'drawer', 'out'].join('-')
const VOILE_POP_IN = `${DES}voile-pop-in`
const VOILE_POP_OUT = `${DES}voile-pop-out`

/**
 * Les JETONS de la classe, pas la chaîne.
 *
 * `toContain` sur la chaîne entière serait une fausse garde : `animate-feuille`
 * est un préfixe de `animate-feuille-out`, donc une sortie posée à la place
 * d'une entrée passerait sans bruit. L'égalité sur les jetons ferme ce trou.
 */
function jetons(noeud: Element): string[] {
  return noeud.className.split(/\s+/).filter(Boolean)
}

/** Les deux durées de sortie, miroirs de `SORTIE_POP_MS` / `SORTIE_FEUILLE_MS`. */
const SORTIE_POP_MS = 150
const SORTIE_FEUILLE_MS = 200

/** Une largeur de téléphone, sous les 640 px de `sm`. Même idiome que `fichesDuTableau`. */
const TELEPHONE = 375

/** `open` bascule, la modale reste MONTÉE : sans cela la sortie n'a pas lieu. */
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

describe('la modale est une feuille sous `sm`', () => {
  it('porte les deux variantes d’entrée, feuille en deçà et pop au-delà', () => {
    renderWithProviders(<ModaleQuiSeFerme />)
    const panneau = screen.getByRole('dialog', { name: 'Nouveau bail' })

    expect(jetons(panneau)).toContain(FEUILLE)
    expect(jetons(panneau)).toContain(POP)
  })

  it('porte les deux variantes de sortie après la fermeture', () => {
    renderWithProviders(<ModaleQuiSeFerme />)
    /* Retenu AVANT la fermeture : une fois `sortant`, le conteneur du portail
       porte `aria-hidden` et aucune requête par rôle ne rendrait ce nœud. */
    const panneau = screen.getByRole('dialog', { name: 'Nouveau bail' })

    fireEvent.click(document.querySelector('[data-fermer]') as HTMLElement)

    expect(jetons(panneau)).toContain(FEUILLE_OUT)
    expect(jetons(panneau)).toContain(POP_OUT)
  })

  /**
   * LE VOILE SUIT LE PANNEAU AUX DEUX TAILLES, et c'est un défaut déjà payé
   * une fois dans ce dépôt : `animate-voile-in`, écrit pour le tiroir, avait été
   * adopté par la modale, dont le fond continuait de noircir 100 ms après que le
   * panneau se soit posé (`tokens.css`, docbloc des voiles). Une feuille au
   * tempo du tiroir et un voile au tempo de `pop` rejoueraient exactement ce
   * désaccord, à l'envers.
   */
  it('accorde le voile au panneau, tiroir en deçà et pop au-delà', () => {
    renderWithProviders(<ModaleQuiSeFerme />)
    const voile = document.querySelector('[role="dialog"]')?.previousElementSibling
    expect(voile).not.toBeNull()

    expect(jetons(voile as Element)).toContain(VOILE_TIROIR_IN)
    expect(jetons(voile as Element)).toContain(VOILE_POP_IN)

    fireEvent.click(document.querySelector('[data-fermer]') as HTMLElement)

    expect(jetons(voile as Element)).toContain(VOILE_TIROIR_OUT)
    expect(jetons(voile as Element)).toContain(VOILE_POP_OUT)
  })

  /**
   * ═══ ET LA DURÉE DU DÉMONTAGE SUIT LE MÊME SEUIL ═══
   *
   * `useSortieDifferee` prend un NOMBRE, pas une requête média : c'est le seul
   * endroit où `Modal` lit le point de rupture en JS. Si cette lecture manquait,
   * le nœud serait coupé à 150 ms sous `sm` alors que la feuille met 200 ms à
   * redescendre — les cinquante dernières millisecondes du geste se joueraient
   * sur un nœud déjà retiré du document.
   *
   * CE CAS EST MESURABLE, et pas pour la raison qu'on croirait. `renderWithProviders`
   * remplace `matchMedia` par une fonction qui RÉPOND PAR LA LARGEUR
   * (`src/test/render.tsx:333`), largeur qu'un cas déclare par `largeur`. Le
   * défaut du harnais est 1280 px : tous les cas existants — dont
   * `sortieDeModale.test.tsx` et ses 150 ms — se tiennent donc du côté LARGE du
   * seuil, sans l'avoir écrit. La branche de la feuille n'existait pour personne
   * avant ce fichier.
   */
  it('retient la feuille 200 ms sous `sm`, et la fenêtre 150 ms au-delà', () => {
    renderWithProviders(<ModaleQuiSeFerme />, { largeur: TELEPHONE })
    const feuille = screen.getByRole('dialog', { name: 'Nouveau bail' })

    fireEvent.click(document.querySelector('[data-fermer]') as HTMLElement)

    /* À l'image où la fenêtre centrée serait déjà partie, la feuille descend
       encore. C'est exactement le décalage que la lecture JS du seuil paie. */
    act(() => {
      vi.advanceTimersByTime(SORTIE_POP_MS + 1)
    })
    expect(feuille).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(SORTIE_FEUILLE_MS - SORTIE_POP_MS)
    })
    expect(feuille).not.toBeInTheDocument()
  })
})
