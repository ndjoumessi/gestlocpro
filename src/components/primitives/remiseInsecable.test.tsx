import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LA PASTILLE DE REMISE EST UN JETON, ET UN JETON NE SE COUPE PAS.
 *
 * ═══ CE QUI ÉTAIT RENDU ═══
 *
 * « Annuel −20 % » : la pastille passait à la ligne entre « −20 » et « % »,
 * devenait un DISQUE de 36 × 38 px et emplissait la hauteur du segment — relevé
 * au navigateur à 1024 px, donc pas sur un écran étroit. Le segment mesurait
 * 102 px de large, la pastille 36 : elle était COMPRIMÉE sous la largeur de son
 * contenu, et c'est là qu'elle s'est coupée.
 *
 * ═══ LA CAUSE N'EST PAS LA CHAÎNE ═══
 *
 * Le déclencheur, oui : `yearlySave` vaut « −20 % » avec une espace SÉCABLE
 * (U+0020), là où l'anglais dit « −20% » sans espace — c'est pourquoi le défaut
 * était propre au français. Mais ce n'est pas la cause : cinq autres chaînes de
 * `fr.ts` emploient la même espace avant `%`, aucune insécable n'existe dans le
 * fichier, et changer celle-ci en ferait une exception que rien ne défend.
 *
 * La cause est que la pastille se déclare compressible et coupable alors qu'elle
 * est un jeton VISUELLEMENT ATOMIQUE — une pilule à coins ronds. Coupée, elle ne
 * devient pas « moins lisible », elle devient un autre objet. Aucun contenu ne
 * rend ce comportement souhaitable, donc c'est la pastille qu'on ferme, pas la
 * chaîne qu'on rustine.
 *
 * ═══ POURQUOI CETTE GARDE LIT LA SOURCE, ET CE QU'ELLE NE VOIT PAS ═══
 *
 * jsdom ne fait aucune mise en page et ne résout aucune classe Tailwind : il ne
 * dira jamais « cette pastille tient sur deux lignes ». La seule chose lisible
 * hors navigateur est la DÉCLARATION. Ce cas vérifie donc que la pastille se
 * déclare insécable et non compressible — il attraperait leur retrait, il
 * n'attraperait pas un parent qui la couperait autrement. La preuve du rendu a
 * été prise à la main, au navigateur, et elle est écrite ci-dessus.
 */
const ICI = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(join(ICI, 'Choice.tsx'), 'utf8')

/** Le corps de `Remise`, et rien d'autre : le fichier porte vingt composants. */
function corpsDeRemise(): string {
  const debut = SOURCE.indexOf('function Remise(')
  expect(debut, 'le composant `Remise` a disparu ou changé de nom').toBeGreaterThan(-1)
  return SOURCE.slice(debut, SOURCE.indexOf('\n}', debut))
}

describe('la pastille de remise', () => {
  it('se déclare insécable', () => {
    expect(
      corpsDeRemise(),
      'la pastille peut se couper : « −20 % » rendra un disque sur deux lignes',
    ).toContain('whitespace-nowrap')
  })

  it('se déclare non compressible', () => {
    /* `shrink-0` ET `whitespace-nowrap` : sans le premier, le parent lui prend
       sa largeur et la pastille DÉBORDE au lieu de se couper — on échange un
       défaut contre l'autre. Les deux disent la même propriété par ses deux
       bouts : ce jeton garde la taille de son contenu. */
    expect(
      corpsDeRemise(),
      'la pastille peut être comprimée sous la largeur de son contenu',
    ).toContain('shrink-0')
  })
})
