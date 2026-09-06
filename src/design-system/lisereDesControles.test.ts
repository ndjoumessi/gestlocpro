import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LE LISERÉ D'UN CONTRÔLE DE SAISIE TIENT 3:1 SUR CE QUI L'ENTOURE.
 *
 * Un champ vide est un rectangle blanc posé sur une carte blanche : sa
 * frontière est la SEULE chose qui dit où taper. Elle était peinte avec
 * `--color-border`, le filet décoratif des cartes — 1,32:1 sur la surface,
 * 1,27:1 en sombre. Pour une personne malvoyante, ou au soleil sur un écran
 * d'entrée de gamme, le champ n'existait pas. La case à cocher et la marque de
 * la carte radio prenaient `--color-border-strong` : 1,85:1, même invisibilité.
 * Et le jour courant du calendrier se signalait par un anneau à 1,46:1 —
 * `aria-current` le disait au lecteur d'écran, rien ne le disait à l'œil.
 *
 * WCAG 1.4.11 demande 3:1 pour tout ce qui identifie un composant d'interface.
 * L'audit de contraste au navigateur ne mesurait que du TEXTE ; c'est
 * pourquoi ce défaut a traversé quinze portes. Il porte désormais une règle
 * sur les liserés (`scripts/contrast-audit.js`), et ce fichier garde la source
 * de vérité : un jeton dédié aux contrôles, à 3:1 dans les deux thèmes, et les
 * trois primitives qui doivent le porter.
 *
 * POURQUOI UN JETON À PART et non `--color-border` assombri : le filet des
 * cartes et des séparateurs DOIT rester discret — `separateurs.test.ts` le
 * borne entre 8 et 16 points de clarté — et une frontière de champ doit être
 * vue. Deux rôles, deux jetons ; un seul valeur contredirait l'une des deux
 * gardes.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..')
const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8')

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Corps d'un bloc, de l'accolade ouvrante à SA fermante — imbrication comprise. */
function corps(css: string, entete: string): string {
  const debut = css.indexOf(entete)
  if (debut === -1) throw new Error(`bloc introuvable dans tokens.css : ${entete}`)
  let profondeur = 0
  for (let i = css.indexOf('{', debut); i < css.length; i++) {
    if (css[i] === '{') profondeur++
    else if (css[i] === '}' && --profondeur === 0)
      return css.slice(css.indexOf('{', debut) + 1, i)
  }
  throw new Error(`accolade non refermée après ${entete}`)
}

function declarations(bloc: string): Map<string, string> {
  const trouvees = new Map<string, string>()
  for (const [, nom, valeur] of bloc.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]?/g))
    trouvees.set(nom, valeur.trim())
  return trouvees
}

function luminance(hex: string): number {
  const s = hex.replace('#', '')
  const canaux = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (haut + 0.05) / (bas + 0.05)
}

const NU = sansCommentaires(CSS)
const CLAIR = declarations(corps(NU, '@theme'))
const MEDIA = declarations(corps(corps(NU, '@media (prefers-color-scheme: dark)'), ':root'))
const ATTRIBUT = declarations(corps(NU, ":root[data-theme='dark']"))

const JETON = '--color-border-control'
/** Ce qui entoure un champ : la carte, ou la zone principale quand il est nu. */
const FONDS = ['--color-surface', '--color-paper'] as const
const SEUIL = 3

describe('le jeton du liseré de contrôle', () => {
  it('existe dans les trois blocs, et les deux sombres disent la même chose', () => {
    expect(CLAIR.get(JETON), 'clair').toMatch(/^#[0-9a-f]{6}$/i)
    expect(MEDIA.get(JETON), 'sombre par le système').toMatch(/^#[0-9a-f]{6}$/i)
    expect(ATTRIBUT.get(JETON), 'sombre par le choix').toBe(MEDIA.get(JETON))
  })

  it.each([
    ['clair', CLAIR],
    ['sombre', MEDIA],
  ])('tient au moins 3:1 sur la surface et sur le papier — %s', (_nom, jetons) => {
    const liseré = jetons.get(JETON)!
    for (const fond of FONDS) {
      const mesure = ratio(liseré, jetons.get(fond)!)
      expect(mesure, `${JETON} sur ${fond}`).toBeGreaterThanOrEqual(SEUIL)
    }
  })
})

describe('les primitives qui le portent', () => {
  it('Field : le champ au repos est bordé par le jeton de contrôle, pas par le filet', () => {
    const source = sansCommentaires(lire('components/primitives/Field.tsx'))
    const debut = source.indexOf('export const controlClasses')
    expect(debut, 'controlClasses introuvable').toBeGreaterThan(-1)
    const bloc = source.slice(debut, source.indexOf('\n\n', debut))
    expect(bloc).toContain("'border-border-control'")
    // `disabled:border-border` est permis : un champ éteint peut s'effacer.
    expect(bloc.replace(/disabled:border-border/g, '')).not.toMatch(/'border-border'/)
  })

  it('Choice : la case et la marque de la carte radio ne prennent plus le filet fort', () => {
    const source = sansCommentaires(lire('components/primitives/Choice.tsx'))
    expect(source).not.toContain("'border-border-strong'")
    expect(source.match(/border-border-control/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('DatePicker : le jour courant se signale par un anneau qu’on voit', () => {
    const source = sansCommentaires(lire('components/primitives/DatePicker.tsx'))
    expect(source).not.toContain('ring-accent-border')
    const courants = source.match(/aria-current=/g)?.length ?? 0
    expect(courants, 'aucun aria-current : le calendrier a changé de forme').toBeGreaterThan(0)
    expect(source.match(/ring-accent-ink/g)?.length ?? 0).toBe(courants)
  })
})
