import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'

/**
 * UN COMMENTAIRE DE CODE S'AFFICHAIT DANS L'INTERFACE.
 *
 * ═══ CE QUI ÉTAIT À L'ÉCRAN ═══
 *
 * Sur `/demo/acces`, chacune des quatre cartes de membre portait, sous l'adresse
 * électronique de la personne, ce texte :
 *
 *   « /* LE NOM DE LA PERSONNE DANS LE NOM ACCESSIBLE — la règle est celle que
 *   `Meters` a écrite pour ses douze boutons « Corriger » … *\/ »
 *
 * Huit lignes de prose technique, en français, dans un produit qu'on montre. Le
 * défaut vient du lot du 2026-09-27 qui a nommé les gestes homonymes : le
 * commentaire expliquant l'`aria-label` a été posé PARMI LES ENFANTS d'un
 * élément JSX, sans accolades. Or `{/* … *\/}` est un commentaire ; `/* … *\/`
 * au même endroit est du TEXTE, et React le rend fidèlement.
 *
 * ═══ POURQUOI RIEN NE L'A VU ═══
 *
 * `tsc` ne bronche pas : c'est du JSX valide. `oxlint` non plus. `check-i18n`
 * cherche des chaînes en dur dans des ATTRIBUTS — `aria-label`, `placeholder`,
 * `title`, `alt` — et celui-ci n'est pas un attribut. `mesure-ui` mesure des
 * contrastes et des débordements, pas le SENS de ce qui est écrit. Et aucun cas
 * de cet écran ne lisait le corps des cartes.
 *
 * Trois portes, une suite de deux mille cas, et huit lignes de code source
 * s'affichaient sur un écran de démonstration.
 *
 * ═══ CE QUE CE CAS GARDE, ET POURQUOI IL EST SI LARGE ═══
 *
 * La faute tient à UN caractère et peut se reproduire partout où l'on commente
 * du JSX — c'est-à-dire, dans ce dépôt, presque partout. Une détection par
 * expression régulière sur les sources rendait deux cent soixante-douze
 * suspects, presque tous des blocs `/**` parfaitement licites entre deux
 * fonctions : un signal noyé dans son propre bruit.
 *
 * On interroge donc le RÉSULTAT et non la source. Un délimiteur de commentaire
 * dans du texte affiché n'a aucune raison légitime d'exister, sur aucun écran,
 * dans aucune langue. C'est la même famille que `parcVide`, qui balaie les
 * écrans pour y refuser « NaN » et « undefined ».
 */

/** Les écrans de la démonstration qui portent des données. */
const ECRANS = [
  '/demo',
  '/demo/parc',
  '/demo/paiements',
  '/demo/releves',
  '/demo/etats-des-lieux',
  '/demo/travaux',
  '/demo/cautions',
  '/demo/locataires',
  '/demo/acces',
  '/demo/signalements',
  '/demo/decisions',
  '/demo/documents',
  '/demo/mon-espace',
  '/demo/portail',
  '/demo/prise-en-main',
  '/demo/systeme',
]

describe('aucun commentaire de code ne s’affiche', () => {
  for (const route of ECRANS) {
    it(`ne rend aucun délimiteur de commentaire sur ${route}`, async () => {
      await renderApp(route)
      await attendreLeChargement()

      /*
        LE TEXTE VISIBLE, et non le HTML : chercher dans `innerHTML` trouverait
        les commentaires HTML légitimes que React pose lui-même, et rendrait ce
        cas rouge sans défaut. `textContent` ne porte que ce qu'on LIT.
      */
      const texte = screen.getByRole('main').textContent ?? ''

      const delimiteurs = ['/*', '*/', '{/*']
      for (const d of delimiteurs) {
        const trouve = texte.includes(d)
        /* L'EXTRAIT DANS LE MESSAGE : sans lui, « contient /* » envoie chercher
           dans un écran entier. Avec, on tombe sur la ligne fautive. */
        const extrait = trouve
          ? texte.slice(Math.max(0, texte.indexOf(d) - 20), texte.indexOf(d) + 90)
          : ''
        expect(trouve, `du code source s’affiche : « …${extrait}… »`).toBe(false)
      }
    })
  }
})
