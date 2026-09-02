/**
 * COUPER L'API LOCALE DES CONTEXTES QUI MESURENT DES ÉCRANS ANONYMES.
 *
 * ═══ CE QUI S'EST PASSÉ, ET POURQUOI CE N'EST PAS UN DÉFAUT DU PRODUIT ═══
 *
 * `plafond-coquille.mjs` a rougi trois fois — `/app` à ses trois largeurs —
 * en affirmant qu'une route déclarée sans écran rendait un `<main>`. Le produit
 * n'avait pas changé. La machine, si : le serveur d'API de développement
 * tournait.
 *
 * La chaîne, mesurée le 2026-09-03 :
 *
 *   1. `vite preview` HÉRITE du proxy du serveur de développement. Ce n'est pas
 *      une supposition : `resolvePreviewOptions` de vite 7.3.6 écrit
 *      `proxy: preview?.proxy ?? server.proxy`, et `vite.config.ts` ne déclare
 *      aucun bloc `preview`. `/api/*` part donc vers `localhost:3001`.
 *   2. Si ce port répond, `/auth/me` rend un 401 parfaitement valide.
 *   3. `SessionProvider` bascule en « anonyme », `RequireAuth` renvoie vers
 *      `/connexion` — et cet écran-là porte un `<main>`.
 *
 * Port éteint, le proxy échoue, la session part en `horsLigne`, et `/app` rend
 * l'écran « serveur injoignable » : un `<div>` hors coquille, sans `<main>`.
 * LA MÊME PORTE REND DONC DEUX VERDICTS SELON CE QUI TOURNE À CÔTÉ.
 *
 * ═══ POURQUOI C'EST LE PIRE GENRE DE ROUGE ═══
 *
 * `plafond-coquille.mjs` le dit déjà de lui-même, deux cents lignes plus haut :
 * « UNE GARDE QUI ROUGIT POUR UNE RAISON QUI N'EST PAS DANS LE CODE est pire
 * qu'une garde absente : elle apprend à relancer jusqu'au vert, et le jour où
 * le rouge est vrai, il est relancé aussi. » Ici le rouge ne se relance même
 * pas : il s'éteint en fermant un terminal, ce que personne ne relie jamais à
 * la porte.
 *
 * ET LE ROUGE N'ÉTAIT PAS LE PIRE. `mesure-ui.mjs` visite `/app` sans session
 * lui aussi. Il n'a rien refusé : il a mesuré `/connexion` en l'appelant
 * `/app`, et sa ligne « exemptions de rendu : AUCUNE » l'a annoncé comme un
 * succès. Un débordement sur le vrai `/app` serait passé inaperçu.
 *
 * ═══ CE QUE CETTE COUPURE RÉTABLIT ═══
 *
 * L'état que `scripts/exemptions-de-rendu.mjs` DÉCRIT DÉJÀ : `/app` a quitté la
 * liste des exemptions parce que « son écran RESSORT désormais un état terminal
 * au lieu d'attendre sans fin ». Cet état terminal est celui d'une API
 * injoignable. La coupure ne change donc pas ce que les portes mesurent : elle
 * le rend VRAI SUR TOUTE MACHINE, y compris celle où le serveur tourne.
 *
 * ═══ POURQUOI PAS `preview: { proxy: {} }` DANS `vite.config.ts` ═══
 *
 * Parce que le proxy est PORTEUR ailleurs. `espace-connecte.mjs` monte un vrai
 * parc en appelant `http://127.0.0.1:4197/api/auth/signup` — c'est-à-dire à
 * travers ce même proxy hérité. Le couper globalement réparerait deux portes en
 * en cassant une troisième. La coupure appartient donc aux contextes qui
 * mesurent SANS session, un par un et nommés.
 *
 * ═══ CE QU'ELLE COÛTE À `poids-ecrans`, ET QUI DOIT ÊTRE DIT ═══
 *
 * Cette porte compte toute réponse dont elle peut lire le corps. API vivante,
 * le 401 de `/auth/me` en est une : elle rapportait « 3 → 4 REQUÊTES » sur ses
 * huit points, uniformément, parce que `SessionProvider` enveloppe
 * l'application entière et que chaque écran paie l'appel.
 *
 * La coupure la ramène à ses plafonds — qui avaient été inscrits API éteinte,
 * donc sans cet appel. L'accord est rétabli sans qu'aucun plafond monte.
 *
 * MAIS UN VRAI VISITEUR, LUI, PAIE CET ALLER-RETOUR. Sur `/`, avant la
 * première phrase de vente. La porte ne le compte donc pas, et ce n'est pas
 * gratuit : c'est le prix d'un verdict qui ne dépend pas de ce qui tourne à
 * côté. Un chiffrage de cet appel — sa latence réelle sur le réseau visé,
 * pas son poids — est un lot à lui seul. Il est nommé ici, il n'est pas fait.
 *
 * ═══ CE QUE CETTE FONCTION NE DIT PAS ═══
 *
 * Que le produit se comporte bien hors ligne. Elle impose une condition de
 * mesure ; c'est `src/api/attenteDeSession.test.tsx` qui juge les trois états
 * terminaux de la session, sans navigateur.
 */

/**
 * Coupe `/api/**` sur un contexte Playwright, avant toute navigation.
 *
 * `abort('connectionrefused')` plutôt qu'un 401 fabriqué : le refus de
 * connexion est ce que le produit rencontrerait si l'API n'était pas là, et
 * c'est l'état que les portes décrivent déjà. Fabriquer un 401 ferait basculer
 * `/app` vers `/connexion` — soit exactement le verdict qu'on cherche à rendre
 * impossible.
 *
 * @param {import('playwright').BrowserContext} contexte
 */
export async function neutraliserLApiLocale(contexte) {
  await contexte.route('**/api/**', (route) => route.abort('connectionrefused'))
}
