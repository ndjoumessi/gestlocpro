import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LES LISTES DE LOGEMENTS SE FILTRENT, PARCE QU'ELLES N'ONT PAS DE BORNE.
 *
 * Nelson a montré la modale d'encaissement le 2026-09-08 : un menu déroulant de
 * dix logements qu'il faut parcourir à l'œil. Douze en démonstration ; un
 * cabinet en gère des centaines, et c'est la SEULE dimension de ce produit dont
 * la longueur suive le parc.
 *
 * ═══ HUIT LISTES, ET PAS UNE DE PLUS ═══
 *
 * La règle est mesurée, pas appliquée en bloc : une liste qui grandit avec la
 * donnée se FILTRE, une liste fixée par le produit reste un CHOIX. Type de
 * logement, rôle invité, devise, méthode de paiement, énergie — deux à cinq
 * entrées, décidées par le produit — gardent leur `<select>` natif.
 *
 * MA PREMIÈRE ÉNUMÉRATION EN COMPTAIT CINQ, et elle était fausse. Le relevé
 * des `<Select>` restants en a rendu trois de plus, toutes du même genre :
 * le logement d'un relevé (la plus longue — TOUT le parc, pas les seuls
 * vacants), le logement d'une invitation, et le compte à rattacher à une
 * fiche. Compter à l'œil ce qui doit cesser d'être parcouru à l'œil : c'est
 * l'inventaire qui tranche, pas la mémoire.
 *
 * ET CE N'EST PAS DE LA TIMIDITÉ : sur un Android d'entrée de gamme, marché de
 * ce produit, un `<select>` ouvre le sélecteur du SYSTÈME — plein écran,
 * familier, sans clavier. Le `Combobox` ouvre un champ texte et le clavier
 * logiciel. Sur trois entrées, il fait perdre un geste ; sur trois cents, il
 * en fait gagner cinquante. C'est la longueur qui tranche, pas le goût.
 *
 * Les immeubles (trois en démonstration) restent donc au `<select>` eux aussi.
 *
 * ═══ CE QUE CE CAS GARDE ═══
 *
 * La propriété d'usage, et non la présence d'un composant : taper « A3 » ne
 * doit laisser qu'A3. Un menu déroulant, lui, garde ses douze entrées quoi
 * qu'on tape — c'est ce qui le fait rougir ici.
 */

/** Le champ de logement d'une modale ouverte, quelle que soit sa forme. */
function champDeLogement(modale: HTMLElement): HTMLElement {
  return within(modale).getByRole('combobox', { name: /logement|unité|unit/i })
}

describe('les logements se choisissent en tapant', () => {
  it('réduit la liste à ce qu’on tape, dans l’encaissement', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/paiements')
    await attendreLeChargement()
    await user.click(screen.getByRole('button', { name: /enregistrer un paiement/i }))

    const modale = screen.getByRole('dialog')
    const champ = champDeLogement(modale)
    await user.click(champ)
    await user.type(champ, 'A3')

    /* UNE SEULE ENTRÉE RESTE. Sur un menu déroulant, taper ne filtre rien : les
       douze logements restent offerts, et le cas rougit — c'est exactement le
       geste que Nelson a montré en capture.

       DANS LA LISTE DU CHAMP, et non dans la modale : le `<select>` de la
       méthode de paiement porte lui aussi des `option`, et les compter tous
       rendait cinq là où le filtre en laissait une. Ma première rédaction
       mesurait deux listes à la fois. */
    const offertes = within(within(modale).getByRole('listbox')).getAllByRole('option')
    expect(offertes, 'taper « A3 » doit ne laisser qu’A3').toHaveLength(1)
    expect(offertes[0]!.textContent).toMatch(/A3/)
  })

  it('choisit bien le logement tapé, et le retient', async () => {
    /*
      FILTRER NE SUFFIT PAS : le cas précédent passerait sur un champ qui
      montre la bonne liste sans rien enregistrer. On choisit donc, et on relit
      ce que le champ porte.
    */
    const user = userEvent.setup()
    await renderApp('/demo/paiements')
    await attendreLeChargement()
    await user.click(screen.getByRole('button', { name: /enregistrer un paiement/i }))

    const modale = screen.getByRole('dialog')
    const champ = champDeLogement(modale)
    await user.click(champ)
    await user.type(champ, 'B2')
    await user.click(
      within(within(modale).getByRole('listbox')).getByRole('option', { name: /B2/ }),
    )

    expect((champ as HTMLInputElement).value, 'le champ garde le logement choisi').toMatch(/B2/)
  })

  it('réduit aussi la liste du relevé, sur une autre modale', async () => {
    /*
      DEUX SITES, PAS UN. Un cas posé sur la seule modale d'encaissement
      laisserait les sept autres listes revenir au menu déroulant sans un mot —
      et celle-ci est la plus longue des huit : elle porte TOUT le parc, quand
      la fiche locataire n'offre que les logements vacants.
    */
    const user = userEvent.setup()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    await user.click(screen.getByRole('button', { name: /Saisir un relevé/ }))

    const modale = await screen.findByRole('dialog')
    const champ = champDeLogement(modale)
    await user.click(champ)
    await user.type(champ, 'A3')

    const offertes = within(within(modale).getByRole('listbox')).getAllByRole('option')
    expect(offertes, 'taper « A3 » doit ne laisser qu’A3').toHaveLength(1)
    expect(offertes[0]!.textContent).toMatch(/A3/)
  })

  it('laisse les listes FIXES en menu déroulant', async () => {
    /*
      LE CAS QUI TIENT LA RÈGLE PAR L'AUTRE BOUT. Sans lui, « mettre des
      autocomplétions partout » se lirait comme une permission, et la méthode de
      paiement — trois entrées décidées par le produit — y passerait aussi : un
      clavier logiciel pour choisir entre « Mobile Money » et « Espèces ».
    */
    const user = userEvent.setup()
    await renderApp('/demo/paiements')
    await attendreLeChargement()
    await user.click(screen.getByRole('button', { name: /enregistrer un paiement/i }))

    const modale = screen.getByRole('dialog')
    const methode = within(modale).getByRole('combobox', { name: /méthode|moyen|method/i })
    expect(
      methode.tagName,
      'une liste fixée par le produit garde le sélecteur natif du système',
    ).toBe('SELECT')
  })
})
