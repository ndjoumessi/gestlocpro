/**
 * LA PAGINATION PAR CURSEUR, ÉCRITE UNE FOIS.
 *
 * Le registre des décisions a perdu une ligne par frontière de page pendant
 * toute la vie de sa route, et personne ne l'aurait su : son curseur ne portait
 * que `createdAt`, la page suivante demandait `createdAt < curseur`, et deux
 * événements de la même milliseconde se retrouvaient à cheval — le premier
 * fermait la page, le second n'apparaissait sur aucune. Mesuré : cent un
 * événements, cent rendus.
 *
 * Le lot qui l'a corrigé s'est fermé sur ce qu'il ne pouvait pas garder :
 * « rien dans le dépôt ne rappellera cette règle à qui écrira la prochaine
 * pagination ». Ce fichier est la réponse, et ce n'est pas un avertissement :
 * c'est le geste correct, rendu plus simple que le geste faux.
 *
 * ═══ LA RÈGLE, EN UNE PHRASE ═══
 *
 * Un curseur doit porter un couple dont le dernier membre est UNIQUE. Sinon la
 * frontière de page est ambiguë, et l'ambiguïté se paie dans un sens ou dans
 * l'autre : `<` strict PERD les ex æquo, `<=` les SERT DEUX FOIS et boucle.
 *
 * ═══ CE QU'IL NE COUVRE PAS, ET C'EST DIT ═══
 *
 * Il pagine sur `(createdAt, id)`, la forme de toute liste d'événements. Une
 * liste ordonnée sur un AUTRE champ — un montant, un nom — doit étendre ce
 * fichier plutôt que se réécrire à côté : c'est précisément la duplication qui
 * a produit le défaut d'origine, un raisonnement tenu une fois et jamais relu.
 */

/** Cent par page — le client demande la suite s'il la veut. */
export const TAILLE_DE_PAGE = 100

/**
 * L'ORDRE D'UNE PAGE, et il n'est pas décoratif.
 *
 * Le tri et le curseur doivent porter sur les MÊMES champs, dans le même sens.
 * Sans l'ordre secondaire, deux ex æquo sortiraient dans un ordre que rien ne
 * fixe, et le curseur désignerait une frontière que la requête suivante ne
 * retrouverait pas — la page sauterait ou se répéterait selon l'humeur du plan
 * d'exécution.
 */
/* PAS D'`as const` SUR LE TABLEAU : Prisma attend un `orderBy` MUTABLE, et un
   tableau figé fait échouer sa surcharge — qui retombe alors silencieusement
   sur la variante SANS `select`, si bien que l'erreur remonte trente lignes
   plus loin sur un champ absent. Les valeurs, elles, restent littérales. */
export const ORDRE_DE_PAGE = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

export interface CurseurDePage {
  quand: Date
  /** `null` quand le curseur vient d'un client d'avant le couple. */
  id: string | null
}

/**
 * Lit un curseur reçu, ou `null`.
 *
 * L'ANCIEN FORMAT RESTE ACCEPTÉ : une page ouverte pendant un déploiement tient
 * un curseur sans `|`, et le refuser lui rendrait une erreur au milieu d'un
 * défilement. Elle retombe sur l'ancien comportement pour ce clic-là — le
 * client, qui ne fait que renvoyer ce qu'il a reçu, passe au format complet dès
 * la page suivante.
 *
 * Une date illisible rend `null` plutôt qu'une erreur : un curseur trafiqué
 * n'ouvre rien de plus qu'une première page, et refuser bruyamment aiderait
 * surtout celui qui essaie.
 */
export function lireCurseur(brut: string | undefined): CurseurDePage | null {
  if (!brut) return null
  const [date, id] = brut.split('|')
  const quand = new Date(date!)
  if (Number.isNaN(+quand)) return null
  return { quand, id: id ?? null }
}

/**
 * Le fragment `where` d'une page — le couple, jamais un seul champ.
 *
 * La comparaison est lexicographique : soit la date est strictement
 * antérieure, soit elle est égale ET l'identifiant est plus petit.
 */
export function bornesDuCurseur(curseur: CurseurDePage | null) {
  if (!curseur) return {}
  if (!curseur.id) return { createdAt: { lt: curseur.quand } }
  return {
    OR: [
      { createdAt: { lt: curseur.quand } },
      { createdAt: curseur.quand, id: { lt: curseur.id } },
    ],
  }
}

/**
 * Découpe une lecture de `TAILLE_DE_PAGE + 1` en page + curseur suivant.
 *
 * UNE LIGNE DE PLUS EST DEMANDÉE, PAS RENDUE : c'est elle qui dit s'il y a une
 * suite, sans un second appel de comptage sur une table qui s'allonge. Le
 * curseur rendu est `null` quand il n'y en a pas, si bien que le client n'a
 * rien à calculer et ne peut pas se tromper de borne.
 */
export function decouperLaPage<T extends { id: string; createdAt: Date }>(
  lues: T[],
): { page: T[]; suivant: string | null } {
  const suite = lues.length > TAILLE_DE_PAGE
  const page = suite ? lues.slice(0, TAILLE_DE_PAGE) : lues
  const dernier = page[page.length - 1]
  return {
    page,
    suivant: suite && dernier ? `${dernier.createdAt.toISOString()}|${dernier.id}` : null,
  }
}
