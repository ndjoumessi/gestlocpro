import { describe, expect, it } from 'vitest'
import { renderApp, screen, within } from '@/test/render'

/**
 * LE SOMMAIRE DES DEUX PAGES LONGUES, ET LA SEULE CHOSE QUI PUISSE LE CASSER.
 *
 * ═══ CE QU'IL RÉPARE ═══
 *
 * Les treize rubriques des conditions générales et les neuf de la
 * confidentialité portaient chacune un `id` — posé pour `aria-labelledby` —
 * donc une destination utilisable depuis toujours. Rien sur la page ne les
 * listait ni n'y menait : `/conditions-generales` fait 4 679 px à 360 px de
 * large, et quelqu'un qui cherche le délai d'effacement de son compte
 * parcourait treize écrans.
 *
 * ═══ LE RISQUE QUE LE SOMMAIRE APPORTE ═══
 *
 * Un sommaire est une SECONDE liste des rubriques. Le corps de chaque rubrique
 * est du JSX — des liens en pleine phrase, un délai interpolé —, donc la page
 * ne peut pas se rendre entièrement depuis une table ; les deux listes vivent
 * côte à côte, et rien dans le langage ne les oblige à coïncider.
 *
 * Une rubrique ajoutée sans son entrée devient invisible au sommaire ; une
 * entrée dont l'ancre se démode devient un lien qui ne mène nulle part — la
 * pire des deux, parce qu'elle se voit seulement au clic, sur une page
 * juridique qu'on consulte rarement.
 *
 * Ces cas comparent donc les DEUX listes du document rendu : chaque entrée
 * pointe vers un titre qui existe, chaque titre est pointé par une entrée, et
 * l'ordre est le même — un sommaire qui ne suit pas le texte fait chercher.
 */

/** Les ancres du sommaire, dans leur ordre d'affichage. */
function ancresDuSommaire(): string[] {
  const sommaire = within(screen.getByRole('main')).getByRole('navigation', {
    name: /sommaire|contents/i,
  })
  return within(sommaire)
    .getAllByRole('link')
    .map((lien) => lien.getAttribute('href') ?? '')
    .map((href) => href.replace(/^#/, ''))
}

/** Les identifiants des titres de rubrique, dans l'ordre du document. */
function ancresDesRubriques(prefixe: string): string[] {
  return within(screen.getByRole('main'))
    .getAllByRole('heading', { level: 2 })
    .map((titre) => titre.id)
    .filter((id) => id.startsWith(`${prefixe}-`))
}

describe.each([
  ['les conditions générales', '/conditions-generales', 'conditions', 13],
  ['la confidentialité', '/confidentialite', 'confidentialite', 9],
])('le sommaire de %s', (_nom, adresse, prefixe, attendues) => {
  it('liste toutes les rubriques, dans l’ordre du texte', async () => {
    await renderApp(adresse)

    const rubriques = ancresDesRubriques(prefixe)
    expect(rubriques.length, 'le nombre de rubriques a changé sans le sommaire').toBe(attendues)

    /* L'ÉGALITÉ, ET NON UNE INCLUSION : une entrée en trop est un lien mort,
       une rubrique en trop est une clause qu'on ne trouve pas. Les deux
       défauts sont attrapés par la même comparaison, ordre compris. */
    expect(ancresDuSommaire()).toEqual(rubriques)
  })

  it('mène à un titre qui existe vraiment dans la page', async () => {
    await renderApp(adresse)

    /* LE LIEN EST VÉRIFIÉ CONTRE LE DOCUMENT, et non contre la table qui l'a
       produit : c'est la seule façon de voir qu'une ancre a été renommée d'un
       seul côté. `getElementById` est ce que fait le navigateur au clic. */
    for (const ancre of ancresDuSommaire()) {
      expect(document.getElementById(ancre), `« ${ancre} » ne mène nulle part`).not.toBeNull()
    }
  })

  it('n’est pas rendu par le titre de la page', async () => {
    /* LE SOMMAIRE EST UNE NAVIGATION NOMMÉE, pas une liste anonyme : un lecteur
       d'écran qui parcourt les repères doit la trouver sous son nom, et ne pas
       la confondre avec la navigation de l'en-tête. */
    await renderApp(adresse)

    const sommaire = within(screen.getByRole('main')).getByRole('navigation', {
      name: /sommaire|contents/i,
    })
    expect(within(sommaire).getAllByRole('listitem').length).toBe(attendues)
  })
})
