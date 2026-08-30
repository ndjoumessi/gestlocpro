/**
 * ÉCARTER L'AGENT DE SERVICE DES CONTEXTES DE MESURE.
 *
 * `src/main.tsx` enregistre `/sw.js` en production — donc sur le paquet que ces
 * portes servent, puisqu'elles mesurent `dist/` derrière `vite preview` et non
 * le serveur de développement.
 *
 * ═══ CE QU'IL FAUSSERAIT, ET DANS QUEL SENS ═══
 *
 * Deux distorsions, en sens CONTRAIRES, et c'est pour cela qu'aucune ne se
 * compense :
 *
 *   À LA PREMIÈRE NAVIGATION, l'agent AJOUTE. Son enregistrement est une requête
 *   de plus et quelque quatre kilo-octets de plus, que l'utilisateur paie
 *   vraiment mais qui n'appartiennent à aucun écran : ils tomberaient sur celui
 *   qui a eu la malchance d'être mesuré en premier.
 *
 *   AUX SUIVANTES, il RETIRE. Les actifs hachés partent du cache local ; octets
 *   et requêtes s'effondrent, et la porte annoncerait un gain que personne ne
 *   reçoit au premier chargement — précisément celui qu'on cherche à garder.
 *
 * ═══ POURQUOI UNE CONSTANTE PARTAGÉE, ET NON LA LIGNE RECOPIÉE ═══
 *
 * Cette option se pose sur seize contextes répartis dans dix fichiers. Recopier
 * le motif à chaque endroit, c'est seize proses à faire vieillir ensemble — la
 * panne qu'`appariements.test.ts` a payée « pendant des lots ».
 * `police-large.mjs` a posé le geste inverse deux commits plus tôt : un
 * instrument, un fichier, une explication.
 *
 * ET LE COMPTE N'EST PAS TENU ICI. Ces deux nombres sont de la prose, donc
 * périssables — la première rédaction de cet en-tête disait « quatorze » et
 * « neuf », et se trompait déjà au moment où elle était écrite. C'est
 * `src/design-system/agentDeServiceEcarte.test.ts` qui fait autorité : il
 * parcourt `scripts/`, exige la constante sur CHAQUE `newContext`, et nomme un
 * par un les deux seuls exemptés — ceux qui posent leur document par
 * `setContent` et n'atteignent jamais le produit.
 *
 * Cette garde n'est pas préventive : elle est née ROUGE sur ce lot même, en
 * désignant par fichier et par ligne les trois contextes que la rédaction à la
 * main avait manqués.
 *
 * ═══ CE QUE CETTE CONSTANTE NE DIT PAS ═══
 *
 * Que l'agent fonctionne. Elle l'écarte, ce qui est le contraire de l'éprouver.
 * Son routage est jugé par `src/design-system/agentDeService.test.ts`, qui
 * appelle `strategiePour` sans navigateur.
 */
export const SANS_AGENT_DE_SERVICE = { serviceWorkers: 'block' }
