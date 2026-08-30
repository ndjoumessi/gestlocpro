import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'

/**
 * LE DOSSIER D'UN LOGEMENT ÉTAIT UNE IMPASSE EN LECTURE SEULE.
 *
 * ═══ CE QU'IL MONTRAIT, ET CE QU'IL N'OFFRAIT PAS ═══
 *
 * Quatre cartes : les baux successifs, les six dernières périodes facturées, les
 * interventions, les pièces du dossier. Tout ce qu'on peut vouloir savoir d'un
 * logement, et le seul bouton de la page était « Retour au parc ».
 *
 * Ce n'est pas une fatalité de données : les modales du produit acceptent DÉJÀ
 * une unité. `ReceiptModal` prend un `unitId`, `OpenWorkModal` et
 * `InspectionModal` prennent une liste de logements dont elles présélectionnent
 * le premier. Trois gestes atteignables depuis un écran qui n'en offrait aucun.
 *
 * ═══ ET AUCUN CHIFFRE, ALORS QUE TOUT ÉTAIT COMPTÉ ═══
 *
 * Le reste dû se calcule PAR LIGNE dans la carte des périodes — « reste
 * 5 058 FCFA » — et n'est jamais totalisé. Le montant des travaux se calcule par
 * ligne et n'est jamais sommé. La caution est affichée. Les trois nombres qui
 * disent l'état d'un logement existaient, dispersés, en petit.
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 *   1. l'écran ouvre sur les trois chiffres qu'il calculait déjà ;
 *   2. il offre au moins un geste qui n'est pas un retour en arrière ;
 *   3. le reste dû AGRÉGÉ est bien la somme des restes de ses lignes — sans ce
 *      troisième cas, une carte affichant zéro passerait.
 */

async function ouvrir() {
  await renderApp('/demo/parc/A1')
  await attendreLeChargement()
}

/** Les cartes d'indicateur de l'écran. */
function indicateurs(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-indicateur]')) as HTMLElement[]
}

const texteDe = (el: HTMLElement) => (el.textContent ?? '').replace(/\s/g, ' ')

describe('le dossier d’un logement', () => {
  it('ouvre sur les chiffres qu’il calculait déjà', async () => {
    await ouvrir()
    expect(indicateurs().length, 'aucun chiffre en tête du dossier').toBeGreaterThan(0)
  })

  it('totalise le reste dû, au lieu de le laisser par ligne', async () => {
    await ouvrir()
    /*
      A1 EST LE SEUL LOGEMENT DE LA DÉMONSTRATION À TRAÎNER UN RELIQUAT : son
      historique est écrit à la main, et mai 2026 y laisse 5 058 F. C'est
      exactement le nombre que la carte des périodes affiche en rouge sur cette
      ligne, et que rien ne totalisait.

      On le cherche dans la RANGÉE D'INDICATEURS et non dans la page : le
      trouver ailleurs prouverait seulement que la ligne existe toujours.
    */
    const tout = indicateurs().map(texteDe).join(' | ')
    expect(tout, 'le reste dû n’est pas totalisé en tête').toContain('5 058')
  })

  it('offre un geste qui n’est pas un retour en arrière', async () => {
    await ouvrir()
    const enTete = document.querySelector('[data-en-tete-de-page]') as HTMLElement
    const commandes = within(enTete)
      .queryAllByRole('button')
      .concat(within(enTete).queryAllByRole('link'))
      .map((c) => c.textContent?.trim() ?? '')

    /* Le retour reste — c'est le seul chemin vers le parc hors du bouton du
       navigateur. Ce que ce cas refuse, c'est qu'il soit le SEUL. */
    expect(commandes.some((c) => /retour/i.test(c)), 'le retour au parc a disparu').toBe(true)
    expect(
      commandes.filter((c) => !/retour/i.test(c)).length,
      'le dossier ne propose que de le quitter',
    ).toBeGreaterThan(0)
  })

  it('atteint la quittance du logement depuis son dossier', async () => {
    await ouvrir()
    /*
      LE GESTE LE PLUS DEMANDÉ D'UN DOSSIER : sortir la quittance du mois. Il
      vivait uniquement sur la grille des paiements, ligne par ligne, alors que
      `ReceiptModal` prend un `unitId` depuis toujours — il n'y avait rien à
      construire, seulement à appeler.
    */
    const { cliquerAction } = await import('@/test/render')
    await cliquerAction(/quittance/i)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
