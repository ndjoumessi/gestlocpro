import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * CHAQUE VARIABLE D'UN LIBELLÉ D'AVIS EST FOURNIE PAR SON BÂTISSEUR.
 *
 * ═══ DEUX DÉFAUTS QU'ON CONFONDAIT ═══
 *
 * Un jeton `{x}` affiché à l'utilisateur a deux causes de nature opposée :
 *
 *   · une DONNÉE ANCIENNE — la ligne a été écrite avant que le serveur ne pose
 *     ce champ. Rien ne la répare, et le rendu doit s'en accommoder ;
 *   · une FAUTE DE CODE — la variable a été renommée d'un côté et pas de
 *     l'autre, ou un libellé neuf en réclame une que personne ne fournit.
 *
 * Le rendu remplace désormais tout jeton non résolu par le signe d'absence du
 * produit. C'est juste pour le premier cas, ET CELA MASQUERAIT LE SECOND : une
 * variable renommée deviendrait un tiret, sur toutes les données, sans que rien
 * ne rougisse.
 *
 * Ce fichier vit sous `server/` pour une raison mécanique : il lit des
 * fichiers du dépôt, et seul ce côté-là porte les types de Node. C'est le
 * même foyer que la garde de `vercel.json`, pour le même motif.
 *
 * Ce fichier tient l'autre moitié. Il lit les libellés et le bâtisseur, et
 * refuse si un libellé réclame une variable que `useAlertMessage` ne sait pas
 * poser. La faute de code reste visible ; seule la donnée périmée est absorbée.
 *
 * ═══ POURQUOI LIRE LE CODE PLUTÔT QUE LE RENDRE ═══
 *
 * Rendre chaque famille avec une charge COMPLÈTE supposerait de savoir ce
 * qu'est une charge complète pour chacune — c'est-à-dire de récrire ici la
 * liste qu'on veut vérifier. Lire les deux sources et les confronter ne
 * suppose rien.
 */
const RACINE = join(import.meta.dirname, '../..')

/** Les variables que les libellés d'une famille réclament. */
function variablesDesLibelles(): Map<string, string[]> {
  const fr = readFileSync(join(RACINE, 'src/i18n/fr.ts'), 'utf8').split('\n')
  const debut = fr.findIndex((l) => l.trim() === 'msg: {')
  if (debut < 0) throw new Error('bloc `msg` introuvable dans `fr.ts`')
  let prof = 0
  let fin = -1
  for (let n = debut; n < fr.length; n++) {
    prof += (fr[n]!.match(/\{/g) ?? []).length - (fr[n]!.match(/\}/g) ?? []).length
    if (n > debut && prof === 0) {
      fin = n
      break
    }
  }
  const bloc = fr.slice(debut, fin + 1).join('\n')
  const par = new Map<string, string[]>()
  for (const m of bloc.matchAll(/^ {8}(\w+): \{([\s\S]*?)^ {8}\},/gm)) {
    /* Les commentaires citent des libellés d'exemple : ils ne comptent pas. */
    const corps = m[2]!.replace(/\/\*[\s\S]*?\*\//g, '')
    par.set(m[1]!, [...new Set([...corps.matchAll(/\{(\w+)\}/g)].map((j) => j[1]!))].sort())
  }
  return par
}

/** Les variables que le bâtisseur sait poser, quelle que soit la famille. */
function variablesDuBatisseur(): Set<string> {
  const src = readFileSync(join(RACINE, 'src/features/dashboard/Alerts.tsx'), 'utf8')
  const debut = src.indexOf('function useAlertMessage()')
  const corps = src.slice(debut, src.indexOf('\nexport function Alerts()', debut))
  return new Set([...corps.matchAll(/vars\.(\w+)\s*=/g)].map((m) => m[1]!))
}

describe('les variables des avis', () => {
  it('sont toutes fournies par `useAlertMessage`', () => {
    const libelles = variablesDesLibelles()
    const posables = variablesDuBatisseur()
    const manquantes: string[] = []
    for (const [famille, jetons] of libelles) {
      for (const jeton of jetons) {
        if (!posables.has(jeton)) manquantes.push(`${famille} → {${jeton}}`)
      }
    }
    expect(
      manquantes,
      'un libellé réclame une variable que le bâtisseur ne pose jamais : ' +
        'renommée d’un côté, ou neuve et oubliée. Le rendu la remplacerait par ' +
        'un tiret sur TOUTES les données, et personne ne le verrait.',
    ).toEqual([])
  })

  it('sont lues sur les treize familles, et le compte est écrit', () => {
    /* GARDE DU GARDE. Si la lecture du bloc `msg` cassait — un changement
       d'indentation suffirait —, la règle ci-dessus comparerait une liste vide
       à une autre et se déclarerait verte. */
    const libelles = variablesDesLibelles()
    expect(libelles.size, 'la lecture de `fr.ts` ne trouve plus les familles').toBe(13)
    expect(
      [...libelles.values()].flat().length,
      'aucune variable lue : le bloc `msg` a changé de forme',
    ).toBeGreaterThan(20)
  })
})
