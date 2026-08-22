import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * L'ANNEAU ET SA LÉGENDE DISENT LE MÊME ÉTAT DE LA MÊME FAÇON.
 *
 * Le lot qui a donné une seconde dimension à l'anneau du recouvrement a laissé
 * UNE COUTURE, et ce test est là parce qu'elle est réelle. La part d'anneau
 * tire sa teinte et sa forme de `PARTS`, dans `Charts.tsx` ; la pastille de
 * légende, elle, appelle `JaugeDePoste`, qui tire les siennes de `JAUGES`, dans
 * `StatusPill.tsx`. Deux tables, un seul sens. Les fondre en une seule n'est
 * pas possible sans risque : les classes utilitaires doivent rester ÉCRITES EN
 * ENTIER pour que le générateur de Tailwind les voie, et une table qui les
 * composerait par interpolation produirait une feuille de style sans elles.
 *
 * On garde donc les deux tables, et on vérifie qu'elles s'accordent. Un jour où
 * l'une passera « partiel » à l'or et l'autre non, la légende désignera une
 * couleur absente de l'anneau — exactement le défaut que le lot a corrigé, dans
 * l'autre sens.
 *
 * Les deux sources sont LUES, jamais recopiées, et aucun nom de classe n'est
 * écrit ici : les tons sont CAPTURÉS par expression régulière. Un littéral cité
 * en exemple dans un fichier balayé par Tailwind finirait réellement généré
 * dans le CSS livré.
 */
/* Même détour que ses voisins pour le chemin — `fileURLToPath` et non
   `new URL(...)`, que Vite réécrirait en URL servie. Ces tests LISENT le
   disque : ils tournent sous Node, d'où leur place ici et leur inscription
   dans `tsconfig.node.json`. */
const ICI = dirname(fileURLToPath(import.meta.url))
const PRIMITIVES = join(ICI, '..', 'components', 'primitives')
const CHARTS = readFileSync(join(PRIMITIVES, 'Charts.tsx'), 'utf8')
const PILL = readFileSync(join(PRIMITIVES, 'StatusPill.tsx'), 'utf8')

/**
 * Corps d'un objet littéral nommé, de son accolade ouvrante à SA fermante.
 *
 * On part du signe ÉGAL et non du nom : `PARTS` est annoté
 * `Record<EtatDePoste, { couleur: string; forme: FormeDePart }>`, dont la
 * première accolade ouvre le TYPE. Partir du nom rendait le type à la place de
 * la table, et les quatre assertions échouaient sur des `undefined` comparés
 * entre eux — ce que le premier test attrape désormais avant les trois autres.
 */
function corps(source: string, entete: string): string {
  const nom = source.indexOf(entete)
  if (nom === -1) throw new Error(`table introuvable : ${entete}`)
  const debut = source.indexOf('=', nom)
  if (debut === -1) throw new Error(`table sans affectation : ${entete}`)
  let profondeur = 0
  for (let i = source.indexOf('{', debut); i < source.length; i++) {
    if (source[i] === '{') profondeur++
    else if (source[i] === '}' && --profondeur === 0) return source.slice(debut, i + 1)
  }
  throw new Error(`accolade non refermée : ${entete}`)
}

const ETATS = ['paid', 'partial', 'overdue'] as const

const TABLE_PARTS = corps(CHARTS, 'const PARTS')
const TABLE_JAUGES = corps(PILL, 'const JAUGES')

/** Le ton nommé par la variable CSS d'une part : `var(--color-XXX)` → `XXX`. */
function tonDeLaPart(etat: string): string | undefined {
  return TABLE_PARTS.match(new RegExp(`${etat}:[^\\n]*var\\(--color-([a-z-]+)\\)`))?.[1]
}
/** Le ton nommé par l'utilitaire d'encre d'une jauge. Le préfixe n'est pas écrit. */
function tonDeLaJauge(etat: string): string | undefined {
  const prefixe = 'text' + '-'
  return TABLE_JAUGES.match(new RegExp(`${etat}: '[^']*${prefixe}([a-z-]+)`))?.[1]
}
/** Le remplissage d'une jauge : `jauge-XXX`, ou `vide` quand l'anneau nu suffit. */
function formeDeLaJauge(etat: string): string {
  const prefixe = 'jauge' + '-'
  return TABLE_JAUGES.match(new RegExp(`${etat}: '${prefixe}([a-z]+)`))?.[1] ?? 'vide'
}
function formeDeLaPart(etat: string): string | undefined {
  return TABLE_PARTS.match(new RegExp(`${etat}:[^\\n]*forme: '([a-z]+)'`))?.[1]
}

describe('l’anneau du recouvrement et sa légende', () => {
  it('trouve bien les deux tables à confronter', () => {
    expect(TABLE_PARTS).toContain('forme')
    expect(TABLE_JAUGES.length).toBeGreaterThan(40)
    /* Sans quoi tout le reste passerait sur des `undefined` comparés entre eux. */
    for (const etat of ETATS) {
      expect(tonDeLaPart(etat), `part ${etat}`).toBeDefined()
      expect(tonDeLaJauge(etat), `jauge ${etat}`).toBeDefined()
      expect(formeDeLaPart(etat), `forme de part ${etat}`).toBeDefined()
    }
  })

  it('accorde la TEINTE de chaque part avec celle de sa pastille', () => {
    for (const etat of ETATS) {
      expect(tonDeLaPart(etat), `l’état « ${etat} »`).toBe(tonDeLaJauge(etat))
    }
  })

  it('accorde la FORME de chaque part avec le remplissage de sa pastille', () => {
    /* « creuse » côté arc, anneau nu côté pastille : c'est le même geste — rien
       n'est réglé, donc rien n'est encré. La pastille n'a pas de classe pour
       cela, la base EST l'anneau vide. */
    const CORRESPONDANCE: Record<string, string> = { pleine: 'pleine', demie: 'demie', creuse: 'vide' }
    for (const etat of ETATS) {
      expect(CORRESPONDANCE[formeDeLaPart(etat)!], `l’état « ${etat} »`).toBe(formeDeLaJauge(etat))
    }
  })

  it('donne trois formes DISTINCTES aux trois états', () => {
    /* Le cœur du lot. Deux états qui partagent une forme retombent sur la
       couleur seule — 3,4 de ΔE00 sous deutéranopie entre « partiel » et
       « en retard », soit deux aplats identiques. */
    expect(new Set(ETATS.map(formeDeLaPart)).size).toBe(ETATS.length)
  })
})
