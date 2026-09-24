import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/render'
import { DatePicker, MonthPicker } from './DatePicker'

/**
 * LES DEUX PANNEAUX DE DATE S'EN VONT, ET ILS S'EN VONT DANS LE BON ORDRE.
 *
 * ═══ CE QUE CETTE GARDE TIENT ═══
 *
 * C'est la forme de `sortieDesPanneauxAncres.test.tsx`, transposée aux deux
 * panneaux que le lot 005 avait dû écarter : trois faits, dans cet ordre, sur le
 * MÊME nœud et à la MÊME fermeture.
 *
 *   1. dès la fermeture, le panneau a quitté l'ARBRE D'ACCESSIBILITÉ — une
 *      requête par rôle ne le trouve plus ;
 *   2. à cet instant précis, il est pourtant encore PEINT — il est dans le
 *      document, en train de finir `animate-pop-out` ;
 *   3. et il finit par partir pour de bon.
 *
 * Aucun des trois ne se suffit. Le premier seul est vrai d'un panneau qui se
 * démonte d'une image — c'est l'état d'avant ce lot. Le deuxième seul décrirait
 * une surface qui s'attarde en restant lisible, tabulable et CLIQUABLE, ce qui
 * est pire que pas de sortie du tout. Le troisième seul ne dit rien d'une
 * surface qui ne serait jamais partie.
 *
 * ═══ ET UN QUATRIÈME FAIT, PROPRE À CES DEUX PANNEAUX ═══
 *
 * Ce qui FERME reste accroché à `ouvert`, jamais à l'état monté : à l'instant où
 * le panneau s'en va, le focus est DÉJÀ revenu au déclencheur et celui-ci
 * annonce `aria-expanded="false"`. Un panneau en sortie qui retiendrait le focus
 * laisserait la tabulation dans une surface que personne ne voit plus — c'est
 * exactement ce qui a coûté un cycle rouge au lot 002, et ça ne se lit ni dans
 * le premier constat ni dans le deuxième.
 *
 * ═══ POURQUOI DEUX LECTURES DU MÊME NŒUD, ET NON UNE ═══
 *
 * La requête par rôle passe par Testing Library, qui ignore par défaut ce que
 * porte `aria-hidden="true"` : c'est la vue de qui LIT le document. Le
 * `querySelector` interroge le DOM brut, qui n'en sait rien : c'est la vue de
 * qui REGARDE l'écran. La sortie différée est exactement l'écart entre ces deux
 * vues, et il n'y a pas d'autre façon de l'observer depuis jsdom, qui ne calcule
 * aucune animation.
 *
 * ═══ LE CHAMP EST MONTÉ EN PERMANENCE, SEULE SON OUVERTURE BASCULE ═══
 *
 * Ni `DatePicker` ni `MonthPicker` ne prend son ouverture en propriété : elle est
 * interne, et on la bascule donc par le geste qui l'ouvre puis par Échap, comme
 * un utilisateur. Ce qui reste monté d'un bout à l'autre est le CHAMP — de sorte
 * que ce qui entre et sort de l'arbre entre les deux relevés est le panneau, et
 * rien d'autre.
 */

function Champ({ initiale = '2023-04-10' }: { initiale?: string }) {
  const [valeur, setValeur] = useState(initiale)
  return <DatePicker aria-label="Début du bail" name="d" value={valeur} onChange={setValeur} />
}

function ChampMois({ initiale = '2023-04' }: { initiale?: string }) {
  const [valeur, setValeur] = useState(initiale)
  return <MonthPicker aria-label="Période couverte" name="p" value={valeur} onChange={setValeur} />
}

interface Panneau {
  /** Ouvre le panneau, par le geste de l'utilisateur. */
  ouvrir: () => Promise<void>
  /** Le referme, par le geste de l'utilisateur. */
  fermer: () => Promise<void>
  /** Ce que voit qui LIT le document : une requête par rôle. */
  parRole: () => HTMLElement | null
  /** Ce que voit qui REGARDE l'écran : le DOM brut, aveugle à `aria-hidden`. */
  peint: () => Element | null
  /** Le déclencheur, qui doit ravoir le focus AVANT que le panneau soit parti. */
  declencheur: () => HTMLElement
  /** Ce que le panneau doit CONTENIR pendant qu'il est ouvert. */
  attester: (panneau: HTMLElement) => void
}

async function eprouverLaSortie({
  ouvrir,
  fermer,
  parRole,
  peint,
  declencheur,
  attester,
}: Panneau): Promise<void> {
  await ouvrir()
  /* GARDE DU GARDE. « Il est parti » et « il n'est jamais venu » s'écrivent
     pareil dans un rapport vert : un libellé retraduit, et les constats
     ci-dessous porteraient sur du vide. */
  const ouvert = parRole()
  expect(ouvert, 'le panneau ne s’est pas ouvert — rien à mesurer').not.toBeNull()
  attester(ouvert!)

  await fermer()

  expect(
    parRole(),
    'le panneau fermé est ENCORE dans l’arbre d’accessibilité : il retient le focus et avale les clics pendant sa sortie',
  ).toBeNull()
  expect(
    peint(),
    'le panneau a disparu d’une image : il se démonte au lieu de SORTIR',
  ).not.toBeNull()

  /* LA FERMETURE EST ACCROCHÉE À `ouvert`, PAS À L'ÉTAT MONTÉ. Les deux
     constats se lisent PENDANT la sortie, le panneau encore peint : c'est le
     seul instant où l'erreur du lot 002 serait visible. */
  expect(
    declencheur(),
    'le focus n’est pas revenu au déclencheur : le panneau en sortie le retient encore',
  ).toHaveFocus()
  expect(
    declencheur(),
    'le déclencheur annonce encore un panneau ouvert alors qu’il s’en va',
  ).toHaveAttribute('aria-expanded', 'false')

  await waitFor(() =>
    expect(peint(), 'le panneau ne se démonte jamais : il reste peint pour toujours').toBeNull(),
  )
}

describe('la sortie des deux panneaux de date', () => {
  it('le calendrier quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Champ />)
    const champ = () => screen.getByRole('button', { name: /début du bail/i })

    await eprouverLaSortie({
      ouvrir: () => user.click(champ()),
      fermer: () => user.keyboard('{Escape}'),
      parRole: () => screen.queryByRole('dialog', { name: /calendrier/i }),
      peint: () => document.querySelector('[role="dialog"][aria-label="Calendrier"]'),
      declencheur: champ,
      /* Un panneau vide rendrait VRAIE toute négation portant sur son contenu :
         la grille du mois est ce qui fait de lui un calendrier, et elle doit
         être là pour que les constats suivants aient un objet. */
      attester: (panneau) =>
        expect(
          within(panneau).getAllByRole('gridcell').length,
          'le calendrier s’est ouvert sans une seule cellule de jour',
        ).toBeGreaterThan(0),
    })
  })

  it('le sélecteur de mois quitte l’arbre d’accessibilité avant de se démonter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChampMois />)
    const champ = () => screen.getByRole('button', { name: /période couverte/i })

    await eprouverLaSortie({
      ouvrir: () => user.click(champ()),
      fermer: () => user.keyboard('{Escape}'),
      parRole: () => screen.queryByRole('dialog', { name: /choix du mois/i }),
      peint: () => document.querySelector('[role="dialog"][aria-label="Choix du mois"]'),
      declencheur: champ,
      /* Même raison : douze cases, sans quoi le panneau mesuré serait creux. */
      attester: (panneau) =>
        expect(
          within(panneau)
            .getAllByRole('button')
            .filter((b) => b.getAttribute('aria-pressed') !== null).length,
          'le sélecteur s’est ouvert sans une seule case de mois',
        ).toBe(12),
    })
  })
})
