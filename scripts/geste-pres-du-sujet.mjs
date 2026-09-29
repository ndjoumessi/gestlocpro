#!/usr/bin/env node
/**
 * UN GESTE RESTE PRÈS DE CE SUR QUOI IL AGIT.
 *
 * ═══ LE DÉFAUT, ET SA MESURE ═══
 *
 * Une rangée pose un sujet à gauche et le geste qui le suit à droite, et elle
 * s'étirait entre les deux. Mesuré à 1920 px, APRÈS que la colonne de lecture
 * ait été bornée à 1 280 px (`COLONNE_DE_LECTURE`, lot précédent) :
 *
 *   /demo/travaux   « Remplacement du groupe de sécurité » → son bloc    585 px
 *   /demo/acces     le code en attente → « Reprendre »                   793 px
 *
 * La borne de la colonne avait déjà retiré 380 px ; ce qui reste ne vient pas
 * de la fenêtre, il vient de la rangée. Deux mécanismes le produisent :
 *
 *   — une TABLE en `w-full` répartit son mou entre ses colonnes, donc une table
 *     de quatre colonnes courtes occupe 1 212 px pour 485 px de contenu ;
 *   — une RANGÉE en flex donne tout le mou à la colonne du titre, et la grappe
 *     de gestes, collée au bord droit, part d'un x différent à chaque ligne.
 *
 * ═══ CE QUE CE SCRIPT MESURE ═══
 *
 * La distance entre la fin de l'encre du SUJET d'une rangée — son `<h2>`, ou
 * son `<th scope="row">` — et le début de l'encre de son BLOC DE FIN, le
 * dernier enfant de la rangée. C'est ce qu'un œil traverse, et rien d'autre.
 *
 * L'ENCRE, PAS LA BOÎTE, et c'est mesuré : une grappe en `ml-auto` a une boîte
 * qui commence bien avant son premier pixel peint. Prendre le bord de la boîte
 * ferait croire à un gain là où rien n'a bougé — cette sonde a rendu 924 px de
 * « départ commun » pendant que les chiffres visibles n'avaient pas changé.
 *
 * IL NE MESURE PAS les rangées sans geste : une ligne qui ne propose rien n'a
 * pas de distance à tenir. Elles sont ignorées, et le COMPTE des rangées
 * mesurées est écrit ci-dessous — sans quoi une rangée qui perdrait son geste
 * ferait verdir la porte en disparaissant de la mesure.
 *
 * ═══ SON PÉRIMÈTRE EST ÉCRIT, ET IL EST ÉTROIT ═══
 *
 * Deux écrans. Le relevé du 2026-09-29 en a trouvé CINQ AUTRES qui portent le
 * même défaut, plus grave, et que ce lot ne corrige pas — leurs nombres sont
 * dans le message de commit. Une règle qui n'existe que là où on l'a violée se
 * reviolera ailleurs ; c'est écrit ici pour que l'extension soit un lot, et non
 * une découverte.
 *
 *   node scripts/geste-pres-du-sujet.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { exit } from 'node:process'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'

const PORT = 4185
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES PLAFONDS, ÉCRAN PAR ÉCRAN ET LARGEUR PAR LARGEUR.
 *
 * `avant` garde la mesure d'avant le lot, colonne de lecture déjà bornée : un
 * plafond seul est un nombre, un plafond avec l'avant est une décision.
 *
 * LE PLAFOND EST LE MESURÉ, SANS MARGE — la règle de `plafond-coquille`, et
 * pour la même raison : dix pixels que personne n'a justifiés sont dix pixels
 * qu'une refonte distraite dépense sans que rien ne le dise.
 *
 * 1280 NE CHANGE PAS SUR LES TRAVAUX, et c'est voulu : la grappe n'y prend sa
 * colonne commune qu'à partir de 1536 px. En dessous, la rangée fait 945 px et
 * imposer 34 rem à la grappe écraserait le titre — mesuré, +217 px de hauteur
 * sur les six rangées, des titres à trois lignes. Le défaut n'existe pas à
 * cette largeur ; le correctif, lui, y ferait des dégâts.
 */
const PLAFONDS = {
  '/demo/travaux': {
    1280: { plafond: 329, avant: 329 },
    1536: { plafond: 345, avant: 585 },
    1920: { plafond: 345, avant: 585 },
    2560: { plafond: 345, avant: 585 },
  },
  '/demo/acces': {
    1280: { plafond: 282, avant: 613 },
    1536: { plafond: 282, avant: 793 },
    1920: { plafond: 282, avant: 793 },
    2560: { plafond: 282, avant: 793 },
  },
}

const LARGEURS = [1280, 1536, 1920, 2560]

/*
  LE COMPTE DES RANGÉES MESURÉES, ÉCRIT À LA MAIN.

  Le dériver de ce qui est trouvé rendrait la garde d'accord avec elle-même :
  une rangée qui perdrait son geste sortirait de la mesure, et la porte
  resterait verte en ayant cessé de regarder. Le même piège a été trouvé trois
  lots de suite par mutation dans ce dépôt.

  6 = les six interventions de la démonstration.
  1 = le seul code en attente.
*/
const RANGEES_ATTENDUES = { '/demo/travaux': 6, '/demo/acces': 1 }
const ATTENDUS = Object.keys(PLAFONDS).length * LARGEURS.length

const serveur = await servirLaPrevisualisation('geste-pres-du-sujet', PORT)
const plaintes = []
const releve = []
let inspectes = 0

try {
  const navigateur = await chromium.launch()
  for (const largeur of LARGEURS) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: largeur, height: 1000 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    await neutraliserLApiLocale(contexte)
    const page = await contexte.newPage()
    for (const adresse of Object.keys(PLAFONDS)) {
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      /* La donnée, pas l'immobilité : on attend que les rangées soient là,
         plutôt qu'un délai qui passerait sur un squelette. */
      await page
        .waitForFunction(
          (n) =>
            document.querySelectorAll('#main [role="listitem"], #main tbody tr').length >= n,
          RANGEES_ATTENDUES[adresse],
          { timeout: 10000 },
        )
        .catch(() => {})

      const mesure = await page.evaluate(() => {
        const main = document.getElementById('main')
        if (!main) return null
        /* La fin de l'encre d'un sujet : le bord droit le plus à droite parmi
           les rectangles de ses nœuds de TEXTE. */
        const finDeLEncre = (el) => {
          let max = 0
          const parcours = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          let n
          while ((n = parcours.nextNode())) {
            if (!n.nodeValue.trim()) continue
            const plage = document.createRange()
            plage.selectNodeContents(n)
            for (const r of plage.getClientRects()) max = Math.max(max, r.right)
          }
          return Math.round(max)
        }
        /*
          LE DÉBUT DE L'ENCRE D'UN BLOC — textes ET dessins.

          Une première rédaction ne regardait que les ÉLÉMENTS SANS ENFANT
          porteurs de texte. Elle a silencieusement sauté la seule rangée de
          `/demo/acces` : son geste est un bouton qui porte une icône ET son
          libellé, donc il a un enfant, et son `<svg>` n'a aucun texte. La
          rangée sortait de la mesure au lieu d'y entrer — un vert par vacuité,
          exactement ce que ce dépôt cherche par mutation.
        */
        const debutDeLEncre = (el) => {
          let min = Infinity
          const texte = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          let n
          while ((n = texte.nextNode())) {
            if (!n.nodeValue.trim()) continue
            const plage = document.createRange()
            plage.selectNodeContents(n)
            for (const r of plage.getClientRects()) if (r.width > 0) min = Math.min(min, r.left)
          }
          for (const dessin of el.querySelectorAll('svg, img')) {
            const r = dessin.getBoundingClientRect()
            if (r.width > 0) min = Math.min(min, r.left)
          }
          return min === Infinity ? null : Math.round(min)
        }

        let pire = null
        let qui = null
        let rangees = 0
        for (const ligne of main.querySelectorAll('[role="listitem"], tbody tr')) {
          const sujet = ligne.querySelector('h2, h3, h4, th')
          if (!sujet) continue
          const fin = finDeLEncre(sujet)
          if (!fin) continue
          const enfants = [...ligne.children].filter(
            (e) => e.getBoundingClientRect().width > 0,
          )
          const bloc = enfants[enfants.length - 1]
          if (!bloc || bloc.contains(sujet)) continue
          const debut = debutDeLEncre(bloc)
          if (debut === null || debut < fin) continue
          rangees++
          const distance = debut - fin
          if (pire === null || distance > pire) {
            pire = distance
            qui = sujet.textContent.trim().slice(0, 34)
          }
        }
        return { pire, qui, rangees }
      })

      const nom = `${adresse}@${largeur}`
      if (mesure === null || mesure.pire === null) {
        plaintes.push(
          `${nom} : aucune rangée mesurée.\n` +
            '   Absence de mesure, et non absence de défaut : la garde refuse.',
        )
        continue
      }
      if (mesure.rangees !== RANGEES_ATTENDUES[adresse]) {
        plaintes.push(
          `${nom} : ${mesure.rangees} rangée(s) mesurée(s) pour ${RANGEES_ATTENDUES[adresse]} attendue(s).\n` +
            '   Une rangée qui sort de la mesure fait verdir la porte sans rien corriger.',
        )
      }
      inspectes++
      const p = PLAFONDS[adresse][largeur]
      releve.push({ nom, ...mesure, ...p })
      if (mesure.pire > p.plafond) {
        plaintes.push(
          `${nom} : ${mesure.pire} px entre « ${mesure.qui} » et son bloc de fin, pour un plafond de ${p.plafond}.\n` +
            `   Avant ce lot : ${p.avant} px.\n` +
            '   C’est la distance qu’un œil traverse pour apparier un fait et le geste qui le suit.',
        )
      }
    }
    await contexte.close()
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

if (inspectes === 0) {
  plaintes.push(
    "AUCUN point inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} point(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}

for (const r of releve) {
  console.log(
    `  ${r.nom.padEnd(24)} ${String(r.pire).padStart(4)} px  ` +
      `(plafond ${String(r.plafond).padStart(4)} · avant ${String(r.avant).padStart(4)} · ` +
      `${r.avant > r.pire ? `−${r.avant - r.pire}` : `+${r.pire - r.avant}`} px)   ${r.qui}`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ geste-pres-du-sujet : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ geste-pres-du-sujet : ${inspectes}/${ATTENDUS} points sous leur plafond de distance.\n` +
    '  Deux écrans seulement — cinq autres portent le même défaut, non gardés. Voir son en-tête.',
)
