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

/**
 * LE DICTIONNAIRE DES ÉCRANS EST DÉPOSÉ UNE FOIS, AVANT TOUT CAS.
 *
 * Depuis la scission du 2026-10-09, la section `app` de `fr.ts` vit dans
 * `fr-app.ts`, et c'est `EspaceApplicatif.tsx` qui la dépose à l'évaluation de
 * son module. En production, aucun écran de cet arbre ne se rend avant ce
 * dépôt : c'est la sémantique d'un import, pas une course.
 *
 * `renderWithProviders`, lui, monte un composant SANS routeur : il n'évalue
 * jamais `EspaceApplicatif.tsx`, donc personne ne dépose le dictionnaire.
 * Dix-sept cas lisaient `app.inspections.issues` en toutes lettres.
 *
 * CE DÉPÔT NE MASQUE RIEN, et c'est la question qu'il faut se poser avant d'en
 * poser un. Le défaut qu'il pourrait cacher — un module du PAQUET
 * D'ENTRÉE qui prononce une clé `app.*` — est tenu statiquement, en intégration
 * continue, par `scripts/check-dictionnaire-impatient.mjs`, qui lit le graphe
 * d'imports et non le DOM. Et que les deux frontières attendent réellement le
 * dictionnaire est gardé par `dictionnaireApplicatif.test.tsx`. Ce qui reste
 * ici est ce qu'un composant monté hors de son arbre ne peut pas se donner.
 */
const {
  poserDictionnaireApplicatif,
  poserDictionnaireApplicatifAnglais,
  poserSectionFrancaise,
  poserSectionAnglaise,
} = await import('@/i18n/I18nProvider')
const { frApp } = await import('@/i18n/fr-app')
poserDictionnaireApplicatif(frApp)

/*
  LES MOTS DES TROIS PAGES JURIDIQUES, pour la même raison : en production ils
  arrivent avec le morceau qui porte les pages, et ici aucun morceau n'est
  chargé. Sans ce dépôt, tout cas qui rend une page juridique lirait `''`.
*/
const { frLegal } = await import('@/i18n/fr-legal')
poserSectionFrancaise(frLegal)

/*
  L'ANGLAIS AUSSI, depuis la scission du 2026-10-10. En production, la moitié
  applicative anglaise arrive jointe à la promesse de l'espace applicatif ; ici
  aucun morceau n'est chargé, donc personne ne la demanderait, et tout cas qui
  rend un écran en anglais lirait `''` — `t()` rend la chaîne vide pour une clé
  absente. Le dépôt est posé AVANT tout chargement, ce que `recomposerAnglais`
  accepte dans n'importe quel ordre.
*/
const { enApp } = await import('@/i18n/en-app')
poserDictionnaireApplicatifAnglais(enApp)

const { enLegal } = await import('@/i18n/en-legal')
poserSectionAnglaise(enLegal)
