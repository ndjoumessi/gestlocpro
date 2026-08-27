import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'

/**
 * UNE SEULE FAÇON DE DIRE « ON PEUT AGIR ICI ».
 *
 * ═══ CE QUE LA VITRINE DISAIT DE TROIS FAÇONS ═══
 *
 * Les pastilles des six fonctionnalités étaient `bg-accent-tint text-accent-ink`
 * — un bleu très pâle portant un glyphe bleu. Sur une carte blanche posée sur un
 * gris clair, cela empilait TROIS valeurs voisines : la page, la carte, la
 * pastille. Le signe le plus fort de la section disparaissait dans son fond.
 *
 * Le dépliant de la FAQ, lui, était un chevron en `text-muted` — la teinte
 * réservée aux textes SECONDAIRES. Le seul signe disant « ceci s'ouvre » était
 * peint de la couleur de ce qui compte le moins.
 *
 * Les deux portent maintenant l'accent PLEIN. La page n'a plus qu'un vocabulaire
 * pour « voici une chose sur laquelle agir », et c'est ce que ce fichier tient.
 *
 * ═══ CE QU'IL NE TIENT PAS ═══
 *
 * Le contraste et la géométrie. `mesure-ui` audite les 17 000 textes de la
 * vitrine aux deux thèmes, et c'est lui qui dirait qu'un blanc sur accent ne
 * passe plus. Ici on garde le VOCABULAIRE : que les deux signes restent le même
 * signe.
 */

/* Les classes sont assemblées, jamais écrites : Tailwind scanne les tests, et
   citer un nom en clair suffirait à faire émettre la règle. */
const FOND = ['bg', 'accent'].join('-')
const ENCRE = ['text', 'on', 'accent'].join('-')

describe('le vocabulaire de l’accent', () => {
  it('peint les six pastilles de fonctionnalité, glyphe compris', async () => {
    await renderApp('/')

    const cartes = within(document.getElementById('features')!).getAllByRole('article')
    expect(cartes, 'la grille des fonctionnalités a disparu').toHaveLength(6)

    for (const carte of cartes) {
      const pastille = carte.querySelector('span')!
      const classes = pastille.className.split(/\s+/)
      expect(classes, 'une pastille n’est plus à l’accent plein').toContain(FOND)
      expect(classes, 'le glyphe d’une pastille ne suit plus son fond').toContain(ENCRE)
    }
  })

  it('peint le dépliant de chaque question de la même façon', async () => {
    await renderApp('/')

    const questions = document.querySelectorAll('#faq details')
    expect(questions.length, 'la FAQ a disparu').toBeGreaterThan(0)

    for (const question of Array.from(questions)) {
      const rond = question.querySelector('summary > span[aria-hidden="true"]')
      expect(rond, 'une question n’a plus de dépliant').not.toBeNull()
      const classes = rond!.className.split(/\s+/)
      expect(classes, 'le dépliant n’est plus à l’accent plein').toContain(FOND)
      expect(classes, 'le glyphe du dépliant ne suit plus son fond').toContain(ENCRE)
    }
  })

  /**
   * LE ROND EST UN DÉCOR ; LA COMMANDE EST LA QUESTION ENTIÈRE.
   *
   * C'est ce qui distingue ce signe d'un bouton : un rond de 36 px serait sous le
   * plancher de 44, alors que le `<summary>` qui le contient en fait 68. Le
   * marquer `aria-hidden` et laisser le `<summary>` porter le rôle est ce qui
   * rend la géométrie juste ET l'annonce correcte — sans quoi un lecteur d'écran
   * annoncerait deux commandes pour une seule question.
   */
  it('laisse la question porter la commande, le rond n’étant qu’un signe', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/')

    const premiere = document.querySelector('#faq details')!
    const resume = premiere.querySelector('summary')!
    expect(premiere).not.toHaveAttribute('open')

    await utilisateur.click(resume)
    expect(premiere, 'la question ne s’ouvre plus').toHaveAttribute('open')

    /* Et le rond n'ajoute aucune commande : il n'est ni bouton, ni lien. */
    const rond = resume.querySelector('span[aria-hidden="true"]')!
    expect(rond.tagName.toLowerCase()).toBe('span')
    expect(within(resume).queryByRole('button')).toBeNull()
  })
})

/**
 * LE PIED SE REPLIE EN DEUX COLONNES.
 *
 * Cinq liens de 44 px empilés faisaient 260 px, et le pied entier 484 pour un
 * logo, une phrase et ces cinq liens — sa colonne de gauche, qui n'en contient
 * que deux lignes, gardait deux cents pixels de vide sous elle. Après : 380 px,
 * les liens sur trois rangs.
 *
 * La MESURE est au navigateur ; ici on tient ce que jsdom peut dire — que les
 * liens sont toujours là, tous, et qu'aucun n'a perdu son plancher de cible en
 * chemin. Un repli qui compacterait en rognant les cibles serait pire que le
 * vide qu'il corrige.
 */
describe('le pied de la vitrine', () => {
  it('garde ses liens et leur plancher de cible', async () => {
    await renderApp('/')

    const pied = screen.getByRole('contentinfo')
    const liens = within(pied).getAllByRole('link')
    expect(liens.length, 'le pied a perdu ses liens').toBeGreaterThan(4)

    const plancher = ['min', 'h', '11'].join('-')
    const navigation = within(pied).getAllByRole('navigation')
    for (const nav of navigation) {
      for (const lien of within(nav).getAllByRole('link')) {
        expect(
          lien.className.split(/\s+/),
          `« ${lien.textContent} » a perdu son plancher de cible`,
        ).toContain(plancher)
      }
    }
  })
})
