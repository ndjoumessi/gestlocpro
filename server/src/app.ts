import express, { type ErrorRequestHandler, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { ZodError } from 'zod'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './env.js'
import { authRouter } from './auth/routes.js'
import { parksRouter } from './parks/routes.js'

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

  /**
   * Journal des appels d'API : méthode, chemin, statut, durée.
   *
   * Son absence a coûté cher. Une inscription échouait en production et les
   * journaux ne portaient que le démarrage : impossible de distinguer « la
   * requête est refusée » de « la requête n'arrive jamais » — deux causes
   * opposées, l'une dans le serveur, l'autre hors de lui. Faute de pouvoir
   * trancher, on interroge l'utilisateur, ce qui est la mauvaise façon de
   * chercher.
   *
   * Ni corps ni en-têtes : une inscription porte un mot de passe, une session
   * porte un jeton. Le chemin et le statut suffisent à situer une panne, et
   * n'exposent rien. Le chemin de santé est écarté — Railway l'appelle sans
   * cesse et noierait le reste.
   */
  app.use('/api', (req: Request, res: Response, next) => {
    if (req.path === '/health') return next()
    const debut = process.hrtime.bigint()
    /**
     * Le chemin est retenu MAINTENANT, et non dans le rappel de fin.
     *
     * Express réécrit `req.url` à chaque routeur imbriqué pour le rendre
     * relatif au point de montage, et ne le restaure pas toujours à l'identique
     * selon le chemin suivi. Le lire après coup donnait deux formes fausses et
     * contradictoires pour deux routes voisines — `/api/api/auth/signup` et
     * `/api/me`. Un journal dont les chemins mentent est pire que pas de
     * journal : il oriente la recherche au mauvais endroit.
     *
     * La chaîne de requête est retirée : rien ne la lit ici, et elle est le
     * premier endroit où une donnée personnelle s'égare dans un journal.
     */
    const chemin = req.originalUrl.split('?')[0]
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - debut) / 1e6
      console.log(`${req.method} ${chemin} → ${res.statusCode} (${ms.toFixed(0)} ms)`)
    })
    next()
  })

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true })
  })

  // Express 5 transmet lui-même les rejets de promesse au gestionnaire
  // d'erreurs : pas besoin d'envelopper chaque route asynchrone. C'était la
  // principale verrue d'Express 4, et l'oublier une seule fois y laissait une
  // requête suspendue jusqu'au délai d'expiration du client.
  app.use('/api/auth', authRouter)
  app.use('/api/parks', parksRouter)

  // 404 en JSON pour l'API : le client parse toutes ses réponses, et une page
  // HTML d'erreur produirait une exception de désérialisation qui masquerait
  // la vraie cause — une route mal orthographiée.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' })
  })

  /**
   * Le client est servi par CE serveur en production.
   *
   * Ce n'est pas une commodité de déploiement : c'est la condition pour que le
   * cookie de session reste **de première partie**. Deux domaines distincts en
   * feraient un cookie tiers, que Safari bloque déjà et que Chrome s'apprête à
   * bloquer — l'authentification marcherait en développement, derrière le
   * mandataire Vite, et nulle part ailleurs. Le commentaire de `vite.config.ts`
   * annonçait cette disposition ; la voici.
   */
  if (env.NODE_ENV === 'production') {
    /**
     * Compilé, ce fichier vit dans `server/dist/src/` : trois niveaux à
     * remonter pour atteindre le `dist/` du client, à la racine du dépôt.
     * `CLIENT_DIST` permet de le dire autrement si la disposition change —
     * un chemin relatif calculé sur la sortie de compilation est exact tant
     * que personne ne touche à `outDir`, et silencieusement faux ensuite.
     */
    const client =
      process.env.CLIENT_DIST ?? fileURLToPath(new URL('../../../dist', import.meta.url))
    app.use(express.static(client, { maxAge: '1h', index: false }))

    // Toute autre adresse rend `index.html` : le routage est côté client, et un
    // rechargement sur `/app/cautions` doit ouvrir l'application, pas un 404.
    // Placé APRÈS l'API, donc `/api/inconnu` rend bien du JSON.
    app.get(/.*/, (_req: Request, res: Response) => {
      res.sendFile(join(client, 'index.html'))
    })
  } else {
    app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'not_found' })
    })
  }

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
