#!/usr/bin/env node
/**
 * LA PHOTO ARRIVE LÉGÈRE — et c'est mesuré, dans un vrai navigateur.
 *
 * `src/lib/transcoderPhoto.ts` ne peut pas être gardé par `vitest` : jsdom n'a
 * ni `createImageBitmap` ni `canvas.toBlob`, et les simuler ne mesurerait que
 * la simulation. Ce script construit le module RÉEL avec Vite, le charge dans
 * Chromium et l'exécute sur de vraies images. Aucune doublure.
 *
 * ─── DEUX SUJETS, ET POURQUOI DEUX ────────────────────────────────────────
 *
 * LA FIXTURE VERSIONNÉE (`server/src/stockage/fixtures/compteur-index.jpg`) est
 * une vraie photographie, sous CC0, et c'est elle qui porte les propriétés
 * qu'on ne peut pas fabriquer : un JPEG d'appareil, ré-encodé, dont on vérifie
 * qu'il ressort en JPEG, sous le plafond du serveur, sans EXIF et SANS ÊTRE
 * AGRANDI. Elle est délibérément petite — 827 × 147, 24 Ko — parce qu'elle est
 * versionnée et qu'un dépôt n'a pas à porter des mégaoctets.
 *
 * Sa petitesse a un prix qu'il faut dire : ELLE NE PEUT PAS PROUVER LA
 * RÉDUCTION. Plus courte que la cible, elle traverse le transcodage sans être
 * redimensionnée ; retirer le redimensionnement ne changerait rien à son poids.
 *
 * L'IMAGE HAUTE est donc FABRIQUÉE dans la page — 3000 × 4000 de bruit fin.
 * C'est un signal synthétique, et il ne sert qu'à une propriété MÉCANIQUE :
 * la hauteur est-elle ramenée à la cible, et le poids s'effondre-t-il ? Aucun
 * jugement de lisibilité ne s'appuie dessus — celui-là a été rendu ailleurs,
 * à l'œil, sur des photographies réelles (voir le commentaire de
 * `PLAFOND_PAR_OBJET_OCTETS`). Le bruit plutôt qu'un aplat : un aplat se
 * compresserait à quelques kilo-octets et rendrait la garde muette.
 *
 *   node scripts/photo-transcodage.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici.
 */
import { chromium } from 'playwright'
import { build } from 'vite'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit, stdout } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = join(RACINE, 'server/src/stockage/fixtures/compteur-index.jpg')
const CONTRAT = join(RACINE, 'server/src/stockage/contrat.ts')

/**
 * Le plafond est LU DANS LA SOURCE DU SERVEUR, jamais recopié ici.
 *
 * Recopier le chiffre créerait une seconde vérité qui se périmerait en silence
 * le jour où le relevé serait refait — exactement le défaut que le lot du
 * plafond a fermé côté serveur. Le client, lui, n'a pas besoin de connaître ce
 * nombre : c'est le serveur qui refuse. Seule la GARDE le lit, pour vérifier
 * que la cible de transcodage tient sous lui.
 */
function plafondDuServeur() {
  const source = readFileSync(CONTRAT, 'utf8')
  const m = /export const PLAFOND_PAR_OBJET_OCTETS = ([\d *]+)/.exec(source)
  if (!m) {
    throw new Error(
      `Plafond introuvable dans ${CONTRAT}. La garde ne peut pas inventer sa propre valeur.`,
    )
  }
  return m[1]
    .split('*')
    .map((n) => Number(n.trim()))
    .reduce((a, b) => a * b, 1)
}

/** Construit le module réel en IIFE, pour qu'il devienne un global de la page. */
async function moduleConstruit() {
  const sortie = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': join(RACINE, 'src') } },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: join(RACINE, 'src/lib/transcoderPhoto.ts'),
        formats: ['iife'],
        name: 'Transcodage',
        fileName: () => 'transcodage.js',
      },
    },
  })
  const paquets = Array.isArray(sortie) ? sortie : [sortie]
  const code = paquets[0]?.output?.find((s) => s.type === 'chunk')?.code
  if (!code) throw new Error('Le module de transcodage n’a pas pu être construit.')
  return code
}

const plaintes = []
const dire = (ligne) => stdout.write(`${ligne}\n`)

const PLAFOND = plafondDuServeur()
const code = await moduleConstruit()
const fixture = readFileSync(FIXTURE)

const navigateur = await chromium.launch()
const page = await navigateur.newPage()
await page.addScriptTag({ content: code })

const resultat = await page.evaluate(
  async ({ fixtureB64 }) => {
    const {
      transcoderPhoto,
      HAUTEUR_CIBLE_PX,
      PLANCHER_DE_LISIBILITE_PX,
      QUALITE_JPEG,
      TYPE_SORTIE,
      PHOTOS_PAR_RESERVE,
    } = Transcodage

    const versOctets = (b64) => {
      const binaire = atob(b64)
      const t = new Uint8Array(binaire.length)
      for (let i = 0; i < binaire.length; i += 1) t[i] = binaire.charCodeAt(i)
      return t
    }

    // ─── La fixture versionnée, telle quelle ───────────────────────────────
    const octetsFixture = versOctets(fixtureB64)
    const blobFixture = new Blob([octetsFixture], { type: 'image/jpeg' })
    const entree = await createImageBitmap(blobFixture)
    const dimsEntree = [entree.width, entree.height]
    entree.close()
    const fixtureSortie = await transcoderPhoto(blobFixture)

    // ─── L'image HAUTE, fabriquée ──────────────────────────────────────────
    const cv = document.createElement('canvas')
    cv.width = 3000
    cv.height = 4000
    const ctx = cv.getContext('2d')
    const donnees = ctx.createImageData(3000, 4000)
    let graine = 987654321
    for (let i = 0; i < donnees.data.length; i += 4) {
      graine = (graine * 1103515245 + 12345) & 0x7fffffff
      const v = 70 + ((graine >> 16) % 150)
      donnees.data[i] = v
      donnees.data[i + 1] = v - 12
      donnees.data[i + 2] = v - 30
      donnees.data[i + 3] = 255
    }
    ctx.putImageData(donnees, 0, 0)
    const brut = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.95))
    const hauteSortie = await transcoderPhoto(brut)

    // ─── Un HEIC, fabriqué au niveau des octets ────────────────────────────
    // Un vrai HEIC ne peut pas être produit par le navigateur ; ce qui est
    // testé n'est pas le décodage mais la RECONNAISSANCE, qui se fait sur les
    // douze premiers octets. Ceux-ci sont donc exacts, le reste est indifférent.
    const enTete = new Uint8Array(64)
    enTete.set([0, 0, 0, 0x18], 0)
    for (const [i, c] of [...'ftypheic'].entries()) enTete[4 + i] = c.charCodeAt(0)
    const heicSortie = await transcoderPhoto(new Blob([enTete], { type: 'image/heic' }))

    // ─── Des octets qui ne sont pas une image ──────────────────────────────
    const texte = new TextEncoder().encode('<script>alert(1)</script>')
    const illisibleSortie = await transcoderPhoto(new Blob([texte]))

    const lire = async (r) =>
      r.transcode
        ? {
            transcode: true,
            octets: r.octets.size,
            largeur: r.largeur,
            hauteur: r.hauteur,
            typeMime: r.typeMime,
            tete: [...new Uint8Array(await r.octets.slice(0, 4).arrayBuffer())],
            aDeLExif: await (async () => {
              const t = new Uint8Array(await r.octets.slice(0, 24).arrayBuffer())
              // APP1 « Exif\0\0 » se trouve juste après le SOI quand il existe.
              return t[2] === 0xff && t[3] === 0xe1
            })(),
          }
        : { transcode: false, motif: r.motif }

    return {
      constantes: {
        HAUTEUR_CIBLE_PX,
        PLANCHER_DE_LISIBILITE_PX,
        QUALITE_JPEG,
        TYPE_SORTIE,
        PHOTOS_PAR_RESERVE,
      },
      dimsEntree,
      fixture: await lire(fixtureSortie),
      haute: { ...(await lire(hauteSortie)), octetsAvant: brut.size },
      heic: await lire(heicSortie),
      illisible: await lire(illisibleSortie),
    }
  },
  { fixtureB64: fixture.toString('base64') },
)

await navigateur.close()

const { constantes: C, dimsEntree, fixture: F, haute: H, heic, illisible } = resultat

// ─── 1. La cible ne descend pas sous le plancher de lisibilité ───────────────
if (C.HAUTEUR_CIBLE_PX < C.PLANCHER_DE_LISIBILITE_PX) {
  plaintes.push(
    `hauteur cible ${C.HAUTEUR_CIBLE_PX} px < plancher de lisibilité ${C.PLANCHER_DE_LISIBILITE_PX} px. ` +
      `Ce plancher est MESURÉ : sous 1280 px, l’index d’un compteur d’eau cesse d’être lisible ` +
      `(relevé sur deux photographies CC0, voir le commentaire de PLAFOND_PAR_OBJET_OCTETS). ` +
      `Une photo d’état des lieux sert de preuve ; illisible, elle ne prouve rien.`,
  )
}

// ─── 2. La fixture ressort en JPEG, sous le plafond, sans EXIF, non agrandie ─
if (!F.transcode) {
  plaintes.push(`la fixture versionnée est refusée par le transcodage (motif « ${F.motif} »).`)
} else {
  if (F.typeMime !== 'image/jpeg' || F.tete[0] !== 0xff || F.tete[1] !== 0xd8) {
    plaintes.push(`la fixture ne ressort pas en JPEG : type ${F.typeMime}, tête ${F.tete}.`)
  }
  if (F.octets > PLAFOND) {
    plaintes.push(`la fixture transcodée pèse ${F.octets} o, au-dessus du plafond serveur (${PLAFOND} o).`)
  }
  if (F.aDeLExif) {
    plaintes.push(
      `la fixture transcodée porte encore un segment EXIF. Le ré-encodage doit l’effacer — ` +
        `c’est ce qui retire la position GPS d’une photo prise dans le logement d’autrui.`,
    )
  }
  if (F.hauteur > dimsEntree[1]) {
    plaintes.push(
      `la fixture a été AGRANDIE : ${dimsEntree[1]} px en entrée, ${F.hauteur} px en sortie. ` +
        `Agrandir paie du réseau pour des pixels inventés.`,
    )
  }
}

// ─── 3. Une image haute est ramenée à la cible, et le poids s'effondre ───────
if (!H.transcode) {
  plaintes.push(`une image haute est refusée par le transcodage (motif « ${H.motif} »).`)
} else {
  if (H.hauteur !== C.HAUTEUR_CIBLE_PX) {
    plaintes.push(
      `une image de 4000 px ressort à ${H.hauteur} px au lieu de ${C.HAUTEUR_CIBLE_PX}. ` +
        `Le redimensionnement ne s’applique pas.`,
    )
  }
  if (H.octets > PLAFOND) {
    plaintes.push(
      `une image haute transcodée pèse ${H.octets} o, au-dessus du plafond serveur (${PLAFOND} o) : ` +
        `le serveur la refuserait, et l’utilisateur aurait attendu la montée pour rien.`,
    )
  }
  if (H.octets >= H.octetsAvant) {
    plaintes.push(
      `le transcodage n’allège pas : ${H.octetsAvant} o en entrée, ${H.octets} o en sortie.`,
    )
  }
}

// ─── 4. Le HEIC est refusé, et l'illisible aussi ─────────────────────────────
if (heic.transcode || heic.motif !== 'heic') {
  plaintes.push(
    `un HEIC n’est pas refusé pour ce qu’il est (${JSON.stringify(heic)}). ` +
      `C’est le format par défaut d’un iPhone : le laisser passer le fait échouer ` +
      `plus loin, avec une erreur que personne ne sait traduire en conseil.`,
  )
}
if (illisible.transcode || illisible.motif !== 'illisible') {
  plaintes.push(`des octets qui ne sont pas une image ne sont pas refusés (${JSON.stringify(illisible)}).`)
}

if (plaintes.length > 0) {
  process.stderr.write(`✗ ${plaintes.length} défaut(s) de transcodage :\n\n`)
  for (const p of plaintes) process.stderr.write(`  ${p}\n`)
  exit(1)
}

dire(
  `✓ photo-transcodage : fixture CC0 ${dimsEntree[0]}×${dimsEntree[1]} → ` +
    `${F.largeur}×${F.hauteur}, ${F.octets} o, sans EXIF ; ` +
    `image haute 3000×4000 → ${H.largeur}×${H.hauteur}, ${H.octetsAvant} → ${H.octets} o ` +
    `(${Math.round((1 - H.octets / H.octetsAvant) * 100)} % de moins) ; HEIC et non-image refusés.`,
)
dire(
  `  Cible ${C.HAUTEUR_CIBLE_PX} px / q${C.QUALITE_JPEG}, plancher de lisibilité ` +
    `${C.PLANCHER_DE_LISIBILITE_PX} px, plafond serveur ${PLAFOND} o, ` +
    `${C.PHOTOS_PAR_RESERVE} photos tenues par réserve.`,
)
dire(
  `  Ce script ne dit RIEN de la LISIBILITÉ du résultat : elle a été jugée à l’œil,` +
    ` sur des photographies réelles, et le q0,82 reste une prudence non mesurée.`,
)
