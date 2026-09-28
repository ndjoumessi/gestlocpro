import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'

/**
 * LE TABLEAU DE BORD MÈNE OÙ IL POINTE.
 *
 * ═══ TROIS TUILES, TROIS IMMEUBLES, UNE SEULE DESTINATION ═══
 *
 * « Impayé par immeuble » range les immeubles du plus impayé au moins impayé,
 * chacun dans sa tuile bordée, avec son quartier et son montant — puis les
 * envoie TOUS à `/parc`. Cliquer « Villa Deïdo » ouvre le parc entier, à
 * charge pour le lecteur de retrouver la ligne qu'il venait de désigner.
 *
 * Le repère existait déjà : l'écran du parc donne à chaque immeuble un
 * `id="immeuble-<identifiant>"`, posé sur son titre pour que sa section s'en
 * nomme. Rien n'y menait.
 *
 * ═══ ET LA PART REFACTURÉE NE DISAIT PAS DE QUOI ═══
 *
 * « Charges refacturées · Eau 80 % · Électricité 80 % » : deux barres, même
 * valeur, aucun dénominateur. `waterRebilled` est la « part des UNITÉS dont le
 * relevé d'eau est saisi » — un lecteur ne peut pas deviner s'il s'agit de 80 %
 * d'un montant ou de 80 % des logements, et les deux appellent des gestes
 * différents : relancer une tournée, ou vérifier un tarif.
 */

async function ouvrirLeTableauDeBord() {
  await renderApp('/demo')
  await attendreLeChargement()
}

/** La section « Impayé par immeuble ». */
function parImmeuble(): HTMLElement {
  const titre = screen.getByRole('heading', { name: /impayé par immeuble/i })
  const boite = titre.closest<HTMLElement>('[data-carte]')
  if (!boite) throw new Error('aucune carte « Impayé par immeuble »')
  return boite
}

describe('les tuiles d’immeuble du tableau de bord', () => {
  it('mènent chacune à SON immeuble', async () => {
    await ouvrirLeTableauDeBord()
    const liens = within(parImmeuble()).getAllByRole('link')

    expect(liens.length, 'la démonstration porte plusieurs immeubles').toBeGreaterThan(1)
    const destinations = liens.map((l) => l.getAttribute('href') ?? '')
    /*
      DES DESTINATIONS DISTINCTES, et c'est tout le sujet. Un compte de liens ou
      la présence d'un `/parc` passerait sur le code fautif : les trois y
      pointaient bien quelque part, au même endroit.
    */
    expect(
      new Set(destinations).size,
      `les ${liens.length} tuiles mènent au même endroit — ${destinations.join(' | ')} : désigner un immeuble ouvre le parc entier`,
    ).toBe(liens.length)
    for (const href of destinations) {
      expect(href, 'une tuile ne porte pas le repère de son immeuble').toMatch(/#immeuble-/)
    }
  })
})

describe('le repère d’immeuble, à l’arrivée', () => {
  it('pose le focus sur l’immeuble désigné', async () => {
    /*
      LE FOCUS PLUTÔT QU'UN DÉFILEMENT, et c'est le meilleur des deux.

      Ce dépôt a déjà écrit que `<Link to="#id">` NE FAIT DÉFILER NULLE PART :
      `history.pushState` ne déclenche jamais l'ancrage natif. Son remède pour
      une ancre de MÊME page est un `<a href>` ordinaire ; il ne vaut pas ici,
      où le saut traverse deux écrans et rechargerait l'application.

      Donner le focus au titre résout les deux d'un coup : le navigateur amène
      l'élément à l'écran, et qui n'y voit pas apprend OÙ il vient d'arriver —
      ce qu'un défilement muet ne dit à personne.
    */
    const { BUILDINGS } = await import('@/data/portfolio')
    const immeuble = BUILDINGS[0]
    expect(immeuble, 'le jeu de démonstration porte au moins un immeuble').toBeDefined()

    await renderApp(`/demo/parc#immeuble-${immeuble!.id}`)
    await attendreLeChargement()

    const titre = document.getElementById(`immeuble-${immeuble!.id}`)
    expect(titre, 'le repère n’existe pas sur l’écran du parc').not.toBeNull()
    expect(
      document.activeElement,
      'on arrive sur le parc entier, sans rien pour dire quel immeuble on avait désigné',
    ).toBe(titre)
  })
})

describe('la part refacturée', () => {
  it('dit de quoi elle est la part', async () => {
    await ouvrirLeTableauDeBord()
    const eau = screen.getByText(/charges refacturées/i).closest<HTMLElement>('div')
    expect(eau, 'aucun bloc de charges refacturées').not.toBeNull()
    const bloc = eau!.parentElement ?? eau!

    /*
      LE DÉNOMINATEUR, ET NON LE POURCENTAGE. « 80 % » est déjà là ; ce qui
      manque est ce qu'il divise. On cherche donc un rapport écrit — « 8 sur
      10 » —, la forme que cet écran emploie déjà sous « Total refacturé ».
    */
    expect(
      bloc.textContent ?? '',
      'les deux barres annoncent 80 % sans dire de quoi : 80 % d’un montant et 80 % des logements n’appellent pas le même geste',
    ).toMatch(/\d+\s*(sur|\/)\s*\d+/)
  })
})
