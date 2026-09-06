import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LE SQUELETTE D'UN TABLEAU ANNONCE LA FORME QUI VA VENIR — AU MÊME SEUIL.
 *
 * `DataTable` avec `fiches` rend des cartes jusqu'à `lg` (1024 px) et un
 * tableau au-delà. `SkeletonTable` passait à six colonnes dès `sm` (640 px) :
 * entre 640 et 1023 px, sept écrans annonçaient un tableau puis chargeaient
 * des fiches — un squelette qui ment sur la forme, c'est un décalage de mise
 * en page au moment précis où l'œil cherche ses repères. `squelettesFideles`
 * garde les grilles d'indicateurs et les hauteurs de ligne ; ce seuil-ci lui
 * échappait.
 *
 * Deux règles : la grille du squelette de tableau ne bascule qu'à `lg`, comme
 * `AU_DELA_LG` ; et tout écran qui demande des `fiches` à son tableau les
 * demande aussi à son squelette, qui rend alors des cartes sous `lg`.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

function fichiers(depuis: string): string[] {
  const trouves: string[] = []
  for (const nom of readdirSync(depuis)) {
    const chemin = join(depuis, nom)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin))
    else if (/\.tsx$/.test(nom) && !/\.test\.tsx$/.test(nom)) trouves.push(chemin)
  }
  return trouves
}

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const SQUELETTE = code(readFileSync(join(SRC, 'components/primitives/Skeleton.tsx'), 'utf8'))

describe('SkeletonTable', () => {
  it('ne déploie ses six colonnes qu’à partir de lg, comme le tableau', () => {
    const rangee = /const RANGEE =\s*\n?\s*'([^']+)'/.exec(SQUELETTE)?.[1] ?? ''
    expect(rangee, 'la grille RANGEE').not.toBe('')
    expect(rangee).toMatch(/\blg:grid-cols-/)
    expect(rangee).not.toMatch(/\bsm:grid-cols-/)
    expect(SQUELETTE).not.toMatch(/hidden sm:block/)
  })

  it('sait rendre des fiches sous lg quand on le lui demande', () => {
    expect(SQUELETTE).toMatch(/fiches\?: boolean/)
    expect(SQUELETTE).toMatch(/lg:hidden/)
  })
})

describe('les écrans qui chargent des fiches', () => {
  const ecrans = fichiers(join(SRC, 'features')).filter((chemin) =>
    /<DataTable[\s\S]*?\bfiches\b[\s\S]*?\/>/.test(code(readFileSync(chemin, 'utf8'))),
  )

  it('sont bien trouvés', () => {
    expect(ecrans.length).toBeGreaterThanOrEqual(7)
  })

  it.each(ecrans.map((c) => [c.slice(SRC.length + 1), c]))(
    '%s demande aussi des fiches à son squelette',
    (_nom, chemin) => {
      const source = code(readFileSync(chemin, 'utf8'))
      const squelettes = source.match(/<SkeletonTable\b[^>]*\/>/g) ?? []
      expect(squelettes.length, 'un SkeletonTable').toBeGreaterThan(0)
      for (const s of squelettes) expect(s).toMatch(/\bfiches\b/)
    },
  )
})
