import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * UNE COLONNE AJOUTÉE AFFIRME QUELQUE CHOSE SUR LE PASSÉ.
 *
 * ═══ CE QUE PERSONNE NE REGARDE ═══
 *
 * `ADD COLUMN … NOT NULL DEFAULT x` n'est pas une commodité de syntaxe : c'est
 * une PHRASE écrite dans toutes les lignes déjà en base, sans que personne
 * l'ait relue. `origin DEFAULT 'tenantReport'` a déclaré que toute intervention
 * antérieure venait d'un locataire. `amountsAreMinor DEFAULT true` a déclaré
 * que tout parc antérieur stockait des unités mineures — faux d'un centime
 * facteur cent, si ce n'était pas le cas.
 *
 * Et `ADD COLUMN` sans défaut laisse un `NULL` dont le sens est DOUBLE : « sans
 * objet » et « écrit avant que cette colonne n'existe » s'écrivent pareil, et
 * rien ne les distingue plus jamais.
 *
 * Les seize portes ne peuvent pas le voir : elles construisent leurs données à
 * chaque passage, avec le schéma du jour. Une affirmation fausse sur le passé
 * ne se manifeste que sur une base qui a un passé.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Il ne relit pas les données — il n'y en a pas ici. Il exige que CHAQUE colonne
 * ajoutée dise ce qu'elle a affirmé, et que l'affirmation ait été VÉRIFIÉE
 * plutôt que supposée. La liste vient des MIGRATIONS ; seules les phrases sont
 * écrites à la main.
 *
 * ═══ CE QU'IL A TROUVÉ EN NAISSANT ═══
 *
 * Sur treize colonnes ajoutées, dix portent un défaut et trois laissent un `NULL`.
 * Sept des huit défauts étaient justifiés dans leur propre migration — ce dépôt
 * le faisait déjà. `waterMinor` et `powerMinor` ne l'étaient PAS : leur
 * migration explique la ventilation et ne dit rien des lignes existantes. Elle a
 * tourné dix heures après le socle, avant le premier membre du premier parc, si
 * bien que le zéro était vrai — par accident de calendrier, et non par une
 * vérification. C'est exactement ce que ce fichier existe pour ne plus laisser
 * passer.
 */
const RACINE = join(import.meta.dirname, '../..')

/**
 * Ce que chaque colonne ajoutée a affirmé des lignes d'avant.
 *
 * Écrit à la main délibérément : c'est la seule chose qu'une machine ne peut pas
 * dériver. Ajouter une colonne sans venir écrire ici ce qu'elle affirme fait
 * rougir la règle du dessous, avec son nom.
 */
const AFFIRMATIONS: Record<string, string> = {
  'RentCharge.waterMinor':
    'Zéro eau refacturée sur toute échéance antérieure. VRAI, et vérifié après ' +
    'coup : la refacturation par fluide n’existait pas avant cette migration, ' +
    'qui a tourné dix heures après le socle — aucun parc n’avait encore de ' +
    'membre. La migration ne le disait pas ; ce défaut n’était sûr que par ' +
    'accident de calendrier.',
  'RentCharge.powerMinor': 'Même affirmation et même vérification que `waterMinor`.',
  'WorkOrder.origin':
    'Toute intervention antérieure vient d’un signalement de locataire. VÉRIFIÉ, ' +
    'et écrit dans la migration elle-même : « c’est la vérité des lignes déjà en ' +
    'base, dont aucune ne peut avoir une autre origine » — le bailleur n’avait ' +
    'aucun chemin pour en ouvrir une.',
  'WorkOrder.reportedById':
    'NULL, et son sens est DOUBLE : « ouverte par un locataire, pas par un ' +
    'compte du bailleur » et « ouverte avant que cette colonne n’existe ». Le ' +
    'produit ne les distingue pas et n’a pas à le faire — `origin` porte la ' +
    'distinction qui compte, et l’écran aplatit les deux relations en un nom.',
  'Session.persistent':
    'Toute session déjà ouverte est retenue. Écrit dans la migration : ' +
    '« additive et rétrocompatible ». Le prix est nommé — une session qu’on ' +
    'avait choisi de ne pas retenir le devient — et il expire avec elle.',
  'Park.amountsAreMinor':
    'Tout parc antérieur stocke des unités mineures. La migration porte une ' +
    'section entière sur les lignes existantes et ne convertit que les devises à ' +
    'décimales ; `XAF` et `XOF` n’en ont pas, et leurs lignes ne bougent pas.',
  'Park.leaseAccessMonths':
    'Trois mois pour tout parc antérieur : c’est la valeur que la constante du ' +
    'code imposait à tous avant d’être réglable. Aucun parc ne change de ' +
    'comportement.',
  'UserAccount.threadEmailOptIn':
    'Tout compte antérieur reçoit les copies. Un défaut à faux aurait coupé tout ' +
    'le monde à la seconde du déploiement, alors que ces copies partaient déjà.',
  'MembershipUnit.exclue':
    'Toute ligne antérieure est un logement CONFIÉ, jamais exclu — l’exclusion ' +
    'n’existait pas. Aucun périmètre en place ne change de sens.',
  'UserAccount.threadEmailDigest':
    'Aucun compte antérieur ne groupe ses copies — et c’est ce qu’ils vivaient : ' +
    'ils les recevaient une à une. Un défaut à vrai aurait imposé un résumé à ' +
    'tout le monde, alors que l’écran du locataire promet que son signalement ' +
    'est reçu IMMÉDIATEMENT.',
  'UserAccount.lastThreadDigestAt':
    'NULL affirme qu’aucun résumé n’est jamais parti, ce qui est VRAI : la ' +
    'fonctionnalité n’existait pas. Le premier résumé d’un compte prendra donc ' +
    'tout ce qu’il a reçu — borne assumée, et sans surprise puisqu’il faut avoir ' +
    'coché le réglage pour en recevoir un.',
  'Membership.scope':
    'Toute adhésion antérieure gère TOUT LE PARC, et c’est exactement ce qu’elle ' +
    'vivait : « vide vaut tout le parc » était la règle, écrite au schéma. Aucune ' +
    'ne change de vue — aveugler les gestionnaires en place était précisément ce ' +
    'que la règle d’origine refusait, et ce refus reste juste. Les adhésions qui ' +
    'NAISSENT sont `declared`, où une liste vide veut dire vide.',
  'WorkThreadEmail.notificationId':
    'NULL, et son sens est DOUBLE : « le signalement, qui EST le fil » et ' +
    '« écrit avant cette colonne ». Assumé et écrit dans la migration : le ' +
    'compteur du CHANTIER reste en place et garde son compte global, qui reste ' +
    'juste pour ces lignes-là.',
}

/** Les colonnes qu'une migration ajoute à une table existante. */
function colonnesAjoutees(): string[] {
  const dossier = join(RACINE, 'server/prisma/migrations')
  const trouvees: string[] = []
  for (const nom of readdirSync(dossier).sort()) {
    let sql: string
    try {
      sql = readFileSync(join(dossier, nom, 'migration.sql'), 'utf8')
    } catch {
      continue
    }
    /* `ALTER TABLE "X" ADD COLUMN "y"` sur une ligne, ou l'`ALTER` sur une ligne
       et ses `ADD COLUMN` sur les suivantes — les deux formes existent. */
    let table = ''
    for (const ligne of sql.split('\n')) {
      const t = ligne.match(/ALTER TABLE "(\w+)"/)
      if (t) table = t[1]!
      const c = ligne.match(/ADD COLUMN "(\w+)"/)
      if (c && table) trouvees.push(`${table}.${c[1]}`)
    }
  }
  return trouvees
}

describe('les colonnes ajoutées', () => {
  it('disent toutes ce qu’elles ont affirmé des lignes d’avant', () => {
    const muettes = colonnesAjoutees().filter((c) => !(c in AFFIRMATIONS))
    expect(
      muettes,
      'une colonne a été ajoutée sans qu’on dise ce que son défaut — ou son NULL — ' +
        'affirme des lignes DÉJÀ en base. Ce n’est pas une formalité : un défaut ' +
        'est une phrase écrite dans toutes ces lignes, et personne ne la relit.',
    ).toEqual([])
  })

  it('ne sont pas déclarées en trop', () => {
    /* Une affirmation pour une colonne jamais ajoutée est du texte qui donne
       l'illusion d'une relecture. */
    const reelles = new Set(colonnesAjoutees())
    expect(
      Object.keys(AFFIRMATIONS).filter((c) => !reelles.has(c)),
      'cette table déclare une colonne qu’aucune migration n’ajoute',
    ).toEqual([])
  })

  it('sont TREIZE, et le compte est écrit à la main', () => {
    /* GARDE DU GARDE. Si la lecture des migrations cassait, les deux règles
       ci-dessus compareraient des listes vides et se déclareraient vertes sur un
       schéma dont personne n’aurait relu les affirmations. */
    expect(
      colonnesAjoutees().length,
      'la lecture des migrations ne trouve plus les `ADD COLUMN`',
    ).toBe(13)
  })
})
