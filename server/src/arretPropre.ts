import type { Server } from 'node:http'

/**
 * L'ARRÊT PROPRE, SORTI DE `index.ts` POUR ÊTRE MESURABLE.
 *
 * Il y vivait en six lignes au niveau du module, et c'est ce qui le rendait
 * invérifiable : importer `index.ts` OUVRE un port et lit `env`. Aucun cas ne
 * pouvait donc répondre à la seule question qui compte — « une requête EN VOL
 * survit-elle à la relève ? » —, et le lot qui a réparé la passation du signal
 * a dû le dire en réserve : « que les dix secondes de grâce servent réellement
 * reste déduit du code, pas observé ».
 *
 * ═══ CE QUE `serveur.close()` FAIT, ET CE QU'IL NE FAIT PAS ═══
 *
 * Il cesse d'ACCEPTER, il n'interrompt pas. Les échanges déjà commencés vont à
 * leur terme, et le rappel ne vient qu'après le dernier. C'est précisément la
 * propriété qu'on veut : une transaction d'écriture engagée au moment où
 * l'orchestrateur envoie son signal ne doit pas se retrouver coupée en deux.
 *
 * ═══ POURQUOI UN DÉLAI DE GRÂCE MALGRÉ TOUT ═══
 *
 * Une connexion tenue ouverte — une requête qui ne finit jamais, un client qui
 * garde la ligne — empêcherait `close` de rendre la main, et le conteneur
 * serait tué de force après le délai de l'orchestrateur, sans que rien ne le
 * dise. On sort donc de nous-mêmes au bout du délai, avec un code NON NUL :
 * c'est un aveu, pas un succès, et il doit se distinguer dans les journaux.
 *
 * ═══ LES DEUX POINTS D'INJECTION, ET ILS NE SONT PAS DÉCORATIFS ═══
 *
 * `sortir` et `delaiDeGraceMs` existent pour le cas, et c'est assumé : sans
 * eux, mesurer cette fonction demanderait de tuer le processus de test, ou
 * d'attendre dix secondes pour vérifier le repli. Leurs valeurs par défaut
 * sont celles de la production, si bien que `index.ts` ne les nomme pas.
 */
export function installerArretPropre(
  serveur: Server,
  {
    sortir = (code: number) => process.exit(code),
    delaiDeGraceMs = 10_000,
  }: { sortir?: (code: number) => void; delaiDeGraceMs?: number } = {},
): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      serveur.close(() => sortir(0))
      /* `unref` : ce minuteur ne doit pas MAINTENIR le processus en vie. Sans
         lui, un serveur qui s'est fermé en deux cents millisecondes attendrait
         quand même la fin du délai avant de rendre la main. */
      setTimeout(() => sortir(1), delaiDeGraceMs).unref()
    })
  }
}
