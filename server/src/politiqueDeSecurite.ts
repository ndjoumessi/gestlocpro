import { createHash } from 'node:crypto'

/**
 * LA POLITIQUE DE SÉCURITÉ DU CONTENU, CALCULÉE SUR LE DOCUMENT QU'ON SERT.
 *
 * ═══ CE QU'IL N'Y AVAIT PAS, ET CE QUE ÇA COÛTAIT ═══
 *
 * Rien. Ni `helmet`, ni en-tête écrit à la main — vérifié en cherchant les deux
 * dans tout `server/`. Sans politique, un script injecté par n'importe quel
 * chemin — une dépendance compromise, une chaîne rendue sans échappement — peut
 * appeler l'origine de son choix avec le cookie de session de première partie.
 *
 * ═══ POURQUOI ELLE SE CALCULE AU LIEU DE S'ÉCRIRE ═══
 *
 * `index.html` porte UN script en ligne : celui qui pose le thème avant le
 * premier rendu, pour qu'une page sombre ne clignote pas en blanc. Un
 * `script-src 'self'` le bloquerait ; `'unsafe-inline'` rendrait la politique
 * décorative.
 *
 * On prend donc son EMPREINTE. Et on la prend sur le document RÉELLEMENT SERVI,
 * relu au démarrage : une empreinte recopiée dans une constante se périmerait au
 * premier caractère changé dans ce script, et le symptôme serait un thème qui
 * clignote — que personne ne rattacherait à une politique. Le même raisonnement
 * qui fait lire les adresses dans le routeur plutôt que de les recopier.
 *
 * ═══ CE QUE CHAQUE DIRECTIVE PAIE ═══
 *
 * `default-src 'self'`      tout le reste vient d'ici, et de nulle part ailleurs
 * `script-src`              'self' plus l'empreinte du script de thème
 * `style-src`               'self' plus la fonderie, qui sert une feuille
 * `font-src`                'self' plus la fonderie, qui sert les fichiers
 * `img-src` `data:` `blob:` les aperçus de photos avant envoi, et les PDF rendus
 *                           dans le navigateur
 * `connect-src 'self'`      l'API est de première partie — c'est la condition
 *                           du cookie de session, écrite dans `app.ts`
 * `worker-src 'self'`       l'agent de service, et lui seul
 * `object-src 'none'`       aucun greffon : il n'y en a pas, et l'interdire
 *                           ferme une classe entière d'injections
 * `base-uri 'self'`         une balise `<base>` injectée réécrirait toutes les
 *                           adresses relatives de la page
 * `form-action 'self'`      un formulaire ne poste que vers ce serveur
 * `frame-ancestors 'none'`  personne n'encadre ce produit : pas de détournement
 *                           de clic sur les boutons d'encaissement
 *
 * ═══ CE QU'ELLE NE FAIT PAS ═══
 *
 * `style-src` GARDE `'unsafe-inline'`, et il faut le dire plutôt que le taire.
 * Le produit pose des styles calculés — la hauteur d'une barre EST la donnée —
 * et React les écrit par le modèle objet, ce qu'une politique ne voit pas ; mais
 * la feuille de la fonderie, elle, arrive avec ses propres règles. Retirer
 * `'unsafe-inline'` demanderait une empreinte par feuille et une nonce par
 * requête, donc un document non mis en cache. C'est un lot à soi seul.
 *
 * Elle ne remplace NI l'échappement, NI la validation : elle réduit ce qu'un
 * défaut peut faire, elle n'empêche pas le défaut.
 */

/** Les empreintes des scripts en ligne du document, au format de la politique. */
export function empreintesDesScriptsEnLigne(html: string): string[] {
  const enLigne = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  return enLigne.map(
    ([, corps]) => `'sha256-${createHash('sha256').update(corps ?? '', 'utf8').digest('base64')}'`,
  )
}

/**
 * La politique, pour un document donné.
 *
 * Rendue comme une chaîne d'en-tête. Le document est passé plutôt que lu ici :
 * l'appelant sait où il vit, et un test peut donc éprouver la politique sans
 * fabriquer d'arborescence.
 */
export function politiqueDeSecurite(html: string): string {
  const scripts = ["'self'", ...empreintesDesScriptsEnLigne(html)].join(' ')
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}
