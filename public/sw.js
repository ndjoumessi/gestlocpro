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
  moment de la construction. On s'en passe : le cache se remplit de ce que
  l'utilisateur a VRAIMENT visité, ce qui est aussi ce qu'il retrouvera hors
  ligne. La contrepartie est écrite — la première visite doit se faire en ligne,
  et un écran jamais ouvert ne s'ouvrira pas dans le tunnel.

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
          /* On range une COPIE : un corps de réponse ne se lit qu'une fois, et
             c'est l'original que la page doit recevoir. */
          const cache = await caches.open(COQUILLE)
          await cache.put(evenement.request, reponse.clone())
          return reponse
        } catch {
          const range = await caches.match(evenement.request)
          if (range) return range
          /* Ni réseau ni cache : on laisse le navigateur rendre SA page
             d'erreur, qui dit « pas de connexion » dans la langue du système.
             En inventer une ici serait moins clair, et une de plus à traduire. */
          throw new Error('hors ligne, et cette adresse n’a jamais été visitée')
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
