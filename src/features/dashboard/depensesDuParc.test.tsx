import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * CE QUI SORT DU PARC, ET LES TROIS FAÇONS DE LE MAL DIRE.
 *
 * ═══ LE TABLEAU NE SOMME PAS AU TOTAL, ET C'EST LE CŒUR DU LOT ═══
 *
 * Le sortant a deux moitiés — les dépenses saisies, et les chantiers achevés qui
 * portent déjà leur montant approuvé ailleurs. Le serveur les rend séparées
 * exprès : un chantier recopié en dépense serait une seconde vérité, libre de
 * diverger de son original.
 *
 * La conséquence à l'écran est contre-intuitive, donc fragile : le total des
 * indicateurs est PLUS GRAND que la somme de la colonne. Sans le premier cas
 * ci-dessous, quelqu'un « réparerait » cet écart un jour, en toute bonne foi, en
 * additionnant le tableau — et le total cesserait de dire ce que le parc a payé.
 *
 * ═══ LES TROIS PORTÉES SE LISENT EN MOTS ═══
 *
 * Une dépense appartient au parc, à un immeuble ou à un logement. Les deux
 * dernières ont un nom ; la première n'en a pas, et c'est précisément celle
 * qu'on rendrait par une case vide. Une case vide se lit « on n'a pas su »,
 * alors que la réponse est « le parc entier ».
 *
 * ═══ « NON RÉGLÉE » EST UN MOT, PAS UNE TEINTE ═══
 *
 * `couleur-non-seule` refuserait une pastille orange sans forme distinctive, et
 * elle aurait raison — mais elle ne mesure que `/demo`, et seulement ce qui y
 * est rendu. Ce cas garde l'état en toutes lettres dans le DOM, ce qu'aucune
 * mesure de silhouette ne peut faire.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * L'ÉCRITURE. En démonstration, `parkId` est nul et rien ne part au serveur —
 * la saisie, la correction et le retrait sont éprouvés côté serveur, dans
 * `depenseCorrigeable.test.ts`, contre une vraie base. Ce fichier ne garde que
 * ce que l'écran DIT.
 */
async function ouvrirLesDepenses() {
  installerFauxServeur()
  await renderApp('/demo/depenses', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
}

/**
 * LE NOMBRE D'UN MONTANT RENDU, sans sa devise ni ses séparateurs.
 *
 * `Intl.NumberFormat` pose une espace INSÉCABLE entre les milliers et avant la
 * devise : `replace(/\s/g, '')` ne suffirait pas, `\s` ne couvrant pas U+202F.
 * On ne garde donc que les chiffres — la devise est éprouvée ailleurs, et ce
 * cas-ci ne parle que de l'arithmétique.
 */
function chiffres(texte: string): number {
  const gardes = texte.replace(/[^0-9]/g, '')
  if (gardes === '') throw new Error(`Aucun chiffre dans « ${texte} »`)
  return Number(gardes)
}

/** L'indicateur qui porte ce libellé. Par `data-indicateur`, comme les autres. */
function indicateur(libelle: string): HTMLElement {
  const bloc = Array.from(document.querySelectorAll('[data-indicateur]')).find((e) =>
    e.textContent?.includes(libelle),
  )
  if (!bloc) throw new Error(`Aucun indicateur pour « ${libelle} »`)
  return bloc as HTMLElement
}

describe('les dépenses du parc', () => {
  it('SÉPARE LE TOTAL DE SES DEUX MOITIÉS, et le tableau ne somme pas au total', async () => {
    await ouvrirLesDepenses()

    /* LES TROIS NOMBRES, ET LEUR RELATION — c'est la relation qui est la garde.
       Dépenses de la démonstration : 185 000 + 60 000 + 48 000 = 293 000.
       Chantier achevé de la démonstration : 32 000. Total : 325 000.

       `/293/` seul ne gardait rien : il passait aussi sur un écran qui aurait
       additionné les deux moitiés, puisque 325 000 contient un « 2 » et un « 3 »
       — et il passait sur un chantier à zéro, puisque « 32 000 » contient un
       zéro. Trois nombres DISTINCTS, et l'inégalité écrite en clair. */
    const saisies = indicateur('Dont dépenses saisies').textContent ?? ''
    const chantiers = indicateur('Dont chantiers achevés').textContent ?? ''
    const total = indicateur('Total sorti').textContent ?? ''
    expect(chiffres(saisies)).toBe(293000)
    expect(chiffres(chantiers)).toBe(32000)
    expect(chiffres(total)).toBe(325000)

    /* LE TOTAL DÉPASSE LA COLONNE, et l'écart vaut exactement le chantier. C'est
       ce que quelqu'un « réparerait » un jour en additionnant le tableau. */
    expect(chiffres(total) - chiffres(saisies)).toBe(chiffres(chantiers))

    /* LA NOTE QUI L'EXPLIQUE, et elle est inconditionnelle : un mois sans
       chantier est celui où l'on croirait le tableau complet. */
    expect(screen.getByText('Les chantiers ne sont pas dans ce tableau')).toBeInTheDocument()
  })

  it('DIT LES TROIS PORTÉES EN MOTS, la dépense du parc comprise', async () => {
    await ouvrirLesDepenses()
    const tableau = screen.getByRole('table', { name: /Dépenses/i })

    /* Un immeuble par son NOM, un logement par son ÉTIQUETTE, et le parc par un
       mot — jamais par une case vide, qui se lirait « on n'a pas su ». */
    expect(within(tableau).getByText('Résidence Bonamoussadi')).toBeInTheDocument()
    expect(within(tableau).getByText('A3')).toBeInTheDocument()
    expect(within(tableau).getByText('Le parc')).toBeInTheDocument()
  })

  it('REND « NON RÉGLÉE » EN TOUTES LETTRES, et non par une teinte', async () => {
    await ouvrirLesDepenses()
    const tableau = screen.getByRole('table', { name: /Dépenses/i })

    /* Une seule des trois lignes de démonstration est engagée sans être réglée.
       Sans ce couple — deux payées, une non —, l'assertion passerait au vert sur
       un écran qui écrirait le mot partout. */
    expect(within(tableau).getAllByText('Non réglée')).toHaveLength(1)
  })

  it('NOMME SA FAMILLE SOUS CHAQUE LIBELLÉ, et pas en identifiant', async () => {
    await ouvrirLesDepenses()
    const tableau = screen.getByRole('table', { name: /Dépenses/i })

    /* `ExpenseCategory` a six valeurs ; la démonstration en montre trois. Ce que
       ce cas garde, c'est qu'aucune ne s'affiche en identifiant brut — le défaut
       que `valeursAffichesNommees` a déjà pris sur `app.alerts.kind.announcement`,
       lisible en toutes lettres sur une carte pendant des semaines. */
    expect(within(tableau).getByText('Taxe')).toBeInTheDocument()
    expect(within(tableau).getByText('Entretien')).toBeInTheDocument()
    expect(within(tableau).getByText('Autre')).toBeInTheDocument()
    expect(within(tableau).queryByText('tax')).not.toBeInTheDocument()
    expect(within(tableau).queryByText('upkeep')).not.toBeInTheDocument()
  })
})
