import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * L'ÉCRAN DU PARC OFFRE LES DEUX CORRECTIONS QU'IL N'AVAIT PAS.
 *
 * ═══ CE QUE L'ÉCRAN SAVAIT FAIRE, ET CE QU'IL NE SAVAIT PAS ═══
 *
 * Ajouter un immeuble, ajouter un logement, supprimer un immeuble VIDE, régler
 * le parc. Aucune correction. La conséquence n'était écrite nulle part et se
 * mesurait en production : dès qu'un immeuble portait un logement, la seule
 * issue — la suppression — se refermait, et « Residance » restait « Residance ».
 * Le logement, lui, n'avait strictement rien : ni correction ni suppression.
 *
 * ═══ POURQUOI CES CAS ET PAS D'AUTRES ═══
 *
 * Ils tiennent ce que le SERVEUR ne peut pas tenir : qu'un geste soit OFFERT.
 * `parcCorrigeable.test.ts`, côté serveur, garde les routes — il ne sait pas si
 * un bouton y mène. C'est la leçon de `ficheRetirable`, où une règle juste
 * (« pas de geste sans de quoi l'exécuter ») masquait un bouton qui
 * n'apparaissait JAMAIS hors d'un vrai parc, et où toute une colonne échappait
 * au balayage de `mesure-ui` sans qu'aucune garde ne rougisse.
 *
 * ═══ LA CORRECTION D'IMMEUBLE EST OFFERTE SUR UN IMMEUBLE PLEIN ═══
 *
 * C'est le cas qui compte, et c'est exactement là que la suppression se
 * refuse. Une correction qui ne s'offrirait que sur un immeuble vide
 * n'ajouterait rien à ce qui existait.
 */
/**
 * Ouvre le menu de gestes d'une ligne, et rend son entrée « Corriger ».
 *
 * Les deux gestes de ligne se sont repliés derrière trois points : à plat, ils
 * allumaient vingt-six commandes en permanence sur cet écran. Le déclencheur
 * porte le NUMÉRO du logement — « Actions du logement A1 » — parce qu'il se
 * répète par ligne, et l'entrée le porte aussi : douze « Corriger » identiques
 * ne diraient pas lequel on active.
 */
/**
 * Ouvre le menu de gestes d'un immeuble, sur son en-tête de groupe.
 *
 * Les deux issues de l'immeuble se sont repliées derrière trois points, comme
 * celles de ses lignes : deux idiomes d'action dans la même bande verticale ne
 * disaient rien de plus qu'un écran fini en deux fois. Le déclencheur porte le
 * NOM de l'immeuble — il se répète par groupe.
 */
async function ouvrirLeMenuDeLImmeuble(nom: string) {
  await userEvent.setup().click(screen.getByRole('button', { name: `Actions de l’immeuble ${nom}` }))
}

async function ouvrirLeMenu(unite: string) {
  await userEvent.setup().click(
    screen.getByRole('button', { name: `Actions du logement ${unite}` }),
  )
  return screen.getByRole('menuitem', { name: new RegExp(`Corriger le logement ${unite}`) })
}

describe('l’écran du parc', () => {
  it('offre la correction d’un immeuble PLEIN — là où la suppression se refuse', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    /* « Résidence Bonamoussadi » porte cinq logements dans le jeu de
       démonstration : la correction y est ouverte, la suppression FERMÉE — et
       fermée se dit désormais à l'écran, au lieu de s'écrire par une absence.
       Voir `gestures`, qui tient le motif et le refus de clic. */
    await ouvrirLeMenuDeLImmeuble('Résidence Bonamoussadi')
    expect(
      screen.getByRole('menuitem', { name: /Corriger l’immeuble Résidence Bonamoussadi/ }),
    ).toBeInTheDocument()
    const suppression = screen.getByRole('menuitem', {
      name: /Suppression impossible — Résidence Bonamoussadi porte 5 logements/,
    })
    expect(
      suppression,
      'la suppression doit se montrer FERMÉE sur un immeuble qui porte des logements',
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('offre la correction de CHAQUE logement', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const ligne = screen.getAllByRole('row').find((r) => /Charles Ngassa/.test(r.textContent ?? ''))
    expect(ligne, 'la ligne de A1 est introuvable').toBeDefined()
    /* LE DÉCLENCHEUR EST SUR LA LIGNE, l'entrée dans le panneau qu'il ouvre —
       lequel vit hors du `<tr>`. On vérifie donc les deux à leur place. */
    expect(
      within(ligne!).getByRole('button', { name: 'Actions du logement A1' }),
      'la démonstration ne rend pas la colonne de geste du parc',
    ).toBeInTheDocument()
    expect(await ouvrirLeMenu('A1')).toBeInTheDocument()
  })

  /**
   * ET LE GESTE VA JUSQU'AU BOUT.
   *
   * Sans parc serveur, `updateUnit` écrit en mémoire — c'est le chemin de la
   * démonstration. Le parcourir en entier est la seule façon de savoir que le
   * bouton mène quelque part, et pas seulement qu'il existe.
   */
  it('renomme le logement jusqu’au tableau', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(await ouvrirLeMenu('A1'))
    const modale = await screen.findByRole('dialog')
    const numero = within(modale).getByLabelText(/Numéro|Logement/)
    await utilisateur.clear(numero)
    await utilisateur.type(numero, 'A9')
    await utilisateur.click(within(modale).getByRole('button', { name: /Enregistrer/ }))

    expect(
      await ouvrirLeMenu('A9'),
    ).toBeInTheDocument()
  })

  /**
   * LA NOTE DU LOYER NE PARAÎT QUE SUR UN LOGEMENT OCCUPÉ.
   *
   * Le serveur ne fait PAS redescendre le loyer de référence dans le bail ni
   * dans les échéances appelées. Sur un logement occupé, corriger le loyer sans
   * rien dire donnerait une ligne qui change et une échéance qui ne bouge pas.
   * Sur un logement VACANT, la phrase parlerait d'un bail qui n'existe pas —
   * c'est la règle des notes conditionnelles, et les deux sens sont tenus ici.
   */
  it('explique le loyer de référence sur un logement OCCUPÉ, et se tait sur un VACANT', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(await ouvrirLeMenu('A1'))
    const occupe = await screen.findByRole('dialog')
    expect(within(occupe).getByText(/ne changent pas/)).toBeInTheDocument()
    await utilisateur.keyboard('{Escape}')

    /* B4 est vacant dans le jeu de démonstration. */
    await utilisateur.click(await ouvrirLeMenu('B4'))
    const vacant = await screen.findByRole('dialog')
    expect(within(vacant).queryByText(/ne changent pas/)).toBeNull()
  })
})
