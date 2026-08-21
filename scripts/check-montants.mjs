#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exit } from 'node:process'

const RACINE = process.env.RACINE_TEST ?? new URL('..', import.meta.url).pathname
const FEATURES = join(RACINE, 'src/features')

const MOTS_ARGENT = /cout|coût|montant|amount|prix|withheld|caution|loyer|solde/i
const LECTURE_NUE = /\b(Number|parseInt|parseFloat)\(\s*([A-Za-z_$][\w$.]*)/g
const REPLI_MUET = /\bparseAmount\s*\([^()]*\)\s*(\?\?|\|\|)/g

function sansCommentaires(source) {
  const blanchir = (bloc) => bloc.replace(/[^\n]/g, ' ')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blanchir)
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant) => avant)
}

function fautifsDe(relatif, brut) {
  const source = sansCommentaires(brut)
  const ligneDe = (i) => source.slice(0, i).split('\n').length
  const fautifs = []
  for (const m of source.matchAll(LECTURE_NUE)) {
    if (!MOTS_ARGENT.test(m[2])) continue
    fautifs.push(`${relatif}:${ligneDe(m.index)} · ${m[1]}(${m[2]})`)
  }
  for (const m of source.matchAll(REPLI_MUET)) {
    fautifs.push(`${relatif}:${ligneDe(m.index)} · ${m[0].replace(/\s+/g, ' ')}`)
  }
  return [...new Set(fautifs)].sort()
}

const TEMOIN = [
  `const a = Number(r.cout)`,
  `const b = Number(pieces)`,
  `const c = Number(surface.replace(/\\s/g, ''))`,
  `const d = Number(montant.replace(/\\s/g, ''))`,
  `const e = parseAmount(prix) ?? 0`,
  `const f = parseAmount(prix)`,
  `const g = parseFloat(loyerSaisi)`,
  `// Number(r.cout) rendait NaN sur « 35 000 »`,
].join('\n')

const TEMOIN_ATTENDU = [
  'temoin.tsx:1 · Number(r.cout)',
  'temoin.tsx:4 · Number(montant.replace)',
  'temoin.tsx:5 · parseAmount(prix) ??',
  'temoin.tsx:7 · parseFloat(loyerSaisi)',
].sort()

async function fichiers(depart) {
  const sortie = []
  async function descendre(dossier) {
    for (const e of await readdir(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name)
      if (e.isDirectory()) await descendre(chemin)
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) sortie.push(chemin)
    }
  }
  await descendre(depart)
  return sortie
}

const obtenu = fautifsDe('temoin.tsx', TEMOIN)
if (JSON.stringify(obtenu) !== JSON.stringify(TEMOIN_ATTENDU)) {
  console.error('✗ TEMOIN:', JSON.stringify(obtenu, null, 1))
  console.error('  attendu:', JSON.stringify(TEMOIN_ATTENDU, null, 1))
  exit(1)
}

const plaintes = []
for (const chemin of await fichiers(FEATURES)) {
  plaintes.push(...fautifsDe(chemin.slice(RACINE.length), await readFile(chemin, 'utf8')))
}
if (plaintes.length) {
  console.error(`✗ ${plaintes.length} montant(s) lu(s) à la main :\n`)
  for (const p of plaintes) console.error('  ' + p)
  exit(1)
}
console.log('✓ Témoin classé, et aucun montant lu à la main dans src/features.')
