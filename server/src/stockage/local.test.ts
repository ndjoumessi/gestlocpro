import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StockageLocal } from './local.js'
import { PLAFOND_OCTETS } from './contrat.js'

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
      const reservation = await depot.reserver('image/jpeg')

      expect(reservation.methode).toBe('PUT')
      expect(reservation.url).toBe(`/api/stockage/${reservation.cle}`)
      expect(reservation.entetes['Content-Type']).toBe('image/jpeg')
      expect(reservation.expireLe).toBe(INSTANT + 15 * 60 * 1000)
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
      for (let i = 0; i < 200; i++) cles.push((await depot.reserver('image/jpeg')).cle)

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
      // @ts-expect-error — un second argument n'existe pas, et ne doit pas exister.
      const appel = () => depot.reserver('image/jpeg', 'salon-fissure.jpg')
      expect(typeof appel).toBe('function')
    })
  })

  describe('la confirmation', () => {
    async function deposer(octets: Uint8Array): Promise<string> {
      const { cle } = await depot.reserver('image/jpeg')
      await depot.recevoir(cle, octets)
      return cle
    }

    it('rend le poids et le type LUS SUR LE DÉPÔT', async () => {
      const cle = await deposer(image('png', 512))

      const confirmation = await depot.confirmer(cle, 'image/png')

      expect(confirmation).toEqual({ accepte: true, cle, octets: 512, typeMime: 'image/png' })
    })

    it('refuse une clé sur laquelle rien n’est arrivé', async () => {
      const { cle } = await depot.reserver('image/jpeg')

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
      const pile = image('jpeg', PLAFOND_OCTETS)
      const trop = image('jpeg', PLAFOND_OCTETS + 1)

      expect(await depot.confirmer(await deposer(pile), 'image/jpeg')).toMatchObject({
        accepte: true,
        octets: PLAFOND_OCTETS,
      })
      expect(await depot.confirmer(await deposer(trop), 'image/jpeg')).toEqual({
        accepte: false,
        motif: 'trop-lourd',
      })
    })
  })

  describe('la lecture', () => {
    it('rend une adresse SIGNÉE dont l’échéance est dans le message signé', async () => {
      const { cle } = await depot.reserver('image/jpeg')

      const adresse = await depot.lire(cle)

      const expireLe = INSTANT + 5 * 60 * 1000
      expect(adresse.expireLe).toBe(expireLe)
      const attendue = createHmac('sha256', SECRET)
        .update(`lecture:${cle}:${expireLe}`)
        .digest('hex')
      expect(adresse.url).toBe(`/api/stockage/${cle}?expire=${expireLe}&signature=${attendue}`)
    })

    it('signe autrement dès que l’échéance change — l’adresse n’est pas rejouable', async () => {
      const { cle } = await depot.reserver('image/jpeg')
      const tot = await depot.lire(cle)
      const tard = await new StockageLocal(racine, SECRET, () => INSTANT + 1000).lire(cle)

      expect(tard.url).not.toBe(tot.url)
    })
  })

  describe('la suppression', () => {
    it('efface, et se laisse rejouer sur ce qui n’est plus là', async () => {
      const { cle } = await depot.reserver('image/jpeg')
      await depot.recevoir(cle, image('jpeg'))

      await depot.supprimer(cle)
      await depot.supprimer(cle)

      expect(await depot.confirmer(cle, 'image/jpeg')).toEqual({ accepte: false, motif: 'absent' })
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
        await expect(depot.recevoir(cle, image('jpeg'))).rejects.toThrow(/invalide/)
      }
    })

    it('n’écrit rien hors de sa racine', async () => {
      const voisin = join(racine, '..', 'temoin-hors-racine')
      await writeFile(voisin, 'intact')

      await expect(depot.recevoir('../temoin-hors-racine', image('jpeg'))).rejects.toThrow()

      expect(await readFile(voisin, 'utf8')).toBe('intact')
      await rm(voisin, { force: true })
    })
  })
})
