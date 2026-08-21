import { describe, expect, it, vi } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'

/**
 * LE PANNEAU DE LA VITRINE, DES DEUX CÔTÉS DU SEUIL.
 *
 * Le lot « la barre de la vitrine » avait descendu les trois réglages dans le
 * menu, et laissé le menu tel quel : une feuille pleine page. Mesuré au
 * navigateur à 2000 px, menu ouvert — les quatre liens de section rendus deux
 * fois, dans la barre et dans le panneau ; « Se connecter » et « Essayer
 * gratuitement » à 1960 px de large chacun ; 1021 px de haut pour quatre liens
 * et trois réglages ; le panneau commençant à 20 px du bord pendant que le logo
 * commençait à 392.
 *
 * CE QUE CE FICHIER TIENT, ET CE QU'IL NE TIENT PAS. Ici : le CÂBLAGE — quel
 * contenu est monté de chaque côté du seuil, et quels devoirs clavier le
 * panneau se donne selon qu'il est feuille ou liste déroulante. Pas la
 * géométrie : jsdom ne calcule aucune boîte, et « le panneau s'aligne sur la
 * bande de la page » ne veut rien dire sans mise en page. C'est `mesure-ui` qui
 * la tient, au navigateur, à 1440 px — voir sa règle du doublon.
 *
 * POURQUOI ON POSE `matchMedia` PLUTÔT QUE DE REDIMENSIONNER. jsdom fournit
 * bien la fonction mais n'évalue aucune largeur : toute requête y est fausse,
 * quelle que soit la « fenêtre ». Sans ce faux, le composant croirait la barre
 * étroite dans tous les cas, et la moitié grand écran de ce fichier ne
 * mesurerait rien. C'est le pendant assumé de la remarque de
 * `menuMobile.test.tsx` sur `xl:hidden`.
 */
const AU_DELA = (seuils: Record<string, boolean>) => {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: seuils[requete] ?? false,
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }))
}

/** Le grand écran : la barre montre ses liens ET ses deux boutons. */
const GRAND_ECRAN = { '(min-width: 64rem)': true, '(min-width: 40rem)': true }
/** La tablette : la barre montre ses boutons, pas encore ses liens. */
const TABLETTE = { '(min-width: 64rem)': false, '(min-width: 40rem)': true }

const ouvrirLesReglages = async () => {
  const user = userEvent.setup()
  const declencheur = screen.getByRole('button', { name: 'Ouvrir les réglages' })
  await user.click(declencheur)
  return { user, declencheur, panneau: screen.getByTestId('menu-mobile') }
}

describe('panneau de la vitrine au-delà de lg', () => {
  /*
    LE CAS DU LOT. Il ne nomme aucun libellé en dur : il lit ce que la BARRE
    rend, puis exige que le panneau n'en reprenne rien. Écrire « le panneau ne
    contient pas “Tarifs” » aurait tenu jusqu'au premier renommage, et surtout
    n'aurait rien dit du jour où un cinquième lien arrive — celui-là passerait
    en double sans que rien ne rougisse. On compare les deux ensembles, pas des
    chaînes choisies à la main.
  */
  it('ne rejoue aucun libellé que la barre montre déjà', async () => {
    AU_DELA(GRAND_ECRAN)
    await renderApp('/')

    // Le MARQUEUR de la rangée, et non `role="banner"` : la page en porte deux
    // — l'en-tête de la vitrine et celui du pied de démonstration — et
    // `getByRole` tombe sur l'ambiguïté avant de tomber sur le bon. C'est aussi
    // l'ancre que `mesure-ui` interroge, donc les deux gardes regardent
    // littéralement le même nœud.
    const barre = document.querySelector('[data-mesure="rangee-entete-vitrine"]') as HTMLElement
    const dansLaBarre = within(barre)
      .getAllByRole('link')
      .map((el) => el.textContent?.trim())
      .filter(Boolean)

    // Sans quoi le cas serait vacue : rien à rejouer, rien qui puisse rejouer.
    // C'est la garde du garde de `mesure-ui`, dans sa version jsdom.
    expect(dansLaBarre.length).toBeGreaterThanOrEqual(2)

    const { panneau } = await ouvrirLesReglages()
    const dansLePanneau = within(panneau)
      .queryAllByRole('link')
      .map((el) => el.textContent?.trim())
      .filter(Boolean)

    expect(dansLePanneau.filter((nom) => dansLaBarre.includes(nom!))).toEqual([])
  })

  it('ne porte que les trois réglages, et rien d’autre à cliquer', async () => {
    AU_DELA(GRAND_ECRAN)
    await renderApp('/')

    const { panneau } = await ouvrirLesReglages()

    // Les trois réglages y sont — c'est la dette du lot précédent, et elle ne
    // se rembourse pas en vidant le panneau.
    expect(within(panneau).getByRole('group', { name: 'Langue' })).toBeInTheDocument()
    expect(within(panneau).getByRole('group', { name: 'Thème' })).toBeInTheDocument()
    expect(within(panneau).getByRole('button', { name: /^Devise/ })).toBeInTheDocument()

    // Et rien qui navigue : ni les liens de section, ni les deux boutons
    // d'inscription, que la barre porte tous les six à cette largeur.
    expect(within(panneau).queryAllByRole('link')).toEqual([])
  })

  /*
    UNE LISTE DÉROULANTE N'EST PAS UNE MODALE, et le panneau devient l'une ou
    l'autre selon la largeur. Neutraliser toute la page pour trois boutons
    retirerait le corps du document au lecteur d'écran le temps de changer de
    langue — et figerait le défilement d'une page qu'on n'a même pas recouverte.
  */
  it('laisse la page vivante : ni fond neutralisé, ni défilement figé', async () => {
    AU_DELA(GRAND_ECRAN)
    await renderApp('/')

    await ouvrirLesReglages()

    expect(screen.getByRole('main')).not.toHaveAttribute('inert')
    expect(screen.getByRole('contentinfo')).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  /*
    Le clic dehors REFERME, et il ne rapatrie pas le focus — c'est délibéré, et
    c'est ce qui distingue les deux sorties. À Échap, le focus est dans le
    panneau et doit revenir au déclencheur, sinon il retombe au début du
    document ; au clic dehors, l'utilisateur désigne où il va, et le lui
    reprendre ferait d'un panneau une souricière à la souris. Le cas ne
    l'affirme donc pas : `menuMobile.test.tsx` tient le retour à Échap.
  */
  it('se referme au clic dehors', async () => {
    AU_DELA(GRAND_ECRAN)
    await renderApp('/')

    const { user } = await ouvrirLesReglages()
    await user.click(screen.getByRole('main'))

    expect(screen.queryByTestId('menu-mobile')).not.toBeInTheDocument()
  })

  it('rend le focus au déclencheur quand on sort par Échap', async () => {
    AU_DELA(GRAND_ECRAN)
    await renderApp('/')

    const { user, declencheur } = await ouvrirLesReglages()
    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('menu-mobile')).not.toBeInTheDocument()
    expect(declencheur).toHaveFocus()
  })

  /*
    Le clic sur le déclencheur lui-même passe par la MÊME écoute de capture que
    le clic dehors. Sans son exclusion, l'appui refermerait le panneau et le
    `onClick` le rouvrirait dans la foulée : un bouton de fermeture qui ne
    ferme jamais. Le défaut ne se voit qu'à l'aller-retour, d'où les deux clics.
  */
  it('se referme au second clic sur son propre déclencheur', async () => {
    AU_DELA(GRAND_ECRAN)
    await renderApp('/')

    const { user } = await ouvrirLesReglages()
    await user.click(screen.getByRole('button', { name: 'Fermer les réglages' }))

    expect(screen.queryByTestId('menu-mobile')).not.toBeInTheDocument()
  })
})

describe('panneau de la vitrine entre sm et lg', () => {
  /*
    LE SEUIL DES BOUTONS N'EST PAS CELUI DES LIENS, et le panneau lit les deux
    séparément. Entre `sm` et `lg` la barre montre « Se connecter » et « Essayer
    gratuitement » mais pas encore les liens de section : le panneau doit donc
    porter les liens et NON les boutons. Un seuil unique aurait rendu les deux,
    ou aucun — dans les deux cas faux à cette largeur, et sur la plus courante
    des tablettes.
  */
  it('porte les liens de section, mais pas les boutons que la barre montre', async () => {
    AU_DELA(TABLETTE)
    await renderApp('/')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }))
    const panneau = screen.getByTestId('menu-mobile')

    expect(within(panneau).getByRole('link', { name: 'Tarifs' })).toBeInTheDocument()
    expect(within(panneau).queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument()
    expect(
      within(panneau).queryByRole('link', { name: 'Essayer gratuitement' }),
    ).not.toBeInTheDocument()
  })

  /*
    En deçà de `lg` le panneau reste une feuille pleine page, donc une modale —
    et il en garde tous les devoirs. C'est `menuMobile.test.tsx` qui les tient
    en entier ; ici on vérifie seulement que la bascule ne les a pas emportés
    avec elle en chemin.
  */
  it('reste une modale : le fond est neutralisé', async () => {
    AU_DELA(TABLETTE)
    await renderApp('/')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }))

    expect(screen.getByRole('main')).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')
  })
})
