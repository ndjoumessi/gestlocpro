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
 * Si le navigateur ne trouve pas Helvetica, il rend une substitution. Arial et
 * Liberation Sans sont métriquement COMPATIBLES — la mesure reste valable, et
 * c'est voulu par leurs auteurs. Une substitution qui ne l'est pas ferait
 * diverger presque tous les caractères à la fois : le script le dit alors comme
 * tel, plutôt que d'accuser les tables d'une faute qui n'est pas la leur. Dans
 * les deux cas il ROUGIT — une mesure impossible ne s'écrit jamais comme une
 * absence de défaut.
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

const navigateur = await chromium.launch()
let mesurees
try {
  const page = await (await navigateur.newContext()).newPage()
  await page.setContent('<canvas></canvas>')
  mesurees = await page.evaluate(
    async ({ premier, nombre, signes, accentuees }) => {
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
      const romaine = serie('1000px Helvetica')
      const grasse = serie('bold 1000px Helvetica')

      /* LA GRAISSE EST REMISE EN ROMAINE avant tout le reste. `serie` laisse la
         fonte du contexte sur son dernier réglage : sans cette ligne, les
         signes et les déductions étaient mesurés en GRASSE, et huit d'entre eux
         paraissaient faux pour cette seule raison. */
      /* Les signes et les déductions sont relevés DANS LES DEUX GRAISSES : la
         table en porte deux valeurs depuis qu'on a mesuré que la moitié de ses
         entrées changent de chasse en gras. */
      const dansLesDeux = (mesure) =>
        ['1000px Helvetica', 'bold 1000px Helvetica'].map((police) => {
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

/* Les signes particuliers : la seule table du haut du jeu, et elle était écrite
   sans qu'aucune mesure ne la contredise. */
const GRAISSES = ['romaine', 'grasse']
const signesFaux = SIGNES.flatMap(({ signe, ecrites }) =>
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

console.log(
  `\n✓ chasses-helvetica : ${comparees} chasses confrontées à la police réelle, deux graisses,\n` +
    `  plus ${SIGNES.length} signes particuliers et ${ACCENTUEES.length} déductions par décomposition.\n` +
    '  Ce script ne dit RIEN de la mise en page — voir son en-tête.',
)
