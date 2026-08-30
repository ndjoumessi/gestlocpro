import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * DES CONVENTIONS D'ÉCRAN QUE SEULE LA SOURCE PEUT GARDER.
 *
 * ═══ POURQUOI ICI, ET PAS DANS `features/` ═══
 *
 * Ces cas LISENT DES FICHIERS. Un test `.tsx` de `src/features/` ne le
 * peut pas : le projet applicatif n'a pas les types de Node, et l'import rend
 * « TS2307 : Cannot find module 'node:fs' ». Payé en l'écrivant — les cas
 * vivaient d'abord dans `etatsVides.test.tsx`, où ils passaient sous `vitest` et
 * cassaient `tsc -b`, donc la porte entière avant même le premier test.
 *
 * Les gardes de source de ce dépôt vivent toutes en `.ts` dans ce répertoire,
 * inscrites dans `tsconfig.node.json` et exclues de `tsconfig.app.json`. C'est
 * la règle, et elle a une raison mécanique.
 *
 * ═══ CE QU'ELLES GARDENT, ET CE QU'ELLES NE PEUVENT PAS GARDER ═══
 *
 * La CAUSE, jamais les pixels : aucun de ces cas ne met quoi que ce soit en
 * page. Les mesures qui les motivent sont dans les messages de leurs lots, et
 * elles ont été prises au navigateur, à 1660 px, sur la démonstration.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8')

/**
 * UNE CARTE D'INDICATEUR A UNE TAILLE, ELLE NE L'EMPRUNTE PAS À SES VOISINES.
 *
 * `Access.tsx` écrivait sa propre grille — `sm:grid-cols-2`, sans plafond — et
 * ses DEUX cartes s'étiraient sur toute la largeur. Mesuré le 2026-08-30 à
 * 1660 px : 662 px de carte pour 255 et 195 px de contenu, soit 61 % et 71 % de
 * vide, quand toutes les autres du produit rendent 436 px. Le chiffre « 3 »
 * flottait dans deux tiers de boîte.
 *
 * Après : 662 → 436 px, le vide tombe à 42 % et 55 %.
 */
describe('les rangées d’indicateurs', () => {
  it('emploient une grille PARTAGÉE, jamais une écrite sur place', () => {
    const source = lire('features/dashboard/Access.tsx')
    expect(
      source,
      'l’écran des accès réécrit une grille d’indicateurs au lieu d’employer la partagée',
    ).toContain('GRILLE_DEUX_INDICATEURS')
    expect(source, 'la grille écrite à la main est toujours là').not.toMatch(
      /className="mb-6 grid gap-4 sm:grid-cols-2"/,
    )
  })

  it('partagent le MÊME gabarit de colonne, à deux comme à trois', () => {
    /* Garde du garde, et c'est elle qui porte l'idée : si la grille de deux
       prenait un jour un gabarit à elle, les cartes d'un écran cesseraient
       d'avoir la taille de celles du voisin — exactement le défaut réparé. */
    const source = lire('features/dashboard/grillesDIndicateurs.ts')
    const deux = /GRILLE_DEUX_INDICATEURS = '([^']+)'/.exec(source)?.[1]
    const trois = /GRILLE_TROIS_INDICATEURS = '([^']+)'/.exec(source)?.[1]
    expect(deux, 'la grille de deux est introuvable').toBeDefined()
    expect(
      deux,
      'la grille de deux a pris un gabarit à elle : ses cartes ne feront plus la ' +
        'taille de celles des écrans à trois indicateurs',
    ).toBe(trois)
  })
})

/**
 * UNE ACTION DE RANGÉE N'EST PAS L'ACTION DE LA PAGE.
 *
 * « Valider le devis » était le seul bouton du produit à porter la variante
 * PRIMAIRE dans une liste. Mesuré à 1660 px en comptant les fonds pleins de la
 * marque : `/demo/acces` en porte 1, `/demo/paiements` et `/demo/locataires` 2 —
 * un par page, plus celui du bandeau de démonstration — et `/demo/travaux` 3.
 *
 * Le compte GRANDIT AVEC LA DONNÉE : la démonstration n'a qu'un devis en
 * attente, un parc réel en aurait cinq.
 */
describe('les actions de rangée', () => {
  it('ne reprennent pas la variante primaire, qui appartient à la page', () => {
    const source = lire('features/dashboard/Works.tsx')
    const debut = source.indexOf("work.status === 'quoted' && canApprove")
    expect(debut, 'le bouton de validation est introuvable').toBeGreaterThan(-1)
    const bloc = source.slice(debut, source.indexOf('</Button>', debut))
    expect(
      bloc,
      'la validation d’un devis reprend la variante primaire ; la pastille ambre ' +
        '« Devis proposé » signale déjà cette rangée',
    ).toContain('variant="secondary"')
  })
})
