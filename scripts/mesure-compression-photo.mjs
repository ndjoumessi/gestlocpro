#!/usr/bin/env node
/**
 * CE QUE PÈSE UNE VRAIE PHOTO UNE FOIS COMPRESSÉE PAR LE NAVIGATEUR.
 *
 * `PLAFOND_PAR_OBJET_OCTETS` s'appelait `PLAFOND_DE_TRAVAIL_OCTETS` et valait
 * 8 Mio, venus d'une estimation de ce que pèse une photo de téléphone après
 * passage au canevas. Ce relevé a produit les octets qui l'ont remplacée par
 * 2 Mio ; son tableau est recopié dans le commentaire de la constante, et c'est
 * là que se lit l'arbitrage.
 *
 * Il RELÈVE — il ne tranche pas, et il reste rejouable : le jour où l'on veut
 * mesurer un iPhone, une microfissure ou une scène en basse lumière, c'est ce
 * script qu'on relance, pas une estimation qu'on refait.
 *
 * ─── DEUX ARTEFACTS QU'IL NE FAUT PAS CONFONDRE ───────────────────────────
 *
 * Les photos SOURCES sont des photos personnelles. Elles restent hors du
 * dépôt, et ce script refuse d'écrire quoi que ce soit sous la racine du
 * projet : la garde `refuserDEcrireDansLeDepot` est là pour ça, pas pour la
 * décoration. Une future FIXTURE versionnée — recadrage serré sur la texture
 * seule — est un autre objet, fabriqué à la main et regardé avant commit ;
 * ce script ne la produit pas et ne doit pas prétendre le faire.
 *
 * ─── LES TROIS AXES, ET POURQUOI ILS SONT SÉPARÉS ─────────────────────────
 *
 * POIDS — pour chaque hauteur cible et chaque qualité, les octets que rend
 * `canvas.toBlob('image/jpeg', q)`. C'est le seul chiffre qui décide du
 * plafond, parce que c'est exactement ce que le navigateur enverra.
 *
 * LISIBILITÉ — ne se mesure pas, se REGARDE. Le script écrit chaque rendu sur
 * disque pour qu'un œil humain dise si la fissure se voit encore. Prétendre
 * qu'un PSNR répond à « peut-on lire ce compteur » serait acheter de la
 * confiance sans la mériter.
 *
 * ORIENTATION — mesurée par DIFFÉRENCE entre DEUX LECTEURS, et il a fallu
 * s'y reprendre. La première version comparait deux décodages du navigateur,
 * l'un avec `imageOrientation: 'none'` et l'autre avec `'from-image'` :
 * mesuré sur Chromium 151, les deux rendent les MÊMES dimensions, tout comme
 * `<img>` et `image-orientation: none` en CSS. Il n'existe plus de chemin de
 * décodage qui rende les pixels non tournés ; le détecteur ne pouvait donc
 * rien détecter, et il aurait rendu « rien à tourner » sur une photo tournée.
 *
 * La différence est donc prise entre les OCTETS et le NAVIGATEUR : les
 * dimensions STOCKÉES se lisent dans le marqueur SOF du JPEG côté Node, les
 * dimensions RENDUES viennent du navigateur. Si elles s'échangent, le
 * navigateur a tourné. Le tag EXIF est rendu à part : il dit ce que le fichier
 * DÉCLARE, la différence dit ce que le navigateur FAIT, et ce n'est pas la
 * même question.
 *
 * ─── CE QU'IL NE MESURE PAS ───────────────────────────────────────────────
 *
 *   — le HEIC. Chromium ne le décode pas. Une photo HEIC est SIGNALÉE et
 *     écartée, jamais convertie en douce : une conversion par `sips` avant
 *     mesure ferait peser le résultat de `sips`, pas celui du navigateur ;
 *   — le temps de TRANSMISSION réel. Le script divise les octets par un débit
 *     posé en constante ; c'est une arithmétique, pas un relevé réseau ;
 *   — la mémoire consommée par le canevas sur un téléphone d'entrée de gamme.
 *     Chromium de bureau encode ce qu'un mobile refusera peut-être d'allouer.
 *
 *   node scripts/mesure-compression-photo.mjs [dossier-source] [dossier-sortie]
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici.
 */
import { chromium } from 'playwright'
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { argv, exit, stdout } from 'node:process'

const RACINE = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))

/**
 * LES HAUTEURS, ET POURQUOI CELLES-LÀ.
 *
 * L'échelle descend par pas d'environ 20 % : assez serré pour que la marche où
 * la texture décroche se voie, assez large pour que quinze rendus par photo
 * restent regardables un par un. La hauteur, pas la largeur, parce qu'un état
 * des lieux se photographie en portrait et que c'est la hauteur qui borne.
 */
const HAUTEURS = [2048, 1600, 1280, 1024, 800]

/**
 * LES QUALITÉS JPEG, ET CE QU'ELLES ENCADRENT.
 *
 * 0,9 est au-dessus de ce qu'on retiendra — il sert de plafond de comparaison,
 * pour qu'on voie ce que les deux autres CONCÈDENT. 0,7 est en dessous du
 * confortable, pour la même raison en sens inverse. C'est 0,82 qui est le
 * candidat ; il est mesuré entre deux bornes plutôt que seul, sinon son chiffre
 * ne se compare à rien.
 */
const QUALITES = [0.9, 0.82, 0.7]

/**
 * Débit de référence pour l'arithmétique de transmission — 400 kbit/s.
 *
 * C'est un chantier avec une barre de réseau, pas un bureau en fibre : l'état
 * des lieux se fait dans un logement vide, souvent en sous-sol ou en cage
 * d'escalier. Le chiffre est POSÉ, pas relevé, et le rapport le redit.
 */
const DEBIT_OCTETS_PAR_SECONDE = 400_000 / 8

const EXTENSIONS_LUES = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'])

/**
 * Le dépôt n'accueille aucune sortie de ce script, et la garde le prouve.
 *
 * Un dossier de sortie mal saisi qui tomberait dans `captures/` ou dans un
 * dossier ignoré déposerait des photos personnelles dans l'arbre de travail,
 * où un `git add -A` distrait les emporterait. Le refus est une erreur dure :
 * il n'y a pas de repli raisonnable.
 */
function refuserDEcrireDansLeDepot(dossier) {
  const cible = resolve(dossier)
  if (cible === RACINE || cible.startsWith(RACINE + '/')) {
    throw new Error(
      `Sortie refusée : « ${cible} » est dans le dépôt. Les photos sources et leurs rendus ne sont jamais versionnés.`,
    )
  }
  return cible
}

/**
 * L'orientation DÉCLARÉE, lue dans les octets bruts.
 *
 * Le tag 0x0112 vit dans l'IFD0 du bloc TIFF porté par le segment APP1 d'un
 * JPEG. On le lit à la main plutôt qu'avec une dépendance : le lot ajoute une
 * mesure, pas un paquet au `package.json`, et le parcours tient en trente
 * lignes.
 *
 * Rend `null` quand il n'y a pas d'EXIF du tout — ce qui n'est PAS la même
 * chose que `1`. Un fichier sans EXIF n'a rien déclaré ; un fichier à 1 a
 * déclaré « pas de rotation ». Confondre les deux effacerait la question.
 */
function lireOrientationDeclaree(octets) {
  if (octets[0] !== 0xff || octets[1] !== 0xd8) return null // pas un JPEG
  let i = 2
  while (i + 4 <= octets.length) {
    if (octets[i] !== 0xff) return null
    const marqueur = octets[i + 1]
    if (marqueur === 0xda || marqueur === 0xd9) return null // début des données : plus d'en-têtes
    const taille = octets.readUInt16BE(i + 2)
    if (marqueur === 0xe1 && octets.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      const tiff = i + 10
      const boutier = octets.toString('latin1', tiff, tiff + 2)
      if (boutier !== 'II' && boutier !== 'MM') return null
      const petitBout = boutier === 'II'
      const u16 = (o) => (petitBout ? octets.readUInt16LE(o) : octets.readUInt16BE(o))
      const u32 = (o) => (petitBout ? octets.readUInt32LE(o) : octets.readUInt32BE(o))
      const ifd0 = tiff + u32(tiff + 4)
      const nombre = u16(ifd0)
      for (let n = 0; n < nombre; n += 1) {
        const champ = ifd0 + 2 + n * 12
        if (u16(champ) === 0x0112) return u16(champ + 8)
      }
      return null
    }
    i += 2 + taille
  }
  return null
}

/**
 * Les dimensions STOCKÉES, lues dans le marqueur SOF.
 *
 * C'est la moitié Node de la différence d'orientation : ces nombres sont ceux
 * que le fichier porte réellement, avant que quiconque applique un EXIF. Tous
 * les SOF conviennent (0xC0 à 0xCF), sauf 0xC4, 0xC8 et 0xCC qui portent des
 * tables et non une trame — l'oubli de cette exception ferait lire une taille
 * dans une table de Huffman.
 */
function lireDimensionsStockees(octets) {
  if (octets[0] !== 0xff || octets[1] !== 0xd8) return null
  let i = 2
  while (i + 4 <= octets.length) {
    if (octets[i] !== 0xff) return null
    const marqueur = octets[i + 1]
    if (marqueur === 0xda || marqueur === 0xd9) return null
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
      return { largeur: octets.readUInt16BE(i + 7), hauteur: octets.readUInt16BE(i + 5) }
    }
    i += 2 + octets.readUInt16BE(i + 2)
  }
  return null
}

/** Un HEIC porte « ftyp » suivi d'une marque de marque en position 8. */
function estHeic(octets) {
  if (octets.length < 12) return false
  if (octets.toString('latin1', 4, 8) !== 'ftyp') return false
  const marque = octets.toString('latin1', 8, 12)
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(marque)
}

function humain(octets) {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(2)} Mio`
  return `${(octets / 1024).toFixed(0)} Kio`
}

/**
 * LA MESURE, dans la page.
 *
 * UN SEUL décodage, parce qu'il n'y en a qu'un de disponible : le navigateur
 * applique l'EXIF quoi qu'on lui demande (voir l'en-tête). Ce décodage est de
 * toute façon celui que le vrai téléversement produira, donc c'est bien lui
 * qu'il faut peser.
 *
 * Les rendus reviennent en base64 : c'est du volume sur le canal, mais c'est le
 * seul moyen de les REGARDER, et la lisibilité est le deuxième axe du relevé.
 */
async function mesurerDansLaPage(page, dataUrl, hauteurs, qualites) {
  return page.evaluate(
    async ({ dataUrl, hauteurs, qualites }) => {
      const reponse = await fetch(dataUrl)
      const blob = await reponse.blob()

      const oriente = await createImageBitmap(blob)

      const rendus = []
      for (const hauteur of hauteurs) {
        // Une photo déjà plus petite que la cible n'est jamais AGRANDIE : on
        // mesurerait alors le poids d'un rééchantillonnage inventé.
        const echelle = Math.min(1, hauteur / oriente.height)
        const l = Math.round(oriente.width * echelle)
        const h = Math.round(oriente.height * echelle)
        const canevas = document.createElement('canvas')
        canevas.width = l
        canevas.height = h
        const ctx = canevas.getContext('2d')
        ctx.drawImage(oriente, 0, 0, l, h)
        for (const qualite of qualites) {
          const depart = performance.now()
          const sortie = await new Promise((r) => canevas.toBlob(r, 'image/jpeg', qualite))
          const ms = performance.now() - depart
          const tampon = await sortie.arrayBuffer()
          let binaire = ''
          const vue = new Uint8Array(tampon)
          for (let i = 0; i < vue.length; i += 1) binaire += String.fromCharCode(vue[i])
          rendus.push({
            hauteur,
            qualite,
            largeurRendue: l,
            hauteurRendue: h,
            agrandissementEvite: echelle === 1 && oriente.height < hauteur,
            octets: sortie.size,
            msEncodage: Math.round(ms),
            base64: btoa(binaire),
          })
        }
      }

      return {
        rendu: { largeur: oriente.width, hauteur: oriente.height },
        rendus,
      }
    },
    { dataUrl, hauteurs, qualites },
  )
}

const dossierSource = resolve(argv[2] ?? '/tmp')
const dossierSortie = refuserDEcrireDansLeDepot(argv[3] ?? '/tmp/mesure-compression')

const fichiers = readdirSync(dossierSource)
  .filter((n) => EXTENSIONS_LUES.has(extname(n).toLowerCase()))
  .map((n) => join(dossierSource, n))
  .filter((c) => statSync(c).isFile())

if (fichiers.length === 0) {
  stdout.write(`Aucune photo lisible dans « ${dossierSource} ».\n`)
  stdout.write(`Extensions cherchées : ${[...EXTENSIONS_LUES].join(', ')}\n`)
  exit(1)
}

mkdirSync(dossierSortie, { recursive: true })

const navigateur = await chromium.launch()
const page = await navigateur.newPage()
const releve = []

for (const chemin of fichiers) {
  const octets = readFileSync(chemin)
  const nom = basename(chemin)

  if (estHeic(octets)) {
    stdout.write(`\n${nom} — HEIC. Chromium ne le décode pas ; ÉCARTÉ, pas converti.\n`)
    releve.push({ nom, ecarte: 'heic' })
    continue
  }

  const orientationDeclaree = lireOrientationDeclaree(octets)
  const stockees = lireDimensionsStockees(octets)
  const typeMime =
    extname(chemin).toLowerCase() === '.png'
      ? 'image/png'
      : extname(chemin).toLowerCase() === '.webp'
        ? 'image/webp'
        : 'image/jpeg'
  const dataUrl = `data:${typeMime};base64,${octets.toString('base64')}`

  const mesure = await mesurerDansLaPage(page, dataUrl, HAUTEURS, QUALITES)

  // `null` quand le SOF n'a pas pu être lu : on ne conclut alors NI « tourné »
  // NI « pas tourné », parce que les deux seraient une invention.
  const aTourne =
    stockees === null
      ? null
      : stockees.largeur !== mesure.rendu.largeur || stockees.hauteur !== mesure.rendu.hauteur

  stdout.write(`\n═══ ${nom} ═══\n`)
  stdout.write(`  source            ${humain(octets.length)} (${octets.length} octets)\n`)
  stdout.write(
    `  pixels stockés    ${stockees ? `${stockees.largeur} × ${stockees.hauteur}` : 'SOF illisible'}   (lus dans les octets)\n`,
  )
  stdout.write(
    `  pixels rendus     ${mesure.rendu.largeur} × ${mesure.rendu.hauteur}   (rendus par le navigateur)` +
      `${aTourne === null ? '' : aTourne ? '   ← le navigateur A TOURNÉ l’image' : ''}\n`,
  )
  stdout.write(
    `  EXIF Orientation  ${orientationDeclaree === null ? 'absent (le fichier ne déclare rien)' : orientationDeclaree}` +
      `${orientationDeclaree === 1 ? '   (déclaré, et sans rotation)' : ''}\n`,
  )
  stdout.write(`\n  hauteur  qualité   octets      transmission@400kbit/s   encodage\n`)

  const dossierPhoto = join(dossierSortie, nom.replace(/\.[^.]+$/, ''))
  mkdirSync(dossierPhoto, { recursive: true })

  for (const r of mesure.rendus) {
    const secondes = r.octets / DEBIT_OCTETS_PAR_SECONDE
    stdout.write(
      `  ${String(r.hauteur).padStart(5)}px   ${r.qualite.toFixed(2)}   ` +
        `${humain(r.octets).padStart(9)}   ${secondes.toFixed(1).padStart(8)} s          ` +
        `${String(r.msEncodage).padStart(4)} ms` +
        `${r.agrandissementEvite ? '   (source plus petite : non agrandie)' : ''}\n`,
    )
    writeFileSync(
      join(dossierPhoto, `h${r.hauteur}-q${String(r.qualite).replace('.', '')}.jpg`),
      Buffer.from(r.base64, 'base64'),
    )
  }

  releve.push({
    nom,
    octetsSource: octets.length,
    orientationDeclaree,
    navigateurATourne: aTourne,
    stockees,
    rendu: mesure.rendu,
    rendus: mesure.rendus.map(({ base64: _base64, ...reste }) => reste),
  })
}

await navigateur.close()

writeFileSync(join(dossierSortie, 'releve.json'), `${JSON.stringify(releve, null, 2)}\n`)

stdout.write(`\nRendus et relevé écrits dans « ${dossierSortie} ».\n`)
stdout.write(
  `Le poids est mesuré ; la LISIBILITÉ ne l’est pas — il faut regarder les rendus un par un.\n`,
)
