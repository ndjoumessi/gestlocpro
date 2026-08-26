/**
 * TRANSCODAGE D'UNE PHOTO AVANT L'ENVOI — le navigateur allège, pas le serveur.
 *
 * Séparé pour la même raison que `lib/download` : ceci touche au DOM et
 * n'existe pas sous Node. jsdom n'a ni `createImageBitmap`, ni `canvas.toBlob`,
 * et les simuler ne mesurerait que la simulation. La garde de ce module tourne
 * donc dans un vrai navigateur — `scripts/photo-transcodage.mjs`, dans
 * `npm run check` — contre la fixture versionnée.
 *
 * POURQUOI TRANSCODER, ET AVANT PLUTÔT QU'APRÈS. Une photo de téléphone pèse
 * quelques mégaoctets ; un état des lieux en porte plusieurs par pièce, et il
 * se fait dans un logement vide, souvent en sous-sol, sur une barre de réseau.
 * Ce qui n'est pas transcodé AVANT l'envoi est payé deux fois : en temps de
 * montée pour celui qui attend sur place, et au gigaoctet-mois ensuite. Le
 * serveur ne peut pas le faire — il ne voit jamais passer les octets, c'est
 * tout le sens de l'envoi présigné.
 */

/**
 * LA CIBLE, ET D'OÙ ELLE VIENT.
 *
 * 1600 px de hauteur et qualité 0,82 sortent du relevé de
 * `scripts/mesure-compression-photo.mjs` sur deux photographies CC0. Le
 * PLANCHER DE LISIBILITÉ mesuré est à 1280 px : en dessous, l'index d'un
 * compteur cesse d'être lisible. 1600 laisse une marche entière au-dessus.
 *
 * Le 0,82 n'est PAS une conclusion de mesure, et il faut le lire comme tel : à
 * hauteur égale, q0,70 se lisait aussi bien sur les deux sujets. C'est une
 * PRUDENCE NON MESURÉE contre les cas que le relevé n'a pas pu couvrir — la
 * microfissure, l'auréole d'humidité, la scène sombre et bruitée. Le jour où
 * on les mesure, ce chiffre baisse et ce paragraphe disparaît.
 */
export const HAUTEUR_CIBLE_PX = 1600

/**
 * Le plancher en dessous duquel la cible ne doit jamais descendre.
 *
 * Il n'est pas employé par le transcodage lui-même : il est là pour que la
 * garde puisse dire, quand quelqu'un baissera `HAUTEUR_CIBLE_PX`, POURQUOI
 * c'est refusé — et non « valeur inattendue ».
 */
export const PLANCHER_DE_LISIBILITE_PX = 1280

export const QUALITE_JPEG = 0.82

/**
 * JPEG, et pas WebP, alors que le dépôt accepte les deux.
 *
 * Le relevé qui a tranché le plafond a été fait en JPEG. Sortir du WebP
 * produirait des poids que personne n'a pesés, sous un plafond arbitré sur
 * d'autres octets — l'arbitrage cesserait de porter sur ce qu'on envoie.
 */
export const TYPE_SORTIE = 'image/jpeg' as const

/**
 * Combien de photos on tient en vie par réserve, et pourquoi un nombre.
 *
 * Chaque aperçu tient une URL d'objet, donc un Blob décodé en mémoire. Sur un
 * téléphone d'entrée de gamme, quelques photos pleine résolution suffisent à
 * faire tuer l'onglet par le système — et l'onglet tué emporte la saisie en
 * cours, pas seulement l'aperçu. Huit est un plafond de PRUDENCE : il n'est pas
 * mesuré sur un appareil réel, et je ne prétends pas qu'il l'est. Ce qui est
 * mesuré, c'est le poids d'une photo transcodée — huit d'entre elles pèsent au
 * plus quelques mégaoctets, là où huit originaux en pèseraient vingt.
 */
export const PHOTOS_PAR_RESERVE = 8

export type MotifDeRefus =
  /** HEIC : le format par défaut d'un iPhone, qu'aucun navigateur ne décode. */
  | 'heic'
  /** Les octets ne sont pas une image que le navigateur sait ouvrir. */
  | 'illisible'

export type Transcodage =
  | {
      transcode: true
      octets: Blob
      largeur: number
      hauteur: number
      typeMime: typeof TYPE_SORTIE
    }
  | { transcode: false; motif: MotifDeRefus }

/**
 * Le HEIC se reconnaît DANS LES OCTETS, pas dans le type déclaré.
 *
 * `File.type` vient du système, et il ment souvent sur iOS : tantôt
 * `image/heic`, tantôt une chaîne vide selon que le fichier arrive de l'appareil
 * photo, de la photothèque ou d'un partage. Croire ce champ ferait passer le
 * fichier au décodeur, qui échouerait plus loin avec une erreur que personne ne
 * sait traduire en conseil.
 *
 * La signature est celle d'un conteneur ISO-BMFF : « ftyp » en position 4, suivi
 * d'une marque de marque. Le serveur lit ses propres octets de la même façon,
 * pour la même raison — voir `typeDesOctets`.
 */
const MARQUES_HEIC = ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1']

export async function estUnHeic(fichier: Blob): Promise<boolean> {
  if (fichier.size < 12) return false
  const tete = new Uint8Array(await fichier.slice(0, 12).arrayBuffer())
  const texte = (debut: number, fin: number) =>
    String.fromCharCode(...tete.subarray(debut, fin))
  return texte(4, 8) === 'ftyp' && MARQUES_HEIC.includes(texte(8, 12))
}

/**
 * Réduit à la hauteur cible et ré-encode en JPEG.
 *
 * N'AGRANDIT JAMAIS. Une photo déjà plus petite que la cible ressortirait
 * plus lourde qu'elle n'est entrée, pour des pixels inventés par
 * l'interpolation — on paierait du réseau pour de la fausse résolution.
 *
 * L'ORIENTATION N'EST PAS TRAITÉE ICI, ET C'EST VOULU. Mesuré sur Chromium :
 * tous les chemins de décodage appliquent l'EXIF, y compris
 * `imageOrientation: 'none'`. Le canevas reçoit donc une image déjà droite, et
 * le ré-encodage CUIT la rotation dans les pixels tout en supprimant le segment
 * EXIF entier — donc les coordonnées GPS avec. Ce n'est pas un effet de bord
 * qu'on tolère : c'est la raison pour laquelle rien, en aval, n'a jamais à
 * tourner une image ni à effacer une position.
 *
 * LE BITMAP EST FERMÉ dans tous les cas. Un `ImageBitmap` retient les pixels
 * décodés — sur une photo de 12 Mpx, cela fait une cinquantaine de mégaoctets
 * que le ramasse-miettes ne reprend pas de lui-même.
 */
export async function transcoderPhoto(fichier: Blob): Promise<Transcodage> {
  if (await estUnHeic(fichier)) return { transcode: false, motif: 'heic' }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(fichier)
  } catch {
    return { transcode: false, motif: 'illisible' }
  }

  try {
    const echelle = Math.min(1, HAUTEUR_CIBLE_PX / bitmap.height)
    const largeur = Math.max(1, Math.round(bitmap.width * echelle))
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle))

    const canevas = document.createElement('canvas')
    canevas.width = largeur
    canevas.height = hauteur
    const contexte = canevas.getContext('2d')
    if (!contexte) return { transcode: false, motif: 'illisible' }
    contexte.drawImage(bitmap, 0, 0, largeur, hauteur)

    const octets = await new Promise<Blob | null>((resoudre) =>
      canevas.toBlob(resoudre, TYPE_SORTIE, QUALITE_JPEG),
    )
    if (!octets) return { transcode: false, motif: 'illisible' }

    return { transcode: true, octets, largeur, hauteur, typeMime: TYPE_SORTIE }
  } finally {
    bitmap.close()
  }
}
