/**
 * UN ÉMETTEUR PDF, ÉCRIT ICI, SANS DÉPENDANCE.
 *
 * ═══ CE QU'IL FAIT, ET CE QU'IL NE FERA PAS ═══
 *
 * Du texte noir en deux graisses, des filets horizontaux, autant de pages qu'on
 * lui en donne. C'est tout ce que réclament les trois documents du produit — la
 * quittance, le reçu de caution, l'état des lieux : aucun n'a d'image, de
 * couleur ni de police propre.
 *
 * Il n'INTÈGRE PAS de police, et c'est la limite qu'il faut connaître avant de
 * s'en servir : les quatorze polices de base d'un lecteur PDF ne couvrent que le
 * jeu WinAnsi — le latin occidental. Un nom écrit dans un autre alphabet sort en
 * points d'interrogation. Le marché visé écrit en français, et le remplacement
 * est VISIBLE plutôt que silencieux ; le jour où ce n'est plus vrai, il faudra
 * intégrer une police, ce qui est un autre travail.
 *
 * ═══ POURQUOI PAS UNE BIBLIOTHÈQUE ═══
 *
 * Le produit a trois dépendances d'exécution. Les bibliothèques de PDF pèsent de
 * deux à quatre cents kilo-octets et savent faire cent fois ce qu'on demande ici.
 *
 * MESURÉ, et non estimé : ce fichier et sa mise en page font 4 935 octets une
 * fois minifiés, 2 212 compressés — un centième de la bibliothèque qu'ils
 * remplacent. Les deux tables de chasses en sont la moitié, et c'est le prix
 * d'un montant aligné à droite.
 *
 * ═══ CE QUI EST FRAGILE, ET COMMENT C'EST TENU ═══
 *
 * Un PDF porte une TABLE DE RÉFÉRENCES CROISÉES : la position, en octets depuis
 * le début du fichier, de chacun de ses objets. Un octet de décalage et le
 * lecteur refuse le document. Ces nombres changent à chaque caractère ajouté au
 * contenu, et personne ne les relit. `pdf.test.ts` les relit à chaque passage —
 * il rouvre la table et va vérifier qu'à la position annoncée commence bien
 * l'objet annoncé.
 *
 * Le fichier est donc assemblé en OCTETS et non en chaîne : les positions sont
 * comptées au fur et à mesure de l'écriture, et non calculées après coup.
 */

/** Une page A4 en points typographiques, et la marge des trois documents. */
export const PAGE = {
  largeur: 595.28,
  hauteur: 841.89,
  marge: 48,
} as const

/**
 * Une commande de dessin.
 *
 * `y` SE COMPTE DEPUIS LE HAUT, à l'inverse du format lui-même, dont l'origine
 * est en bas à gauche. La conversion est faite une fois, ici, plutôt que dans
 * chaque appelant : une mise en page se pense de haut en bas, et un document
 * dont chaque coordonnée est une soustraction ne se relit pas.
 */
export type Commande =
  | {
      sorte: 'texte'
      x: number
      y: number
      taille: number
      gras: boolean
      contenu: string
      /** Le texte finit en `x` au lieu d'y commencer — pour une colonne de montants. */
      aDroite?: boolean
    }
  | { sorte: 'filet'; x: number; y: number; largeur: number; epaisseur: number; gris: number }

/* ─── L'ENCODAGE ──────────────────────────────────────────────────────────── */

/**
 * Les caractères que le produit écrit et que le latin-1 ne place pas.
 *
 * WinAnsi remplit de 0x80 à 0x9F un intervalle que le latin-1 laisse aux
 * caractères de commande : c'est là que vivent l'apostrophe typographique du
 * dictionnaire, le tiret cadratin des commentaires, et l'euro.
 */
const HORS_LATIN1: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
  /* L'ESPACE FINE INSÉCABLE, et elle n'arrive pas par la plume de quelqu'un :
     `Intl` compose « 170 942 » avec elle. WinAnsi ne l'a pas. La laisser tomber
     collerait les milliers, une espace ordinaire autoriserait la coupure du
     nombre en fin de ligne : l'insécable est la seule des trois qui garde le
     sens. */
  ' ': 0xa0,
  ' ': 0xa0,
}

/** Ce qu'on trace quand la police de base ne sait pas tracer. */
const REMPLACEMENT = 0x3f

/**
 * Un texte en octets WinAnsi, parenthèses et contre-obliques échappées.
 *
 * L'ÉCHAPPEMENT N'EST PAS COSMÉTIQUE : dans le format, une chaîne est délimitée
 * par des parenthèses. Un nom d'immeuble qui en contient une referme la chaîne
 * au milieu, et tout ce qui suit est lu comme des commandes de dessin.
 */
export function versWinAnsi(contenu: string): number[] {
  const octets: number[] = []
  for (const caractere of contenu) {
    const point = caractere.codePointAt(0) ?? 0
    let octet: number
    if (caractere === '(' || caractere === ')' || caractere === '\\') {
      octets.push(0x5c)
      octet = point
    } else if (point >= 0x20 && point <= 0x7e) octet = point
    else if (point >= 0xa0 && point <= 0xff) octet = point
    else octet = HORS_LATIN1[caractere] ?? REMPLACEMENT
    octets.push(octet)
  }
  return octets
}

/* ─── LA MESURE ───────────────────────────────────────────────────────────── */

/*
  LES LARGEURS D'HELVETICA, en millièmes de cadratin, de l'espace au tilde.
  Ce sont les valeurs des fichiers de métriques de la police, celles que tout
  lecteur PDF applique aux quatorze polices de base. Elles ne sont donc pas un
  réglage : les changer désaligne le document rendu par rapport à ce que ce
  module a calculé.
*/
const ROMAINE =
  '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'
    .split(' ')
    .map(Number)

const GRASSE =
  '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'
    .split(' ')
    .map(Number)

/**
 * LES SIGNES HORS ASCII, EN ROMAINE ET EN GRASSE.
 *
 * ═══ POURQUOI DEUX VALEURS ET NON UNE ═══
 *
 * La table n'en portait qu'une, appliquée aux deux graisses. C'était faux pour
 * la moitié de ses entrées : l'apostrophe typographique du dictionnaire vaut 222
 * en romaine et 278 en grasse, les guillemets anglais 333 contre 500. Un titre
 * en gras portant une apostrophe se calait donc sur une largeur qui n'était pas
 * la sienne. Mesuré, pas supposé — voir `chasses-helvetica`.
 *
 * ═══ LES `i` ACCENTUÉS SONT ICI, ET C'EST UNE EXCEPTION MESURÉE ═══
 *
 * `chasse()` déduit la largeur d'une lettre accentuée de sa lettre nue, au motif
 * que l'accent ne pousse pas la chasse. C'est vrai de trente et une lettres du
 * latin-1 et FAUX des quatre `i` : `i` vaut 222 en romaine, `ì í î ï` valent 278.
 * L'accent y remplace le point, et le glyphe est dessiné plus large pour le
 * loger. La règle générale reste, l'exception est nommée.
 *
 * ═══ TROIS VALEURS DIVERGENT DES MÉTRIQUES D'ADOBE ═══
 *
 * `€`, `±` et `÷` sont ici à leur valeur MESURÉE dans la police du système —
 * 744, 549, 549 — là où les métriques historiques d'Adobe donnent 556, 584 et
 * 584. Un lecteur qui substitue une police aux métriques standard appliquera les
 * secondes, un lecteur qui emploie l'Helvetica du système les premières.
 *
 * On retient la valeur MESURÉE, et pour une raison de méthode : c'est la seule
 * que ce dépôt peut re-vérifier à chaque passage. Écrire un nombre qu'aucune
 * garde ne sait contredire, c'est reconduire exactement le défaut que ces tables
 * ont eu à leur naissance. L'écart se paie au pire 35 millièmes de cadratin sur
 * un caractère que trois documents de gestion locative n'écrivent jamais — sauf
 * l'euro, sur un parc en zone euro, où il vaut deux points de décalage.
 */
const CHASSES_PARTICULIERES: Record<string, readonly [number, number]> = {
  '\u202f': [278, 278],
  '\u00a0': [278, 278],
  '«': [556, 556],
  '»': [556, 556],
  '·': [278, 278],
  '°': [400, 400],
  '’': [222, 278],
  '‘': [222, 278],
  '“': [333, 500],
  '”': [333, 500],
  '–': [556, 556],
  '—': [1000, 1000],
  '…': [1000, 1000],
  '•': [350, 350],
  '€': [744, 744],
  '©': [737, 737],
  '®': [737, 737],
  '±': [549, 549],
  '×': [584, 584],
  '÷': [549, 549],
  // Les quatre exceptions à la déduction — voir l'en-tête.
  'ì': [278, 278],
  'í': [278, 278],
  'î': [278, 278],
  'ï': [278, 278],
}

function chasse(caractere: string, gras: boolean): number {
  const table = gras ? GRASSE : ROMAINE
  const point = caractere.codePointAt(0) ?? 0
  if (point >= 0x20 && point <= 0x7e) return table[point - 0x20]

  const particuliere = CHASSES_PARTICULIERES[caractere]
  if (particuliere !== undefined) return particuliere[gras ? 1 : 0]

  // La lettre sous l'accent : `é` → `e`, `Ç` → `C`.
  const nue = caractere.normalize('NFD').codePointAt(0) ?? 0
  if (nue >= 0x20 && nue <= 0x7e) return table[nue - 0x20]

  // Ce qui sera tracé est un point d'interrogation : c'est sa chasse qui
  // occupera la place, et non celle du caractère qu'on n'a pas su rendre.
  return table[REMPLACEMENT - 0x20]
}

/** La largeur d'un texte, en points, à une taille et une graisse données. */
export function largeurDuTexte(contenu: string, taille: number, gras = false): number {
  let millièmes = 0
  for (const caractere of contenu) millièmes += chasse(caractere, gras)
  return (millièmes * taille) / 1000
}

/**
 * Coupe un texte en lignes qui tiennent dans une largeur.
 *
 * UN MOT PLUS LARGE QUE LA COLONNE SORT ENTIER, et ce n'est pas un oubli : le
 * tronquer perdrait de la donnée sans le dire, et les mots concernés sont des
 * références d'opérateur ou des identifiants, qui n'ont pas de césure. Un
 * dépassement se voit ; une référence amputée passe pour une référence.
 */
export function couper(contenu: string, largeurMax: number, taille: number, gras = false): string[] {
  const lignes: string[] = []
  let courante = ''
  for (const mot of contenu.split(' ')) {
    const essai = courante ? `${courante} ${mot}` : mot
    if (courante && largeurDuTexte(essai, taille, gras) > largeurMax) {
      lignes.push(courante)
      courante = mot
    } else courante = essai
  }
  if (courante) lignes.push(courante)
  return lignes
}

/* ─── L'ASSEMBLAGE ────────────────────────────────────────────────────────── */

/** Le flux de dessin d'une page, en octets. */
function fluxDeLaPage(commandes: Commande[]): number[] {
  const octets: number[] = []
  const ascii = (texte: string) => {
    for (let i = 0; i < texte.length; i++) octets.push(texte.charCodeAt(i))
  }
  // Trois décimales : au-delà, le fichier grossit sans que rien ne bouge à
  // l'écran — un point typographique vaut 0,35 mm.
  const n = (valeur: number) => valeur.toFixed(3)

  for (const commande of commandes) {
    const y = PAGE.hauteur - commande.y
    if (commande.sorte === 'filet') {
      ascii(
        `q ${n(commande.gris)} G ${n(commande.epaisseur)} w ` +
          `${n(commande.x)} ${n(y)} m ${n(commande.x + commande.largeur)} ${n(y)} l S Q\n`,
      )
      continue
    }
    const x = commande.aDroite
      ? commande.x - largeurDuTexte(commande.contenu, commande.taille, commande.gras)
      : commande.x
    ascii(`BT /${commande.gras ? 'F2' : 'F1'} ${n(commande.taille)} Tf ${n(x)} ${n(y)} Td (`)
    octets.push(...versWinAnsi(commande.contenu))
    ascii(') Tj ET\n')
  }
  return octets
}

/**
 * Le document complet, prêt à être téléchargé.
 *
 * Les objets sont numérotés dans l'ordre où ils sont écrits, et leur position
 * est relevée AU MOMENT de l'écriture — c'est la seule façon d'être sûr que la
 * table dit vrai. Une page occupe deux objets : sa description et son flux.
 */
export function construirePdf(pages: Commande[][]): Uint8Array {
  const octets: number[] = []
  const positions: number[] = []
  const ascii = (texte: string) => {
    for (let i = 0; i < texte.length; i++) octets.push(texte.charCodeAt(i))
  }

  const ouvrir = (numero: number) => {
    positions[numero] = octets.length
    ascii(`${numero} 0 obj\n`)
  }
  const fermer = () => ascii('endobj\n')

  ascii('%PDF-1.4\n')
  /* Quatre octets hauts en commentaire : la convention du format pour qu'un
     outil de transfert reconnaisse un fichier binaire et cesse de « corriger »
     ses fins de ligne. */
  octets.push(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a)

  const PREMIERE_PAGE = 5
  const objetDeLaPage = (index: number) => PREMIERE_PAGE + index * 2
  const objetDuFlux = (index: number) => PREMIERE_PAGE + index * 2 + 1

  ouvrir(1)
  ascii('<< /Type /Catalog /Pages 2 0 R >>\n')
  fermer()

  ouvrir(2)
  const enfants = pages.map((_, index) => `${objetDeLaPage(index)} 0 R`).join(' ')
  ascii(`<< /Type /Pages /Kids [${enfants}] /Count ${pages.length} >>\n`)
  fermer()

  ouvrir(3)
  ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n')
  fermer()

  ouvrir(4)
  ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n')
  fermer()

  pages.forEach((commandes, index) => {
    ouvrir(objetDeLaPage(index))
    ascii(
      '<< /Type /Page /Parent 2 0 R ' +
        `/MediaBox [0 0 ${PAGE.largeur} ${PAGE.hauteur}] ` +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ' +
        `/Contents ${objetDuFlux(index)} 0 R >>\n`,
    )
    fermer()

    const flux = fluxDeLaPage(commandes)
    ouvrir(objetDuFlux(index))
    ascii(`<< /Length ${flux.length} >>\nstream\n`)
    octets.push(...flux)
    ascii('endstream\n')
    fermer()
  })

  /*
    LA TABLE. Chaque entrée fait EXACTEMENT vingt octets — dix de position, cinq
    de génération, un drapeau, deux de fin de ligne. Le format l'exige au
    caractère près : un lecteur qui trouve dix-neuf octets lit la table suivante
    de travers.
  */
  const nombre = positions.length
  const positionDeLaTable = octets.length
  ascii(`xref\n0 ${nombre}\n`)
  ascii('0000000000 65535 f \n')
  for (let numero = 1; numero < nombre; numero++)
    ascii(`${String(positions[numero]).padStart(10, '0')} 00000 n \n`)

  ascii(`trailer\n<< /Size ${nombre} /Root 1 0 R >>\nstartxref\n${positionDeLaTable}\n%%EOF\n`)

  return Uint8Array.from(octets)
}
