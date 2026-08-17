import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, attendreLeChargement } from '@/test/render'

/**
 * Clôture d'une intervention, vue de l'écran.
 *
 * `approved` était en pratique TERMINAL : le modèle porte bien un état
 * « terminé », mais aucune route n'y menait et aucun bouton ne l'offrait. Un
 * devis validé engageait la dépense et restait « à faire » indéfiniment — la
 * liste des travaux ne pouvait que grandir, et un logiciel de gestion dont la
 * liste ne se vide jamais cesse d'être lu.
 *
 * Ces cas tournent sous `/demo`, où le jeu semé porte les quatre états côte à
 * côte. C'est le seul endroit où l'on peut vérifier D'UN COUP sur qui le geste
 * est offert et sur qui il ne l'est pas.
 */

describe('clôture d’une intervention', () => {
  it('offre le geste sur un devis validé, jamais sur un devis en attente', async () => {
    renderApp('/demo/travaux')
    await attendreLeChargement()

    const validees = screen.getAllByText('Validé')
    expect(validees.length, 'le jeu de démonstration ne porte plus de devis validé').toBeGreaterThan(0)

    // Autant de boutons que d'interventions closables — validées et déclarées.
    const closables = validees.length + screen.getAllByText('Signalé').length
    expect(screen.getAllByRole('button', { name: /marquer terminé/i })).toHaveLength(closables)
  })

  it('ne l’offre pas sur un devis en attente d’arbitrage', async () => {
    renderApp('/demo/travaux')
    await attendreLeChargement()

    /**
     * Le serveur refuse ce cas en 409, et l'écran ne doit pas le proposer :
     * clore un devis en attente le ferait disparaître de la carte
     * « ce qui demande une décision » du propriétaire, pour un montant engagé
     * sans lui.
     *
     * Compté plutôt que cherché : un `queryBy` global passerait dès qu'un seul
     * bouton existe ailleurs sur la page.
     */
    const enAttente = screen.getAllByText('Devis proposé')
    expect(enAttente.length).toBeGreaterThan(0)
    for (const pastille of enAttente) {
      const carte = pastille.closest('article, div[class*="rounded"]')!
      expect(carte.textContent).not.toMatch(/marquer terminé/i)
    }
  })

  it('sort l’intervention de la liste des travaux à faire', async () => {
    const user = userEvent.setup()
    renderApp('/demo/travaux')
    await attendreLeChargement()

    const avant = screen.getAllByText('Terminé').length
    await user.click(screen.getAllByRole('button', { name: /marquer terminé/i })[0]!)

    expect(screen.getAllByText('Terminé')).toHaveLength(avant + 1)
    expect(await screen.findByText(/intervention close/i)).toBeInTheDocument()
  })

  /**
   * Le cas « pas offert au locataire » N'EST PAS ici, et c'est délibéré.
   *
   * Il y a d'abord été écrit, et il passait sans rien prouver : sondé, le
   * locataire de la démonstration ne voit qu'UNE intervention, déjà terminée.
   * Aucun bouton n'aurait paru même sans la garde de rôle — retirer celle-ci du
   * code ne faisait pas tomber le test.
   *
   * La vraie protection est de toute façon ailleurs : `exigerRole` refuse la
   * clôture à un locataire côté serveur, et c'est là qu'elle est éprouvée. Le
   * masquage à l'écran évite d'offrir un geste voué au refus ; il ne le
   * remplace pas, et un test qui prétendrait le contraire vaudrait moins que
   * pas de test.
   */
})
