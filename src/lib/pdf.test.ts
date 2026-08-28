import { describe, expect, it } from 'vitest'
import { PAGE, construirePdf, couper, largeurDuTexte, versWinAnsi, type Commande } from './pdf'

/**
 * L'ÉMETTEUR PDF, ÉCRIT À LA MAIN, ET CE QUI DOIT ÊTRE VRAI DE SES OCTETS.
 *
 * ═══ POURQUOI SANS BIBLIOTHÈQUE ═══
 *
 * Le produit a TROIS dépendances d'exécution. Une bibliothèque de PDF en pèse
 * deux à quatre cents kilo-octets pour ce qu'on lui demande ici : du texte noir,
 * des filets, deux graisses. Les documents visés — quittance, reçu de caution,
 * état des lieux — n'ont ni image, ni police propre, ni couleur.
 *
 * Ce qu'on y perd est réel et se dit : les polices de base d'un lecteur PDF ne
 * couvrent que le jeu WinAnsi, c'est-à-dire le latin occidental. Un nom écrit
 * dans un autre alphabet ne SORTIRA PAS de ce module tel qu'il est entré, et le
 * cas ci-dessous fixe ce qui lui arrive plutôt que de laisser la question
 * ouverte.
 *
 * ═══ CE QUE CE FICHIER GARDE, ET POURQUOI C'EST CELA ═══
 *
 * Un PDF n'est pas un format texte : il porte une TABLE DE RÉFÉRENCES CROISÉES
 * qui donne, pour chaque objet, sa position en octets depuis le début du
 * fichier. Une seule position fausse et le lecteur refuse le document en bloc —
 * ou pire, l'ouvre en en perdant une page. Aucun œil ne relit ces nombres, et
 * ils changent à chaque caractère ajouté au contenu.
 *
 * La règle centrale est donc mécanique : on relit la table, et on vérifie qu'à
 * chaque position annoncée commence bien l'objet annoncé. C'est la seule chose
 * qu'un test peut faire à la place du lecteur PDF, et c'est exactement ce qui
 * casse en silence.
 */

/** Un document minimal mais réaliste : deux pages, du texte, un filet. */
function documentDEssai(): Commande[][] {
  const page = (titre: string): Commande[] => [
    { sorte: 'texte', x: PAGE.marge, y: 60, taille: 16, gras: true, contenu: titre },
    { sorte: 'filet', x: PAGE.marge, y: 80, largeur: 200, epaisseur: 0.8, gris: 0.7 },
    { sorte: 'texte', x: PAGE.marge, y: 100, taille: 10, gras: false, contenu: 'Août 2026' },
  ]
  return [page('Quittance'), page('Reçu')]
}

/** Le fichier en latin-1 : chaque octet vaut un caractère, comme dans le PDF. */
function enTexte(octets: Uint8Array): string {
  return Array.from(octets, (o) => String.fromCharCode(o)).join('')
}

describe('l’émetteur PDF', () => {
  const octets = construirePdf(documentDEssai())
  const texte = enTexte(octets)

  it('produit un fichier que sa signature annonce', () => {
    expect(texte.startsWith('%PDF-1.4')).toBe(true)
    expect(texte.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('annonce autant de pages qu’on lui en a données', () => {
    expect(texte).toMatch(/\/Type\s*\/Pages[^>]*\/Count 2/)
  })

  /**
   * LA RÈGLE QUI COMPTE. On relit la table de références croisées et on va
   * voir, à chaque position annoncée, si l'objet qui s'y trouve porte bien le
   * numéro attendu. Un décalage d'un seul octet — une ligne de contenu plus
   * longue, une fin de ligne de plus — le fait rougir.
   */
  it('pointe chaque objet là où sa table le promet', () => {
    /* La table est le mot SEUL sur sa ligne. Chercher « xref » sans plus
       trouve d'abord `startxref`, qui le contient — la première rédaction de ce
       cas lisait donc la position de la table à la place de la table. */
    const debutTable = texte.lastIndexOf('\nxref\n') + 1
    expect(debutTable, 'aucune table de références croisées').toBeGreaterThan(0)

    const lignes = texte.slice(debutTable).split('\n')
    // « xref », puis « 0 N », puis N entrées de 20 octets.
    const [premier, nombre] = lignes[1].split(' ').map(Number)
    expect(premier).toBe(0)
    expect(nombre, 'table vide').toBeGreaterThan(4)

    for (let objet = 1; objet < nombre; objet++) {
      const entree = lignes[1 + objet + 1] ?? ''
      const position = Number(entree.slice(0, 10))
      expect(Number.isFinite(position), `entrée illisible pour l’objet ${objet}`).toBe(true)
      expect(
        texte.slice(position, position + 12),
        `l’objet ${objet} n’est pas à la position annoncée`,
      ).toMatch(new RegExp(`^${objet} 0 obj`))
    }
  })

  it('porte le texte qu’on lui a confié', () => {
    expect(texte).toContain('(Quittance)')
    expect(texte).toContain('(Re\xE7u)')
  })
})

/**
 * L'ENCODAGE, ET CE QU'IL FAUT QU'IL FASSE DES CARACTÈRES DU PRODUIT.
 *
 * Trois d'entre eux arrivent par des chemins que personne ne choisit :
 * l'apostrophe typographique vient du dictionnaire, l'espace fine insécable
 * vient d'`Intl` qui compose les milliers avec elle, et les parenthèses
 * délimitent les chaînes DANS le format — non échappées, elles referment la
 * chaîne au milieu d'un nom et le fichier devient illisible.
 */
describe('l’encodage WinAnsi', () => {
  it('rend les accents du français sur un octet', () => {
    expect(versWinAnsi('é')).toEqual([0xe9])
    expect(versWinAnsi('À')).toEqual([0xc0])
    expect(versWinAnsi('ç')).toEqual([0xe7])
  })

  it('place les caractères typographiques du dictionnaire', () => {
    // L'apostrophe du produit — « d’un », partout dans les traductions.
    expect(versWinAnsi('’')).toEqual([0x92])
    expect(versWinAnsi('—')).toEqual([0x97])
    expect(versWinAnsi('€')).toEqual([0x80])
  })

  it('ramène l’espace fine des milliers à une espace insécable', () => {
    // `Intl` compose « 170 942 » avec U+202F, absente de WinAnsi. La laisser
    // tomber collerait les milliers ; une espace ordinaire couperait le nombre
    // en fin de ligne.
    //
    // Écrites en points de code, parce qu'à l'oeil ces trois espaces sont la
    // même — et qu'un test qu'on ne peut pas relire ne garde rien.
    expect(versWinAnsi('\u202F'), 'espace fine insécable').toEqual([0xa0])
    expect(versWinAnsi('\u00A0'), 'espace insécable').toEqual([0xa0])
    expect(versWinAnsi('\u0020'), 'espace ordinaire').toEqual([0x20])
  })

  it('échappe ce qui refermerait la chaîne', () => {
    expect(versWinAnsi('(a)')).toEqual([0x5c, 0x28, 0x61, 0x5c, 0x29])
    expect(versWinAnsi('a\\b')).toEqual([0x61, 0x5c, 0x5c, 0x62])
  })

  it('remplace ce qu’aucune police de base ne sait tracer', () => {
    // Le remplacement est VISIBLE et non silencieux : un nom qui perd ses
    // lettres doit se voir sur le document, pas se deviner.
    expect(versWinAnsi('日')).toEqual([0x3f])
  })
})

/**
 * LA MESURE DU TEXTE.
 *
 * Elle sert à deux choses qu'un document ne peut pas se permettre de rater :
 * aligner les montants à droite d'une colonne, et couper une réserve trop
 * longue avant qu'elle ne sorte de la page. Les largeurs sont celles des
 * fichiers de métriques d'Helvetica, en millièmes de cadratin.
 */
describe('la mesure du texte', () => {
  it('rend les largeurs d’Helvetica', () => {
    // 'A' vaut 667 millièmes en romaine, 722 en grasse : à 10 points, 6,67 et
    // 7,22. Deux valeurs de la table d'origine, prises comme témoins.
    expect(largeurDuTexte('A', 10)).toBeCloseTo(6.67, 2)
    expect(largeurDuTexte('A', 10, true)).toBeCloseTo(7.22, 2)
    expect(largeurDuTexte(' ', 10)).toBeCloseTo(2.78, 2)
  })

  it('donne à une lettre accentuée la largeur de sa lettre', () => {
    // Vrai d'Helvetica : l'accent ne pousse pas la chasse.
    expect(largeurDuTexte('é', 10)).toBeCloseTo(largeurDuTexte('e', 10), 4)
    expect(largeurDuTexte('À', 12, true)).toBeCloseTo(largeurDuTexte('A', 12, true), 4)
  })

  it('croît avec la taille et avec le nombre de lettres', () => {
    expect(largeurDuTexte('AA', 10)).toBeCloseTo(2 * largeurDuTexte('A', 10), 4)
    expect(largeurDuTexte('A', 20)).toBeCloseTo(2 * largeurDuTexte('A', 10), 4)
  })

  it('coupe un texte long sans dépasser la largeur donnée', () => {
    const phrase =
      'Trace d’humidité au plafond de la chambre, peinture cloquée sur environ un mètre carré.'
    const lignes = couper(phrase, 180, 10)

    expect(lignes.length, 'la phrase n’a pas été coupée').toBeGreaterThan(1)
    for (const ligne of lignes) expect(largeurDuTexte(ligne, 10)).toBeLessThanOrEqual(180)
    // Rien ne se perd à la coupe : les mots sont tous là, dans l'ordre.
    expect(lignes.join(' ')).toBe(phrase)
  })

  it('n’efface pas un mot plus large que la colonne', () => {
    // Un mot seul qui dépasse est rendu tel quel : le tronquer perdrait de la
    // donnée sans le dire, et une référence d'opérateur n'a pas de césure.
    const lignes = couper('MM-4471-0000000000000000000', 40, 10)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toBe('MM-4471-0000000000000000000')
  })
})
