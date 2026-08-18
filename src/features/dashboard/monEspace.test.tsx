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
  renderApp(route)
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

  it('date le bail en cours et nomme le gestionnaire', async () => {
    await ouvrir()
    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('Bail en cours depuis le 15/05/2024')
    expect(main).toHaveTextContent('gestionnaire Diane F.')
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
   * L'eau et l'électricité sont REFACTURÉES : leur montant se dérive de la
   * quantité relevée et du tarif de `UTILITY_RATES`. Le figer dans la donnée en
   * ferait une seconde source, et un changement de tarif ferait dire deux
   * choses au même mois.
   */
  it('dérive les charges du volume et du tarif', async () => {
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
    const table = screen.getByRole('table')
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
    // Avril 2026 : 142 kWh × 99 = 14 058 dus, 9 000 réglés, reste 5 058.
    expect(screen.getByRole('table')).toHaveTextContent('reste 5 058')
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
})
