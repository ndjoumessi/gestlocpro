import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * L'ÉCRAN DE LA VACANCE, ET LES DEUX CHOSES QUE SEUL L'ÉCRAN DIT.
 *
 * Le comportement — le logement occupé refusé, le congé qui rouvre la fenêtre,
 * le loyer demandé qui ne touche pas celui du logement — vit côté serveur et y
 * est éprouvé contre une vraie base (`annoncesEtCandidats.test.ts`).
 *
 * Ce que ce fichier garde est ce que l'écran DIT, et c'est là qu'un tableau de
 * bord ment le plus facilement :
 *
 *   1. LE PREMIER INDICATEUR N'EST PAS UNE SOMME D'ANNONCES. « Logements
 *      vides » compte les logements SANS bail, et sa note dit combien n'ont
 *      AUCUNE annonce — le cas qui coûte, et celui qu'une somme d'annonces
 *      rendrait invisible.
 *
 *   2. CE QUE L'ÉCRAN NE SAIT PAS, IL LE DIT. Il ne chiffre pas ce que la
 *      vacance coûte : le produit sait ce qu'un logement a rapporté, pas ce
 *      qu'il aurait rapporté. La note est INCONDITIONNELLE — un parc sans
 *      logement vide est précisément celui où l'on croirait l'écran complet.
 */
async function ouvrirLaVacance() {
  installerFauxServeur()
  await renderApp('/demo/vacance', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
  return { user: userEvent.setup() }
}

describe('la vacance du parc', () => {
  it('COMPTE LES LOGEMENTS VIDES, et nomme ceux qui n’ont aucune annonce', async () => {
    await ouvrirLaVacance()

    /* LA DÉMONSTRATION PORTE DEUX LOGEMENTS VIDES — `B4` et `C3` — et DEUX
       annonces, dont une FERMÉE sur un logement OCCUPÉ. Les deux quantités
       divergent donc, et c'est ce qui rend ce cas mesurable : dériver le
       compteur des annonces au lieu des logements rendrait 1 au lieu de 2.

       `C3` N'A AUCUNE ANNONCE, et c'est le cas qui coûte. */
    /* LA VALEUR EST LUE DANS SA CARTE, et non sur la page : « 2 » paraît
       ailleurs — le compte des candidats en est un —, et un `getByText` global
       rendrait le cas vert pour une raison qui n'est pas la sienne.

       `[data-indicateur]` ET NON `div` : la carte en empile plusieurs, et
       remonter d'un seul niveau attrape la boîte du LIBELLÉ, pas celle qui
       porte aussi la valeur. Ce repère existe pour cela — voir `Charts.tsx`. */
    const carte = screen.getByText('Logements vides').closest<HTMLElement>('[data-indicateur]')!
    expect(within(carte).getByText('2')).toBeInTheDocument()
    expect(within(carte).getByText(/1 sans annonce en cours/)).toBeInTheDocument()
  })

  it('DIT CE QU’IL NE SAIT PAS CHIFFRER', async () => {
    await ouvrirLaVacance()

    /* Le produit sait ce qu'un logement A rapporté ; il ne sait pas ce qu'il
       AURAIT rapporté. Un écran de vacance qui affiche un coût sans le dire
       invente un manque à gagner.

       CE CAS NE PROUVE PAS QUE LA NOTE EST INCONDITIONNELLE, et je ne le
       prétends pas : la démonstration a toujours des logements vides et des
       annonces, donc toute condition qu'on lui accrocherait serait vraie ici.
       Une mutation qui la rend conditionnelle passe au vert — mesuré. Ce que ce
       cas tient est sa PRÉSENCE et son contenu ; l'inconditionnalité vit dans
       le code, sous les yeux, et rien ici ne la garde. */
    expect(
      screen.getByText(/ne chiffre pas ce que la vacance coûte/),
    ).toBeInTheDocument()
  })

  it('DISTINGUE UNE ANNONCE PUBLIÉE D’UNE ANNONCE FERMÉE PAR UN MOT', async () => {
    await ouvrirLaVacance()
    const tableau = screen.getByRole('table')

    /* PAS DE COULEUR SEULE : « publiée » et « brouillon » sont des MOTS. C'est
       la seule colonne qui dit si l'on attend encore des candidats, et une
       teinte aurait demandé une légende. */
    expect(within(tableau).getByText('Publiée')).toBeInTheDocument()
    expect(within(tableau).getByText('Fermée')).toBeInTheDocument()
  })

  it('OUVRE LA BOÎTE D’UNE ANNONCE SUR SES CANDIDATS', async () => {
    const { user } = await ouvrirLaVacance()

    await user.click(screen.getByRole('button', { name: /Immeuble Akwa Nord — B4/ }))
    const boite = await screen.findByRole('dialog')

    expect(within(boite).getByText('Chantal Ekwalla')).toBeInTheDocument()
    /* LA SUITE DONNÉE SE CHOISIT PAR CANDIDAT, et son libellé le NOMME : deux
       listes déroulantes identiques côte à côte seraient indiscernables à
       l'oreille. */
    expect(
      within(boite).getByLabelText(/Suite donnée à Chantal Ekwalla/),
    ).toBeInTheDocument()
  })

  it('DONNE LE LIEN PUBLIC D’UNE ANNONCE PUBLIÉE, et affiche l’adresse à côté', async () => {
    /*
      SANS CE GESTE, LA PAGE PUBLIQUE N'EXISTE POUR PERSONNE. `/annonce/:id` est
      servie depuis ce lot, mais l'identifiant d'une annonce n'était affiché
      nulle part : le bailleur aurait dû composer l'adresse à la main depuis un
      uuid qu'il ne voyait pas.

      L'ADRESSE EST AFFICHÉE EN PLUS DU BOUTON, et c'est la moitié qu'on oublie :
      `navigator.clipboard` peut être refusé — navigation privée, permission
      absente — et un bouton dont l'échec est muet ne laisse aucune issue. Même
      parade que le code d'invitation, qui a eu le même problème avant.
    */
    const { user } = await ouvrirLaVacance()

    await user.click(screen.getByRole('button', { name: /Immeuble Akwa Nord — B4/ }))
    const boite = await screen.findByRole('dialog')

    expect(
      within(boite).getByRole('button', { name: /Copier le lien public/ }),
    ).toBeInTheDocument()
    expect(
      within(boite).getByText('/annonce/ann-demo-1'),
      'l’adresse reste sélectionnable quand le presse-papiers est refusé',
    ).toBeInTheDocument()
  })

  it('NE DONNE AUCUN LIEN pour une annonce FERMÉE', async () => {
    /*
      LE CAS QUI REND LA RÈGLE FALSIFIABLE. Un brouillon et une annonce fermée
      rendent 404 sur la route publique : proposer leur lien donnerait un lien
      MORT à envoyer, et c'est le genre de geste qui fait douter du produit
      plutôt que de l'annonce.

      Sans ce cas, le précédent passerait sur un bouton affiché partout.
    */
    const { user } = await ouvrirLaVacance()

    await user.click(screen.getByRole('button', { name: /Villa Deïdo — C2/ }))
    const boite = await screen.findByRole('dialog')

    expect(
      within(boite).queryByRole('button', { name: /Copier le lien public/ }),
    ).not.toBeInTheDocument()
  })

  it('SOMME LE LOYER DEMANDÉ, qui n’est chiffré nulle part ailleurs sur l’écran', async () => {
    /*
      LA SIXIÈME COLONNE D'ARGENT DU PRODUIT, ET LA SEULE SANS SOMME.

      Les cinq autres offraient au moins leur total en carte d'indicateur — c'est
      le défaut que le pied de colonne est venu corriger. Ici les trois cartes
      comptent des logements, des annonces et des candidats : pas un montant.
      « Combien de loyer ce parc demande-t-il en ce moment » n'était écrit nulle
      part, sur l'écran dont c'est la question.

      LA NOTE DE L'ÉCRAN DIT AUTRE CHOSE, et elle reste vraie : le produit ne sait
      pas ce que la vacance COÛTE — ce qu'un logement aurait rapporté. Le loyer
      DEMANDÉ, lui, est connu, et l'écran l'affiche déjà ligne à ligne.

      LA SOMME EST CELLE DES CELLULES LUES, jamais un montant recopié.
    */
    await ouvrirLaVacance()

    const table = document.querySelector('table')
    expect(table, 'l’écran de la vacance ne rend plus de tableau').not.toBeNull()
    const entetes = Array.from(table!.querySelectorAll('thead th'))
    const rang = entetes.findIndex((th) => /loyer/i.test(th.textContent ?? ''))
    expect(rang, 'aucune colonne de loyer').toBeGreaterThanOrEqual(0)

    const chiffres = (texte: string) => Number(texte.replace(/[^\d]/g, '')) || 0
    const cellules = Array.from(table!.querySelectorAll('tbody tr'))
      .filter((tr) => tr.children.length > 1)
      .map((tr) => tr.children[rang]?.textContent ?? '')
    expect(cellules.length, 'une somme d’un seul terme est ce terme').toBeGreaterThan(1)

    const rangee = table!.querySelector('tfoot [data-total]')
    expect(rangee, 'la colonne du loyer demandé n’a pas de somme').not.toBeNull()
    const portee = Number(rangee!.children[0]?.getAttribute('colspan') ?? 1)
    expect(
      chiffres(rangee!.children[rang - portee + 1]?.textContent ?? ''),
      'le pied ne fait pas la somme de ses cellules',
    ).toBe(cellules.reduce((somme, c) => somme + chiffres(c), 0))
  })
})
