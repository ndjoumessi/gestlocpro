#!/usr/bin/env node
/**
 * UN CAS NÉGATIF DOIT DIRE CE QU'IL A REGARDÉ.
 *
 * Le 2026-09-08, en convertissant huit menus déroulants en champs qu'on filtre,
 * `codeParLogementUnique` a continué de passer sans plus rien mesurer. Il exige
 * qu'un logement dont le code d'invitation attend encore ne soit PAS proposé —
 * sinon le serveur rend 409. Il comptait les `option` portant « A1 » et en
 * voulait zéro.
 *
 * Un `Combobox` fermé n'a AUCUNE option dans le DOM. `queryByRole('option')` ne
 * trouvait donc plus rien, A1 compris : le cas laissait revenir le 409 qu'il
 * existe pour empêcher, en restant vert. Rien ne l'a signalé — c'est son jumeau
 * POSITIF, vingt lignes plus bas, qui a rougi parce qu'il exigeait, lui, de
 * TROUVER quelque chose.
 *
 * ═══ CE QUE CETTE GARDE EXIGE ═══
 *
 * Un bloc `it` qui NIE la présence d'une `option` ou d'un `listbox` doit, dans
 * le même bloc, en AFFIRMER une. Une ligne, et elle referme la classe : le cas
 * cesse de confondre « la chose interdite est absente » et « il n'y a rien du
 * tout ».
 *
 * ═══ POURQUOI SI ÉTROIT — option ET listbox, RIEN D'AUTRE ═══
 *
 * La même confusion vaut pour n'importe quel conteneur qui peut se vider, et
 * une règle générale sur les 564 négations de cette suite rendrait surtout du
 * bruit : la plupart nient une chose qui n'a jamais de conteneur — un bouton,
 * un message, un montant. `option` et `listbox` sont le cas MESURÉ, celui qui a
 * effectivement laissé passer un défaut, et le seul dont le conteneur naît vide
 * par construction. Mesuré à l'écriture : sept blocs concernés, une plainte,
 * zéro faux positif.
 *
 * Cette garde ne remplace pas la mutation qui l'a fait naître — rendre la liste
 * du `Combobox` invisible et voir quels cas survivent. Celle-ci en attrape plus
 * (un `aria-activedescendant` qui ne désigne rien, par exemple) mais elle se
 * lance à la main. La garde tient la part qui se vérifie à chaque commit.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exit } from 'node:process'

const RACINE = process.env.RACINE_TEST ?? new URL('..', import.meta.url).pathname
const SRC = join(RACINE, 'src')

/** Nie la présence : `queryBy…` rend `null` plutôt que de lever. */
const NIE = /(queryBy|queryAllBy)Role\(\s*['"](option|listbox)['"]/
/** Affirme la présence : `getBy…`/`findBy…` lèvent si l'élément manque. */
const AFFIRME = /(getBy|getAllBy|findBy|findAllBy)Role\(\s*['"](option|listbox)['"]/

/**
 * Découpe un fichier de cas en blocs `it`/`test`.
 *
 * La fermeture est repérée à l'indentation d'ouverture — `  })` sous un
 * `  it(` —, convention tenue par toute la suite. Un bloc mal refermé
 * s'arrêterait au bloc suivant, ce qui rend la garde plus SÉVÈRE, jamais plus
 * laxiste : le pire cas est une plainte à examiner, pas un défaut manqué.
 */
function blocs(source) {
  const lignes = source.split('\n')
  const sortie = []
  for (let i = 0; i < lignes.length; i += 1) {
    const debut = /^(\s*)(it|test)\(/.exec(lignes[i])
    if (!debut) continue
    const fermeture = new RegExp(`^${debut[1]}\\}\\)`)
    let fin = lignes.length
    for (let j = i + 1; j < lignes.length; j += 1) {
      if (fermeture.test(lignes[j]) || /^(\s*)(it|test)\(/.test(lignes[j])) {
        fin = j
        break
      }
    }
    sortie.push({ ligne: i + 1, titre: lignes[i].trim().slice(0, 80), corps: lignes.slice(i, fin).join('\n') })
  }
  return sortie
}

function fautifsDe(relatif, source) {
  return blocs(source)
    .filter((b) => NIE.test(b.corps) && !AFFIRME.test(b.corps))
    .map((b) => `${relatif}:${b.ligne} · ${b.titre}`)
}

/*
  TÉMOIN — l'instrument se vérifie AVANT de servir.

  Trois blocs : un fautif, et deux qui ne doivent PAS rougir. Le second affirme
  avant de nier, c'est la forme correcte ; le troisième ne parle pas de liste du
  tout, et une garde qui le prendrait aurait cessé d'être étroite.
*/
const TEMOIN = [
  `  it('nie sans avoir rien vu', async () => {`,
  `    expect(screen.queryByRole('option', { name: /A1/ })).not.toBeInTheDocument()`,
  `  })`,
  `  it('affirme avant de nier', async () => {`,
  `    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)`,
  `    expect(screen.queryByRole('option', { name: /A1/ })).not.toBeInTheDocument()`,
  `  })`,
  `  it('ne parle pas de liste', async () => {`,
  `    expect(screen.queryByRole('button', { name: /Envoyer/ })).toBeNull()`,
  `  })`,
].join('\n')

const TEMOIN_ATTENDU = ["temoin.test.tsx:1 · it('nie sans avoir rien vu', async () => {"]

async function fichiers(depart) {
  const sortie = []
  async function descendre(dossier) {
    for (const e of await readdir(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name)
      if (e.isDirectory()) await descendre(chemin)
      else if (/\.test\.tsx?$/.test(e.name)) sortie.push(chemin)
    }
  }
  await descendre(depart)
  return sortie
}

const obtenu = fautifsDe('temoin.test.tsx', TEMOIN)
if (JSON.stringify(obtenu) !== JSON.stringify(TEMOIN_ATTENDU)) {
  console.error('✗ TEMOIN:', JSON.stringify(obtenu, null, 1))
  console.error('  attendu:', JSON.stringify(TEMOIN_ATTENDU, null, 1))
  exit(1)
}

const plaintes = []
for (const chemin of await fichiers(SRC)) {
  plaintes.push(...fautifsDe(chemin.slice(RACINE.length), await readFile(chemin, 'utf8')))
}
if (plaintes.length) {
  console.error(`✗ ${plaintes.length} cas nie(nt) une option ou une liste sans en avoir vu aucune :\n`)
  for (const p of plaintes) console.error('  ' + p)
  console.error(
    '\n  Un conteneur vide rend VRAIE toute négation portant sur son contenu.',
  )
  console.error('  Ajoutez une affirmation de présence dans le même cas, par exemple :')
  console.error("    expect(liste.getAllByRole('option').length).toBeGreaterThan(0)")
  exit(1)
}
console.log('✓ Témoin classé, et aucun cas ne nie une option sans en avoir vu aucune.')
