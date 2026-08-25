import express, { Router, type ErrorRequestHandler, type Request, type Response } from 'express'
import { z } from 'zod'
import { PLAFOND_DE_TRAVAIL_OCTETS, typeDesOctets } from './contrat.js'
import { StockageLocal } from './local.js'
import { leStockage } from './stockage.js'

/**
 * LE TRANSPORT LOCAL — la doublure de R2, et rien de plus.
 *
 * Ces deux routes ne sont pas des routes de produit. Elles remplacent, en
 * développement et en test, ce que le dépôt distant fait de lui-même : recevoir
 * un objet contre une autorisation signée, et le servir contre une adresse
 * signée. Le jour où R2 est branché, elles cessent de répondre — voir le
 * contrôle `instanceof` ci-dessous, qui les fait disparaître seul.
 *
 * ELLES NE SONT PAS DERRIÈRE `exigerAppartenance`, et ce n'est pas un oubli.
 * Le navigateur envoie DIRECTEMENT au dépôt : en production il ne présente
 * aucun cookie à R2, qui ne sait rien de nos comptes. Ce qui protège ici est
 * exactement ce qui protège là-bas — une clé de 128 bits qu'on ne devine pas,
 * une signature qu'on ne forge pas, et une échéance courte. Exiger une session
 * sur ce chemin donnerait à la doublure une protection que l'original n'a pas,
 * et le lot du navigateur découvrirait la différence en production.
 *
 * Le préfixe de montage vit dans `local.ts` : c'est l'adaptateur qui compose
 * les adresses, ces routes ne font que répondre au bout.
 */
export const stockageLocalRouter = Router()

/** Une clé est 32 hexadécimaux — hors de cette forme, il n'y a rien à servir. */
const schemaCle = z.string().regex(/^[0-9a-f]{32}$/)

const schemaLecture = z.object({
  expire: z.coerce.number().int().positive(),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
})

const schemaEnvoi = schemaLecture.extend({
  type: z.string().min(3).max(100),
  taille: z.coerce.number().int().positive(),
})

/**
 * Rend le dépôt local, ou `null` si ce n'est pas lui qui tourne.
 *
 * Le contrôle est ici plutôt qu'au montage parce que la substitution des tests
 * change le dépôt À CHAUD : un routeur qui aurait capturé l'instance au
 * démarrage servirait encore l'ancienne.
 */
function depotLocal(): StockageLocal | null {
  const depot = leStockage()
  return depot instanceof StockageLocal ? depot : null
}

/**
 * Reçoit les octets — ce que R2 fait contre une URL présignée.
 *
 * `express.raw` et non `express.json` : le corps est une image. Sa limite est
 * le plafond de travail lui-même, si bien qu'un dépôt démesuré est coupé PAR LE
 * FLUX, avant d'être tenu en mémoire. C'est la seule protection qui vaille
 * ici — `recevoir` compare une taille, mais il faut déjà avoir tout reçu pour
 * la connaître.
 *
 * `express.json({ limit: '256kb' })` d'`app.ts` reste intact : il ne parse que
 * `application/json`, et l'en-tête exigé par la réservation est un type
 * d'image. Aucun plafond global n'est relevé.
 */
stockageLocalRouter.put(
  '/:cle',
  express.raw({ type: '*/*', limit: PLAFOND_DE_TRAVAIL_OCTETS }),
  async (req: Request, res: Response) => {
    const depot = depotLocal()
    if (!depot) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const cle = schemaCle.safeParse(req.params.cle)
    const parametres = schemaEnvoi.safeParse(req.query)
    if (!cle.success || !parametres.success) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    /**
     * Un corps qui n'est pas un tampon a été parsé par quelqu'un d'autre —
     * `express.json`, si le déposant a annoncé du JSON. On ne devine pas ce
     * qu'il voulait déposer : on refuse le type.
     */
    if (!Buffer.isBuffer(req.body)) {
      res.status(415).json({ error: 'unsupported_media_type' })
      return
    }

    const resultat = await depot.recevoir(cle.data, req.body, {
      type: parametres.data.type,
      taille: parametres.data.taille,
      expire: parametres.data.expire,
      signature: parametres.data.signature,
    })

    if (!resultat.accepte) {
      // 413 pour la taille — l'appelant peut agir dessus. 403 pour la signature
      // et l'échéance : dire laquelle des deux a lâché aiderait surtout celui
      // qui essaie de forger.
      res.status(resultat.motif === 'taille' ? 413 : 403).json({ error: resultat.motif })
      return
    }

    res.status(204).end()
  },
)

/**
 * Sert les octets — ce que R2 fait contre une URL de lecture présignée.
 *
 * C'EST ICI QUE LA SIGNATURE CESSE D'ÊTRE DÉCORATIVE. Le lot précédent la
 * calculait sans que rien ne la contrôle ; une adresse périmée ou trafiquée
 * était aussi bonne qu'une autre, et la durée courte n'existait que dans le
 * nom.
 */
stockageLocalRouter.get('/:cle', async (req: Request, res: Response) => {
  const depot = depotLocal()
  if (!depot) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  const cle = schemaCle.safeParse(req.params.cle)
  const parametres = schemaLecture.safeParse(req.query)
  if (!cle.success || !parametres.success) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  const verdict = depot.verifierLecture(cle.data, parametres.data.expire, parametres.data.signature)
  if (!verdict.accepte) {
    res.status(403).json({ error: verdict.motif })
    return
  }

  const octets = await depot.octetsDe(cle.data)
  if (!octets) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  /**
   * Le type est RELU dans les octets, jamais repris d'une base ou d'un
   * paramètre. Ces routes ne connaissent aucun modèle — comme R2, qui ne
   * connaît que son seau. Un objet qui n'est plus une image n'est plus servi
   * du tout, quoi qu'en dise la ligne qui le référence.
   */
  const type = typeDesOctets(octets)
  if (!type) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  // `nosniff` : le navigateur ne doit pas ré-interpréter ce que nous venons de
  // reconnaître. Sans lui, notre lecture d'entête serait une opinion parmi deux.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // `no-store` : l'adresse est courte par construction, un cache qui la survit
  // rendrait la photo lisible après l'expiration de l'autorisation.
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', type)
  res.status(200).send(Buffer.from(octets))
})

/**
 * Les erreurs de ces deux routes, traitées ici.
 *
 * `express.raw` lève un `entity.too.large` quand le flux dépasse la limite. Le
 * gestionnaire d'`app.ts` rendrait 500 — « le serveur a un défaut » — pour ce
 * qui est un refus parfaitement délibéré. Un routeur porte son propre
 * gestionnaire, et `app.ts` n'a pas à connaître ce cas.
 */
const erreursDuTransport: ErrorRequestHandler = (err, _req, res, next) => {
  const statut = (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode
  if (statut === 413) {
    res.status(413).json({ error: 'taille' })
    return
  }
  next(err)
}
stockageLocalRouter.use(erreursDuTransport)
