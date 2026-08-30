/**
 * RECADRE UNE IMAGE SOURCE EN FIXTURE, PAR CANEVAS.
 *
 * Ce n'est PAS une porte : rien ici ne mesure ni ne refuse. C'est l'outil qui
 * produit les images de `src/data/fixtures`, et il vit dans le dépôt pour une
 * seule raison — `PROVENANCE.md` décrit chaque fixture par une FENÊTRE de
 * recadrage en pixels de l'original. Sans l'outil qui a posé cette fenêtre, ces
 * coordonnées ne sont pas vérifiables : personne ne peut refaire le geste et
 * retrouver le même fichier. Une provenance qu'on ne peut pas rejouer est une
 * provenance qu'on croit sur parole.
 *
 * PAR CANEVAS, ET C'EST LA MOITIÉ DE L'INTÉRÊT. Aucune bibliothèque d'image
 * n'est installée — ni ImageMagick, ni vips — et le navigateur de Playwright est
 * le seul décodeur JPEG du dépôt. Le détour a un effet qu'un `-crop` n'aurait
 * pas : le canevas CUIT l'orientation dans les pixels et SUPPRIME tout le
 * segment EXIF, donc les coordonnées GPS et le boîtier. Une photographie versée
 * dans un dépôt public ne doit pas emporter le lieu où elle a été prise.
 *
 * Usage :
 *   node scripts/recadrer-fixture.mjs <source> <sortie> <x> <y> <largeur> <hauteur> <côté> <qualité>
 *
 * La fenêtre est CARRÉE à l'arrivée : `côté × côté`. Une fenêtre source non
 * carrée serait donc déformée — c'est à l'appelant de la tenir carrée, et le
 * relevé qu'affiche ce script permet de le vérifier après coup.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [, , source, sortie, sx, sy, sw, sh, cote, qualite] = process.argv
if (!source || !sortie || cote === undefined || qualite === undefined) {
  console.error(
    'usage : node scripts/recadrer-fixture.mjs <source> <sortie> <x> <y> <largeur> <hauteur> <côté> <qualité>',
  )
  process.exit(2)
}

const dataUrl = `data:image/jpeg;base64,${readFileSync(source).toString('base64')}`

const navigateur = await chromium.launch()
try {
  const page = await navigateur.newPage()
  await page.goto('about:blank')
  const rendu = await page.evaluate(
    async ({ dataUrl, sx, sy, sw, sh, cote, qualite }) => {
      const img = new Image()
      img.src = dataUrl
      await img.decode()
      const c = document.createElement('canvas')
      c.width = cote
      c.height = cote
      const ctx = c.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cote, cote)
      /*
        `toDataURL` et non `toBlob` : sur une page `about:blank` pilotée,
        `toBlob` a rendu `null` sans erreur — un échec SILENCIEUX, qui écrivait
        un fichier de zéro octet. La forme synchrone n'a pas ce mode de panne.
      */
      const url = c.toDataURL('image/jpeg', qualite)
      return {
        b64: url.slice(url.indexOf(',') + 1),
        largeurSource: img.naturalWidth,
        hauteurSource: img.naturalHeight,
      }
    },
    { dataUrl, sx: +sx, sy: +sy, sw: +sw, sh: +sh, cote: +cote, qualite: +qualite },
  )

  const octets = Buffer.from(rendu.b64, 'base64')
  if (octets.length === 0) throw new Error('le canevas n’a rien rendu')
  writeFileSync(sortie, octets)

  // Le relevé porte ce qui devra être recopié dans `PROVENANCE.md`, y compris
  // le coût en base64 — c'est lui, et non le poids sur disque, qui entre dans
  // le paquet quand la fixture est inlinée.
  const enBase64 = octets.toString('base64').length
  console.log(
    `${sortie}\n` +
      `  source  ${rendu.largeurSource} × ${rendu.hauteurSource}\n` +
      `  fenêtre ${sw} × ${sh} à (${sx}, ${sy})\n` +
      `  rendu   ${cote} × ${cote}, qualité ${qualite}\n` +
      `  poids   ${octets.length} o sur disque, ${enBase64} o en base64\n` +
      `  EXIF    ${octets.includes(Buffer.from('Exif')) ? 'PRÉSENT — À CORRIGER' : 'absent'}`,
  )
} finally {
  await navigateur.close()
}
