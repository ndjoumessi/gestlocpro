import express, { type ErrorRequestHandler, type Request, type Response } from 'express'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { ZodError } from 'zod'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { env } from './env.js'
import { authRouter } from './auth/routes.js'
import { parksRouter, rejoindreRouter } from './parks/routes.js'
import { SourceBCE, creerServiceDeTaux, type SourceDeTaux } from './taux/taux.js'

/**
 * Répertoire du client construit.
 *
 * Compilé, ce fichier vit dans `server/dist/src/` : trois niveaux à remonter
 * pour atteindre le `dist/` du client, à la racine du dépôt. `CLIENT_DIST`
 * permet de le dire autrement si la disposition change — un chemin relatif
 * calculé sur la sortie de compilation est exact tant que personne ne touche à
 * `outDir`, et silencieusement faux ensuite.
 *
 * Défini ici, hors de la branche de production, parce que DEUX choses en
 * dépendent : le service des fichiers et le contrôle de santé. Les laisser
 * calculer chacun le leur, c'est se ménager le jour où l'un vérifie un
 * répertoire que l'autre ne sert pas.
 */
const CLIENT_DIST =
  process.env.CLIENT_DIST ?? fileURLToPath(new URL('../../../dist', import.meta.url))

/**
 * Nom du paquet JavaScript servi, lu dans `index.html`.
 *
 * Vite hache ce nom d'après le contenu : il change à chaque construction qui
 * change quelque chose, et à aucune autre. C'est donc une version exacte, que
 * personne n'a à tenir à jour.
 *
 * Le fichier est relu à chaque appel plutôt que mémorisé : un conteneur vit
 * plus longtemps qu'un déploiement dans certaines dispositions, et une valeur
 * figée au démarrage finirait par annoncer une version qui n'est plus servie —
 * l'inverse exact du service rendu. La lecture coûte une poignée de
 * microsecondes, et l'appel est rare.
 */
function paquetServi(): string | null {
  try {
    const html = readFileSync(join(CLIENT_DIST, 'index.html'), 'utf8')
    return /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html)?.[1] ?? null
  } catch {
    // Pas de client construit — développement, ou déploiement incomplet. Le
    // client saura qu'il n'y a rien à comparer.
    return null
  }
}

/**
 * Application Express, séparée du démarrage du serveur.
 *
 * `createApp()` rend une application non écoutante : les tests la montent
 * directement, sans ouvrir de port ni gérer d'arrêt. Un test qui doit
 * réellement écouter finit par attendre des délais et par échouer selon la
 * charge de la machine — le port est un détail du déploiement, pas du produit.
 */
export function createApp(options: { taux?: SourceDeTaux } = {}) {
  const app = express()

  /**
   * LE SERVICE DE TAUX, créé UNE FOIS par application.
   *
   * Son cache vit dans cette clôture : une instance par serveur, et non une par
   * requête. Le créer dans la route donnerait un cache neuf à chaque appel,
   * c'est-à-dire pas de cache — et un appel à la Banque centrale européenne par
   * chargement d'écran.
   *
   * La SOURCE est injectable pour que les cas n'appellent jamais l'extérieur :
   * un test qui dépend d'un tiers échoue le jour où ce tiers est en panne, et
   * l'on croit alors que c'est le produit.
   */
  const taux = creerServiceDeTaux(options.taux ?? new SourceBCE())

  // Express annonce sa présence dans un en-tête. C'est une information gratuite
  // offerte à qui cherche une version vulnérable.
  app.disable('x-powered-by')

  /**
   * TOUT CE QUI PART SUR LE FIL EST COMPRESSÉ — et c'est le plus gros gain
   * mesuré de ce dépôt.
   *
   * LE DÉFAUT. Ce serveur sert le client construit par `express.static`, plus
   * bas, et rien ne le compressait : ni intergiciel ici, ni mandataire dans le
   * `Dockerfile`. Le paquet partait BRUT. Mesuré le 2026-08-30 sur la
   * construction du jour, octets servis contre octets gzippés :
   *
   *   JS de la vitrine         426 674  ->  142 284   (−284 390)
   *   feuille de style          71 435  ->   13 146   ( −58 289)
   *   index.html                 6 977  ->    3 390   (  −3 587)
   *   JS de l'espace applicatif 227 189 ->   59 980   (−167 209)
   *
   * La vitrine seule tombe de 505 086 à 158 820 octets, soit environ SEPT
   * SECONDES à 400 kb/s — le débit que tout ce dépôt retient comme profil du
   * marché visé, et le premier écran que voit un prospect.
   *
   * POURQUOI PERSONNE NE L'AVAIT VU. Les deux gardes de poids du client pèsent
   * dans deux unités différentes : `BUDGET_PREMIER_CHARGEMENT` gzippe avant de
   * compter — donc décrivait une compression que personne n'effectuait — quand
   * `poids-ecrans` compte les corps réels. Les deux étaient exactes, et le
   * produit vivait dans leur écart. Aucune ne pouvait voir cet écart, parce
   * qu'aucune ne parle à CE serveur : elles mesurent `vite preview`.
   *
   * AVANT LES ROUTES, ET NON JUSTE AVANT LES FICHIERS. Posé plus bas, cet
   * intergiciel ne servirait que le client. Le JSON de l'API compresse mieux
   * que tout le reste, et c'est le locataire qui le télécharge — la liste de
   * ses quittances, ses relevés, ses signalements — sur le même réseau.
   *
   * LA NÉGOCIATION EST LA FONCTIONNALITÉ : `compression` ne touche rien tant
   * que le client n'a pas dit qu'il l'accepte, et laisse passer ce qui pèse
   * moins de 1 024 octets, où l'en-tête coûterait plus que le gain. Les deux
   * comportements sont gardés dans `compression.test.ts`, qui garde le FAIT de
   * l'en-tête et jamais un TAUX — un taux dépend du contenu, et le verrouiller
   * ferait rougir la porte au premier actif incompressible.
   */
  app.use(compression())

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

  /**
   * Santé : ce que le déploiement doit RÉELLEMENT fournir.
   *
   * L'ancienne version répondait `{ ok: true }` dès que le processus écoutait.
   * Un déploiement a donc été déclaré `SUCCESS` alors que le client avait
   * disparu de l'image : l'API répondait, la page d'accueil rendait 500, et
   * rien ne le signalait. « Le serveur répond » avait été pris pour « le site
   * fonctionne ».
   *
   * Un contrôle de santé qui ne couvre qu'une moitié du produit fait pire que
   * ne rien contrôler : il donne le feu vert. On vérifie donc aussi la présence
   * du client — la seule chose que ce serveur promet et qui peut manquer sans
   * l'empêcher de démarrer.
   *
   * En développement, le client est servi par Vite : il n'y a rien à vérifier
   * ici, et l'exiger ferait échouer un environnement parfaitement sain.
   */
  app.get('/api/health', (_req: Request, res: Response) => {
    if (env.NODE_ENV !== 'production') {
      res.json({ ok: true })
      return
    }
    if (!existsSync(join(CLIENT_DIST, 'index.html'))) {
      res.status(503).json({ ok: false, error: 'client_absent' })
      return
    }
    res.json({ ok: true })
  })

  /**
   * Version servie, pour que le client sache qu'il est périmé.
   *
   * Une application React ne recharge pas son code en naviguant : un onglet
   * ouvert avant un déploiement garde le sien indéfiniment. Plusieurs échanges
   * ont été perdus aujourd'hui à cause de cela — un défaut corrigé et déployé
   * restait présent à l'écran, et le rechargement forcé n'était demandé qu'après
   * coup, quand la confusion s'était déjà installée.
   *
   * La version est le NOM du paquet servi, que Vite hache d'après son contenu.
   * Rien à incrémenter, rien à oublier de mettre à jour : deux constructions
   * identiques portent le même nom, deux constructions différentes non. Un
   * numéro tenu à la main aurait fini par mentir.
   */
  app.get('/api/version', (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    res.json({ paquet: paquetServi() })
  })

  // Express 5 transmet lui-même les rejets de promesse au gestionnaire
  // d'erreurs : pas besoin d'envelopper chaque route asynchrone. C'était la
  // principale verrue d'Express 4, et l'oublier une seule fois y laissait une
  // requête suspendue jusqu'au délai d'expiration du client.
  /**
   * LES TAUX, PUBLICS ET SANS SESSION.
   *
   * La page des tarifs les emploie avant toute inscription, et la démonstration
   * n'a pas de compte. Exiger un jeton reviendrait à réserver la conversion à
   * ceux qui sont déjà entrés.
   *
   * Ils ne portent aucune donnée du produit : ce sont des cours publics, servis
   * tels que la BCE les publie.
   */
  app.get('/api/rates', async (_req: Request, res: Response) => {
    const cours = await taux.lire()
    /* Un quart d'heure côté client : les cours ne bougent qu'une fois par jour
       ouvré, et le cache du serveur porte déjà la fraîcheur réelle. */
    res.set('Cache-Control', 'public, max-age=900')
    res.json(cours)
  })

  app.use('/api/auth', authRouter)
  // Hors de `/api/parks/:parkId` : on ne peut pas exiger l'appartenance à un
  // parc pour demander à le rejoindre.
  app.use('/api/join', rejoindreRouter)
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
    app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }))

    // Toute autre adresse rend `index.html` : le routage est côté client, et un
    // rechargement sur `/app/cautions` doit ouvrir l'application, pas un 404.
    // Placé APRÈS l'API, donc `/api/inconnu` rend bien du JSON.
    app.get(/.*/, (_req: Request, res: Response) => {
      res.sendFile(join(CLIENT_DIST, 'index.html'))
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
