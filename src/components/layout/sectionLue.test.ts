import { describe, expect, it } from 'vitest'
import {
  CLASSE_DE_MARGE_D_ANCRE,
  HAUTEUR_SOUS_L_EN_TETE_PX,
  sectionLue,
} from './TableDesMatieres'

/**
 * LE RAIL NOMMAIT LA SECTION QU'ON ALLAIT ATTEINDRE, PAS CELLE QU'ON LISAIT.
 *
 * ═══ LE RELEVÉ, PRIS À L'ÉCRAN LE 2026-10-08 ═══
 *
 * `/demo/manuel` à 1800 px de large, défilé à 1 400 px. Ce que le lecteur avait
 * sous les yeux, du haut vers le bas de la fenêtre :
 *
 *     129 px   « Corriger le parc »          ┐ trois gestes
 *     150 px   « La devise du parc, … »      ├ du PARC IMMOBILIER
 *     218 px   « Attribuer un locataire »    ┘
 *
 * Les titres de section, au même instant :
 *
 *     −92 px   « Dans Parc immobilier »   ← tout juste sorti par le haut
 *     332 px   « Dans Accès au parc »     ← pas encore atteint
 *     666 px   « Dans Paiements »
 *
 * Le rail affichait « ACCÈS AU PARC ». Le lecteur lisait le parc immobilier.
 *
 * ═══ D'OÙ VENAIT LA RÈGLE, ET POURQUOI ELLE EST FAUSSE ═══
 *
 * Elle est celle du composant d'origine (21st.dev) : « le PREMIER titre dont le
 * bas est encore sous la ligne de flottaison ». Ce titre-là est le PROCHAIN —
 * celui qu'on n'a pas encore lu. Tant qu'il reste à l'écran, même mille pixels
 * plus bas, il prend le repère à la section dont on lit le corps.
 *
 * La règle juste tient en une phrase : la section lue est la DERNIÈRE dont le
 * titre est passé sous la ligne de flottaison. Une seule condition au lieu de
 * deux, et pas de cas de repli — l'ancien « repli » était la bonne réponse,
 * reléguée derrière la mauvaise.
 *
 * ═══ CE QUE « PASSÉ » VEUT DIRE, ET POURQUOI 80 ET NON 0 ═══
 *
 * La coquille applicative porte un en-tête COLLANT de 65 px, mesuré identique à
 * 320, 375 et 1800 px de large. Un titre à 20 px du haut de la fenêtre n'est pas
 * lu : il est caché derrière lui. La ligne de flottaison est donc le bas de cet
 * en-tête, plus l'air qu'on met au-dessus d'un titre — c'est le même nombre que
 * la marge d'ancre des sections, et ces deux-là ne peuvent pas diverger sans que
 * le repère saute une section au clic.
 */

/* Le relevé ci-dessus, tel quel. Les positions sont celles de l'écran, pas des
   nombres choisis pour que le cas passe. */
const RELEVE_A_1400 = [
  { id: 'manuel-parc-ajouterImmeuble', haut: -92 },
  { id: 'manuel-acces-inviterParCode', haut: 332 },
  { id: 'manuel-paiements-enregistrerUnPaiement', haut: 666 },
] as const

const LIGNE_DE_FLOTTAISON = 80

describe('la section que le rail dit lue', () => {
  it('est celle dont on lit le corps, pas celle qu’on va atteindre', () => {
    expect(
      sectionLue(RELEVE_A_1400, LIGNE_DE_FLOTTAISON),
      'le lecteur lisait « Corriger le parc » et « Attribuer un locataire »',
    ).toBe('manuel-parc-ajouterImmeuble')
  })

  it('n’en désigne aucune tant qu’aucun titre n’est passé', () => {
    /* En haut de page, on est encore dans la visite filmée : marquer la
       première section serait annoncer une lecture qui n'a pas commencé. */
    const enHautDePage = RELEVE_A_1400.map((t) => ({ ...t, haut: t.haut + 1000 }))
    expect(sectionLue(enHautDePage, LIGNE_DE_FLOTTAISON)).toBeNull()
  })

  it('garde la dernière quand toutes sont passées', () => {
    /* Le bas de page : aucun titre n'est plus à l'écran, et le rail doit rester
       sur la dernière section plutôt que se vider. */
    const enBasDePage = RELEVE_A_1400.map((t) => ({ ...t, haut: t.haut - 2000 }))
    expect(sectionLue(enBasDePage, LIGNE_DE_FLOTTAISON)).toBe(
      'manuel-paiements-enregistrerUnPaiement',
    )
  })

  it('bascule À la ligne de flottaison, et pas un pixel avant', () => {
    /* Un titre posé EXACTEMENT sur la ligne vient d'être recouvert par
       l'en-tête : il compte comme passé. C'est la position où le navigateur
       dépose un titre quand on clique son ancre, donc le cas qui décide si le
       repère suit le clic ou le précède d'une section. */
    const pile = [
      { id: 'a', haut: LIGNE_DE_FLOTTAISON },
      { id: 'b', haut: LIGNE_DE_FLOTTAISON + 1 },
    ]
    expect(sectionLue(pile, LIGNE_DE_FLOTTAISON)).toBe('a')
  })

  it('ne rend rien sur une liste vide, au lieu de choisir au hasard', () => {
    expect(sectionLue([], LIGNE_DE_FLOTTAISON)).toBeNull()
  })
})

describe('la marge d’ancre et la ligne de flottaison', () => {
  /**
   * LES DEUX NOMBRES SONT LE MÊME, ET RIEN NE LES TENAIT ENSEMBLE.
   *
   * L'un dit où le navigateur DÉPOSE un titre au clic ; l'autre, à partir d'où
   * le rail le compte COMME LU. Les désaccorder ne casse rien de visible : la
   * page défile, l'ancre résout. Elle rate simplement d'une section — on clique
   * « Cautions », on atterrit sur « Cautions », et le repère s'allume sur
   * « Travaux ». Exactement la classe de défaut que ce lot a corrigée deux fois.
   *
   * La classe est une CHAÎNE LITTÉRALE parce que Tailwind lit les sources au
   * caractère près ; ce cas est le prix de cette contrainte, et il est moins
   * cher que la classe assemblée qui ne serait jamais entrée dans le CSS.
   */
  it('ne peuvent pas diverger', () => {
    const pas = /^scroll-mt-(\d+)$/.exec(CLASSE_DE_MARGE_D_ANCRE)?.[1]
    expect(pas, `classe illisible : ${CLASSE_DE_MARGE_D_ANCRE}`).toBeDefined()
    /* L'échelle d'espacement de Tailwind : une unité vaut 4 px. */
    expect(Number(pas) * 4, 'le repère sauterait une section à chaque clic').toBe(
      HAUTEUR_SOUS_L_EN_TETE_PX,
    )
  })

  /* L'EN-TÊTE COLLANT MESURE 65 px — relevé le 2026-10-08 à 320, 375 et
     1800 px de large. La marge doit le DÉPASSER, sans quoi le titre visé est
     déposé derrière lui ; et rester assez courte pour ne pas le reléguer au
     milieu de l'écran. */
  it('dégage l’en-tête collant sans jeter le titre au milieu de l’écran', () => {
    expect(HAUTEUR_SOUS_L_EN_TETE_PX).toBeGreaterThan(65)
    expect(HAUTEUR_SOUS_L_EN_TETE_PX).toBeLessThanOrEqual(120)
  })
})
