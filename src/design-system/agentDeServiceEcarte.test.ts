import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * AUCUN CONTEXTE DE MESURE NE NAVIGUE AVEC L'AGENT DE SERVICE.
 *
 * ═══ POURQUOI UNE GARDE, ET NON UNE RELECTURE ═══
 *
 * L'option se pose à la CRÉATION du contexte, une fois par appel à
 * `newContext`. Il y en a seize, dans dix fichiers, et rien ne signale celui
 * qu'on oublie : la porte tourne, elle est verte, et ses octets sont faux.
 *
 * Ce n'est pas une inquiétude théorique. La première rédaction de ce lot en a
 * manqué TROIS : les deux de `scripts/inventaire/mesure-navigateur.mjs`, et —
 * le pire des trois — le troisième de `scripts/releve-refonte.mjs`, qui est
 * précisément celui qui compte les octets À FROID. L'oubli venait d'un motif
 * recopié à la main d'un fichier à l'autre ; on le remplace par une constante
 * partagée ET par ce compte.
 *
 * ═══ LE NOMBRE N'EST PAS GRAVÉ ICI ═══
 *
 * On ne vérifie pas qu'il y a seize contextes — ce chiffre changera, et une
 * garde qui refuse un contexte NEUF pour la seule raison qu'il est neuf ne sert
 * personne. On vérifie que CHACUN de ceux qui existent porte la constante.
 *
 * ═══ LES DEUX EXEMPTIONS, ET CE QUI LES JUSTIFIE ═══
 *
 * `chasses-helvetica.mjs` et `releve-polices-machine.mjs` n'atteignent jamais le
 * produit : ils appellent `page.setContent()` sur un document fabriqué, sans
 * origine ni agent possible. Ils sont nommés un par un plutôt que déduits d'une
 * règle — une exemption qui se déduit s'étend toute seule.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(RACINE, 'scripts')

/** Ceux qui ne NAVIGUENT pas : `setContent` sur un document fabriqué. */
const EXEMPTS = new Set(['scripts/chasses-helvetica.mjs', 'scripts/releve-polices-machine.mjs'])

function tousLesScripts(repertoire: string): string[] {
  return readdirSync(repertoire, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(repertoire, e.name)
    if (e.isDirectory()) return tousLesScripts(chemin)
    return e.isFile() && e.name.endsWith('.mjs') ? [chemin] : []
  })
}

describe('l’agent de service écarté des mesures', () => {
  const contextes = tousLesScripts(SCRIPTS).flatMap((chemin) => {
    const nom = relative(RACINE, chemin)
    const source = readFileSync(chemin, 'utf8')
    return [...source.matchAll(/newContext\(/g)].map((m) => ({
      nom,
      ligne: source.slice(0, m.index).split('\n').length,
      /* La constante se répand en tête de l'objet, donc sur la ligne de l'appel
         ou celle qui suit. Deux lignes suffisent, et lire plus loin laisserait
         passer un contexte gardé par le contexte VOISIN. */
      suite: source.slice(m.index, m.index + 200).split('\n').slice(0, 2).join('\n'),
      exempt: EXEMPTS.has(nom),
    }))
  })

  it('trouve bien des contextes à garder — sinon cette garde ne dit rien', () => {
    /* Garde du garde : si le motif de recherche cessait de correspondre, chaque
       cas ci-dessous passerait sur une liste vide, en silence. */
    expect(contextes.length).toBeGreaterThan(10)
    expect(contextes.filter((c) => !c.exempt).length).toBeGreaterThan(10)
  })

  it.each(contextes.filter((c) => !c.exempt))(
    'garde $nom:$ligne',
    ({ suite, nom, ligne }: { suite: string; nom: string; ligne: number }) => {
      expect(
        suite.includes('...SANS_AGENT_DE_SERVICE'),
        `${nom}:${ligne} crée un contexte sans \`...SANS_AGENT_DE_SERVICE\` — ` +
          `l'agent y répondrait à la place du réseau, et les octets mesurés seraient faux`,
      ).toBe(true)
    },
  )

  it.each([...EXEMPTS].map((nom) => ({ nom })))(
    '$nom ne navigue nulle part, et c’est ce qui l’exempte',
    ({ nom }: { nom: string }) => {
      /* L'exemption n'est pas une dispense : elle tient à un fait, et ce fait
         se vérifie. Le jour où l'un de ces deux appelle `goto`, ce cas rougit et
         l'exemption tombe. */
      const source = readFileSync(join(RACINE, nom), 'utf8')
      expect(source, `${nom} navigue désormais : il n’est plus exempt`).not.toMatch(/\.goto\(/)
      expect(source, `${nom} devrait poser son document par \`setContent\``).toMatch(
        /setContent\(/,
      )
    },
  )
})
