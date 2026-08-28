import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * UN COURS CONNU NE S'OUBLIE PAS PARCE QUE L'API A CLIGNÉ DES YEUX.
 *
 * ═══ LE DÉFAUT, VU EN CAPTURE ═══
 *
 * « Cours indisponibles · montants en FCFA » sur le dollar canadien et sur le
 * dollar américain, alors que le produit avait servi ces mêmes cours quelques
 * minutes plus tôt. Le client ne retenait RIEN : chaque rechargement repartait
 * sans cours, et la moindre interruption — API redémarrée, réseau qui bronche,
 * service déployé — faisait retomber les deux dollars dans la monnaie du parc.
 *
 * Le franc et l'euro ne bronchaient pas : leur parité est une constante que le
 * client tient (voir `pariteSansServeur`). Le défaut ne frappait donc QUE les
 * monnaies qui flottent, celles pour lesquelles il n'y a pas de repli.
 *
 * ═══ POURQUOI SE SERVIR D'UN COURS D'HIER N'EST PAS MENTIR ═══
 *
 * Parce que l'écran DIT de quand il date : « Convertis au taux du 28/08/2026 ».
 * C'est la règle que le serveur pose déjà — « la réponse porte toujours sa
 * DATE » — et elle vaut des deux côtés. Ce qui serait un mensonge est de servir
 * un cours ancien en le faisant passer pour celui du jour ; ce qui est une
 * perte sèche est de n'en servir aucun quand on en a un de la veille.
 *
 * ═══ MAIS PAS ÉTERNELLEMENT ═══
 *
 * Un cours d'il y a trois semaines sur un relevé de loyer est faux, date ou
 * pas : personne ne lit la mention avant le montant. Au-delà de l'âge maximal,
 * le cours retenu est écarté et l'on retombe sur l'aveu — qui est une
 * information juste, quand la conversion ne l'est plus.
 */

/**
 * UN JOUR RELATIF, ET NON UNE DATE ÉCRITE.
 *
 * La règle mesurée est un ÂGE : « ce cours a-t-il moins de sept jours ? ». Une
 * date en dur y répond juste aujourd'hui et faux la semaine prochaine — le cas
 * rougirait alors sans qu'une ligne ait bougé, et l'on chercherait le défaut
 * dans le produit. C'est l'inverse exact de la raison pour laquelle les COURS,
 * eux, sont figés dans le faux serveur : là c'est la valeur qui doit être
 * stable, ici c'est l'écart au jour courant.
 */
const ilYA = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10)

/** La même date, telle que l'écran la compose : « 28/08/2026 ». */
function commeAffichee(iso: string): string {
  const [a, m, j] = iso.split('-')
  return `${j}/${m}/${a}`
}

/** Ce qu'une session précédente aurait laissé en mémoire. */
function coursEnMemoire(date: string) {
  window.localStorage.setItem(
    'gestlocpro.rates',
    JSON.stringify({ date, parEuro: { XAF: 655.957, XOF: 655.957, EUR: 1, CAD: 1.6, USD: 1.2 } }),
  )
}

/** Le bloc des réglages, où l'écran dit sur quoi il convertit. */
const panneau = () => document.querySelector<HTMLElement>('[data-reglages]')!

/** Ouvre les réglages — le seul endroit où la mention de conversion se lit. */
async function ouvrirLesReglages() {
  const { default: userEvent } = await import('@testing-library/user-event')
  await userEvent.setup().click(document.querySelector<HTMLElement>('[data-declencheur-reglages]')!)
}

describe('les cours retenus', () => {
  /** LE CAS DU DÉFAUT : l'API est muette, mais on connaissait le cours. */
  it('convertissent encore quand l’API ne répond plus', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', '/rates', { status: 503, body: { error: 'indisponible' } })
    coursEnMemoire(ilYA(1))

    await renderApp('/demo', { currency: 'CAD' })
    await attendreLeChargement()

    /* 447 000 francs valent 1 090,32 $CA au cours FIGÉ du faux serveur — 1,6
       pour un euro, et non le cours du jour, qui rendrait ce cas faux demain.
       Le NOMBRE, pas seulement le symbole : un repli sur le parc afficherait
       447 000. */
    const principal = screen.getByRole('main').textContent?.replace(/[\s ]/g, ' ') ?? ''
    expect(principal, 'le cours connu a été oublié').toMatch(/1 090,32/)
    expect(principal, 'les francs sont restés sous un autre symbole').not.toMatch(/447 000/)
  })

  it('disent de quand date ce qu’ils servent', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', '/rates', { status: 503, body: { error: 'indisponible' } })
    const hier = ilYA(1)
    coursEnMemoire(hier)

    await renderApp('/demo', { currency: 'CAD' })
    await attendreLeChargement()
    await ouvrirLesReglages()

    /* LA DATE EST CE QUI REND LE PROCÉDÉ HONNÊTE. Sans elle, un cours de la
       veille se ferait passer pour celui du jour, et c'est le seul mensonge
       que cette fonctionnalité pouvait introduire. */
    /* Une expression et non la chaîne nue : `getByText` compare le texte
       ENTIER d'un élément, et la date vit dans « Convertis au taux du … ». */
    const attendue = new RegExp(commeAffichee(hier).replace(/\//g, '\\/'))
    expect(within(panneau()).getByText(attendue)).toBeInTheDocument()
  })

  /**
   * LE CONTREPOIDS. Un cours ne se garde pas indéfiniment.
   *
   * Sans cette borne, « retenir » deviendrait « ne jamais avouer » : le produit
   * convertirait au cours d'un mois passé sur un relevé de loyer, avec une
   * mention en petits caractères que personne ne lit avant le montant.
   */
  it('écartent un cours trop vieux, et le disent', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', '/rates', { status: 503, body: { error: 'indisponible' } })
    coursEnMemoire(ilYA(30))

    await renderApp('/demo', { currency: 'CAD' })
    await attendreLeChargement()
    await ouvrirLesReglages()

    expect(screen.getByRole('main').textContent).toMatch(/FCFA/)
    expect(within(panneau()).getByText(/Cours indisponibles/)).toBeInTheDocument()
  })

  /**
   * ET LA MÉMOIRE SE REMPLIT, ce qui n'est pas acquis : un cas qui ne
   * mesurerait que la LECTURE passerait sur une mémoire qu'on n'écrit jamais,
   * remplie à la main par le cas lui-même.
   */
  it('retiennent ce que l’API vient de servir', async () => {
    installerFauxServeur()
    await renderApp('/demo', { currency: 'CAD' })
    await attendreLeChargement()

    const retenu = window.localStorage.getItem('gestlocpro.rates')
    expect(retenu, 'rien n’a été retenu du cours qui vient d’arriver').not.toBeNull()
    expect(JSON.parse(retenu!)).toMatchObject({ date: '2026-08-28', parEuro: { CAD: 1.6 } })
  })
})
