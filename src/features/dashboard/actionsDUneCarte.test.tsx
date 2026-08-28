import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'

/**
 * UNE CARTE NE PORTE PAS PLUS DE COMMANDES QU'UN EN-TÊTE DE PAGE.
 *
 * ═══ CE QUE LA RANGÉE D'UNE INTERVENTION ALIGNE ═══
 *
 * Sur sa droite : le montant, la pastille de statut, puis les gestes du moment
 * — jusqu'à TROIS, selon l'état :
 *
 *     déclarée   répondre · chiffrer · marquer terminé
 *     validée    répondre · retirer la validation · marquer terminé
 *     devisée    répondre · valider le devis
 *     terminée   répondre · rouvrir
 *
 * Cinq objets dans une rangée, et le fichier porte déjà la mesure du dégât :
 * « 585 px réclamés, bord droit à 714 dans une fenêtre de 700, scrollX=14 —
 * "Marquer terminé" sortait du champ et TOUTE la page défilait latéralement ».
 * Le repli a été armé depuis, mais il replie : à 700 px la rangée passe sur deux
 * lignes et la carte grandit d'autant, sur cinq interventions.
 *
 * ═══ LA MÊME RÈGLE QU'EN HAUT DE PAGE, UN NIVEAU PLUS BAS ═══
 *
 * L'en-tête a tranché : deux commandes sous les yeux, le reste derrière trois
 * points. Une carte pose exactement la même question — et rien ne justifie
 * qu'elle y réponde autrement, sinon que personne ne l'avait posée.
 *
 * CE QUI RESTE EST CE QUI FAIT AVANCER : chiffrer une intervention déclarée,
 * valider un devis, marquer terminé. Ce qui se replie est ce qui DÉFAIT ou qui
 * ACCOMPAGNE — retirer une validation, rouvrir un chantier clos, écrire au
 * locataire. Aucun geste n'est retiré.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 *   1. aucune carte d'intervention ne montre plus de deux commandes ;
 *   2. « Répondre » reste ATTEIGNABLE — repliée, pas supprimée ;
 *   3. une carte qui n'a qu'un geste n'ouvre AUCUN menu, sans quoi la règle
 *      serait satisfaite par un déclencheur qui ouvre le vide.
 */

const LISTE = /interventions|jobs|travaux/i

/** Les cartes d'intervention de l'écran des travaux. */
function cartes(): HTMLElement[] {
  /* Désignée par son rôle et son intitulé — celui que `Works.tsx` pose
     précisément pour qu'un lecteur d'écran sache combien il y en a. */
  return within(screen.getByRole('list', { name: LISTE }))
    .getAllByRole('listitem')
    .map((li) => li as HTMLElement)
}

/** Les commandes d'une carte — le déclencheur du menu n'en est pas une. */
function commandes(carte: HTMLElement): string[] {
  return within(carte)
    .queryAllByRole('button')
    .filter((el) => el.getAttribute('aria-haspopup') !== 'menu')
    .map((el) => el.textContent?.trim() ?? '')
}

async function ouvrir() {
  await renderApp('/demo/travaux')
  await attendreLeChargement()
}

describe('les commandes d’une carte d’intervention', () => {
  it('n’en montre jamais plus de deux', async () => {
    await ouvrir()
    const trop = cartes()
      .map((c) => commandes(c))
      .filter((noms) => noms.length > 2)
    expect(trop, 'une carte aligne plus de deux commandes').toEqual([])
  })

  it('garde les autres atteignables, sans en perdre une', async () => {
    await ouvrir()
    /*
      « Répondre » est le geste replié qui existe sur le plus d'états — toute
      intervention ouverte PAR UN LOCATAIRE en porte un, quel que soit son
      avancement. C'est donc lui qui dit si le repli a perdu quelque chose.
    */
    const avecMenu = cartes().find((c) => c.querySelector('[aria-haspopup="menu"]'))
    expect(avecMenu, 'aucune carte n’a replié quoi que ce soit').toBeDefined()

    await userEvent.setup().click(avecMenu!.querySelector('[aria-haspopup="menu"]') as HTMLElement)
    expect(within(avecMenu!).getByRole('menu')).toBeInTheDocument()
    expect(within(avecMenu!).getAllByRole('menuitem').length).toBeGreaterThan(0)
  })

  it('n’ouvre aucun menu sur une carte qui n’a rien à replier', async () => {
    await ouvrir()
    /*
      GARDE DU GARDE. Une carte dont les gestes tiennent dans deux ne doit porter
      aucun déclencheur : « un bouton qui n'ouvre rien est le défaut », et la
      règle serait sinon satisfaite par un menu vide sur chaque ligne.
    */
    for (const carte of cartes()) {
      const replie = carte.querySelector('[aria-haspopup="menu"]')
      if (!replie) continue
      await userEvent.setup().click(replie as HTMLElement)
      expect(
        within(carte).queryAllByRole('menuitem').length,
        'un déclencheur qui n’ouvre rien',
      ).toBeGreaterThan(0)
      await userEvent.setup().keyboard('{Escape}')
    }
  })
})
