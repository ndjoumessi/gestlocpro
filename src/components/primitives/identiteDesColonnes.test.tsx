import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { Hero } from '@/features/marketing/Hero'
import { StackedBarChart } from './Charts'

/**
 * UNE COLONNE EST UN MOIS, PAS UN MOT — ET UN MOT SE TRADUIT.
 *
 * Les deux graphes à colonnes portaient `key={bar.label}`, c'est-à-dire
 * l'identité React d'un nœud sur une CHAÎNE LOCALISÉE. Changer de langue ne
 * change aucune donnée, mais « Oct » devient « oct » : React démonte les douze
 * colonnes, en monte douze neuves, et `animate-grow-y` — décalé de 35 ms par
 * colonne — rejoue la cascade entière.
 *
 * MESURÉ dans Chromium sur le paquet servi, `/demo` à 1440 px, bascule EN → FR :
 * des 24 colonnes marquées avant le clic (douze au tracé principal, douze au
 * secondaire), ZÉRO survit ; les 24 animations repartent, `currentTime` à 17 ms,
 * délais relevés à 0 / 0,035 / 0,07 s. Soit 385 ms d'échelonnement plus 300 de
 * croissance — près de sept dixièmes de seconde de mouvement pour un changement
 * qui ne touche que des étiquettes.
 *
 * ═══ CE QUE CE FICHIER PEUT TENIR, ET CE QU'IL NE PEUT PAS ═══
 *
 * jsdom ne joue aucune animation : il ne dira jamais « la cascade a rejoué ».
 * Ce qu'il tient — et qui est la CAUSE, pas le symptôme — c'est l'IDENTITÉ DES
 * NŒUDS. Si les mêmes objets DOM traversent le changement de langue, React n'a
 * rien remonté, et rien ne peut rejouer. C'est l'implication qui porte la garde ;
 * la mesure ci-dessus en est le versant visible, pris une fois, au navigateur.
 *
 * Trois cas, et il faut les trois : le premier tient la PRIMITIVE, les deux
 * autres tiennent les APPELANTS. Une primitive qui honore `key` ne sert à rien si
 * l'écran ne lui en donne pas — et c'est exactement l'état d'où l'on part. Les
 * deux appelants sont là parce qu'ils sont DEUX GRAPHES DIFFÉRENTS : la vitrine
 * dessine un `MiniBarChart`, le tableau de bord un `StackedBarChart`, et chacun
 * avait sa propre omission. Couvrir l'un sans l'autre aurait laissé découverte
 * la surface même où le défaut a été mesuré.
 */

/** Douze mois d'une série, libellés dans une langue donnée. */
function barres(libelles: string[]) {
  return libelles.map((label, i) => ({
    key: `2026-${i + 1}`,
    label,
    segments: [{ key: 'rent', value: 1000 + i }],
  }))
}

const ETIQUETTES = { rent: 'Loyer' }

/** Les nœuds qui portent la croissance, dans l'ordre du document. */
function colonnes(racine: HTMLElement) {
  return Array.from(racine.querySelectorAll<HTMLElement>('.animate-grow-y'))
}

/**
 * Ce que les colonnes ANNONCENT, pour prouver que la traduction a bien eu lieu.
 *
 * Le nom accessible de la colonne, et non la rangée d'étiquettes sous l'axe :
 * celle-ci n'existe que sur le graphe empilé, et le hero dessine un
 * `MiniBarChart`. Une sonde qui ne la trouve pas rend un tableau VIDE, que
 * `not.toEqual([])` juge égal à lui-même — la vacuité déguisée en constat.
 * Écrite ainsi, elle a d'abord fait rougir ce fichier ; c'est ce qu'on attend
 * d'elle.
 */
function libelles(racine: HTMLElement) {
  return Array.from(racine.querySelectorAll('button[data-cible="donnee"]')).map((n) =>
    n.getAttribute('aria-label'),
  )
}

/*
  LE CHANGEMENT DE LIBELLÉ EST PROVOQUÉ DEPUIS L'INTÉRIEUR DE L'ARBRE.

  Le `rerender` de Testing Library remplace la RACINE rendue — c'est-à-dire, ici,
  les fournisseurs que `renderWithProviders` a posés autour. Le graphe se
  retrouvait sans `CurrencyProvider` et levait avant toute mesure. Un état local,
  basculé par un bouton, reproduit exactement ce que fait `I18nProvider` à ses
  descendants : un nouveau rendu, mêmes clés, libellés neufs.
*/
function GrapheQuiSeTraduit() {
  const [traduit, setTraduit] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setTraduit(true)}>
        traduire
      </button>
      <StackedBarChart
        caption="Encaissements"
        seriesLabels={ETIQUETTES}
        bars={barres(traduit ? ['janv.', 'févr.', 'mars'] : ['Jan', 'Feb', 'Mar'])}
      />
    </>
  )
}

describe('identité des colonnes', () => {
  it('garde ses nœuds quand seuls les libellés changent', () => {
    const { container } = renderWithProviders(<GrapheQuiSeTraduit />)

    const avant = colonnes(container)
    const motsAvant = libelles(container)
    expect(avant.length, 'la sonde doit trouver des colonnes à surveiller').toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'traduire' }))

    // SANS CE CONSTAT, LE CAS EST VRAI À VIDE : des libellés inchangés rendent
    // l'identité triviale, et la garde passerait au vert en ne mesurant rien.
    expect(libelles(container), 'les libellés doivent avoir changé').not.toEqual(motsAvant)

    const apres = colonnes(container)
    expect(apres, 'autant de colonnes qu’avant').toHaveLength(avant.length)
    apres.forEach((noeud, i) => {
      expect(noeud, `la colonne ${i} doit être LE MÊME nœud qu’avant la traduction`).toBe(avant[i])
    })
  })

  it('garde ses nœuds quand la vitrine change de langue', async () => {
    const { container } = renderWithProviders(
      <>
        <LanguageSwitcher />
        <Hero />
      </>,
      { locale: 'fr' },
    )

    const avant = colonnes(container)
    const motsAvant = libelles(container)
    expect(avant.length, 'le hero doit dessiner ses colonnes').toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /English/ }))

    /*
      ATTENDRE LA TRADUCTION, ET NON LE CLIC. Le dictionnaire anglais est chargé
      à la demande : au retour du clic, les libellés sont encore français. Le
      harnais lui-même attend cette arrivée quand on lui demande `locale: 'en'`
      au montage (`attendreLaLangue`) ; ici la bascule se fait en cours de vie,
      et il faut l'attendre à la main.

      Même précaution de vacuité qu'au cas précédent, et elle a servi deux fois :
      sans elle, la garde était verte AVANT le correctif — d'abord parce que le
      clic ne traduisait rien, puis parce que la sonde de libellés ne trouvait
      rien à lire sur un `MiniBarChart`.
    */
    await waitFor(() =>
      expect(libelles(container), 'les libellés doivent avoir changé').not.toEqual(motsAvant),
    )

    const apres = colonnes(container)
    expect(apres, 'autant de colonnes qu’avant').toHaveLength(avant.length)
    apres.forEach((noeud, i) => {
      expect(noeud, `la colonne ${i} du hero doit survivre au changement de langue`).toBe(avant[i])
    })
  })
  it('garde ses nœuds quand le tableau de bord change de langue', async () => {
    const { container } = renderWithProviders(
      <>
        <LanguageSwitcher />
        <Dashboard />
      </>,
      { locale: 'fr' },
    )

    /*
      ATTENDRE LES COLONNES, ET NON LE RENDU. Le parc arrive par `usePortfolio` :
      au premier passage l'écran est en attente et ne dessine aucune barre. Sans
      cette attente, `avant` serait vide — et la comparaison d'identité qui suit,
      vraie à vide.
    */
    await waitFor(() => expect(colonnes(container).length).toBeGreaterThan(0))

    const avant = colonnes(container)
    const motsAvant = libelles(container)

    fireEvent.click(screen.getByRole('button', { name: /English/ }))

    await waitFor(() =>
      expect(libelles(container), 'les libellés doivent avoir changé').not.toEqual(motsAvant),
    )

    const apres = colonnes(container)
    expect(apres, 'autant de colonnes qu’avant').toHaveLength(avant.length)
    apres.forEach((noeud, i) => {
      expect(
        noeud,
        `la colonne ${i} du tableau de bord doit survivre au changement de langue`,
      ).toBe(avant[i])
    })
  })
})
