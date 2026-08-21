import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * Le parc regardé.
 *
 * HUIT endroits lisaient `adhesions[0]` en dur — la coquille, le fournisseur de
 * données, la quittance, l'invitation, la devise, le rôle. Un compte multi-parcs
 * voyait donc le premier, toujours, et les autres écrans lisaient le même sans
 * que rien ne le dise.
 *
 * Ce sélecteur ne convertit rien et n'additionne rien : chaque parc s'affiche
 * dans SA devise, à son tour. C'est le choix de la note de décision — la vue
 * consolidée demanderait des taux, une date de valeur et une réponse à ce qu'on
 * imprime sur une quittance.
 */

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function session(parcs: { id: string; nom: string; devise: string }[]): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: parcs.map((p) => ({
      parkId: p.id,
      role: 'owner' as const,
      parkName: p.nom,
      currency: p.devise,
    })),
  }
}

function serveurDeuxParcs() {
  const serveur = installerFauxServeur({ authentifie: true })
  for (const [id, label] of [[A, 'A1'], [B, 'B1']] as const) {
    serveur.quand('GET', `/parks/${id}/portfolio`, {
      status: 200,
      body: {
        collections: [],
        buildings: [
          {
            id: `aaaaaaaa-0000-4000-8000-00000000000${id === A ? '1' : '2'}`,
            name: id === A ? 'Résidence Douala' : 'Résidence Paris',
            district: 'Centre',
            units: [
              {
                id: `cccccccc-0000-4000-8000-00000000000${id === A ? '1' : '2'}`,
                label,
                type: 'T3',
                surfaceSqm: 78,
                rentMinor: 145000,
                tenant: null,
                leaseId: null,
                status: 'vacant',
                paidMinor: 0,
                overdueDays: null,
              },
            ],
          },
        ],
        works: [],
        deposits: [],
        readings: [],
        inspections: [],
        notifications: [],
      },
    })
  }
  return serveur
}

describe('sélecteur de parc', () => {
  it('n’apparaît pas pour un bailleur d’un seul parc', async () => {
    installerFauxServeur({ authentifie: true })
    await renderApp('/app', { session: session([{ id: A, nom: 'Parc Bastos', devise: 'XAF' }]) })
    await screen.findByRole('heading', { level: 1 })

    // Un sélecteur à une entrée occupe la place d'une commande utile, et laisse
    // croire qu'il en existe d'autres.
    expect(screen.queryByLabelText(/parc regardé/i)).not.toBeInTheDocument()
  })

  it('change réellement le parc chargé', async () => {
    serveurDeuxParcs()
    const user = userEvent.setup()
    await renderApp('/app/parc', {
      session: session([
        { id: A, nom: 'Parc Douala', devise: 'XAF' },
        { id: B, nom: 'Parc Paris', devise: 'EUR' },
      ]),
    })
    await screen.findByText('A1')

    await user.selectOptions(screen.getByLabelText(/parc regardé/i), B)

    // Le second parc, et non un rendu du premier sous un autre nom.
    expect(await screen.findByText('B1')).toBeInTheDocument()
    expect(screen.queryByText('A1')).not.toBeInTheDocument()
  })

  it('emporte la DEVISE du parc choisi', async () => {
    serveurDeuxParcs()
    const user = userEvent.setup()
    await renderApp('/app/parc', {
      session: session([
        { id: A, nom: 'Parc Douala', devise: 'XAF' },
        { id: B, nom: 'Parc Paris', devise: 'EUR' },
      ]),
    })
    await screen.findByText('A1')
    expect(screen.getByRole('main').textContent).toMatch(/FCFA|CFA/)

    await user.selectOptions(screen.getByLabelText(/parc regardé/i), B)
    await screen.findByText('B1')

    /**
     * Chaque parc dans SA devise. Rien n'est converti : c'est ce qui rend le
     * sélecteur honnête là où une vue consolidée devrait d'abord répondre à la
     * question du taux et de sa date.
     */
    expect(screen.getByRole('main').textContent).toMatch(/€/)
  })

  it('nomme le parc regardé dans la barre latérale', async () => {
    serveurDeuxParcs()
    const user = userEvent.setup()
    await renderApp('/app/parc', {
      session: session([
        { id: A, nom: 'Parc Douala', devise: 'XAF' },
        { id: B, nom: 'Parc Paris', devise: 'EUR' },
      ]),
    })
    await screen.findByText('A1')

    await user.selectOptions(screen.getByLabelText(/parc regardé/i), B)

    // Sans cela on change de données sans changer d'étiquette : l'écran dirait
    // « Parc Douala » au-dessus des logements de Paris.
    expect(await screen.findAllByText('Parc Paris')).not.toHaveLength(0)
  })
})
