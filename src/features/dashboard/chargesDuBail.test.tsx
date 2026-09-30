import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LES CHARGES DU BAIL, ET LE REFUS D'ADDITIONNER.
 *
 * Le comportement — le gel à l'émission, les forfaits hors décompte, le solde
 * déduit — vit côté serveur et y est éprouvé contre une vraie base
 * (`chargesEtRegularisation.test.ts`). En démonstration, `parkId` est nul : la
 * lecture ne part pas, il n'y a donc ni ligne ni décompte à montrer.
 *
 * Ce que ce fichier garde est ce que la boîte DIT quand elle n'a rien, et le
 * seul endroit où cet écran pourrait mentir :
 *
 *   1. « AUCUNE CHARGE CONVENUE » EST UN ÉTAT, et il dit ce qui EST appelé —
 *      loyer, eau, courant. Une section muette se lirait « je n'ai pas su ».
 *
 *   2. LA NATURE D'UNE LIGNE DÉCIDE DU DÉCOMPTE, et elle est invisible sur la
 *      quittance. L'écran l'explique au moment où elle se choisit, pas après.
 */
async function ouvrirLesCharges() {
  installerFauxServeur()
  await renderApp('/demo/parc/A1', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /^Autres actions$/ }))
  await user.click(await screen.findByRole('menuitem', { name: /^Charges et régularisation$/ }))
  return { user, boite: await screen.findByRole('dialog') }
}

describe('les charges du bail', () => {
  it('NOMME L’ABSENCE DE CHARGE, et dit ce qui reste appelé', async () => {
    const { boite } = await ouvrirLesCharges()

    expect(within(boite).getByText(/Aucune charge convenue/)).toBeInTheDocument()
    /* LA SECONDE MOITIÉ COMPTE AUTANT : « aucune charge » seul laisserait croire
       que rien n'est facturé, alors que le loyer, l'eau et le courant le sont. */
    expect(
      within(boite).getByText(/seuls le loyer, l’eau et le courant sont appelés/),
    ).toBeInTheDocument()
  })

  it('EXPLIQUE CE QUI SÉPARE UNE PROVISION D’UN FORFAIT, avant qu’on choisisse', async () => {
    const { boite } = await ouvrirLesCharges()

    expect(
      within(boite).getByText(/Une provision est une avance.*Un forfait est dû quoi qu’il arrive/),
    ).toBeInTheDocument()
  })

  it('N’OUVRE QU’UNE SECTION À LA FOIS, et c’est la raison du dépliage', async () => {
    const { user, boite } = await ouvrirLesCharges()
    await user.click(within(boite).getByRole('button', { name: /^Régularisation$/ }))

    /* LA SECTION DES LIGNES S'EST REFERMÉE. Les deux déployées ensemble
       rendraient une boîte qu'il faut parcourir de bout en bout pour atteindre
       le décompte — c'est le défaut que le panneau du bail a payé en 1 196 px de
       défilement, et la raison pour laquelle ces charges ont leur propre boîte.

       LA MOITIÉ NÉGATIVE EST ICI CELLE QUI COMPTE : sans elle, le cas passerait
       sur une boîte qui affiche les deux sections à la fois. */
    expect(within(boite).queryByText(/Aucune charge convenue/)).not.toBeInTheDocument()
    expect(within(boite).getByLabelText(/^Dépenses retenues/)).toBeInTheDocument()
    /* CE QU'ON DEMANDE EST DIT : la somme qu'on OPPOSE au locataire, et non une
       dépense qu'on retrouverait quelque part dans le produit.

       LA PHRASE QUI REFUSE DE RÉPARTIR les dépenses d'immeuble n'est PAS
       atteignable ici : elle accompagne les trois nombres du brouillon, que la
       démonstration ne charge pas faute de parc. C'est `chargesEtRegularisation`
       qui garde leur séparation, contre une vraie base. */
    expect(
      within(boite).getByText(/somme que vous opposez au locataire/),
    ).toBeInTheDocument()
  })
})
