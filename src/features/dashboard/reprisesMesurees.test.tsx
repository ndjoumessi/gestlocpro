import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * DEUX DÉFAUTS QUE MES PROPRES LOTS D'AUJOURD'HUI ONT LAISSÉS.
 *
 * Nelson a remontré les six écrans après les avoir reçus, et les remesurer à
 * 1660 px — la largeur de ses captures — a rendu deux choses que 1440 px
 * cachait. Ce sont deux défauts de PRÉSENTATION, indépendants, sur deux écrans
 * distincts, et ils tombent dans deux scripts distincts : ils se gardent donc
 * côte à côte sans se masquer.
 *
 * ═══ 1. LE FOND PLEIN DANS UNE RANGÉE (cautions) ═══
 *
 * `Works.tsx` porte la règle depuis le 2026-08-30, mesurée : « ce bouton était
 * le seul du produit à porter la variante PRIMAIRE à l'intérieur d'une liste »,
 * et il en est sorti. Le registre des cautions en portait DEUX — un « Arbitrer »
 * par caution en arbitrage — et mon lot du matin les a déplacés dans une
 * colonne ÉPINGLÉE au bord droit, ce qui les rend plus sonores, pas moins.
 *
 * Le compte grandit avec la donnée : la démonstration a deux cautions à
 * arbitrer, un parc réel en a autant que de baux qui se terminent.
 *
 * ET L'ARGUMENT DE RÉVERSIBILITÉ VAUT ICI AUSSI : arbitrer ouvre une modale de
 * confirmation, et le message qui suit offre de défaire. Le bleu ne garde donc
 * rien qu'une pastille ambre « En cours d'arbitrage » ne dise déjà.
 *
 * ═══ 2. LES CENT ONZE PIXELS DE BLANC (accès) ═══
 *
 * Mesuré à 1660 px : dans la fiche d'Arsène, 111 px séparent son adresse de la
 * ligne « Membre depuis », contre 12 px dans celle de Diane. La cause est
 * `mt-auto` : la grille étire les fiches d'une rangée à la hauteur de la plus
 * haute — celle de Diane, qui porte une phrase de périmètre de trois lignes —
 * et le vide se creuse dans les autres.
 *
 * L'alignement que cela achetait ne vaut rien ICI : ces fiches n'ont pas la
 * même STRUCTURE — seul un gestionnaire porte un périmètre —, donc il n'y a
 * aucune colonne de faits à aligner d'une fiche à l'autre. C'est ce qui les
 * distingue des fiches de locataire, où quatre faits occupent les mêmes cases.
 * Une fiche au tiers vide se lit comme une fiche à qui il manque quelque chose.
 */

describe('les reprises mesurées du 2026-09-07', () => {
  it('n’allume aucun fond plein dans le registre des cautions', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const main = screen.getByRole('main')

    /* On compte les GESTES DE RANGÉE, ceux qui vivent dans une cellule : le
       bouton de page — « Exporter », « Enregistrer un paiement » — a le droit
       au fond plein, c'est lui l'action de l'écran. La règle porte sur ce qui
       se répète une fois par ligne. */
    const dansUneRangee = within(main)
      .getAllByRole('button')
      .filter((b) => b.closest('td') !== null)
    expect(dansUneRangee.length, 'la démonstration porte des gestes de rangée').toBeGreaterThan(0)

    for (const bouton of dansUneRangee) {
      expect(
        bouton.className,
        `« ${bouton.textContent?.trim()} » porte la variante primaire dans une rangée`,
      ).not.toMatch(/\bbg-(brand|accent|ink)\b/)
    }
  })

  it('ne creuse pas de vide dans les fiches d’accès', async () => {
    await renderApp('/demo/acces')
    await attendreLeChargement()

    const fiches = Array.from(document.querySelectorAll('[data-fiche-membre]'))
    expect(fiches.length, 'la démonstration porte des membres').toBeGreaterThan(1)

    /* `mt-auto` est ce qui creuse : il pousse la date au bas d'une fiche
       étirée. On garde son ABSENCE plutôt qu'une hauteur en pixels, que jsdom
       ne calcule pas — et qui dépendrait du jeu de démonstration. */
    for (const fiche of fiches) {
      const pousses = fiche.querySelectorAll('.mt-auto')
      expect(
        pousses.length,
        'une fiche de membre pousse encore un bloc au bas d’une hauteur étirée',
      ).toBe(0)
    }

    /* Et la grille ne les étire plus : sans cela, retirer `mt-auto` laisserait
       la même hauteur avec le vide DESSOUS au lieu de DEDANS. */
    const grille = fiches[0]!.parentElement!
    expect(grille.className).toMatch(/items-start/)
  })
})
