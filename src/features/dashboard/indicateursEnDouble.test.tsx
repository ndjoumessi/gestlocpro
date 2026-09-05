import { cleanup } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
/**
 * LE ROUTEUR LU COMME UN TEXTE, PAR `?raw` ET NON PAR `node:fs`.
 *
 * Ce cas MONTE des écrans — il lui faut les types du DOM, donc le projet
 * applicatif — et il LIT une source, ce que `node:fs` ferait au prix du projet
 * Node, où `document` n'existe pas. `testsQuiLisentLeDisque` documente ce
 * partage et son coût.
 *
 * `?raw` est la sortie : Vite rend le fichier comme une chaîne, à la
 * compilation, sans qu'aucun type Node n'entre. La dérivation est gardée —
 * c'est elle qui compte — et le cas reste là où il peut rendre.
 */
import ROUTEUR from '@/app/EspaceApplicatif.tsx?raw'
import { renderApp, attendreLeChargement } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * AUCUN ÉCRAN NE REDIT, SUR UN TÉLÉPHONE, UN CHIFFRE DU TABLEAU DE BORD.
 *
 * ═══ POURQUOI CETTE GARDE EXISTE : TROIS FOIS LE MÊME GESTE, À LA MAIN ═══
 *
 * Trois lots d'affilée, le 2026-09-06, ont retiré des cartes d'indicateur sous
 * `lg` — parc, locataires, paiements. À chaque fois je l'ai trouvé en ouvrant
 * DEUX écrans dans un navigateur et en comparant les nombres à l'œil :
 *
 *     locataires   « Loyer mensuel 1 397 000 FCFA »
 *     tableau      « Loyers attendus 1 397 000 FCFA · 10 baux actifs »
 *
 *     paiements    « Payé 950 000 FCFA −24 % vs. 1 250 000 FCFA le mois dernier »
 *     tableau      « Encaissé ce mois 950 000 FCFA −24 % vs. 1 250 000 FCFA … »
 *
 * Rien n'empêchait la quatrième de réapparaître, et il reste des écrans que je
 * n'ai pas ouverts. Un défaut que seul l'œil attrape revient dès qu'on cesse de
 * regarder.
 *
 * ═══ LA RÈGLE, ET SON ASYMÉTRIE ═══
 *
 * Le tableau de bord est la RÉFÉRENCE : il est à un onglet de la barre du bas,
 * sur tous les écrans. Un chiffre qu'il porte n'a pas à occuper cent pixels de
 * défilement ailleurs — sous `lg`, où la grille n'a qu'une colonne et où chaque
 * carte se paie en défilement.
 *
 * Au-dessus de `lg` la règle ne s'applique PAS : la rangée coûte une hauteur de
 * carte, les indicateurs se lisent d'un regard, et les répéter dans le contexte
 * de leur écran a du sens.
 *
 * ═══ CE QU'ELLE COMPARE, ET CE QU'ELLE NE PEUT PAS ═══
 *
 * Les VALEURS rendues — `data-valeur`, que `StatCard` pose « isolé de son
 * intitulé et de sa note ». Pas les libellés : « Payé » et « Encaissé ce mois »
 * nomment le même argent sans partager un mot.
 *
 * ELLE NE MESURE QUE LA DÉMONSTRATION, et deux nombres peuvent y coïncider par
 * hasard. C'est une limite réelle et non un défaut caché : une coïncidence se
 * déclare en trois lignes, et sur un vrai parc elle disparaîtrait — tandis
 * qu'une duplication STRUCTURELLE, deux écrans lisant le même calcul, se
 * reproduit sur toutes les données. Les trois trouvées à la main étaient
 * structurelles.
 */
/**
 * Les écrans à visiter, LUS dans le routeur.
 *
 * Écrite à la main, cette liste accueillerait le prochain écran sans un mot —
 * et c'est exactement le silence que cette garde existe pour rompre. On écarte
 * les routes à paramètre, qui demanderaient un identifiant, et le fourre-tout.
 */
function ecransDuRouteur(): string[] {
  return [...ROUTEUR.matchAll(/path="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((p) => !p.includes(':') && p !== '*')
    .map((p) => `/demo/${p}`)
}

/**
 * Les valeurs d'indicateur rendues sur un écran, à 360 px.
 *
 * `cleanup()` D'ABORD, ET C'EST CE QUI M'A REPRIS AU PREMIER JET. Le harnais ne
 * nettoie qu'entre deux CAS ; monter dix écrans dans un seul cas les empile dans
 * le même document, et `querySelectorAll` rend alors les indicateurs de tous les
 * précédents. La garde accusait `/demo/paiements` de porter « 447 000 FCFA » et
 * « 83 » — les cartes du tableau de bord, montées trois lignes plus tôt.
 *
 * Un faux rouge, cette fois, et donc lisible. Le même oubli dans l'autre sens —
 * comparer un DOM vide — aurait rendu « aucune duplication » sur tout.
 */
async function valeursDe(adresse: string): Promise<string[]> {
  cleanup()
  installerFauxServeur()
  await renderApp(adresse, { largeur: 360 })
  await attendreLeChargement()
  return Array.from(document.querySelectorAll<HTMLElement>('[data-indicateur] [data-valeur]'))
    .map((e) => (e.textContent ?? '').trim())
    .filter((v) => v.length > 0)
}

/**
 * Les répétitions ASSUMÉES, avec leur motif.
 *
 * Vide au jour de l'écriture, et gardée vide : les trois duplications connues
 * ont été retirées par les lots qui les ont trouvées. Une entrée ici veut dire
 * « ce chiffre mérite ses cent pixels sur cet écran-là aussi », et il faut
 * l'écrire.
 */
const REPETITIONS_ASSUMEES: { ecran: string; valeur: string; motif: string }[] = []

describe('les indicateurs sur un téléphone', () => {
  it('sont bien TROUVÉS — sans quoi cette garde ne garderait rien', async () => {
    /* Un marqueur renommé rendrait « aucun indicateur » partout, et « aucune
       duplication » se lirait comme « rien à comparer ». */
    const ecrans = ecransDuRouteur()
    expect(ecrans.length, 'le routeur est illisible').toBeGreaterThanOrEqual(10)
    expect((await valeursDe('/demo')).length, 'le tableau de bord ne rend aucun indicateur')
      .toBeGreaterThan(0)
  })

  it('ne redisent AUCUN chiffre du tableau de bord', async () => {
    const duTableau = new Set(await valeursDe('/demo'))
    const assumees = new Set(REPETITIONS_ASSUMEES.map((r) => `${r.ecran}|${r.valeur}`))

    const doublons: string[] = []
    for (const ecran of ecransDuRouteur()) {
      if (ecran === '/demo') continue
      for (const valeur of await valeursDe(ecran)) {
        if (duTableau.has(valeur) && !assumees.has(`${ecran}|${valeur}`)) {
          doublons.push(`${ecran} — « ${valeur} », déjà sur le tableau de bord`)
        }
      }
    }

    expect(
      doublons,
      'ces chiffres coûtent cent pixels de défilement pour redire ce qui est à un ' +
        'onglet de distance. Retirez la carte sous `lg`, ou inscrivez-la dans ' +
        `\`REPETITIONS_ASSUMEES\` avec son motif :\n  ${doublons.join('\n  ')}`,
    ).toEqual([])
  })

  it('ne déclarent AUCUNE répétition qui n’existe plus', async () => {
    /* Une dispense qui ne décrit plus rien vaut une règle affaiblie, avec
       l'autorité d'un registre — les deux sens, comme partout ici. */
    const duTableau = new Set(await valeursDe('/demo'))
    const mortes: string[] = []
    for (const r of REPETITIONS_ASSUMEES) {
      const surLEcran = await valeursDe(r.ecran)
      if (!surLEcran.includes(r.valeur) || !duTableau.has(r.valeur))
        mortes.push(`${r.ecran} — « ${r.valeur} »`)
    }
    expect(mortes, `ces déclarations ne décrivent plus rien :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  it('donnent un MOTIF à chaque répétition assumée', () => {
    const creuses = REPETITIONS_ASSUMEES.filter((r) => r.motif.trim().length < 120).map(
      (r) => `${r.ecran} — ${r.valeur}`,
    )
    expect(creuses, 's’inscrire est un geste ; le motif est ce qui le rend relisible').toEqual([])
  })
})
