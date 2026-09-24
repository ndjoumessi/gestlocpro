import { describe, expect, it } from 'vitest'
import {
  attendreLeChargement,
  renderApp,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
  SESSION_CONNECTEE,
} from '@/test/render'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'

/**
 * LES CINQ PANNEAUX ANCRÉS S'EN VONT, ET ILS S'EN VONT DANS LE BON ORDRE.
 *
 * ═══ CE QUE CETTE GARDE TIENT ═══
 *
 * Trois faits, dans cet ordre, sur le MÊME nœud et à la MÊME fermeture :
 *
 *   1. dès la fermeture, le panneau a quitté l'ARBRE D'ACCESSIBILITÉ — une
 *      requête par rôle ne le trouve plus ;
 *   2. à cet instant précis, il est pourtant encore PEINT — il est dans le
 *      document, en train de finir `animate-pop-out` ;
 *   3. et il finit par partir pour de bon.
 *
 * Aucun des trois ne se suffit. Le premier seul est vrai d'un panneau qui se
 * démonte d'une image — c'est l'état d'avant ce lot, et c'est justement ce qu'on
 * corrige. Le deuxième seul décrirait une surface qui s'attarde en restant
 * lisible, tabulable et cliquable, ce qui est PIRE que pas de sortie du tout :
 * un menu qui s'en va ne doit ni retenir le focus ni avaler un clic. Le
 * troisième seul ne dit rien d'une surface qui ne serait jamais partie.
 *
 * C'est le contrat que `useSortieDifferee` écrit noir sur blanc à l'intention
 * de ses appelants — « PENDANT `sortant`, l'appelant sorte le nœud de l'arbre
 * d'accessibilité » — et qu'aucune garde n'éprouvait sur les menus ancrés.
 *
 * ═══ POURQUOI DEUX LECTURES DU MÊME NŒUD, ET NON UNE ═══
 *
 * `parRole` passe par Testing Library, qui ignore par défaut ce que porte
 * `aria-hidden="true"` : c'est la vue de qui LIT le document. `peint` interroge
 * le DOM brut, qui n'en sait rien : c'est la vue de qui REGARDE l'écran. La
 * sortie différée est exactement l'écart entre ces deux vues, et il n'y a pas
 * d'autre façon de l'observer depuis jsdom, qui ne calcule aucune animation.
 *
 * ═══ LE PANNEAU EST MONTÉ EN PERMANENCE, SEULE SON OUVERTURE BASCULE ═══
 *
 * Aucun des cinq ne prend son ouverture en propriété : elle est interne, et on
 * la bascule donc par le geste qui l'ouvre puis par Échap, comme un
 * utilisateur. Ce qui reste monté d'un bout à l'autre est le COMPOSANT — la
 * coquille, la barre de la vitrine, le déclencheur — de sorte que ce qui entre
 * et sort de l'arbre entre les deux relevés est le panneau, et rien d'autre.
 */

/** Les rôles d'ARIA rendent `HTMLElement | null` ; le DOM brut, `Element | null`. */
interface Panneau {
  /** Ouvre le panneau, par le geste de l'utilisateur. */
  ouvrir: () => Promise<void>
  /** Le referme, par le geste de l'utilisateur. */
  fermer: () => Promise<void>
  /** Ce que voit qui LIT le document : une requête par rôle. */
  parRole: () => HTMLElement | null
  /** Ce que voit qui REGARDE l'écran : le DOM brut, aveugle à `aria-hidden`. */
  peint: () => Element | null
  /**
   * Ce que le panneau doit CONTENIR pendant qu'il est ouvert.
   *
   * Facultatif, et il ne sert qu'aux panneaux dont la négation porte sur un
   * CONTENU plutôt que sur le nœud lui-même — voir le cas de la devise.
   */
  attester?: (panneau: HTMLElement) => void
}

async function eprouverLaSortie({
  ouvrir,
  fermer,
  parRole,
  peint,
  attester,
}: Panneau): Promise<void> {
  await ouvrir()
  /* GARDE DU GARDE. « Il est parti » et « il n'est jamais venu » s'écrivent
     pareil dans un rapport vert : un déclencheur renommé, et les trois
     affirmations ci-dessous porteraient sur du vide. */
  const ouvert = parRole()
  expect(ouvert, 'le panneau ne s’est pas ouvert — rien à mesurer').not.toBeNull()
  attester?.(ouvert!)

  await fermer()

  expect(
    parRole(),
    'le panneau fermé est ENCORE dans l’arbre d’accessibilité : il retient le focus et avale les clics pendant sa sortie',
  ).toBeNull()
  expect(
    peint(),
    'le panneau a disparu d’une image : il se démonte au lieu de SORTIR',
  ).not.toBeNull()

  await waitFor(() =>
    expect(peint(), 'le panneau ne se démonte jamais : il reste peint pour toujours').toBeNull(),
  )
}

describe('la sortie des panneaux ancrés', () => {
  it('le menu de débordement quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MenuDeDebordement libelle="Actions de la ligne">
        <MenuElement onClick={() => {}}>Corriger</MenuElement>
      </MenuDeDebordement>,
    )

    await eprouverLaSortie({
      ouvrir: () => user.click(screen.getByRole('button', { name: 'Actions de la ligne' })),
      fermer: () => user.keyboard('{Escape}'),
      parRole: () => screen.queryByRole('menu', { name: 'Actions de la ligne' }),
      peint: () => document.querySelector('[role="menu"]'),
    })
  })

  it('le sélecteur de devise quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CurrencySwitcher />)

    await eprouverLaSortie({
      ouvrir: () => user.click(screen.getByRole('button', { name: /^Devise/ })),
      fermer: () => user.keyboard('{Escape}'),
      parRole: () => screen.queryByRole('listbox'),
      peint: () => document.querySelector('[role="listbox"]'),
      /*
        SANS CETTE LIGNE, LA NÉGATION D'EN DESSOUS NE PROUVE RIEN.

        Une `listbox` est le seul des cinq panneaux dont le sens est son
        CONTENU : elle naît vide par construction, et un conteneur vide rend
        VRAIE toute négation portant sur ce qu'il contient. Si `CURRENCIES` se
        vidait, la liste s'ouvrirait creuse, disparaîtrait à la fermeture comme
        prévu, et le cas resterait vert en ayant mesuré le néant.

        C'est le défaut exact que `codeParLogementUnique` a laissé passer le
        2026-09-08, et que `check-negations-mesurables.mjs` refuse depuis. Ne
        pas la retirer comme redondante : elle est la CONDITION des deux
        constats qui suivent.
      */
      attester: (liste) =>
        expect(
          within(liste).getAllByRole('option').length,
          'la liste s’est ouverte sans une seule devise',
        ).toBeGreaterThan(0),
    })
  })

  it('le panneau des réglages quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    await renderApp('/demo')
    await attendreLeChargement()

    await eprouverLaSortie({
      ouvrir: () => user.click(screen.getByRole('button', { name: /Réglages/ })),
      fermer: () => user.keyboard('{Escape}'),
      parRole: () => screen.queryByRole('dialog', { name: /Réglages/ }),
      peint: () => document.querySelector('[role="dialog"]'),
    })
  })

  it('le menu du compte quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    await renderApp('/app', { session: SESSION_CONNECTEE })
    await attendreLeChargement()

    await eprouverLaSortie({
      ouvrir: () => user.click(screen.getByRole('button', { name: /Compte de/ })),
      fermer: () => user.keyboard('{Escape}'),
      parRole: () => screen.queryByRole('menu', { name: /Compte de/ }),
      peint: () => document.querySelector('[role="menu"]'),
    })
  })

  /*
    LE PANNEAU DE LA VITRINE SE LIT PAR SON CONTENU, et non par son `data-testid`.

    Il ne porte aucun rôle — c'est une boîte, et lui en donner un la ferait
    annoncer comme une fenêtre. La requête par rôle vise donc le premier groupe
    qu'il contient : `aria-hidden` posé sur le panneau couvre tout ce qui pend
    dessous, donc le groupe disparaît exactement quand le panneau disparaît.
    `menuMobile.test.tsx:106` garantit par ailleurs que ce groupe ne vit nulle
    part ailleurs dans la barre à cette largeur.
  */
  it('le menu de la vitrine quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    await renderApp('/', { largeur: 1280 })

    await eprouverLaSortie({
      ouvrir: () =>
        user.click(screen.getByRole('button', { name: 'Réglages : langue, devise et thème' })),
      fermer: () => user.keyboard('{Escape}'),
      parRole: () => screen.queryByRole('group', { name: 'Langue' }),
      peint: () => document.querySelector('[data-testid="menu-mobile"]'),
    })
  })
})
