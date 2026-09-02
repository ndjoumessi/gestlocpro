import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * TOUTE CHARGE STOCKÉE SAIT SURVIVRE À SA PROPRE VIEILLESSE.
 *
 * ═══ LA CLASSE DE DÉFAUT QUE CE FICHIER FERME ═══
 *
 * Une colonne `Json` est une charge écrite par le code d'un jour et relue par
 * celui d'un autre. Le code évolue ; la ligne, non. Les seize portes du dépôt
 * construisent leurs données à chaque passage : elles mesurent toujours un
 * produit neuf sur des données neuves, et ne peuvent structurellement pas voir
 * ce qui n'arrive qu'à une ligne écrite il y a trois jours.
 *
 * CE N'EST PAS UNE CRAINTE. Un avis de production affichait « Signalement
 * SIG-2026-002 · {unit} », accolades comprises, parce qu'il datait de la veille
 * du correctif qui pose ce champ. Trouvé en parcourant un vrai parc, pas par une
 * porte.
 *
 * ═══ CE QUE CE FICHIER NE FAIT PAS ═══
 *
 * Il ne rend rien et ne charge aucune fixture. Une fixture de charges anciennes
 * serait une liste écrite à la main — donc une dette, et une liste qui ne
 * contiendrait que les formes auxquelles quelqu'un a pensé.
 *
 * Il tient la seule chose qu'une liste ne peut pas tenir : que CHAQUE colonne
 * `Json` du schéma soit couverte par une garde nommée, et qu'une colonne
 * nouvelle ne puisse pas passer inaperçue. La liste vient du SCHÉMA, pas de
 * moi.
 */
const RACINE = join(import.meta.dirname, '../..')

/**
 * Ce qui couvre chaque charge, et par quel moyen.
 *
 * Écrit à la main DÉLIBÉRÉMENT — c'est le seul endroit de ce fichier qui le
 * soit. Ajouter une colonne `Json` sans venir écrire ici comment on la protège
 * fait rougir la règle du dessous, avec le nom de la colonne oubliée.
 */
const COUVERTURES: Record<string, string> = {
  'Notification.params':
    'src/features/dashboard/avisSansLogement.test.tsx rend les TREIZE familles ' +
    'sur une charge VIDE et refuse toute accolade ; le rendu remplace un jeton ' +
    'non résolu par le signe d’absence du produit, et ' +
    'server/src/variablesDAvis.test.ts garde l’autre moitié — une variable ' +
    'renommée reste visible au lieu de devenir un tiret.',
  'AuditEvent.payload':
    'src/features/dashboard/Decisions.tsx dégrade vers le SILENCE et non vers ' +
    'l’accolade — « valeur === undefined » rend une chaîne vide, et son en-tête ' +
    'l’énonce : « le pire résultat possible est une ligne muette, et c’est ' +
    'encore une ligne juste ». scripts/decisions-nommees.mjs tient la moitié ' +
    '« faute de code », en confrontant les recettes aux actions que le serveur ' +
    'écrit vraiment.',
}

/** Les colonnes `Json` du schéma, avec le modèle qui les porte. */
function chargesDuSchema(): string[] {
  const lignes = readFileSync(join(RACINE, 'server/prisma/schema.prisma'), 'utf8').split('\n')
  const trouvees: string[] = []
  let modele = ''
  for (const ligne of lignes) {
    const m = ligne.match(/^model (\w+) \{/)
    if (m) modele = m[1]!
    /*
      LE TYPE, ET CE QUI PEUT LE SUIVRE.

      La première rédaction exigeait que la ligne FINISSE après `Json?`. Une
      colonne portant un attribut — `@default("{}")`, `@db.JsonB` — lui aurait
      échappé EN SILENCE, et le compte de deux serait resté juste : la colonne
      neuve n'aurait simplement pas existé pour cette garde.

      Trouvé parce que le témoin refusait de rougir : j'avais ajouté la colonne
      d'essai avec un commentaire en fin de ligne, et la règle n'a rien dit.
    */
    const c = ligne.match(/^\s+(\w+)\s+Json\??(\s|$)/)
    if (c && modele) trouvees.push(`${modele}.${c[1]}`)
  }
  return trouvees
}

describe('les charges stockées', () => {
  it('sont toutes couvertes par une garde nommée', () => {
    const manquantes = chargesDuSchema().filter((c) => !(c in COUVERTURES))
    expect(
      manquantes,
      'une colonne `Json` a été ajoutée sans qu’on dise comment le produit la ' +
        'rend quand elle est ANCIENNE. Une charge écrite avant un champ ne se ' +
        'répare jamais : le rendu doit s’en accommoder, et il faut l’écrire ici.',
    ).toEqual([])
  })

  it('ne sont pas couvertes en trop — la table suit le schéma', () => {
    /* L'autre sens : une couverture pour une colonne qui n'existe plus est du
       texte qui donne l'illusion d'une protection. Même raison que la seconde
       plainte de `decisions-nommees`. */
    const dansLeSchema = new Set(chargesDuSchema())
    const orphelines = Object.keys(COUVERTURES).filter((c) => !dansLeSchema.has(c))
    expect(orphelines, 'cette table protège une colonne disparue').toEqual([])
  })

  it('sont DEUX, et le compte est écrit à la main', () => {
    /* GARDE DU GARDE. Si la lecture du schéma cassait — un format changé, une
       indentation —, les deux règles ci-dessus compareraient des listes vides
       et se déclareraient vertes sur un produit sans aucune protection. */
    expect(
      chargesDuSchema().length,
      'la lecture de `schema.prisma` ne trouve plus les colonnes `Json`',
    ).toBe(2)
  })
})
