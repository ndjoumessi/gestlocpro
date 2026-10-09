import { describe, expect, it } from 'vitest'
/**
 * LES SOURCES LUES COMME DU TEXTE, par `?raw` — même idiome et même raison que
 * `indicateursEnDouble.test.tsx` : ce cas LIT des sources, et `node:fs`
 * coûterait le projet Node, où `document` n'existe pas.
 */
import ESPACE from '@/app/EspaceApplicatif.tsx?raw'
import APP from '@/App.tsx?raw'

/**
 * LE MORCEAU APPLICATIF DÉPOSE SES PROPRES MOTS.
 *
 * ═══ CE QUE CE CAS TIENT ═══
 *
 * Depuis la scission du 2026-10-09, la section `app` du dictionnaire français
 * vit dans `fr-app.ts`. `check-dictionnaire-impatient.mjs` garde une moitié du
 * contrat : aucun module du paquet d'entrée ne prononce `app.*`. Celui-ci garde
 * l'AUTRE : le morceau qui porte les écrans doit poser leur dictionnaire.
 *
 * Sans ces deux lignes, rien ne casse et la faute se voit à peine : chaque clé
 * s'affiche en toutes lettres — « app.portfolio.title » en titre de page — sur
 * tous les écrans de gestion, jusqu'à ce que quelqu'un ouvre le produit.
 *
 * ═══ POURQUOI IL LIT LA SOURCE PLUTÔT QUE LE COMPORTEMENT ═══
 *
 * Et c'est une limite, pas une préférence. `src/test/setup.ts` dépose ce
 * dictionnaire pour TOUS les cas, parce qu'un composant monté hors de son arbre
 * n'évalue jamais `EspaceApplicatif.tsx` et n'aurait aucun moyen de se le
 * donner. Un cas qui voudrait observer l'absence devrait défaire le dépôt
 * global puis le refaire — il mesurerait son propre montage, pas le produit.
 *
 * La forme compense : le cas n'exige pas une ÉCRITURE mais une PROPRIÉTÉ — le
 * module importe la section ET l'installe.
 */
describe('le morceau applicatif porte ses mots', () => {
  function sansCommentaires(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  }

  it('importe `fr-app` STATIQUEMENT, et l’installe', () => {
    const source = sansCommentaires(ESPACE)

    /* STATIQUE, et le mot porte tout le lot : un `import()` dynamique ferait de
       `fr-app` un morceau de plus, donc un aller-retour de plus pour qui ouvre
       l'application. `poids-ecrans` a refusé cette rédaction-là en ces termes —
       « /demo : 2 → 3 REQUÊTES ». Le motif est écrit dans `I18nProvider`. */
    expect(source, 'le dictionnaire des écrans n’est plus importé statiquement').toMatch(
      /^\s*import \{ frApp \} from '@\/i18n\/fr-app'/m,
    )
    expect(source, 'le dictionnaire est importé mais jamais posé').toMatch(
      /^\s*poserDictionnaireApplicatif\(frApp\)/m,
    )
  })

  it('aucune frontière paresseuse ne le redemande de son côté', () => {
    /* LE REVERS DE LA RÈGLE, et il compte autant que l'endroit : si `App.tsx`
       chargeait `fr-app` par un `import()`, Rollup en referait un morceau
       séparé, et la requête refusée reviendrait par une autre porte. */
    expect(sansCommentaires(APP)).not.toMatch(/import\(\s*['"][^'"]*fr-app['"]/)
  })
})
