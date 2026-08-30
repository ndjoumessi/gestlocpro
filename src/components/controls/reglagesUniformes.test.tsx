import { describe, expect, it } from 'vitest'
import { renderApp, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LES MÊMES TROIS RÉGLAGES, PRÉSENTÉS DE LA MÊME FAÇON, PARTOUT.
 *
 * ═══ CE QU'IL Y AVAIT ═══
 *
 * Langue, devise et thème étaient assemblés À LA MAIN à quatre endroits, et les
 * quatre ne se ressemblaient pas :
 *
 *   vitrine          rangée repliable, aucun intitulé
 *   authentification colonne, aucun intitulé
 *   coquille         colonne, intitulés en capitales, avis de conversion
 *   barre locataire  rangée en ligne, deux commandes masquées sous `sm`
 *
 * Le même utilisateur rencontrait donc quatre fois la même décision sous quatre
 * apparences. Et deux d'entre elles ne disaient pas ce qu'on y règle : trois
 * commandes nues, dont un segment « FR | EN » qu'il faut reconnaître.
 *
 * Pire, là où l'intitulé existait, il était écrit DEUX FOIS : le sélecteur de
 * devise portait « Devise » dans son propre bouton, sous une section déjà
 * nommée « DEVISE ». La capture d'écran se lit « DEVISE / DEVISE Euro (€) ».
 *
 * ═══ CE QUE CE FICHIER TIENT ═══
 *
 * Non pas l'apparence — aucune garde ne mesure un goût — mais la CONSTANCE :
 * les trois surfaces montrent les mêmes réglages, dans le même ordre, sous les
 * mêmes intitulés visibles. C'est ce qui se casse quand on en modifie un seul
 * des quatre, et c'est exactement ce qui s'était cassé.
 */

/** Les trois surfaces qui portent le trio, et l'adresse où les rencontrer. */
const SURFACES = [
  { nom: 'vitrine', adresse: '/' },
  { nom: 'authentification', adresse: '/connexion' },
  { nom: 'coquille applicative', adresse: '/demo' },
] as const

/**
 * Ouvre le panneau de réglages de la surface courante et rend son bloc.
 *
 * UN SEUL SÉLECTEUR POUR LES TROIS, et c'est la moitié du sujet : tant que le
 * déclencheur s'appelait autrement d'une surface à l'autre, rien ne pouvait les
 * comparer — ni cette garde, ni `mesure-ui`, qui a déjà pris le sélecteur de
 * devise pour le menu de la vitrine.
 */
async function ouvrirLesReglages(): Promise<HTMLElement> {
  const user = userEvent.setup()
  const declencheurs = Array.from(
    document.querySelectorAll<HTMLElement>('[data-declencheur-reglages]'),
  )
  expect(declencheurs.length, 'aucun déclencheur de réglages sur cette surface').toBeGreaterThan(0)
  await user.click(declencheurs[0])

  const bloc = document.querySelector<HTMLElement>('[data-reglages]')
  expect(bloc, 'le panneau ouvert ne porte pas de bloc de réglages').not.toBeNull()
  return bloc!
}

/** Les intitulés visibles du bloc, dans l'ordre du document. */
function intitules(bloc: HTMLElement): string[] {
  return Array.from(bloc.querySelectorAll('[data-reglage-intitule]')).map((n) =>
    (n.textContent ?? '').trim(),
  )
}

describe('les réglages', () => {
  it.each(SURFACES)('portent les mêmes intitulés sur la $nom', async ({ adresse }) => {
    installerFauxServeur()
    await renderApp(adresse)
    await attendreLeChargement()

    const bloc = await ouvrirLesReglages()

    /* L'ORDRE COMPTE AUTANT QUE LA PRÉSENCE. Trois réglages dans trois ordres
       différents obligent à relire à chaque fois ; c'est la mémoire du geste
       qu'on perd, pas seulement l'élégance. */
    expect(intitules(bloc)).toEqual(['Langue', 'Devise', 'Thème'])
  })

  it.each(SURFACES)('donnent accès aux trois commandes sur la $nom', async ({ adresse }) => {
    installerFauxServeur()
    await renderApp(adresse)
    await attendreLeChargement()

    const bloc = await ouvrirLesReglages()

    /* Nommer les intitulés ne suffit pas : un bloc pourrait porter trois titres
       et deux commandes. On cherche les commandes elles-mêmes, par leur rôle.
       Deux groupes — la langue et le thème sont des segmentés —, et un bouton
       à liste pour la devise, qui a quatre choix et des noms longs. */
    expect(within(bloc).getAllByRole('group')).toHaveLength(2)
    expect(within(bloc).getByRole('button', { expanded: false })).toBeInTheDocument()
  })

  /**
   * L'INTITULÉ EST DIT UNE FOIS.
   *
   * Le sélecteur de devise portait « Devise » dans son bouton. Sous une section
   * qui s'appelle déjà « Devise », l'écran l'écrivait deux fois — et un lecteur
   * d'écran l'annonçait deux fois. Le bouton garde son nom accessible ; ce qu'il
   * MONTRE est la valeur choisie, qui se suffit : « Euro (€) » n'a pas besoin
   * qu'on lui dise que c'est une devise.
   */
  it('n’écrivent pas « Devise » deux fois', async () => {
    installerFauxServeur()
    await renderApp('/demo')
    await attendreLeChargement()

    const bloc = await ouvrirLesReglages()
    const occurrences = (bloc.textContent ?? '').match(/Devise/g) ?? []

    expect(occurrences, 'l’intitulé est répété dans la commande qu’il désigne').toHaveLength(1)
  })
})
