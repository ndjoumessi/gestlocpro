import { createApp } from './app.js'
import { env } from './env.js'

const app = createApp()

const serveur = app.listen(env.PORT, () => {
  console.log(`API sur http://localhost:${env.PORT} · client attendu sur ${env.CLIENT_ORIGIN}`)
})

/**
 * Arrêt propre.
 *
 * Sans cela, `docker stop` et les redéploiements coupent les requêtes en cours
 * au milieu — y compris une transaction d'écriture. Le délai de grâce laisse
 * les réponses en vol se terminer avant de fermer.
 */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    serveur.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
