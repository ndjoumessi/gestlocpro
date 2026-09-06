import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA COQUILLE DIT QUAND ON EST HORS LIGNE, ET SE TAIT QUAND LE RÉSEAU REVIENT.
 *
 * Rien dans le produit n'écoutait `online` / `offline`. Hors ligne, on ne
 * l'apprenait qu'au chargement de la session, ou après avoir cliqué sur un
 * bouton d'envoi et attendu que ça échoue. Sur le marché visé, perdre le réseau
 * dans une cage d'escalier n'est pas une panne, c'est une journée normale — et
 * la première chose qu'un outil doit dire, c'est s'il peut envoyer.
 *
 * Le bandeau vit dans la coquille, au même endroit que celui de la
 * démonstration : au-dessus du contenu, sur tous les écrans. `navigator.onLine`
 * faux est fiable ; vrai ne prouve rien, et le bandeau ne prétend rien de plus
 * que ce que l'appareil sait.
 */

const PARC = '15151515-4444-4555-8848-595959595959'
const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

const onLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
let present = true

beforeEach(() => {
  present = true
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => present })
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
})

afterEach(() => {
  delete (window.navigator as { onLine?: boolean }).onLine
  if (onLine) Object.defineProperty(Navigator.prototype, 'onLine', onLine)
})

describe('le bandeau hors ligne', () => {
  it('paraît quand le réseau tombe, et disparaît quand il revient', async () => {
    await renderApp('/app', { session: SESSION })
    expect(screen.queryByText(/hors ligne/i)).not.toBeInTheDocument()

    present = false
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    const bandeau = await screen.findByRole('status', { name: /hors ligne/i })
    expect(bandeau).toBeInTheDocument()

    present = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: /hors ligne/i })).not.toBeInTheDocument(),
    )
  })

  it('est déjà là si la page s’ouvre hors ligne', async () => {
    present = false
    await renderApp('/app', { session: SESSION })
    expect(await screen.findByRole('status', { name: /hors ligne/i })).toBeInTheDocument()
  })
})
