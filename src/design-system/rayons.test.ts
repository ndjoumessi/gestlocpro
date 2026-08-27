import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * DEUX CRANS DE RAYON, PLUS LA GÉLULE. Rien d'autre.
 *
 * CE QUE CETTE GARDE EMPÊCHE, ET POURQUOI RIEN D'AUTRE NE LE VOIT. Un rayon
 * n'est ni un contraste, ni un débordement, ni une cible : aucune règle de la
 * porte ne le regarde. Un écran peut donc arrondir ses cartes comme il veut,
 * indéfiniment, sans qu'une seule mesure ne bronche. C'est exactement ce qui
 * s'était produit — un audit du code a compté SEPT `rounded-xl` et un
 * `rounded-2xl`, tous des cartes de vitrine réimplémentées à la main plutôt
 * que passées par `Card`. Trois crans pour deux rôles : le troisième n'était
 * pas une décision, c'était une dérive, et elle avait déjà commencé à en
 * appeler une quatrième.
 *
 * LA RÈGLE, telle que `tokens.css` l'énonce : `md` pour ce qui se CLIQUE,
 * `lg` pour ce qui CONTIENT, `full` pour les commandes et les pastilles, `sm`
 * et `xs` pour les détails internes d'un contrôle. Un utilitaire au-delà de ce
 * jeu signifie qu'un quatrième rôle a été inventé sans être nommé — ou, plus
 * probablement, qu'une primitive a été recopiée au lieu d'être appelée.
 *
 * ELLE NE MESURE PAS LA BEAUTÉ : ce n'est pas parce que 18 px vaut mieux que
 * 20 qu'on refuse le second, c'est parce que DEUX valeurs pour un même rôle
 * ne se voient pas à l'œil et divergent à chaque lot.
 *
 * Elle lit les SOURCES et jamais le DOM, pour la même raison que les gardes
 * voisines : jsdom ne résout pas les couches de Tailwind, et un rendu
 * mesurerait le repli plutôt que la décision.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/**
 * Le jeu autorisé. `bar` et `legende` sont les deux rayons de DONNÉE — barres
 * d'histogramme et pastilles de légende —, nommés dans `tokens.css` le jour où
 * cette garde a refusé les `[3px]` et `[2px]` qu'ils portaient en dur.
 */
const CRANS = ['none', 'xs', 'sm', 'md', 'lg', 'full', 'bar', 'legende']

/*
  PIÈGE TAILWIND v4, le même que celui de `scripts/` : le générateur balaie ces
  fichiers, commentaires compris. Les noms de classe interdits ne sont donc
  JAMAIS écrits en toutes lettres ici — les citer en exemple les ferait exister
  dans la feuille livrée, ce qui est précisément l'inverse du but.
*/
const RAYON = new RegExp(`\\brounded-(?:[trbl]{1,2}-)?([a-z0-9]+|\\[[^\\]]+\\])`, 'g')

function sources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return sources(chemin)
    return chemin.endsWith('.tsx') && !chemin.includes('.test.') ? [chemin] : []
  })
}

describe('les rayons du produit', () => {
  it('trouve bien des sources à inspecter', () => {
    /*
      Garde du garde : un balayage qui ne trouve aucun fichier — répertoire
      déplacé, extension changée — validerait n'importe quoi en silence. C'est
      la panne que ce dépôt refuse partout ailleurs, et elle vaut ici.
    */
    const fichiers = sources(SRC)
    expect(fichiers.length).toBeGreaterThan(60)
    const total = fichiers.reduce(
      (n, f) => n + [...readFileSync(f, 'utf8').matchAll(RAYON)].length,
      0,
    )
    expect(total, 'aucun rayon trouvé : le motif est-il périmé ?').toBeGreaterThan(150)
  })

  it('n’emploie aucun cran hors du jeu déclaré', () => {
    const hors: string[] = []
    for (const fichier of sources(SRC)) {
      const texte = readFileSync(fichier, 'utf8')
      for (const trouve of texte.matchAll(RAYON)) {
        /* Une valeur ARBITRAIRE est refusée au même titre qu'un cran inconnu,
           et c'est le point : `[18px]` échappe à toute déclaration, donc à toute
           relecture. Si un rayon mérite d'exister, il mérite un nom. */
        if (CRANS.includes(trouve[1])) continue
        const ligne = texte.slice(0, trouve.index).split('\n').length
        hors.push(`${fichier.slice(SRC.length + 1)}:${ligne} — ${trouve[0]}`)
      }
    }
    expect(hors, 'cran de rayon hors du jeu déclaré').toEqual([])
  })
})
