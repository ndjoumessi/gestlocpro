import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * ON IMPRIME LE DOCUMENT, PAS L'ÉCRAN QUI LE MONTRE.
 *
 * ═══ CE QUI SORTAIT DE L'IMPRIMANTE ═══
 *
 * Deux pages, et sur chacune la même quittance TRONQUÉE : l'émetteur, le titre,
 * la période, le logement, le locataire, « DÉTAIL DE LA PÉRIODE » — puis plus
 * rien. Ni les montants, ni le statut, ni les versements. Vu en aperçu
 * d'impression.
 *
 * La cause est dans la technique elle-même. `window.print()` imprime le DOM, et
 * la feuille `@media print` éteignait la page pour ne rallumer que
 * `.zone-imprimable`. Or `visibility: hidden` CONSERVE la géométrie des
 * ancêtres : le corps de la modale reste un conteneur de défilement à hauteur
 * bornée, et il ROGNE la zone qu'il contient. On imprimait donc exactement ce
 * qui était visible à l'écran, le reste tombant hors de la boîte.
 *
 * ═══ POURQUOI ON NE RÉPARE PAS LA FEUILLE DE STYLE ═══
 *
 * On pourrait forcer `overflow: visible` sur les ancêtres au moment d'imprimer.
 * Ce serait courir après chaque ancêtre qui borne quelque chose, à chaque
 * refonte de la modale — et cela imprimerait le RENDU D'ÉCRAN : ses couleurs,
 * sa pastille, ses polices d'interface.
 *
 * Or ce produit sait déjà fabriquer la pièce : `lib/pdf`, la même que le bouton
 * « Télécharger » remet et que le locataire reçoit. Le commentaire du bouton
 * l'affirmait d'ailleurs déjà — « les deux passent maintenant par la même mise
 * en page » — et c'était faux de l'impression, seule restée sur le DOM.
 *
 * Imprimer le PDF rend la phrase vraie, supprime la feuille `@media print`
 * plutôt que de l'étendre, et garantit que la feuille sortie de l'imprimante
 * est au glyphe près celle que le locataire garde.
 */

afterEach(() => vi.restoreAllMocks())

/** Ouvre la première quittance du tableau des paiements. */
async function ouvrirLaQuittance() {
  const boutons = screen.getAllByRole('button', { name: /Quittance|Receipt|Issue/ })
  await userEvent.setup().click(boutons[0])
  return await screen.findByRole('dialog')
}

describe('l’impression d’une quittance', () => {
  it('n’imprime pas la page courante', async () => {
    /* LE CŒUR DU DÉFAUT. `window.print()` sur le document de l'application, ce
       sont les ancêtres de la modale et leurs bornes — donc un document coupé
       là où le défilement s'arrêtait. */
    const imprimerLaPage = vi.fn()
    vi.stubGlobal('print', imprimerLaPage)

    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    await userEvent.setup().click(within(modale).getByRole('button', { name: /Imprimer|Print/ }))

    expect(imprimerLaPage, 'la page de l’application part à l’imprimante').not.toHaveBeenCalled()
  })

  it('envoie à l’imprimante la pièce elle-même', async () => {
    /* Le PDF est remis à l'imprimante par une adresse d'objet — c'est ce que
       `URL.createObjectURL` fabrique, et le cas s'y accroche plutôt qu'à un
       détail de la mécanique. Sans elle, rien n'est parti. */
    const adresses: Blob[] = []
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (objet: Blob) => {
        adresses.push(objet)
        return 'blob:temoin'
      },
      revokeObjectURL: () => {},
    })

    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    await userEvent.setup().click(within(modale).getByRole('button', { name: /Imprimer|Print/ }))

    expect(adresses.length, 'aucun document n’a été fabriqué').toBeGreaterThan(0)
    expect(adresses[0]!.type, 'ce qui part à l’imprimante n’est pas un PDF').toBe('application/pdf')
  })

  /**
   * LA PROMESSE, MESURÉE : les deux boutons remettent LA MÊME pièce.
   *
   * C'est ce que le commentaire de la modale affirmait depuis un lot — « les
   * deux passent maintenant par la même mise en page » — sans que rien ne le
   * tienne. Comparer les OCTETS est la seule formulation qui ne laisse aucune
   * place : une différence de police, de marge, d'ordre ou de montant s'y voit.
   *
   * Mesuré au navigateur avant d'être écrit ici : 4 331 octets de part et
   * d'autre, `%PDF-1.4`, une seule page — contre les deux pages tronquées que
   * l'aperçu d'impression montrait.
   */
  it('imprime exactement ce qu’elle télécharge', async () => {
    const pieces: Blob[] = []
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (objet: Blob) => {
        pieces.push(objet)
        return 'blob:temoin'
      },
      revokeObjectURL: () => {},
    })

    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    const user = userEvent.setup()
    await user.click(within(modale).getByRole('button', { name: /Imprimer|Print/ }))
    await user.click(within(modale).getByRole('button', { name: /Télécharger|Download/ }))

    expect(pieces, 'les deux gestes n’ont pas produit deux pièces').toHaveLength(2)
    const [imprimee, telechargee] = await Promise.all(
      pieces.map(async (piece) => new Uint8Array(await piece.arrayBuffer())),
    )
    expect(imprimee!.length, 'les deux pièces n’ont pas la même taille').toBe(telechargee!.length)
    expect([...imprimee!], 'la feuille imprimée diffère du fichier remis').toEqual([
      ...telechargee!,
    ])
  })

  /**
   * LE CONTREPOIDS. « Télécharger » remet toujours son fichier.
   *
   * Les deux boutons partagent désormais la composition ; un correctif qui
   * aurait fait imprimer le bon document en cassant le téléchargement aurait
   * déplacé le défaut d'un bouton à l'autre.
   */
  it('laisse « Télécharger » remettre son fichier', async () => {
    const adresses: Blob[] = []
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (objet: Blob) => {
        adresses.push(objet)
        return 'blob:temoin'
      },
      revokeObjectURL: () => {},
    })

    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    await userEvent.setup().click(within(modale).getByRole('button', { name: /Télécharger|Download/ }))

    expect(adresses.length, 'aucun fichier remis').toBeGreaterThan(0)
    expect(adresses[0]!.type).toBe('application/pdf')
  })
})
