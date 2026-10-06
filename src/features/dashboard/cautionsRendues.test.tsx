import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp } from '@/test/render'

/**
 * UNE CAUTION RENDUE EST SORTIE DU CONSIGNÉ, ET LE PIED DOIT LE DIRE.
 *
 * ═══ LA MÊME SOUSTRACTION, DÉJÀ TRANCHÉE SUR LE PAPIER ═══
 *
 * L'état des cautions en PDF a payé ce défaut et l'a corrigé, dans ces termes :
 * « Un filet au-dessus d'un total en gras est une PROMESSE DE CALCUL — 1 869,02
 * moins 248,49 font 1 620,53, et la feuille annonçait 1 239,41. L'écart était
 * exactement la caution rendue. » Il s'est donné un QUATRIÈME TERME, conditionnel :
 * « elle n'apparaît que si elle manque ».
 *
 * Le pied du tableau porte les trois mêmes nombres, côte à côte, sous trois
 * en-têtes qui se lisent comme une soustraction — et pas le quatrième. L'écran
 * et le document disaient donc la même chose de deux façons dont une seule se
 * recoupe.
 *
 * ═══ POURQUOI LE CONSIGNÉ N'EST PAS RESSERRÉ À LA PLACE ═══
 *
 * Exclure les cautions rendues du « Total consigné » fermerait aussi la
 * soustraction, et c'est l'autre monde : le PDF a choisi le premier — consigné
 * = ce qui a été versé —, et deux surfaces qui donnent deux « Total consigné »
 * différents sur le même parc seraient le défaut qu'on prétend corriger.
 *
 * ═══ AUCUN MONTANT ÉCRIT EN DUR ═══
 *
 * L'écart se CALCULE sur les nombres du pied lui-même. Un cas qui inscrirait
 * 381,12 rougirait au premier changement des données de démonstration sans rien
 * avoir gardé — et surtout, il ne dirait plus que les trois nombres se
 * recoupent, seulement qu'ils valent ce qu'on a recopié.
 */

/** Les chiffres d'un montant rendu — insécables, signes et devise retirés. */
function chiffres(texte: string): number {
  const nombre = Number(texte.replace(/[^\d]/g, ''))
  return Number.isNaN(nombre) ? 0 : nombre
}

/**
 * Le total d'une cellule de pied, SANS la mention qu'elle porte peut-être.
 *
 * PREMIÈRE RÉDACTION : « la mention est le seul élément enfant de la cellule ».
 * Fausse — la colonne « Retenu » enveloppe sa valeur dans un `<span>` pour la
 * peindre, et la garde soustrayait donc la retenue de la retenue. Elle lisait
 * zéro et accusait le pied d'un écart de 413 000 qui n'existait pas.
 *
 * La mention porte donc un nom, et c'est ce nom qu'on retire.
 */
function somme(cellule: Element): number {
  return chiffres((cellule.textContent ?? '').replace(mention(cellule), ''))
}

/** Ce que la cellule dit EN PLUS de son total. Vide quand elle ne dit rien. */
function mention(cellule: Element): string {
  return cellule.querySelector('[data-ecart]')?.textContent ?? ''
}

/** La cellule du pied à l'aplomb de la colonne qui porte cet en-tête. */
function pied(entete: RegExp): Element {
  const table = document.querySelector('table')
  if (!table) throw new Error('aucun tableau à l’écran')
  const entetes = Array.from(table.querySelectorAll('thead th'))
  const rang = entetes.findIndex((th) => entete.test(th.textContent ?? ''))
  if (rang < 0) throw new Error(`aucune colonne d’en-tête ${entete}`)
  const rangee = table.querySelector('tfoot [data-total]')
  if (!rangee) throw new Error('le tableau n’a pas de pied de totaux')
  const portee = Number(rangee.children[0]?.getAttribute('colspan') ?? 1)
  const cellule = rangee.children[rang - portee + 1]
  if (!cellule) throw new Error(`le pied n’a pas de cellule sous ${entete}`)
  return cellule
}

describe('le pied des cautions se recoupe', () => {
  it('PORTE L’ÉCART que les cautions rendues creusent entre ses trois nombres', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const restituer = pied(/^À restituer$/)

    /* L'ÉCART EST CE QUE LA SOUSTRACTION NE FERME PAS. Il serait nul sur un parc
       sans caution rendue — et le cas le dit, plutôt que de garder une règle qui
       ne s'appliquerait à rien. */
    const ecart = somme(pied(/^Consigné$/)) - somme(pied(/^Retenu$/)) - somme(restituer)
    expect(
      ecart,
      'la démonstration n’a plus de caution rendue : ce cas ne garde rien',
    ).toBeGreaterThan(0)

    expect(
      chiffres(mention(restituer)),
      'le pied laisse trois nombres qui ne se recoupent pas',
    ).toBe(ecart)
  })

  it('NE DIT RIEN QUAND LA SOUSTRACTION TOMBE JUSTE', async () => {
    /* FILTRÉ SUR « CONSIGNÉE », aucune ligne rendue n'est affichée : les trois
       nombres se recoupent d'eux-mêmes, et une mention d'écart nul serait un
       statut de plus à lire. Même condition que sur le PDF.

       LE PIED SOMME CE QU'IL MONTRE : la mention se calcule donc sur les lignes
       AFFICHÉES, et non sur le parc — sans quoi elle survivrait au filtre qui
       l'a vidée. */
    await renderApp('/demo/cautions?etat=held')
    await attendreLeChargement()

    const restituer = pied(/^À restituer$/)
    expect(
      somme(pied(/^Consigné$/)) - somme(pied(/^Retenu$/)) - somme(restituer),
      'le filtre « consignée » laisse passer une caution rendue',
    ).toBe(0)
    expect(mention(restituer), 'le pied annonce un écart là où il n’y en a pas').toBe('')
  })
})
