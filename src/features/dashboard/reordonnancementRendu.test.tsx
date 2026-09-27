import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, renderWithProviders, screen, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { RailDeLogements } from './RailDeLogements'

/**
 * LE GESTE DE RÉORDONNANCEMENT RÉPOND DE LUI-MÊME.
 *
 * ═══ CE QUE LE LOT PRÉCÉDENT AVAIT LIVRÉ, ET LES TROIS TROUS ═══
 *
 * `ficheReordonnable`, `menuDeLaFiche` et `railSaisiALaSouris` tiennent le
 * CALCUL et le PARTAGE des appuis — trente-cinq cas, tous verts. Aucun ne
 * regardait ce que le geste RENVOIE à qui l'exécute, et les trois trous se
 * voient au fait que ces trente-cinq cas passaient à l'identique avant et après
 * les correctifs de ce lot.
 *
 * 1. RIEN NE S'ANNONÇAIT — WCAG 4.1.3. Le geste par le menu ne déplace pas le
 *    focus : il reste sur le déclencheur, qui voyage avec la fiche. Qui ne voit
 *    pas le rail activait « Déplacer à droite » et n'obtenait aucun retour, ni
 *    position ni confirmation.
 *
 * 2. L'AXE REFERMAIT LE PANNEAU QUI LE PORTE. Déplacer de quatre rangs demandait
 *    quatre cycles ouvrir-naviguer-activer. Un réglage répété qui se ferme après
 *    chaque pas.
 *
 * 3. LA MAIN NE PARAISSAIT QUE SI LE RAIL DÉBORDAIT. Le curseur de préhension
 *    était accroché à `flecheVisible` — la condition du PANORAMIQUE. Trois
 *    logements dans une fenêtre large : réordonnables au glissement, et rien
 *    pour le dire.
 *
 * ═══ CE QUE CES CAS NE VOIENT PAS ═══
 *
 * Qu'un lecteur d'écran PRONONCE l'annonce : jsdom ne porte aucune synthèse
 * vocale, et ce qui est tenu ici est la condition mécanique — une région vivante
 * montée AVANT son contenu, hors de la boîte qui la rognerait. Que le curseur
 * change à l'œil : jsdom ne fait aucune mise en page, seule la classe est lue.
 * Et le glissement à la souris, lui, ne s'annonce toujours pas — décision écrite
 * dans `RailDeLogements`, pas oubli.
 */

function RailSonde({ combien }: { combien: number }) {
  return (
    <RailDeLogements libelle="Logements de l’immeuble témoin">
      {['A1', 'A2', 'A3'].slice(0, combien).map((nom) => (
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

async function ouvrirLeMenuDeA1() {
  const user = userEvent.setup()
  installerFauxServeur()
  await renderApp('/demo/parc')
  await attendreLeChargement()
  await user.click(screen.getByRole('button', { name: 'Actions du logement A1' }))
  return {
    user,
    menu: await screen.findByRole('menu', { name: 'Actions du logement A1' }),
  }
}

/**
 * La région vivante du rail, cherchée par son attribut et non par un rôle.
 *
 * `aria-live="polite"` sur un `<p>` ne porte AUCUN rôle implicite : `getByRole`
 * ne la trouverait pas, et un cas qui la cherche ainsi rougirait pour une
 * mauvaise raison.
 */
function regionsVivantes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[aria-live="polite"]'))
}

describe('le réordonnancement d’une fiche rend compte de lui-même', () => {
  it('annonce le rang atteint, et la région est montée avant de parler', async () => {
    const { user, menu } = await ouvrirLeMenuDeA1()

    /*
      ON COMPTE LES RÉGIONS, ON NE CHERCHE PLUS UNE RÉGION VIDE — ET C'EST LA
      MUTATION QUI A EXIGÉ LA DIFFÉRENCE.

      Premier jet : « une région vivante VIDE existe avant le geste ». L'écran du
      parc en porte D'AUTRES — le sélecteur de point de vue annonce « Lecture et
      édition globale · arbitrage… », le relevé de la mutation le montre — et
      n'importe laquelle d'entre elles, vide à cet instant, satisfaisait
      l'assertion à la place de celle du rail. La garde mesurait la page, pas le
      correctif.

      L'ÉGALITÉ DES COMPTES dit exactement la propriété visée : si la région
      n'était montée QU'AVEC son message, il y en aurait une de plus après le
      geste. Une région montée en même temps que son contenu n'annonce rien — ce
      dépôt l'écrit à trois endroits, et c'est la faute qui rendrait ce cas creux.
    */
    const avant = regionsVivantes().length

    await user.click(within(menu).getByRole('menuitem', { name: /droite/ }))

    expect(
      regionsVivantes().length,
      'une région vivante est APPARUE avec le geste : montée en même temps que son contenu, elle n’annoncera rien',
    ).toBe(avant)

    const dit = regionsVivantes()
      .map((r) => r.textContent?.trim() ?? '')
      .join(' | ')
    /*
      UN MOTIF ENTIER, ET NON `/A1/` PUIS `/2/`. Les deux assertions séparées se
      contentaient de n'importe quel « 2 » de la page — « 2026 » du sélecteur de
      mois y suffisait. Le rang doit être lu DANS la phrase qui nomme la fiche.
    */
    expect(
      dit,
      `ni la fiche ni son rang ne sont annoncés — ce qui est dit : « ${dit} ». « Déplacé » ne renseigne sur rien : le rang est la seule chose qu’on ne peut pas voir`,
    ).toMatch(/A1\s*—\s*position\s*2\s*sur\s*\d+/)
  })

  it('garde l’annonce hors de la boîte de défilement', () => {
    renderWithProviders(<RailSonde combien={3} />)

    const dedans = rail().querySelectorAll('[aria-live]')
    expect(
      dedans.length,
      'la région vivante est DANS le `<ul>` : un `sr-only` posé là s’échappe et étend le défilement du document — 185 px mesurés sur une mention de logement vacant',
    ).toBe(0)
    expect(
      regionsVivantes().length,
      'aucune région vivante autour du rail non plus : elle a disparu au lieu de sortir',
    ).toBeGreaterThan(0)
  })

  it('ne referme pas le panneau quand on pousse l’axe', async () => {
    const { user, menu } = await ouvrirLeMenuDeA1()

    await user.click(within(menu).getByRole('menuitem', { name: /droite/ }))

    expect(
      screen.queryByRole('menu', { name: 'Actions du logement A1' }),
      'l’axe a refermé son propre panneau : déplacer de quatre rangs redemande quatre ouvertures',
    ).toBeInTheDocument()
  })

  it('montre la main dès qu’il y a deux fiches, même sans débordement', () => {
    /* jsdom NE FAIT AUCUNE MISE EN PAGE, donc `scrollWidth === clientWidth === 0`
       et le rail ne déborde JAMAIS ici. C'est exactement le cas que le défaut
       laissait passer : l'affordance était accrochée au débordement. */
    const { unmount } = renderWithProviders(<RailSonde combien={2} />)
    expect(
      rail().className,
      'deux fiches réordonnables et aucun curseur de préhension : le geste existe et rien ne le dit',
    ).toMatch(/cursor-grab/)
    unmount()

    renderWithProviders(<RailSonde combien={1} />)
    expect(
      rail().className,
      'une seule fiche et la main paraît quand même : elle promet un geste sans effet',
    ).not.toMatch(/cursor-grab/)
  })
})
