import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde de l'or de marque employé comme DONNÉE.
 *
 * `tokens.css` écrit noir sur blanc que `--color-gold` n'est jamais autre chose
 * qu'un fond, une bordure décorative ou une icône : 2,87:1 sur blanc, sous le
 * seuil de 3:1 qu'un élément non textuel porteur de sens doit tenir. Quatre
 * points de code le contredisaient pourtant — la barre du mois courant, la
 * ligne d'objectif, le remplissage de la barre de progression et l'indicateur
 * d'onglet actif. Un commentaire qui proscrit ce que le code fait ne protège
 * personne ; c'est ce test qui le fait tenir.
 *
 * Il lit les FICHIERS SOURCES et le fichier de jetons, jamais le DOM : jsdom ne
 * résout ni les couches Tailwind ni les requêtes média, et un test monté
 * mesurerait le rendu de jsdom plutôt que la décision de design. Même détour
 * que `theme.test.ts` pour le chemin — `fileURLToPath` et non `new URL(...)`,
 * que Vite réécrirait en URL servie.
 *
 * Les motifs de classe sont assemblés par FRAGMENTS et jamais écrits entiers :
 * Tailwind scanne le contenu des fichiers, commentaires compris, et une classe
 * citée en exemple ici finirait générée dans la feuille de style livrée.
 */
const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..')

const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')
const CHARTS = readFileSync(join(RACINE, 'components/primitives/Charts.tsx'), 'utf8')
const PORTAIL = readFileSync(join(RACINE, 'features/dashboard/TenantPortal.tsx'), 'utf8')

/** Retire les commentaires : ils citent l'or précisément pour dire de l'éviter. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CODE = sansCommentaires(CHARTS) + '\n' + sansCommentaires(PORTAIL)

/* --- Contrastes, calculés et non recopiés depuis un commentaire ----------- */

function luminance(hex: string): number {
  const s = hex.replace('#', '')
  const canaux = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(encre: string, fond: string): number {
  const [haut, bas] = [luminance(encre), luminance(fond)].sort((a, b) => b - a)
  return (haut + 0.05) / (bas + 0.05)
}

/** Corps d'un bloc, de l'accolade ouvrante à SA fermante. */
function corps(css: string, entete: string): string {
  const debut = css.indexOf(entete)
  if (debut === -1) throw new Error(`bloc introuvable : ${entete}`)
  let profondeur = 0
  for (let i = css.indexOf('{', debut); i < css.length; i++) {
    if (css[i] === '{') profondeur++
    else if (css[i] === '}' && --profondeur === 0) return css.slice(css.indexOf('{', debut) + 1, i)
  }
  throw new Error(`accolade non refermée après ${entete}`)
}

function jetons(bloc: string): Map<string, string> {
  const trouves = new Map<string, string>()
  for (const [, nom, valeur] of bloc.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]?/g))
    trouves.set(nom, valeur.trim())
  return trouves
}

const NU = sansCommentaires(CSS)
const CLAIR = jetons(corps(NU, '@theme'))
const SOMBRE = jetons(corps(corps(NU, '@media (prefers-color-scheme: dark)'), ':root'))

/** Fragments : jamais de classe Tailwind écrite d'un seul tenant. */
const OR = 'gold'
const CLASSES_INTERDITES = [`border-${OR}`, `bg-${OR}`, `text-${OR}`]

describe('l’or de marque ne porte pas de donnée', () => {
  it('trouve bien les sources à inspecter', () => {
    // Garde du garde : un lecteur qui rend une chaîne vide valide tout.
    expect(CHARTS).toContain('StackedBarChart')
    expect(PORTAIL).toContain('role="tablist"')
    expect(CLAIR.get('--color-gold')).toBe('#c58e3e')
  })

  it('sait reconnaître un contraste insuffisant', () => {
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 1)
    // L'or sur blanc, le cas connu qui a motivé toute la correction.
    expect(ratio('#c58e3e', '#ffffff')).toBeLessThan(3)
  })

  it('n’emploie plus la variable CSS d’or comme remplissage de série', () => {
    // `var(--color-gold)` dans un `style` de barre : c'est de la donnée peinte.
    expect(CODE).not.toContain('var(--color-' + OR + ')')
  })

  it('n’emploie plus les utilitaires d’or nus dans ces deux fichiers', () => {
    // `gold-ink`, `gold-tint`, `gold-border` restent permis : ce sont d'autres
    // jetons. Seul l'accent nu est visé, d'où la limite de mot.
    for (const classe of CLASSES_INTERDITES) {
      const motif = new RegExp(`\\b${classe}\\b(?!-)`)
      expect(motif.test(CODE), `${classe} encore employé`).toBe(false)
    }
  })
})

/**
 * [rôle, encre, fond, seuil] — le fond est celui SUR lequel l'élément se pose.
 * Le seuil est 3:1 : ces quatre éléments sont non textuels mais porteurs de
 * sens. Ils dépassent tous largement, `--color-gold-ink` étant taillé pour du
 * texte.
 */
const SITES: [string, string, string, number][] = [
  ['barre du mois courant (MiniBarChart)', '--color-gold-ink', '--color-surface', 3],
  ['ligne d’objectif (StackedBarChart)', '--color-gold-ink', '--color-surface', 3],
  ['remplissage de progression', '--color-gold-ink', '--color-surface-sunken', 3],
  ['indicateur d’onglet actif (portail)', '--color-gold-ink', '--color-paper', 3],
]

describe('le jeton retenu tient le seuil dans les DEUX thèmes', () => {
  for (const [role, encre, fond, seuil] of SITES) {
    it(`${role} tient ${seuil}:1`, () => {
      for (const [nom, palette] of [
        ['clair', CLAIR],
        ['sombre', SOMBRE],
      ] as const) {
        const e = palette.get(encre)
        const f = palette.get(fond)
        expect(e, `${encre} absent du thème ${nom}`).toBeDefined()
        expect(f, `${fond} absent du thème ${nom}`).toBeDefined()
        expect(
          Number(ratio(e!, f!).toFixed(2)),
          `${role} en ${nom} : ${encre} sur ${fond}`,
        ).toBeGreaterThanOrEqual(seuil)
      }
    })
  }
})
