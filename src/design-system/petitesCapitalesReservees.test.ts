import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `text-caps` EST UN JETON DE CAPITALES, PAS UNE « PETITE TAILLE ».
 *
 * Il vaut douze pixels, un interlettrage de 0,07 em et un interligne serré :
 * le dessin d'un surtitre en capitales, où l'espacement des lettres compense
 * l'absence de jambages. Il servait pourtant à 77 sites en bas de casse — des
 * e-mails, des montants, des références, des dates — où cet interlettrage
 * n'a aucune raison d'être, et trois sites l'annulaient déjà à la main par
 * `tracking-normal`. `text-label` existe pour ce rôle : douze pixels, sans
 * interlettrage, interligne de lecture. Et `eyebrow` porte le vrai rôle des
 * capitales, avec `uppercase` compris.
 *
 * La règle : plus aucun `text-caps` dans un composant. Petit texte en bas de
 * casse → `text-label` ; surtitre en capitales → `eyebrow`. Le jeton
 * `--text-caps` reste, consommé par `eyebrow` seul.
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

/** Sans commentaires : la prose a le droit de NOMMER la classe qu'elle explique. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('text-caps', () => {
  it('ne sert plus qu’à `eyebrow` — aucun composant ne le porte en clair', () => {
    const fautifs = fichiers(SRC)
      .filter((chemin) => /\btext-caps\b/.test(code(readFileSync(chemin, 'utf8'))))
      .map((chemin) => chemin.slice(SRC.length + 1))
    expect(fautifs).toEqual([])
  })

  it('reste consommé par eyebrow, sinon le jeton mourrait sans bruit', () => {
    const tokens = readFileSync(join(ICI, 'tokens.css'), 'utf8')
    expect(tokens).toMatch(/@utility eyebrow \{[^}]*var\(--text-caps\)/)
  })
})
