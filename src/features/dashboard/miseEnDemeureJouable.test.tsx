import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LA MISE EN DEMEURE SE JOUE EN DÉMONSTRATION, SANS RIEN PRÉTENDRE.
 *
 * ═══ POURQUOI ELLE NE S'Y JOUAIT PAS ═══
 *
 * Le bouton était conditionné à `unit.leaseId`, qu'aucun bail de démonstration
 * ne porte, et le motif écrit à côté était sérieux : `serveFormalNotice` rend
 * `false` sans parc serveur, donc la boîte se serait ouverte sur une
 * confirmation qui ne fait rien. Mieux valait pas de bouton qu'un cul-de-sac.
 *
 * Conséquence mesurée : la seule modale du produit qu'aucune garde n'ouvrait.
 * Sa géométrie, son clavier, ses couleurs — rien n'était regardé.
 *
 * ═══ CE QUI CHANGE, ET CE QUI NE CHANGE PAS ═══
 *
 * Le geste se joue ENTIER : le bouton s'offre sur un retard, la boîte s'ouvre,
 * le motif est exigé, la confirmation répond. Ce qui ne change pas, c'est ce
 * qu'on affirme — la démonstration ne DIT PAS « enregistrée au dossier du
 * bail », parce que rien ne l'est. Elle le dit, et c'est la seule phrase
 * honnête qu'elle puisse tenir.
 *
 * C'est la règle que `ReplyModal` porte déjà : « sans parc serveur, la
 * démonstration ne prétend pas avoir envoyé ». Et c'est celle que la relance en
 * masse applique dans ce même écran, qui répond « rien n'est parti » plutôt que
 * d'annoncer trois relances.
 */
describe('la mise en demeure en démonstration', () => {
  async function ouvrir() {
    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    /* A3 · Serge Mbarga : vingt-quatre jours de retard, le dossier le plus
       fourni de la démonstration côté impayé. */
    const ligne = screen.getAllByRole('row').find((r) => /Serge Mbarga/.test(r.textContent ?? ''))
    expect(ligne, 'aucune ligne en retard dans la démonstration').toBeDefined()
    const bouton = within(ligne!).getByRole('button', { name: /Mettre en demeure/ })
    await utilisateur.click(bouton)
    return { utilisateur, boite: await screen.findByRole('alertdialog') }
  }

  it('s’offre sur un retard, et s’ouvre', async () => {
    const { boite } = await ouvrir()
    expect(boite).toHaveTextContent(/Mettre en demeure/)
  })

  /**
   * LE MOTIF RESTE EXIGÉ, et c'est le contrepoids.
   *
   * Rendre le geste jouable en relâchant sa validation en ferait une
   * démonstration de ce que le produit ne fait pas. Dix caractères, comme le
   * serveur — « c'est le texte qui défendra la décision ».
   */
  it('refuse un motif trop court, comme sur un vrai parc', async () => {
    const { utilisateur, boite } = await ouvrir()

    await utilisateur.type(within(boite).getByRole('textbox'), 'trop')
    await utilisateur.click(within(boite).getByRole('button', { name: /Confirmer/ }))

    expect(within(boite).getByText(/motif d’au moins 10 caractères/i)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog'), 'la boîte s’est fermée sur un motif refusé').not.toBeNull()
  })

  it('ne prétend pas avoir enregistré quoi que ce soit', async () => {
    const { utilisateur, boite } = await ouvrir()

    await utilisateur.type(
      within(boite).getByRole('textbox'),
      'Trois mois de loyer impayés malgré deux relances.',
    )
    await utilisateur.click(within(boite).getByRole('button', { name: /Confirmer/ }))

    /* LA PHRASE DU VRAI PARC NE DOIT PAS SORTIR ICI. C'est elle qui mentirait :
       aucun dossier de bail n'existe en démonstration. */
    /* La phrase du message, et non le mot « démonstration » : la coquille
       affiche « Parc de démonstration » en permanence, et viser le mot seul
       ferait passer ce cas sans qu'aucun message ne soit sorti. */
    expect(
      await screen.findByText(/rien n’est enregistré/i),
      'la démonstration ne dit pas ce qu’elle ne fait pas',
    ).toBeInTheDocument()
    expect(screen.queryByText(/enregistrée au dossier/i)).not.toBeInTheDocument()
  })
})
