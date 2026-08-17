import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde de la fourchette de durées.
 *
 * Les jetons `--duration-*` annoncent une fourchette de 150 à 300 ms et rien
 * au-dessus. Deux animations d'entrée s'en affranchissaient en inscrivant leur
 * durée en dur — 700 ms et 600 ms — juste à côté de deux voisines qui, elles,
 * passaient par les jetons. Le jeton ne défend pas la règle : il ne fait que
 * l'énoncer là où on veut bien s'en servir. Ce qui la défend, c'est une
 * relecture du fichier.
 *
 * La règle vise les transitions PONCTUELLES : une entrée, une bascule, un
 * repli — tout ce dont l'utilisateur attend la fin avant de lire. Elle ne vise
 * pas les animations perpétuelles (indicateur d'attente, balayage de
 * squelette), dont la durée est une CADENCE et non un délai : les borner à
 * 300 ms les rendrait frénétiques. D'où l'exemption sur `infinite`, seule
 * marque syntaxique fiable du perpétuel.
 *
 * Le contrôle porte sur la SOURCE et non sur le DOM, pour la même raison que
 * les gardes voisines : jsdom ne résout ni les couches en cascade ni les
 * `@utility` de Tailwind, et interroger un composant monté mesurerait jsdom.
 * Le chemin part du fichier de test et non du `cwd` — même précaution que
 * `theme.test.ts`, pour survivre à un vitest lancé d'ailleurs que la racine.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')

/** Plafond d'une transition ponctuelle, en millisecondes. */
const PLAFOND_MS = 300

/** Retire les commentaires : ils citent des durées à titre d'exemple. */
const NU = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** Jetons `--duration-*`, pour résoudre les `var()` sans les deviner. */
const JETONS = new Map<string, string>(
  [...NU.matchAll(/(--duration-[\w-]+)\s*:\s*([^;]+);/g)].map(([, nom, valeur]) => [
    nom,
    valeur.trim(),
  ]),
)

/** Convertit une durée CSS en millisecondes. `null` si ce n'en est pas une. */
function enMs(valeur: string): number | null {
  const ms = /^(-?[\d.]+)ms$/.exec(valeur)
  if (ms) return Number(ms[1])
  const s = /^(-?[\d.]+)s$/.exec(valeur)
  if (s) return Number(s[1]) * 1000
  return null
}

/**
 * Durées d'une valeur de propriété, jetons résolus.
 *
 * Un raccourci `animation` mêle durée, retard et fonction de lissage ; on ne
 * peut pas distinguer les deux premiers par la syntaxe seule, et c'est très
 * bien : un retard qui dépasse le plafond retarde la lecture tout autant
 * qu'une durée. Les deux tombent donc sous la même règle.
 */
function dureesDe(valeur: string): number[] {
  const trouvees: number[] = []
  for (const jeton of valeur.split(/\s+/)) {
    const resolu = /^var\((--[\w-]+)\)$/.exec(jeton)
    const brut = resolu ? (JETONS.get(resolu[1]) ?? '') : jeton
    const ms = enMs(brut)
    if (ms !== null) trouvees.push(ms)
  }
  return trouvees
}

describe('fourchette de durées', () => {
  it('borne les jetons `--duration-*` eux-mêmes', () => {
    const fautifs = [...JETONS].filter(([, v]) => (enMs(v) ?? 0) > PLAFOND_MS)
    expect(fautifs).toEqual([])
  })

  it('n’est franchie par aucune animation ponctuelle de tokens.css', () => {
    const fautifs: string[] = []

    for (const [, propriete, valeur] of NU.matchAll(
      /\b(animation|animation-duration|animation-delay|transition|transition-duration|transition-delay)\s*:\s*([^;}]+)[;}]/g,
    )) {
      const nettoyee = valeur.trim().replace(/\s+/g, ' ')
      // Perpétuel : la durée est une cadence, pas une attente. Hors règle.
      if (/\binfinite\b/.test(nettoyee)) continue

      for (const ms of dureesDe(nettoyee)) {
        if (ms > PLAFOND_MS) fautifs.push(`${propriete}: ${nettoyee} → ${ms}ms`)
      }
    }

    expect(fautifs).toEqual([])
  })

  /**
   * Le plafond réduit l'attente ; il ne dispense pas de la supprimer pour qui
   * la demande. Les deux règles se sont déjà croisées ailleurs — on raccourcit
   * une animation, on la juge « assez brève pour être inoffensive », et la
   * neutralisation globale finit par être allégée dans la foulée.
   */
  it('laisse `prefers-reduced-motion` tout neutraliser', () => {
    const bloc = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n {2}\}/.exec(NU)
    expect(bloc).not.toBeNull()
    expect(bloc?.[1]).toContain('animation-duration: 0.001ms !important')
    expect(bloc?.[1]).toContain('transition-duration: 0.001ms !important')
  })
})
