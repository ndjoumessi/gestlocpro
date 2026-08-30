import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * UN DOCUMENT SUIT LA DEVISE CHOISIE, ET DIT D'OÙ VIENNENT SES MONTANTS.
 *
 * ═══ CE QUI ÉTAIT ÉPINGLÉ ═══
 *
 * L'écran réglé sur l'euro, la quittance en francs. Les documents étaient
 * ancrés à la devise du PARC — « la devise DU DOCUMENT, celle que le serveur a
 * posée à l'émission, pas celle de l'écran » — et le motif écrit à côté était
 * sérieux : « le même versement imprimé sur deux postes réglés différemment
 * portait deux monnaies ».
 *
 * Ce motif reste vrai, et c'est pourquoi la réponse n'est pas de convertir en
 * silence. Une quittance atteste d'un encaissement : écrire « 260,60 € » là où
 * 170 942 FCFA ont été reçus est faux si rien ne dit que c'est une conversion.
 *
 * ═══ CE QUI TRANCHE ═══
 *
 * La décision prise pour ce produit est « convertir partout, taux à jour ». Les
 * écrans l'appliquent depuis plusieurs lots ; les documents ne l'appliquaient
 * pas, et c'est une incohérence dans le produit avant d'en être une dans le
 * code — on lit ses loyers en euros, on télécharge une pièce en francs.
 *
 * On convertit donc, ET LA PIÈCE PORTE SA BASE : la devise d'origine, le taux
 * employé et sa date. C'est ce qui distingue une conversion d'une falsification,
 * et c'est déjà la règle du produit — « on ne sert pas un cours sans dire de
 * quand il date ».
 */

/** Ouvre la première quittance du tableau des paiements. */
async function ouvrirLaQuittance() {
  const boutons = screen.getAllByRole('button', { name: /Quittance|Receipt|Issue/ })
  await userEvent.setup().click(boutons[0])
  return await screen.findByRole('dialog')
}

describe('une pièce lue en euros', () => {
  it('porte des euros, et non les francs du parc', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements', { currency: 'EUR' })
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    const texte = (modale.textContent ?? '').replace(/[\s ]/g, ' ')

    /* 170 942 francs valent 260,60 € à la parité légale — le NOMBRE, et pas
       seulement le symbole : un ré-étiquetage garderait 170 942. */
    expect(texte, 'la pièce est restée en francs').toMatch(/260,60/)
    expect(texte, 'les francs sont restés sous un autre symbole').not.toMatch(/170 942/)
  })

  /**
   * DEUX BASES, DEUX PHRASES, ET LA DISTINCTION COMPTE.
   *
   * Le franc et l'euro sont liés par une PARITÉ de traité : 655,957, exacte et
   * sans date. Le dollar canadien FLOTTE : son cours se publie, et la pièce doit
   * dire de quel jour il date. Annoncer « au taux du 28/08 » sur une conversion
   * qui n'emploie aucun cours serait faux — et c'est ce que l'écran faisait
   * encore, dans le panneau des réglages : il datait dès qu'un cours avait été
   * reçu, sans regarder si la PAIRE en avait besoin.
   */
  it('nomme la parité légale, qui n’a pas de date', async () => {
    installerFauxServeur()
    /* LES COURS SONT EN MÉMOIRE, et c'est ce qui rend le cas mordant. Sans eux,
       la mention serait sans date par simple ignorance, et le cas passerait au
       vert sans rien prouver — il l'a fait, et la capture au navigateur l'a
       démenti : l'écran datait la parité dès qu'un cours traînait. */
    window.localStorage.setItem(
      'gestlocpro.rates',
      JSON.stringify({
        date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        parEuro: { XAF: 655.957, EUR: 1, CAD: 1.6, USD: 1.2 },
      }),
    )
    await renderApp('/demo/paiements', { currency: 'EUR' })
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    const texte = (modale.textContent ?? '').replace(/[\s ]/g, ' ')

    /* La devise D'ORIGINE : sans elle, la pièce affirme qu'on a reçu 260,60 €,
       ce qui est faux — on a reçu des francs. */
    expect(texte, 'la pièce convertit sans dire depuis quoi').toMatch(/FCFA/)
    expect(texte, 'la parité n’est pas nommée').toMatch(/parité légale|legal parity/)
    expect(texte, 'une date a été inventée pour une parité').not.toMatch(/28\/08\/2026/)
    /* ET LE NOMBRE. Une pièce se remet, se classe et se relit ailleurs : sans le
       taux, « convertis depuis le FCFA » ne se recalcule pas, et 260,60 € reste
       un chiffre qu'il faut croire sur parole. */
    expect(texte, 'la pièce nomme la parité sans l’écrire').toMatch(/1 Euro = 655,957 FCFA/)
  })

  it('date le cours quand la devise flotte', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements', { currency: 'CAD' })
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    const texte = (modale.textContent ?? '').replace(/[\s ]/g, ' ')

    /* Le cours figé du faux serveur est daté du 28/08/2026. Un montant converti
       sans date se ferait passer pour celui du jour. */
    expect(texte, 'le cours flottant n’est pas daté').toMatch(/28\/08\/2026/)
    /* Et le cours lui-même : 1,6 dollar canadien pour un euro, 655,957 francs
       pour ce même euro — donc 409,973 francs pour un dollar canadien. */
    expect(texte, 'la pièce date un cours sans le donner').toMatch(/1 CAD = 409,973 FCFA/)
  })

  /**
   * LE CONTREPOIDS. Lue dans la monnaie du parc, la pièce ne s'explique pas.
   *
   * Une mention de conversion sur un document qui n'a rien converti serait du
   * bruit — et pire, elle jetterait un doute sur des montants exacts.
   */
  it('ne s’explique pas quand elle n’a rien converti', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    const texte = (modale.textContent ?? '').replace(/[\s ]/g, ' ')

    expect(texte, 'la pièce du parc devrait porter ses propres francs').toMatch(/170 942/)
    expect(within(modale).queryByText(/Convertis|Converted/), 'mention sans conversion').toBeNull()
  })
})
