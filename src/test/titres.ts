import { screen } from '@testing-library/react'

/**
 * Les marches manquantes dans la hiérarchie des titres d'une page rendue.
 *
 * Un titre n'est pas seulement du gros texte : c'est le sommaire par lequel un
 * lecteur d'écran parcourt la page, touche « titre suivant » enfoncée. Ce
 * sommaire ne se lit que si ses niveaux se descendent marche par marche —
 * passer de 1 à 3 fait chercher la section de niveau 2 qu'on vient de croire
 * manquée, et il n'y en avait pas.
 *
 * La garde est GÉNÉRIQUE à dessein. Vérifier écran par écran qu'un titre porte
 * la bonne balise revient à réécrire l'écran dans son test : le jour où une
 * carte s'ajoute au-dessus, l'assertion reste verte et la hiérarchie casse.
 * Ce qu'on veut tenir est une propriété de la PAGE ENTIÈRE, et elle s'énonce
 * sans nommer un seul de ses titres.
 *
 * On lit `aria-level` avant la balise : c'est ce que fait la plateforme, et un
 * `role="heading"` sans balise de titre existe. Les titres masqués sont hors
 * du compte — `queryAllByRole` les écarte déjà, et un titre que personne
 * n'entend n'est pas une marche.
 */
function niveau(titre: HTMLElement): number {
  const declare = titre.getAttribute('aria-level')
  return declare ? Number(declare) : Number(titre.tagName.slice(1))
}

export function sautsDeNiveau(): string[] {
  const sauts: string[] = []
  let precedent = 0
  for (const titre of screen.queryAllByRole('heading')) {
    const actuel = niveau(titre)
    // Remonter est toujours licite — une section se referme et la suivante
    // s'ouvre plus haut. C'est DESCENDRE de plus d'une marche qui troue le
    // sommaire, et c'est la seule chose que ce contrôle refuse.
    if (actuel > precedent + 1) {
      const depuis = precedent === 0 ? 'début de page' : `h${precedent}`
      sauts.push(`${depuis} → h${actuel} « ${(titre.textContent ?? '').trim()} »`)
    }
    precedent = actuel
  }
  return sauts
}
