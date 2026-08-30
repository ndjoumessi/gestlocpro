import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent, within } from '@/test/render'
import { CURRENCIES, CURRENCY_DEFS } from '@/currency/currencies'
import { CurrencySwitcher } from './CurrencySwitcher'
import { ParkSettingsModal } from '@/features/dashboard/ParkSettingsModal'

/**
 * UNE DEVISE SE NOMME. ELLE NE SE DÉSIGNE PAS PAR SON CODE.
 *
 * ═══ CE QUE LE MENU DE L'EN-TÊTE DISAIT ═══
 *
 * Quatre lignes, chacune portant un libellé à gauche et le code ISO à droite.
 * Deux des quatre écrivaient LA MÊME CHOSE DES DEUX CÔTÉS :
 *
 *   Dollar canadien ($)          CAD        ← ce qu'on lit aujourd'hui
 *   CAD ($)                      CAD        ← ce qu'on lisait
 *   USD ($)                      USD
 *
 * La colonne de droite existe justement pour porter le code ; le libellé qui le
 * répète ne dit rien, et laisse le lecteur départager « CAD ($) » de
 * « USD ($) » par trois lettres qu'il faut déjà connaître. Le symbole, lui, est
 * le même pour les deux — c'est écrit dans l'en-tête du composant : « le seul
 * symbole confondrait le dollar canadien et l'américain ». Le menu a donc été
 * construit contre ce défaut, puis l'a laissé revenir par le libellé.
 *
 * ═══ ET IL NE SE TRADUISAIT PAS ═══
 *
 * Les libellés vivaient en dur dans `currencies.ts`, hors du dictionnaire :
 * `t()` ne les voyait pas, `check-i18n` non plus — il contrôle le JSX, pas un
 * module de données. Un bailleur anglophone lisait donc la même liste que le
 * francophone, ce qui ne se remarquait pas tant qu'aucun libellé n'était un mot.
 * Les nommer et les traduire est le même geste ; ne faire que le premier aurait
 * posé « Dollar canadien » au milieu d'un écran anglais.
 *
 * ═══ ET IL PARLAIT UNE AUTRE LANGUE QUE LA MODALE DU PARC ═══
 *
 * La modale de correction, à un clic de là, nommait déjà les cinq devises du
 * STOCKAGE en toutes lettres et dans les deux langues. Deux listes, la même
 * notion, deux vocabulaires — dont le plus pauvre était celui qu'on voit le
 * plus souvent. Le troisième cas ci-dessous les tient ensemble : il compare ce
 * que les DEUX écrans affichent, et non deux clés du dictionnaire l'une contre
 * l'autre, qui se suivraient sans rien prouver.
 */

/** Ouvre le menu de l'en-tête et rend ses options, dans l'ordre. */
async function optionsDuMenu(): Promise<HTMLElement[]> {
  await userEvent.setup().click(await screen.findByRole('button', { expanded: false }))
  return screen.getAllByRole('option')
}

/**
 * Le libellé DÉBARRASSÉ de son symbole entre parenthèses.
 *
 * « Dollar canadien ($) » → « Dollar canadien ». C'est ce qui reste qui doit
 * nommer : le symbole est une aide, pas un nom, et il est partagé par les deux
 * dollars. Sans ce retrait, « CAD ($) » passerait pour différent de « CAD ».
 */
function nomSeul(libelle: string): string {
  return libelle.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

describe('le vocabulaire des devises', () => {
  it('nomme chaque devise au lieu de répéter son code', async () => {
    renderWithProviders(<CurrencySwitcher />)
    const options = await optionsDuMenu()

    /* GARDE DE LA GARDE : un menu vide ferait passer la boucle sans rien lire. */
    expect(options).toHaveLength(CURRENCIES.length)

    const bavards = options
      .map((option) => {
        const code = CURRENCIES.find((c) => option.textContent?.includes(c))
        return { texte: option.textContent ?? '', code }
      })
      .filter(({ texte, code }) => {
        if (!code) return true
        // Le code apparaît une fois, à droite : on ne juge que ce qui reste.
        const nom = nomSeul(texte.replace(new RegExp(`${code}\\s*$`), ''))
        return nom.toUpperCase() === code
      })
      .map(({ texte }) => texte)

    expect(
      bavards,
      'ces lignes écrivent le code ISO des deux côtés et ne nomment rien',
    ).toEqual([])
  })

  it('change de langue avec le reste de l’écran', async () => {
    renderWithProviders(<CurrencySwitcher />, { locale: 'en' })
    const anglais = (await optionsDuMenu()).map((o) => o.textContent ?? '')

    /**
     * Le dollar canadien, et non l'euro : « Euro » s'écrit pareil dans les deux
     * langues, et l'y chercher rendrait ce cas vert quoi qu'il arrive. On
     * interroge donc une devise dont le nom DIFFÈRE réellement — sinon la garde
     * ne mesurerait que l'orthographe d'un mot latin.
     */
    const cad = anglais.find((texte) => texte.includes('CAD'))
    expect(cad, 'le dollar canadien manque à la liste anglaise').toBeDefined()
    expect(nomSeul(cad!.replace(/CAD\s*$/, ''))).not.toBe(
      nomSeul(CURRENCY_DEFS.CAD.label),
    )
  })

  it('est celui de la modale du parc, pas un second', async () => {
    /*
      LES DEUX ÉCRANS SONT MONTÉS, et c'est le seul moyen de le prouver.

      Comparer `common.currencyNames.CAD` à lui-même passerait vert sans que
      l'un des deux écrans le lise. Ce qui doit coïncider, c'est ce que
      l'utilisateur LIT à un clic d'écart.
    */
    renderWithProviders(
      <>
        <CurrencySwitcher />
        <ParkSettingsModal open onClose={() => {}} />
      </>,
    )

    const modale = await screen.findByRole('dialog')
    const champ = within(modale).getByLabelText(/Devise/)
    const dansLaModale = new Map(
      within(champ)
        .getAllByRole('option')
        .map((o) => [o.getAttribute('value') ?? '', (o.textContent ?? '').trim()]),
    )

    const options = await optionsDuMenu()
    const dansLEnTete = new Map(
      options.map((o) => {
        const code = CURRENCIES.find((c) => o.textContent?.includes(c)) ?? ''
        return [code, nomSeul((o.textContent ?? '').replace(new RegExp(`${code}\\s*$`), ''))]
      }),
    )

    /* Les trois que les deux listes ont en commun. Les deux francs n'y sont
       pas : l'en-tête n'en connaît qu'un — même parité, même sigle à l'écran —
       là où le parc doit trancher entre CEMAC et UEMOA pour le stockage. */
    for (const code of ['EUR', 'CAD', 'USD'] as const) {
      expect(dansLaModale.get(code), `${code} manque à la modale`).toBeDefined()
      expect(nomSeul(dansLaModale.get(code)!), `${code} porte deux noms`).toBe(
        dansLEnTete.get(code),
      )
    }
  })
})
