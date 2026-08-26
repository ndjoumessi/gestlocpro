/**
 * Dépôt d'objets — photos d'état des lieux — derrière une couture.
 *
 * POURQUOI CETTE FORME, en trois temps plutôt qu'un `envoyer(octets)`.
 *
 * Les octets ne passeront PAS par l'API. Une photo de téléphone pèse quelques
 * mégaoctets ; les faire transiter par le serveur voudrait dire relever le
 * plafond de `express.json`, tenir l'image en mémoire sur une instance qu'on
 * paie au gigaoctet, et doubler le trafic — montée vers le serveur, puis
 * montée vers le dépôt. Le navigateur envoie donc DIRECTEMENT au dépôt, et le
 * serveur ne signe que l'autorisation.
 *
 * Ce chemin impose l'aller-retour, et l'interface le porte dès maintenant :
 *
 *  1. `reserver` — le serveur tire une clé et rend de quoi envoyer (adresse,
 *     méthode, en-têtes exigés). Rien n'existe encore côté dépôt. La TAILLE
 *     ATTENDUE est scellée dans cette autorisation — voir `reserver`.
 *  2. `confirmer` — le client dit « c'est monté ». C'est le SEUL moment où le
 *     serveur peut regarder ce qui a réellement été déposé : il n'a pas vu les
 *     octets passer. Sans cette étape, le serveur enregistrerait en base une
 *     photo dont il ne saurait ni le poids ni la nature — sur la parole du
 *     client.
 *  3. `lire` — le seau n'est JAMAIS public. Une adresse devinable serait une
 *     fuite permanente, et une fuite d'image ne se rattrape pas. L'adresse est
 *     donc signée et de courte durée, délivrée après contrôle d'appartenance.
 *  4. `supprimer`.
 *
 * Un lecteur qui ne connaît que l'implémentation locale — qui, elle, pourrait
 * très bien recevoir les octets d'un coup — ne comprendrait pas cette découpe.
 * Elle n'est pas là pour le disque local : elle est là pour que le jour où le
 * dépôt distant arrive, aucun appelant ne change.
 */
export interface Stockage {
  /**
   * Réserve une clé et rend de quoi envoyer les octets.
   *
   * `typeAnnonce` est ce que le client DÉCLARE. Il sert à composer l'en-tête
   * que le dépôt distant exigera au dépôt — rien de plus. Aucune décision de
   * sécurité ne s'appuie dessus ; c'est `confirmer` qui tranche, et lui seul.
   *
   * Aucun nom de fichier d'origine n'entre ici, et c'est structurel : la
   * signature n'en accepte pas. Un nom d'origine dans une clé la rendrait
   * devinable, et rendrait au passage un renseignement sur le déposant.
   *
   * `octetsAttendus` EST SCELLÉ DANS L'AUTORISATION, et c'est une extension
   * assumée du contrat.
   *
   * La première version ne pesait qu'à `confirmer`. Le plafond gardait alors la
   * base de données et rien d'autre : un client pouvait déverser cinq
   * gigaoctets sur une clé réservée, `confirmer` refusait la ligne, et les
   * octets restaient — montés, stockés, facturés au gigaoctet-mois. Le refus
   * arrivait après la dépense, donc trop tard pour l'empêcher.
   *
   * Lier la taille à l'autorisation déplace le refus AVANT la montée : le dépôt
   * lui-même rejette ce qui ne correspond pas, sans que le serveur ait à voir
   * passer un octet. C'est ce que fait un `PUT` présigné dont la longueur est
   * signée ; l'implémentation locale reproduit la même règle.
   *
   * Cela ne rend PAS `confirmer` inutile : la taille est vérifiée à l'envoi, la
   * NATURE des octets ne peut l'être qu'après. Un dépôt de la bonne taille
   * portant du HTML passe l'autorisation et se fait refuser à la confirmation.
   */
  reserver(typeAnnonce: string, octetsAttendus: number): Promise<Reservation>

  /**
   * Regarde ce qui est RÉELLEMENT arrivé, et le refuse s'il le faut.
   *
   * Le client n'est pas cru sur parole : ni sur le poids qu'il annonce, ni sur
   * le type qu'il déclare. Le poids se lit sur le dépôt, le type se lit dans
   * les premiers octets.
   */
  confirmer(cle: string, typeAnnonce: string): Promise<Confirmation>

  /** Adresse de lecture, signée et de courte durée. */
  lire(cle: string): Promise<AdresseDeLecture>

  /** Sans effet si l'objet n'existe pas — un appelant qui réessaie doit passer. */
  supprimer(cle: string): Promise<void>
}

export interface Reservation {
  cle: string
  /** Où le NAVIGATEUR envoie les octets. Le serveur ne les voit pas. */
  url: string
  methode: 'PUT'
  /** En-têtes que le dépôt exigera — un dépôt signé refuse ce qui s'en écarte. */
  entetes: Record<string, string>
  /** Instant (ms) après lequel cette adresse d'envoi ne vaut plus rien. */
  expireLe: number
}

export interface AdresseDeLecture {
  url: string
  expireLe: number
}

export type TypeImage = 'image/jpeg' | 'image/png' | 'image/webp'

/**
 * Le refus porte un MOTIF, et l'appelant doit le regarder.
 *
 * Rendre `null` en cas de refus aurait suffi à ne pas mentir, mais l'écran ne
 * pourrait dire que « échec » là où l'utilisateur a besoin de savoir s'il doit
 * réduire sa photo ou en choisir une autre.
 */
export type Confirmation =
  | { accepte: true; cle: string; octets: number; typeMime: TypeImage }
  | { accepte: false; motif: MotifDeRefus }

export type MotifDeRefus =
  /** Rien n'est arrivé sous cette clé : le client a confirmé un envoi qui n'a pas eu lieu. */
  | 'absent'
  | 'trop-lourd'
  | 'pas-une-image'
  /** Les octets sont bien une image, mais pas celle que le client avait déclarée. */
  | 'type-menti'

/**
 * Plafond par objet — DEUX MÉBIOCTETS, ET LE CHIFFRE EST MESURÉ.
 *
 * Le plafond n'est pas là pour cadrer l'usage normal : il est là pour qu'un
 * client qui déverse ne remplisse pas un seau qu'on paie au gigaoctet-mois
 * pendant des années. Il portait auparavant le nom `PLAFOND_DE_TRAVAIL_OCTETS`
 * et valait 8 Mio, venus d'une estimation de ce que pèse une photo de téléphone
 * compressée par le navigateur — pas d'une photo pesée. Le nom portait l'aveu ;
 * l'aveu n'a plus lieu d'être.
 *
 * IL PORTE SUR LES OCTETS TRANSCODÉS, et rien d'autre. Envoyer un original
 * d'appareil non transcodé n'est pas un chemin du produit : la taille est
 * scellée dans l'autorisation présignée et vérifiée par ÉGALITÉ STRICTE depuis
 * le lot précédent. Un client ne choisit donc pas d'envoyer 2,77 Mio de JPEG
 * brut sous ce plafond — il envoie exactement ce qu'il a fait autoriser.
 *
 * ─── LE RELEVÉ ────────────────────────────────────────────────────────────
 *
 * `scripts/mesure-compression-photo.mjs`, sur DEUX PHOTOGRAPHIES RÉELLES sous
 * CC0 — un compteur d'eau (Samsung Galaxy A54 5G, 4080×2296 stockés, EXIF
 * Orientation 6) et une façade à fissures structurelles (Galaxy A16, 2576×1932,
 * Orientation 6). Octets rendus par `canvas.toBlob('image/jpeg', q)` :
 *
 *   hauteur   compteur  q0,90 / q0,82 / q0,70   façade  q0,90 / q0,82 / q0,70
 *   2048 px            386 / 249 / 167 Kio             627 / 444 / 329 Kio
 *   1600 px            253 / 165 / 113 Kio             433 / 306 / 227 Kio
 *   1280 px            174 / 116 /  80 Kio             308 / 218 / 161 Kio
 *   1024 px            121 /  82 /  58 Kio             217 / 154 / 113 Kio
 *    800 px             83 /  57 /  41 Kio             145 / 104 /  77 Kio
 *
 * Le PIRE CAS mesuré est 627 Kio, à 2048 px et qualité 0,90. Deux mébioctets
 * en font 3,3 fois — assez pour absorber un sujet plus chargé que ces deux-là
 * sans laisser passer un déversement. Les 8 Mio d'avant en faisaient treize.
 *
 * ─── LA LISIBILITÉ, ET DE QUI EST LE JUGEMENT ─────────────────────────────
 *
 * Elle ne se mesure pas. J'ai découpé la fenêtre d'index du compteur à
 * l'échelle 1:1 dans chaque rendu et je l'ai REGARDÉE. `00088,498 m³` se lit
 * nettement à 2048, 1600 et 1280 px ; ramollit à 1024 ; à 800 px je ne le lis
 * que parce que je le connais déjà. Le plancher est donc posé à 1280 px, et
 * c'est MON jugement, sur un écran, en connaissant l'index d'avance — pas
 * celui d'un gestionnaire lisant un relevé inconnu sur un téléphone au soleil.
 *
 * La cible recommandée au lot du navigateur est 1600 px de hauteur : une marche
 * entière de réserve au-dessus de ce plancher.
 *
 * ─── LA QUALITÉ : CE QUE DIT LA MESURE, CE QUE DIT LA PRUDENCE ────────────
 *
 * LA MESURE DIT 0,70. À hauteur égale, sur les deux sujets, q0,70 se lit aussi
 * bien que q0,82 — les chiffres de l'index comme la fissure de la façade. À
 * 1600 px, cela ferait 113 à 227 Kio au lieu de 165 à 306, soit un tiers de
 * moins sur le réseau que ce produit vise.
 *
 * ON RETIENT POURTANT 0,82, ET CE N'EST PAS UNE CONCLUSION DE MESURE : c'est
 * une PRUDENCE NON MESURÉE contre les cas que le relevé n'a pas pu couvrir. Des
 * chiffres d'index sont un signal à fort contraste, et la fissure de la façade
 * est large ; la microfissure, l'auréole d'humidité et la scène sombre et
 * bruitée sont exactement ce que q0,70 écraserait en premier, et aucune des
 * deux photographies ne les portait. Aucun gros plan de fissure ou d'humidité
 * n'existe en CC0 sur Commons parmi les originaux d'appareil — six recherches.
 * Le jour où l'on mesure ces cas-là, ce paragraphe se remplace par un chiffre.
 *
 * ─── CE QUE LE RELEVÉ NE COUVRE PAS ───────────────────────────────────────
 *
 * Deux photographies, deux Samsung. Aucun iPhone, aucun capteur ancien, aucune
 * scène en basse lumière. Et le temps de transmission cité par le script est
 * une division par un débit posé, jamais un relevé réseau.
 */
export const PLAFOND_PAR_OBJET_OCTETS = 2 * 1024 * 1024

/**
 * Une clé est 32 caractères hexadécimaux, et RIEN d'autre.
 *
 * Le format est vérifié à chaque entrée, pour deux raisons distinctes. La
 * première est la traversée de chemin : l'implémentation locale compose un
 * chemin de fichier avec la clé, et un `../` y ferait lire ou effacer hors du
 * dossier. La seconde tient même sans disque — une clé qui ne vient pas de
 * `reserver` ne vient de nulle part, et mieux vaut le dire fort que de rendre
 * un « absent » qui ressemble à une réponse normale.
 */
const FORME_DE_CLE = /^[0-9a-f]{32}$/

export function verifierLaCle(cle: string): void {
  if (!FORME_DE_CLE.test(cle)) {
    throw new Error('Clé de stockage invalide.')
  }
}

/**
 * Le type d'une image se lit dans ses PREMIERS OCTETS.
 *
 * Rend `null` pour tout ce qui n'est pas une image reconnue — un HTML, un
 * script, une archive. C'est ce `null` qui protège : un fichier accepté sous
 * une extension d'image et servi depuis le domaine du dépôt s'exécuterait dans
 * le navigateur de celui qui l'ouvre.
 *
 * HEIC — ce que produit un iPhone par défaut — est délibérément ABSENT. Safari
 * l'affiche ; Chrome et Firefox, non. Une pièce que seule une partie du parc
 * peut ouvrir n'est pas une pièce : elle serait gardée des années, payée, et
 * illisible pour qui l'ouvre depuis autre chose qu'un appareil Apple. Le refus
 * tombe ici, au dépôt, où l'utilisateur peut encore reprendre la photo, plutôt
 * qu'à l'affichage, des mois plus tard.
 */
export function typeDesOctets(entete: Uint8Array): TypeImage | null {
  const a = (i: number, v: number) => entete[i] === v

  if (a(0, 0xff) && a(1, 0xd8) && a(2, 0xff)) return 'image/jpeg'

  if (a(0, 0x89) && a(1, 0x50) && a(2, 0x4e) && a(3, 0x47) && a(4, 0x0d) && a(5, 0x0a) && a(6, 0x1a) && a(7, 0x0a)) {
    return 'image/png'
  }

  // « RIFF » … « WEBP » : la taille du conteneur occupe les octets 4 à 7.
  const texte = (debut: number, attendu: string) =>
    attendu.split('').every((c, i) => entete[debut + i] === c.charCodeAt(0))
  if (texte(0, 'RIFF') && texte(8, 'WEBP')) return 'image/webp'

  return null
}
