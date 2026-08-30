/**
 * IMPOSER LA POLICE D'UNE AUTRE MACHINE, POUR REPRODUIRE SON VERDICT ICI.
 *
 * `--font-sans` commence par `system-ui`, qui designe un DESSIN DIFFERENT par
 * systeme. Mesure le 2026-08-30, « Creer mon espace » a 16 px :
 *
 *   132,61 px   la police systeme de macOS
 *   146,14 px   DejaVu Sans, que l'executeur Ubuntu met derriere `system-ui`
 *   145,86 px   Verdana, presente sur ce Mac — 0,28 px de DejaVu
 *
 * Onze pour cent d'ecart suffisent a rendre une porte VERTE ici et ROUGE la-bas.
 * C'est arrive deux fois : cinq debordements locaux dans `mesure-ui`, puis la
 * hauteur de coquille dans `plafond-coquille`.
 *
 * CE MODULE EXISTE PARCE QUE LA SECONDE FOIS ETAIT EVITABLE. Le commutateur ne
 * vivait que dans `mesure-ui` ; la coquille n'a donc jamais ete mesuree sous la
 * police large avant d'etre poussee. Une seule porte instrumentee donne une
 * fausse assurance — on croit avoir couvert la question, et l'on n'a couvert
 * qu'un fichier.
 *
 *   MESURER_EN_POLICE_LARGE=1 npm run check:navigateur
 *
 * CE N'EST PAS UNE SECONDE VERITE. Sans commutateur, chaque porte mesure ce que
 * cette machine rend, et c'est ce qui fait un releve reproductible. Ceci sert a
 * EPROUVER une reparation contre une police plus large avant de la pousser.
 *
 * Et ca ne dit rien d'Android, qui est le marche : la-bas `system-ui` vaut
 * Roboto, ni l'une ni l'autre. Verdana est un PIRE CAS plausible.
 */
export const POLICE_LARGE = process.env.MESURER_EN_POLICE_LARGE === '1'

const IMPOSITION = `:root { --font-sans: Verdana, sans-serif !important }`

/**
 * Pose l'imposition sur TOUT document du contexte, avant le premier rendu.
 *
 * `addStyleTag` par page arriverait apres la peinture initiale et laisserait une
 * mesure prise entre les deux ; `addInitScript` s'execute avant tout script de
 * la page.
 */
export async function imposerLaPoliceLarge(contexte) {
  if (!POLICE_LARGE) return
  await contexte.addInitScript((css) => {
    const poser = () => {
      const style = document.createElement('style')
      style.textContent = css
      document.head.append(style)
    }
    if (document.head) poser()
    else document.addEventListener('DOMContentLoaded', poser, { once: true })
  }, IMPOSITION)
}
