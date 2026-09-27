import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LE MENU D'UNE FICHE A UNE HIÉRARCHIE.
 *
 * ═══ CE QU'IL RENDAIT, ET LA PART QUI VENAIT DE MOI ═══
 *
 * Quatre entrées à plat, de trois natures — modifier, ranger, détruire —, au
 * même poids visuel. Deux défauts distincts s'y ajoutaient :
 *
 * 1. DEUX RANGÉES POUR UN SEUL AXE. « Déplacer à gauche » et « Déplacer à
 *    droite » sont un contrôle, pas deux décisions. Elles doublaient la hauteur
 *    du menu et se lisaient comme deux choix étrangers. C'est le lot précédent
 *    qui les avait posées ainsi.
 *
 * 2. LE BLOC LE PLUS LOURD ÉTAIT CELUI QU'ON NE PEUT PAS CLIQUER. La raison du
 *    refus de « Retirer » tenait treize mots sur trois lignes : l'entrée
 *    DÉSACTIVÉE dominait les entrées actives, ce qui est à l'envers.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * Un libellé « Déplacer » et DEUX cibles — l'axe se lit comme un axe, et les
 * deux cibles restent deux alternatives à un seul pointeur, ce qu'exige
 * WCAG 2.5.7. Un séparateur avant la destruction. Et la raison TOUJOURS
 * PRÉSENTE : elle est une décision écrite du dépôt — « “Retirer” en gris, sans
 * un mot, se clique deux fois avant qu'on renonce » — ce lot la raccourcit, il
 * ne la supprime pas. Le dernier cas existe pour empêcher qu'un futur
 * allègement la fasse disparaître au nom de la concision.
 *
 * ═══ CE QUE CES CAS NE VOIENT PAS ═══
 *
 * Que les deux cibles fléchées font bien 44 px, et combien de lignes la raison
 * occupe : jsdom ne fait aucune mise en page. Aucune porte au navigateur n'ouvre
 * ce menu — `mesure-ui` mesure des écrans, pas des panneaux ouverts. Les deux
 * ont été relevés à la main, et c'est tout ce qu'on peut en dire.
 */
/**
 * L'entrée de retrait, par son LIBELLÉ VISIBLE et non par son nom accessible.
 *
 * A1 porte des paiements, donc le geste est fermé et son nom accessible devient
 * « Retrait impossible — A1 a une histoire dans le parc » : chercher /Retirer/
 * dans le NOM n'aboutit pas, et c'est ce qui a fait rougir ce cas pour une
 * mauvaise raison. Le libellé visible, lui, reste « Retirer » dans les deux
 * états — c'est la décision du dépôt : l'entrée fermée RESTE, elle ne se renomme
 * pas.
 */
function entreeDeRetrait(menu: HTMLElement): HTMLElement {
  const trouvee = within(menu)
    .getAllByRole('menuitem')
    .find((item) => /Retirer/.test(item.textContent ?? ''))
  expect(trouvee, 'aucune entrée de retrait dans le menu').toBeDefined()
  return trouvee as HTMLElement
}

async function ouvrirLeMenuDeA1() {
  const user = userEvent.setup()
  installerFauxServeur()
  await renderApp('/demo/parc')
  await attendreLeChargement()
  await user.click(screen.getByRole('button', { name: 'Actions du logement A1' }))
  return await screen.findByRole('menu', { name: 'Actions du logement A1' })
}

describe('le menu d’une fiche de logement', () => {
  it('ne dit « Déplacer » qu’une fois, pour deux cibles', async () => {
    const menu = await ouvrirLeMenuDeA1()

    const libelles = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.trim() ?? '')
    const rangeesDeDeplacement = libelles.filter((texte) => /^Déplacer/.test(texte))
    expect(
      rangeesDeDeplacement,
      `l’axe occupe ${rangeesDeDeplacement.length} rangées de libellé : « ${rangeesDeDeplacement.join(' | ')} »`,
    ).toHaveLength(0)

    expect(within(menu).getByText('Déplacer'), 'l’axe n’est plus nommé').toBeInTheDocument()
    expect(
      within(menu).getByRole('menuitem', { name: /gauche/ }),
      'la cible « gauche » a disparu : l’alternative à un seul pointeur avec elle',
    ).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /droite/ })).toBeInTheDocument()
  })

  it('sépare la destruction du reste', async () => {
    const menu = await ouvrirLeMenuDeA1()

    const trait = within(menu).getByRole('separator')
    const retirer = entreeDeRetrait(menu)
    /* AVANT et non APRÈS : un trait posé sous la dernière entrée ne sépare rien.
       `compareDocumentPosition` le dit sans dépendre d'une mise en page. */
    expect(
      trait.compareDocumentPosition(retirer) & Node.DOCUMENT_POSITION_FOLLOWING,
      'le séparateur ne précède pas la destruction',
    ).toBeTruthy()
  })

  it('garde la raison du refus, raccourcie mais lisible', async () => {
    const menu = await ouvrirLeMenuDeA1()
    const retirer = entreeDeRetrait(menu)

    expect(
      retirer.textContent,
      'la raison a disparu : « Retirer » en gris sans un mot se clique deux fois',
    ).toMatch(/paiement|bail/i)
    /* HUIT MOTS AU PLUS, mesuré en mots faute de pouvoir mesurer des pixels ici.
       LA BORNE N'EST PAS « UNE LIGNE », et j'avais annoncé une ligne : relevé au
       navigateur après le correctif, la phrase de huit mots tient sur DEUX lignes
       dans les 228 px disponibles (43 px de haut). La faire tenir sur une seule
       demanderait « Paiements ou bail rattachés. » — vingt-sept caractères, du
       télégraphe. On garde une phrase française et on inscrit la vraie mesure :
       de treize mots et trois lignes, on passe à huit et deux, et l'entrée
       désactivée cesse d'être le bloc le plus lourd du menu (81 px contre 44
       pour une entrée pleine, au lieu du double). */
    const mots = (retirer.textContent ?? '').replace(/^Retirer/, '').trim().split(/\s+/)
    expect(mots.length, `la raison fait ${mots.length} mots : « ${mots.join(' ')} »`).toBeLessThanOrEqual(8)
  })
})
