import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { bornesDesPeriodes } from './Payments'

/**
 * UNE DATE SANS SON ANNÉE, LÀ OÙ L'ANNÉE DÉCIDE.
 *
 * ═══ CE QUI RENDAIT LE DÉFAUT INVISIBLE ═══
 *
 * Toutes ces dates sont justes. Aucune n'est fausse, aucune porte ne les refuse,
 * et sur la démonstration — un mois, une année — elles se lisent parfaitement.
 * Le défaut n'apparaît qu'au deuxième millésime, c'est-à-dire chez l'utilisateur
 * et jamais ici.
 *
 * ═══ TROIS SITES, TROIS RAISONS DISTINCTES ═══
 *
 * 1. LA VACANCE garde délibérément les annonces FERMÉES — « l'annonce RESTE en
 *    base : c'est elle qui dit à quel prix on avait demandé ». Une annonce fermée
 *    l'an dernier affichait « 1 août », indiscernable du 1er août qui vient.
 *
 * 2. LES DÉPENSES bornent leur lecture sur `incurredOn` — `where: { incurredOn:
 *    { gte: debut, lte: fin } }` — et SEULEMENT sur lui. `paidOn` n'est borné par
 *    rien : une facture de mars réglée en janvier suivant s'affichait « 12 janv. »
 *    sous un mois de mars, donc se lisait AVANT la dépense qu'elle solde.
 *
 * 3. LES PAIEMENTS titrent six colonnes au mois seul, sur une fenêtre qui est
 *    « les six dernières périodes CONNUES » : elle franchit une fin d'année une
 *    fois sur deux, et cet écran ne porte aucun sélecteur de période.
 *
 *    LE DÉFAUT Y EST L'INVERSE DE L'HABITUEL : chaque cellule porte déjà
 *    « Mai 2026 · … » dans son nom accessible. Un lecteur d'écran reçoit l'année ;
 *    l'œil ne la reçoit nulle part sur l'écran.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * Les six périodes des paiements peuvent être NON CONTIGUËS — un parc sans
 * échéance en juillet rend « juin, août » côte à côte, lus comme une suite. La
 * marque d'année ne dit rien de ce trou-là. NOMMÉ, pas corrigé.
 */
describe('la fenêtre que l’axe des périodes montre', () => {
  /*
    FONCTION PURE, ÉPROUVÉE DIRECTEMENT. La démonstration ne porte qu'une année :
    un cas qui passerait par l'écran ne pourrait pas voir le franchissement, qui
    est précisément ce qu'on garde. On n'invente pas une fixture à deux
    millésimes pour éprouver deux bornes.
  */
  it('REND SES DEUX BORNES, qui datent les six colonnes d’un axe monotone', () => {
    expect(
      bornesDesPeriodes([
        { year: 2026, month: 10 },
        { year: 2026, month: 11 },
        { year: 2027, month: 0 },
      ]),
    ).toEqual({ debut: { year: 2026, month: 10 }, fin: { year: 2027, month: 0 } })
  })

  it('REND LA MÊME DEUX FOIS SUR UNE PÉRIODE UNIQUE, et c’est à l’écran de le dire', () => {
    expect(bornesDesPeriodes([{ year: 2026, month: 4 }])).toEqual({
      debut: { year: 2026, month: 4 },
      fin: { year: 2026, month: 4 },
    })
  })

  it('NE DIT RIEN D’UNE LISTE VIDE', () => {
    expect(bornesDesPeriodes([])).toBeNull()
  })
})

describe('les dates qui portaient leur année nulle part', () => {
  it('LA VACANCE DATE SA DISPONIBILITÉ AVEC SON ANNÉE', async () => {
    installerFauxServeur()
    await renderApp('/demo/vacance', { largeur: 1280 })
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    const table = document.querySelector('table')!
    const rang = Array.from(table.querySelectorAll('thead th')).findIndex((th) =>
      /disponible/i.test(th.textContent ?? ''),
    )
    expect(rang, 'aucune colonne de disponibilité').toBeGreaterThanOrEqual(0)

    const cellules = Array.from(table.querySelectorAll('tbody tr'))
      .filter((tr) => tr.children.length > 1)
      .map((tr) => tr.children[rang]?.textContent ?? '')
    expect(cellules.length, 'aucune annonce à dater').toBeGreaterThan(0)

    /* QUATRE CHIFFRES, pas une forme de date particulière : le pays décide de
       l'ordre et des séparateurs, pas ce cas. Ce qu'on exige est qu'une ANNÉE
       soit là, sur chaque ligne. */
    for (const c of cellules) {
      expect(c, `« ${c} » ne porte pas d’année`).toMatch(/\d{4}/)
    }
  })

  it('LES DÉPENSES DATENT LE RÈGLEMENT AVEC SON ANNÉE, que le mois affiché ne borne pas', async () => {
    await renderApp('/demo/depenses', { largeur: 1280 })
    await attendreLeChargement()

    const table = document.querySelector('table')!
    const entetes = Array.from(table.querySelectorAll('thead th'))
    const rang = entetes.findIndex((th) => /réglée/i.test(th.textContent ?? ''))
    expect(rang, 'aucune colonne de règlement').toBeGreaterThanOrEqual(0)

    const reglees = Array.from(table.querySelectorAll('tbody tr'))
      .filter((tr) => tr.children.length > 1)
      .map((tr) => tr.children[rang]?.textContent ?? '')
      /* LA LIGNE NON RÉGLÉE EST ÉCARTÉE : elle porte un MOT, pas une date, et
         c'est délibéré — le fichier de démonstration la pose exprès. */
      .filter((c) => /\d/.test(c))
    expect(reglees.length, 'aucune dépense réglée dans la démonstration').toBeGreaterThan(0)

    for (const c of reglees) {
      expect(c, `« ${c} » ne porte pas d’année`).toMatch(/\d{4}/)
    }
  })

  it('LES DÉPENSES NOMMENT LA PÉRIODE QU’ELLES MONTRENT, même en démonstration', async () => {
    /*
      LE PARC A DÉJÀ TRANCHÉ CE CAS, et son commentaire dit pourquoi : la
      première forme laissait « un libellé passif : Nelson l'a pris pour un
      sélecteur en panne, et il avait raison de le prendre pour un sélecteur ».
      Il s'ouvre donc partout, et en démonstration `min` et `max` le ferment sur
      le seul mois qu'elle porte.

      Les dépenses, elles, le SUPPRIMAIENT hors session : l'écran n'annonçait
      alors AUCUNE période, et ses dates au jour-mois n'avaient plus rien pour
      les situer. C'est la moitié qui rend l'autre lisible — sans mois nommé,
      « 4 août » ne se rattache à aucune année.
    */
    await renderApp('/demo/depenses', { largeur: 1280 })
    await attendreLeChargement()

    const main = within(screen.getByRole('main'))
    /* PAR SON NOM ACCESSIBLE RÉEL — `app.expenses.periodShown`, « Mois affiché ».
       Ma première rédaction cherchait « période affichée », qui est le nom de la
       clé et non son texte : la sonde rougissait pour elle-même. */
    const champ = main.getByLabelText(/mois affiché/i)
    expect(champ, 'la démonstration ne nomme aucune période').toBeInTheDocument()
    /* CE QUE L'ÉCRAN MONTRE, et non la valeur d'un champ : `MonthPicker` rend un
       BOUTON — ma première rédaction lisait un `.value` qui n'existe pas ici, et
       obtenait '' sans que ce vide dise quoi que ce soit du produit. Le bouton
       porte « Août 2026 », et c'est l'ANNÉE qui est en jeu dans ce lot. */
    expect(
      champ.textContent ?? '',
      'le sélecteur ne nomme ni mois ni année',
    ).toMatch(/\d{4}/)
  })

  it('LES PAIEMENTS NOMMENT LA FENÊTRE QUE LEUR GRILLE MONTRE', async () => {
    await renderApp('/demo/paiements', { largeur: 1280 })
    await attendreLeChargement()

    const table = document.querySelector('table')!
    const entetes = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent ?? '',
    )
    /* LES COLONNES DE PÉRIODE SE PRENNENT PAR UNE ANCRE NOMMÉE : elles suivent
       « Solde cumulé » et s'arrêtent à la colonne de gestes, dont l'en-tête est
       vide. On vérifie d'abord qu'elles ne portent PAS l'année — c'est la
       première rédaction, refusée sur mesure : « mai 26 » se replie dans la
       fiche et jette les pastilles de mai sur une troisième rangée. */
    const depart = entetes.findIndex((e) => /solde/i.test(e))
    const periodes = entetes.slice(depart + 1).filter((e) => e.trim() !== '')
    expect(periodes.length, 'aucune colonne de période').toBeGreaterThan(1)
    expect(
      periodes[0],
      'l’année est revenue sur les colonnes, où elle replie l’axe',
    ).not.toMatch(/\d/)

    /* ET L'ÉCRAN LA NOMME AILLEURS, une fois, avec ses deux bornes. Sans cela on
       aurait seulement supprimé la première rédaction. */
    const main = within(screen.getByRole('main'))
    const fenetre = main.getByText(/périodes? affichées?\s*:/i)
    expect(
      fenetre.textContent ?? '',
      'la fenêtre ne porte pas d’année',
    ).toMatch(/\d{4}/)
  })
})
