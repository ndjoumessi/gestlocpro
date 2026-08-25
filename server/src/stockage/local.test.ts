import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StockageLocal, type AutorisationDEnvoi } from './local.js'
import { CHEMIN_TRANSPORT_LOCAL } from './local.js'
import { PLAFOND_DE_TRAVAIL_OCTETS, type Reservation } from './contrat.js'

/**
 * LE DÉPÔT LOCAL.
 *
 * Ce que ces cas gardent n'est pas « écrire un fichier marche » — c'est le
 * CONTRAT de la couture, dont chaque clause a été écrite contre une manière
 * précise de perdre : une clé qu'on devine, un type qu'on croit sur parole, un
 * chemin qui sort du dossier.
 */
const SECRET = 'secret-de-test-assez-long'
/** Horloge fixe : une échéance ne doit pas dépendre de la vitesse de la machine. */
const INSTANT = 1_700_000_000_000

function image(type: 'jpeg' | 'png' | 'webp', taille = 64): Uint8Array {
  const octets = new Uint8Array(taille)
  if (type === 'jpeg') octets.set([0xff, 0xd8, 0xff], 0)
  if (type === 'png') octets.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  if (type === 'webp') {
    octets.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
    octets.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8)
  }
  return octets
}

/**
 * Relit l'autorisation DANS l'adresse rendue, plutôt que de la refabriquer.
 *
 * Un test qui recalcule lui-même la signature vérifie sa propre copie de la
 * règle. Ici, ce qui est présenté au dépôt est exactement ce que le dépôt
 * vient de délivrer — le seul chemin qu'un vrai déposant puisse suivre.
 */
function autorisationDe(reservation: Reservation): AutorisationDEnvoi {
  const q = new URL(reservation.url, 'http://local').searchParams
  return {
    type: q.get('type') ?? '',
    taille: Number(q.get('taille')),
    expire: Number(q.get('expire')),
    signature: q.get('signature') ?? '',
  }
}

describe('le dépôt sur disque local', () => {
  let racine: string
  let depot: StockageLocal

  beforeEach(async () => {
    racine = await mkdtemp(join(tmpdir(), 'gestlocpro-stockage-'))
    depot = new StockageLocal(racine, SECRET, () => INSTANT)
  })

  afterEach(async () => {
    await rm(racine, { recursive: true, force: true })
  })

  describe('la réservation', () => {
    it('rend de quoi envoyer sans faire passer un octet par le serveur', async () => {
      const reservation = await depot.reserver('image/jpeg', 4096)

      expect(reservation.methode).toBe('PUT')
      expect(reservation.entetes['Content-Type']).toBe('image/jpeg')
      expect(reservation.expireLe).toBe(INSTANT + 15 * 60 * 1000)

      const adresse = new URL(reservation.url, 'http://local')
      expect(adresse.pathname).toBe(`${CHEMIN_TRANSPORT_LOCAL}/${reservation.cle}`)
      // La taille voyage DANS l'autorisation, et non à côté d'elle.
      expect(adresse.searchParams.get('taille')).toBe('4096')
      expect(adresse.searchParams.get('signature')).toMatch(/^[0-9a-f]{64}$/)
    })

    /**
     * L'IMPRÉVISIBILITÉ DE LA CLÉ, mesurée et non affirmée.
     *
     * Compter les clés distinctes ne prouverait rien : un compteur les rend
     * toutes distinctes. Ce qu'on mesure ici, c'est que CHAQUE position du
     * jeton varie — un compteur, un horodatage ou un préfixe fixe laisserait
     * des positions figées, et c'est exactement ce par quoi une clé devient
     * énumérable.
     *
     * Seuil : 8 caractères distincts sur 16 possibles, en 200 tirages. Une
     * source réellement aléatoire descend en dessous avec une probabilité
     * qu'aucune exécution ne verra.
     */
    it('tire une clé imprévisible, position par position', async () => {
      const cles: string[] = []
      for (let i = 0; i < 200; i++) cles.push((await depot.reserver('image/jpeg', 64)).cle)

      expect(new Set(cles).size).toBe(200)
      for (const cle of cles) expect(cle).toMatch(/^[0-9a-f]{32}$/)

      const maigres: number[] = []
      for (let position = 0; position < 32; position++) {
        const vus = new Set(cles.map((cle) => cle[position]))
        if (vus.size < 8) maigres.push(position)
      }
      expect(maigres, 'positions de la clé qui ne varient presque pas').toEqual([])
    })

    /**
     * Aucun nom d'origine ne peut entrer dans la clé : la signature n'en
     * accepte pas. Le cas fige cette contrainte STRUCTURELLE — une surcharge
     * qui accepterait un nom de fichier casserait ce type.
     */
    it('n’accepte aucun nom de fichier d’origine', () => {
      // @ts-expect-error — un troisième argument n'existe pas, et ne doit pas exister.
      const appel = () => depot.reserver('image/jpeg', 64, 'salon-fissure.jpg')
      expect(typeof appel).toBe('function')
    })
  })

  describe('la confirmation', () => {
    async function deposer(octets: Uint8Array): Promise<string> {
      const reservation = await depot.reserver('image/jpeg', octets.length)
      const resultat = await depot.recevoir(reservation.cle, octets, autorisationDe(reservation))
      expect(resultat).toEqual({ accepte: true })
      return reservation.cle
    }

    it('rend le poids et le type LUS SUR LE DÉPÔT', async () => {
      const cle = await deposer(image('png', 512))

      const confirmation = await depot.confirmer(cle, 'image/png')

      expect(confirmation).toEqual({ accepte: true, cle, octets: 512, typeMime: 'image/png' })
    })

    it('refuse une clé sur laquelle rien n’est arrivé', async () => {
      const { cle } = await depot.reserver('image/jpeg', 64)

      expect(await depot.confirmer(cle, 'image/jpeg')).toEqual({ accepte: false, motif: 'absent' })
    })

    /**
     * LE CLIENT N'EST PAS CRU SUR PAROLE — le cas central de cette étape.
     *
     * Les octets déposés sont du HTML ; le client les déclare en JPEG. Servi
     * depuis le domaine du dépôt, ce fichier s'exécuterait dans le navigateur
     * de celui qui l'ouvre.
     */
    it('refuse ce qui n’est pas une image, quoi que le client déclare', async () => {
      const html = new TextEncoder().encode('<script>alert(1)</script>')
      const cle = await deposer(html)

      expect(await depot.confirmer(cle, 'image/jpeg')).toEqual({
        accepte: false,
        motif: 'pas-une-image',
      })
    })

    it('refuse une image dont le type dément ce qui a été annoncé', async () => {
      const cle = await deposer(image('png'))

      expect(await depot.confirmer(cle, 'image/jpeg')).toEqual({
        accepte: false,
        motif: 'type-menti',
      })
    })

    it('reconnaît le WebP, que le navigateur produit à la compression', async () => {
      const cle = await deposer(image('webp'))

      expect(await depot.confirmer(cle, 'image/webp')).toMatchObject({
        accepte: true,
        typeMime: 'image/webp',
      })
    })

    it('refuse ce qui dépasse le plafond, et accepte ce qui l’atteint', async () => {
      const pile = image('jpeg', PLAFOND_DE_TRAVAIL_OCTETS)
      const trop = image('jpeg', PLAFOND_DE_TRAVAIL_OCTETS + 1)

      expect(await depot.confirmer(await deposer(pile), 'image/jpeg')).toMatchObject({
        accepte: true,
        octets: PLAFOND_DE_TRAVAIL_OCTETS,
      })
      expect(await depot.confirmer(await deposer(trop), 'image/jpeg')).toEqual({
        accepte: false,
        motif: 'trop-lourd',
      })
    })
  })

  describe('la lecture', () => {
    it('rend une adresse SIGNÉE dont l’échéance est dans le message signé', async () => {
      const { cle } = await depot.reserver('image/jpeg', 64)

      const adresse = await depot.lire(cle)

      const expireLe = INSTANT + 5 * 60 * 1000
      expect(adresse.expireLe).toBe(expireLe)
      const attendue = createHmac('sha256', SECRET)
        .update(`lecture:${cle}:${expireLe}`)
        .digest('hex')
      expect(adresse.url).toBe(
        `${CHEMIN_TRANSPORT_LOCAL}/${cle}?expire=${expireLe}&signature=${attendue}`,
      )
    })

    it('signe autrement dès que l’échéance change — l’adresse n’est pas rejouable', async () => {
      const { cle } = await depot.reserver('image/jpeg', 64)
      const tot = await depot.lire(cle)
      const tard = await new StockageLocal(racine, SECRET, () => INSTANT + 1000).lire(cle)

      expect(tard.url).not.toBe(tot.url)
    })
  })

  describe('la suppression', () => {
    it('efface, et se laisse rejouer sur ce qui n’est plus là', async () => {
      const reservation = await depot.reserver('image/jpeg', 64)
      const cle = reservation.cle
      await depot.recevoir(cle, image('jpeg'), autorisationDe(reservation))

      await depot.supprimer(cle)
      await depot.supprimer(cle)

      expect(await depot.confirmer(cle, 'image/jpeg')).toEqual({ accepte: false, motif: 'absent' })
    })
  })

  /**
   * L'AUTORISATION D'ENVOI — le plafond qui borne la FACTURE et non la base.
   *
   * Sans elle, le refus d'un dépôt démesuré n'arrivait qu'à la confirmation,
   * c'est-à-dire après que les octets ont été montés et stockés. Ces cas
   * gardent le déplacement du refus : il tombe avant l'écriture.
   */
  describe('l’autorisation d’envoi', () => {
    it('refuse un dépôt d’une AUTRE taille que celle qui a été autorisée', async () => {
      const reservation = await depot.reserver('image/jpeg', 64)
      const autorisation = autorisationDe(reservation)

      const trop = await depot.recevoir(reservation.cle, image('jpeg', 65), autorisation)
      const pasAssez = await depot.recevoir(reservation.cle, image('jpeg', 63), autorisation)

      expect(trop).toEqual({ accepte: false, motif: 'taille' })
      expect(pasAssez).toEqual({ accepte: false, motif: 'taille' })
      // Rien n'a été écrit : le refus précède la dépense.
      expect(await depot.octetsDe(reservation.cle)).toBeNull()
    })

    it('refuse une taille relevée après coup, signature inchangée', async () => {
      const reservation = await depot.reserver('image/jpeg', 64)

      /**
       * Le geste exact qu'on redoute : le déposant relève `taille` dans
       * l'adresse pour se ménager de la place. La signature, elle, couvre la
       * valeur d'origine.
       */
      const trafiquee = { ...autorisationDe(reservation), taille: 5_000_000 }

      expect(await depot.recevoir(reservation.cle, image('jpeg', 5_000_000), trafiquee)).toEqual({
        accepte: false,
        motif: 'signature',
      })
    })

    it('refuse une autorisation périmée, même parfaitement signée', async () => {
      const reservation = await depot.reserver('image/jpeg', 64)
      const autorisation = autorisationDe(reservation)

      const plusTard = new StockageLocal(racine, SECRET, () => INSTANT + 15 * 60 * 1000 + 1)

      expect(await plusTard.recevoir(reservation.cle, image('jpeg'), autorisation)).toEqual({
        accepte: false,
        motif: 'expiree',
      })
      expect(await depot.octetsDe(reservation.cle)).toBeNull()
    })

    /**
     * Une autorisation d'ENVOI ne doit pas se fabriquer depuis une adresse de
     * LECTURE. Les deux signatures portent les mêmes champs à un préfixe près ;
     * sans ce préfixe, le droit de voir vaudrait droit d'écrire.
     */
    it('ne confond pas une signature de lecture avec une autorisation d’envoi', async () => {
      const reservation = await depot.reserver('image/jpeg', 64)
      const lecture = await depot.lire(reservation.cle)
      const signatureDeLecture = new URL(lecture.url, 'http://local').searchParams.get('signature')!

      expect(
        await depot.recevoir(reservation.cle, image('jpeg'), {
          type: 'image/jpeg',
          taille: 64,
          expire: lecture.expireLe,
          signature: signatureDeLecture,
        }),
      ).toEqual({ accepte: false, motif: 'signature' })
    })
  })

  /**
   * LA VÉRIFICATION DE L'ADRESSE DE LECTURE.
   *
   * Le lot précédent calculait cette signature sans que rien ne la contrôle —
   * une décoration correcte. Ces cas la rendent opposable.
   */
  describe('la vérification d’une adresse de lecture', () => {
    async function adresse(cle: string) {
      const { url, expireLe } = await depot.lire(cle)
      const q = new URL(url, 'http://local').searchParams
      return { expire: expireLe, signature: q.get('signature') ?? '' }
    }

    it('accepte celle qu’elle vient de délivrer', async () => {
      const { cle } = await depot.reserver('image/jpeg', 64)
      const { expire, signature } = await adresse(cle)

      expect(depot.verifierLecture(cle, expire, signature)).toEqual({ accepte: true })
    })

    it('refuse une adresse PÉRIMÉE', async () => {
      const { cle } = await depot.reserver('image/jpeg', 64)
      const { expire, signature } = await adresse(cle)

      const plusTard = new StockageLocal(racine, SECRET, () => expire + 1)

      expect(plusTard.verifierLecture(cle, expire, signature)).toEqual({
        accepte: false,
        motif: 'expiree',
      })
    })

    it('refuse une échéance REPOUSSÉE, ce qui est le seul intérêt de la signer', async () => {
      const { cle } = await depot.reserver('image/jpeg', 64)
      const { expire, signature } = await adresse(cle)

      expect(depot.verifierLecture(cle, expire + 3_600_000, signature)).toEqual({
        accepte: false,
        motif: 'signature',
      })
    })

    it('refuse la signature d’une AUTRE clé', async () => {
      const premiere = await depot.reserver('image/jpeg', 64)
      const seconde = await depot.reserver('image/jpeg', 64)
      const { expire, signature } = await adresse(premiere.cle)

      expect(depot.verifierLecture(seconde.cle, expire, signature)).toEqual({
        accepte: false,
        motif: 'signature',
      })
    })

    it('refuse une signature vide ou tronquée', async () => {
      const { cle } = await depot.reserver('image/jpeg', 64)
      const { expire, signature } = await adresse(cle)

      expect(depot.verifierLecture(cle, expire, '')).toMatchObject({ accepte: false })
      expect(depot.verifierLecture(cle, expire, signature.slice(0, -1))).toMatchObject({
        accepte: false,
      })
    })
  })

  /**
   * LA TRAVERSÉE DE CHEMIN.
   *
   * L'implémentation locale compose un chemin de fichier avec la clé. Une clé
   * portant `../` y ferait écrire, lire ou EFFACER hors du dossier — et
   * `supprimer` est la plus coûteuse des trois.
   */
  describe('les clés qui n’en sont pas', () => {
    const contrefaites = ['../evade', 'ABCDEF0123456789abcdef0123456789', '', 'a'.repeat(31)]

    it('refuse toute clé mal formée, sur chacune des entrées', async () => {
      for (const cle of contrefaites) {
        await expect(depot.confirmer(cle, 'image/jpeg')).rejects.toThrow(/invalide/)
        await expect(depot.lire(cle)).rejects.toThrow(/invalide/)
        await expect(depot.supprimer(cle)).rejects.toThrow(/invalide/)
        await expect(depot.octetsDe(cle)).rejects.toThrow(/invalide/)
        await expect(
          depot.recevoir(cle, image('jpeg'), { type: 'image/jpeg', taille: 64, expire: 0, signature: '' }),
        ).rejects.toThrow(/invalide/)
      }
    })

    it('n’écrit rien hors de sa racine', async () => {
      const voisin = join(racine, '..', 'temoin-hors-racine')
      await writeFile(voisin, 'intact')

      await expect(
        depot.recevoir('../temoin-hors-racine', image('jpeg'), {
          type: 'image/jpeg',
          taille: 64,
          expire: INSTANT + 1000,
          signature: '',
        }),
      ).rejects.toThrow()

      expect(await readFile(voisin, 'utf8')).toBe('intact')
      await rm(voisin, { force: true })
    })
  })
})
