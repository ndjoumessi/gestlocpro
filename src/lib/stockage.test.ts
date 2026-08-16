import { afterEach, describe, expect, it, vi } from 'vitest'
import { ecrireStockage, effacerStockage, lireStockage } from './stockage'

/**
 * Le stockage peut être INTERDIT, et il le dit en levant.
 *
 * `window.localStorage` ne rend pas `null` quand l'accès est bloqué : il lève
 * une `SecurityError`. Un accès nu dans un rendu ou un gestionnaire de clic
 * fait donc échouer tout ce qui l'entoure — le clic ne produit alors
 * strictement rien : pas de message, pas de requête, rien à lire. C'est la
 * panne la plus opaque qui soit, et elle ne se reproduit jamais sur la machine
 * de celui qui a écrit le code.
 */

const vrai = Object.getOwnPropertyDescriptor(window, 'sessionStorage')

afterEach(() => {
  if (vrai) Object.defineProperty(window, 'sessionStorage', vrai)
  vi.unstubAllGlobals()
})

function interdireLeStockage() {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    },
  })
}

describe('stockage interdit', () => {
  it('rend null au lieu de lever, à la lecture', () => {
    interdireLeStockage()
    expect(() => lireStockage('session', 'peu-importe')).not.toThrow()
    expect(lireStockage('session', 'peu-importe')).toBeNull()
  })

  it('ne lève pas à l’écriture', () => {
    interdireLeStockage()
    expect(() => ecrireStockage('session', 'k', 'v')).not.toThrow()
  })

  it('ne lève pas à l’effacement', () => {
    interdireLeStockage()
    expect(() => effacerStockage('session', 'k')).not.toThrow()
  })

  it('fonctionne normalement quand le stockage est autorisé', () => {
    ecrireStockage('session', 'essai', 'valeur')
    expect(lireStockage('session', 'essai')).toBe('valeur')
    effacerStockage('session', 'essai')
    expect(lireStockage('session', 'essai')).toBeNull()
  })
})
