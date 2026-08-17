import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde du retrait de la chasse fixe.
 *
 * Le produit employait une police de code à quatre endroits qui n'ont rien de
 * code : surtitres, en-têtes de colonne, chiffres de tableau — et jusqu'à des
 * phrases entières, le périmètre d'un rôle se lisant comme la sortie d'un
 * terminal. Une première tentative avait changé la FONDERIE en croyant le
 * problème dans le dessin ; le grain a bougé, l'emploi est resté. Le seul
 * correctif est le retrait.
 *
 * Ce qui rend le retrait sûr, et qui doit rester vrai : l'alignement des
 * colonnes chiffrées ne vient pas de la chasse fixe mais de
 * `font-variant-numeric: tabular-nums`, que portent les polices d'interface
 * système. L'utilitaire `numeric` ne fait plus que cela, et c'est assez.
 *
 * Le contrôle porte sur les SOURCES, comme les autres gardes de ce dossier :
 * jsdom ne résout pas les couches en cascade, interroger un composant monté
 * mesurerait jsdom et non le produit.
 *
 * Les motifs cherchés sont ASSEMBLÉS à partir de fragments plutôt qu'écrits
 * en clair. Tailwind scanne ce fichier comme les autres, commentaires
 * compris : une classe citée en exemple serait régénérée dans la feuille de
 * style par le test même qui la proscrit.
 */

const DESIGN_SYSTEM = dirname(fileURLToPath(import.meta.url))
const SRC = join(DESIGN_SYSTEM, '..')
const TOKENS = join(DESIGN_SYSTEM, 'tokens.css')

/** Utilitaire de famille à chasse fixe, jamais écrit en clair — voir plus haut. */
const CLASSE_CHASSE_FIXE = 'font-' + 'mono'
/** Ancien préfixe des jetons de taille, dont le nom mentait sur la famille. */
const JETON_MENTEUR = 'text-' + 'mono-'

/** Retire les commentaires CSS : ils ont le droit de raconter l'histoire. */
function sansCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Fichiers de source examinés : le code livré, pas les tests. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.(tsx?|css)$/.test(entree)) return []
    if (/\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

describe('retrait de la chasse fixe', () => {
  it('ne laisse aucune famille à chasse fixe déclarée dans les jetons', () => {
    const css = sansCommentaires(readFileSync(TOKENS, 'utf8'))
    const fautifs: string[] = []

    for (const [ligne] of css.matchAll(/^.*(?:monospace|SF Mono|Menlo|Consolas).*$/gm)) {
      fautifs.push(ligne.trim())
    }

    expect(fautifs).toEqual([])
  })

  it('ne laisse aucune source poser la famille à chasse fixe', () => {
    const fautifs: string[] = []

    for (const chemin of fichiersSources(SRC)) {
      const code = sansCommentaires(readFileSync(chemin, 'utf8'))
      const nom = chemin.slice(SRC.length + 1)
      // L'utilitaire Tailwind, et la propriété CSS écrite à la main.
      if (code.includes(CLASSE_CHASSE_FIXE) && !chemin.endsWith('tokens.css')) {
        fautifs.push(`${nom} → utilitaire de chasse fixe`)
      }
      if (/font-family:[^;]*mono/i.test(code)) {
        fautifs.push(`${nom} → font-family à chasse fixe`)
      }
    }

    expect(fautifs).toEqual([])
  })

  it('neutralise le jeton de famille pour que l’utilitaire ne renaisse pas', () => {
    // Sans cette valeur, Tailwind réinjecte sa propre pile à chasse fixe et une
    // classe oubliée continuerait de fonctionner sans que rien ne le signale.
    const css = sansCommentaires(readFileSync(TOKENS, 'utf8'))
    expect(css).toMatch(new RegExp(`--${CLASSE_CHASSE_FIXE}:\\s*initial;`))
  })

  it('ne garde aucun jeton dont le nom annonce une famille absente', () => {
    const fautifs: string[] = []

    for (const chemin of [TOKENS, ...fichiersSources(SRC)]) {
      const code = sansCommentaires(readFileSync(chemin, 'utf8'))
      if (code.includes(JETON_MENTEUR) || code.includes(`--${JETON_MENTEUR}`)) {
        fautifs.push(chemin.slice(SRC.length + 1))
      }
    }

    expect([...new Set(fautifs)]).toEqual([])
  })

  it('garde les chiffres alignés en colonne sans police dédiée', () => {
    const css = sansCommentaires(readFileSync(TOKENS, 'utf8'))
    const bloc = /@utility numeric \{([^}]*)\}/.exec(css)

    expect(bloc).not.toBeNull()
    expect(bloc?.[1]).toContain('font-variant-numeric: tabular-nums')
  })
})
