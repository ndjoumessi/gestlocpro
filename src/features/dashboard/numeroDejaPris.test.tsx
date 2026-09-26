import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LE NUMÉRO D'UN LOGEMENT, DES DEUX CÔTÉS DU PARC.
 *
 * ═══ UNE RÈGLE TENUE À L'AJOUT, ABANDONNÉE À LA CORRECTION ═══
 *
 * `AddUnitModal` refuse « A1 » quand l'immeuble en a déjà un, et porte la
 * raison : « le serveur le refuse déjà en 409 — c'est lui qui fait autorité —
 * on le vérifie aussi ici pour que la correction se fasse sans aller-retour ».
 *
 * La CORRECTION envoyait et récoltait ce 409, que le fournisseur traduit en
 * « L'action a échoué » : ni le champ fautif, ni la règle, ni rien à corriger —
 * sur le seul écran où un numéro se change. Deux modales voisines, deux
 * comportements pour la même règle.
 *
 * ═══ ET CE QUI EST PRIS SE DIT AVANT DE TAPER ═══
 *
 * On ajoute rarement un logement seul : on en saisit cinq d'affilée, et la
 * question à chaque fois est « où en suis-je ». Le refus y répondait après
 * coup ; l'aide du champ y répond avant.
 */

/**
 * Ouvre une modale depuis l'écran du parc.
 *
 * LE GESTE DE CORRECTION VIT DANS UN MENU DE DÉBORDEMENT, un par logement :
 * douze boutons « Corriger » alignés ne diraient pas lequel, et la ligne n'a
 * pas la place de douze libellés. Il faut donc ouvrir le menu du logement AVANT
 * de trouver son entrée — c'est ce que fait la porte des modales, et ce que
 * faisait la première version de ce fichier en cherchant un bouton qui
 * n'existe pas encore à ce moment-là.
 */
async function ouvrirDepuisLeParc(
  user: ReturnType<typeof userEvent.setup>,
  bouton: RegExp,
  menu?: RegExp,
): Promise<HTMLElement> {
  if (menu) await user.click(screen.getAllByRole('button', { name: menu })[0])
  await user.click(screen.getAllByRole('menuitem', { name: bouton })[0])
  return await screen.findByRole('dialog')
}

describe('le numéro d’un logement', () => {
  it('annonce ce qui est déjà pris dans l’immeuble choisi', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    await user.click(screen.getAllByRole('button', { name: /ajouter un logement|add a unit/i })[0])
    const boite = await screen.findByRole('dialog')
    const champ = within(boite).getByLabelText(/^Numéro|^Number/)
    const aide = (champ.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')

    /* LE JEU PORTE DOUZE LOGEMENTS sur trois immeubles : l'aide doit en nommer
       et en compter, jamais les énumérer tous. */
    expect(aide, 'le champ ne dit pas ce qui est déjà pris').toMatch(/déjà pris|already taken/i)
    expect(aide, 'l’aperçu n’est pas borné').toMatch(/\+\d|A\d/)
  })

  it('refuse un numéro déjà pris À LA CORRECTION, sans aller-retour', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const boite = await ouvrirDepuisLeParc(
      user,
      /^Corriger le logement A1$|^Edit unit A1$/,
      /^Actions.*A1|^A1 actions/i,
    )
    const numero = within(boite).getByLabelText(/^Numéro|^Number/)

    /* UN NUMÉRO DE L'IMMEUBLE VOISIN NE SUFFIRAIT PAS : la règle porte sur
       l'immeuble, pas sur le parc. On corrige donc A1 en « A2 », son frère de
       résidence au jeu de démonstration. Le nom du bouton est celui que la
       porte des modales emploie déjà — il porte le numéro du logement, parce
       que douze boutons « Corriger » ne diraient pas lequel. */
    await user.clear(numero)
    await user.type(numero, 'A2')
    await user.click(within(boite).getByRole('button', { name: /^Enregistrer|^Save/ }))

    /* LA BOÎTE RESTE OUVERTE, le champ porte SON motif — et non le message
       générique d'échec que le 409 produisait. */
    expect(
      within(boite).getByText(/ce numéro existe déjà|already exists/i),
      'la correction accepte encore un doublon',
    ).toBeInTheDocument()
  })

  it('laisse enregistrer une fiche dont le numéro ne change pas', async () => {
    /* LE CONTREPOIDS, et il est la moitié du lot : un logement n'est pas son
       propre doublon. Sans l'exclusion par identifiant, corriger la surface
       d'un logement sans toucher à son numéro se refuserait tout seul. */
    const user = userEvent.setup()
    await renderApp('/demo/parc')
    await attendreLeChargement()

    const boite = await ouvrirDepuisLeParc(
      user,
      /^Corriger le logement A1$|^Edit unit A1$/,
      /^Actions.*A1|^A1 actions/i,
    )
    await user.click(within(boite).getByRole('button', { name: /^Enregistrer|^Save/ }))

    expect(
      within(boite).queryByText(/ce numéro existe déjà|already exists/i),
      'un logement est traité comme son propre doublon',
    ).toBeNull()
  })
})
