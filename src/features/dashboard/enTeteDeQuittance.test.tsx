import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'
import { Logo } from '@/components/primitives/Logo'

/**
 * UNE QUITTANCE DIT QUI L'ÉMET.
 *
 * ═══ CE QUE LA FEUILLE PORTAIT ═══
 *
 * Rien. Le document commençait par un surtitre et un mois. Remis à un
 * locataire, il n'était signé de personne : aucune ligne dessus ne disait d'où
 * il venait, alors que c'est le seul document du produit qui sorte d'une
 * imprimante et change de mains.
 *
 * ═══ POURQUOI UNE MARQUE EN UNE SEULE ENCRE ═══
 *
 * Les quatre carrés du signe disent « états différents » par des opacités de
 * 0,55 et 0,22. À l'écran ce sont deux bleus pâles très lisibles ; sur une
 * feuille, ce sont des gris tramés qu'une laser bon marché rend en semis de
 * points et qu'une thermique ne rend pas du tout. La version imprimée porte donc
 * la même opposition par la FORME — deux carrés pleins, deux évidés.
 *
 * ═══ CE QUI EST ÉPROUVÉ ICI, ET CE QUI NE L'EST QUE PAR LECTURE ═══
 *
 * La VARIANTE est montée et interrogée : c'est du comportement, et il ne coûte
 * rien à rendre. Sa PRÉSENCE dans l'aperçu n'est vérifiée que sur la source, et
 * il faut le dire : monter la modale demanderait une session, un parc, un
 * portefeuille et une réponse de document, soit un jeu de fixtures entier pour
 * une assertion de placement.
 *
 * Rien de tout cela n'est vu par le balayage : `mesure-ui` visite des adresses,
 * aucune n'ouvre cette modale, et la feuille imprimée n'est de toute façon pas
 * un écran.
 */

const SOURCE = import.meta.glob('./ReceiptModal.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('la marque à l’impression', () => {
  it('emploie l’encre unique, et non la marque de l’écran', () => {
    renderWithProviders(<Logo impression to="" />)

    const marque = document.querySelector('img')
    expect(marque, 'la variante ne rend aucune marque').not.toBeNull()
    expect(marque).toHaveAttribute('src', '/logo-monochrome.svg')
    /* Et surtout PAS le carré peint de l'écran : c'est lui qui sortirait en
       aplat de couleur, ou en gris, selon l'imprimante. */
    expect(document.querySelector('svg')).toBeNull()
  })

  it('laisse le nom au texte, la marque restant un décor', () => {
    renderWithProviders(<Logo impression to="" />)

    const marque = document.querySelector('img')!
    expect(marque).toHaveAttribute('alt', '')
    expect(marque).toHaveAttribute('aria-hidden', 'true')
    /* Le nom est écrit, donc lisible à la voix comme à l'œil. Une marque seule
       laisserait la feuille muette pour qui ne la voit pas. */
    expect(document.body.textContent).toContain('GestLocPro')
  })

  it('renonce à l’accent, qui n’a pas d’encre sur une feuille', () => {
    const { unmount } = renderWithProviders(<Logo impression to="" />)
    const imprime = screen.getByText('Pro').className
    unmount()

    renderWithProviders(<Logo to="" />)
    const ecran = screen.getByText('Pro').className

    /* Le contraste entre les deux EST l'assertion : à l'écran « Pro » porte
       l'accent, à l'impression il ne porte rien. Vérifier seulement la variante
       imprimée passerait au vert le jour où l'écran perdrait son accent aussi. */
    expect(ecran, 'le mot-symbole d’écran a perdu son accent').toMatch(/accent/)
    expect(imprime, 'le mot-symbole imprimé garde un accent').not.toMatch(/accent/)
  })
})

describe('l’en-tête de la quittance', () => {
  const source = Object.values(SOURCE)[0] ?? ''

  it('existe, et emploie la variante d’impression', () => {
    expect(source, 'la source de la modale est introuvable').not.toBe('')
    expect(source).toContain('<Logo impression')
  })

  /**
   * CE CAS A CHANGÉ DE SUJET, PARCE QUE LA FEUILLE A CHANGÉ DE SOURCE.
   *
   * Il vérifiait que la marque était posée DANS `.zone-imprimable` — le bloc
   * que l'ancienne feuille `@media print` rallumait pour imprimer le DOM. Ce
   * procédé est retiré : il rognait le document au bord du conteneur de
   * défilement, et l'imprimante sortait la quittance coupée. On imprime
   * désormais le PDF, celui-là même que « Télécharger » remet.
   *
   * L'INVARIANT, LUI, N'A PAS BOUGÉ : la feuille dit qui l'émet. Ce qui le tient
   * n'est plus une position dans du JSX mais `enTete()` dans `pagesDeQuittance`,
   * qui écrit le nom du parc en tête de page — et `memeQuittanceDesDeuxCotes`
   * mesure déjà que les deux chemins rendent la même feuille.
   *
   * Ce qui reste ici est ce que ce fichier peut voir sans monter un parc : que
   * l'APERÇU porte l'émetteur, lui aussi. Une modale qui montrerait un document
   * anonyme puis en imprimerait un signé serait un aperçu qui ment — le défaut
   * que ce fichier existe pour interdire, dans l'autre sens.
   */
  it('reste porté par l’aperçu, la feuille l’ayant par `enTete`', () => {
    const propre = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    expect(propre, 'la marque a disparu de l’aperçu').toContain('<Logo impression')
    /* ET LA ZONE IMPRIMABLE N'EST PLUS LÀ. Sans cette moitié, le cas resterait
       vert le jour où quelqu'un ramènerait `window.print()` et sa feuille — donc
       le document rogné. */
    expect(propre, 'le DOM est redevenu la source de l’impression').not.toContain(
      'className="zone-imprimable',
    )
  })
})
