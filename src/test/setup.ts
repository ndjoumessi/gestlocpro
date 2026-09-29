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

/**
 * L'HORLOGE DÉCALÉE — inerte sans `DECALAGE_MS`.
 *
 * ═══ CE QU'ELLE PAIE ═══
 *
 * Le 2026-09-29 à 21 h 00 UTC, `lecturePersistee` a rougi sur l'intégration
 * continue ce qu'il acceptait dix minutes plus tôt ici, sans qu'une ligne de
 * source ait bougé. Le cas exigeait un ORDRE que l'horloge décidait : l'écran
 * range les avis sur un horodatage relatif arrondi au jour, et ses deux
 * fixtures sont espacées d'une heure. Pendant l'heure où l'une a basculé et
 * l'autre pas, leurs clés diffèrent et les deux avis échangent leur place.
 *
 * ON NE PEUT PAS CHERCHER CE DÉFAUT SANS DÉPLACER L'HORLOGE. Le relire ne le
 * montre pas — l'assertion a l'air d'une assertion. Le rejouer à la même heure
 * non plus. `horloge-sans-influence.mjs` s'en sert pour rejouer les cas datés à
 * quarante-huit moments de la journée.
 *
 * ═══ POURQUOI PAS `vi.useFakeTimers` ═══
 *
 * Les faux minuteurs de Vitest gèlent aussi `setTimeout`, dont `waitFor` et
 * `userEvent` dépendent : la moitié de la suite s'arrêterait d'attendre. On ne
 * remplace donc QUE la lecture de l'heure, en laissant courir le reste.
 *
 * `super(...)` reçoit les arguments tels quels pour toutes les autres formes —
 * `new Date(iso)`, `new Date(ms)`, `new Date(a, m, j)` — sans quoi une fixture
 * datée en dur serait décalée elle aussi, et l'écart mesuré resterait le même :
 * la sonde ne verrait rien.
 */
/* `process` n'est pas typé dans ce tsconfig — le dépôt n'installe pas
   `@types/node` côté client, et ce n'est pas à cette sonde de l'y faire
   entrer. On lit l'environnement par `globalThis`, typé sur place. */
const environnement = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env
const decalageDHorloge = Number(environnement?.DECALAGE_MS ?? 0)
if (decalageDHorloge) {
  const Horloge = Date
  const maintenant = Horloge.now.bind(Horloge)
  class DateDecalee extends Horloge {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(maintenant() + decalageDHorloge)
      // @ts-expect-error les autres formes passent telles quelles — voir l'en-tête
      else super(...args)
    }
    static now() {
      return maintenant() + decalageDHorloge
    }
  }
  // @ts-expect-error on remplace la lecture de l'heure, pas le type
  globalThis.Date = DateDecalee
}
