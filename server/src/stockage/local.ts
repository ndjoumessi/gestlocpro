import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PLAFOND_PAR_OBJET_OCTETS,
  typeDesOctets,
  verifierLaCle,
  type AdresseDeLecture,
  type Confirmation,
  type Reservation,
  type Stockage,
} from './contrat.js'

/**
 * Où le transport local écoute.
 *
 * Sous `/api/parks` et non à la racine de l'API : monter un routeur est
 * l'affaire de `app.ts`, que ce lot ne touche pas. Le préfixe `stockage-local`
 * est un littéral, donc sans collision possible avec `/:parkId/…` — un
 * identifiant de parc est un uuid.
 *
 * Le nom dit ce qu'il est : la doublure locale du dépôt distant. Le jour où R2
 * arrive, ces deux routes disparaissent et aucune autre ligne ne bouge.
 */
export const CHEMIN_TRANSPORT_LOCAL = '/api/parks/stockage-local'

/** Ce que le déposant présente pour avoir le droit d'écrire sous une clé. */
export interface AutorisationDEnvoi {
  type: string
  taille: number
  expire: number
  signature: string
}

export type ResultatDEnvoi =
  | { accepte: true }
  | { accepte: false; motif: 'signature' | 'expiree' | 'taille' }

export type ResultatDeLecture =
  | { accepte: true }
  | { accepte: false; motif: 'signature' | 'expiree' }

/** Durée de vie d'une autorisation d'envoi : le temps d'une montée, pas plus. */
const VALIDITE_ENVOI_MS = 15 * 60 * 1000

/**
 * Durée de vie d'une adresse de lecture.
 *
 * Courte parce qu'elle circule : elle finit dans un attribut `src`, donc dans
 * l'historique, les journaux d'un mandataire, un copier-coller. Assez longue
 * pour qu'une page s'affiche et qu'on la fasse défiler.
 */
const VALIDITE_LECTURE_MS = 5 * 60 * 1000

/**
 * Dépôt sur le disque local.
 *
 * C'est l'implémentation du développement et des tests. Elle ne demande ni
 * secret, ni réseau, ni dépendance : une machine fraîchement clonée envoie et
 * relit des photos sans compte chez personne.
 *
 * Elle respecte l'aller-retour en trois temps alors qu'elle pourrait s'en
 * passer — voir `Stockage`. Un raccourci ici (recevoir les octets et rendre
 * l'URL dans le même appel) rendrait les appelants inutilisables contre un
 * dépôt distant, et la couture ne servirait plus à rien.
 */
export class StockageLocal implements Stockage {
  constructor(
    private readonly racine: string,
    private readonly secret: string,
    /**
     * L'horloge est INJECTÉE. Une échéance calculée sur `Date.now()` rendrait
     * les cas de test dépendants de la vitesse de la machine qui les exécute.
     */
    private readonly maintenant: () => number = Date.now,
  ) {}

  async reserver(typeAnnonce: string, octetsAttendus: number): Promise<Reservation> {
    /**
     * LA CLÉ EST TIRÉE AU HASARD, 128 bits.
     *
     * Ni compteur, ni horodatage, ni nom de fichier d'origine. Toute la
     * protection de la lecture repose sur le fait qu'un seau n'est jamais
     * public ET qu'une clé ne se devine pas : une clé énumérable annulerait la
     * seconde moitié avant même que la première soit écrite.
     */
    const cle = randomBytes(16).toString('hex')

    /**
     * L'AUTORISATION EST SIGNÉE, et elle scelle la taille attendue.
     *
     * Sans signature, la taille dans la requête ne serait qu'une suggestion :
     * il suffirait de changer le paramètre pour déposer autre chose. Ce qui est
     * signé — clé, type, taille, échéance — est ce que le dépôt acceptera, et
     * rien d'autre. C'est le comportement d'un `PUT` présigné dont la longueur
     * fait partie des en-têtes signés.
     */
    const expireLe = this.maintenant() + VALIDITE_ENVOI_MS
    const signature = this.signerEnvoi(cle, typeAnnonce, octetsAttendus, expireLe)
    const parametres = new URLSearchParams({
      type: typeAnnonce,
      taille: String(octetsAttendus),
      expire: String(expireLe),
      signature,
    })

    return {
      cle,
      // Adresse RELATIVE : le navigateur parle déjà à cette origine, et une
      // adresse absolue exigerait une variable de configuration de plus.
      url: `${CHEMIN_TRANSPORT_LOCAL}/${cle}?${parametres.toString()}`,
      methode: 'PUT',
      // Ce que le client a déclaré, rendu tel quel. Le dépôt distant exigera
      // que l'envoi le porte ; aucune confiance n'y est placée pour autant.
      entetes: { 'Content-Type': typeAnnonce },
      expireLe,
    }
  }

  /**
   * Dépose des octets sous une clé réservée, SI l'autorisation le permet.
   *
   * Hors interface : le dépôt distant reçoit les octets du navigateur, sans
   * passer par nous. Seule la route locale d'envoi — celle que remplace l'URL
   * présignée en production — appelle ceci. C'est ici que se joue, en local, ce
   * que R2 applique de son côté : on refuse AVANT d'écrire.
   *
   * L'ordre des contrôles n'est pas indifférent. La signature d'abord : tant
   * qu'elle n'est pas vérifiée, ni la taille ni l'échéance présentées ne sont
   * des faits, ce sont des affirmations du déposant. Une fois la signature
   * établie, l'échéance et la taille qu'elle couvre deviennent opposables.
   */
  async recevoir(
    cle: string,
    octets: Uint8Array,
    autorisation: AutorisationDEnvoi,
  ): Promise<ResultatDEnvoi> {
    verifierLaCle(cle)

    const attendue = this.signerEnvoi(
      cle,
      autorisation.type,
      autorisation.taille,
      autorisation.expire,
    )
    if (!memeSignature(attendue, autorisation.signature)) {
      return { accepte: false, motif: 'signature' }
    }

    if (autorisation.expire <= this.maintenant()) return { accepte: false, motif: 'expiree' }

    /**
     * LA TAILLE EXACTE, ni plus ni moins.
     *
     * « Au plus » aurait suffi à borner la facture, mais pas à borner le
     * mensonge : un client annonçant huit mébioctets pour en déposer trois
     * aurait fait réserver une place qu'il n'occupe pas. L'égalité stricte rend
     * l'annonce vérifiable, et c'est ce qui permet à la ligne en base de porter
     * la taille dès la réservation.
     */
    if (octets.length !== autorisation.taille) return { accepte: false, motif: 'taille' }

    await mkdir(this.racine, { recursive: true })
    await writeFile(this.chemin(cle), octets)
    return { accepte: true }
  }

  /**
   * Vérifie une adresse de lecture, et refuse ce qui a expiré ou été trafiqué.
   *
   * C'est le pendant de `lire`, et sans lui la signature ne serait qu'une
   * décoration : une adresse calculée que personne ne contrôle ne protège rien.
   * En production, ce contrôle est celui de R2 ; en local, c'est celui-ci.
   */
  verifierLecture(cle: string, expire: number, signature: string): ResultatDeLecture {
    verifierLaCle(cle)

    if (!memeSignature(this.signer(cle, expire), signature)) {
      return { accepte: false, motif: 'signature' }
    }
    if (expire <= this.maintenant()) return { accepte: false, motif: 'expiree' }
    return { accepte: true }
  }

  /**
   * Rend les octets déposés, ou `null` si rien ne l'est.
   *
   * Hors interface, comme `recevoir` : c'est le service local des octets, que
   * R2 rend lui-même. Le fichier est lu ENTIER en mémoire — ce que la doctrine
   * de ce dépôt refuse en production, et qui est précisément la raison pour
   * laquelle ce chemin n'existe qu'en local.
   */
  async octetsDe(cle: string): Promise<Uint8Array | null> {
    verifierLaCle(cle)
    try {
      return await readFile(this.chemin(cle))
    } catch {
      return null
    }
  }

  async confirmer(cle: string, typeAnnonce: string): Promise<Confirmation> {
    verifierLaCle(cle)

    let octets: number
    try {
      octets = (await stat(this.chemin(cle))).size
    } catch {
      return { accepte: false, motif: 'absent' }
    }

    /**
     * Le poids se lit sur le DÉPÔT, jamais dans ce que le client annonce.
     * C'est tout l'intérêt de cette étape : le serveur n'a pas vu les octets
     * passer, c'est ici ou nulle part qu'il les pèse.
     */
    if (octets > PLAFOND_PAR_OBJET_OCTETS) return { accepte: false, motif: 'trop-lourd' }

    const fichier = await open(this.chemin(cle), 'r')
    let entete: Uint8Array
    try {
      const tampon = new Uint8Array(16)
      const { bytesRead } = await fichier.read(tampon, 0, 16, 0)
      entete = tampon.subarray(0, bytesRead)
    } finally {
      await fichier.close()
    }

    // LE TYPE VIENT DES OCTETS, jamais de ce que le client a déclaré.
    const typeReel = typeDesOctets(entete)

    if (typeReel === null) return { accepte: false, motif: 'pas-une-image' }
    /**
     * Une image, mais pas celle qui a été annoncée : refus.
     *
     * L'écart n'est pas anodin. C'est le type ANNONCÉ qui a été signé dans
     * l'autorisation d'envoi, donc celui que le dépôt distant retiendra comme
     * métadonnée et resservira à la lecture. Accepter l'écart, ce serait
     * garantir qu'un jour un PNG sera servi comme un JPEG.
     */
    if (typeReel !== typeAnnonce) return { accepte: false, motif: 'type-menti' }

    return { accepte: true, cle, octets, typeMime: typeReel }
  }

  async lire(cle: string): Promise<AdresseDeLecture> {
    verifierLaCle(cle)

    const expireLe = this.maintenant() + VALIDITE_LECTURE_MS
    const signature = this.signer(cle, expireLe)

    return {
      url: `${CHEMIN_TRANSPORT_LOCAL}/${cle}?expire=${expireLe}&signature=${signature}`,
      expireLe,
    }
  }

  async supprimer(cle: string): Promise<void> {
    verifierLaCle(cle)
    try {
      await unlink(this.chemin(cle))
    } catch {
      // Déjà absent : l'appelant voulait qu'il n'y soit plus, il n'y est plus.
    }
  }

  private chemin(cle: string): string {
    return join(this.racine, cle)
  }

  /**
   * Signature de l'adresse de lecture.
   *
   * L'échéance est DANS le message signé : sans elle, l'adresse ne serait
   * courte que dans son nom — n'importe qui pourrait avancer `expire` sans
   * casser la signature.
   *
   * Le préfixe `lecture:` sépare les usages du secret de session. Un HMAC
   * calculé sur la même clé pour deux objets différents finit un jour par
   * signer l'un à la place de l'autre.
   */
  private signer(cle: string, expireLe: number): string {
    return createHmac('sha256', this.secret).update(`lecture:${cle}:${expireLe}`).digest('hex')
  }

  /**
   * Signature de l'autorisation d'envoi.
   *
   * Le préfixe `envoi:` la sépare de `lecture:`. Sans cette séparation, une
   * adresse de lecture et une autorisation d'envoi calculées sur les mêmes
   * champs seraient interchangeables — le droit de voir vaudrait droit
   * d'écrire.
   */
  private signerEnvoi(cle: string, type: string, taille: number, expireLe: number): string {
    return createHmac('sha256', this.secret)
      .update(`envoi:${cle}:${type}:${taille}:${expireLe}`)
      .digest('hex')
  }
}

/**
 * Comparaison à temps constant.
 *
 * Un `===` sur une signature rend son verdict d'autant plus vite que le
 * préfixe diverge tôt. L'écart se mesure, et il se remonte octet par octet
 * jusqu'à forger une signature valide sans connaître le secret. Le dépôt
 * emploie déjà `timingSafeEqual` pour ses jetons de session ; la même règle
 * vaut ici.
 */
function memeSignature(attendue: string, presentee: string): boolean {
  const a = Buffer.from(attendue, 'utf8')
  const b = Buffer.from(presentee, 'utf8')
  // `timingSafeEqual` lève sur des longueurs différentes : la longueur d'une
  // signature n'est pas un secret, la comparer avant ne révèle rien.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
