import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * LA FICHE ENTIÈRE OUVRE LE DOSSIER, ET NON SON SEUL NUMÉRO.
 *
 * ═══ CE QU'ELLE DISAIT, ET CE QU'ELLE FAISAIT ═══
 *
 * La fiche s'éclaire au survol — bordure, ombre — donc elle ANNONCE une
 * destination. Seul son numéro, 48 × 44 px en haut à gauche, y menait. Tout le
 * reste de la carte — le nom du locataire, le loyer, les jauges — se survolait
 * comme une surface cliquable et ne cliquait rien. Une affordance qui promet
 * plus qu'elle ne tient coûte plus cher qu'une carte inerte.
 *
 * ═══ LE LIEN S'ÉTIRE, IL NE SE DÉPLACE PAS ═══
 *
 * `after:inset-0` étend la ZONE DE FRAPPE du lien à la fiche entière sans
 * toucher à sa boîte : un pseudo-élément ne change pas le rectangle de son
 * hôte. Le numéro reste donc la cible de 48 × 44 que la sonde des cibles
 * mesure, le lien reste focalisable, ouvrable dans un nouvel onglet et annoncé
 * par sa destination — rien de ce que le dépôt refuse dans une « rangée
 * piégée » n'est introduit ici.
 *
 * ═══ CE QUE CE MOTIF CASSE, ET QUE CES CAS GARDENT ═══
 *
 * Un lien étiré passe PAR-DESSUS tout ce qui n'est pas positionné : le menu de
 * la fiche et le bouton d'attribution d'un logement vide deviennent
 * incliquables, et rien à l'écran ne le montre — ils s'affichent, ils
 * s'éclairent, ils ne répondent plus. C'est la régression classique de ce
 * motif, et c'est ce que les deux derniers cas tiennent.
 *
 * ═══ CE QUE CES CAS NE VOIENT PAS ═══
 *
 * LA ZONE DE FRAPPE ELLE-MÊME. jsdom ne fait aucune mise en page : un
 * pseudo-élément n'y couvre rien, et `elementFromPoint` ne rend jamais ce lien.
 * On tient donc le CONTRAT — la classe qui l'étire, la position qui le borne,
 * les commandes qui le surmontent — et non son effet. Le mesurer demanderait
 * une règle de porte au navigateur ; elle est nommée au rapport, pas écrite.
 */

/** La fiche du logement portant ce numéro. */
function fiche(numero: string): HTMLElement {
  const lien = screen.getByRole('link', { name: new RegExp(`dossier du logement ${numero}\\b`, 'i') })
  const carte = lien.closest<HTMLElement>('[data-fiche-logement]')
  if (!carte) throw new Error(`aucune fiche pour ${numero}`)
  return carte
}

async function ouvrirLeParc() {
  await renderApp('/demo/parc')
  await attendreLeChargement()
}

describe('la fiche de logement ouvre son dossier sur toute sa surface', () => {
  it('étire la zone de frappe du lien à la fiche entière', async () => {
    await ouvrirLeParc()
    const lien = within(fiche('A1')).getByRole('link', { name: /dossier du logement A1/i })

    expect(
      lien.className,
      'le lien ne couvre que son numéro : la fiche s’éclaire au survol et ne mène nulle part ailleurs',
    ).toMatch(/after:inset-0/)
    /* LE PSEUDO-ÉLÉMENT SE BORNE À LA FICHE, et c'est `relative` sur elle qui
       le décide. Sans lui, il s'étirerait jusqu'au premier ancêtre positionné —
       le rail — et une seule fiche couvrirait toutes les autres. */
    expect(
      fiche('A1').className,
      'la fiche n’est pas positionnée : le lien étiré déborderait sur ses voisines',
    ).toMatch(/\brelative\b/)
  })

  it('ne porte AUCUNE transformation, même à la pression', async () => {
    /*
      ═══ UNE TRANSFORMATION CASSE LE MENU, ET AUCUN RENDU NE LE MONTRE ═══

      Un élément transformé devient le BLOC CONTENANT de ses descendants
      `position: fixed`. Le menu de cette fiche `echappe` — son panneau se pose
      en `fixed` avec des coordonnées prises dans le repère du VIEWPORT, pour
      sortir de la boîte à défilement du rail. Une transformation sur la fiche,
      même d'un pixel et même le temps d'un appui, déplace ce repère et envoie
      le panneau ailleurs.

      MESURÉ : `active:translate-y-px` — la convention de pression des six
      variantes de `Button` — a fait rougir quatre états de `modales`, « le
      bouton a été cliqué et aucune boîte de dialogue n'est apparue », à 1280 px
      seulement, la largeur où le parc rend des fiches plutôt qu'un tableau.
      jsdom ne pouvait pas le voir : il ne compose rien.

      CE CAS EST DONC UN RAPPEL, pas une mesure de l'effet. Il coûte une ligne et
      ferme une porte qu'on rouvrirait par réflexe, en copiant `Button`.
    */
    await ouvrirLeParc()
    expect(
      fiche('A1').className,
      'la fiche porte une transformation : le panneau de son menu, qui se pose en `fixed`, prendra la fiche pour repère au lieu du viewport',
    ).not.toMatch(/(^|:)(translate|scale|rotate|skew)-/)
  })

  it('laisse le menu de la fiche au-dessus du lien', async () => {
    await ouvrirLeParc()
    const menu = within(fiche('A1')).getByRole('button', { name: 'Actions du logement A1' })
    /* SON ENVELOPPE, et non le bouton : c'est elle qui porte le positionnement,
       et c'est elle qui décide si le lien passe devant. */
    const enveloppe = menu.closest<HTMLElement>('div')
    expect(
      enveloppe?.className ?? '',
      'le menu de la fiche est sous le lien étiré : il s’affiche, il s’éclaire, et il ne répond plus',
    ).toMatch(/\brelative\b/)
  })

  it('laisse le geste d’un logement vide au-dessus du lien', async () => {
    /*
      LE SECOND ENFANT QUE LE LIEN ÉTIRÉ RECOUVRE, et il est plus facile à
      manquer que le menu : il ne paraît que sur les logements VACANTS, donc
      sur deux fiches du parc de démonstration. Un lot qui ne regarderait
      qu'une fiche occupée passerait au vert en ayant cassé le seul geste que
      cet écran offre sur un logement vide.
    */
    await ouvrirLeParc()
    const attribuer = screen.getAllByRole('button', { name: /attribuer|relier/i })[0]
    expect(attribuer, 'aucun logement vacant dans le parc : le cas ne garde rien').toBeDefined()
    const enveloppe = attribuer!.closest<HTMLElement>('div')
    expect(
      enveloppe?.className ?? '',
      'le geste du logement vide est sous le lien étiré : il s’affiche et ne répond plus',
    ).toMatch(/\brelative\b/)
  })

  it('ne se laisse pas emporter par le glisser natif du navigateur', async () => {
    /*
      UN LIEN EST GLISSABLE PAR DÉFAUT, et la fiche l'est aussi — pour se
      réordonner. Les deux gestes partent du même appui : sans ce garde, tirer
      une fiche décolle le fantôme de lien du navigateur au lieu de déplacer la
      carte, et le réordonnancement ne part jamais.
    */
    await ouvrirLeParc()
    const lien = within(fiche('A1')).getByRole('link', { name: /dossier du logement A1/i })
    expect(
      lien.getAttribute('draggable'),
      'le lien reste glissable : son fantôme natif prend le pas sur le réordonnancement',
    ).toBe('false')
  })
})
