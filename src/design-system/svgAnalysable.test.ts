import { describe, expect, it } from 'vitest'

/**
 * UN SVG QUI NE S'ANALYSE PAS EST UN FICHIER MORT, ET RIEN NE LE DISAIT.
 *
 * ═══ LA FAUTE QUI A ÉTÉ LIVRÉE ═══
 *
 * XML interdit la séquence « deux tirets » À L'INTÉRIEUR d'un commentaire. Une
 * rédaction de `public/logo.svg` y citait deux noms de jetons CSS, qui
 * commencent précisément par deux tirets. Le fichier cessait d'être analysable ;
 * le navigateur, ne pouvant plus le lire, gardait le favicon PRÉCÉDENT en cache
 * — celui d'avant la refonte, l'or — et la porte restait verte : aucune garde ne
 * lisait ces fichiers comme du XML, seulement comme du texte.
 *
 * Le défaut est sournois pour une raison qui n'a rien à voir avec XML : chez
 * l'auteur, l'ancienne vignette reste en cache, donc RIEN NE PARAÎT CASSÉ. Il ne
 * se voit que sur une machine qui découvre le site.
 *
 * ═══ POURQUOI CE FICHIER VIT DU CÔTÉ jsdom ═══
 *
 * Le dépôt sépare deux projets : les gardes du système de conception tournent
 * sous Node — elles lisent des fichiers, elles n'ont pas de DOM — et les cas
 * applicatifs sous jsdom, qui a un DOM mais pas `node:fs`. Vérifier du XML
 * demande les DEUX. On prend donc le côté DOM, et l'on y apporte les fichiers
 * par l'import brut de Vite, comme le fait déjà la garde des chiffres de la
 * vitrine.
 *
 * On ne réécrit PAS un analyseur : un analyseur maison validerait ce qu'il sait
 * déjà vérifier, c'est-à-dire la faute qu'on vient de corriger et rien d'autre.
 */

/** Les ressources de marque, lues telles quelles. */
const SVG = import.meta.glob('../../public/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('les SVG livrés', () => {
  /* GARDE DU GARDE — le glob doit trouver quelque chose. Un chemin qui cesse de
     correspondre viderait la table, et zéro fichier passeraient zéro contrôle. */
  it('sont bien trouvés', () => {
    const noms = Object.keys(SVG).map((c) => c.split('/').pop())
    expect(noms, 'aucun SVG trouvé dans public/').not.toHaveLength(0)
    expect(noms).toContain('logo.svg')
    expect(noms).toContain('logo-monochrome.svg')
  })

  for (const [chemin, source] of Object.entries(SVG)) {
    const nom = chemin.split('/').pop()
    it(`${nom} s’analyse comme du XML`, () => {
      /* `DOMParser` ne lève pas : il rend un document contenant `<parsererror>`.
         Chercher une exception ne verrait donc jamais rien. */
      const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
      const erreur = doc.querySelector('parsererror')
      expect(erreur?.textContent ?? null, `${nom} n’est pas analysable`).toBeNull()
      expect(doc.documentElement.tagName).toBe('svg')
    })
  }

  /*
    GARDE DU GARDE — le contrôle doit savoir refuser.

    Un analyseur qui accepterait tout rendrait les cas ci-dessus vides de sens.
    On lui donne la faute exacte qui est passée, assemblée pour qu'elle ne rende
    pas ce fichier-ci inanalysable à son tour.
  */
  it('saurait refuser la faute qui est passée', () => {
    const fautif = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'--'}color-accent --></svg>`
    const doc = new DOMParser().parseFromString(fautif, 'image/svg+xml')
    expect(doc.querySelector('parsererror')).not.toBeNull()
  })
})
