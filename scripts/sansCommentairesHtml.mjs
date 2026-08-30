/**
 * LES COMMENTAIRES D'`index.html` NE PARTENT PAS SUR LE FIL.
 *
 * ═══ CE QUE LA MESURE A DIT ═══
 *
 * Deux constructions du MÊME arbre, l'une avec le greffon et l'autre sans,
 * mesurées le 2026-08-30 — rien n'est estimé :
 *
 *   index.html construit sans retrait   9 620 o bruts   4 523 gzip
 *   avec le retrait                     1 696 o bruts     847 gzip
 *   ──────────────────────────────────────────────────────────────
 *   la prose                            7 924 o bruts   3 676 SUR LE FIL
 *
 * **Quatre-vingt-deux pour cent du document**, soit 74 ms à 400 kb/s — le débit
 * que tout ce dépôt retient comme profil du marché visé — et ce prix se paierait
 * sur CHAQUE écran, puisque chaque adresse rend le même document.
 *
 * ET CE QUE L'UTILISATEUR CESSE VRAIMENT DE PAYER EST UN AUTRE NOMBRE : 5 281 o
 * bruts, 2 543 sur le fil, 51 ms. `poids-ecrans` le mesure écran par écran. Il
 * est plus petit parce que le lot qui pose ce greffon AJOUTE aussi de la prose —
 * celle du manifeste et des deux `theme-color`. Les deux chiffres sont vrais et
 * ne répondent pas à la même question : 74 ms est ce que la prose coûterait si
 * elle partait, 51 ms est ce que ce lot-ci rend au réseau.
 *
 * ═══ CE N'EST PAS UN ARGUMENT CONTRE LES COMMENTAIRES ═══
 *
 * Ceux d'`index.html` sont parmi les plus utiles du dépôt : ils portent le
 * raisonnement sur les encoches, sur le thème posé avant le premier rendu, sur
 * la police tierce, sur le manifeste. Rien ne se raccourcit ici.
 *
 * C'est un argument contre le fait de les FACTURER À L'UTILISATEUR. Les
 * commentaires de `.ts` et `.tsx` disparaissent au paquet depuis toujours ;
 * `index.html`, lui, part tel quel, et c'est le seul fichier du produit où la
 * prose voyage. Le déséquilibre n'était pas voulu, il était simplement invisible
 * — aucune garde ne pesait ce fichier séparément.
 *
 * ═══ POURQUOI UNE EXPRESSION RÉGULIÈRE SUFFIT, ET QUAND ELLE NE SUFFIRAIT PLUS
 *
 * Un `<!--` à l'intérieur d'un `<script>` ou d'un `<style>` n'est pas un
 * commentaire HTML, et un retrait naïf couperait alors du code. Vérifié sur ce
 * fichier : aucun de ses blocs en ligne n'en porte, ni de `-->`. Le cas est donc
 * gardé plutôt que supposé — voir `sansCommentairesHtml.test.ts`, qui refuse de
 * toucher au contenu d'un script.
 *
 * LES COMMENTAIRES CONDITIONNELS SONT PRÉSERVÉS. `<!--[if IE]>` n'est pas de la
 * prose : c'est une instruction. Aucun navigateur visé ne les lit plus, mais les
 * retirer serait un geste d'un autre sujet, décidé en passant.
 */

/** `<!--[if …]>` et `<![endif]-->` : des instructions, pas de la prose. */
const CONDITIONNEL = /^<!--\s*\[if\s|<!\[endif\]-->$/

/**
 * Retire les commentaires HTML, en laissant intact ce qui vit dans un `<script>`
 * ou un `<style>`.
 *
 * On découpe d'abord sur ces deux balises, et l'on ne traite que ce qui tombe
 * ENTRE elles. Traiter le document d'un seul coup marcherait aujourd'hui et
 * casserait le jour où quelqu'un écrit `-->` dans une chaîne de caractères — un
 * jour qui n'arrive jamais jusqu'à ce qu'il arrive.
 */
export function sansCommentairesHtml(html) {
  const BLOCS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi
  let sortie = ''
  let curseur = 0
  for (const bloc of html.matchAll(BLOCS)) {
    sortie += retirer(html.slice(curseur, bloc.index)) + bloc[0]
    curseur = bloc.index + bloc[0].length
  }
  return sortie + retirer(html.slice(curseur))
}

function retirer(fragment) {
  return fragment
    .replace(/<!--[\s\S]*?-->/g, (commentaire) =>
      CONDITIONNEL.test(commentaire.trim()) ? commentaire : '',
    )
    /* Les lignes devenues vides par le retrait. On ne touche pas à l'indentation
       de ce qui reste : le HTML servi doit rester lisible à qui l'inspecte. */
    .replace(/\n[ \t]*(?=\n)/g, '')
}

/**
 * Le greffon Vite.
 *
 * `order: 'post'` : après les autres transformations, pour retirer aussi ce
 * qu'un greffon aurait injecté. Le développement n'est pas touché — `apply:
 * 'build'` — parce qu'inspecter la page servie par `vite dev` et y lire les
 * commentaires est précisément ce qui rend ce fichier utile à quelqu'un.
 */
export function retirerLesCommentairesHtml() {
  return {
    name: 'gestlocpro:sans-commentaires-html',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: sansCommentairesHtml },
  }
}
