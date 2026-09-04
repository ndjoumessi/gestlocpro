import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UN FICHIER CITÉ ENTRE ACCENTS GRAVES EXISTE.
 *
 * ═══ LE DÉFAUT, ET IL A HUIT JOURS ═══
 *
 * `Charts.tsx` disait, au-dessus de sa palette de séries :
 *
 *     « orDonnee.test.ts relit ce fichier et refuse le retour de
 *       `--color-accent` nu — le nom du garde-fou est resté doré, la couleur
 *       qu'il garde ne l'est plus. »
 *
 * Le nom n'est pas resté doré : il n'existe plus. Le 2026-08-27, `e194c02` —
 * « l'accent devient bleu, et il devient l'action » — a renommé ce fichier en
 * `accentDonnee.test.ts` ET modifié `Charts.tsx` dans le MÊME geste,
 * trente-six lignes, en laissant le renvoi sur l'ancien nom.
 *
 * CET EN-TÊTE NE PEUT PAS CITER LE NOM MORT ENTRE ACCENTS GRAVES, et c'est la
 * garde elle-même qui l'a exigé : née rouge, elle s'est comptée dans ses
 * propres plaintes. Le nom apparaît donc nu au-dessus. Une garde de renvois ne
 * peut pas écrire l'exemple de ce qu'elle refuse dans la forme qu'elle
 * refuse — c'est une contrainte réelle sur sa prose, pas une coquetterie.
 *
 * La garde existe donc, et elle garde. Ce qui est cassé est le CHEMIN qui y
 * mène : un lecteur qui suit le renvoi ne trouve rien, et la conclusion
 * naturelle — « cette garde a été retirée » — est fausse.
 *
 * ═══ POURQUOI CELLE-CI EST ÉCRIVABLE, QUAND SA COUSINE NE L'EST PAS ═══
 *
 * Ce dépôt a passé une journée sur le motif VOISIN : un commentaire qui déclare
 * une garde ABSENTE alors qu'elle existe. Neuf cas trouvés, tous corrigés à la
 * main, et deux commits écrivent que la garde correspondante « n'est pas
 * écrivable, et c'est mesuré : 21 occurrences pour 0 défaut ». Cela reste vrai :
 * ce qui distingue « aucune garde ne le voit » d'une phrase qui DÉCRIT une
 * garde est sémantique, et hors de portée d'une expression régulière.
 *
 * Ici, rien à interpréter. Un nom de fichier résout ou ne résout pas. Mesuré à
 * l'écriture sur `src`, `server/src` et `scripts` : 496 citations, cinq qui ne
 * résolvent pas, dont DEUX gabarits de prose qu'on nomme plus bas. Trois
 * défauts pour 496 lectures, contre 0 pour 21.
 *
 * ═══ CE QU'ELLE NE DIT PAS ═══
 *
 * Que le renvoi soit JUSTE. Un commentaire peut citer un fichier qui existe et
 * raconter n'importe quoi de son contenu ; cette garde tient un CHEMIN, pas une
 * affirmation. C'est la même frontière que `testsQuiLisentLeDisque`, qui tient
 * un rangement et laisse à `tsc` de dire si le projet compile.
 *
 * Elle ne lit pas non plus les `.md` ni les messages de commit — le premier
 * n'est pas du code, le second est immuable et daté, donc légitimement écrit au
 * passé de son jour.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Les répertoires de code où un renvoi engage la lecture d'un autre. */
const PERIMETRE = ['src', 'server/src', 'scripts'] as const

/**
 * Les citations qui ne DÉSIGNENT pas un fichier du dépôt, et pourquoi.
 *
 * ÉCRITE À LA MAIN, comme les autres registres d'ici : une liste dérivée
 * serait d'accord avec elle-même et accueillerait le prochain renvoi mort sans
 * un mot. Une entrée qui ne correspond plus à rien fait rougir le cas du bas.
 */
const GABARITS: { citation: string; motif: string }[] = [
  {
    citation: 'X.tsx',
    motif:
      'Un GABARIT, et son commentaire le dit à la ligne : « `@/X` -> `X.tsx`, le format des ' +
      'chemins que Rollup rapporte dans la carte des paquets ». La lettre est la variable.',
  },
  {
    citation: '.railway/railway.ts',
    motif:
      'Un fichier HYPOTHÉTIQUE : le DSL que ce dépôt a mesuré puis renoncé à adopter, parce ' +
      'qu’il ne sait pas exprimer le constructeur. Le citer est l’objet même du lot ; le ' +
      'créer serait le contraire de ce qu’il conclut.',
  },
]

/** Tous les fichiers de code du périmètre, en chemins relatifs à la racine. */
function sources(repertoire: string): string[] {
  return readdirSync(join(RACINE, repertoire), { withFileTypes: true }).flatMap((e) => {
    const chemin = join(repertoire, e.name)
    if (e.name === 'node_modules' || e.name === 'generated') return []
    if (e.isDirectory()) return sources(chemin)
    return /\.(ts|tsx|mjs|js)$/.test(e.name) ? [chemin] : []
  })
}

/**
 * Tous les noms de fichiers du dépôt, avec et sans extension.
 *
 * SANS EXTENSION AUSSI, et c'est délibéré : un renvoi qui écrit `.ts` là où le
 * fichier est en `.tsx` mène un humain au bon endroit et un outil nulle part.
 * On le refuse quand même — le lot qui a écrit cette garde en a trouvé un —,
 * mais la plainte doit dire LEQUEL des deux défauts elle a sous les yeux, sans
 * quoi on cherche un fichier disparu qui est là.
 */
function inventaireDuDepot(): { avecExtension: Set<string>; sansExtension: Set<string> } {
  const avecExtension = new Set<string>()
  const sansExtension = new Set<string>()
  const parcourir = (repertoire: string) => {
    for (const e of readdirSync(join(RACINE, repertoire), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
      const chemin = join(repertoire, e.name)
      if (e.isDirectory()) parcourir(chemin)
      else {
        avecExtension.add(e.name)
        sansExtension.add(basename(e.name, extname(e.name)))
      }
    }
  }
  parcourir('.')
  return { avecExtension, sansExtension }
}

/** Un nom de fichier de code entre accents graves, avec ou sans son chemin. */
const CITATION = /`([A-Za-z0-9_./-]+\.(?:ts|tsx|mjs))`/g

describe('les renvois entre accents graves mènent quelque part', () => {
  const { avecExtension, sansExtension } = inventaireDuDepot()
  const declares = new Set(GABARITS.map((g) => g.citation))

  const citations = PERIMETRE.flatMap((r) =>
    sources(r).flatMap((f) => {
      const source = readFileSync(join(RACINE, f), 'utf8')
      return [...new Set([...source.matchAll(CITATION)].map((m) => m[1]!))].map((citation) => ({
        fichier: f,
        citation,
      }))
    }),
  )

  it('cite au moins trois cents fichiers — sans quoi la lecture est cassée', () => {
    /* UN PLANCHER, ET NON UN NOMBRE. Si l'expression cesse de reconnaître les
       citations, chaque cas suivant passe au vert sur un ensemble vide, et la
       garde devient une décoration. Mesuré à l'écriture : 496. */
    expect(citations.length).toBeGreaterThan(300)
  })

  it('ne cite aucun fichier qui n’existe pas', () => {
    const morts = citations
      .filter((c) => !declares.has(c.citation))
      .filter((c) => !avecExtension.has(basename(c.citation)))
      .map((c) => {
        const nu = basename(c.citation, extname(c.citation))
        const proche = sansExtension.has(nu)
        return (
          `${c.fichier} cite \`${c.citation}\` — ` +
          (proche
            ? 'le fichier existe sous une AUTRE EXTENSION : corrigez la citation.'
            : 'aucun fichier de ce nom dans le dépôt. Renommé ? Supprimé ?')
        )
      })

    expect(
      morts,
      'Un renvoi mort ne casse rien et se lit comme une garde retirée. Corrigez le nom, ' +
        'ou déclarez-le dans `GABARITS` avec son motif s’il ne désigne pas un fichier réel.',
    ).toEqual([])
  })

  it('ne déclare aucun gabarit que plus personne ne cite', () => {
    const cites = new Set(citations.map((c) => c.citation))
    const mortes = GABARITS.filter((g) => !cites.has(g.citation)).map((g) => g.citation)

    expect(
      mortes,
      'Ces exemptions ne correspondent plus à aucune citation : elles décrivent un état ' +
        'disparu avec l’autorité d’un registre. Retirez-les.',
    ).toEqual([])
  })
})
