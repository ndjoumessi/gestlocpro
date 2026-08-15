import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Socle commun des tests.
 *
 * La langue, la devise et le pays sont persistés en `localStorage` : sans
 * nettoyage entre les cas, un test qui bascule en anglais ferait échouer le
 * suivant, et l'ordre d'exécution deviendrait significatif.
 */
beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
