import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, waitFor } from '@/test/render'
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

  /**
   * ET IL PEUT AGIR, au lieu d'attendre que quelqu'un agisse pour lui.
   *
   * ═══ LE PARCOURS QUI NE SE REFERMAIT PAS ═══
   *
   * Le propriétaire fait ce que le produit lui montre : il émet un code portant
   * le logement, et le transmet. Le locataire n'avait NULLE PART où le saisir.
   * La carte « rejoindre un parc » — le seul champ de code de l'espace — se
   * retire dès qu'on appartient à un parc, ce qui est son cas ; et cet écran-ci
   * ne lui offrait qu'une phrase le renvoyant vers son bailleur. Capturé en
   * production, avec le code correspondant en attente dans le registre des
   * accès, valable et sans porte.
   *
   * Le geste du bailleur — « relier à une fiche », sur l'écran des accès —
   * reste : il répare les cas où le locataire n'a pas de code. Ce qui manquait
   * est l'autre moitié, celle où il en a un.
   */
  it('lui donne où saisir le code qu’on vient de lui remettre', async () => {
    const serveur = installerFauxServeur({ authentifie: true })
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
    serveur.quand('POST', '/join', {
      status: 200,
      body: { parkId: PARC, role: 'tenant', linked: true },
    })

    await renderApp('/app', { session: SESSION })
    await screen.findByText(/aucun logement rattaché/i)

    const champ = screen.getByLabelText(/code d’invitation/i)
    const utilisateur = userEvent.setup()
    await utilisateur.type(champ, 'LOC-4A7B-92CD')
    await utilisateur.click(screen.getByRole('button', { name: /rattacher mon logement/i }))

    await waitFor(() =>
      expect(
        serveur.appels.some((a) => a.methode === 'POST' && a.chemin === '/join'),
        'le code saisi ne part nulle part',
      ).toBe(true),
    )
  })
})
