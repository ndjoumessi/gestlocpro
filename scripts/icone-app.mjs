import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * L'ICÔNE D'APPLICATION, 1024 px, REGÉNÉRABLE.
 *
 * ═══ POURQUOI UN SCRIPT PLUTÔT QU'UN FICHIER DÉPOSÉ ═══
 *
 * Une icône binaire commitée est un fichier que personne ne peut relire : on ne
 * sait ni de quel tracé elle vient, ni si elle a suivi la marque quand celle-ci a
 * changé. Le dépôt vient précisément de vivre ce défaut à l'échelle du favicon,
 * qui peignait encore l'or d'avant la refonte. Ici, le tracé EST le script, et
 * `faviconSuitLaMarque.test.ts` compare ses valeurs à celles du composant.
 *
 * ═══ POURQUOI ON RASTÉRISE À LA MAIN ═══
 *
 * Le dépôt n'embarque aucun rastériseur — pas de `sharp`, pas de `canvas` — et en
 * ajouter un pour quatre carrés arrondis serait une dépendance de production pour
 * un fichier généré une fois par an. La forme est assez simple pour être calculée :
 * un rectangle arrondi se teste par la distance au centre du coin le plus proche.
 *
 * `ECHANTILLONS = 4` : quatre sous-pixels par axe, seize par pixel. C'est ce qui
 * donne l'anticrénelage — sans lui, les rayons de 2 unités sortiraient en escalier
 * à 1024 px. Seize niveaux suffisent : au-delà, l'écart tombe sous le pas d'un
 * canal de 8 bits.
 *
 * ═══ NI RAYON NI TRANSPARENCE, ET C'EST LA DIFFÉRENCE AVEC LE FAVICON ═══
 *
 * iOS et Android posent LEUR masque sur l'icône qu'on leur donne. Une icône déjà
 * arrondie se retrouve composée sur du noir dans ses coins — le défaut classique.
 * On rend donc un carré plein, sans canal alpha, et le système découpe.
 */

/**
 * LES TROIS CÔTÉS, ET POURQUOI CE N'EST PLUS UN SEUL.
 *
 * 1024 servait l'`apple-touch-icon`, seul consommateur d'icône du produit tant
 * qu'il n'y avait pas de manifeste. Un manifeste en réclame deux autres : 192
 * est la taille qu'Android pose sur l'écran d'accueil, 512 celle qu'il emploie
 * pour l'écran de démarrage et les grandes densités. Les servir depuis le 1024
 * par redimensionnement du navigateur donnerait un tracé mou — ces carrés ont
 * des bords droits et un arrondi de 2 unités sur 32, ce qu'un rééchantillonnage
 * approximatif salit tout de suite.
 *
 * On les REND donc, à leur taille, avec le même antialiasage. Le fichier reste
 * un générateur : aucune de ces trois images n'est relue par un humain, et
 * `faviconSuitLaMarque.test.ts` vérifie que le manifeste ne cite que des tailles
 * qui sortent d'ici.
 */
const COTES = [192, 512, 1024]
const ECHANTILLONS = 4

/** Le tracé, dans les 32 unités de la marque — voir `public/logo.svg`. */
const ACCENT = [0x25, 0x63, 0xeb]
const SUR_ACCENT = [0xff, 0xff, 0xff]
const CARRES = [
  { x: 6.9, y: 6.9, c: 7.6, r: 2, opacite: 1 },
  { x: 17.5, y: 6.9, c: 7.6, r: 2, opacite: 1 },
  { x: 6.9, y: 17.5, c: 7.6, r: 2, opacite: 0.55 },
  { x: 17.5, y: 17.5, c: 7.6, r: 2, opacite: 0.22 },
]

/** `true` si le point (u,v), en unités de 32, tombe dans le carré arrondi. */
function dansLeCarre(u, v, { x, y, c, r }) {
  if (u < x || u > x + c || v < y || v > y + c) return false
  // Le coin le plus proche, ramené au centre de son arrondi.
  const cx = u < x + r ? x + r : u > x + c - r ? x + c - r : u
  const cy = v < y + r ? y + r : v > y + c - r ? y + c - r : v
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}

function pixels(cote) {
  const donnees = Buffer.alloc(cote * cote * 3)
  const pas = 32 / cote / ECHANTILLONS
  for (let ligne = 0; ligne < cote; ligne++) {
    for (let colonne = 0; colonne < cote; colonne++) {
      /* La couverture de chaque carré, accumulée séparément : deux carrés ne se
         chevauchent jamais dans ce tracé, mais les additionner sans distinguer
         leurs opacités mélangerait un carré plein avec un carré à 0,22. */
      let couverture = 0
      for (const carre of CARRES) {
        let touches = 0
        for (let sl = 0; sl < ECHANTILLONS; sl++) {
          for (let sc = 0; sc < ECHANTILLONS; sc++) {
            const u = (colonne * ECHANTILLONS + sc + 0.5) * pas
            const v = (ligne * ECHANTILLONS + sl + 0.5) * pas
            if (dansLeCarre(u, v, carre)) touches++
          }
        }
        couverture += (touches / (ECHANTILLONS * ECHANTILLONS)) * carre.opacite
      }
      const base = (ligne * cote + colonne) * 3
      for (let canal = 0; canal < 3; canal++) {
        donnees[base + canal] = Math.round(
          SUR_ACCENT[canal] * couverture + ACCENT[canal] * (1 - couverture),
        )
      }
    }
  }
  return donnees
}

/* ── Encodage PNG : signature, IHDR, IDAT, IEND ────────────────────────────
   Chaque bloc porte sa longueur, son nom, ses données et un CRC32. Le format
   est petit ; l'écrire évite une dépendance pour un fichier généré à la main. */
const TABLE_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const octet of buf) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloc(nom, donnees) {
  const longueur = Buffer.alloc(4)
  longueur.writeUInt32BE(donnees.length)
  const corps = Buffer.concat([Buffer.from(nom, 'ascii'), donnees])
  const somme = Buffer.alloc(4)
  somme.writeUInt32BE(crc32(corps))
  return Buffer.concat([longueur, corps, somme])
}

function png(donnees, cote) {
  const entete = Buffer.alloc(13)
  entete.writeUInt32BE(cote, 0)
  entete.writeUInt32BE(cote, 4)
  entete[8] = 8 // 8 bits par canal
  entete[9] = 2 // couleur vraie, sans alpha
  /* Chaque ligne est précédée de son octet de FILTRE. `0` — aucun filtre — est
     le bon choix ici : l'image est faite d'aplats, que zlib comprime déjà très
     bien, et un filtre par différence n'y gagnerait rien. */
  const lignes = Buffer.alloc(cote * (cote * 3 + 1))
  for (let ligne = 0; ligne < cote; ligne++) {
    lignes[ligne * (cote * 3 + 1)] = 0
    donnees.copy(lignes, ligne * (cote * 3 + 1) + 1, ligne * cote * 3, (ligne + 1) * cote * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(lignes, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const rendus = COTES.map((cote) => {
  const image = png(pixels(cote), cote)
  writeFileSync(join(RACINE, 'public', `icone-${cote}.png`), image)
  return `${cote}×${cote} ${image.length} o`
})
console.log(`✓ icone-app : ${rendus.join(' · ')} → public/icone-{${COTES.join(',')}}.png`)
