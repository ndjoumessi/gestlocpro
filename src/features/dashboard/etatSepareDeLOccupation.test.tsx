import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * « VACANT » N'EST PAS UN ÉTAT DE PAIEMENT.
 *
 * ═══ CE QUE LA COLONNE UNIQUE COMPTAIT ENSEMBLE ═══
 *
 * La colonne « Ce mois » rendait `PaymentStatusPill` sur les cinq valeurs de
 * `PaymentStatus`, `vacant` compris. Quatre d'entre elles disent ce qu'un bail a
 * fait de son échéance — soldée, partielle, en retard, non appelée. La
 * cinquième dit qu'il n'y a pas de bail. Un logement vacant n'est pas en défaut
 * de paiement : il n'a rien à payer.
 *
 * Le coût n'était pas cosmétique. Sur douze lignes dont deux vacantes, la
 * colonne d'état comptait DIX pastilles de paiement et deux d'autre chose, et le
 * taux d'occupation — la mesure que cet écran porte en tête — ne se lisait
 * depuis la table par AUCUN décompte : il fallait savoir que « Vacant » n'entre
 * pas dans le même total que « Payé ».
 *
 * ═══ DEUX COLONNES, DEUX NATURES ═══
 *
 * `Occupation` dit s'il y a un bail. `Ce mois` dit ce que ce bail a réglé, et
 * reste MUETTE quand il n'y en a pas — un tiret, pas une pastille : peindre
 * « rien à percevoir » en pastille rendrait à l'absence le poids d'un état.
 *
 * ═══ ET L'OCCUPATION NE JUGE TOUJOURS PAS ═══
 *
 * Le dernier cas reprend l'interdit de `occupationSansVerdict` : les deux
 * pastilles d'occupation partagent un ton. Un logement loué n'est pas un succès
 * et un logement vide n'est pas une alerte — c'est ce que `PAYMENT_TONES` dit
 * déjà en toutes lettres en associant `vacant` à `neutral`.
 */

/** Le rang de chaque colonne, lu sur les en-têtes plutôt que compté à la main. */
function colonnes() {
  const enTetes = within(screen.getByRole('table')).getAllByRole('columnheader')
  const rang = (libelle: string) => {
    const index = enTetes.findIndex((e) => e.textContent?.trim() === libelle)
    if (index < 0) throw new Error(`Aucun en-tête « ${libelle} »`)
    return index
  }
  return { occupation: rang('Occupation'), ceMois: rang('Ce mois') }
}

/** La rangée du logement portant ce libellé. */
function rangee(unite: string) {
  const table = screen.getByRole('table')
  const ligne = within(table)
    .getAllByRole('row')
    .find((r) => within(r).queryByRole('link', { name: new RegExp(`\\b${unite}\\b`) }))
  if (!ligne) throw new Error(`Aucune rangée pour le logement ${unite}`)
  return ligne
}

async function ouvrirLeParc() {
  installerFauxServeur()
  await renderApp('/demo/parc')
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
}

describe('la colonne d’état du parc', () => {
  it('sépare l’occupation du paiement en deux colonnes', async () => {
    await ouvrirLeParc()
    const rang = colonnes()

    /*
      GARDE DU GARDE — les deux colonnes doivent être DISTINCTES.

      Sans cette ligne, une seule colonne intitulée tour à tour de deux façons
      satisferait tout ce qui suit.
    */
    expect(rang.occupation).not.toBe(rang.ceMois)
  })

  it('dit « Vacant » dans l’occupation, et rien dans le paiement', async () => {
    await ouvrirLeParc()
    const rang = colonnes()
    // B4 et C3 sont les deux logements vacants de la démonstration.
    for (const unite of ['B4', 'C3']) {
      const cellules = within(rangee(unite)).getAllByRole('cell')

      expect(within(cellules[rang.occupation]!).getByText('Vacant')).toBeInTheDocument()

      /*
        AUCUNE PASTILLE DANS LA COLONNE DE PAIEMENT — et l'assertion porte sur
        `data-ton` et non sur un texte absent.

        Chercher l'absence du mot « Vacant » passerait au vert le jour où la
        pastille reviendrait sous un autre libellé. Ce qui est interdit ici est
        qu'un logement sans bail porte un ÉTAT DE PAIEMENT, quel qu'il soit.
      */
      expect(
        cellules[rang.ceMois]!.querySelectorAll('[data-ton]'),
        `pastille de paiement sur ${unite}, qui n'a pas de bail`,
      ).toHaveLength(0)
    }
  })

  it('garde l’état de paiement sur les logements qui en ont un', async () => {
    await ouvrirLeParc()
    const rang = colonnes()

    // A1 est soldé, C2 est en retard : la séparation ne devait rien retirer
    // aux lignes qui ont un bail. Les libellés sont ceux du dictionnaire —
    // `status.paid` dit « À jour » et non « Payé ».
    for (const [unite, etat] of [
      ['A1', 'À jour'],
      ['C2', 'En retard'],
    ]) {
      const cellules = within(rangee(unite!)).getAllByRole('cell')
      expect(within(cellules[rang.occupation]!).getByText('Occupé')).toBeInTheDocument()
      expect(within(cellules[rang.ceMois]!).getByText(etat!)).toBeInTheDocument()
    }
  })

  it('ne peint aucun verdict sur l’occupation d’une ligne', async () => {
    await ouvrirLeParc()
    const rang = colonnes()

    const tons = new Set(
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .flatMap((r) => {
          const cellules = within(r).queryAllByRole('cell')
          const cellule = cellules[rang.occupation]
          return cellule ? Array.from(cellule.querySelectorAll('[data-ton]')) : []
        })
        .map((p) => p.getAttribute('data-ton')),
    )

    /*
      LE JEU CONTIENT LES DEUX SITUATIONS — dix logements loués et deux vacants.
      Un ton unique n'est donc pas l'effet d'une table homogène : c'est la règle
      que `PAYMENT_TONES` pose déjà pour `vacant`, tenue de l'autre côté.
    */
    expect(tons.size, 'un seul ton pour loué et vacant').toBe(1)
    expect(['ok', 'warn', 'danger']).not.toContain([...tons][0])
  })
})
