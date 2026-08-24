import { describe, expect, it } from 'vitest'
// @ts-expect-error — script Node en JavaScript, hors du projet TypeScript.
import { analyser, aveuxDeSimulation, dictionnaireAPlat, promessesDeCanal, questionsEnDouble } from '../../scripts/check-i18n.mjs'

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

/**
 * LA TROISIÈME FAMILLE : un libellé qui avoue que son geste ne fait rien.
 *
 * Elle a frappé deux fois — « la création de compte n'est pas encore branchée »,
 * puis « L'enregistrement n'est pas encore branché » — et les deux fois la
 * phrase avait survécu au lot qui branchait la route. Rien ne reliait le texte
 * au code qu'il décrivait, donc rien ne tombait quand ce code changeait.
 *
 * Ces cas tiennent les deux bouts que le garde-fou doit tenir : il attrape la
 * récidive, et il laisse tranquilles les libellés qui parlent d'un ÉTAT du parc
 * plutôt que d'une impuissance du logiciel. C'est cette seconde moitié qui a
 * fait écarter « démonstration », « demo », « pour l'instant » et « not yet » :
 * mesurés, ils totalisent vingt et une occurrences parfaitement justes.
 */
const aveux = aveuxDeSimulation as (
  langue: string,
  dictionnaire: Map<string, string>,
) => { cle: string }[]

const dico = (entrees: Record<string, string>) => new Map(Object.entries(entrees))

describe('garde-fou i18n — les aveux de simulation', () => {
  it('attrape la phrase exacte qui a survécu deux lots', () => {
    const trouves = aveux(
      'fr',
      dico({
        'auth.reset.demoNotice':
          'L’enregistrement n’est pas encore branché : le formulaire valide la saisie, puis affiche l’écran de confirmation.',
      }),
    )
    expect(trouves.map((a) => a.cle)).toEqual(['auth.reset.demoNotice'])
  })

  it('attrape aussi sa première victime, au féminin', () => {
    expect(aveux('fr', dico({ x: 'La création de compte n’est pas encore branchée.' }))).toHaveLength(1)
  })

  it('contrôle l’anglais, qu’on relit moins', () => {
    expect(aveux('en', dico({ x: 'Saving is not yet wired.' }))).toHaveLength(1)
    expect(aveux('en', dico({ y: 'Coming soon.' }))).toHaveLength(1)
  })

  it('laisse passer un ÉTAT du parc, qui n’avoue rien', () => {
    const innocents = dico({
      a: 'Vous parcourez une démonstration : ces immeubles et ces montants sont fictifs.',
      b: 'Action impossible pour l’instant. Rien n’a été enregistré.',
      c: 'Aucun encaissement pour l’instant',
      d: 'Laissez vide s’il n’est pas encore signé : un état des lieux non signé n’engage personne.',
      e: 'Repartir du jeu de démonstration',
    })
    expect(aveux('fr', innocents)).toHaveLength(0)
  })

  it('laisse passer « Not yet quoted », qui décrit un devis absent et non une route absente', () => {
    expect(aveux('en', dico({ x: 'Not yet quoted' }))).toHaveLength(0)
  })
})

/**
 * LE LECTEUR DE DICTIONNAIRE, et le point aveugle qui a failli tout vider.
 *
 * Le garde-fou des aveux a d'abord semblé fonctionner : zéro signalement, et un
 * message vert. Puis la mutation d'épreuve — remettre le bandeau historique
 * dans `fr.ts` — est passée sans un mot. La cause n'était pas dans les motifs
 * mais ici : `dictionnaireAPlat` exigeait la clé et la valeur sur la MÊME ligne,
 * or Prettier renvoie les valeurs longues à la ligne suivante.
 *
 * Mesuré avant correction : 62 entrées françaises et 52 anglaises invisibles —
 * exactement les longues, c'est-à-dire les phrases. Un aveu de simulation étant
 * une explication, le point aveugle recouvrait la classe même qu'on gardait.
 */
const aplat = dictionnaireAPlat as (source: string) => Map<string, string>

describe('garde-fou i18n — le lecteur de dictionnaire', () => {
  it('lit une entrée écrite sur une seule ligne', () => {
    expect(aplat("  a: {\n    b: 'Bonjour',\n  },").get('a.b')).toBe('Bonjour')
  })

  it('lit une entrée REPLIÉE, que Prettier écrit sur deux lignes', () => {
    const source = "  a: {\n    long:\n      'Une phrase assez longue pour être renvoyée à la ligne.',\n  },"
    expect(aplat(source).get('a.long')).toBe('Une phrase assez longue pour être renvoyée à la ligne.')
  })

  it('ne prend pas une ouverture de bloc pour une valeur', () => {
    expect(aplat("  a: {\n    b: 'x',\n  },").has('a')).toBe(false)
  })
})

/**
 * LA QUATRIÈME FAMILLE : « envoyé par SMS », sur un canal qui n'existe pas.
 *
 * Symétrique de la précédente, et plus coûteuse : l'aveu de simulation dit « je
 * n'ai rien fait » quand le geste a lieu, celle-ci dit « c'est parti » quand rien
 * ne part — et le lecteur AGIT dessus. Le bailleur qui lisait « code
 * d'invitation envoyé par SMS » ne transmettait pas le code, et attendait une
 * activation qui ne pouvait pas venir.
 *
 * Ces cas tiennent les deux bouts, comme les précédents. Le motif attrape la
 * tournure qui affirme le départ — participe passé, futur passif — et laisse
 * tranquilles les libellés qui NIENT l'envoi, qui sont les plus nombreux du
 * dictionnaire sur ce mot et les plus honnêtes du produit.
 */
const promesses = promessesDeCanal as (
  langue: string,
  dictionnaire: Map<string, string>,
) => { cle: string }[]

describe('garde-fou i18n — les envois promis sur un canal absent', () => {
  it('attrape la phrase du message de succès, qui affirme au passé', () => {
    const trouves = promesses(
      'fr',
      dico({ 'app.tenants.created': 'Fiche locataire créée · code d’invitation envoyé par SMS' }),
    )
    expect(trouves.map((p) => p.cle)).toEqual(['app.tenants.created'])
  })

  it('attrape aussi le futur, qui promet autant', () => {
    expect(
      promesses('fr', dico({ x: 'Un code d’invitation lui sera envoyé par SMS pour activer son espace.' })),
    ).toHaveLength(1)
    expect(promesses('en', dico({ x: 'An invitation code will be sent by SMS.' }))).toHaveLength(1)
  })

  /**
   * Le produit est honnête sur ce canal PARTOUT ailleurs, et ces phrases-là sont
   * exactement celles qu'un motif sur le mot « SMS » aurait fait tomber. C'est la
   * raison pour laquelle il ne vise que l'affirmation du départ.
   */
  it('laisse passer les libellés qui NIENT l’envoi', () => {
    const honnetes = dico({
      a: 'Aucun SMS n’a été envoyé : transmettez le code vous-même.',
      b: 'Le message se dépose dans l’application. Aucun SMS n’est envoyé.',
      c: 'SMS',
      d: 'Pas encore parti · visible ici seulement',
    })
    expect(promesses('fr', honnetes)).toHaveLength(0)
  })

  /**
   * La seule dérogation, et sa raison : c'est le SERVEUR qui affirme, l'écran ne
   * fait que répéter. `InviteModal` ne rend cette phrase que sur `envoye: true`,
   * et choisit « Aucun SMS n'a été envoyé » sinon.
   */
  it('laisse passer la clé inscrite au registre, dont l’affirmation vient du serveur', () => {
    expect(
      promesses('fr', dico({ 'app.invite.sentBySms': 'Envoyé par SMS au numéro indiqué.' })),
    ).toHaveLength(0)
  })

  it('attrape la même phrase sous une clé NON inscrite', () => {
    expect(promesses('fr', dico({ 'app.autre.notice': 'Envoyé par SMS au numéro indiqué.' }))).toHaveLength(1)
  })

  /**
   * LA PROMESSE DE VITRINE, une tournure que les deux motifs précédents ne
   * couvrent pas : « SMS et e-mail déclenchés à J+1… » n'affirme pas un envoi
   * PASSÉ ou FUTUR PASSIF (« envoyé par SMS », « sera envoyé par SMS ») — elle
   * décrit un calendrier, au présent. C'est exactement la phrase de
   * `marketing.pricing.features.reminders.body`, mesurée fausse tant que
   * `envoyerSms` rend `false` sans fournisseur configuré.
   */
  it('attrape la promesse de calendrier de la page tarifs, en français et en anglais', () => {
    expect(
      promesses(
        'fr',
        dico({ x: 'SMS et e-mail déclenchés à J+1, J+7, J+15. Vous fixez le ton.' }),
      ),
    ).toHaveLength(1)
    expect(
      promesses('en', dico({ x: 'SMS and email triggered at D+1, D+7, D+15. You set the tone.' })),
    ).toHaveLength(1)
  })
})

describe('garde-fou i18n — les aveux ASSUMÉS', () => {
  it('laisse passer une clé inscrite au registre, dont l’aveu est vrai', () => {
    const trouves = aveux(
      'fr',
      dico({
        'app.system.offlineNotice': 'La synchronisation différée n’est pas encore implémentée.',
      }),
    )
    expect(trouves).toHaveLength(0)
  })

  it('attrape la même phrase sous une clé NON inscrite', () => {
    expect(
      aveux('fr', dico({ 'app.autre.notice': 'La chose n’est pas encore implémentée.' })),
    ).toHaveLength(1)
  })
})
