import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Le front seulement. `server/` est un paquet à part, avec son propre
    // `vitest.config.ts`, son environnement Node et sa base de données : sans
    // cette borne, la suite du client ramasse les tests d'API et les fait
    // échouer sur une configuration qu'elle n'a jamais eu à connaître.
    include: ['src/**/*.test.{ts,tsx}'],
    // Les tests d'i18n comparent des chaînes formatées par Intl : sans fuseau
    // ni langue fixes, ils passeraient sur une machine et pas sur une autre.
    env: { TZ: 'UTC' },
    /*
      LE PLAFOND DE DURÉE, ET POURQUOI LE DÉFAUT NE SUFFISAIT PAS.

      LE DÉFAUT OBSERVÉ : deux cas `userEvent` ont expiré sous charge, puis sont
      passés seuls au coup suivant, sans qu'une ligne de code ait changé. Un test
      qui rougit selon l'occupation de la machine n'apprend rien — pire, il
      apprend à relancer, ce qui est la façon la plus efficace de désapprendre à
      lire une porte.

      LA MESURE, ET NON L'INTUITION. Sur 1 133 cas chronométrés, machine au
      repos : 178 dépassent 500 ms, 49 dépassent la seconde, et le pire tient
      3 244 ms. Le défaut de Vitest est de 5 000 ms. Le pire cas consomme donc
      65 % du budget AU REPOS, et deux exécutions consécutives du même cas ont
      rendu 2 199 puis 3 244 ms — 47 % d'écart sans rien toucher. Sur une machine
      qui fait autre chose, quatre travailleurs en parallèle, ce même cas franchit
      5 000 ms sans qu'aucun défaut ne soit en cause. C'est arrivé.

      Ces cas sont lents pour une raison qu'on ne veut pas retirer : `userEvent`
      simule une frappe touche par touche, avec les délais d'un vrai clavier, et
      c'est précisément ce qui rend le piège à focus des modales vérifiable.

      20 000 ms EST UN ARBITRAGE, PAS UNE MARGE DE CONFORT. Six fois le pire cas
      mesuré : de quoi absorber un facteur cinq de contention, ce qu'une machine
      d'intégration chargée atteint sans peine. Le prix est réel et il faut le
      dire — un test réellement bloqué immobilise désormais 20 s au lieu de 5. Le
      calcul tient parce que le blocage est rare et la contention quotidienne.

      `hookTimeout` suit : un `beforeEach` qui monte un fournisseur subit
      exactement la même contention, et le laisser à 10 000 ms déplacerait le
      problème d'un cran sans le résoudre.
    */
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
