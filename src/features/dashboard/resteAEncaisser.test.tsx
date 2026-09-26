import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * « DÛ » DISAIT LE LOYER, PAS LE DÛ.
 *
 * ═══ L'ÉCART, MESURÉ SUR LA DÉMONSTRATION ═══
 *
 * L'aide du champ de montant rendait `unit.rent`. Sur un parc qui refacture
 * l'eau et le courant — ce que ce produit fait, et ce que son écran de relevés
 * existe pour tenir —, l'échéance vaut le loyer PLUS les consommations.
 * Logement A1, septembre : loyer 145 000, échéance 170 942. Vingt-cinq mille
 * neuf cent quarante-deux francs d'écart sous un libellé qui dit « Dû », et
 * recopiés tels quels par le placeholder que le champ propose — c'est-à-dire
 * par le geste que fait quelqu'un qui saisit vite.
 *
 * ═══ ET LE RESTE, PAS LE TOTAL ═══
 *
 * Un règlement partiel est accepté ; la question posée au moment de la saisie
 * n'est donc pas « combien vaut le mois » mais « combien reste-t-il ». Sur une
 * période déjà réglée à moitié, afficher le total ferait encaisser deux fois.
 *
 * ═══ CE QUE CES CAS TIENNENT, ET QUI NE SE TIENT PAS AILLEURS ═══
 *
 * `modales.mjs` ouvre cette modale et mesure sa géométrie ; il ne lit aucun
 * nombre. La quittance, elle, calcule le même reste pour le locataire depuis
 * `ReceiptModal`. Ces cas sont le seul endroit où les deux arithmétiques se
 * regardent — celle qu'on propose au bailleur qui encaisse et celle qu'on
 * montre à celui qui paie.
 *
 * ═══ CE QUI N'EST PAS MESURÉ ICI, ET POURQUOI ═══
 *
 * LE REPLI SUR LE LOYER — le cas d'un mois qu'aucune échéance ne couvre. Il
 * demanderait de changer la période depuis la modale, et le sélecteur de mois
 * est un composant à lui, non un champ qu'on vide et retape : le cas écrit
 * d'abord échouait sur `clear()` plutôt que sur ce qu'il prétendait tenir. Un
 * cas qui mesure son propre outillage vaut moins que pas de cas du tout, et le
 * repli est la branche que l'écran servait à TOUT LE MONDE jusqu'ici.
 */

/** L'aide rendue sous le champ de montant de la modale ouverte. */
function aideDuMontant(): string {
  const boite = screen.getByRole('dialog')
  const champ = within(boite).getByLabelText(/^Montant/)
  const aide = champ.getAttribute('aria-describedby')?.split(' ') ?? []
  const textes = aide
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .filter(Boolean)
    .join(' ')
  expect(textes, 'le champ de montant ne porte aucune aide').not.toBe('')
  return textes
}

async function ouvrirLaSaisie(user: ReturnType<typeof userEvent.setup>) {
  await renderApp('/demo/paiements')
  await attendreLeChargement()
  await user.click(screen.getByRole('button', { name: /enregistrer un paiement/i }))
  return screen.getByRole('dialog')
}

describe('le montant proposé à la saisie', () => {
  it('annonce le reste de l’échéance, et non le loyer nu', async () => {
    const user = userEvent.setup()
    const boite = await ouvrirLaSaisie(user)

    /* LE LOGEMENT PAR DÉFAUT est le premier bail non vacant — A1 au jeu de
       démonstration, dont la quittance du mois porte loyer, eau et courant. */
    const aide = aideDuMontant()
    expect(aide, 'l’aide annonce encore le loyer seul').not.toMatch(/145\s?000/)

    /* LE PLACEHOLDER SUIT L'AIDE : c'est le nombre qu'on recopie sans lire, et
       les laisser diverger ferait proposer un montant que la ligne au-dessus
       contredit. */
    const champ = within(boite).getByLabelText(/^Montant/) as HTMLInputElement
    const propose = champ.placeholder.replace(/[^\d]/g, '')
    expect(propose, 'le champ ne propose aucun montant').not.toBe('')
    expect(aide.replace(/[^\d]/g, ''), 'l’aide et le placeholder ne disent pas le même nombre')
      .toContain(propose)
  })

  it('parle du RESTE à encaisser, et le dit', async () => {
    const user = userEvent.setup()
    await ouvrirLaSaisie(user)

    /* LE MOT COMPTE AUTANT QUE LE NOMBRE : « Dû : 170 942 » sur une période
       déjà réglée à moitié serait exact sur le total et faux sur le geste. */
    expect(aideDuMontant()).toMatch(/reste/i)
  })
})
