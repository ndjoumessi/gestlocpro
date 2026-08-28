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
 * ═══ CE QUE CE SCRIPT NE DIT PAS ═══
 *
 * Il ne dit rien de la mise en page : deux tables justes ne garantissent pas
 * qu'une réserve trop longue tienne dans sa colonne — voir
 * `documentDansLaPage.test.tsx`. Il ne dit rien non plus des caractères hors
 * ASCII : la chasse d'une lettre accentuée est déduite de sa lettre nue, et
 * cette déduction-là est une propriété d'Helvetica que le script vérifie sur
 * deux témoins, pas un tableau de plus.
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

const navigateur = await chromium.launch()
let mesurees
try {
  const page = await (await navigateur.newContext()).newPage()
  await page.setContent('<canvas></canvas>')
  mesurees = await page.evaluate(
    async ({ premier, nombre }) => {
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
      return {
        // 1000 pixels de corps : la mesure EST le millième de cadratin.
        romaine: serie('1000px Helvetica'),
        grasse: serie('bold 1000px Helvetica'),
        // Les deux témoins de la déduction par décomposition : dans Helvetica,
        // l'accent ne pousse pas la chasse.
        accentuees: [
          dessin.measureText('é').width,
          (dessin.font = '1000px Helvetica') && dessin.measureText('e').width,
        ],
      }
    },
    { premier: PREMIER, nombre: NOMBRE },
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

/* La déduction par décomposition, sur ses deux témoins : `é` mesure `e`. */
const [accentuee, nue] = mesurees.accentuees
if (Math.abs(accentuee - nue) > TOLERANCE)
  plaintes.push(
    `l’accent pousse la chasse : « é » mesure ${Math.round(accentuee)}, « e » ${Math.round(nue)}.\n` +
      '   `chasse()` déduit la largeur d’une lettre accentuée de sa lettre nue ; cette\n' +
      '   déduction cesse d’être vraie, et il faut une table pour le haut du jeu.',
  )

if (plaintes.length > 0) {
  console.error(`\n✗ chasses-helvetica : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ chasses-helvetica : ${comparees} chasses confrontées à la police réelle, deux graisses.\n` +
    '  Ce script ne dit RIEN de la mise en page ni des caractères hors ASCII — voir son en-tête.',
)
