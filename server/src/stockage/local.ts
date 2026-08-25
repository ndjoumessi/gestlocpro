import { createHmac, randomBytes } from 'node:crypto'
import { mkdir, open, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PLAFOND_OCTETS,
  typeDesOctets,
  verifierLaCle,
  type AdresseDeLecture,
  type Confirmation,
  type Reservation,
  type Stockage,
} from './contrat.js'

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

  async reserver(typeAnnonce: string): Promise<Reservation> {
    /**
     * LA CLÉ EST TIRÉE AU HASARD, 128 bits.
     *
     * Ni compteur, ni horodatage, ni nom de fichier d'origine. Toute la
     * protection de la lecture repose sur le fait qu'un seau n'est jamais
     * public ET qu'une clé ne se devine pas : une clé énumérable annulerait la
     * seconde moitié avant même que la première soit écrite.
     */
    const cle = randomBytes(16).toString('hex')

    return {
      cle,
      // Adresse RELATIVE : le navigateur parle déjà à cette origine, et une
      // adresse absolue exigerait une variable de configuration de plus.
      url: `/api/stockage/${cle}`,
      methode: 'PUT',
      // Ce que le client a déclaré, rendu tel quel. Le dépôt distant exigera
      // que l'envoi le porte ; aucune confiance n'y est placée pour autant.
      entetes: { 'Content-Type': typeAnnonce },
      expireLe: this.maintenant() + VALIDITE_ENVOI_MS,
    }
  }

  /**
   * Dépose des octets sous une clé déjà réservée.
   *
   * Hors interface : le dépôt distant reçoit les octets du navigateur, sans
   * passer par nous. Seule la route locale d'envoi — celle que remplace l'URL
   * signée en production — appelle ceci.
   */
  async recevoir(cle: string, octets: Uint8Array): Promise<void> {
    verifierLaCle(cle)
    await mkdir(this.racine, { recursive: true })
    await writeFile(this.chemin(cle), octets)
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
    if (octets > PLAFOND_OCTETS) return { accepte: false, motif: 'trop-lourd' }

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
      url: `/api/stockage/${cle}?expire=${expireLe}&signature=${signature}`,
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
}
