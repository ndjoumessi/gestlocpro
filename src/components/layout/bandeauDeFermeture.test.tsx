import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE BANDEAU QUI DIT QU'UN PARC VA DISPARAÎTRE.
 *
 * Les tiers sont prévenus par courriel à la fermeture ; un courriel peut tomber
 * dans les indésirables, l'écran qu'on ouvre tous les jours, non. Ce bandeau
 * double l'avertissement là où le travail se fait.
 *
 * LA DATE VIENT DU SERVEUR, jamais d'un calcul d'écran : le délai vit déjà à
 * trois endroits du serveur, et une quatrième copie ici annoncerait un jour
 * différent de celui du courriel.
 */
const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'manager', parkName: 'Parc de test', currency: 'XAF' }],
}

const VIDE = {
  collections: [],
  buildings: [],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

describe('le bandeau de fermeture', () => {
  it('annonce la date quand le serveur la rend', async () => {
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: { ...VIDE, fermetureLe: '2026-10-17T08:00:00.000Z' },
    })

    await renderApp('/app', { session: SESSION })

    const bandeau = await screen.findByText(/sera supprimé le/i)
    expect(bandeau).toBeInTheDocument()
    /* La date MISE EN FORME par le produit, pas la chaîne ISO du serveur. */
    expect(bandeau.textContent).toMatch(/17\/10\/2026/)
    /* Il dit quoi faire : un avertissement sans geste laisse chacun inventer
       le sien — ou n'en faire aucun. */
    expect(bandeau.textContent).toMatch(/Mes données/)
  })

  it('ne dit rien quand aucune fermeture n’est en cours', async () => {
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: { ...VIDE, fermetureLe: null },
    })

    await renderApp('/app', { session: SESSION })
    await waitFor(() => expect(screen.queryByText(/sera supprimé le/i)).not.toBeInTheDocument())
  })
})
