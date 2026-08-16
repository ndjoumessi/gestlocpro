import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { installerFauxServeur } from './api'

/**
 * Socle commun des tests.
 *
 * La langue, la devise et le pays sont persistés en `localStorage` : sans
 * nettoyage entre les cas, un test qui bascule en anglais ferait échouer le
 * suivant, et l'ordre d'exécution deviendrait significatif.
 */
beforeEach(() => {
  window.localStorage.clear()
  // Le faux serveur est posé pour TOUS les tests, y compris ceux écrits avant
  // qu'un serveur n'existe : monter l'application appelle désormais
  // `/api/auth/me` au premier rendu, et une suite qui exigerait un vrai
  // processus tomberait sur la machine de quelqu'un d'autre.
  installerFauxServeur()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})
