import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * L'imputation des réserves de sortie sur la caution.
 *
 * La grille tarifaire promet « réserves relevées et horodatées, imputation
 * chiffrée sur la caution ». Le montant était relevé à l'état des lieux,
 * journalisé, puis RESSAISI À LA MAIN dans l'arbitrage : deux saisies pour un
 * seul fait, dont la seconde pouvait diverger de la première sans que rien ne
 * le dise.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

function parc(billableMinor: number) {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'aaaaaaaa-2222-4333-8444-555555555555',
          name: 'Résidence Makepe',
          district: 'Makepe',
          units: [
            {
              id: 'cccccccc-1111-4111-8111-111111111111',
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: { id: 'dddddddd-1111-4111-8111-111111111111', fullName: 'Charles Ngassa', phoneE164: null },
              leaseId: 'bbbbbbbb-1111-4111-8111-111111111111',
              status: 'paid',
              paidMinor: 145000,
              overdueDays: null,
            },
          ],
        },
      ],
      works: [],
      deposits: [
        {
          id: 'eeeeeeee-1111-4111-8111-111111111111',
          unitId: 'cccccccc-1111-4111-8111-111111111111',
          tenant: 'Charles Ngassa',
          heldMinor: 180000,
          withheldMinor: 0,
          withheldReason: null,
          status: 'settling',
          billableMinor,
        },
      ],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

async function ouvrirArbitrage() {
  const user = userEvent.setup()
  await screen.findByText('Charles Ngassa')
  await user.click(screen.getByRole('button', { name: /^arbitrer$/i }))
  return user
}

describe('imputation sur la caution', () => {
  it('propose le total des réserves de sortie', async () => {
    parc(38000)
    await renderApp('/app/cautions', { session: SESSION })
    await ouvrirArbitrage()

    // Le chiffre relevé à l'état des lieux, sans ressaisie.
    expect(screen.getByLabelText(/montant retenu/i)).toHaveValue('38000')
  })

  it('ne propose rien quand aucune sortie n’a été chiffrée', async () => {
    parc(0)
    await renderApp('/app/cautions', { session: SESSION })
    await ouvrirArbitrage()

    // Zéro pré-rempli serait une retenue proposée sans pièce pour la défendre.
    expect(screen.getByLabelText(/montant retenu/i)).toHaveValue('')
  })

  it('laisse le propriétaire trancher autrement', async () => {
    parc(38000)
    await renderApp('/app/cautions', { session: SESSION })
    const user = await ouvrirArbitrage()

    /**
     * PROPOSÉ, pas imposé. La retenue est une décision du propriétaire ; l'état
     * des lieux en est la pièce, pas l'auteur. Un champ verrouillé sur le
     * constat lui retirerait un droit que le produit lui reconnaît partout
     * ailleurs.
     */
    const champ = screen.getByLabelText(/montant retenu/i)
    await user.clear(champ)
    await user.type(champ, '10000')
    expect(champ).toHaveValue('10000')
  })
})
