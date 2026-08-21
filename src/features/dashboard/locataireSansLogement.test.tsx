import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Un locataire rattaché au parc, mais dont aucun bail ne porte le compte.
 *
 * `return null` laissait un écran ENTIÈREMENT VIDE : barre latérale, fil
 * d'Ariane, et rien. C'est l'état d'un compte que le propriétaire a invité sans
 * avoir relié sa fiche locataire — une étape manquante, pas une panne. Mais une
 * page blanche se lit comme une panne, et personne ne sait laquelle.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'tenant', parkName: 'Parc Bastos', currency: 'XAF' }],
}

describe('locataire sans logement', () => {
  it('dit pourquoi l’espace est vide, et à qui s’adresser', async () => {
    const serveur = installerFauxServeur({ authentifie: true })
    // Le serveur ne rend AUCUNE unité : c'est ce que voit un locataire dont
    // aucun bail ne cite le compte.
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        collections: [],
        buildings: [],
        works: [],
        deposits: [],
        readings: [],
        inspections: [],
        notifications: [],
      },
    })

    await renderApp('/app', { session: SESSION })

    expect(await screen.findByText(/aucun logement rattaché/i)).toBeInTheDocument()
    // Et la marche à suivre : l'étape manquante appartient au bailleur.
    expect(screen.getByText(/relier votre fiche locataire/i)).toBeInTheDocument()
  })
})
