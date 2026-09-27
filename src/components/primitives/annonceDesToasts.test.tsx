import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { renderWithProviders, screen, within } from '@/test/render'
import { useToast, type ToastTone } from './Toast'

/**
 * CE QUE LE TOAST DIT À VOIX HAUTE, ET CE QU'IL DÉTRUISAIT SANS LE DIRE.
 *
 * ═══ DEUX DÉFAUTS, AU MÊME ENDROIT, TROUVÉS DANS LE CODE AVANT D'ÊTRE ÉCRITS ICI ═══
 *
 * 1. L'ÉCHEC ATTENDAIT SON TOUR. Le conteneur visible était la région vivante,
 *    figée `aria-live="polite"` / `aria-atomic="false"` pour les TROIS tons. Un
 *    `tone: 'danger'` — vingt et un appels dans ce produit : un enregistrement
 *    refusé, un paiement non transmis, une invitation qui échoue — passait donc
 *    dans la même file d'attente qu'un « Enregistré », derrière la parole en
 *    cours. Et le nœud qui le portait était DÉTRUIT à 4 650 ms : l'annonce
 *    pouvait mourir avant d'être prononcée. L'utilisateur agissait dans le vide.
 *    Le conteneur surveillait de surcroît un sous-arbre qui monte, glisse et se
 *    démonte, `aria-atomic` faux : chaque mutation était une occasion d'annoncer
 *    un fragment.
 *
 *    CHAQUE TOAST EST DONC SA PROPRE RÉGION. La paire de régions cachées et
 *    permanentes a été écrite d'abord, puis retirée : elle écrivait la phrase
 *    DEUX FOIS dans la page, donc la faisait rencontrer deux fois à qui navigue
 *    au lecteur d'écran — et quarante-huit cas de ce dépôt trouvaient soudain
 *    deux nœuds pour un message. Le motif `alert` d'ARIA ne duplique rien : ce
 *    qui déclenche l'annonce est l'INSERTION du nœud avec son texte.
 *
 * 2. LE TROISIÈME TOAST TUAIT LE PREMIER D'UN BOND. L'écrêtage s'écrivait
 *    `current.slice(-2)` : le plus ancien quittait le tableau dans la même
 *    image — pas de `sortant`, pas de décalage gelé, aucune des 150 ms de sortie
 *    que la moitié de `Toast.tsx` existe pour garantir. Il emportait surtout son
 *    `action` de rattrapage — « Annuler » — que cinq appelants attachent : deux
 *    gestes rapides suivis d'un troisième message effaçaient le bouton qu'on
 *    visait du doigt. Les toasts EN TRAIN DE SORTIR comptaient de surcroît dans
 *    l'écrêtage, si bien qu'un mort de 150 ms pouvait évincer un vivant.
 *
 * ═══ CE QUE CE FICHIER PEUT TENIR ═══
 *
 * Tout, ici, est mécanique et non géométrique : la présence d'un texte dans
 * l'une ou l'autre région, et l'état des nœuds pendant l'éviction. jsdom les
 * voit. Ce qu'il ne voit pas — qu'une région `assertive` interrompe réellement
 * la parole — n'appartient à aucun test automatique.
 */

/** Miroir de `SORTIE_MS` dans `Toast.tsx`. */
const SORTIE_MS = 150

/** Miroir de `PLAFOND` dans `Toast.tsx` : combien de toasts tiennent à l'écran. */
const PLAFOND = 3

const RISE_OUT = ['surface', 'monte', 'sortie'].join('-')

/**
 * Un banc d'essai qui sait poser les trois tons et une action de rattrapage.
 *
 * L'action est celle du produit — « Annuler » — parce que c'est elle que
 * l'écrêtage brutal détruisait, et que ce test la suit jusqu'au bout.
 */
function Notificateur() {
  const { notify } = useToast()
  const poser = (message: string, tone?: ToastTone, avecAction?: boolean) =>
    notify(message, {
      tone,
      action: avecAction ? { label: 'Annuler', onClick: () => {} } : undefined,
    })

  return (
    <>
      <button type="button" onClick={() => poser('Quittance enregistrée', 'ok')}>
        Réussir
      </button>
      <button type="button" onClick={() => poser('L’action a échoué', 'danger')}>
        Échouer
      </button>
      <button type="button" onClick={() => poser('Loyer supprimé', 'neutral', true)}>
        Supprimer
      </button>
      <button type="button" onClick={() => poser('Message de remplissage')}>
        Remplir
      </button>
    </>
  )
}

/* Le fournisseur vient de `renderWithProviders` : en empiler un second donnerait
   deux jeux de régions vivantes, et le premier resterait muet. */
function monter() {
  return renderWithProviders(<Notificateur />)
}

function cliquer(nom: string) {
  fireEvent.click(screen.getByRole('button', { name: nom }))
}

/** Le conteneur visible des toasts. */
function visible() {
  return document.querySelector('[data-toasts]') as HTMLElement
}

/** Le toast qui porte cette phrase. */
function toast(phrase: string) {
  return within(visible()).getByText(phrase).closest('[data-toast]') as HTMLElement
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('l’annonce des toasts', () => {
  it('interrompt pour un échec, et attend son tour pour une réussite', () => {
    monter()

    cliquer('Réussir')
    /* `status` — implicitement `polite` : une confirmation n'a pas à couper la
       parole en cours, et couper pour « Quittance enregistrée » apprendrait à
       ignorer les interruptions. */
    expect(
      toast('Quittance enregistrée').getAttribute('role'),
      'une confirmation interrompt la parole en cours',
    ).toBe('status')

    cliquer('Échouer')
    /* `alert` — implicitement `assertive`. C'est tout l'objet de ce lot : un
       échec qu'on n'entend pas laisse agir dans le vide. */
    expect(
      toast('L’action a échoué').getAttribute('role'),
      'l’échec attend encore son tour derrière un « Enregistré »',
    ).toBe('alert')
  })

  it('fait lire la phrase entière, action comprise', () => {
    monter()
    cliquer('Supprimer')

    /* `aria-atomic` FAUX était le second défaut : la région suivait un sous-arbre
       qui monte, glisse et se démonte, et chaque mutation pouvait faire lire un
       fragment. Vrai, la phrase est dite entière — avec le rattrapage qu'elle
       propose, qui est la seule raison d'écouter ce message-là. */
    expect(
      toast('Loyer supprimé').getAttribute('aria-atomic'),
      'la phrase peut encore être lue par fragments',
    ).toBe('true')
  })

  it('ne fait plus du conteneur une région qui annonce ses propres mutations', () => {
    monter()
    cliquer('Réussir')

    const conteneur = visible()
    expect(conteneur, 'le conteneur visible des toasts').not.toBeNull()
    expect(
      conteneur.getAttribute('aria-live'),
      'le conteneur annonce encore tout ce qui bouge en lui',
    ).toBeNull()
  })

  it('laisse le toast évincé sortir, avec son action jusqu’au bout', () => {
    monter()

    cliquer('Supprimer') // celui-ci porte « Annuler », et c'est lui qu'on évince
    for (let i = 0; i < PLAFOND; i++) cliquer('Remplir')

    const evince = toast('Loyer supprimé')
    expect(evince, 'le plus ancien a quitté l’arbre dans la même image').not.toBeNull()
    expect(evince.className, 'le toast évincé n’a pas sa sortie').toContain(RISE_OUT)
    expect(
      evince.querySelector('button'),
      'le rattrapage « Annuler » a disparu avec le toast',
    ).not.toBeNull()

    act(() => vi.advanceTimersByTime(SORTIE_MS))
    expect(
      within(visible()).queryByText('Loyer supprimé'),
      'le toast évincé ne part jamais',
    ).toBeNull()
  })

  it('n’évince pas un vivant à la place d’un fantôme', () => {
    monter()

    /* LE FANTÔME : un toast dont la sortie est en cours occupe encore un nœud
       pendant 150 ms. `slice` ne l'en distinguait pas et lui comptait une
       place, si bien qu'un vivant partait à la place d'un mort. */
    cliquer('Supprimer')
    const declencheur = toast('Loyer supprimé').querySelector('button[aria-label="Fermer la notification"]') as HTMLElement
    fireEvent.click(declencheur)

    for (let i = 0; i < PLAFOND; i++) cliquer('Réussir')

    /* Les trois vivants sont là — aucun n'a payé la place du sortant. */
    expect(
      within(visible()).getAllByText('Quittance enregistrée').length,
      'un vivant a été évincé par un toast déjà en train de sortir',
    ).toBe(PLAFOND)
  })
})
