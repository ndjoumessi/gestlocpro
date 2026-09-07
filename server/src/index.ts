import { createApp } from './app.js'
import { env } from './env.js'
import { installerArretPropre } from './arretPropre.js'

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
 *
 * LE CORPS EST PARTI DANS `arretPropre.ts`, et ce n'est pas du rangement :
 * écrit ici, il était INVÉRIFIABLE — importer ce fichier ouvre un port et lit
 * `env`, donc aucun cas ne pouvait mesurer si une requête en vol survit. Elle
 * survit ; `arretPropre.test.ts` le mesure maintenant plutôt que de le déduire.
 */
installerArretPropre(serveur)
