import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'

/**
 * L'ANNONCE SORT DU PRODUIT — en lecture, et en lecture seule.
 *
 * ═══ CE QUI EXISTAIT, ET QUI NE SORTAIT PAS ═══
 *
 * `Listing` et `Applicant` sont nés avec le lot de la vacance. Les deux vivent
 * derrière `exigerAppartenance` : une annonce PUBLIÉE ne quittait donc pas le
 * produit, et les candidats se saisissaient à la main par le bailleur. Une
 * annonce qu'on ne peut envoyer à personne n'est pas une annonce.
 *
 * ═══ AUCUNE ÉCRITURE PUBLIQUE, ET C'EST UN CHOIX MESURÉ ═══
 *
 * Le lot n'ouvre PAS le formulaire de candidature, qui serait la moitié
 * naturelle de cette page. Raison : `grep -rn "rateLimit|throttle|429"` sur
 * `server/src/` ne rend aucun limiteur de cadence — le produit n'en a aucun,
 * et quatre routes répondent déjà sans authentification. Ajouter la première
 * ÉCRITURE publique avant une limite serait ajouter de l'exposition sur un trou
 * connu.
 *
 * Ce que cette page permet quand même est exactement l'usage du marché visé :
 * un bailleur envoie le lien sur WhatsApp, le prospect lit les faits, et répond
 * sur WhatsApp. Le produit ne prétend pas porter la conversation.
 *
 * ═══ CE QUI SORT, ET CE QUI NE SORT SURTOUT PAS ═══
 *
 * SORTENT : le loyer, la caution, la disponibilité, le type et la surface, le
 * quartier et l'immeuble, la description écrite par le bailleur, et le nom du
 * parc — une annonce anonyme ne se croit pas.
 *
 * NE SORTENT PAS, et chacun pour une raison :
 *
 *   · `unitId`, `parkId`, `buildingId` — des identifiants internes. Les rendre
 *     offrirait une clé à essayer sur les routes authentifiées.
 *   · LES CANDIDATS. `CHAMPS_ANNONCE` les embarque pour l'écran de gestion ;
 *     ici ce serait publier les noms, téléphones et courriels de gens qui ont
 *     postulé à un logement. C'est la fuite que cette route doit le plus
 *     éviter, et c'est pourquoi elle n'emploie PAS `CHAMPS_ANNONCE`.
 *   · LE LOCATAIRE SORTANT, s'il y en a un. Un logement en vacance peut être
 *     encore occupé jusqu'au départ.
 *   · TOUTE AUTRE UNITÉ du parc ou de l'immeuble.
 *
 * ═══ UN SEUL REFUS, LE MÊME POUR TOUT ═══
 *
 * 404 pour une annonce absente, un brouillon, une annonce fermée, et un
 * identifiant mal formé. Distinguer ces cas ferait de cette route un DÉTECTEUR
 * de brouillons : on apprendrait qu'une annonce existe mais n'est pas publiée,
 * donc qu'un logement se libère, à une adresse qu'on connaît.
 *
 * C'est la règle que `/api/access-requests` s'est déjà donnée — « le serveur
 * répond PAREIL que l'adresse existe ou non, sinon la route deviendrait un
 * détecteur de clientèle ».
 */
export const annoncePubliqueRouter = Router()

/**
 * Ce qu'un prospect reçoit. Écrit à la main, et JAMAIS dérivé de
 * `CHAMPS_ANNONCE` : ce dernier embarque les candidats, et un `select` partagé
 * entre une lecture de gestion et une lecture publique finirait par publier ce
 * qu'on ajoute à l'autre bout.
 */
const CHAMPS_PUBLICS = {
  rentMinor: true,
  depositMinor: true,
  currency: true,
  availableFrom: true,
  description: true,
  unit: {
    select: {
      label: true,
      type: true,
      surfaceSqm: true,
      building: {
        select: {
          name: true,
          district: true,
          park: { select: { name: true } },
        },
      },
    },
  },
} as const

annoncePubliqueRouter.get('/:listingId', async (req: Request, res: Response) => {
  /* L'IDENTIFIANT MAL FORMÉ REND 404, PAS 422. Il ne peut désigner aucune
     annonce, et un code distinct apprendrait au curieux qu'il a au moins la
     bonne forme — voir l'en-tête, « un seul refus, le même pour tout ». */
  const lu = z.string().uuid().safeParse(req.params.listingId)
  if (!lu.success) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  const annonce = await prisma.listing.findFirst({
    /* LE STATUT EST DANS LA CLAUSE, jamais vérifié après lecture : un filtre
       posé après coup laisse le brouillon traverser la couche qui décide, et
       c'est là qu'un `res.json` de trop le publie. */
    where: { id: lu.data, status: 'published' },
    select: CHAMPS_PUBLICS,
  })
  if (!annonce) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  res.json({
    rentMinor: annonce.rentMinor,
    depositMinor: annonce.depositMinor,
    currency: annonce.currency,
    availableFrom: annonce.availableFrom.toISOString().slice(0, 10),
    description: annonce.description,
    unitLabel: annonce.unit.label,
    unitType: annonce.unit.type,
    surfaceSqm: annonce.unit.surfaceSqm,
    buildingName: annonce.unit.building.name,
    district: annonce.unit.building.district,
    parkName: annonce.unit.building.park.name,
  })
})
