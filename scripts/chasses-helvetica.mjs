/**
 * LES CHASSES D'HELVETICA, CONFRONTÉES À UNE MESURE INDÉPENDANTE.
 *
 * ═══ CE QU'ON GARDE, ET POURQUOI AUCUNE AUTRE RÈGLE NE LE PEUT ═══
 *
 * `lib/pdf.ts` porte deux tables de quatre-vingt-quinze nombres : la largeur de
 * chaque caractère d'Helvetica, en millièmes de cadratin. Elles ne sont pas un
 * réglage — ce sont les valeurs que TOUT lecteur PDF applique aux polices de
 * base — et l'émetteur s'en sert pour deux choses : caler les montants à droite,
 * et couper une ligne avant qu'elle ne sorte de la colonne.
 *
 * Elles ont été ÉCRITES À LA MAIN, et c'est la réserve qui a fait écrire ce
 * script. Rien dans le dépôt ne pouvait les contredire : `pdf.test.ts` en garde
 * deux valeurs témoins, et `documentDansLaPage` mesure la composition AVEC ces
 * mêmes tables — il ne peut donc pas dire qu'elles sont fausses, seulement qu'à
 * chasses données la page tient. La circularité est écrite dans son en-tête.
 *
 * Un navigateur, lui, mesure la VRAIE police. `measureText` à 1000 pixels rend
 * directement des millièmes de cadratin, sans conversion ni arrondi à faire.
 * C'est la seule source indépendante disponible sans réseau ni dépendance.
 *
 * IL COÛTE UN LANCEMENT DE NAVIGATEUR, ET IL A ÉTÉ MESURÉ : 0,45 à 0,50 s,
 * contre environ trois minutes pour la porte entière — trois millièmes. La page
 * est vide et rien n'est navigué ; c'est le prix d'un `chromium.launch()` seul.
 * La réserve du lot précédent s'inquiétait d'un coût qu'elle n'avait pas
 * chiffré ; le voici.
 *
 * ═══ CE QUE CE SCRIPT NE DIT PAS ═══
 *
 * Il ne dit rien de la mise en page : deux tables justes ne garantissent pas
 * qu'une réserve trop longue tienne dans sa colonne — voir
 * `documentDansLaPage.test.tsx`.
 *
 * ═══ CE QU'IL A FINI PAR DIRE ═══
 *
 * Sa première rédaction s'arrêtait à l'ASCII et laissait DEUX ZONES d'ombre,
 * dites en réserve : la table des signes particuliers — guillemets français,
 * tiret cadratin, degré, espaces insécables —, et la déduction par
 * décomposition, qui donne à `é` la chasse de `e`. La première n'était pas
 * mesurée du tout ; la seconde l'était sur deux témoins.
 *
 * Ces deux zones sont celles où le produit écrit le plus souvent : le
 * dictionnaire est français, `Intl` compose ses milliers avec une espace fine,
 * et le point médian sépare les segments d'une ligne de versement. Elles sont
 * mesurées comme le reste.
 *
 * ═══ UNE POLICE ABSENTE N'EST PAS UNE TABLE JUSTE ═══
 *
 * Si le navigateur ne trouve pas Helvetica, il rend une substitution. Cette
 * phrase-ci disait ensuite : « Arial et Liberation Sans sont métriquement
 * COMPATIBLES, la mesure reste valable ». ELLE ÉTAIT FAUSSE, et l'intégration
 * continue l'a démontrée trois exécutions de suite — « · » à 333 au lieu de 278,
 * « € » à 556 au lieu de 744. La compatibilité vaut pour l'ASCII, où elle est
 * totale ; elle ne vaut pas pour la table des signes particuliers, qui est
 * arrivée dans ce script APRÈS que la phrase a été écrite, et que personne n'a
 * rouverte.
 *
 * Ce que le script fait maintenant : il MESURE quelle famille lui a été servie,
 * et n'affirme que ce que cette famille peut témoigner. Le détail, les nombres
 * et les deux glyphes concernés sont au-dessus de `SIGNATURES`.
 *
 * Une substitution qui n'est compatible sur rien fait diverger presque tous les
 * caractères à la fois : le script le dit alors comme tel, plutôt que d'accuser
 * les tables d'une faute qui n'est pas la leur. Dans ce cas il ROUGIT — une
 * mesure impossible ne s'écrit jamais comme une absence de défaut.
 *
 * ═══ LE COMMUTATEUR ═══
 *
 *   MESURER_SANS_HELVETICA=1 node scripts/chasses-helvetica.mjs
 *
 * Demande Arial, donc reproduit ici, en une seconde, ce que rend un exécuteur
 * sans Helvetica. Il a été écrit AVANT le correctif et a rendu les quatre mêmes
 * lignes que l'intégration continue, au nombre près.
 */

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = readFileSync(join(RACINE, 'src/lib/pdf.ts'), 'utf8')

/** Le premier caractère mesuré, et le dernier : l'espace et le tilde. */
const PREMIER = 0x20
const DERNIER = 0x7e
const NOMBRE = DERNIER - PREMIER + 1

/**
 * La tolérance, en millièmes.
 *
 * `measureText` rend un flottant, et une chasse d'Helvetica est un entier à
 * 1000 pixels. Un millième absorbe l'arrondi de la composition sans laisser
 * passer une valeur fausse : les écarts réels entre deux polices se comptent en
 * dizaines.
 */
const TOLERANCE = 1

/** Au-delà, ce n'est plus la table qui est en cause, c'est la police servie. */
const PART_DIVERGENTE_SUSPECTE = 0.5

function tableDeLaSource(nom) {
  const trouve = new RegExp(`const ${nom} =\\s*\\n?\\s*'([^']+)'`).exec(SOURCE)
  if (!trouve) throw new Error(`table introuvable dans lib/pdf.ts : ${nom}`)
  const valeurs = trouve[1].split(' ').map(Number)
  if (valeurs.length !== NOMBRE)
    throw new Error(`${nom} porte ${valeurs.length} valeurs pour ${NOMBRE} attendues`)
  if (valeurs.some((v) => !Number.isFinite(v)))
    throw new Error(`${nom} porte une valeur illisible`)
  return valeurs
}

const ECRITES = {
  romaine: tableDeLaSource('ROMAINE'),
  grasse: tableDeLaSource('GRASSE'),
}

/**
 * La table des signes que la décomposition ne sait pas ramener à une lettre.
 *
 * Relue dans la source plutôt que recopiée ici : une seconde liste dériverait
 * de la première au premier signe ajouté, et c'est exactement le genre de
 * divergence que ce dépôt paie ailleurs.
 */
function signesParticuliers() {
  const bloc = /const CHASSES_PARTICULIERES: Record<string, readonly \[number, number\]> = \{([\s\S]*?)\n\}/.exec(
    SOURCE,
  )
  if (!bloc) throw new Error('table des signes particuliers introuvable dans lib/pdf.ts')
  const trouves = [...bloc[1].matchAll(/'(?:(.)|\\u([0-9a-f]{4}))': \[(\d+), (\d+)\],/g)].map(
    ([, litteral, point, romaine, grasse]) => {
      const signe = litteral ?? String.fromCharCode(parseInt(point, 16))
      return {
        signe,
    /*
      CE QUI SERA RÉELLEMENT TRACÉ, et ce n'est pas toujours le signe d'entrée.

      `versWinAnsi` REMAPPE les deux espaces insécables — la fine et l'ordinaire
      — sur l'unique espace insécable de WinAnsi. C'est donc la chasse de
      celle-là qu'un lecteur appliquera, et non celle de l'espace fine, que le
      navigateur mesure pourtant volontiers à 139 millièmes. Comparer le signe
      d'entrée reviendrait à mesurer un glyphe qui ne sera jamais tracé.
    */
        trace: signe === '\u202f' ? '\u00a0' : signe,
        ecrites: [Number(romaine), Number(grasse)],
      }
    },
  )
  if (trouves.length < 15)
    throw new Error(`${trouves.length} signe(s) relu(s) : le motif ne reconnaît plus la table`)
  return trouves
}

const SIGNES = signesParticuliers()

/**
 * Les lettres accentuées du latin-1, celles dont la chasse est DÉDUITE.
 *
 * `chasse()` ramène chacune à sa lettre nue par décomposition canonique, sans
 * table — c'est vrai d'Helvetica, où l'accent ne pousse pas la chasse. « Vrai »
 * était jusqu'ici une affirmation vérifiée sur `é` et `À`. On les prend toutes.
 */
const ACCENTUEES = Array.from({ length: 0x100 - 0xc0 }, (_, i) => String.fromCharCode(0xc0 + i))
  .filter((lettre) => /[a-z]/i.test(lettre.normalize('NFD')[0]))
  /* Celles que la table NOMME ne sont plus déduites : les quatre `i` accentués
     y sont, parce que l'accent y remplace le point et élargit le glyphe. Les
     laisser ici ferait rougir la règle sur l'exception qu'elle a fait écrire. */
  .filter((lettre) => !SIGNES.some((s) => s.signe === lettre))

/**
 * LA FAMILLE QU'ON DEMANDE AU NAVIGATEUR — et le commutateur qui joue l'autre.
 *
 * `MESURER_SANS_HELVETICA=1` demande Arial à la place. Ce n'est pas un caprice :
 * c'est ce que l'exécuteur Ubuntu SERT déjà quand on lui demande Helvetica,
 * qu'il n'a pas — il substitue Liberation Sans, métriquement calée sur Arial.
 * Le commutateur reproduit donc ici, en une seconde, le verdict qu'on n'obtenait
 * qu'en poussant. Même geste que `MESURER_EN_POLICE_LARGE`, même raison.
 */
const FAMILLE_DEMANDEE = process.env.MESURER_SANS_HELVETICA === '1' ? 'Arial' : 'Helvetica'

const navigateur = await chromium.launch()
let mesurees
try {
  const page = await (await navigateur.newContext()).newPage()
  await page.setContent('<canvas></canvas>')
  mesurees = await page.evaluate(
    async ({ premier, nombre, signes, accentuees, famille }) => {
      // Les polices d'abord : une mesure prise avant leur disponibilité serait
      // celle de la substitution, c'est-à-dire la mauvaise réponse à la bonne
      // question. La leçon est celle de `plafond-coquille`.
      await document.fonts.ready
      const dessin = document.querySelector('canvas').getContext('2d')
      const serie = (police) => {
        dessin.font = police
        return Array.from(
          { length: nombre },
          (_, i) => dessin.measureText(String.fromCharCode(premier + i)).width,
        )
      }
      // 1000 pixels de corps : la mesure EST le millième de cadratin.
      const romaine = serie(`1000px ${famille}`)
      const grasse = serie(`bold 1000px ${famille}`)

      /* LA GRAISSE EST REMISE EN ROMAINE avant tout le reste. `serie` laisse la
         fonte du contexte sur son dernier réglage : sans cette ligne, les
         signes et les déductions étaient mesurés en GRASSE, et huit d'entre eux
         paraissaient faux pour cette seule raison. */
      /* Les signes et les déductions sont relevés DANS LES DEUX GRAISSES : la
         table en porte deux valeurs depuis qu'on a mesuré que la moitié de ses
         entrées changent de chasse en gras. */
      const dansLesDeux = (mesure) =>
        [`1000px ${famille}`, `bold 1000px ${famille}`].map((police) => {
          dessin.font = police
          return mesure()
        })

      return {
        romaine,
        grasse,
        signes: dansLesDeux(() =>
          Object.fromEntries(signes.map(([source, trace]) => [source, dessin.measureText(trace).width])),
        ),
        deductions: dansLesDeux(() =>
          Object.fromEntries(
            accentuees.map((lettre) => [
              lettre,
              [dessin.measureText(lettre).width, dessin.measureText(lettre.normalize('NFD')[0]).width],
            ]),
          ),
        ),
      }
    },
    {
      premier: PREMIER,
      nombre: NOMBRE,
      signes: SIGNES.map((s) => [s.signe, s.trace]),
      accentuees: ACCENTUEES,
      famille: FAMILLE_DEMANDEE,
    },
  )
} finally {
  await navigateur.close()
}

const plaintes = []
let comparees = 0

for (const [graisse, ecrites] of Object.entries(ECRITES)) {
  const divergentes = []
  for (let i = 0; i < NOMBRE; i++) {
    comparees++
    const ecart = Math.abs(mesurees[graisse][i] - ecrites[i])
    if (ecart > TOLERANCE)
      divergentes.push({
        caractere: String.fromCharCode(PREMIER + i),
        ecrite: ecrites[i],
        mesuree: Math.round(mesurees[graisse][i]),
      })
  }

  if (divergentes.length === 0) continue

  if (divergentes.length / NOMBRE > PART_DIVERGENTE_SUSPECTE) {
    plaintes.push(
      `${graisse} : ${divergentes.length} caractères sur ${NOMBRE} divergent.\n` +
        '   Ce n’est pas la table, c’est la POLICE : le navigateur n’a pas servi Helvetica\n' +
        '   ni une substitution métriquement compatible. La mesure est impossible ici, et\n' +
        '   une mesure impossible ne s’écrit pas comme une absence de défaut.',
    )
    continue
  }

  const detail = divergentes
    .map((d) => `« ${d.caractere} » écrit ${d.ecrite}, mesuré ${d.mesuree}`)
    .join('\n     · ')
  plaintes.push(
    `${graisse} : ${divergentes.length} chasse(s) fausse(s).\n     · ${detail}\n` +
      '   Un montant calé à droite tombe à côté, et une ligne coupée sur cette largeur\n' +
      '   sort de sa colonne. Corrigez la table de `lib/pdf.ts`, jamais la mesure.',
  )
}

/* GARDE DE LA GARDE : une évaluation qui ne rendrait rien laisserait la boucle
   vide et le script vert, sans avoir comparé un seul caractère. */
if (comparees !== 2 * NOMBRE)
  plaintes.push(`${comparees} chasse(s) comparée(s) pour ${2 * NOMBRE} attendue(s).`)

const GRAISSES = ['romaine', 'grasse']

/**
 * QUELLE HELVETICA LE NAVIGATEUR A-T-IL SERVIE, ET CE QU'ELLE PEUT TÉMOIGNER.
 *
 * ═══ LE DÉFAUT QUE CECI RÉPARE, ET COMBIEN DE TEMPS IL A COURU ═══
 *
 * Trois exécutions de l'intégration continue de suite ont rougi ici, sur QUATRE
 * lignes : « · » écrit 278 mesuré 333, « € » écrit 744 mesuré 556, dans les deux
 * graisses. L'exécuteur Ubuntu n'a PAS Helvetica — personne ne l'a, elle est
 * propriétaire — et sert Liberation Sans, calée sur les métriques d'Arial.
 *
 * L'en-tête de ce fichier affirmait : « Arial et Liberation Sans sont
 * métriquement COMPATIBLES, la mesure reste valable ». C'est vrai de l'ASCII, et
 * FAUX de deux signes du haut du jeu. L'affirmation datait d'un temps où ce
 * script s'arrêtait à l'ASCII ; la table des signes est arrivée après, et
 * personne n'a rouvert la phrase.
 *
 * La garde de substitution ne rattrapait rien : elle attend qu'une PART du jeu
 * diverge, et deux caractères sur quatre-vingt-quinze passent sous son seuil.
 * Une incompatibilité PARTIELLE ne ressemble pas à une substitution.
 *
 * ═══ CE QUE CHAQUE FAMILLE PEUT DIRE, MESURÉ LE 2026-08-30 ═══
 *
 *   95 chasses ASCII × 2 graisses     0 divergence entre Helvetica et Arial
 *   22 des 24 signes particuliers     0 divergence
 *   31 déductions par décomposition   0 fausse chez Arial
 *   « · » et « € »                    LES SEULS QU'ARIAL NE PEUT PAS TÉMOIGNER
 *
 * Deux glyphes sur cent cinquante. On ne renonce donc pas à la porte sur une
 * machine sans Helvetica : on renonce à DEUX LIGNES, et on le dit.
 *
 * ═══ POURQUOI ON NE COMPARE PAS À LA TABLE D'ARIAL ═══
 *
 * Parce que le produit n'écrit pas de l'Arial. `lib/pdf.ts` déclare Helvetica
 * dans le document, et c'est la table AFM d'Helvetica que TOUT lecteur PDF
 * appliquera. Confronter la table à des chasses d'Arial vérifierait qu'elle est
 * une bonne table d'Arial — une phrase vraie et sans emploi.
 *
 * ═══ LE NOM DE LA POLICE NE FAIT PAS FOI ═══
 *
 * On ne demande pas au navigateur ce qu'il a servi, on le MESURE. « · » et « € »
 * suffisent à séparer les deux familles, et les quatre nombres ci-dessous sont
 * des relevés : si une version future de Chromium changeait l'un d'eux, la
 * famille deviendrait INCONNUE et la porte refuserait, au lieu de comparer sans
 * savoir contre quoi.
 */
const SIGNATURES = {
  helvetica: { '·': [278, 278], '€': [744, 744] },
  arial: { '·': [333, 333], '€': [556, 556] },
}

/** Les signes qu'une famille ne peut pas témoigner : ceux où elle diffère. */
const HORS_TEMOIGNAGE = { helvetica: [], arial: ['·', '€'] }

function familleServie() {
  for (const [nom, signature] of Object.entries(SIGNATURES)) {
    const colle = Object.entries(signature).every(([signe, valeurs]) =>
      valeurs.every((v, i) => Math.abs(mesurees.signes[i][signe] - v) <= TOLERANCE),
    )
    if (colle) return nom
  }
  return 'inconnue'
}

const FAMILLE = familleServie()

if (FAMILLE === 'inconnue')
  plaintes.push(
    'la POLICE SERVIE n’est ni Helvetica ni une famille calée sur Arial.\n' +
      `     · « · » mesuré ${Math.round(mesurees.signes[0]['·'])}, attendu 278 (Helvetica) ou 333 (Arial)\n` +
      `     · « € » mesuré ${Math.round(mesurees.signes[0]['€'])}, attendu 744 (Helvetica) ou 556 (Arial)\n` +
      '   La mesure est impossible ici : on ne sait pas contre quelle police on compare,\n' +
      '   et une mesure impossible ne s’écrit jamais comme une absence de défaut.',
  )

/* Les signes particuliers : la seule table du haut du jeu, et elle était écrite
   sans qu'aucune mesure ne la contredise. */
const NON_TEMOIGNES = FAMILLE === 'inconnue' ? [] : HORS_TEMOIGNAGE[FAMILLE]
const signesFaux = SIGNES.filter(({ signe }) => !NON_TEMOIGNES.includes(signe)).flatMap(
  ({ signe, ecrites }) =>
    GRAISSES.flatMap((nom, i) =>
      Math.abs(mesurees.signes[i][signe] - ecrites[i]) > TOLERANCE
        ? [
            `« ${signe} » en ${nom} : écrit ${ecrites[i]}, mesuré ${Math.round(mesurees.signes[i][signe])}`,
          ]
        : [],
    ),
)

if (signesFaux.length > 0)
  plaintes.push(
    `signes particuliers : ${signesFaux.length} chasse(s) fausse(s).\n     · ` +
      signesFaux.join('\n     · ') +
      '\n   Ce sont les signes que le produit écrit le plus — guillemets, tiret cadratin,\n' +
      '   espace fine des milliers. Corrigez `CHASSES_PARTICULIERES`, jamais la mesure.',
  )

/*
  LA DÉDUCTION PAR DÉCOMPOSITION, sur TOUTES les accentuées du latin-1.

  `chasse()` ramène `é` à `e` sans table, au motif que l'accent ne pousse pas la
  chasse dans Helvetica. C'était vrai de deux témoins ; on le demande des
  trente-et-une.
*/
const deductionsFausses = GRAISSES.flatMap((nom, i) =>
  Object.entries(mesurees.deductions[i])
    .filter(([, [accentuee, nue]]) => Math.abs(accentuee - nue) > TOLERANCE)
    .map(
      ([lettre, [accentuee, nue]]) =>
        `« ${lettre} » en ${nom} mesure ${Math.round(accentuee)}, sa lettre nue ${Math.round(nue)}`,
    ),
)

if (deductionsFausses.length > 0)
  plaintes.push(
    `déduction par décomposition : ${deductionsFausses.length} lettre(s) en défaut.\n     · ` +
      deductionsFausses.join('\n     · ') +
      '\n   `chasse()` déduit la largeur d’une lettre accentuée de sa lettre nue. La\n' +
      '   déduction cesse d’être vraie : il faut une table pour ces lettres-là.',
  )

/* GARDE DE LA GARDE, seconde moitié : un jeu vide passerait sans rien mesurer. */
if (ACCENTUEES.length < 25 || SIGNES.length < 15)
  plaintes.push(
    `${ACCENTUEES.length} accentuée(s) et ${SIGNES.length} signe(s) : le jeu s’est vidé.`,
  )

if (plaintes.length > 0) {
  console.error(`\n✗ chasses-helvetica : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

/*
  CE QUI N'A PAS ÉTÉ TÉMOIGNÉ SE DIT DANS LE RAPPORT, ET NON DANS UN COMMENTAIRE.

  Une porte qui rétrécit sur certaines machines et rend le même « ✓ » que
  partout ailleurs est un piège : elle apprend à lire un vert qui ne couvre plus
  ce qu'il couvrait. Le compte des signes comparés BAISSE visiblement, et les
  glyphes écartés sont nommés un par un.

  Ces deux-là ne sont pas perdus pour autant : ils SONT témoignés sur toute
  machine portant une vraie Helvetica — la machine de développement en est une,
  et `npm run chasses` y compare les vingt-quatre. Ce que l'exécuteur ne peut
  pas dire, quelqu'un d'autre le dit.
*/
const temoignes = SIGNES.length - NON_TEMOIGNES.length
console.log(
  `\n✓ chasses-helvetica : ${comparees} chasses confrontées à la police réelle, deux graisses,\n` +
    `  plus ${temoignes} signes particuliers et ${ACCENTUEES.length} déductions par décomposition.\n` +
    `  Police servie : ${FAMILLE === 'helvetica' ? 'une vraie Helvetica' : 'une famille calée sur Arial (Helvetica est absente ici)'}.` +
    (NON_TEMOIGNES.length > 0
      ? `\n  NON TÉMOIGNÉS sur cette machine : ${NON_TEMOIGNES.map((s) => `« ${s} »`).join(', ')} —\n` +
        `  Arial diffère d'Helvetica sur ces ${NON_TEMOIGNES.length} glyphes, et c'est Helvetica que le PDF\n` +
        '  déclare. Ils sont comparés là où une vraie Helvetica est installée.'
      : '') +
    '\n  Ce script ne dit RIEN de la mise en page — voir son en-tête.',
)
