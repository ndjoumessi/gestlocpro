import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, within } from '@/test/render'
import { EcranSysteme } from './EcranSysteme'
import { FrontiereDErreur } from './FrontiereDErreur'
import { Button } from '@/components/primitives/Button'

const MESSAGE = 'un sous-arbre a lâché'

/** Le seul moyen d'atteindre le repli : un enfant qui lève au rendu. */
function QuiLeve(): never {
  throw new Error(MESSAGE)
}

/**
 * LES ÉCRANS QUE LA PORTE NE VISITE JAMAIS.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══
 *
 * `scripts/mesure-ui.mjs` balaie 23 adresses sur 11 largeurs et 2 langues. Aucune
 * de ces adresses ne plante, ne perd sa session, ni ne trouve le serveur muet :
 * les quatre écrans système ne sont donc RENDUS PAR RIEN. Ce qui s'y glisse y
 * reste. Mesuré en atteignant le repli au navigateur — par une exception injectée
 * dans la route 404, puis retirée — deux défauts y vivaient :
 *
 *   le dépliant « Détail technique » faisait 22 px de haut, la moitié du
 *   plancher de 44 que la porte impose sur 506 points ;
 *
 *   `document.activeElement` valait `body` : la page entière était remplacée,
 *   l'élément focalisé démonté, et la seule région vivante du document — le
 *   conteneur de toasts — était vide.
 *
 * ═══ CE QUE CES CAS TIENNENT, ET CE QU'ILS NE PEUVENT PAS TENIR ═══
 *
 * Ils rendent le composant, ce qu'aucune porte ne fait : le contrat de STRUCTURE
 * est donc gardé — un `<h1>` et non un `<h2>`, le focus qui part dessus, le
 * dépliant qui reste atteignable. C'est le contrat qu'une refonte casse sans
 * s'en apercevoir.
 *
 * Ils ne tiennent AUCUNE géométrie : jsdom ne calcule pas de boîte, « 44 px »
 * n'y veut rien dire. Le plancher de la cible est ici une CLASSE, vérifiée comme
 * telle, et c'est un substitut — la mesure vraie demande un navigateur, et aucun
 * balayage ne mène ici. C'est dit plutôt que sous-entendu.
 */

/* La classe proscrite est assemblée, jamais écrite : Tailwind scanne les tests,
   et citer le nom en clair suffirait à faire émettre la règle. */
const PLANCHER = ['min-h', '11'].join('-')

function rendre(children?: React.ReactNode) {
  return renderWithProviders(
    <EcranSysteme
      ton="danger"
      titre="Cet écran s’est interrompu"
      corps="Une erreur a arrêté l’affichage."
      actions={<Button onClick={() => {}}>Réessayer</Button>}
    >
      {children}
    </EcranSysteme>,
  )
}

describe('un écran système', () => {
  it('porte le titre principal de la page, et pas un sous-titre', () => {
    rendre()
    /* Quand cet écran paraît, celui qu'il remplace est parti avec son `<h1>`.
       Le laisser en `<h2>` retirerait son titre principal au document. */
    const titre = screen.getByRole('heading', { level: 1 })
    expect(titre).toHaveTextContent('Cet écran s’est interrompu')
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  })

  it('prend le focus sur son titre, qui n’est pas un arrêt de tabulation', () => {
    rendre()
    const titre = screen.getByRole('heading', { level: 1 })

    /* LE CŒUR DU CAS. Sans lui, le focus tombe sur `body` — mesuré — et rien
       n'est annoncé : la page a changé entièrement, en silence. */
    expect(titre).toHaveFocus()
    /* `-1` et non `0` : un titre doit pouvoir RECEVOIR le focus par programme
       sans devenir une étape de la tabulation. */
    expect(titre).toHaveAttribute('tabindex', '-1')
  })

  /**
   * LE DÉPLIANT DU VRAI REPLI, ET NON D'UN GABARIT DE TEST.
   *
   * La première rédaction de ce cas passait le `<summary>` en enfant depuis le
   * test lui-même, puis vérifiait la classe qu'elle venait d'écrire : elle se
   * relisait. On monte donc la FRONTIÈRE avec un enfant qui lève, ce qui rend
   * l'écran de repli réel — le seul moyen d'atteindre ce dépliant, ici comme au
   * navigateur.
   */
  it('garde le dépliant du repli atteignable au doigt', () => {
    /* React écrit la pile sur `console.error` en attrapant : c'est voulu — voir
       « ELLE N'AVALE PAS » dans `FrontiereDErreur`. On la fait taire pour ce cas
       seul, sans toucher au comportement. */
    const bruit = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderWithProviders(
        <FrontiereDErreur>
          <QuiLeve />
        </FrontiereDErreur>,
      )

      const resume = screen.getByText(/détail technique/i)
      expect(resume.tagName.toLowerCase()).toBe('summary')
      expect(
        resume.className.split(/\s+/),
        'le dépliant a reperdu son plancher de cible',
      ).toContain(PLANCHER)

      /* Et le message de l'exception est LÀ, recopiable : une frontière qui
         avale change un défaut visible en défaut invisible. */
      expect(screen.getByText(MESSAGE)).toBeInTheDocument()
    } finally {
      bruit.mockRestore()
    }
  })

  /**
   * LE CAS DANS LA COQUILLE.
   *
   * `CadreDuParc` rend le même écran SANS prendre la fenêtre : la coquille va
   * bien, seules les données manquent, et lui retirer la navigation priverait
   * l'utilisateur des commandes qui lui permettent de s'en sortir — changer de
   * parc, se déconnecter, aller ailleurs. Le distinguer est donc un contrat, pas
   * une option de style.
   */
  it('ne prend pas la fenêtre quand la coquille reste montée', () => {
    const { container } = renderWithProviders(
      <EcranSysteme
        dansLaCoquille
        ton="warn"
        titre="Parc indisponible"
        corps="Réessayez."
        actions={<Button onClick={() => {}}>Réessayer</Button>}
      />,
    )
    const racine = container.firstElementChild!
    expect(racine.tagName.toLowerCase(), 'la version en coquille doit rester une section').toBe(
      'section',
    )
    expect(within(racine as HTMLElement).getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
