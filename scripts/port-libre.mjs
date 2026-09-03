/**
 * UNE PORTE NE MESURE PAS UN SERVEUR QU'ELLE N'A PAS LANCÉ.
 *
 * ═══ LE MODE DE PANNE, ET IL A COÛTÉ UNE MATINÉE ═══
 *
 * Une porte qui démarre son serveur puis attend qu'une adresse réponde n'a
 * aucune idée de QUI répond. Si un orphelin d'un passage précédent tient déjà
 * le port, le fils meurt en silence sur `EADDRINUSE` — les portes de ce dépôt
 * lancent leur serveur en `stdio: 'ignore'` —, le `fetch` réussit contre
 * l'intrus, et la porte rend VERT sur le code que l'intrus servait.
 *
 * Relevé le 2026-09-03 : un orphelin de 3 h 43 tenait le port 4197 pendant que
 * `espace-connecte` — le seul script du dépôt à ne pas avoir ce contrôle —
 * rendait vert à chaque passage. Le premier passage contre un serveur frais a
 * immédiatement trouvé un défaut de produit que ces verts avaient caché.
 *
 * ═══ POURQUOI CELUI-CI ET PAS LA SURVEILLANCE DU FILS ═══
 *
 * Surveiller la mort du fils NE CORRIGE PAS la course : la réponse de l'intrus
 * arrive avant que la mort ne remonte, et sur les portes qui passent par `npx`
 * le fils n'est même pas le serveur. Le seul contrôle qui ne court pas est
 * celui qui PRÉCÈDE : si quelque chose répond déjà, on refuse.
 *
 * ═══ CE QU'IL RESTE À FAIRE, ET QUI N'EST PAS FAIT ICI ═══
 *
 * C'EST FAIT. Les dix scripts qui portaient ce contrôle en copie l'appellent
 * désormais : `couleur-non-seule`, `mesure-ui`, `modales`,
 * `notes-conditionnelles`, `plafond-coquille`, `plafond-vitrine`,
 * `poids-ecrans`, `releve-refonte`, `series-lisibles`, `stabilite-au-pointage`.
 * Avec `espace-connecte`, qui ne l'avait pas du tout, ils sont onze.
 *
 * Le compte de dix avait été RELEVÉ, pas estimé : la première rédaction de cet
 * en-tête en annonçait sept, de mémoire, et se trompait de trois. Les dix blocs
 * étaient rigoureusement identiques au nom près — vérifié avant de les toucher,
 * une seule forme distincte pour dix fichiers.
 *
 * CE QUE LA CONVERSION A CHANGÉ AU PASSAGE : les copies reconnaissaient leur
 * propre plainte par son MESSAGE pour la relancer depuis un `catch`. Ce module
 * n'en a pas besoin — il retient un booléen et lève après. Une ficelle en
 * moins, et dix fois.
 */

/**
 * Refuse si quelque chose répond déjà sur `base`.
 *
 * LA SONDE EST INJECTABLE, et pas par goût du découplage : le comportement de
 * `fetch` face à un port fermé appartient à Node, pas à ce dépôt, et il DIFFÈRE
 * sous jsdom — l'environnement de la suite qui éprouve ce fichier. Un cas qui
 * ouvre puis ferme un vrai port y mesurait l'environnement, pas la décision.
 * Ce qui nous appartient est le VERDICT : répond → on refuse, ne répond pas →
 * on passe. C'est cela qui s'éprouve.
 *
 * @param {string} nom   Le nom de la porte, pour que le refus se situe.
 * @param {string} base  L'origine à sonder, sans chemin.
 * @param {number} port  Le port, pour nommer le geste qui identifie l'intrus.
 * @param {(url: string) => Promise<unknown>} [sonder] Remplacée dans les cas.
 * @returns {Promise<void>} Rend quand le port est libre ; LÈVE sinon.
 */
export async function exigerUnPortLibre(
  nom,
  base,
  port,
  sonder = (url) => fetch(url, { signal: AbortSignal.timeout(1500) }),
) {
  let repond = false
  try {
    await sonder(`${base}/`)
    repond = true
  } catch {
    /* L'ABSENCE DE RÉPONSE EST CE QU'ON VEUT : `fetch` lève, et l'on continue.
       Le drapeau plutôt qu'un `throw` dans le `try` : lever ici ferait passer
       notre propre plainte par le `catch`, qui devrait alors la reconnaître à
       son message — ce que font les sept copies, et c'est fragile. */
  }
  if (repond) {
    throw new Error(
      `${nom} : quelque chose répond déjà sur ${base}.\n` +
        `  Cette porte lance son propre serveur et refuse d'en mesurer un autre.\n` +
        `  Souvent un orphelin d'un passage interrompu :\n` +
        `    lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    )
  }
}
