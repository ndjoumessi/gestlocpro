import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'
import { Logo } from '@/components/primitives/Logo'

/**
 * UNE QUITTANCE DIT QUI L'ÉMET.
 *
 * ═══ CE QUE LA FEUILLE PORTAIT ═══
 *
 * Rien. `.zone-imprimable` commençait par un surtitre et un mois. Remise à un
 * locataire, la feuille n'était signée de personne : aucune ligne dessus ne
 * disait d'où elle venait, alors que c'est le seul document du produit qui sorte
 * d'une imprimante et change de mains.
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
 * rien à rendre. Son EMPLACEMENT — dans la zone imprimable et non au-dessus —
 * n'est vérifié que sur la source, et il faut le dire : monter la modale
 * demanderait une session, un parc, un portefeuille et une réponse de document,
 * soit un jeu de fixtures entier pour une assertion de placement.
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

  it('est DANS la zone imprimable, sans quoi la feuille sort nue', () => {
    /*
      LES COMMENTAIRES SONT RETIRÉS D'ABORD, et une mutation l'a exigé.

      La première rédaction cherchait `indexOf('zone-imprimable')` dans la source
      brute. Or ce nom apparaît TROIS FOIS avant le JSX, dans des commentaires qui
      racontent son rôle : l'index trouvé était celui d'une phrase, pas celui de
      la balise. Déplacer l'en-tête HORS de la zone laissait donc la garde au
      vert — elle comparait une position à une prose.

      On vise donc l'attribut lui-même, dans une source débarrassée de ses
      commentaires. Cela reste un contrôle de TEXTE et non de rendu ; l'en-tête
      de ce fichier dit pourquoi.
    */
    const propre = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const zone = propre.indexOf('className="zone-imprimable')
    const marque = propre.indexOf('<Logo impression')
    expect(zone, 'la zone imprimable a disparu').toBeGreaterThan(-1)
    expect(marque, 'la marque a disparu').toBeGreaterThan(-1)
    /* Après l'ouverture de la zone : posée avant, elle resterait à l'écran
       pendant que le papier sortirait anonyme. */
    expect(marque).toBeGreaterThan(zone)
  })
})
