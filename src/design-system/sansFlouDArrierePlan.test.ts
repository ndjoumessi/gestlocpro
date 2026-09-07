import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * AUCUN FLOU D'ARRIÈRE-PLAN : LE PRODUIT VISE UN ANDROID D'ENTRÉE DE GAMME.
 *
 * `backdrop-filter: blur()` sur une surface fixe pleine largeur — barre basse,
 * barre haute, en-tête de la vitrine, voiles des modales et du tiroir — force
 * le compositeur à refiltrer tout ce qui défile dessous, à chaque image. Sur
 * un GPU de téléphone à 60 000 FCFA, c'est le défilement qui saccade, pour un
 * effet que personne ne demande : ces surfaces sont déjà quasi opaques
 * (`bg-paper/95`), et opaques tout court elles se lisent mieux.
 *
 * Six sites le portaient. Ils passent en fonds opaques ; les voiles gardent
 * leur teinte `--color-scrim` seule.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

function fichiers(depuis: string): string[] {
  const trouves: string[] = []
  for (const nom of readdirSync(depuis)) {
    const chemin = join(depuis, nom)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin))
    else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) trouves.push(chemin)
  }
  return trouves
}

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('backdrop-blur', () => {
  it('n’est porté par aucun composant', () => {
    const fautifs = fichiers(SRC)
      .filter((chemin) => /\bbackdrop-(blur|filter)/.test(code(readFileSync(chemin, 'utf8'))))
      .map((chemin) => chemin.slice(SRC.length + 1))
    expect(fautifs).toEqual([])
  })
})
