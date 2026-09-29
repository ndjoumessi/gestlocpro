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
 *   /demo/travaux        « Remplacement du groupe… » → son bloc       585 px
 *   /demo/signalements   « Devis à arbitrer » → son bloc                 824 px
 *   /demo/acces          le code en attente → « Reprendre »              793 px
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
 * ═══ ET UNE SECONDE RÈGLE : UNE SEULE COLONNE DE DÉPART ═══
 *
 * Rapprocher la grappe ne suffit pas si son contenu part d'une abscisse
 * différente à chaque rangée. Sur `/demo/signalements`, le plancher posé sur la
 * grappe donnait bien UN bord gauche à l'âge — et SIX au lien qui le suit,
 * parce que les âges font de 21 à 93 px. L'irrégularité avait été déplacée.
 *
 * On compte donc les abscisses DISTINCTES des gestes d'un écran. C'est un
 * COMPTE, pas une position : aucune police ne le déplace, donc cette règle n'a
 * pas de seconde colonne et vaut sur les deux machines.
 *
 * ELLE NE S'APPLIQUE QU'À `/demo/signalements`, et le motif est mesuré :
 * `/demo/travaux` en garde QUATRE, et ce n'est pas un défaut. Sa grappe porte
 * une pastille d'état entre le montant et le bouton, dont la largeur EST son
 * libellé — « Devis proposé » contre « Validé ». Fixer la largeur des pastilles
 * pour aligner les boutons laisserait des pastilles à moitié vides : on
 * échangerait une irrégularité contre une fausseté.
 *
 * IL NE MESURE PAS les rangées sans geste : une ligne qui ne propose rien n'a
 * pas de distance à tenir. Elles sont ignorées, et le COMPTE des rangées
 * mesurées est écrit ci-dessous — sans quoi une rangée qui perdrait son geste
 * ferait verdir la porte en disparaissant de la mesure.
 *
 * ═══ SON PÉRIMÈTRE EST ÉCRIT, ET IL A ÉTÉ CORRIGÉ ═══
 *
 * Trois écrans. Un premier relevé en accusait cinq autres ; remesurés avec une
 * sonde qui voit ce qui est PEINT, quatre d'entre eux n'avaient rien :
 *
 *   /demo/paiements   1 056 px annoncés → 612 px de « vide » qui sont six
 *                     colonnes de jauges peintes, sans un caractère
 *   /demo/releves       791 px annoncés → 150 px de vide réel
 *   /demo/cautions      853 px annoncés → 125 px
 *   /demo/mon-espace    524 px annoncés → 148 px
 *
 * Seul `/demo/signalements` était vrai — 660 px de vide réel —, et il est
 * désormais gardé ici. Ces quatre-là n'étaient pas des défauts du produit :
 * c'était ma sonde qui appelait « vide » tout ce qui se lit sans se lire.
 *
 * CE QUI RESTE DEHORS : les écrans qui n'ont pas de rangée à geste, et les
 * modales. Une règle qui n'existe que là où on l'a violée se reviolera
 * ailleurs ; c'est écrit ici pour que l'extension soit un lot, et non une
 * découverte.
 *
 *   node scripts/geste-pres-du-sujet.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { argv, exit } from 'node:process'
import { POLICE_LARGE, imposerLaPoliceLarge } from './police-large.mjs'
import { TEMOIN, laColonneNormalePeutEtreANous, releverLeTemoin } from './temoin-de-la-machine.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'

const PORT = 4185
const BASE = `http://127.0.0.1:${PORT}`

/** `--relever` N'IMPOSE RIEN : il imprime ce que CETTE machine mesure. */
const RELEVER = argv.includes('--relever')

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
    1280: { plafond: 329, plafondLarge: 331, avant: 329 },
    1536: { plafond: 345, plafondLarge: 339, avant: 585 },
    1920: { plafond: 345, plafondLarge: 339, avant: 585 },
    2560: { plafond: 345, plafondLarge: 339, avant: 585 },
  },
  /*
    LES NOTIFICATIONS PORTENT LA MÊME RANGÉE QUE LES TRAVAUX, et le même défaut.
    Relevé le 2026-09-29 : 660 px de vide réel au milieu d'une rangée, la grappe
    de gestes collée au bord droit et partant de SIX x différents sur onze
    rangées. C'est l'écran que Nelson a photographié deux fois — la carte
    « À traiter » du tableau de bord rend les mêmes rangées.
  */
  '/demo/signalements': {
    1280: { plafond: 568, plafondLarge: 571, avant: 568 },
    1536: { plafond: 489, plafondLarge: 488, avant: 824 },
    1920: { plafond: 489, plafondLarge: 488, avant: 824 },
    2560: { plafond: 489, plafondLarge: 488, avant: 824 },
  },
  '/demo/acces': {
    1280: { plafond: 282, plafondLarge: 276, avant: 613 },
    1536: { plafond: 282, plafondLarge: 276, avant: 793 },
    1920: { plafond: 282, plafondLarge: 276, avant: 793 },
    2560: { plafond: 282, plafondLarge: 276, avant: 793 },
  },
}

/**
 * UN PLAFOND APPARTIENT À UNE MACHINE, et celui-ci l'a appris par un rouge.
 *
 * Poussée le 2026-09-29, cette porte a REFUSÉ sur l'exécuteur public ce qu'elle
 * acceptait ici : 295 px sur `/demo/acces` contre 282 mesurés sur la machine de
 * développement, et 296 px sur `/demo/travaux` contre 345. Elle mesure des
 * positions d'ENCRE, donc des largeurs de texte, et `system-ui` vaut SF Pro ici
 * et DejaVu Sans là-bas. Aucun nombre ne vaut sur les deux — c'est exactement ce
 * que `plafond-hauteurs` et `plafond-vitrine` disent de leurs deux colonnes
 * depuis des semaines, et j'ai écrit cette porte sans en tenir compte.
 *
 * RELEVÉ PAR L'EXÉCUTEUR LUI-MÊME le 2026-09-29 (exécution 36592639963) :
 * travaux 331/339, signalements 571/488, accès 276 — contre 329/345, 568/489 et
 * 282 ici. Les écarts sont petits, jusqu'à 6 px, et ils vont DANS LES DEUX SENS :
 * aucune marge unique ne les couvre, seule une seconde colonne le fait.
 *
 * `plafondLarge` APPARTIENT À L'EXÉCUTEUR PUBLIC et ne s'inscrit jamais d'ici :
 * le travail `polices` le relève (`--relever`), et c'est cette sortie-là qu'on
 * recopie. Reproduire ces nombres à la main sous `MESURER_EN_POLICE_LARGE=1`
 * rapprocherait les deux machines sans les confondre — le dépôt l'a mesuré, six
 * plaintes ici contre quatre là-bas sur la même commande.
 *
 * ET LA MACHINE EST INTERROGÉE, PLUS SUPPOSÉE. La première rédaction tenait
 * toute machine sans commutateur pour celle de développement : un conteneur
 * Linux, où `system-ui` EST déjà DejaVu, y aurait rendu un verdict sur une
 * colonne qui n'est pas la sienne — le défaut exact que `temoin-de-la-machine`
 * a documenté le 2026-09-27, avec 366 px de faux dépassement. Le témoin mesure
 * la même chaîne dans `system-ui` et dans `DejaVu Sans` NOMMÉE : égales, cette
 * machine n'est pas celle de la colonne normale, et la porte NE JUGE PLUS — elle
 * relève et le dit. Ne rien juger et se taire seraient la même ligne dans un
 * rapport ; la première est écrite en toutes lettres.
 */
function plafondDe(p) {
  if (!POLICE_LARGE) return p.plafond
  if (typeof p.plafondLarge !== 'number') {
    throw new Error(
      "geste-pres-du-sujet : une entrée de PLAFONDS n'a pas de `plafondLarge`.\n" +
        '  Cette colonne appartient à l’exécuteur public et ne s’invente pas ici.\n' +
        '  Relevez-la par le travail `polices` : `node scripts/geste-pres-du-sujet.mjs --relever`.',
    )
  }
  return p.plafondLarge
}

const LARGEURS = [1280, 1536, 1920, 2560]

/**
 * Les écrans dont les gestes doivent partir d'UNE seule abscisse, et à partir
 * de quelle largeur — en deçà, la grappe n'a pas de plancher et se range comme
 * elle peut. Écrit écran par écran : voir l'en-tête pour ce que `/demo/travaux`
 * fait ici, et pourquoi il n'y est pas.
 */
const COLONNE_UNIQUE_DES_GESTES = { '/demo/signalements': 1536 }

/*
  LE COMPTE DES RANGÉES MESURÉES, ÉCRIT À LA MAIN.

  Le dériver de ce qui est trouvé rendrait la garde d'accord avec elle-même :
  une rangée qui perdrait son geste sortirait de la mesure, et la porte
  resterait verte en ayant cessé de regarder. Le même piège a été trouvé trois
  lots de suite par mutation dans ce dépôt.

  6  = les six interventions de la démonstration.
  11 = les onze notifications.
  1  = le seul code en attente.
*/
const RANGEES_ATTENDUES = { '/demo/travaux': 6, '/demo/signalements': 11, '/demo/acces': 1 }
const ATTENDUS = Object.keys(PLAFONDS).length * LARGEURS.length

const serveur = await servirLaPrevisualisation('geste-pres-du-sujet', PORT)
const plaintes = []
const releve = []
let inspectes = 0
/** Le témoin de la machine — relevé UNE fois : il décrit la machine, pas un point. */
let temoinDeLaMachine = null
/** La colonne comparée nous appartient-elle ? Sous commutateur, oui par construction. */
let colonneANous = true

try {
  const navigateur = await chromium.launch()
  for (const largeur of LARGEURS) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: largeur, height: 1000 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    await imposerLaPoliceLarge(contexte)
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

      /* UNE FOIS SUFFIT, et sur la première page ouverte plutôt que dans une
         page à elle : le témoin décrit la MACHINE, et un lancement de plus se
         paierait pour le même nombre. */
      if (temoinDeLaMachine === null) {
        temoinDeLaMachine = await releverLeTemoin(page)
        if (!POLICE_LARGE) colonneANous = laColonneNormalePeutEtreANous(temoinDeLaMachine)
      }

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
          /*
            ═══ ET CE QUI EST PEINT SANS UN MOT ═══

            La rédaction d'avant comptait le texte et les `svg`/`img`. Elle a
            déclaré 612 px de vide au milieu d'une rangée de `/demo/paiements`
            qui n'en a aucun : les six colonnes de périodes y portent des JAUGES
            — des boîtes de 10 px peintes en vert, sans un caractère. La sonde
            ne voyait pas de texte et concluait au vide.

            Le même relevé avait accusé trois autres écrans pour la même raison.
            Une sonde qui ne voit que les lettres appelle « vide » tout ce qui se
            lit sans se lire : jauges, pastilles, barres de progression.

            On compte donc aussi les boîtes qui PEIGNENT — un fond ou un bord —
            et qui mesurent plus d'un pixel. Le seuil écarte les filets d'un
            pixel et les boîtes nulles, qui ne se voient pas.
          */
          for (const dessin of el.querySelectorAll('svg, img')) {
            const r = dessin.getBoundingClientRect()
            if (r.width > 0) min = Math.min(min, r.left)
          }
          for (const boite of el.querySelectorAll('*')) {
            const r = boite.getBoundingClientRect()
            if (r.width <= 1 || r.height <= 1) continue
            const style = getComputedStyle(boite)
            const peint =
              style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
              parseFloat(style.borderTopWidth) > 0 ||
              parseFloat(style.borderLeftWidth) > 0
            if (peint) min = Math.min(min, r.left)
          }
          return min === Infinity ? null : Math.round(min)
        }

        let pire = null
        let qui = null
        let rangees = 0
        /* Les abscisses des GESTES — un lien, un bouton — de chaque bloc de fin. */
        const abscisses = new Set()
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
          for (const geste of bloc.querySelectorAll('a[href], button')) {
            const r = geste.getBoundingClientRect()
            if (r.width > 0) abscisses.add(Math.round(r.left))
          }
          const distance = debut - fin
          if (pire === null || distance > pire) {
            pire = distance
            qui = sujet.textContent.trim().slice(0, 34)
          }
        }
        return { pire, qui, rangees, colonnes: abscisses.size }
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
      const plafond = RELEVER ? 0 : plafondDe(p)
      releve.push({ nom, adresse, largeur, ...mesure, ...p, plafond })
      if (RELEVER) continue
      const depuis = COLONNE_UNIQUE_DES_GESTES[adresse]
      if (typeof depuis === 'number' && largeur >= depuis && mesure.colonnes !== 1) {
        plaintes.push(
          `${nom} : les gestes partent de ${mesure.colonnes} abscisses, pour UNE attendue.\n` +
            '   Un plancher qui range la grappe sans ranger ce qu’elle contient déplace\n' +
            '   l’irrégularité au lieu de la retirer. C’est un COMPTE : aucune police ne le change.',
        )
      }
      if (colonneANous && mesure.pire > plafond) {
        plaintes.push(
          `${nom} : ${mesure.pire} px entre « ${mesure.qui} » et son bloc de fin, pour un plafond de ${plafond}.\n` +
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

if (RELEVER) {
  console.log(
    `\nRELEVÉ ${POLICE_LARGE ? 'EN POLICE LARGE' : 'en police du système'} — ${inspectes} point(s).\n` +
      '  Ce mode NE REFUSE RIEN : il imprime ce que cette machine mesure, pour que la\n' +
      "  colonne qu'elle possède soit inscrite depuis SA mesure et non depuis une autre.\n",
  )
  for (const r of releve) {
    console.log(
      `  ${r.adresse} ${r.largeur} → ${POLICE_LARGE ? 'plafondLarge' : 'plafond'}: ${r.pire},`,
    )
  }
  exit(0)
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

const empans = temoinDeLaMachine
  ? ` (« ${TEMOIN} » : system-ui ${temoinDeLaMachine.systeme} px, repli ${temoinDeLaMachine.repli} px)`
  : ''

if (!colonneANous) {
  console.log(
    `\n○ geste-pres-du-sujet : ${inspectes}/${ATTENDUS} points RELEVÉS, aucun jugé.${empans}\n` +
      "  `system-ui` vaut ici la police de repli : cette machine n'est celle d'AUCUNE des deux\n" +
      '  colonnes. Un verdict y porterait sur des mesures qui ne la concernent pas.\n' +
      '  Pour juger la colonne large : MESURER_EN_POLICE_LARGE=1.',
  )
  exit(0)
}

console.log(
  `\n✓ geste-pres-du-sujet : ${inspectes}/${ATTENDUS} points sous leur plafond ` +
    `${POLICE_LARGE ? 'LARGE' : 'normal'} de distance.${empans}\n` +
    '  Trois écrans — le relevé des autres est dans son en-tête.',
)
