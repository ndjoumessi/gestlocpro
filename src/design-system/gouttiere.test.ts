import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde de la gouttière partagée.
 *
 * `zonesSures.test.ts` ne surveille que les surfaces épinglées — celles qui
 * portent `fixed` ou `sticky`. C'était le bon périmètre pour le premier
 * chantier, et il laissait dehors tout le contenu qui COULE : sections
 * marketing, pied de page, écrans d'authentification. Avec `viewport-fit=cover`
 * ces surfaces vont elles aussi d'un bord physique à l'autre, donc elles passent
 * elles aussi sous l'encoche en paysage.
 *
 * La réponse n'a pas été de recopier quatre retraits arbitraires de plus dans
 * chaque fichier, mais de nommer la gouttière une fois. Ce test empêche la
 * duplication de revenir : il refuse la paire de retraits bruts partout, et
 * vérifie que la constante partagée compose bien l'inset au lieu de le
 * substituer.
 *
 * Lecture des SOURCES et non du DOM, pour la raison exposée en tête de
 * `zonesSures.test.ts` : jsdom ne calcule ni `env()` ni les requêtes média.
 *
 * Les noms de classe surveillés sont assemblés par fragments. Le scanner de
 * Tailwind lit ce fichier comme n'importe quelle source, commentaires compris :
 * les écrire d'un seul tenant les ferait GÉNÉRER pour de bon, c'est-à-dire
 * ressusciter dans la feuille de style l'utilitaire que la règle bannit.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')
const RACINE = join(SRC, '..')

/** Retrait horizontal de base, et sa reprise au-delà de `sm`. */
const BRUT_BASE = `p${'x'}-5`
const BRUT_SM = `sm:p${'x'}-8`
const PARTAGEE = 'GOUTTIERE_LATERALE'

function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.tsx?$/.test(entree)) return []
    if (/\.test\.tsx?$/.test(entree)) return []
    return [chemin]
  })
}

/** Retire les commentaires : ils citent les classes qu'ils expliquent. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Valeurs des attributs `className`, guillemets comme accolades. */
function attributsClassName(source: string): string[] {
  const valeurs: string[] = []
  const marqueur = /className=/g
  let trouve: RegExpExecArray | null

  while ((trouve = marqueur.exec(source))) {
    const debut = trouve.index + trouve[0].length

    if (source[debut] === '"') {
      const fin = source.indexOf('"', debut + 1)
      if (fin !== -1) valeurs.push(source.slice(debut + 1, fin))
      continue
    }

    if (source[debut] !== '{') continue
    let profondeur = 0
    for (let i = debut; i < source.length; i++) {
      if (source[i] === '{') profondeur++
      else if (source[i] === '}' && --profondeur === 0) {
        valeurs.push(source.slice(debut + 1, i))
        break
      }
    }
  }

  return valeurs
}

interface Surface {
  fichier: string
  classes: string
}

const SURFACES: Surface[] = fichiersSources(SRC).flatMap((chemin) =>
  attributsClassName(sansCommentaires(readFileSync(chemin, 'utf8'))).map((classes) => ({
    fichier: chemin.slice(RACINE.length + 1),
    classes: classes.replace(/\s+/g, ' ').trim(),
  })),
)

/**
 * Un retrait sur mesure est légitime tant qu'il reste local : une carte, un
 * bouton, une ligne de tableau ne touchent pas le bord de l'écran. Ce qui est
 * banni, c'est la PAIRE — le retrait de base ET sa reprise au-delà de `sm` —
 * qui n'apparaît ensemble que sur les conteneurs pleine largeur.
 */
const DUPLIQUEES = SURFACES.filter(
  (s) => s.classes.includes(BRUT_BASE) && s.classes.includes(BRUT_SM),
)

describe('gouttière partagée', () => {
  it('compose l’inset au lieu de le substituer, des deux côtés', () => {
    const source = readFileSync(join(SRC, 'components/layout/gouttiere.ts'), 'utf8')

    for (const cote of ['left', 'right']) {
      const retraits = [...source.matchAll(/-\[([^\]]*env\(safe-area-inset-[^\]]*)\]/g)]
        .map(([, valeur]) => valeur)
        .filter((valeur) => valeur.includes(`safe-area-inset-${cote}`))

      // En paysage l'encoche mord à gauche OU à droite selon le sens de
      // rotation : une gouttière qui n'en traite qu'un est correcte une fois sur
      // deux, ce qui est la pire des situations.
      expect(retraits.length, `aucun retrait pour le côté ${cote}`).toBeGreaterThan(0)
      for (const valeur of retraits) expect(valeur).toMatch(/max\(|calc\(/)
    }
  })

  it('est bien employée par les surfaces pleine largeur', () => {
    // Garde du garde : une règle qui n'interdit qu'un motif déjà disparu ne
    // prouve rien. Il faut que la constante ait effectivement des porteurs.
    const porteurs = new Set(
      SURFACES.filter((s) => s.classes.includes(PARTAGEE)).map((s) => s.fichier),
    )
    expect(porteurs.size).toBeGreaterThan(4)
  })

  it('ne laisse aucune surface recopier la paire de retraits bruts', () => {
    expect(
      [...new Set(DUPLIQUEES.map((s) => s.fichier))],
      'gouttière recopiée au lieu d’être partagée',
    ).toEqual([])
  })
})
