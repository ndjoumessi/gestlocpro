import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LE PANNEAU DU BAIL, ET LES TROIS CHOSES QUE SEUL L'ÉCRAN DIT.
 *
 * Le comportement — le congé qui ne termine pas le bail, la révision qui ne
 * réécrit pas les quittances, le garant qu'il faut pouvoir joindre — vit côté
 * serveur et y est éprouvé contre une vraie base (`bailEtSuretes.test.ts`). En
 * démonstration, `parkId` est nul : la lecture ne part pas, et il n'y a donc ni
 * congé ni garant à afficher.
 *
 * Ce que ce fichier garde est ce que la boîte DIT quand elle n'a rien à montrer,
 * et c'est précisément là que les écrans mentent :
 *
 *   1. « AUCUN CONGÉ DONNÉ » EST UN ÉTAT, pas une case vide. Une section de congé
 *      rendue muette se lirait « je n'ai pas su », alors que la réponse est « le
 *      bail court sans fin annoncée ».
 *
 *   2. LA CAUTION N'EST PAS UNE PERSONNE. Le produit porte les deux — `Deposit`
 *      depuis l'origine, `Guarantor` depuis ce lot — et les confondre coûte un
 *      recours le jour de l'impayé. La boîte le dit en mots.
 *
 *   3. CE QU'UNE RÉVISION NE FAIT PAS est dit AVANT le geste, sous le champ de
 *      date, et non découvert après : les échéances déjà appelées gardent leur
 *      loyer.
 */
async function ouvrirLePanneau() {
  installerFauxServeur()
  await renderApp('/demo/parc/A1', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /^Autres actions$/ }))
  await user.click(await screen.findByRole('menuitem', { name: /^Bail et sûretés$/ }))
  return { user, boite: await screen.findByRole('dialog') }
}

describe('le bail et ses sûretés', () => {
  it('NOMME L’ABSENCE DE CONGÉ, au lieu de laisser la section muette', async () => {
    const { boite } = await ouvrirLePanneau()
    expect(within(boite).getByText('Aucun congé donné')).toBeInTheDocument()
    expect(within(boite).getByText(/court sans fin annoncée/)).toBeInTheDocument()
    /* ET N'OFFRE PAS LE RETRAIT d'un congé qui n'existe pas — sans cette moitié,
       le cas passerait sur une boîte qui affiche les deux états à la fois. */
    expect(within(boite).queryByRole('button', { name: /Retirer le congé/ })).not.toBeInTheDocument()
  })

  it('DISTINGUE LA CAUTION EN ARGENT DU GARANT EN PERSONNE', async () => {
    const { boite } = await ouvrirLePanneau()
    expect(
      within(boite).getByText(/caution retenue est de l’argent ; un garant est une personne/),
    ).toBeInTheDocument()
  })

  it('PROPOSE DE CONVENIR UN PLAN quand il n’y en a aucun', async () => {
    const { user, boite } = await ouvrirLePanneau()
    await user.click(within(boite).getByRole('button', { name: /^Plan d’apurement$/ }))

    /* L'ABSENCE D'ACCORD EST UN ÉTAT, et c'est celui où l'on propose d'en
       convenir un. Une section muette se lirait « je n'ai pas su ». */
    expect(within(boite).getByText('Aucun accord en cours')).toBeInTheDocument()
    expect(within(boite).getByRole('button', { name: /^Convenir d’un plan$/ })).toBeInTheDocument()

    /* ET LES ÉCHÉANCES SE SAISISSENT UNE PAR UNE : le bouton qui en ajoute une
       est ce qui distingue un accord négocié d'un échelonnement calculé. */
    const avant = within(boite).getAllByLabelText(/Échéance le/).length
    await user.click(within(boite).getByRole('button', { name: /^Ajouter une échéance$/ }))
    expect(within(boite).getAllByLabelText(/Échéance le/).length).toBe(avant + 1)
  })

  it('N’OUVRE QU’UNE SECTION À LA FOIS, et le congé d’abord', async () => {
    const { user, boite } = await ouvrirLePanneau()

    /* LE CONGÉ EST OUVERT — c'est le geste qui a une échéance. Le loyer est
       REPLIÉ : sans cette seconde moitié, le cas passerait sur une boîte qui
       déplie tout, c'est-à-dire sur les 1196 px de défilement qu'on vient de
       retirer. */
    expect(within(boite).getByText('Aucun congé donné')).toBeInTheDocument()
    expect(
      within(boite).queryByText(/échéances déjà appelées gardent leur loyer/),
    ).not.toBeInTheDocument()

    await user.click(within(boite).getByRole('button', { name: /^Loyer$/ }))

    /* OUVRIR LE LOYER REFERME LE CONGÉ : une seule section à la fois, et c'est ce
       qui borne le défilement de la boîte. */
    expect(
      within(boite).getByText(/échéances déjà appelées gardent leur loyer/),
    ).toBeInTheDocument()
    expect(within(boite).queryByText('Aucun congé donné')).not.toBeInTheDocument()
  })
})
