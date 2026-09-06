import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * « VACANT » N'EST PAS UN ÉTAT DE PAIEMENT.
 *
 * ═══ CE QUE LA COLONNE UNIQUE COMPTAIT ENSEMBLE ═══
 *
 * « Ce mois » rendait `PaymentStatusPill` sur les cinq valeurs de
 * `PaymentStatus`, `vacant` compris. Quatre disent ce qu'un bail a fait de son
 * échéance — soldée, partielle, en retard, non appelée. La cinquième dit qu'il
 * n'y a pas de bail. Un logement vacant n'est pas en défaut de paiement : il
 * n'a rien à payer, et le compter avec les autres rendait le taux d'occupation
 * illisible depuis la table.
 *
 * ═══ LA RÈGLE A SURVÉCU À SA PREMIÈRE MISE EN FORME ═══
 *
 * Elle a d'abord pris la forme d'une colonne « Occupation », avec ses pastilles
 * Occupé / Vacant. Cette colonne est partie : elle redisait ce que la colonne
 * LOCATAIRE dit déjà en toutes lettres, une case plus loin — « Aucun locataire »
 * en gris italique. Une colonne pour un doublon.
 *
 * CE QUI COMPTE N'A PAS BOUGÉ D'UN POUCE, et c'est le sujet de ce fichier : la
 * colonne de paiement reste MUETTE sur un logement sans bail. C'est là qu'était
 * le défaut, c'est là que la garde reste. Ce que la colonne « Occupation »
 * portait est simplement rendu par celle qui le portait déjà.
 *
 * ═══ LE TIRET, PAS UNE PASTILLE ═══
 *
 * Peindre « rien à percevoir » en pastille rendrait à l'absence le poids d'un
 * état, et remettrait dans cette colonne ce qu'on vient d'en sortir. Il est
 * `aria-hidden`, doublé d'un motif en `sr-only` : un tiret cadratin s'annonce
 * « tiret » ou ne s'annonce pas, et une cellule muette ne dirait pas POURQUOI
 * elle l'est.
 */

/** Le rang de chaque colonne, lu sur les en-têtes plutôt que compté à la main. */
function colonnes() {
  const enTetes = within(screen.getByRole('table')).getAllByRole('columnheader')
  const rang = (libelle: string) => {
    const index = enTetes.findIndex((e) => e.textContent?.trim() === libelle)
    if (index < 0) throw new Error(`Aucun en-tête « ${libelle} »`)
    return index
  }
  return { locataire: rang('Locataire'), ceMois: rang('Ce mois') }
}

/** La rangée du logement portant ce libellé. */
function rangee(unite: string) {
  const ligne = within(screen.getByRole('table'))
    .getAllByRole('row')
    .find((r) => within(r).queryByRole('link', { name: new RegExp(`\\b${unite}\\b`) }))
  if (!ligne) throw new Error(`Aucune rangée pour le logement ${unite}`)
  return ligne
}

async function ouvrirLeParc() {
  installerFauxServeur()
  await renderApp('/demo/parc', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
}

describe('la colonne de paiement du parc', () => {
  it('reste MUETTE sur un logement qui n’a pas de bail', async () => {
    await ouvrirLeParc()
    const rang = colonnes()

    // B4 et C3 sont les deux logements vacants de la démonstration.
    for (const unite of ['B4', 'C3']) {
      const cellules = within(rangee(unite)).getAllByRole('cell')

      /*
        AUCUNE PASTILLE — et l'assertion porte sur `data-ton`, non sur un texte
        absent. Chercher l'absence du mot « Vacant » passerait au vert le jour où
        la pastille reviendrait sous un autre libellé. Ce qui est interdit ici,
        c'est qu'un logement sans bail porte un ÉTAT DE PAIEMENT, quel qu'il soit.
      */
      expect(
        cellules[rang.ceMois]!.querySelectorAll('[data-ton]'),
        `pastille de paiement sur ${unite}, qui n'a pas de bail`,
      ).toHaveLength(0)

      /* ET LA CELLULE DIT POURQUOI ELLE SE TAIT. Le tiret est `aria-hidden` ; le
         motif vit en `sr-only`, dans la même cellule. */
      expect(within(cellules[rang.ceMois]!).getByText(/Rien à percevoir/)).toBeInTheDocument()
    }
  })

  it('dit la vacance là où elle se lisait déjà : la colonne Locataire', async () => {
    await ouvrirLeParc()
    const rang = colonnes()

    /* GARDE DU GARDE — sans cette moitié, « aucune pastille de paiement »
       serait satisfait par une ligne qui ne dirait NULLE PART que le logement
       est vide. La donnée doit rester lisible, c'est son doublon qui est parti. */
    for (const unite of ['B4', 'C3']) {
      const cellules = within(rangee(unite)).getAllByRole('cell')
      expect(within(cellules[rang.locataire]!).getByText(/Aucun locataire/)).toBeInTheDocument()
    }
  })

  it('garde l’état de paiement sur les logements qui en ont un', async () => {
    await ouvrirLeParc()
    const rang = colonnes()

    /* A1 est soldé, C2 est en retard : rien n'a été retiré aux lignes qui ont un
       bail. Les libellés sont ceux du dictionnaire — `status.paid` dit « À jour ». */
    for (const [unite, etat] of [
      ['A1', 'À jour'],
      ['C2', 'En retard'],
    ]) {
      const cellules = within(rangee(unite!)).getAllByRole('cell')
      expect(within(cellules[rang.ceMois]!).getByText(etat!)).toBeInTheDocument()
      // Et leur locataire est nommé, ce qui est l'autre moitié de la lecture.
      expect(cellules[rang.locataire]!.textContent).not.toMatch(/Aucun locataire/)
    }
  })

  it('n’a plus de colonne « Occupation » — elle redisait le locataire', async () => {
    await ouvrirLeParc()
    /* Le doublon est parti, et ce cas empêche qu'il revienne sans qu'on en
       reparle : deux colonnes pour une même donnée est le défaut qu'on vient de
       retirer, pas une régression à surveiller ailleurs. */
    expect(screen.queryByRole('columnheader', { name: 'Occupation' })).not.toBeInTheDocument()
  })
})
