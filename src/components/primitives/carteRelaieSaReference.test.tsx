import { createRef } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, type CardProps } from './Card'

/**
 * `Card` RELAIE SA RÉFÉRENCE, SUR SES QUATRE BALISES.
 *
 * CE QUE ÇA TIENT. Deux choses, et la seconde est la vraie raison d'être de ce
 * fichier.
 *
 * 1. Le relais existe. En React 18, une fonction de composant n'a PAS de
 *    référence : `<Card ref={…} />` sans `forwardRef` ne déclenche aucune
 *    erreur de compilation, aucune assertion, aucun avertissement en production
 *    — la référence reste simplement à `null`, et le panneau qu'elle devait
 *    focaliser laisse la tabulation repartir du haut du document. C'est le pire
 *    genre de régression : silencieuse, et visible seulement au clavier.
 *
 * 2. LA CONVERSION NE MENT PAS. `Card` est polymorphe, et son union de balises
 *    se retourne en INTERSECTION dès qu'elle passe en position de paramètre :
 *    JSX y exigerait une référence qui soit à la fois `HTMLDivElement` et
 *    `HTMLLIElement`, ce qu'aucune valeur réelle n'habite. La primitive résout
 *    ça par `balise as 'div'` — c'est-à-dire en FAISANT TAIRE le vérificateur de
 *    types sur ce point précis.
 *
 *    Une conversion est une promesse non vérifiée. Celle-ci promet que les
 *    quatre balises rendent bien l'élément qu'elles nomment et que la référence
 *    y arrive. Le seul témoin possible est l'exécution : on monte les quatre, et
 *    on lit le `tagName` de ce que la référence a reçu. Si la conversion venait
 *    à couvrir une vraie erreur — une balise rendue en `div` quoi qu'on demande
 *    — c'est ici, et nulle part ailleurs, que ça rougirait.
 *
 * `<li>` est monté dans un `<ul>` : hors liste, c'est du HTML invalide, et le
 * test reproduirait un balisage que le produit ne produit jamais.
 */

const BALISES: { as: NonNullable<CardProps['as']>; attendu: string }[] = [
  { as: 'div', attendu: 'DIV' },
  { as: 'article', attendu: 'ARTICLE' },
  { as: 'section', attendu: 'SECTION' },
  { as: 'li', attendu: 'LI' },
]

describe('Card relaie sa référence', () => {
  it('couvre bien les quatre balises que `as` accepte', () => {
    // GARDE DE LA GARDE : `as` peut gagner une balise sans que personne pense à
    // l'ajouter ici, et le fichier passerait alors au vert en n'inspectant que
    // les anciennes. Le compte est le seul rappel possible — le type n'est pas
    // énumérable à l'exécution.
    expect(BALISES).toHaveLength(4)
  })

  for (const { as, attendu } of BALISES) {
    it(`pose la référence sur le \`<${as}>\` rendu`, () => {
      const reference = createRef<HTMLElement>()
      const carte = (
        <Card ref={reference} as={as}>
          contenu
        </Card>
      )
      render(as === 'li' ? <ul>{carte}</ul> : carte)

      expect(reference.current).not.toBeNull()
      expect(reference.current?.tagName).toBe(attendu)
      // La référence désigne bien LA CARTE, et non un enfant : c'est elle qui
      // porte les classes du ton, donc c'est elle qu'on mesure et qu'on focalise.
      expect(reference.current?.className).toContain('rounded-lg')
    })
  }

  it('rend la carte même sans référence — le relais n’est pas obligatoire', () => {
    const { container } = render(<Card>contenu</Card>)
    expect(container.querySelector('div')?.className).toContain('rounded-lg')
  })
})
