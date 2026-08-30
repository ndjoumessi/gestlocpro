import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderApp, screen, within } from '@/test/render'
import { PLANS, FEATURE_MATRIX } from './pricing'

/**
 * UNE GRILLE DE TARIFS SE COMPARE, OU ELLE NE SERT À RIEN.
 *
 * ═══ CE QU'UN TÉLÉPHONE EN FAISAIT, MESURÉ AU NAVIGATEUR ═══
 *
 * À 360 × 900, les trois cartes empilées faisaient 1 992 px — 18 % de la page
 * d'accueil, et plus de deux fenêtres pleines. Le premier prix et le troisième
 * étaient séparés de plus de 1 300 px : ON NE POUVAIT JAMAIS EN VOIR DEUX À LA
 * FOIS. Le visiteur devait retenir un montant pendant qu'il faisait défiler le
 * suivant, ce qui est exactement l'inverse de ce qu'un tableau comparatif
 * promet. Le défaut n'était donc pas la longueur ; la longueur en était le
 * symptôme, et la comparaison impossible en était la substance.
 *
 * ═══ LES TROIS CHOSES QUE CE FICHIER TIENT ═══
 *
 * 1. LES TROIS PRIX SONT SIMULTANÉS. C'est le gain, et c'est le seul qu'une
 *    capture d'écran ne montrerait pas comme un gain : la page a l'air plus
 *    courte, pas plus comparable. Une régression y ressemblerait à un
 *    rangement — quelqu'un remet les trois cartes bout à bout parce que « c'est
 *    plus simple », et la section reperd sa fonction sans que rien ne rougisse.
 *
 * 2. LA MATRICE N'EST IMPRIMÉE QU'UNE FOIS. Elle l'était trois fois : les mêmes
 *    cinq libellés, à l'identique, un jeu par palier. En trois colonnes c'est
 *    une grille qui se lit par lignes ; en une colonne c'est une répétition que
 *    le visiteur relit sans le savoir.
 *
 * 3. AUCUN PALIER N'EST PERDU. Replier n'est légitime que si l'on peut rouvrir.
 *    C'est la frontière entre un onglet et un `lg:hidden`, et c'est toute la
 *    différence entre alléger et amputer.
 *
 * ═══ CE QU'IL NE TIENT PAS ═══
 *
 * La hauteur. jsdom ne calcule aucune boîte : « 1 992 px » n'y veut rien dire.
 * C'est `plafond-vitrine.mjs` qui la tient, au navigateur, aux deux largeurs et
 * dans les deux langues — et c'est lui qui a produit les chiffres du haut.
 */

const TELEPHONE = 360
const BUREAU = 1280

/** Un palier au moins doit exister, sinon les trois cas ne prouvent rien. */
const NOMBRE_DE_PALIERS = PLANS.length

describe('les tarifs sur un téléphone', () => {
  it('montrent les trois prix en même temps', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/', { largeur: TELEPHONE })

    const rangee = screen.getByRole('tablist', { name: /tarif|pricing|prix|plan/i })
    const onglets = within(rangee).getAllByRole('tab')
    expect(onglets).toHaveLength(NOMBRE_DE_PALIERS)

    /*
      CHAQUE ONGLET PORTE UNE VALEUR, PAS SEULEMENT UN NOM — et c'est ici que
      tout le lot se joue. Un onglet nommé « Pro » seul n'aurait fait
      qu'économiser du défilement ; c'est le montant sous le nom qui rend la
      comparaison possible sans rien ouvrir.

      Comment on l'affirme sans réécrire les prix ici : le nom du palier est lu
      sur le titre du PANNEAU ouvert, puis on exige que l'onglet le contienne ET
      soit strictement plus long. « Plus long que son propre nom » est la seule
      formulation qui ne se laisse pas satisfaire par un onglet nu.

      La première rédaction demandait `/\d/.test(texte) || texte.length > 0`.
      La seconde moitié est vraie de toute chaîne non vide : l'assertion était
      creuse, et « Cabinet » sans prix l'aurait passée. Elle ne pouvait d'ailleurs
      pas exiger un chiffre de tous, puisque le palier sur devis n'en a pas.
    */
    const textes: string[] = []
    for (const onglet of onglets) {
      await utilisateur.click(onglet)
      const panneau = document.getElementById(onglet.getAttribute('aria-controls')!)!
      const nom = within(panneau).getByRole('heading', { level: 3 }).textContent!
      const texte = onglet.textContent ?? ''
      expect(texte, `l'onglet ne nomme pas son palier`).toContain(nom)
      expect(
        texte.length,
        `l'onglet « ${texte} » ne porte que le nom du palier, sans sa valeur`,
      ).toBeGreaterThan(nom.length)
      textes.push(texte)
    }

    /* Trois libellés IDENTIQUES passeraient tout ce qui précède sans rien
       comparer. */
    expect(new Set(textes).size).toBe(NOMBRE_DE_PALIERS)
  })

  it('n’impriment la matrice qu’une fois, et non une par palier', async () => {
    await renderApp('/', { largeur: TELEPHONE })

    /* Le premier libellé de la matrice suffit : s'il apparaît une fois, aucun
       autre palier n'est monté en même temps. */
    const premier = FEATURE_MATRIX[0]!
    const lignes = document.querySelectorAll('[data-inclus]')
    expect(lignes.length, 'aucune ligne de matrice rendue').toBeGreaterThan(0)
    expect(
      lignes.length,
      `la matrice est imprimée ${lignes.length / FEATURE_MATRIX.length} fois`,
    ).toBe(FEATURE_MATRIX.length)
    expect(premier.key).toBeTruthy()
  })

  it('gardent chaque palier atteignable, et le disent', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/', { largeur: TELEPHONE })

    const onglets = screen.getAllByRole('tab')
    for (const onglet of onglets) {
      await utilisateur.click(onglet)
      expect(onglet).toHaveAttribute('aria-selected', 'true')

      /* Le panneau ouvert est CELUI de l'onglet : `aria-controls` doit pointer
         sur un élément présent, et cet élément se réclamer de l'onglet. Deux
         moitiés d'un lien dont chacune peut casser seule. */
      const idPanneau = onglet.getAttribute('aria-controls')!
      const panneau = document.getElementById(idPanneau)
      expect(panneau, `le panneau « ${idPanneau} » n'existe pas`).not.toBeNull()
      expect(panneau).toHaveAttribute('role', 'tabpanel')
      expect(panneau).toHaveAttribute('aria-labelledby', onglet.id)

      /* Et le palier ouvert porte bien son bouton d'action : replier la
         comparaison ne doit pas replier la conversion. */
      expect(within(panneau!).getByRole('link')).toBeInTheDocument()
    }
  })

  /**
   * LE CLAVIER, PARCE QUE `role="tab"` EST UNE PROMESSE.
   *
   * Poser `tablist` change ce qu'un lecteur d'écran annonce, donc ce que
   * l'utilisateur attend : les flèches déplacent la sélection. Rien de cela
   * n'est natif. Le raisonnement complet est dans `useOngletsAuClavier` ; ce
   * cas vérifie que la rangée des tarifs s'en sert vraiment, ce qu'aucun
   * typage ne dirait.
   */
  it('se parcourent aux flèches, et s’arrêtent au bout', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/', { largeur: TELEPHONE })

    const onglets = screen.getAllByRole('tab')
    onglets[0]!.focus()
    await utilisateur.keyboard('{ArrowRight}')
    expect(onglets[1]).toHaveFocus()
    expect(onglets[1]).toHaveAttribute('aria-selected', 'true')

    /* Bornage et non bouclage : une rangée qui boucle n'a pas de fin
       perceptible, et l'on ne sait plus si l'on a tout vu. */
    await utilisateur.keyboard('{End}')
    const dernier = onglets[onglets.length - 1]!
    expect(dernier).toHaveFocus()
    await utilisateur.keyboard('{ArrowRight}')
    expect(dernier).toHaveFocus()
  })
})

describe('les tarifs au-delà du seuil', () => {
  it('redeviennent une grille, sans onglets', async () => {
    await renderApp('/', { largeur: BUREAU })

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(document.querySelector('[data-mesure="tarifs-grille"]')).not.toBeNull()

    /* Et LÀ, la matrice est bien imprimée une fois par palier : c'est ce qui
       fait une grille comparative, et c'est la même donnée qui portait le
       défaut en une colonne. Le contraste est le sens du lot. */
    expect(document.querySelectorAll('[data-inclus]')).toHaveLength(
      FEATURE_MATRIX.length * NOMBRE_DE_PALIERS,
    )
  })
})
