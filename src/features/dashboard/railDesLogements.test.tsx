import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LES LOGEMENTS D'UN IMMEUBLE DÉFILENT EN RANG.
 *
 * ═══ CE QUE LA GRILLE COÛTAIT ═══
 *
 * `auto-fill` rangeait les fiches en autant de rangées qu'il fallait : cinq
 * logements en donnaient deux, dont la seconde à moitié vide, et un immeuble de
 * douze en donnait quatre. La carte d'immeuble grandissait avec son parc, et
 * l'écran devenait une colonne sans fin. Mesuré après le rail : `/demo/parc`
 * passe de 2 212 à 1 785 px à 1 280 — quatre cent vingt-sept pixels, sans qu'une
 * seule fiche perde une ligne.
 *
 * ═══ CE QUE CES CAS TIENNENT, ET QUI S'EST DÉJÀ CASSÉ ═══
 *
 * Trois choses, et les trois ont été trouvées ROUGES avant d'être écrites ici.
 *
 * 1. LES FICHES RESTENT ALIGNÉES. Elles partagent cinq rangées par `subgrid`,
 *    ce qui exige un PARENT en grille : un rail en `flex` aurait rendu la même
 *    ligne et détruit l'alignement que « 145 000 FCFA en face de 110 000 FCFA »
 *    demande.
 * 2. LE RAIL NE DÉBORDE PAS LA PAGE. Il est une boîte de défilement, donc il
 *    doit être son propre BLOC CONTENEUR : sans `relative`, la mention
 *    « rien à payer » d'un logement vacant — invisible, `position: absolute`,
 *    185 px de large — s'en échappait et tirait le document à 1 432 px pour une
 *    fenêtre de 1 280.
 * 3. LE MENU D'UNE FICHE S'ÉCHAPPE DU RAIL. Une boîte de défilement rogne les
 *    DEUX axes ; le menu d'une fiche, renversé vers le haut, n'en montrait plus
 *    qu'une bande.
 *
 * Ce fichier tient (1) et (3), que jsdom sait voir. (2) est une affaire de
 * géométrie : `mesure-ui` la mesure au navigateur, et c'est elle qui l'a
 * trouvée.
 */
describe('le rail des logements', () => {
  it('rend toutes les fiches d’un immeuble dans une seule liste', async () => {
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const rail = within(screen.getByRole('main')).getByRole('list', {
      name: /Résidence Bonamoussadi/i,
    })
    const fiches = within(rail).getAllByRole('listitem')

    /* CINQ LOGEMENTS, ET AUCUN PERDU. Un rail qui n'en montre que trois à
       l'écran doit quand même les RENDRE tous : la tabulation les atteint, la
       recherche du navigateur aussi, et c'est ce qui distingue un défilement
       d'une pagination. */
    expect(fiches.length, 'le rail ne porte plus toutes les fiches').toBe(5)
  })

  it('garde le contrat d’alignement des fiches', async () => {
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const rail = within(screen.getByRole('main')).getByRole('list', {
      name: /Résidence Bonamoussadi/i,
    })

    /* LE PARENT EST UNE GRILLE, et chaque fiche reprend ses rangées. Ce n'est
       pas un détail de style : `subgrid` ne fonctionne QUE si le parent déclare
       ses rangées, et un rail écrit en `flex` aurait tout rendu sans rien
       aligner — l'écart de 25 px que le relevé d'origine a mesuré. */
    expect(rail.className, 'le rail n’est plus une grille').toMatch(/grid/)
    expect(rail.className, 'les rangées partagées ne sont plus déclarées').toMatch(/grid-rows-/)
    for (const fiche of within(rail).getAllByRole('listitem')) {
      expect(fiche.className, 'une fiche ne reprend plus les rangées du rail').toMatch(
        /grid-rows-subgrid/,
      )
    }
  })

  it('sort le menu d’une fiche de la boîte qui le rognerait', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const rail = within(screen.getByRole('main')).getByRole('list', {
      name: /Résidence Bonamoussadi/i,
    })
    const declencheur = within(rail).getAllByRole('button', { name: /A1/ })[0]
    await user.click(declencheur)

    const menu = await screen.findByRole('menu')

    /* `position: fixed` — le seul ancrage qui échappe au rognage d'un ancêtre à
       défilement sans quitter l'arbre, donc sans rien demander au piège de
       focus ni à la fermeture au clic extérieur. */
    expect(menu.style.position, 'le menu retomberait dans la boîte qui le rogne').toBe('fixed')
    expect(
      within(menu).getAllByRole('menuitem').length,
      'le menu a perdu ses entrées',
    ).toBeGreaterThan(1)
  })
})
