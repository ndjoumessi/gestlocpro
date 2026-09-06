import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, NetworkError } from './client'

/**
 * UNE REQUÊTE QUI N'ABOUTIT PAS FINIT PAR LE DIRE, ET HORS LIGNE ELLE NE PART PAS.
 *
 * Aucune mutation n'avait de délai : sur un lien qui s'enlise — le cas ordinaire
 * du marché visé, pas l'exception —, le bouton tournait sans fin et rien ne
 * disait jamais si l'argent était parti. Seule la lecture de session courait
 * contre trente secondes (`SessionProvider`). Le client borne désormais chaque
 * requête : passé le délai, elle échoue comme une panne réseau, et le
 * fournisseur le dit avec les mots d'un délai — pas « rien n'a été enregistré »,
 * parce qu'un serveur qui n'a pas répondu à temps a peut-être enregistré.
 *
 * Et quand le navigateur SAIT qu'il est hors ligne (`navigator.onLine` faux —
 * fiable dans ce sens-là, pas dans l'autre), la requête ne part pas du tout :
 * l'échec est immédiat, la saisie reste sous les yeux, et personne n'attend
 * vingt secondes pour apprendre ce que l'appareil savait déjà.
 */

const onLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

function reseau(present: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => present })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete (window.navigator as { onLine?: boolean }).onLine
  if (onLine) Object.defineProperty(Navigator.prototype, 'onLine', onLine)
})

describe('une requête qui ne répond pas', () => {
  it('échoue en panne réseau passé le délai, sans attendre le serveur', async () => {
    reseau(true)
    const fetch = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetch)

    const envoi = api.addBuilding('parc', { name: 'Villa', district: 'Bastos' })
    const verdict = expect(envoi).rejects.toBeInstanceOf(NetworkError)
    await vi.advanceTimersByTimeAsync(30_000)
    await verdict
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('hors ligne', () => {
  it('ne part pas et échoue tout de suite', async () => {
    reseau(false)
    const fetch = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetch)

    await expect(api.addBuilding('parc', { name: 'Villa', district: 'Bastos' })).rejects.toBeInstanceOf(
      NetworkError,
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
