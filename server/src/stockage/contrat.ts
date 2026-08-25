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
 *     méthode, en-têtes exigés). Rien n'existe encore côté dépôt.
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
   */
  reserver(typeAnnonce: string): Promise<Reservation>

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
 * Plafond par objet.
 *
 * Une photo d'état des lieux prise au téléphone tient largement dessous une
 * fois compressée par le navigateur. Le plafond n'est pas là pour cadrer
 * l'usage normal : il est là pour qu'un client qui déverse ne remplisse pas un
 * seau qu'on paie au gigaoctet-mois pendant des années.
 */
export const PLAFOND_OCTETS = 8 * 1024 * 1024

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
