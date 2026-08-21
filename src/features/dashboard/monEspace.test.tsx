import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { renderApp, screen, switchRole, attendreLeChargement } from '@/test/render'

/**
 * « Mon espace » dans sa forme maquettée.
 *
 * L'écran avait grossi par sédimentation : DEUX listes de quittances pour le
 * même document — l'une ouvrant la modale, l'autre exportant un CSV recomposé
 * côté client — et la caution affichée deux fois, en carte de bail et en
 * indicateur. Les maquettes consolident, et ces tests fixent la consolidation.
 */
async function ouvrir(route = '/demo/mon-espace') {
  await renderApp(route)
  await switchRole('tenant')
  await attendreLeChargement()
}

describe('mon espace — en-tête', () => {
  it('nomme le LOGEMENT, et non l’écran', async () => {
    // « Mon espace locataire » ne disait rien au locataire : il n'en a qu'un.
    // Son immeuble et son numéro, si.
    await ouvrir()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Résidence Bonamoussadi — A1',
    )
  })

  it('date le bail en cours, sur la date de l’état des lieux d’entrée', async () => {
    await ouvrir()
    // A1 : état des lieux d'entrée le 15/06/2024, et le bail commence le même
    // jour — voir `alignementDuBail.test.ts`.
    expect(screen.getByRole('main')).toHaveTextContent('Bail en cours depuis le 15/06/2024')
  })

  /**
   * Le gestionnaire ne figure PAS dans l'en-tête.
   *
   * La ligne annonçait « gestionnaire Diane F. » — une chaîne du dictionnaire,
   * servie à tout locataire de tout parc. Rien dans le modèle ne relie un
   * gestionnaire à une unité : la valeur ne pouvait être juste que par
   * coïncidence, et l'en-tête est le dernier endroit où en loger une.
   */
  it('ne nomme aucun gestionnaire qu’il ne sait pas identifier', async () => {
    await ouvrir()
    expect(screen.getByRole('main')).not.toHaveTextContent(/gestionnaire Diane F\./)
  })
})

describe('mon espace — le mois en cours', () => {
  /**
   * La barre de progression prend un POURCENTAGE.
   *
   * Elle recevait le montant : la piste faisait 145 000 % de large et le
   * libellé annonçait « 145000 % ». Ni le typage ni les tests ne l'ont vu —
   * c'est la mesure dans le navigateur qui l'a montré. Ce test la remplace.
   */
  it('exprime le règlement du loyer en pourcentage', async () => {
    await ouvrir()
    const barre = screen.getByRole('progressbar')
    const now = Number(barre.getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThanOrEqual(0)
    expect(now).toBeLessThanOrEqual(100)
    // A1 est à jour : le loyer est couvert en totalité.
    expect(now).toBe(100)
  })

  it('dit par quel moyen le loyer a été réglé', async () => {
    await ouvrir()
    expect(screen.getByRole('main')).toHaveTextContent(/Payé le .* par Mobile Money/)
  })

  /**
   * Deux chiffres voisins, deux sources différentes — et c'est voulu.
   *
   * Le MONTANT du tableau est figé à l'émission, comme sur une facture : il
   * vient de la période et ne se recalcule jamais, sans quoi un changement de
   * tarif réécrirait tout l'historique et juillet se relirait au prix d'août.
   * La CONSOMMATION affichée à côté — « 16 m³ consommés » — vient du relevé,
   * la seule source qui la connaisse.
   *
   * Ils coïncident ici parce que la démonstration a été calculée au tarif de
   * `UTILITY_RATES` : 16 m³ × 520 et 178 kWh × 99.
   */
  it('affiche le montant figé de la période et la consommation relevée', async () => {
    await ouvrir()
    const main = screen.getByRole('main')
    // 16 m³ × 520 = 8 320 ; 178 kWh × 99 = 17 622.
    expect(main).toHaveTextContent('8 320')
    expect(main).toHaveTextContent('16 m³ consommés')
    expect(main).toHaveTextContent('17 622')
    expect(main).toHaveTextContent('178 kWh')
  })
})

describe('mon espace — paiements par période', () => {
  it('range les montants dans un vrai tableau, en-têtes compris', async () => {
    await ouvrir()
    const table = screen.getByRole('table', { name: 'Mes paiements par période' })
    const colonnes = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim())
    expect(colonnes).toEqual(['Période', 'Loyer', 'Eau', 'Élec.', 'Quittance'])
    // Chaque période porte son mois en en-tête de LIGNE : sans `scope="row"`,
    // un lecteur d'écran annonce des nombres sans dire de quel mois.
    expect(within(table).getAllByRole('rowheader').length).toBe(6)
  })

  /**
   * Une charge réglée en partie affiche SON RESTE.
   *
   * C'est le seul chiffre qui appelle un geste : une cellule qui ne montrerait
   * que la part versée laisserait croire la période close. La couleur ne le
   * porte pas seule — le reste est écrit.
   */
  it('écrit le reste dû d’une charge partiellement réglée', async () => {
    await ouvrir()
    // Mai 2026 (`month: 4`, indexé à zéro) : 142 kWh × 99 = 14 058 dus,
    // 9 000 réglés, reste 5 058.
    expect(screen.getByRole('table', { name: 'Mes paiements par période' })).toHaveTextContent(
      'reste 5 058',
    )
  })

  /**
   * UN SEUL chemin vers la quittance, et c'est la modale : elle rend les
   * montants du REGISTRE, quand le CSV les recompose côté client.
   */
  it('n’offre plus deux quittances pour un seul document', async () => {
    await ouvrir()
    const main = screen.getByRole('main')
    expect(within(main).queryAllByRole('button', { name: /^Télécharger$/ })).toHaveLength(0)
  })

  /**
   * LES MONTANTS SUIVENT LA DEVISE, jamais la langue.
   *
   * Le tableau des postes les formatait par le formateur de NOMBRES, qui suit
   * la locale de la langue. Sur un compte en anglais réglé en francs CFA, la
   * même somme s'écrivait donc « 145,000 » dans la cellule et « 145 000 » trois
   * cents pixels plus haut, dans l'en-tête de la même carte. Deux graphies pour
   * un seul montant sur un seul écran.
   *
   * Le cas lit l'écran EN ANGLAIS, parce que c'est la seule langue où les deux
   * formateurs divergent : en français ils tombent d'accord, et le défaut y
   * était invisible.
   */
  it('écrit les montants dans la graphie de la devise, même en anglais', async () => {
    await renderApp('/demo/mon-espace', { locale: 'en' })
    await attendreLeChargement()

    const principal = screen.getByRole('main')
    // Le franc CFA ne porte pas de décimale et groupe par espace insécable
    // étroite ; la virgule des milliers est la marque de l'autre formateur.
    expect(principal.textContent ?? '').not.toMatch(/\d,\d{3}/)
  })
})