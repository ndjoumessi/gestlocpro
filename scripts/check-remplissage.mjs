#!/usr/bin/env node
/**
 * UN CHAMP QU'ON FILTRE DÉCLARE CE QUE LE NAVIGATEUR A LE DROIT D'EN FAIRE.
 *
 * Un `<select>` ne se remplit pas et ne se mémorise pas : le navigateur n'a
 * rien à y retenir. Un `Combobox` est un `<input type="text">`, et sans jeton
 * `autocomplete` il retombe sur l'heuristique du navigateur et des
 * gestionnaires de mots de passe.
 *
 * ═══ CE QUE LA CONVERSION A CHANGÉ, LE 2026-09-08 ═══
 *
 * Huit menus déroulants sont devenus des champs cherchables, et leur valeur
 * VISIBLE porte de la donnée nominative :
 *
 *   Tenants · compte à rattacher     « Nom Complet — courriel@exemple.com »
 *   encaissement · logement          « A3 — Charles Ngassa »
 *   relevé · logement                « A3 · Charles Ngassa »
 *   Accès · fiche libre              « Charles Ngassa — A3 »
 *
 * Sur un poste partagé de cabinet — le marché de ce produit — l'historique de
 * formulaire ou un gestionnaire tiers peut retenir cette valeur et la proposer
 * à la personne suivante, sur la même origine. Le `<select>` d'avant ne le
 * pouvait pas.
 *
 * ═══ CE QUE CETTE GARDE EXIGE, ET CE QU'ELLE N'EXIGE PAS ═══
 *
 * Que chaque `<Combobox>` DÉCLARE `autoComplete`. Pas qu'il vaille `off` : le
 * jeton juste dépend du champ, et deux le prouvent — l'indicatif téléphonique
 * porte `tel-country-code`, le pays `country`, et les perdre serait la
 * régression inverse, celle qu'un lot précédent a déjà payée.
 *
 * Ce qu'elle refuse est le SILENCE : un champ qui n'a rien dit laisse le
 * navigateur décider à sa place, et personne ne l'a voulu.
 *
 * Elle ne vérifie pas non plus que le jeton ARRIVE dans le DOM — c'est le cas
 * « garde le jeton de remplissage automatique » de `combobox.test.tsx` qui
 * tient ce bout. Ici on garde la déclaration, là-bas le câblage.
 *
 * ═══ RELEVÉ À L'ÉCRITURE ═══
 *
 * Treize `<Combobox>` dans `src/`, NEUF sans jeton — les huit champs convertis
 * plus le fuseau des relances, antérieur et sans donnée nominative. Quatre en
 * portaient déjà un, et aucun des quatre n'est un faux positif : ce sont
 * exactement les champs de pays et d'indicatif, où le remplissage est VOULU.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exit } from 'node:process'

const RACINE = process.env.RACINE_TEST ?? new URL('..', import.meta.url).pathname
const SRC = join(RACINE, 'src')

/**
 * Fenêtre de lecture d'une balise, en lignes.
 *
 * 30 d'abord, et c'était trop court : le champ du compte porte vingt lignes de
 * motif entre ses propriétés, et la garde a rougi sur un `<Combobox>` qui
 * DÉCLARAIT son jeton — un faux positif de ma propre rédaction, le jour même.
 * 60 couvre le plus long bloc du dépôt avec du reste ; la boucle s'arrête de
 * toute façon au `/>`, que les treize portent.
 */
const PORTEE = 60

function fautifsDe(relatif, source) {
  const lignes = source.split('\n')
  const fautifs = []
  for (let i = 0; i < lignes.length; i += 1) {
    if (!lignes[i].includes('<Combobox')) continue
    /* On s'arrête à la fermeture de la balise, jamais à une accolade : les
       options s'écrivent souvent sur plusieurs lignes avec des `}` internes,
       et compter les accolades ferait sortir trop tôt. */
    let declare = false
    for (let j = i; j < Math.min(i + PORTEE, lignes.length); j += 1) {
      if (lignes[j].includes('autoComplete')) declare = true
      if (lignes[j].includes('/>')) break
    }
    if (!declare) fautifs.push(`${relatif}:${i + 1} · <Combobox> sans jeton \`autoComplete\``)
  }
  return fautifs
}

/*
  TÉMOIN — l'instrument se vérifie AVANT de servir.

  Trois cas : un muet, et deux qui ne doivent PAS rougir — celui qui refuse le
  remplissage et celui qui le demande. Une garde qui exigerait `off` prendrait
  le troisième, et retirerait à l'indicatif le jeton qui le fait remplir.
*/
const TEMOIN = [
  `      <Combobox`,
  `        id={props.id}`,
  `        options={logements}`,
  `      />`,
  `      <Combobox`,
  `        id={props.id}`,
  `        autoComplete="off"`,
  `        options={logements}`,
  `      />`,
  `      <Combobox`,
  `        id={props.id}`,
  `        autoComplete="tel-country-code"`,
  `        options={indicatifs}`,
  `      />`,
].join('\n')

const TEMOIN_ATTENDU = ['temoin.tsx:1 · <Combobox> sans jeton `autoComplete`']

async function fichiers(depart) {
  const sortie = []
  for (const e of await readdir(depart, { withFileTypes: true })) {
    if (e.isDirectory()) sortie.push(...(await fichiers(join(depart, e.name))))
    /* Les CAS sont hors du relevé : ils montent des `<Combobox>` de
       démonstration dont le remplissage n'a aucun sens, et les compter ferait
       de cette garde une taxe sur l'écriture des cas. */
    else if (e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx'))
      sortie.push(join(depart, e.name))
  }
  return sortie
}

const obtenu = fautifsDe('temoin.tsx', TEMOIN)
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
  console.error(`✗ ${plaintes.length} champ(s) cherchable(s) sans jeton de remplissage :\n`)
  for (const p of plaintes) console.error('  ' + p)
  console.error(
    "\n  Un `<select>` ne se mémorise pas ; un `<input>` sans jeton laisse le\n" +
      "  navigateur décider. Sur un champ dont le libellé nomme un locataire ou\n" +
      '  porte son courriel, c’est une donnée qui survit à la session sur un\n' +
      '  poste partagé.\n' +
      '  Déclarez-le : `autoComplete="off"`, ou le jeton juste quand le\n' +
      '  remplissage est voulu — `country`, `tel-country-code`.\n',
  )
  exit(1)
}
console.log('✓ Témoin classé, et chaque champ cherchable déclare son remplissage.')
