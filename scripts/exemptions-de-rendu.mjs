/**
 * LES ADRESSES QU'UN PAQUET STATIQUE NE PEUT PAS FAIRE RENDRE — datées.
 *
 * `scripts/mesure-ui.mjs` refuse désormais tout point de mesure où la page n'a
 * rien rendu. Sans cette liste, la porte serait rouge en permanence sur une
 * adresse dont l'échec est CONNU, ce qui la rendrait inutilisable — et une
 * porte inutilisable finit désactivée, ce qui est pire que pas de porte.
 *
 * CE FICHIER EST SÉPARÉ, et ce n'est pas de la cosmétique. Une exemption
 * enfouie dans les deux mille trois cents lignes de la garde se lit comme une
 * ligne de configuration ; ici, elle est le sujet du fichier, elle porte une
 * DATE, et son absence est elle-même une panne que la garde sait nommer.
 *
 * CHAQUE ENTRÉE PORTE UNE DATE parce qu'une exemption sans date ne vieillit
 * pas : personne ne peut dire, six mois plus tard, si elle a deux semaines ou
 * deux ans. La date ne fait rien rougir toute seule — un délai automatique
 * ferait rougir la porte un matin sans que rien n'ait changé, et la première
 * chose qu'on ferait serait de le repousser. Elle sert à la REVUE : `depuis`
 * se lit dans le rapport de la porte, à chaque exécution.
 *
 * TROIS GARDES VEILLENT SUR CETTE LISTE, dans `mesure-ui.mjs` :
 *   1. fichier introuvable ou illisible → l'`import` lève de lui-même.
 *   2. adresse exemptée qui se met à RENDRE → REFUS « exemption périmée ».
 *      Une exemption ne doit pas survivre à sa raison d'être.
 *   3. plus d'entrées que `MAXIMUM_D_EXEMPTIONS` → REFUS. Voir ci-dessous.
 *
 * LE REFUS SUR LISTE VIDE A ÉTÉ RETIRÉ, et c'est une correction, pas un
 * assouplissement. Il faisait double emploi avec la garde qui compte les
 * points de rendu examinés — celle-là attrape déjà le cas où plus rien n'est
 * regardé — et il créait une contradiction : le jour où `/app` deviendra
 * mesurable, la garde 2 exigera de retirer son entrée, et l'ancien refus aurait
 * alors interdit la liste vide qui en résulte. Une garde qui rend impossible
 * l'état correct n'est pas une garde, c'est un piège : quelqu'un l'aurait
 * contournée en laissant une entrée morte, ce qui est exactement ce que la
 * garde 2 existe pour empêcher.
 */

/**
 * LE CLIQUET : combien d'exemptions ce dépôt s'autorise, aujourd'hui.
 *
 * C'est le nombre d'entrées de la liste au jour où elle est écrite, pas un
 * plafond confortable. Une porte ne meurt pas d'un coup — elle meurt une
 * exemption à la fois, chacune raisonnable, aucune discutée. Ajouter la
 * prochaine oblige donc à relever ce nombre, donc à le faire apparaître dans un
 * diff, donc à en répondre. C'est tout ce qu'un cliquet peut faire : il
 * n'interdit rien, il rend l'ajout VISIBLE.
 *
 * Il se relève. Il ne se relève pas sans qu'on l'ait vu.
 */
export const MAXIMUM_D_EXEMPTIONS = 0

/**
 * @type {Record<string, { depuis: string, motif: string }>}
 */
/**
 * @type {Record<string, { depuis: string, motif: string }>}
 *
 * VIDE, ET C'EST UN RÉSULTAT, PAS UN OUBLI.
 *
 * `/app` y a vécu deux lots. Il n'y est plus parce que son écran RESSORT
 * désormais un état terminal au lieu d'attendre sans fin : la garde
 * « exemption périmée » l'a exigé au premier balayage suivant le correctif,
 * exactement comme prévu. Une exemption qui meurt de la réparation de son motif
 * est la seule bonne façon pour une exemption de mourir.
 *
 * Le lot précédent a retiré le refus sur liste vide précisément pour que ce
 * jour-là soit possible sans contorsion. Il l'a prouvé par mutation avant d'en
 * avoir besoin.
 */
export const EXEMPTIONS_DE_RENDU = {}
