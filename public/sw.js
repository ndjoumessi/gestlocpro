/*
  L'APPLICATION S'OUVRE SANS RÉSEAU — et jamais sur un paquet périmé.

  ═══ CE QU'UN AGENT DE SERVICE PEUT CASSER, ET QUI DICTE TOUT LE RESTE ═══

  Un cache mal fait est le pire défaut qu'on puisse déployer : il SURVIT au
  correctif. Un `index.html` servi depuis le cache renvoie éternellement vers un
  paquet qui n'existe plus, l'écran reste blanc, et l'utilisateur n'a aucun geste
  à sa disposition — vider le cache d'un site est hors de portée de qui ne sait
  pas que le problème vient de là. Les trois règles ci-dessous existent pour
  qu'aucun déploiement ne puisse se retrouver derrière un cache.

  ═══ TROIS RÈGLES, ET UNE SEULE EST UN CACHE ═══

  1. LA NAVIGATION VA AU RÉSEAU D'ABORD. Le document est ce qui nomme les
     paquets ; il doit donc être le plus frais possible. En ligne, on sert
     toujours la réponse du réseau et on la range. Hors ligne — et seulement là —
     on rend la dernière rangée. Un déploiement est ainsi pris à la première
     visite en ligne, sans attendre quoi que ce soit.

  2. LES ACTIFS VONT AU CACHE D'ABORD, et c'est sans risque parce que leur nom
     porte un hachage de CONTENU : `index-BWrRwvP9.js` ne désignera jamais deux
     paquets différents. Servir celui-là depuis le cache, c'est servir exactement
     ce que le réseau rendrait, en zéro milliseconde. Un paquet neuf porte un
     autre nom, donc une autre entrée.

  3. TOUT LE RESTE PASSE. L'API n'est jamais mise en cache : elle rend l'état
     d'un parc à un instant, et le servir depuis un cache montrerait un loyer
     encaissé qui ne l'est plus. Les autres origines non plus — la fonderie sait
     poser ses propres en-têtes, et son cache HTTP fait déjà ce travail.

  ═══ CE QUE CE FICHIER NE FAIT PAS ═══

  AUCUN PRÉCHARGEMENT. Un agent qui télécharge la liste des actifs à
  l'installation demande de connaître leurs noms hachés, donc une génération au
  moment de la construction. On s'en passe : le cache des ACTIFS se remplit de ce
  que l'utilisateur a vraiment visité.

  LA COQUILLE, ELLE, N'A PAS BESOIN D'ÊTRE VISITÉE ÉCRAN PAR ÉCRAN, et la
  première rédaction de ce paragraphe se trompait en l'écrivant. Elle disait
  « un écran jamais ouvert ne s'ouvrira pas dans le tunnel », par symétrie avec
  les actifs — mais la symétrie est fausse : les actifs ont chacun leur nom, le
  document n'en a qu'un. Le serveur rend le même `index.html` pour toute adresse,
  mesuré sur la production le 2026-08-30 : quatre routes, une seule empreinte
  SHA-256. Une coquille rangée les ouvre donc TOUTES — voir `CLE_DE_COQUILLE`.

  CE QUI RESTE VRAI : la première visite doit se faire EN LIGNE, et un écran dont
  le morceau de code paresseux n'a jamais été téléchargé rendra sa coquille sans
  son contenu. Le tunnel n'est pas une seconde installation.

  AUCUNE ÉCRITURE DIFFÉRÉE. Envoyer un paiement ou une photo hors ligne demande
  une file persistante et une résolution de conflits — un produit à soi seul, pas
  une ligne dans un agent. Hors ligne, ce produit se LIT.

  ═══ LA SORTIE DE SECOURS ═══

  `VERSION` nomme les caches. La changer fait table rase à l'activation : c'est
  le geste qui répare une bévue de cache, et il tient en un caractère. Sans elle,
  la seule issue serait de demander à chaque utilisateur de vider son navigateur.
*/

const VERSION = 'v1'
const COQUILLE = `gestlocpro-coquille-${VERSION}`
const ACTIFS = `gestlocpro-actifs-${VERSION}`

/**
 * LA CLÉ SOUS LAQUELLE LA COQUILLE EST RANGÉE UNE SECONDE FOIS.
 *
 * Ce produit est une application d'UNE SEULE PAGE : le serveur rend le même
 * `index.html` pour toute adresse qui n'est ni `/api/` ni un actif — c'est la
 * règle attrape-tout de `server/src/app.ts`, et elle est mesurée plutôt que
 * supposée. Relevé sur la production le 2026-08-30 : « / », « /demo/paiements »,
 * « /demo/cautions » et « /app/parc » rendent quatre fois la MÊME empreinte
 * SHA-256. `server/src/app.test.ts` en fait une garde, pour que ce soit encore
 * vrai le jour où quelqu'un ajoutera une méta par route.
 *
 * Sans cette clé, l'agent ne pouvait ouvrir hors ligne que les adresses
 * EXACTEMENT visitées : `/demo/cautions` restait fermé à qui n'avait ouvert que
 * `/demo/paiements`, alors que le document à servir était le même, déjà rangé,
 * à un octet près. L'en-tête présentait ce choix comme voulu — « le cache se
 * remplit de ce que l'utilisateur a VRAIMENT visité » — ce qui est vrai des
 * ACTIFS, dont les noms diffèrent, et faux du document, qui n'en a qu'un.
 */
const CLE_DE_COQUILLE = '/__coquille__'

/**
 * La stratégie d'une requête — pure, et exposée pour être éprouvée.
 *
 * Le routage est la seule chose qui peut rendre cet agent dangereux, et c'est la
 * seule qu'un test peut vérifier sans navigateur. On la sépare donc du reste, et
 * `self.strategiePour` la rend lisible depuis `agentDeService.test.ts`.
 */
function strategiePour(requete, origine) {
  if (requete.method !== 'GET') return 'ignorer'

  const url = new URL(requete.url)
  if (url.origin !== origine) return 'ignorer'
  if (url.pathname.startsWith('/api/')) return 'ignorer'

  if (requete.mode === 'navigate') return 'reseau-d-abord'
  if (url.pathname.startsWith('/assets/')) return 'cache-d-abord'
  return 'ignorer'
}

self.strategiePour = strategiePour

self.addEventListener('install', () => {
  /* On prend la main tout de suite. Un agent neuf qui attendrait la fermeture
     de tous les onglets laisserait un agent fautif servir pendant des jours —
     et c'est justement l'agent fautif qu'on veut pouvoir remplacer vite. */
  self.skipWaiting()
})

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    (async () => {
      const garder = new Set([COQUILLE, ACTIFS])
      for (const nom of await caches.keys()) {
        if (nom.startsWith('gestlocpro-') && !garder.has(nom)) await caches.delete(nom)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (evenement) => {
  const strategie = strategiePour(evenement.request, self.location.origin)
  if (strategie === 'ignorer') return

  if (strategie === 'reseau-d-abord') {
    evenement.respondWith(
      (async () => {
        try {
          const reponse = await fetch(evenement.request)
          /* ON NE RANGE QUE CE QUI A ABOUTI, comme la branche des actifs plus
             bas, et l'oubli aurait coûté cher : pendant un déploiement, le bord
             rend une page d'erreur en 502. Rangée, elle ÉCRASE la dernière
             coquille valide, et c'est elle que l'utilisateur retrouverait hors
             ligne — un « l'application ne répond pas » figé, des jours après que
             le déploiement a réussi. Exactement la panne que l'en-tête de ce
             fichier annonce : un cache qui survit à son correctif.

             La réponse est rendue telle quelle dans les deux cas. En ligne, ce
             que le serveur dit vaut mieux qu'une page d'hier qui masquerait la
             panne. */
          if (reponse.ok) {
            /* On range DEUX COPIES : un corps de réponse ne se lit qu'une fois,
               et c'est l'original que la page doit recevoir. La première sous
               l'adresse demandée, la seconde sous `CLE_DE_COQUILLE` — le repli
               de toute adresse jamais visitée. */
            const cache = await caches.open(COQUILLE)
            await cache.put(evenement.request, reponse.clone())
            await cache.put(CLE_DE_COQUILLE, reponse.clone())
          }
          return reponse
        } catch {
          const range = await caches.match(evenement.request)
          if (range) return range
          /* L'ADRESSE EXACTE N'A JAMAIS ÉTÉ VISITÉE, mais le document, si. On
             sert la dernière coquille rangée : elle est le même fichier, par
             construction du serveur. C'est ce qui fait qu'un gestionnaire hors
             ligne ouvre un écran qu'il n'avait pas ouvert avant de descendre
             dans la cage d'escalier. */
          const coquille = await caches.match(CLE_DE_COQUILLE)
          if (coquille) return coquille
          /* Ni réseau, ni cette adresse, ni AUCUNE coquille : la première visite
             ne s'est jamais faite en ligne. On laisse le navigateur rendre SA
             page d'erreur, qui dit « pas de connexion » dans la langue du
             système. En inventer une ici serait moins clair, et une de plus à
             traduire. */
          throw new Error('hors ligne, et aucune coquille n’a jamais été rangée')
        }
      })(),
    )
    return
  }

  evenement.respondWith(
    (async () => {
      const range = await caches.match(evenement.request)
      if (range) return range
      const reponse = await fetch(evenement.request)
      /* On ne range QUE ce qui a abouti : une 404 mise en cache sous un nom
         haché survivrait au correctif qui la produit. */
      if (reponse.ok) {
        const cache = await caches.open(ACTIFS)
        await cache.put(evenement.request, reponse.clone())
      }
      return reponse
    })(),
  )
})
