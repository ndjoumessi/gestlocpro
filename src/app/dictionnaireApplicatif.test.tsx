import { describe, expect, it } from 'vitest'
/**
 * LES SOURCES LUES COMME DU TEXTE, par `?raw` — même idiome et même raison que
 * `indicateursEnDouble.test.tsx` : ce cas LIT des sources, et `node:fs`
 * coûterait le projet Node, où `document` n'existe pas.
 */
import ESPACE from '@/app/EspaceApplicatif.tsx?raw'
import APP from '@/App.tsx?raw'
import EN from '@/i18n/en.ts?raw'
import JURIDIQUES from '@/routes/PagesJuridiques.tsx?raw'

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

  /**
   * ═══ L'ANGLAIS SUIT LA RÈGLE INVERSE, ET C'EST VOULU ═══
   *
   * `fr-app` DOIT être importé statiquement ici ; `en-app` ne doit JAMAIS
   * l'être. Ce n'est pas une incohérence : c'est la même visée — que personne
   * ne télécharge des mots qu'il ne lira pas.
   *
   * Le français est la langue par défaut, ses mots partent donc dans le morceau
   * applicatif que tout utilisateur télécharge. Un import statique de `en-app`
   * au même endroit mettrait les mots ANGLAIS dans ce même morceau : chaque
   * utilisateur FRANÇAIS paierait ~24 Ko compressés pour une langue qu'il n'a
   * pas demandée — l'exact inverse du lot qui a créé `en-app.ts`.
   *
   * Et rien dans le typage ne le dit. `import { enApp } from '@/i18n/en-app'`
   * compile, passe la revue, et ne se voit qu'au relevé de poids.
   */
  it('n’importe JAMAIS `en-app`, ni statiquement ni autrement', () => {
    const source = sansCommentaires(ESPACE)

    expect(
      source,
      'les mots anglais voyageraient dans le morceau que les francophones téléchargent',
    ).not.toMatch(/['"][^'"]*en-app['"]/)
  })

  it('`en.ts` ne rapatrie pas sa propre moitié', () => {
    /* LA SECONDE VOIE PAR LAQUELLE LA SCISSION SE DÉFERAIT, et la plus
       silencieuse : si `en.ts` importait `en-app`, Rollup fusionnerait les deux
       dans le morceau anglais et le visiteur de la vitrine retéléchargerait
       tout. Aucune porte de poids ne mesure l'anglais — c'est ce cas-ci, et lui
       seul, qui tient la frontière. */
    expect(sansCommentaires(EN), 'la scission anglaise serait annulée').not.toMatch(
      /['"][^'"]*en-app['"]/,
    )
  })

  it('la moitié anglaise est jointe à la promesse de l’espace applicatif', () => {
    /* CE QUI REND LA REQUÊTE GRATUITE EN TEMPS. Les deux partent dans le même
       battement, derrière l'attente qui existait déjà ; le morceau applicatif
       pèse 6,4 fois plus, donc c'est lui qui décide. Séparées, la moitié
       anglaise deviendrait un aller-retour SÉRIALISÉ — et le produit afficherait
       un tableau de bord sans texte le temps qu'elle arrive, `t()` rendant `''`
       pour une clé absente. */
    expect(sansCommentaires(APP), 'la moitié anglaise n’est plus jointe').toMatch(
      /signalerEspaceApplicatif\(\)/,
    )
  })

  /**
   * ═══ LA FRONTIÈRE JURIDIQUE SUIT LES MÊMES RÈGLES ═══
   *
   * Les trois pages juridiques et leurs mots ont quitté le paquet d'entrée le
   * 2026-10-10 : `/` y a gagné 7 167 octets sur le fil, 143 ms à 400 kb/s. Le
   * montage est celui de l'espace applicatif, mot pour mot — une barrique de
   * réexports nommés qui importe `fr-legal` STATIQUEMENT et le dépose, et la
   * moitié anglaise jointe à la promesse du morceau.
   *
   * CE QUI LE DÉFERAIT SANS BRUIT : un import statique d'une des trois pages
   * depuis `App.tsx` les ramènerait toutes dans le paquet d'entrée, et rien ne
   * rougirait — ni le typage, ni les cas, ni le budget d'octets tant que la
   * marge tient.
   */
  it('la barrique importe `fr-legal` STATIQUEMENT, et l’installe', () => {
    const source = sansCommentaires(JURIDIQUES)

    expect(source, 'les mots juridiques ne voyagent plus avec leurs pages').toMatch(
      /^\s*import \{ frLegal \} from '@\/i18n\/fr-legal'/m,
    )
    expect(source, 'les mots sont importés mais jamais posés').toMatch(
      /^\s*poserSectionFrancaise\(frLegal\)/m,
    )
  })

  it('la barrique n’importe JAMAIS `en-legal`', () => {
    /* MÊME RAISON QUE POUR `en-app` : un import statique mettrait les mots
       ANGLAIS dans le morceau que les francophones téléchargent. */
    expect(sansCommentaires(JURIDIQUES)).not.toMatch(/['"][^'"]*en-legal['"]/)
  })

  it('`App.tsx` n’importe aucune des trois pages statiquement', () => {
    const source = sansCommentaires(APP)

    for (const page of ['MentionsLegales', 'Confidentialite', 'ConditionsGenerales']) {
      expect(source, `${page} est redevenue impatiente`).not.toMatch(
        new RegExp(`^\\s*import \\{ ${page} \\} from`, 'm'),
      )
    }
  })

  it('la moitié juridique anglaise est jointe à la promesse du morceau', () => {
    expect(sansCommentaires(APP), 'la moitié juridique anglaise n’est plus jointe').toMatch(
      /signalerPagesJuridiques\(\)/,
    )
  })
})
