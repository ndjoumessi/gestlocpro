import { describe, expect, it } from 'vitest'
// @ts-expect-error — script Node en JavaScript, hors du projet TypeScript.
import { analyser, questionsEnDouble } from '../../scripts/check-i18n.mjs'

/**
 * La garde du GARDE-FOU des chaînes écrites en dur.
 *
 * Il a tenu `npm run check` en échec sur une PROSE : sa détection de
 * commentaire ne regardait que le début de ligne, or les commentaires JSX du
 * dépôt s'ouvrent par `{/*` puis continuent en texte nu. « un `<div>` enveloppé
 * d'un `<li>` » se lisait donc comme du texte entre chevrons.
 *
 * Un garde-fou en échec permanent se fait désactiver, et un garde-fou qu'on
 * élargit pour le faire taire ne garde plus rien. Ces cas tiennent les deux
 * bouts : il attrape toujours ce pour quoi il existe, et ne se déclenche plus
 * sur ce qui n'est pas du produit.
 */
const analyse = analyser as (rel: string, source: string) => { value: string }[]

describe('garde-fou i18n — ce qu’il doit attraper', () => {
  it('signale un nom accessible écrit en dur', () => {
    const trouves = analyse('src/x.tsx', '<input aria-label="Indicatif" />')
    expect(trouves.map((f) => f.value)).toEqual(['Indicatif'])
  })

  it('signale du texte français entre chevrons', () => {
    expect(analyse('src/x.tsx', '<th scope="col">Période</th>')).toHaveLength(1)
  })

  it('laisse passer ce qui vient du dictionnaire', () => {
    expect(analyse('src/x.tsx', "<input aria-label={t('app.x')} />")).toHaveLength(0)
  })
})

describe('garde-fou i18n — ce qu’il ne doit PAS attraper', () => {
  /**
   * Le faux positif qui a bloqué la porte du dépôt. La ligne vit à l'intérieur
   * d'un `{/* … *␝/}` ouvert plus haut et ne porte aucun astérisque de marge.
   */
  it('ignore la prose d’un commentaire JSX multiligne', () => {
    const source = [
      '  {/*',
      '    L’option vivait ici dans un `<div>` enveloppé d’un `<li>` nu.',
      '  */}',
      '  <li>{libelle}</li>',
    ].join('\n')
    expect(analyse('src/x.tsx', source)).toHaveLength(0)
  })

  it('ignore un commentaire de bloc tenant sur une seule ligne', () => {
    expect(analyse('src/x.tsx', '/** Rend un `<Link>` interne à la place d’un `<button>`. */')).toHaveLength(0)
  })

  /**
   * Dans un test, un libellé littéral est la FIXTURE qu'on interroge ensuite.
   * Le faire passer par le dictionnaire ferait asserter le test contre
   * lui-même.
   */
  it('exempte les fichiers de test', () => {
    const source = '<input aria-label="Début du bail" />'
    expect(analyse('src/x.test.tsx', source)).toHaveLength(0)
    // …mais la même ligne dans une source reste un défaut.
    expect(analyse('src/x.tsx', source)).toHaveLength(1)
  })

  it('exempte le jeu de démonstration, qui porte des données et non des libellés', () => {
    expect(analyse('src/data/portfolio.ts', '<span>Résidence Bonamoussadi</span>')).toHaveLength(0)
  })
})

/**
 * Le second garde-fou du même fichier : deux QUESTIONS identiques dans un écran.
 *
 * Il est né de deux collisions consécutives — « Devis proposé » pour le statut
 * d'une intervention et pour la nature de son montant, puis « De quoi s'agit-il ? »
 * pour le titre d'un chantier et pour le choix du corps de métier. Aucun outil
 * ne les voyait : le typage garantit que chaque CLÉ existe et qu'elle est
 * traduite, jamais que la chaîne rendue est unique là où on la lit.
 *
 * Ces cas fixent surtout ce qu'il NE doit PAS attraper. Un garde-fou qui crie
 * sur du code sain se fait désactiver, et deux critères plus larges ont été
 * mesurés puis écartés pour cette raison : « valeur unique dans le
 * dictionnaire » rendait 61 doublons presque tous légitimes, « valeur unique
 * par fichier » en rendait 10.
 */
describe('garde-fou i18n — deux questions dans un même écran', () => {
  const DICO = new Map([
    ['app.works.openWhat', 'De quoi s’agit-il ?'],
    ['app.report.trade', 'De quoi s’agit-il ?'],
    ['app.report.what', 'Que se passe-t-il ?'],
    ['app.tenant.colRent', 'Loyer'],
    ['app.tenant.rentFor', 'Loyer'],
  ])

  const chercher = (code: string) =>
    (questionsEnDouble as (d: Map<string, string>, f: [string, string][]) => unknown[])(DICO, [
      ['src/x.tsx', code],
    ])

  it('attrape deux clés qui posent la même question', () => {
    expect(chercher("t('app.works.openWhat') t('app.report.trade')")).toHaveLength(1)
  })

  it('laisse passer deux questions distinctes', () => {
    expect(chercher("t('app.report.what') t('app.report.trade')")).toHaveLength(0)
  })

  /**
   * « Loyer » nomme une carte ET une colonne du même tableau, et c'est le même
   * concept nommé deux fois — pas deux réponses attendues. C'est précisément le
   * faux positif qui a fait écarter le critère « valeur unique par fichier ».
   */
  it('ne dit rien d’un libellé répété qui n’est pas une question', () => {
    expect(chercher("t('app.tenant.colRent') t('app.tenant.rentFor')")).toHaveLength(0)
  })

  /**
   * Deux fichiers, deux écrans : la même question peut y être posée sans que
   * personne ne voie les deux à la fois. C'est le cas de `app.report.trade`,
   * employée par la modale du locataire ET par l'écran Signaler.
   */
  it('ne compare que dans un même fichier', () => {
    const trouve = (questionsEnDouble as (d: Map<string, string>, f: [string, string][]) => unknown[])(
      DICO,
      [
        ['src/a.tsx', "t('app.works.openWhat')"],
        ['src/b.tsx', "t('app.report.trade')"],
      ],
    )
    expect(trouve).toHaveLength(0)
  })
})
