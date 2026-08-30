import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * AUCUN CHAMP NUMÉRIQUE N'EST ÉCRIT HORS DE LA PRIMITIVE.
 *
 * ═══ CE QUE CE CONTRÔLE DÉFEND ═══
 *
 * `inputMode` ne filtre rien : il choisit le clavier d'un téléphone, et sur un
 * clavier physique toutes les touches passent. Le filtre qui refuse les lettres
 * vit donc dans `components/primitives/Input.tsx`, posé sur cet attribut. Un
 * écran qui écrirait son propre `<input inputMode="numeric">` retrouverait le
 * défaut d'origine — un loyer où « 1o3 » s'inscrit — et RIEN ne le dirait.
 *
 * C'est la forme de panne que `cibles.test.ts` décrit dès sa première ligne :
 * un invariant tenu par la seule relecture se révèle par hasard, des lots plus
 * tard. Le produit en a payé cinq.
 *
 * ═══ POURQUOI CE FICHIER EST UN `.ts`, DANS CE RÉPERTOIRE ═══
 *
 * Il lit des FICHIERS, et la porte a refusé la première rédaction pour cette
 * raison exacte : sous la configuration de l'application, un test `.tsx` ne peut
 * pas importer `node:fs` — « Cannot find module 'node:fs' », trois fois. Les
 * gardes de SOURCE de ce dépôt vivent toutes ici, et ce n'est pas un rangement :
 * c'est ce que la compilation autorise. Le rendu du champ, lui, se garde à côté
 * de la primitive, dans `primitives/saisieNumerique.test.tsx`.
 *
 * ═══ CE QU'IL NE DIT PAS ═══
 *
 * Rien de ce que le champ REND. Un `Input` correctement employé mais dont le
 * filtre serait cassé passerait ici sans broncher — c'est l'autre fichier qui
 * le tient, en tapant vraiment « 1o3 » dans un champ monté. Les deux se
 * complètent : celui-ci voit un fichier qu'aucun rendu n'atteint, l'autre voit
 * un comportement qu'aucune lecture ne montre.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRIMITIVE = join(RACINE, 'components', 'primitives', 'Input.tsx')

function sourcesDuProduit(repertoire: string, vues: string[] = []): string[] {
  for (const entree of readdirSync(repertoire)) {
    const chemin = join(repertoire, entree)
    if (statSync(chemin).isDirectory()) {
      sourcesDuProduit(chemin, vues)
      continue
    }
    if (chemin.endsWith('.tsx') && !chemin.includes('.test.')) vues.push(chemin)
  }
  return vues
}

describe('le filtre numérique ne se contourne pas', () => {
  it('n’existe aucun `<input>` numérique hors de `Input.tsx`', () => {
    const fautifs = sourcesDuProduit(RACINE)
      .filter((chemin) => chemin !== PRIMITIVE)
      .filter((chemin) => {
        const source = readFileSync(chemin, 'utf8')
        /* La CONJONCTION d'un `<input` brut et d'un `inputMode` dans le même
           fichier. Ni l'un ni l'autre ne suffit : le produit écrit des `<input
           type="range">` sans mode de saisie — un curseur ne prend pas de
           lettres — et emploie `inputMode` treize fois sur la primitive, avec un
           I majuscule que ce motif ne voit pas. */
        return /<input[\s>]/.test(source) && /inputMode/.test(source)
      })
      .map((chemin) => chemin.slice(RACINE.length + 1))

    expect(
      fautifs,
      'ces fichiers écrivent un champ numérique sans passer par `Input`, qui porte ' +
        'le filtre — la lettre y repasserait, et le montant serait celui que personne ' +
        "n'a tapé",
    ).toEqual([])
  })

  /**
   * LA GARDE DU GARDE : le motif voit-il encore quelque chose ?
   *
   * Un contrôle qui ne parcourt plus aucun fichier rend « aucun fautif » et
   * passe au vert — le même silence que ce dépôt reproche ailleurs à une sonde
   * dont le sélecteur s'est périmé. On compte donc ce qui est REGARDÉ, et la
   * primitive elle-même doit toujours porter les deux marques que le motif
   * cherche, sans quoi c'est le motif qui a cessé de correspondre au code.
   */
  it('regarde vraiment les sources, et reconnaît la primitive', () => {
    const sources = sourcesDuProduit(RACINE)
    expect(sources.length, 'aucun fichier parcouru : le balayage ne regarde plus rien').
      toBeGreaterThan(50)
    const primitive = readFileSync(PRIMITIVE, 'utf8')
    expect(/<input[\s>]/.test(primitive), '`Input.tsx` n’écrit plus de `<input>`').toBe(true)
    expect(/inputMode/.test(primitive), '`Input.tsx` ne parle plus d’`inputMode`').toBe(true)
  })
})
