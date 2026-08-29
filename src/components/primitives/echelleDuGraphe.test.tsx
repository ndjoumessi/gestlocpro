import { describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderApp, screen, attendreLeChargement } from '@/test/render'

/**
 * LE GRAPHE DIT SON ÉCHELLE, ET IL LA DIT AVEC DES GRADUATIONS.
 *
 * ═══ CE QU'IL FAISAIT ═══
 *
 * Aucun axe. Douze colonnes, une ligne d'objectif, et — à la place d'une
 * échelle — une PHRASE : « Échelle principale (loyer) 1.4 M · Échelle
 * secondaire (eau, électricité) 156 k ». Deux pastilles de couleur y
 * reprenaient celles de la légende juste au-dessus, pour dire tout autre chose.
 * Trois vocabulaires de couleur sur le même graphique, dont un qui devait
 * s'expliquer en toutes lettres.
 *
 * Le prix se lit sans mesurer : hors la valeur maximale et l'objectif, AUCUN
 * montant n'était obtenable sans viser une colonne. Sur un téléphone, où il n'y
 * a pas de survol, un graphe d'encaissements ne rendait donc aucun chiffre.
 *
 * ═══ CE QUE CETTE GARDE TIENT ═══
 *
 *   1. les deux tracés portent des graduations AU REPOS, sans viser ni ouvrir ;
 *   2. les graduations sont JUSTES — deux fois plus haut veut dire deux fois
 *      plus. C'est le seul fait qui rende l'axe utile plutôt que décoratif, et
 *      c'est celui qu'un rendu ne montre pas : une graduation posée au mauvais
 *      pourcentage a exactement l'air d'une graduation ;
 *   3. la phrase d'échelle a disparu — sans quoi on aurait ajouté un axe SANS
 *      retirer ce qui en tenait lieu, et le graphique aurait dit deux fois la
 *      même chose avec deux vocabulaires.
 *
 * LA LINÉARITÉ SE VÉRIFIE SANS CONNAÎTRE L'ÉCHELLE, et c'est ce qui rend ce
 * cas robuste : on ne relit pas le maximum du composant — qui pourrait être
 * faux des deux côtés à la fois — mais le RAPPORT entre deux graduations. Si
 * 500 000 est à mi-hauteur de 1 000 000, l'axe est linéaire, quel que soit le
 * maximum qu'il s'est donné.
 */

/** Le maximum que le tracé s'est donné — le sommet de son échelle. */
function maximum(trace: string): number {
  const zone = document.querySelector<HTMLElement>(`[data-trace="${trace}"]`)
  expect(zone, `tracé « ${trace} » introuvable`).not.toBeNull()
  return Number(zone!.dataset.max)
}

/**
 * L'écart minimal entre deux repères, RECOPIÉ du composant et non lu chez lui.
 *
 * Délibéré : lu depuis `Charts.tsx`, la garde suivrait n'importe quel
 * relâchement sans un mot — « une garde qui lit sa propre cible ne garde rien ».
 * Le jour où le composant descend sous cette valeur, ce cas rougit et l'on
 * vient écrire ici POURQUOI.
 *
 * Trente pixels sur les 126 du tracé principal quand un second tracé lui prend
 * sa place — le cas de ce graphe. Les trente pixels sont les vingt d'une ligne
 * de `text-caps` et dix de respiration ; les 126 sont la hauteur que la mise en
 * page laisse au tracé du haut.
 */
const ECART_MINIMAL_ENTRE_REPERES = (30 / 126) * 100

/**
 * Les hauteurs de TOUS les repères d'un tracé — graduations et objectif.
 *
 * L'objectif porte `data-repere="objectif"` pour exactement cette raison : il
 * est un repère de l'axe, pas un ornement posé dessus, et une garde qui ne
 * compterait que les graduations vérifierait la moitié de la règle.
 */
function hauteursDesReperes(trace: string): number[] {
  const zone = document.querySelector(`[data-trace="${trace}"]`)
  expect(zone, `tracé « ${trace} » introuvable`).not.toBeNull()
  return Array.from(
    zone!.querySelectorAll<HTMLElement>('[data-graduation], [data-repere="objectif"]'),
  ).map((el) => parseFloat(el.style.bottom))
}

/** Les graduations d'un tracé, valeur et hauteur relevées ensemble. */
function graduations(trace: string): { valeur: number; hauteur: number }[] {
  const zone = document.querySelector(`[data-trace="${trace}"]`)
  expect(zone, `tracé « ${trace} » introuvable`).not.toBeNull()
  return Array.from(zone!.querySelectorAll<HTMLElement>('[data-graduation]')).map((el) => ({
    valeur: Number(el.dataset.graduation),
    hauteur: parseFloat(el.style.bottom),
  }))
}

describe('l’échelle du graphe d’encaissements', () => {
  it('porte des graduations sur les deux tracés, sans qu’on vise rien', async () => {
    await renderApp('/demo')
    await attendreLeChargement()

    /* AU MOINS UNE DE CHAQUE CÔTÉ ICI ; le compte de REPÈRES — graduations
       plus objectif — est tenu par les cas de devise plus bas, qui sont les
       seuls à savoir que l'objectif en est un. */
    expect(graduations('principal').length, 'le tracé du haut n’a pas d’échelle').toBeGreaterThan(0)
    expect(graduations('secondaire').length, 'le tracé du bas n’a pas d’échelle').toBeGreaterThan(0)
  })

  it('place ses graduations à la hauteur qu’elles annoncent', async () => {
    await renderApp('/demo')
    await attendreLeChargement()

    for (const trace of ['principal', 'secondaire']) {
      const lues = graduations(trace).filter((g) => g.valeur > 0 && g.hauteur > 0)
      for (const g of lues) {
        expect(Number.isFinite(g.valeur), `graduation sans valeur sur ${trace}`).toBe(true)
        expect(Number.isFinite(g.hauteur), `graduation sans hauteur sur ${trace}`).toBe(true)
      }
      /* Le rapport des valeurs est celui des hauteurs — à 0,5 point de
         pourcentage près, la marge d'un arrondi d'affichage. */
      for (const a of lues) {
        for (const b of lues) {
          const attendu = (a.valeur / b.valeur) * b.hauteur
          expect(
            Math.abs(a.hauteur - attendu),
            `${trace} : ${a.valeur} est à ${a.hauteur}% quand ${b.valeur} est à ${b.hauteur}%`,
          ).toBeLessThan(0.5)
        }
      }
    }
  })

  it('n’explique plus son échelle en toutes lettres', async () => {
    await renderApp('/demo')
    await attendreLeChargement()

    expect(
      screen.queryByText(/échelle principale/i),
      'la phrase d’échelle a survécu à l’axe qui la remplace',
    ).toBeNull()
  })

  /*
    ═══ L'AXE EST DANS L'UNITÉ AFFICHÉE, PAS DANS CELLE DES DONNÉES ═══

    LE DÉFAUT, RAPPORTÉ PAR L'UTILISATEUR AU PREMIER CHANGEMENT DE DEVISE :
    « 1 M », « 500 k », « 100 k » sur un graphe dont les colonnes valaient
    2 795,89 $. Les graduations se calculaient sur les montants BRUTS — unités
    mineures de la devise SOURCE — et se formataient tels quels : ni la
    conversion de change, ni le passage des centimes aux unités d'usage.

    Ça ne se voyait pas en démonstration parce que le parc y compte en francs
    CFA, où les deux corrections valent l'identité : zéro décimale, et un taux
    de 1 vers lui-même. Le graphe était donc juste dans la seule devise sous
    laquelle on l'avait regardé. Trois autres sont offertes.

    CE CAS NE CONNAÎT NI LES MONTANTS NI LE TAUX, et c'est ce qui le rend
    solide : il demande seulement que l'échelle CHANGE quand la devise change.
    Sous le défaut, elle ne bougeait pas d'un iota — c'est même la définition
    exacte de ce qui n'allait pas.
  */
  it('suit la devise affichée, et non l’unité des données', async () => {
    await renderApp('/demo')
    await attendreLeChargement()
    const enFranc = maximum('principal')

    cleanup()

    await renderApp('/demo', { currency: 'CAD' })
    await attendreLeChargement()
    const enDollar = maximum('principal')

    expect(enFranc, 'le tracé ne dit pas le sommet de son échelle').toBeGreaterThan(0)
    expect(
      enDollar,
      `l’échelle vaut ${enDollar} dans les deux devises : elle ne suit pas l’affichage`,
    ).not.toBe(enFranc)
    /* Le dollar canadien vaut des centaines de francs : l'échelle doit
       DESCENDRE, et pas d'un cheveu. Le sens est le fait — une échelle qui
       monterait aurait converti à l'envers. */
    expect(enDollar, 'l’échelle n’a pas suivi le change').toBeLessThan(enFranc / 10)
  })

  /*
    ═══ DEUX GRADUATIONS DANS LES QUATRE DEVISES, ET PAS SEULEMENT DANS UNE ═══

    LE DÉFAUT, TROUVÉ EN REGARDANT L'EURO. Les graduations près de la ligne
    d'objectif se retirent — deux étiquettes à la même hauteur se recouvrent, et
    c'est l'objectif qui gagne. Ce retrait avait lieu APRÈS le choix du pas :
    en euro, le pas de 1 000 rendait 1 000 et 2 000, l'objectif à 2 129,71 €
    emportait le second, et le tracé restait avec UNE graduation. Or une seule
    ne fait pas une échelle : elle répète ce que le sommet de la plus haute
    colonne dit déjà — c'est écrit deux cas plus haut, et le produit le
    contredisait dans trois devises sur quatre.

    Le pas se choisit donc en comptant ce qui SURVIT au retrait, pas ce qui est
    produit avant lui.

    LES QUATRE DEVISES, ET NON UNE. C'est le second temps de la leçon du lot :
    la démonstration compte en francs CFA, et tout ce qui ne se vérifie que là
    n'est vérifié que dans un quart des cas.
  */
  for (const currency of ['CFA', 'EUR', 'USD', 'CAD'] as const) {
    it(`garde une échelle lisible en ${currency}`, async () => {
      await renderApp('/demo', { currency })
      await attendreLeChargement()

      const reperes = hauteursDesReperes('principal')

      /* DEUX REPÈRES, ET L'OBJECTIF EN EST UN. Il porte un montant exact, au
         même bord, dans la même gouttière : une graduation et lui font une
         échelle. Exiger deux GRADUATIONS forçait le pas d'un cran vers le bas
         dès que l'objectif en emportait une, et serrait les étiquettes. */
      expect(reperes.length, `pas d’échelle en ${currency}`).toBeGreaterThan(1)

      /* ET JAMAIS DEUX QUI SE FRÔLENT. C'est ce que le navigateur a montré et
         que la garde ne disait pas : en dollar américain, trois graduations
         tombaient à 23 px l'une de l'autre sur un tracé de 126 px, pour des
         étiquettes de 20. jsdom ne met rien en page — mais les hauteurs sont
         écrites en pourcentage dans le style, et c'est en pourcentage que la
         règle est posée. */
      const tries = [...reperes].sort((a, b) => a - b)
      for (let i = 1; i < tries.length; i++) {
        expect(
          tries[i] - tries[i - 1],
          `deux repères à ${(tries[i] - tries[i - 1]).toFixed(1)} points en ${currency}`,
        ).toBeGreaterThanOrEqual(ECART_MINIMAL_ENTRE_REPERES)
      }
    })
  }
})
