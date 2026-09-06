import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * L'ÉCRAN EN SAVAIT PLUS QU'IL N'EN DISAIT.
 *
 * Trois nombres étaient déjà sur la ligne ou dérivables d'elle, et l'écran les
 * aplatissait :
 *
 *   · le loyer d'un lot VACANT s'affichait comme celui d'un lot loué. Le même
 *     « 118 000 FCFA », sans rien pour dire que personne ne le verse — un manque
 *     à gagner qui se lit comme un revenu, sur l'écran d'un propriétaire ;
 *   · « En retard » était vrai à trois jours comme à vingt-quatre. `overdueDays`
 *     était sur le type `Unit` depuis toujours ; la pastille le jetait. Relancer
 *     et mettre en demeure ne sont pas le même geste ;
 *   · l'en-tête d'un immeuble portait son occupation et sa barre, jamais son
 *     argent — alors que c'est la première question qu'on pose à un immeuble.
 *
 * ═══ LE COMPTE DE L'IMMEUBLE EXCLUT LES LOTS VIDES ═══
 *
 * Et c'est le cas qui fait ce fichier. Un lot vide n'appelle rien : l'additionner
 * ferait lire un revenu qui n'existe pas. Akwa Nord est le seul immeuble de la
 * démonstration qui porte un lot vacant — c'est donc le SEUL où la somme juste
 * et la somme fausse diffèrent, et le seul qui puisse faire rougir cette garde.
 */

/** Le texte d'un nœud, sans aucune espace — les séparateurs de milliers varient. */
function chiffres(noeud: Element | null) {
  return (noeud?.textContent ?? '').replace(/[\s  ]/g, '')
}

/** L'en-tête de groupe qui porte ce nom d'immeuble. */
function enTete(nom: string) {
  const bloc = Array.from(document.querySelectorAll('[data-groupe]')).find(
    (e) => e.querySelector('h3')?.textContent?.trim() === nom,
  )
  if (!bloc) throw new Error(`Aucun en-tête de groupe pour « ${nom} »`)
  return bloc as HTMLElement
}

/** La rangée du logement portant ce libellé. */
function rangee(unite: string) {
  const ligne = within(screen.getByRole('table'))
    .getAllByRole('row')
    .find((r) => within(r).queryByRole('link', { name: new RegExp(`\\b${unite}\\b`) }))
  if (!ligne) throw new Error(`Aucune rangée pour le logement ${unite}`)
  return ligne
}

async function ouvrirLeParc() {
  installerFauxServeur()
  await renderApp('/demo/parc', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
}

describe('ce que la ligne du parc dit de ses nombres', () => {
  it('marque « attendu » le loyer d’un lot vacant, et lui seul', async () => {
    await ouvrirLeParc()

    /* B4 et C3 sont les deux lots vacants de la démonstration. Leur montant
       reste affiché — c'est ce que le lot RAPPORTERAIT — mais il est qualifié. */
    for (const unite of ['B4', 'C3']) {
      expect(
        within(rangee(unite)).getByText(/attendu/),
        `le loyer de ${unite} se lit comme un revenu`,
      ).toBeInTheDocument()
    }

    /* GARDE DU GARDE — la moitié négative. Sans elle, un « attendu » collé à
       TOUTES les lignes passerait au vert : le mot ne dirait plus rien. */
    for (const unite of ['A1', 'C1']) {
      expect(within(rangee(unite)).queryByText(/attendu/), `${unite} est loué`).toBeNull()
    }
  })

  it('porte la durée du retard à côté de l’état, et seulement là', async () => {
    await ouvrirLeParc()

    /* A3 traîne 24 jours dans le jeu de démonstration, C2 en traîne 3 : deux
       durées différentes sous le même mot « En retard », ce qui est exactement
       ce que la pastille seule ne pouvait pas dire. */
    expect(chiffres(rangee('A3'))).toContain('24j')
    expect(chiffres(rangee('C2'))).toContain('3j')

    /* A1 est à jour : rien à compter. Une durée posée sur une ligne saine
       serait un nombre sans question. */
    expect(within(rangee('A1')).queryByText(/\d+\s?j$/)).toBeNull()
  })

  it('somme dans l’en-tête ce que l’immeuble APPELLE, pas ce qu’il vaudrait plein', async () => {
    await ouvrirLeParc()

    /*
      AKWA NORD EST LE CAS, et c'est le seul du jeu.

        B1 160 000 + B2 155 000 + B3 120 000 = 435 000  ← appelé
        B4 118 000, vacant                   = 553 000  ← ce qu'il vaudrait plein

      Les deux sommes ne diffèrent QUE sur un immeuble qui porte un lot vide.
      Sur Bonamoussadi, plein, elles sont égales : l'assertion y passerait au
      vert sur un code fautif.
    */
    const akwa = chiffres(enTete('Immeuble Akwa Nord'))
    expect(akwa, 'la somme des loyers appelés').toContain('435000')
    expect(akwa, 'un lot vide n’appelle rien : il ne s’additionne pas').not.toContain('553000')
  })

  it('ne montre pas l’argent de l’immeuble sur un téléphone', async () => {
    installerFauxServeur()
    await renderApp('/demo/parc', { largeur: 360 })
    await screen.findByRole('heading', { level: 1 })
    await attendreLeChargement()

    /*
      SOUS `sm`, LA BOÎTE FAIT MOINS DE 320 px et le montant y prendrait la place
      du RAPPORT, qui est la mesure de cet écran. Il est masqué par `hidden
      sm:inline` — donc toujours dans le DOM, et c'est pourquoi ce cas interroge
      la CLASSE et non le texte : `jsdom` n'applique aucune requête de média, un
      `queryByText` le trouverait des deux côtés et ne garderait rien.
    */
    const akwa = enTete('Immeuble Akwa Nord')
    const montant = Array.from(akwa.querySelectorAll('span')).find((e) =>
      /435/.test(e.textContent ?? ''),
    )
    expect(montant, 'le montant de l’immeuble est introuvable').toBeDefined()
    expect(montant!.className).toContain('hidden')
    expect(montant!.className).toContain('sm:inline')
  })
})
