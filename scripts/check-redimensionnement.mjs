#!/usr/bin/env node
/**
 * ENTRE UN REDIMENSIONNEMENT ET LA PREMIÈRE SONDE : UNE NAVIGATION, OU UNE POSE.
 *
 * `page.setViewportSize()` rend la main AVANT que React ait rejoué le rendu
 * conditionné par la largeur. Une sonde lancée aussitôt lit l'arbre de la
 * largeur PRÉCÉDENTE — et la porte annonce alors des mesures qu'elle n'a pas
 * prises.
 *
 * ═══ CE QUE CE DÉFAUT A COÛTÉ, MESURÉ ═══
 *
 * Quatre sites, deux portes, deux lots pour les trouver à la main :
 *
 *   espace-connecte  boucle des largeurs   99 à 118 rangées selon le passage,
 *                                          la chaîne rouge au hasard
 *   espace-connecte  audit de contraste    17546 à 17629 textes confrontés
 *   espace-connecte  mesure du pli         64 à 67 écrans jugés
 *   mesure-ui        rognages / mise en page + contraste
 *                                          14136 puis 14186 textes audités
 *
 * Aucun de ces écarts ne se voit dans un verdict : les portes restaient vertes
 * la plupart du temps. Ce sont les COMPTEURS qui bougeaient — c'est-à-dire ce
 * que la porte prétendait avoir regardé.
 *
 * ET LE PIRE EST L'ORDRE DANS LEQUEL ILS SONT TOMBÉS. Le premier lot en a
 * corrigé un et déclaré la porte stable, sur la foi du seul compteur réparé.
 * Les deux autres sites de la MÊME porte ont survécu un lot entier. Cette garde
 * existe pour que le prochain n'ait pas à les chercher.
 *
 * ═══ CE QU'ELLE EXIGE, ET POURQUOI PAS « UNE ATTENTE » ═══
 *
 * « Un redimensionnement doit être suivi d'une attente » aurait été VERT sur
 * les quatre défauts : tous appelaient déjà `attendre()`, qui couvre
 * `networkidle`, `aria-busy` et les polices — trois conditions déjà vraies
 * après un simple redimensionnement, donc rendant la main aussitôt.
 *
 * La règle porte donc sur la CAUSALITÉ, pas sur la présence d'un appel : entre
 * le redimensionnement et la première lecture du DOM, il faut soit une
 * navigation (l'arbre renaît), soit une pose (`poserLArbre`, qui attend deux
 * empreintes identiques à deux trames d'écart).
 *
 * ═══ CE QU'ELLE NE COMPTE PAS POUR UNE SONDE ═══
 *
 * Un GESTE — `page.locator(…).click()`, `getByRole(…).fill()` — n'en est pas
 * une : Playwright y attend l'actionnabilité et recalcule la position. Ma
 * première rédaction les comptait et rendait deux faux positifs sur vingt
 * occurrences, aux deux endroits où `mesure-ui` clique une étiquette après
 * avoir redimensionné. Seule une LECTURE du DOM compte — `page.evaluate`.
 *
 * ATTENTION À CE QUE CELA NE DIT PAS. Un geste ne SATISFAIT rien non plus : un
 * `page.evaluate` posé après lui rougit toujours, et c'est voulu — l'attente
 * d'actionnabilité d'un clic porte sur SON élément, pas sur l'arbre entier. Le
 * témoin le montre en n'offrant, dans ce cas-là, aucune lecture derrière le
 * geste.
 *
 * ═══ RELEVÉ À L'ÉCRITURE ═══
 *
 * Vingt `setViewportSize` sous `scripts/*.mjs`, zéro plainte sur l'arbre
 * corrigé — et QUATRE sur les sources d'avant correction, exactement les quatre
 * défauts réels, sans un faux positif ni un manqué. C'est ce second relevé qui
 * prouve que la règle regarde : née verte, elle n'aurait rien démontré.
 *
 * ET ELLE EST NÉE ROUGE POUR DE BON, sur un fichier que mon relevé à la main
 * n'avait pas vu : `scripts/inventaire/*` — mon `scripts/*.mjs` ne descendait
 * pas dans les sous-dossiers. Elle y a rendu un vrai défaut, la sonde de
 * GÉOMÉTRIE de `mesure-navigateur` lancée aussitôt après chacune des onze
 * largeurs, et un faux positif, corrigé ci-dessous. C'est la troisième fois que
 * l'énumération mécanique trouve ce que la lecture avait manqué.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exit } from 'node:process'

const RACINE = process.env.RACINE_TEST ?? new URL('..', import.meta.url).pathname
const SCRIPTS = join(RACINE, 'scripts')

/** Une ligne de commentaire ne porte pas de code — deux des vingt en étaient. */
const COMMENTAIRE = /^\s*(\*|\/\/|\/\*)/

/** Au-delà, on a changé de sujet : la sonde qui suivrait ne suit plus ce tour. */
const PORTEE = 40

function fautifsDe(relatif, source) {
  const lignes = source.split('\n')
  const fautifs = []
  const tolerees = []
  let dansUnBloc = false
  for (let i = 0; i < lignes.length; i += 1) {
    const l = lignes[i]
    if (l.includes('/*') && !l.includes('*/')) dansUnBloc = true
    else if (l.includes('*/')) {
      dansUnBloc = false
      continue
    }
    if (dansUnBloc || COMMENTAIRE.test(l) || !l.includes('setViewportSize')) continue

    for (let j = i + 1; j < Math.min(i + PORTEE, lignes.length); j += 1) {
      const t = lignes[j]
      if (COMMENTAIRE.test(t)) continue
      if (t.includes('poserLArbre')) break
      /* `reload` AUTANT QUE `goto` : l'arbre renaît dans les deux cas. La
         première rédaction ne connaissait que `goto` et rendait un faux positif
         sur `mesure-navigateur`, qui redimensionne PUIS recharge — et son
         commentaire dit exactement pourquoi : « un CHARGEMENT, pas un
         redimensionnement ». */
      if (t.includes('page.goto') || t.includes('page.reload')) break
      /* UN TIMER FIXE EST TOLÉRÉ, ET NOMMÉ. Il attend quelque chose, donc il
         n'est pas le défaut ; mais sa durée ne suit ni la machine ni l'écran, et
         c'est la forme que ce dépôt remplace partout ailleurs. On le laisse
         passer en le disant, plutôt que de le taire ou d'en faire un rouge qui
         dépasserait le sujet de cette garde. */
      if (t.includes('waitForTimeout')) {
        tolerees.push(`${relatif}:${i + 1} · attente par timer fixe`)
        break
      }
      if (t.includes('page.evaluate') || t.includes('page.$$eval')) {
        fautifs.push(`${relatif}:${i + 1} · sonde le DOM sans navigation ni pose`)
        break
      }
      if (t.includes('setViewportSize')) break
    }
  }
  return { fautifs, tolerees }
}

/*
  TÉMOIN — l'instrument se vérifie AVANT de servir.

  Quatre cas : un fautif, et trois qui ne doivent PAS rougir. Le geste est le
  plus important des trois — c'est lui que ma première rédaction prenait à tort,
  et une garde qui le reprendrait rendrait deux faux positifs sur vingt.
*/
const TEMOIN = [
  `  await page.setViewportSize({ width: 320, height: 900 })`,
  `  const vu = await page.evaluate(MESURER)`,
  `  await page.setViewportSize({ width: 320, height: 900 })`,
  `  await page.goto(BASE + adresse)`,
  `  const vu2 = await page.evaluate(MESURER)`,
  `  await page.setViewportSize({ width: 320, height: 900 })`,
  `  await poserLArbre(page, ou)`,
  `  const vu3 = await page.evaluate(MESURER)`,
  `  await page.setViewportSize({ width: 320, height: 900 })`,
  `  await page.locator('label').click()`,
].join('\n')

const TEMOIN_ATTENDU = ['temoin.mjs:1 · sonde le DOM sans navigation ni pose']

async function fichiers(depart) {
  const sortie = []
  for (const e of await readdir(depart, { withFileTypes: true })) {
    if (e.isDirectory()) sortie.push(...(await fichiers(join(depart, e.name))))
    /* LES GARDES DE SOURCE SONT ÉCARTÉES, et cette garde-ci la première : son
       propre témoin porte les jetons qu'elle cherche, donc elle se dénonçait
       elle-même. Aucune `check-*.mjs` ne pilote de navigateur — vérifié à
       l'écriture, aucune n'importe `playwright` — donc aucune ne peut porter
       le défaut. Écarter par ce qu'un fichier EST, et non par son nom seul,
       serait plus sûr ; il faudrait pour cela lire ses imports, ce qui déplace
       le problème sans le fermer. */
    else if (e.name.endsWith('.mjs') && !e.name.startsWith('check-'))
      sortie.push(join(depart, e.name))
  }
  return sortie
}

const obtenu = fautifsDe('temoin.mjs', TEMOIN).fautifs
if (JSON.stringify(obtenu) !== JSON.stringify(TEMOIN_ATTENDU)) {
  console.error('✗ TEMOIN:', JSON.stringify(obtenu, null, 1))
  console.error('  attendu:', JSON.stringify(TEMOIN_ATTENDU, null, 1))
  exit(1)
}

const plaintes = []
const tolerees = []
for (const chemin of await fichiers(SCRIPTS)) {
  const r = fautifsDe(chemin.slice(RACINE.length), await readFile(chemin, 'utf8'))
  plaintes.push(...r.fautifs)
  tolerees.push(...r.tolerees)
}
if (plaintes.length) {
  console.error(
    `✗ ${plaintes.length} redimensionnement(s) suivi(s) d'une sonde sans pose :\n`,
  )
  for (const p of plaintes) console.error('  ' + p)
  console.error(
    "\n  `setViewportSize` rend la main avant que React ait rejoué le rendu :\n" +
      "  la sonde lit alors l'arbre de la largeur PRÉCÉDENTE.\n" +
      '  Ajoutez une navigation, ou `await poserLArbre(page, ou)` — voir son\n' +
      '  en-tête dans `mesure-ui.mjs`.\n',
  )
  exit(1)
}
console.log(
  `✓ Témoin classé, et aucun redimensionnement ne sonde avant de se poser.` +
    (tolerees.length ? `\n  ${tolerees.length} attente(s) par timer fixe, tolérée(s) : ${tolerees.join(', ')}` : ''),
)
