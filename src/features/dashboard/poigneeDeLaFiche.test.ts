import { describe, expect, it } from 'vitest'

/**
 * CE QUE LA FICHE DE LOGEMENT ANNONCE DE CE QU'ON PEUT EN FAIRE.
 *
 * ═══ DEUX DÉFAUTS OPPOSÉS, ET C'EST LE MÊME SUJET ═══
 *
 * La fiche PROMETTAIT un geste qui n'était pas le sien et TAISAIT celui qui
 * l'était :
 *
 *   · son numéro se soulignait au survol, donc désignait une cible de la taille
 *     du mot « A1 » — alors que la zone de frappe couvre la fiche ENTIÈRE, par
 *     un pseudo-élément. Le soulignement montrait la plus petite des deux ;
 *   · on peut attraper une fiche et la déplacer parmi les autres depuis le lot
 *     du rail réordonnable, et RIEN ne le disait. Nelson l'a rapporté dans ces
 *     termes : « je ne vois pas l'action de porter déposer ».
 *
 * ═══ POURQUOI DES ASSERTIONS SUR LA SOURCE ═══
 *
 * Les trois propriétés gardées ici sont des CLASSES, et jsdom ne charge aucune
 * feuille de style : `getComputedStyle` y rend « none » pour un survol qui
 * n'existe pas et « static » pour une position que Tailwind n'a pas écrite. Les
 * mesurer au rendu donnerait des verts qui ne parlent de rien. La source, elle,
 * dit exactement ce que le navigateur recevra — c'est l'idiome que
 * `manuelSansLienMort` emploie déjà pour lire le routeur.
 */

const SOURCES = import.meta.glob('/src/features/dashboard/Portfolio.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const PORTFOLIO = SOURCES['/src/features/dashboard/Portfolio.tsx'] ?? ''

/* La table est lue elle aussi : le cas du soulignement s'appuie sur une
   propriété de SON fichier, et une prémisse qu'on ne lit pas est une prémisse
   qu'on suppose. */
const TABLE = import.meta.glob('/src/components/primitives/DataTable.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * LE BLOC `cn(...)` ENTIER du lien qui porte le numéro — et non son premier
 * fragment. Premier jet : `/'numeric title-m inline-flex[^']*'/`, qui s'arrêtait
 * au guillemet fermant du PREMIER argument. La cible étendue vit dans le second
 * (`'after:absolute after:inset-0 …'`), et le cas qui la réclame rougissait sur
 * une source pourtant juste. Attrapé par la garde elle-même, pas par relecture.
 */
const CLASSES_DU_NUMERO =
  /'numeric title-m inline-flex[\s\S]*?after:rounded-lg'/.exec(PORTFOLIO)?.[0] ?? ''

describe('la fiche de logement', () => {
  it('a bien été lue — sinon tout ce qui suit est vide de sens', () => {
    expect(PORTFOLIO.length).toBeGreaterThan(1000)
    expect(CLASSES_DU_NUMERO, 'le lien du numéro est introuvable').not.toBe('')
  })

  /**
   * LE NUMÉRO NE SE SOULIGNE PLUS.
   *
   * Il ne s'agit pas de goût : le pseudo-élément `after:inset-0` fait du lien
   * une cible de la taille de la fiche, et la fiche s'éclaire déjà au survol —
   * bordure et ombre. Souligner en plus désigne une cible de vingt pixels là où
   * la vraie en fait deux cent quatre-vingts.
   */
  it('ne souligne pas son numéro, dont la cible est la fiche entière', () => {
    expect(CLASSES_DU_NUMERO).not.toMatch(/\bunderline\b/)
    /* La contrepartie, et elle doit rester vraie : si le pseudo-élément
       disparaissait, le soulignement redeviendrait juste et ce cas deviendrait
       un piège. On garde donc les deux ensemble. */
    expect(CLASSES_DU_NUMERO, 'sans cible étendue, le soulignement se justifierait').toMatch(
      /after:inset-0/,
    )
  })

  /**
   * ET LE TABLEAU, LUI, DOIT CONTINUER DE SOULIGNER.
   *
   * ═══ LE DÉFAUT QUE CE CAS EMPÊCHE N'EXISTE PAS ENCORE ═══
   *
   * Les deux liens se ressemblent au `grep` — même numéro de logement, même
   * `after:inset-0`. Le cas précédent exige que la FICHE ne souligne pas ;
   * sans celui-ci, le premier qui cherchera `hover:underline` pour
   * « harmoniser » retirera aussi celui du tableau, et la porte le félicitera.
   *
   * Or `DataTable` ne porte AUCUN `hover` — zéro occurrence, vérifié le
   * 2026-10-08 — et la rangée n'est pas cliquable, par une décision écrite dans
   * `Portfolio.tsx`. Le soulignement y est donc la SEULE affordance du lien :
   * le retirer rendrait « A3 » indistinguable d'un texte ordinaire.
   *
   * ═══ LA PRÉMISSE EST GARDÉE AVEC LA CONCLUSION ═══
   *
   * Ce cas ne vaut que tant que la rangée reste inerte. Le jour où `DataTable`
   * gagnera un survol, le soulignement redeviendra redondant et ce cas devra
   * tomber — il vérifie donc AUSSI l'absence de `hover`, pour que la prémisse
   * rougisse en même temps que la règle qu'elle soutient.
   */
  it('garde le soulignement dans le TABLEAU, où rien d’autre ne le dit', () => {
    /* GUILLEMETS DOUBLES : ce `className` est une chaîne littérale, pas un
       `cn(...)` comme celui de la fiche. Premier jet avec des apostrophes — il
       ne trouvait rien, et le cas rougissait sur une source pourtant juste. */
    const lienDuTableau = /"numeric font-medium text-ink[^"]*"/.exec(PORTFOLIO)?.[0] ?? ''
    expect(lienDuTableau, 'le lien du tableau est introuvable').not.toBe('')
    expect(lienDuTableau, 'le tableau deviendrait muet').toMatch(/hover:underline/)

    const DATA_TABLE = TABLE['/src/components/primitives/DataTable.tsx'] ?? ''
    expect(DATA_TABLE.length).toBeGreaterThan(1000)
    expect(
      DATA_TABLE.includes('hover:'),
      'la rangée s’éclaire désormais : le soulignement redevient redondant, et ce cas doit être revu',
    ).toBe(false)
  })

  /**
   * LA POIGNÉE EST DÉCORATIVE, ET DOIT LE RESTER.
   *
   * La prise se fait sur TOUTE la fiche ; la poignée ne fait que le dire. Lui
   * donner des événements de pointeur rétrécirait une cible qui marche, et la
   * rendre focalisable annoncerait à l'AT un second chemin vers un geste qui a
   * déjà le sien — « Déplacer ‹ › » dans le menu de débordement.
   */
  it('porte une poignée décorative, sans événements ni nom accessible', () => {
    const poignee = /<span\s+aria-hidden="true"[\s\S]{0,900}?<Icon name="grip"/.exec(PORTFOLIO)
    expect(poignee, 'aucune poignée `grip` sous un span `aria-hidden`').not.toBeNull()
    expect(poignee![0]).toMatch(/pointer-events-none/)
  })

  /**
   * LE GROUPE EST NOMMÉ, ET C'EST LA GARDE QUI COMPTE LE PLUS ICI.
   *
   * La fiche vit dans un rail qui est lui-même un groupe. Avec deux `group`
   * ANONYMES, `group-hover:` remonte au plus proche ancêtre marqué — le rail —
   * et survoler n'importe où allumerait les DOUZE poignées à la fois. Le défaut
   * est invisible en jsdom et ne se verrait qu'à l'œil, sur un écran peuplé.
   */
  it('révèle la poignée par un groupe NOMMÉ, jamais par un groupe anonyme', () => {
    expect(PORTFOLIO, 'la fiche ne nomme pas son groupe').toMatch(/group\/fiche/)
    expect(PORTFOLIO).toMatch(/group-hover\/fiche:opacity-100/)
    expect(PORTFOLIO).toMatch(/group-focus-within\/fiche:opacity-100/)
    /* Et l'anonyme est refusé là où il ferait le dégât : sur la révélation. */
    expect(PORTFOLIO, 'un `group-hover:` anonyme allumerait les douze').not.toMatch(
      /[^/]group-hover:opacity-100/,
    )
  })
})
