import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UNE PORTE QUI ÉCRIT UNE CLÉ QUE LE PRODUIT NE LIT PAS NE RÈGLE RIEN.
 *
 * ═══ LE DÉFAUT, MESURÉ LE 2026-10-01 ═══
 *
 * Quatre gardes au navigateur — `modales`, `plafond-vitrine`,
 * `stabilite-au-pointage`, `releve-refonte` — posaient la langue par
 * `localStorage.setItem('gestloc.lang', …)`. Le produit lit
 * `'gestlocpro.locale'`, et n'a JAMAIS lu l'autre : zéro occurrence du littéral
 * dans tout `src/`.
 *
 * Ces quatre portes mesuraient quand même la bonne langue, par l'étiquette
 * `locale` de leur contexte Playwright, qui pilote `navigator.language` — le
 * repli de `readStoredLocale`. Le défaut n'était donc pas un faux résultat :
 * c'était UNE LIGNE QUI MENT. Elle fait croire qu'une ceinture existe là où il
 * n'y a qu'une bretelle, et le jour où quelqu'un retire l'étiquette du contexte
 * en se fiant à cette ligne, la porte mesure la mauvaise langue EN SILENCE.
 *
 * C'est la famille de [[prose-de-motivation-vieillit]], en pire : une prose
 * fausse se lit, un appel mort s'exécute et ne fait rien.
 *
 * ═══ CE QUE CE CAS VÉRIFIE, ET CE QU'IL NE VÉRIFIE PAS ═══
 *
 * Il vérifie qu'une clé écrite par un script EXISTE comme littéral dans le code
 * du PRODUIT. Il ne vérifie pas qu'elle y est lue au bon endroit, ni qu'elle y
 * porte le bon sens. C'est assez pour le défaut qu'il ferme : une clé INVENTÉE,
 * qui ne figure nulle part.
 *
 * LES TESTS SONT EXCLUS DES SOURCES, ET CE N'EST PAS UN DÉTAIL DE PROPRETÉ.
 * Première rédaction : ce fichier-ci citait la mauvaise clé dans son propre
 * en-tête, à titre d'exemple. Elle devenait donc présente dans `src/`, et le cas
 * rendait VERT sur les quatre scripts qu'il venait d'être écrit pour attraper.
 * Une garde qui se valide avec son propre commentaire — [[cas-negatif-vert-a-vide]]
 * sous une autre forme. Le produit, c'est ce qui est LIVRÉ.
 *
 * UNE CLÉ NON RÉSOLUBLE EST REFUSÉE, ELLE AUSSI. Une clé qu'on ne sait pas lire
 * est une clé qu'on ne sait pas vérifier, et le silence serait le même défaut
 * d'un cran plus haut. En pratique : écrire la clé en toutes lettres à l'appel,
 * ou en constante du même fichier. C'est aussi ce qui la rend greppable par un
 * humain, ce qu'aucun test ne remplace.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function fichiersSous(dossier: string, extension: RegExp): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersSous(chemin, extension))
    else if (extension.test(entree)) trouves.push(chemin)
  }
  return trouves
}

/** Le produit LIVRÉ, concaténé : on y cherche des littéraux, pas une structure. */
const SOURCES_DU_PRODUIT = fichiersSous(join(RACINE, 'src'), /\.tsx?$/)
  .filter((f) => !/\.test\.tsx?$/.test(f) && !/[/\\]test[/\\]/.test(f))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

type Ecriture = { fichier: string; ligne: number; cle: string; nonResolue: boolean }

/**
 * Les écritures de stockage des scripts, clé résolue.
 *
 * `setItem(X, …)` où X est un identifiant est résolu par la déclaration
 * `const X = '…'` du MÊME fichier. Une clé qu'on ne sait pas résoudre est
 * rapportée telle quelle : mieux vaut un cas qui se plaint d'un nom qu'il ne
 * comprend pas qu'un cas qui l'ignore.
 */
const ECRITURES: Ecriture[] = fichiersSous(join(RACINE, 'scripts'), /\.mjs$/).flatMap((fichier) => {
  const texte = readFileSync(fichier, 'utf8')
  const lignes = texte.split('\n')
  const trouvees: Ecriture[] = []

  for (const [index, ligne] of lignes.entries()) {
    const appel = /(?:localStorage|sessionStorage)\.setItem\(\s*([^,]+?)\s*,/.exec(ligne)
    if (!appel) continue

    const argument = appel[1]!.trim()
    const litteral = /^['"`](.*)['"`]$/.exec(argument)
    if (litteral) {
      trouvees.push({ fichier, ligne: index + 1, cle: litteral[1]!, nonResolue: false })
      continue
    }

    const declaration = new RegExp(`const\\s+${argument}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`).exec(texte)
    trouvees.push({
      fichier,
      ligne: index + 1,
      cle: declaration ? declaration[1]! : argument,
      nonResolue: !declaration,
    })
  }
  return trouvees
})

const nommer = (e: Ecriture, motif: string) =>
  `${relative(RACINE, e.fichier)}:${e.ligne} — ${motif} : « ${e.cle} »`

describe('les clés de stockage posées par les scripts sont celles du produit', () => {
  /* GARDE DU GARDE : une lecture cassée rend zéro écriture, et « aucune clé
     inventée parmi zéro » s'écrit comme « tout va bien ». */
  it('a trouvé des écritures de stockage — sinon ce cas ne compare rien', () => {
    expect(ECRITURES.length).toBeGreaterThanOrEqual(4)
  })

  it('a lu les sources du produit — sinon tout littéral paraîtrait inventé', () => {
    expect(SOURCES_DU_PRODUIT.length).toBeGreaterThan(100_000)
  })

  it('chaque clé écrite par un script se lit en toutes lettres', () => {
    const illisibles = ECRITURES.filter((e) => e.nonResolue)
    expect(illisibles.map((e) => nommer(e, 'clé non résoluble'))).toEqual([])
  })

  it('aucune clé écrite par un script n’est absente du produit', () => {
    const inventees = ECRITURES.filter(
      (e) => !e.nonResolue && !SOURCES_DU_PRODUIT.includes(`'${e.cle}'`),
    )
    expect(inventees.map((e) => nommer(e, 'clé que le produit ne porte pas'))).toEqual([])
  })
})
