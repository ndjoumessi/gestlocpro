/** Lecteur PNG minimal (8 bits, RGB/RGBA, non entrelacé) — sans dépendance.
 *  Playwright écrit exactement ce profil. Réutilisé par la garde des captures. */
import { inflateSync } from 'node:zlib'

export function lirePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('pas un PNG')
  let i = 8, largeur = 0, hauteur = 0, prof = 0, type = 0, entrelace = 0
  const morceaux = []
  while (i < buf.length) {
    const taille = buf.readUInt32BE(i)
    const nom = buf.toString('ascii', i + 4, i + 8)
    const corps = buf.subarray(i + 8, i + 8 + taille)
    if (nom === 'IHDR') {
      largeur = corps.readUInt32BE(0); hauteur = corps.readUInt32BE(4)
      prof = corps[8]; type = corps[9]; entrelace = corps[12]
    } else if (nom === 'IDAT') morceaux.push(corps)
    else if (nom === 'IEND') break
    i += 12 + taille
  }
  if (prof !== 8 || entrelace !== 0 || (type !== 2 && type !== 6))
    throw new Error(`profil PNG non géré : profondeur ${prof}, type ${type}, entrelacé ${entrelace}`)
  const canaux = type === 6 ? 4 : 3
  const brut = inflateSync(Buffer.concat(morceaux))
  const ligne = largeur * canaux
  const px = Buffer.alloc(hauteur * ligne)
  let prec = Buffer.alloc(ligne)
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (ligne + 1)]
    const src = brut.subarray(y * (ligne + 1) + 1, (y + 1) * (ligne + 1))
    const dst = px.subarray(y * ligne, (y + 1) * ligne)
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? dst[x - canaux] : 0, b = prec[x], c = x >= canaux ? prec[x - canaux] : 0
      let v = src[x]
      if (filtre === 1) v += a
      else if (filtre === 2) v += b
      else if (filtre === 3) v += (a + b) >> 1
      else if (filtre === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      dst[x] = v & 0xff
    }
    prec = dst
  }
  return { largeur, hauteur, canaux, px }
}
