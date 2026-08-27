import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UNE VARIANTE DÉCLARÉE A UN APPELANT, OU ELLE N'EXISTE PAS.
 *
 * CE QU'ELLE EMPÊCHE. Les primitives du produit — bouton, carte, pastille,
 * badge — exposent chacune une table de tons ou de variantes. Une entrée de ces
 * tables ne coûte rien à laisser en place : elle compile, elle ne s'affiche
 * jamais, et aucune règle de la porte ne la regarde. Elle pourrit donc en
 * silence — sa couleur cesse d'être juste sans que personne le voie, et le jour
 * où quelqu'un la rallume il hérite d'un réglage vieux de six lots.
 *
 * C'EST ARRIVÉ, ET C'EST CE QUI A FAIT ÉCRIRE CETTE GARDE. `Badge` portait un
 * ton `onDark` valant `bg-accent text-on-accent`, nommé d'après le CONTEXTE où
 * il servait — une barre sombre — plutôt que d'après ce qu'il peint. Les deux
 * barres du produit sont passées au clair : le ton n'avait plus un seul
 * appelant et son nom était devenu doublement faux, ni sombre ni employé. Deux
 * `props` de ton entières avaient subi le même sort dans la coquille.
 *
 * LE CRITÈRE EST VOLONTAIREMENT LÂCHE : le nom de la variante doit apparaître
 * comme CHAÎNE quelque part hors de son fichier de déclaration. Il ne vérifie
 * pas que l'emploi est un vrai `tone=` — un ton peut se poser par ternaire, par
 * variable, par table de correspondance, et vouloir tout reconnaître produirait
 * des faux positifs que personne ne saurait interpréter. Ce qu'on veut attraper
 * est le cas NET : une entrée que plus rien au monde ne nomme.
 *
 * LA PAGE DE DÉMONSTRATION COMPTE COMME APPELANT, et c'est délibéré : une
 * variante montrée dans la vitrine du système est une variante qu'on peut
 * relire et juger. C'est l'inverse d'une branche invisible.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/** Les tables à surveiller : fichier, nom du type, et la table elle-même. */
const TABLES: { fichier: string; table: string }[] = [
  { fichier: 'components/primitives/Badge.tsx', table: 'TONES' },
  { fichier: 'components/primitives/Card.tsx', table: 'TONES' },
  { fichier: 'components/primitives/StatusPill.tsx', table: 'TONES' },
  { fichier: 'components/primitives/Button.tsx', table: 'VARIANTS' },
]

function sources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return sources(chemin)
    return chemin.endsWith('.tsx') || chemin.endsWith('.ts') ? [chemin] : []
  })
}

/** Les clés de premier niveau d'un littéral d'objet nommé. */
function cles(source: string, nom: string): string[] {
  const debut = source.indexOf(`const ${nom}`)
  if (debut === -1) throw new Error(`table introuvable : ${nom}`)
  /*
    ON CHERCHE `= {` ET NON LA PREMIÈRE ACCOLADE, et l'erreur valait la peine
    d'être faite : l'annotation de type en porte une avant la table —
    `Record<StatusTone, { classes: string; icon: IconName }>`. En partant de la
    première, l'analyseur lisait le TYPE et rendait zéro clé, donc validait tout.
    C'est la garde du garde juste au-dessus qui l'a dit, et c'est exactement ce
    pour quoi elle existe.
  */
  const ouvrante = source.indexOf('{', source.indexOf('=', debut))
  let profondeur = 0
  let fin = ouvrante
  for (let i = ouvrante; i < source.length; i++) {
    if (source[i] === '{') profondeur++
    else if (source[i] === '}' && --profondeur === 0) {
      fin = i
      break
    }
  }
  const corps = source.slice(ouvrante + 1, fin).replace(/\/\*[\s\S]*?\*\//g, '')
  // Une clé de PREMIER niveau : en début de ligne, deux espaces d'indentation.
  return [...corps.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1])
}

describe('les variantes déclarées des primitives', () => {
  it('trouve bien les tables à inspecter', () => {
    // Garde du garde : une table introuvable ferait passer zéro clé, donc tout.
    for (const { fichier, table } of TABLES) {
      const trouvees = cles(readFileSync(join(SRC, fichier), 'utf8'), table)
      expect(trouvees.length, `${fichier} · ${table}`).toBeGreaterThanOrEqual(4)
    }
  })

  it('ont toutes un appelant hors de leur fichier', () => {
    const fichiers = sources(SRC).filter((f) => !f.includes('.test.'))
    const mortes: string[] = []

    for (const { fichier, table } of TABLES) {
      const chemin = join(SRC, fichier)
      const autres = fichiers.filter((f) => f !== chemin)
      for (const cle of cles(readFileSync(chemin, 'utf8'), table)) {
        const motif = new RegExp(`['"\`]${cle}['"\`]`)
        if (autres.some((f) => motif.test(readFileSync(f, 'utf8')))) continue
        mortes.push(`${fichier} · ${table}.${cle}`)
      }
    }

    expect(mortes, 'variante déclarée que plus rien ne nomme').toEqual([])
  })
})
