import express, { type ErrorRequestHandler, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { ZodError } from 'zod'
import { env } from './env.js'

/**
 * Application Express, séparée du démarrage du serveur.
 *
 * `createApp()` rend une application non écoutante : les tests la montent
 * directement, sans ouvrir de port ni gérer d'arrêt. Un test qui doit
 * réellement écouter finit par attendre des délais et par échouer selon la
 * charge de la machine — le port est un détail du déploiement, pas du produit.
 */
export function createApp() {
  const app = express()

  // Express annonce sa présence dans un en-tête. C'est une information gratuite
  // offerte à qui cherche une version vulnérable.
  app.disable('x-powered-by')

  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser(env.SESSION_SECRET))

  /**
   * CORS restreint à l'origine du client, avec les cookies autorisés.
   *
   * `credentials: true` interdit le joker `*` — la spécification l'exige, et un
   * navigateur refuse silencieusement la réponse sinon. On renvoie donc
   * l'origine exacte, et seulement si elle est celle attendue.
   */
  app.use((req, res, next) => {
    const origine = req.headers.origin
    if (origine === env.CLIENT_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', origine)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    next()
  })

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true })
  })

  // 404 en JSON : le client parse toutes les réponses de l'API, et une page
  // HTML d'erreur produirait une exception de désérialisation qui masquerait
  // la vraie cause — une route mal orthographiée.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' })
  })

  const erreurs: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'validation_failed',
        // Les champs fautifs sont nommés : le client rattache l'erreur au bon
        // champ plutôt que d'afficher un message global.
        fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
      return
    }

    // Toute autre exception est un défaut du serveur. Son message peut porter
    // un fragment de requête ou un chemin de fichier : on le journalise, on ne
    // le renvoie pas.
    console.error(err)
    res.status(500).json({ error: 'internal_error' })
  }
  app.use(erreurs)

  return app
}
