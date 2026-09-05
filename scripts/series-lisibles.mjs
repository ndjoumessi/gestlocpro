#!/usr/bin/env node
/**
 * AUCUNE SÉRIE D'UN GRAPHIQUE N'EST RENDUE INVISIBLE PAR SON ENCODAGE.
 *
 * LE DÉFAUT, MESURÉ. Loyer, eau et électricité étaient EMPILÉS sur une seule
 * échelle. Relevé sur les onze largeurs : le loyer rendait 140 à 171 px, l'eau
 * 8,7 à 10,5, l'électricité 7,4 à 9,2 — et le plus fin segment de la série, sur
 * le mois encore ouvert, faisait 0,1 px. Deux séries sur trois valaient 5 à 6 %
 * de la troisième. Un empilement dont deux tiers sont invisibles n'encode rien.
 *
 * CE QUE CE SCRIPT REFUSE, ET CE QU'IL N'EXIGE PAS — la distinction est tout.
 *
 * Il ne demande PAS qu'une barre ait une hauteur minimale. `cibles.test.ts`
 * l'interdit, et il a raison : « la hauteur est la donnée, lui imposer un
 * plancher mentirait sur la mesure ». Un plancher de rendu ferait paraître
 * 62 000 et 48 000 de la même taille.
 *
 * Il refuse un ENCODAGE qui produit des segments illisibles. Le remède n'est
 * jamais de gonfler la barre, c'est de changer l'échelle sur laquelle on la
 * trace — ici, de sortir les charges refacturées de la pile du loyer, parce que
 * ce ne sont pas des sommes de même nature : l'une est un revenu, l'autre une
 * avance récupérée.
 *
 * CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE :
 *   — la PERTINENCE de l'encodage. Deux tracés séparés valent-ils mieux qu'une
 *     pile ? Aucune garde ne le sait. Celle-ci constate qu'un segment mesure
 *     moins d'un pixel, ce qui est vérifiable ;
 *   — les autres graphiques du produit. `MiniBarChart` n'a qu'une série et
 *     l'anneau est gardé par `couleur-non-seule`. Seul l'histogramme du tableau
 *     de bord empile plusieurs séries, et c'est le seul que ce script ouvre ;
 *   — la LISIBILITÉ D'UNE COULEUR. Deux séries de même teinte et de bonne
 *     hauteur passeraient ici et échoueraient ailleurs.
 *
 *   node scripts/series-lisibles.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici.
 */
import { chromium } from 'playwright'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { exigerUnPortLibre } from './port-libre.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4194
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LE PLANCHER DE LISIBILITÉ : 8 px de hauteur rendue.
 *
 * Ce n'est pas un chiffre de convention. C'est la hauteur en dessous de
 * laquelle une bande de couleur, sur un écran de téléphone tenu à bout de bras
 * et lu en plein jour, cesse d'être une quantité pour devenir un filet. Les
 * deux séries écrasées valaient 8,7 et 7,4 px À LEUR MAXIMUM — donc à peine
 * au-dessus — et 0,1 px à leur minimum.
 *
 * Le livré mesure 16,3 px au pire, soit le double du plancher. Cet intervalle
 * est ce qui rend la garde falsifiable plutôt que décorative : la mutation qui
 * remet l'empilement rend 0,4 px et rougit de très loin.
 */
const PLANCHER_PX = 8

/** Les largeurs où la zone de tracé change de hauteur. */
const LARGEURS = [360, 1280]
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS `LARGEURS.length`.

  Le dériver de la liste surveillée rend la garde d'accord avec elle-même :
  vider `LARGEURS`, et l'inspection compare 0 à 0 puis se déclare verte.

  2 = le tableau de bord, aux deux largeurs de référence.
*/
const ATTENDUS = 2
/** Trois séries : loyer, eau, électricité. Une série absente est un défaut. */
const SERIES_ATTENDUES = 3

/* LE PAQUET AVANT TOUT LE RESTE : ce script mesure `dist/`, jamais les
   sources. Un paquet périmé rendrait un verdict sur le code d'AVANT, en
   silence — voir `paquet-a-jour.mjs`, qui porte les trois cas mesurés. */
exigerUnPaquetAJour()

async function servir() {
  /*
    LE PORT DOIT ÊTRE LIBRE AVANT QU'ON LANCE QUOI QUE CE SOIT.

    `--strictPort` fait échouer Vite au lieu de le déplacer, et cela ne suffit
    PAS — un témoin l'a montré : port occupé par un intrus, Vite meurt, et la
    boucle d'attente reçoit un 200 de l'intrus AVANT que la mort du fils ne
    remonte. La porte mesurait un serveur qu'elle n'avait pas lancé, et rendait
    vert.

    Surveiller la sortie du fils ne corrige pas cette course : `npx` est le fils,
    Vite le petit-fils, et la réponse de l'intrus arrive la première. Le seul
    contrôle qui ne court pas est celui qui précède : si quelque chose répond
    déjà sur ce port, on refuse.

    CE N'EST PAS UNE HYPOTHÈSE. Relevé le 2026-09-01 : quatre prévisualisations
    orphelines tournaient encore — 4183, 4188, 4193, 4199 —, la plus ancienne
    depuis deux jours et dix-huit heures. Elles survivent à toute porte
    interrompue avant son `kill`.

    Le dégât est resté théorique ici : `vite preview` sert `dist/` au fil des
    requêtes, et l'orphelin rendait les mêmes octets. Il cesse de l'être dès
    qu'un orphelin vient d'un AUTRE dossier de travail — une seconde copie du
    dépôt, une branche comparée — et la porte rendrait alors un vert sur un
    paquet que personne n'a construit.
  */
  await exigerUnPortLibre('series-lisibles', BASE, PORT)
  /*
    `--strictPort` : UNE PORTE NE MESURE PAS UN SERVEUR QU'ELLE N'A PAS LANCÉ.

    Sans lui, `vite preview` trouve le port occupé et se déplace SANS BRUIT sur
    le suivant. La porte, elle, continue d'interroger le port qu'elle a demandé
    — et mesure donc ce qui s'y trouvait déjà.

    CE N'EST PAS UNE HYPOTHÈSE. Relevé le 2026-09-01 : QUATRE serveurs de
    prévisualisation orphelins tournaient encore, sur 4183, 4188, 4193 et 4199,
    le plus ancien depuis deux jours et dix-huit heures. Ils survivent quand une
    porte est interrompue avant son `kill` — un Ctrl-C, un délai dépassé, une
    session fermée.

    Ici le dégât est resté théorique : `vite preview` sert `dist/` au fil des
    requêtes, et l'orphelin rendait donc les mêmes octets que son successeur.
    Il cesse de l'être dès qu'un orphelin vient d'un AUTRE dossier de travail —
    une seconde copie du dépôt, une branche en cours de comparaison — et la
    porte rendrait alors un vert sur un paquet que personne n'a construit.

    Le drapeau fait échouer le démarrage au lieu de le déplacer. Une porte qui
    ne peut pas s'exécuter doit le DIRE, pas se rabattre sur autre chose.
  */
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  /*
    L'ORPHELIN S'EMPÊCHE ICI, il ne se détecte plus seulement. Le contrôle de
    pré-vol ci-dessus a été écrit APRÈS avoir trouvé quatre prévisualisations
    orphelines — la plus ancienne depuis deux jours et dix-huit heures — nées
    de portes interrompues avant leur `kill` : un Ctrl-C tue le script et
    laisse le serveur. Ces deux lignes attrapent l'interruption et emportent
    le fils avec elles ; le pré-vol reste, pour les morts qu'aucun signal
    n'annonce — un SIGKILL, une machine éteinte.
  */
  const emporter = () => {
    fils.kill()
    process.exit(130)
  }
  process.once('SIGINT', emporter)
  process.once('SIGTERM', emporter)
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE + '/')).ok) return fils
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error('series-lisibles : le serveur de prévisualisation n’a pas répondu.')
}

const serveur = await servir()
const plaintes = []
const releve = []
let inspectes = 0

try {
  const navigateur = await chromium.launch()
  for (const largeur of LARGEURS) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: largeur, height: 900 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    await imposerLaPoliceLarge(contexte)
    const page = await contexte.newPage()
    await page.goto(BASE + '/demo', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    /* L'ANIMATION DE CROISSANCE DOIT ÊTRE FINIE. Sans cette attente, la mesure
       attrape des colonnes en cours de montée et rend 1,7 px pour une barre qui
       en fera 108 — la garde rougirait sur un produit correct. */
    await page.waitForTimeout(1800)

    const m = await page.evaluate(() => {
      const fig = [...document.querySelectorAll('figure')].find(
        (f) => f.querySelector('button[aria-label]') && f.querySelector('table'),
      )
      if (!fig) return null
      /* On regroupe par TEINTE : c'est ce qui identifie une série à l'œil, et
         la trame du mois ouvert est comptée à part — elle rend une image de
         fond, pas une couleur. */
      const parSerie = {}
      for (const sp of fig.querySelectorAll('span[style*="height"] > span[style]')) {
        const st = getComputedStyle(sp)
        const h = Number(sp.getBoundingClientRect().height.toFixed(1))
        if (h <= 0) continue
        const cle = st.backgroundImage !== 'none' ? 'periode-ouverte' : st.backgroundColor
        ;(parSerie[cle] ??= []).push(h)
      }
      return Object.fromEntries(
        Object.entries(parSerie).map(([k, v]) => [k, { min: Math.min(...v), max: Math.max(...v), n: v.length }]),
      )
    })
    await contexte.close()

    if (!m) {
      plaintes.push(
        `@${largeur} : l'histogramme du tableau de bord est introuvable.\n` +
          "   Absence de mesure, et non absence de défaut : la garde refuse.",
      )
      continue
    }
    const series = Object.entries(m).filter(([k]) => k !== 'periode-ouverte')
    inspectes++
    releve.push({ largeur, series })

    if (series.length < SERIES_ATTENDUES) {
      plaintes.push(
        `@${largeur} : ${series.length} série(s) distincte(s) pour ${SERIES_ATTENDUES} attendues.\n` +
          "   Une série qu'on ne trouve pas est une série dont la lisibilité n'est pas prouvée.",
      )
    }
    for (const [teinte, v] of series) {
      if (v.min < PLANCHER_PX) {
        plaintes.push(
          `@${largeur} : la série ${teinte} descend à ${v.min} px de hauteur rendue ` +
            `(plancher ${PLANCHER_PX}, maximum de la série ${v.max}).\n` +
            "   Le remède n'est PAS un plancher de rendu — il mentirait sur la donnée — mais un\n" +
            "   encodage où cette série a sa propre échelle. Voir l'en-tête de ce script.",
        )
      }
    }
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

if (inspectes === 0) {
  plaintes.push(
    "AUCUN graphique inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} graphique(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}

for (const r of releve) {
  console.log(
    `  @${String(r.largeur).padEnd(6)} ` +
      r.series.map(([, v]) => `${v.min}→${v.max} px (n=${v.n})`).join('  ·  '),
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ series-lisibles : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ series-lisibles : ${inspectes}/${ATTENDUS} graphiques, ${SERIES_ATTENDUES} séries chacun,\n` +
    `  toutes au-dessus du plancher de ${PLANCHER_PX} px de hauteur rendue.\n` +
    "  Ce script ne dit RIEN de la pertinence d'un encodage — voir son en-tête.",
)
