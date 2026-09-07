import { describe, expect, it } from 'vitest'

/**
 * LE HÉROS NE TIRE PAS LE JEU DE DÉMONSTRATION ENTIER DANS LE PAQUET D'ENTRÉE.
 *
 * Mesuré le 2026-09-07 sur la carte de sources du paquet d'entrée : le héros
 * importait trois constantes de `data/portfolio.ts` — les logements, les
 * encaissements, les relevés — et le paquet emportait avec elles 18 150 octets
 * de ce module, 2 041 de graphe, 763 d'indicateurs et surtout trois photos de
 * fixture en JPEG intégré, 38 Ko en tout que chaque visiteur de la vitrine
 * analysait avant qu'elle réponde, sans jamais les voir.
 *
 * PREMIÈRE VOIE, REFUSÉE PAR LA PORTE : rendre la carte paresseuse. Le paquet
 * perdait bien ses 38 Ko, mais `/` passait de quatre à six requêtes — le
 * morceau et sa dépendance partagée —, et `poids-ecrans` refuse les requêtes
 * par doctrine : un aller-retour vaut 300 à 800 ms sur le réseau visé, quoi
 * qu'il transporte. La carte serait arrivée plus tard que le titre n'arrivait
 * plus tôt.
 *
 * LA VOIE TENUE : les trois constantes vivent dans `parcDeDemonstration.ts`,
 * qui n'importe que des types et aucune image ; le héros lit ce module-là, et
 * `portfolio.ts` réexporte les trois noms pour tous ses autres lecteurs, qui
 * ne bougent pas. Aucune requête de plus ; le paquet d'entrée ne porte du jeu
 * que ce que la carte dessine.
 */

const SOURCES = import.meta.glob(['/src/features/marketing/Hero.tsx', '/src/data/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const HERO = sansCommentaires(SOURCES['/src/features/marketing/Hero.tsx'] ?? '')
const LEGER = SOURCES['/src/data/parcDeDemonstration.ts']
const PORTFOLIO = sansCommentaires(SOURCES['/src/data/portfolio.ts'] ?? '')

describe('le jeu de démonstration que la vitrine emporte', () => {
  it('le héros lit le module léger, pas le jeu entier', () => {
    expect(HERO).not.toMatch(/from '@\/data\/portfolio'/)
    expect(HERO).toMatch(/from '@\/data\/parcDeDemonstration'/)
  })

  it('le module léger n’importe que des types, et aucune image', () => {
    expect(LEGER, 'src/data/parcDeDemonstration.ts').toBeDefined()
    const code = sansCommentaires(LEGER ?? '')
    const imports = code.match(/^import .*$/gm) ?? []
    expect(imports.length).toBeGreaterThan(0)
    for (const ligne of imports) expect(ligne).toMatch(/^import type /)
    expect(code).not.toMatch(/\?inline/)
  })

  it('portfolio.ts réexporte les trois noms pour ses autres lecteurs', () => {
    for (const nom of ['UNITS', 'COLLECTIONS', 'READINGS']) {
      expect(PORTFOLIO).toMatch(new RegExp(`export \\{[^}]*\\b${nom}\\b[^}]*\\} from '\\./parcDeDemonstration'`))
    }
  })
})
