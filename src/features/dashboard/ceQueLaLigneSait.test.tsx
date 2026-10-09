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
 * ═══ LES COMPTES INCLUENT LES LOTS VIDES — RENVERSÉ LE 2026-10-09 ═══
 *
 * Et c'est le cas qui fait ce fichier. Ce fichier a gardé l'INVERSE jusque-là,
 * dans ces termes : « un lot vide n'appelle rien : l'additionner ferait lire un
 * revenu qui n'existe pas ». La règle était défendable prise seule ; ce qu'elle
 * produisait sur l'écran ne l'était pas — la somme des en-têtes ne faisait pas le
 * total du parc, et le pied de colonne sommait deux lignes sur sept sous le mot
 * « Total ». Nelson l'a lu comme un montant faux, ce qui est la seule lecture
 * possible d'un total qu'on ne peut pas recomposer à la main.
 *
 * Akwa Nord est le seul immeuble de la démonstration qui porte un lot vacant —
 * c'est donc le SEUL où la somme juste et la somme fausse diffèrent, et le seul
 * qui puisse faire rougir cette garde.
 *
 * CE QUI EST RÉELLEMENT APPELÉ n'a pas disparu : la carte du haut le porte en
 * note, et chaque ligne de lot vide écrit « attendu » après son montant.
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
  // Le parc sur bureau est une fiche par logement (`parcEnFiches.test.tsx`),
  // plus une rangée de tableau : la fiche est celle qui porte le lien du logement.
  const ligne = screen
    .getAllByRole('listitem')
    .filter((li) => li.hasAttribute('data-fiche-logement'))
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

  it('somme dans l’en-tête TOUS les lots de l’immeuble, vides compris', async () => {
    await ouvrirLeParc()

    /*
      AKWA NORD EST LE CAS, et c'est le seul du jeu.

        B1 160 000 + B2 155 000 + B3 120 000 = 435 000  ← appelé
        + B4 118 000, vacant                 = 553 000  ← ce que l'immeuble pèse

      Les deux sommes ne diffèrent QUE sur un immeuble qui porte un lot vide.
      Sur Bonamoussadi, plein, elles sont égales : l'assertion y passerait au
      vert sur un code fautif.

      CE CAS GARDAIT L'INVERSE JUSQU'AU 2026-10-09, et son titre disait « pas ce
      qu'il vaudrait plein ». La règle était défendable prise seule ; ce qu'elle
      produisait sur l'écran ne l'était pas : la somme des en-têtes ne faisait
      pas le total du parc, et le pied de colonne sommait deux lignes sur sept
      sous le mot « Total ». Les trois nombres suivent désormais la même règle —
      ce que les baux APPELLENT se lit dans la note du total, et sur chaque ligne
      de lot vide, où le montant est suivi de « attendu ».
    */
    const akwa = chiffres(enTete('Immeuble Akwa Nord'))
    expect(akwa, 'ce que l’immeuble pèse, lot vide compris').toContain('553000')
    expect(akwa, 'le lot vide est resté hors de la somme').not.toContain('435000')
  })

  /**
   * LA CARTE DU HAUT, QUE RIEN NE GARDAIT.
   *
   * L'en-tête d'immeuble et le pied de colonne ont chacun leur cas ; le total du
   * parc, qui est précisément le chiffre que Nelson a signalé comme faux, n'en
   * avait aucun. Les trois suivent la même règle depuis ce lot, et une règle
   * tenue à deux endroits sur trois est une règle qui se défera par le troisième.
   */
  it('coiffe le parc entier, et nomme à part ce qui est appelé', async () => {
    await ouvrirLeParc()

    const cartes = Array.from(document.querySelectorAll('[data-indicateur]'))
    const carte = cartes.find((c) => /Loyer du parc/.test(c.textContent ?? ''))
    expect(carte, 'aucune carte ne nomme le loyer du parc').toBeDefined()

    /* LE LIBELLÉ EST PROPRE À CET ÉCRAN, et ce n'est pas une coquetterie : la
       carte portait « Loyers attendus », partagé avec le tableau de bord et les
       paiements, où il désigne ce que les BAUX appellent. Deux nombres sous un
       seul mot. */
    expect(
      cartes.some((c) => /Loyers attendus/.test(c.textContent ?? '')),
      'le parc a repris le libellé du tableau de bord',
    ).toBe(false)

    /* LA SOMME SE RECOMPOSE DEPUIS LES FICHES, jamais depuis un nombre écrit à
       la main : un montant gravé ici rougirait au premier changement du jeu de
       démonstration sans avoir rien gardé. */
    /*
      DEUX PIÈGES DANS CETTE CELLULE, et le premier a fait rougir ce cas avant
      d'être vu : un lot en paiement PARTIEL écrit « reçu / attendu », donc DEUX
      montants. Pris ensemble, « 40 000 / 75 000 » devient 4000075000. Le loyer
      est celui d'APRÈS la barre oblique.

      Le second est le retard — « 34 j » —, un nombre de plus dans la même boîte.
      Il porte `text-danger` et sort avec lui.
    */
    const loyerDe = (fiche: Element) => {
      const cellule = fiche.querySelector('[data-section="loyer"]')?.cloneNode(true) as
        | HTMLElement
        | undefined
      cellule?.querySelectorAll('.text-danger').forEach((n) => n.remove())
      const texte = chiffres(cellule ?? null)
      const apresLaBarre = texte.includes('/') ? texte.slice(texte.indexOf('/') + 1) : texte
      return { texte, montant: Number(apresLaBarre.replace(/[^\d]/g, '')) }
    }

    const loyers = Array.from(document.querySelectorAll('[data-fiche-logement]')).map(loyerDe)
    expect(loyers.length, 'aucune fiche de logement').toBeGreaterThan(1)
    const tous = loyers.reduce((somme, l) => somme + l.montant, 0)
    const appeles = loyers
      .filter((l) => !/attendu/i.test(l.texte))
      .reduce((somme, l) => somme + l.montant, 0)
    expect(appeles, 'la démonstration n’a aucun lot vacant : le cas ne garde rien').toBeLessThan(
      tous,
    )

    /* `compact` arrondit les grands montants — on compare donc les premiers
       chiffres significatifs, pas l'égalité exacte. */
    const tete = (n: number) => String(n).slice(0, 3)
    expect(
      chiffres(carte!.querySelector('[data-valeur]')),
      'la carte ne coiffe pas le parc entier',
    ).toContain(tete(tous))
    expect(
      chiffres(carte!).replace(chiffres(carte!.querySelector('[data-valeur]')), ''),
      'la note ne porte pas ce qui est réellement appelé',
    ).toContain(tete(appeles))
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
      /553/.test(e.textContent ?? ''),
    )
    expect(montant, 'le montant de l’immeuble est introuvable').toBeDefined()
    expect(montant!.className).toContain('hidden')
    expect(montant!.className).toContain('sm:inline')
  })
})
