import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UN JETON DE COULEUR A UN EMPLOI, OU IL EST EN RÉSERVE DÉCLARÉE.
 *
 * CE QU'ELLE EMPÊCHE. `branchesMortes.test.ts` tient la même règle pour les
 * tables de tons des primitives ; celle-ci la tient pour la PALETTE. Le trou
 * était réel : un jeton de couleur se déclare dans TROIS blocs — le clair, le
 * sombre automatique, le sombre choisi — et rien ne vérifiait qu'il servait
 * quelque part. Il compile, il n'apparaît nulle part, et il pourrit en silence.
 *
 * ET IL POURRIT PLUS MAL QUE LES AUTRES, à cause du thème sombre. Une valeur
 * sombre qu'aucun écran ne rend n'est jamais REGARDÉE : `theme.test.ts` en
 * vérifie la couverture et le contraste, donc elle passe toutes les portes du
 * dépôt sans que personne n'ait jamais vu à quoi elle ressemble. Sept lots de
 * refonte ont réglé des couleurs invisibles.
 *
 * C'EST ARRIVÉ, ET LA MESURE L'A TROUVÉ. `--color-surface-raised` : trois
 * déclarations, deux assertions de contraste dans `theme.test.ts`, ZÉRO emploi
 * dans le produit. Pire, son nom mentait dans LES DEUX thèmes — « surélevé »
 * pour une valeur qui, mesurée, se situe SOUS `--color-surface` (ΔL* −1,4 en
 * clair, −2,5 en sombre). Un jeton mort dont le nom est faux est la pire des
 * deux choses : le jour où quelqu'un le rallume, il hérite d'un réglage vieux
 * de plusieurs lots ET d'un contresens.
 *
 * LA RÉSERVE EST UNE DÉCISION, PAS UNE EXCEPTION. Une ÉCHELLE garde ses
 * barreaux : `--color-data-2` et `--color-data-5` ne servent pas — le produit
 * n'affiche que trois séries — mais elles documentent la forme de l'échelle, et
 * retirer le deuxième et le cinquième d'une suite de six la rendrait illisible.
 * La différence avec un jeton mort est qu'ici on peut DIRE pourquoi il reste,
 * et que la phrase est dans le fichier plutôt que dans une mémoire.
 *
 * CE QU'ELLE NE VOIT PAS, et il faut le dire : elle établit qu'un nom est CITÉ,
 * pas qu'il est RENDU. Un `var(--color-x)` dans une branche morte compte comme
 * un emploi. Le critère est volontairement lâche, comme celui de
 * `branchesMortes` : ce qu'on veut attraper est le cas NET, un jeton que plus
 * rien au monde ne nomme.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')
const RACINE = join(SRC, '..')
const CSS = readFileSync(join(ICI, 'tokens.css'), 'utf8')

/**
 * LA RÉSERVE. Chaque entrée porte sa raison, et la porte refuse une entrée
 * qui aurait retrouvé un emploi — une réserve qui couvre un jeton vivant est
 * un cimetière, pas une décision.
 */
const RESERVE: Record<string, string> = {
  'data-2':
    'Barreau de l’échelle des séries. Le produit n’affiche que trois séries — loyer, eau, ' +
    'électricité — et emploie 6, 4 et 3. Retirer le deuxième et le cinquième d’une suite de ' +
    'six clartés mesurées (1 %, 7 %, 13 %, 18 %, 26 %, 28 %) la rendrait illisible : ce qui ' +
    'reste ne se lirait plus comme une échelle mais comme quatre couleurs.',
  'data-5': 'Même raison que `data-2` — barreau de l’échelle, non employé.',
  'data-1-on-dark':
    'Contrepartie claire de `data-1`. Les trois séries rendues ont la leur et s’en servent ; ' +
    'celle-ci suit la même règle par symétrie, et son absence ferait de la famille ' +
    '`-on-dark` une liste à trous.',
  'data-2-on-dark': 'Contrepartie de `data-2` — même raison.',
  'data-5-on-dark': 'Contrepartie de `data-5` — même raison.',
  'ink-3':
    'Troisième cran de l’échelle d’encre. `ink` et `ink-2` servent ; ce cran documente le pas ' +
    'de l’échelle et son plancher avant `muted`. Une échelle garde ses barreaux.',
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

function corps(css: string, entete: string): string {
  const debut = css.indexOf(entete)
  if (debut === -1) throw new Error(`bloc introuvable dans tokens.css : ${entete}`)
  let profondeur = 0
  for (let i = css.indexOf('{', debut); i < css.length; i++) {
    if (css[i] === '{') profondeur++
    else if (css[i] === '}' && --profondeur === 0) return css.slice(css.indexOf('{', debut) + 1, i)
  }
  throw new Error(`accolade non refermée après ${entete}`)
}

function sources(depuis: string): string[] {
  const trouves: string[] = []
  for (const nom of readdirSync(depuis)) {
    if (nom === 'node_modules' || nom === 'dist' || nom.startsWith('.')) continue
    const chemin = join(depuis, nom)
    if (statSync(chemin).isDirectory()) trouves.push(...sources(chemin))
    else if (/\.(tsx?|css|mjs)$/.test(nom) && !/\.test\.tsx?$/.test(nom)) trouves.push(chemin)
  }
  return trouves
}

const NU = sansCommentaires(CSS)
const PALETTE = corps(NU, '@theme')

/** Les jetons `--color-*` déclarés par le thème clair, qui fait référence. */
const JETONS = [...new Set([...PALETTE.matchAll(/--color-([\w-]+)\s*:/g)].map((m) => m[1]))].sort()

/**
 * TOUT LE TEXTE OÙ UN EMPLOI PEUT VIVRE, y compris `tokens.css` HORS de sa
 * palette : `.gl-skeleton::after` y consomme `--color-skeleton-sweep` en
 * `var()`, et l'exclure faisait de ce jeton un faux mort. Les fichiers de test
 * sont exclus : citer un jeton pour le mesurer n'est pas s'en servir.
 */
const EMPLOIS = [
  ...sources(join(RACINE, 'src')),
  ...sources(join(RACINE, 'scripts')),
]
  .map((chemin) => {
    const source = readFileSync(chemin, 'utf8')
    // `PALETTE` est découpé du texte SANS COMMENTAIRES : le retrancher du texte
    // BRUT ne trouverait rien, et `split` rendrait le fichier entier — palette
    // comprise. Tout jeton passerait alors pour employé par sa propre
    // déclaration, et la règle serait vacuement verte. Attrapé au premier
    // passage : `--color-accent-tint-2` s'est déclaré vivant tout seul.
    return chemin.endsWith('tokens.css')
      ? sansCommentaires(source).split(PALETTE).join('\n')
      : source
  })
  .join('\n')

/*
  LES PRÉFIXES D'UTILITAIRES, ASSEMBLÉS PAR FRAGMENTS.

  Tailwind lit les sources comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair — le dépôt a déjà payé
  une classe fantôme livrée dans le CSS pour cette raison. Rien de ce fichier ne
  doit ressembler à une classe : les préfixes sont recollés à l'exécution.
*/
const TIRET = '-'
const PREFIXES = [
  'bg', 'text', 'border', 'divide', 'ring', 'outline', 'fill', 'stroke',
  'shadow', 'from', 'to', 'via', 'accent', 'caret', 'decoration',
].map((p) => p + TIRET)

function estEmploye(jeton: string): boolean {
  if (EMPLOIS.includes(`var(${'--color-'}${jeton})`)) return true
  return PREFIXES.some((prefixe) =>
    new RegExp(String.raw`[\s"'\`:(]${prefixe}${jeton}(?![\w-])`).test(EMPLOIS),
  )
}

describe('jetons de couleur morts', () => {
  it('lit bien une palette', () => {
    // GARDE DE LA GARDE : un découpage cassé rendrait zéro jeton, et la règle
    // suivante serait vraie sans avoir rien regardé.
    expect(JETONS.length).toBeGreaterThan(40)
  })

  it('n’en déclare aucun que rien ne nomme', () => {
    const morts = JETONS.filter((j) => !RESERVE[j] && !estEmploye(j))
    expect(
      morts.map(
        (j) =>
          `--color-${j} — aucun emploi. Le retirer des TROIS blocs de palette, ` +
          `ou l’inscrire dans RESERVE avec sa raison.`,
      ),
    ).toEqual([])
  })

  it('ne garde aucune réserve qui aurait retrouvé un emploi', () => {
    // Symétrique de la garde du garde de `TOLERES` : une exception qui ne couvre
    // plus rien blanchit d'avance ce qui reprendra son nom.
    const ressuscites = Object.keys(RESERVE).filter((j) => estEmploye(j))
    expect(ressuscites.map((j) => `--color-${j} sert désormais — à retirer de RESERVE`)).toEqual([])
  })

  it('ne réserve aucun jeton que la palette ne déclare plus', () => {
    const fantomes = Object.keys(RESERVE).filter((j) => !JETONS.includes(j))
    expect(fantomes.map((j) => `--color-${j} n’est plus déclaré — à retirer de RESERVE`)).toEqual([])
  })
})
