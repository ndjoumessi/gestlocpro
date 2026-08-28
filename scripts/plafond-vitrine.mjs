#!/usr/bin/env node
/**
 * LA PAGE PUBLIQUE NE REGROSSIT PAS.
 *
 * LE DÉFAUT, ET IL EST PASSÉ SOUS TOUS LES RADARS. Pendant que la refonte
 * retirait 159 à 232 px à chaque écran applicatif, la vitrine a GRANDI de 53 px
 * en français et de 170 px en anglais : le repli du bas de l'échelle
 * typographique — 13 px vers 14 — l'a payée, et rien ne mesurait sa hauteur.
 * Aucune garde ne surveillait le seul écran que voit un visiteur qui n'a pas de
 * compte, et c'est celui qui décide s'il en ouvre un.
 *
 * CE QUE CE SCRIPT MESURE. La hauteur de document de la vitrine, aux deux
 * largeurs de référence et dans LES DEUX LANGUES — parce que l'anglais y est
 * plus long que le français, et que c'est lui qui avait le plus grossi.
 *
 * CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE :
 *   — la HAUTEUR DES SECTIONS prise une par une. Une section qui doublerait
 *     pendant qu'une autre disparaîtrait laisserait le total inchangé et ce
 *     script vert. Il garde une somme, pas une composition ;
 *   — la LISIBILITÉ, la hiérarchie, le nombre de tailles typographiques. Une
 *     page plus courte n'est pas une page mieux écrite, et prétendre le
 *     contraire ferait de cette garde une décoration ;
 *   — les neuf autres largeurs de `mesure-ui`. La vitrine se recompose à `sm`
 *     et à `lg` ; 360 et 1280 sont de part et d'autre des deux, et une
 *     troisième largeur mesurerait la même chose une troisième fois ;
 *   — les autres écrans publics — connexion, inscription, mot de passe oublié.
 *     Ils tiennent en une fenêtre et leur hauteur est portée par leur
 *     formulaire, pas par une composition éditoriale.
 *
 *   node scripts/plafond-vitrine.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4193
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES PLAFONDS, ET CE QU'ILS CONCÈDENT.
 *
 * `avant` est la mesure d'avant ce lot ; `origine` celle d'avant toute la
 * refonte. Les deux sont gardées parce qu'elles racontent deux choses : la
 * seconde dit d'où l'on part, la première dit ce que le dernier geste a coûté
 * ou rendu. Un plafond seul n'est qu'un nombre.
 *
 * Le plafond est le MESURÉ, sans marge : le faire monter demande de récrire ces
 * lignes, donc de dire pourquoi dans le diff.
 */
const PLAFONDS = [
  { largeur: 360, langue: 'fr', plafond: 10209, avant: 9979, origine: 11419 },
  { largeur: 360, langue: 'en', plafond: 10070, avant: 9862, origine: 11149 },
  { largeur: 1280, langue: 'fr', plafond: 7092, avant: 6973, origine: 7110 },
  { largeur: 1280, langue: 'en', plafond: 7166, avant: 7047, origine: 7106 },
]
/*
  ═══ CE QUE CE RESSERREMENT DIT, ET CE QU'IL NE DIT PAS ═══

  LE TÉLÉPHONE A VRAIMENT MAIGRI, de 1 216 px en français et 1 213 en anglais —
  environ 11 %. Tout vient d'un seul endroit : la grille de tarifs, qui passait
  1 992 px à empiler trois cartes que personne ne pouvait comparer, et qui rend
  désormais une rangée d'onglets portant les trois prix. Le raisonnement est
  dans `PricingSection`, la garde dans `tarifsComparables.test.tsx`.

  LE BUREAU N'A PAS BOUGÉ, et les deux lignes du bas ne sont pas un gain. Elles
  étaient à 7 080 et 7 119 pour un mesuré de 7 017 et 7 091 : soixante-trois et
  vingt-huit pixels de MOU, laissés par un lot antérieur qui avait raccourci la
  page sans redescendre son plafond. Vérifié en remisant ce lot et en remesurant
  — la base valait déjà 7 017 / 7 091 sans lui.

  Les deux corrections sont écrites dans le même diff, mais elles ne sont pas de
  la même nature, et les confondre reviendrait à s'attribuer un gain qu'on n'a
  pas fait. `avant` porte la mesure réelle d'avant ce lot, y compris là où elle
  est égale au plafond : une colonne qui ne bouge pas est une information.

  ═══ LE TÉLÉPHONE REPREND 79 PX, ET C'EST UNE DETTE PAYÉE ═══

  Lot suivant, sens inverse : 9 869 → 9 948 en français, 9 743 → 9 838 en
  anglais. Les deux indicateurs du pied de l'accroche — taux d'occupation et
  reste à percevoir — cessent d'être divisés sans condition en deux colonnes et
  se replient sous un plancher.

  CE QUE LA DIVISION RIGIDE COÛTAIT, mesuré : à 320, deux colonnes de 111 px pour
  « 447 000 FCFA » qui en réclame 129 — le montant sortait de sa boîte de 18 px.
  À 360, 131 px pour 129 : deux pixels, ce qui n'est pas une marge. Le montant est
  composé par `Intl` avec des espaces insécables ; on ne le coupe pas, on lui rend
  la place.

  Quatre-vingts pixels sur près de dix mille, contre un montant qui débordait aux
  deux largeurs les plus étroites du marché visé. La page n'a pas grandi par
  négligence : elle a payé une dette que le plafond, seul, aurait laissée courir —
  il ne mesure qu'une somme, et une somme ne dit rien de ce qui déborde dedans.

  ═══ TRENTE ET UN PIXELS DE PLUS POUR UN SIGNE QUI SE VOIT ═══

  Lot suivant : 9 948 → 9 979 en français, 9 838 → 9 862 en anglais. Le dépliant
  de chaque question était un chevron de 18 px en `text-muted` — la teinte des
  textes SECONDAIRES, pour le seul signe qui dise « ceci s'ouvre ». Il devient un
  rond d'accent plein de 36 px, et la rangée passe de 56 à 68 px : douze pixels
  par question, cinq questions.

  On paie donc six pixels par question, et c'est le sens de l'échange : sur un
  téléphone, l'affordance de dépliement est ce que le doigt cherche, et un
  chevron gris de 18 px n'est pas ce qu'on trouve. Le pied, lui, a maigri de
  484 à 380 px — mais au-delà de `sm` seulement, où ses liens se replient en deux
  colonnes ; à 360 ils restent empilés, deux cibles de 44 px côte à côte dans
  360 px de fenêtre étant précisément ce que le plancher existe pour éviter. Le
  gain ne compense donc pas ici, et il ne doit pas.

  AU BUREAU, EN REVANCHE, LE PIED REND 44 px — et cette fois c'est bien un gain
  de ce lot, contrairement au resserrement précédent qui n'était que du mou.
  Vérifié : les deux largeurs de 1280 passent de 7 017 et 7 091 à 6 973 et 7 047,
  et rien d'autre n'y a changé.

  ═══ +230 px À 360, +119 AU BUREAU : TROIS SECTIONS ENRICHIES ═══

  Lot suivant, et c'est la plus forte hausse depuis la refonte. Elle est
  DEMANDÉE : trois sections dont le défaut était d'être maigres.

    LES QUATRE FRICTIONS — le numéro passe de `text-caps` à `text-kpi`, soit de
    douze à vingt-six pixels, et la carte gagne un filet d'accent de 4 px. Le
    chiffre était rendu au rang d'un SURTITRE, c'est-à-dire de ce qui nomme une
    section, alors qu'il ne nomme rien : il compte. À 360 les quatre cartes
    s'empilent, donc l'écart s'y multiplie par quatre.

    LES TROIS CHIFFRES DE COUVERTURE — les valeurs deviennent des gélules
    bordées. Quatre noms de pays posés côte à côte se repliaient en deux lignes
    ragées où « Congo-Brazzaville Tchad » se lisait comme une seule entrée. Une
    bordure par valeur rend le compte VISIBLE, au prix d'un rembourrage.

    LA CLÔTURE — l'appel est borné par un panneau. Il partageait l'encre du pied
    sans rien entre eux : le lecteur arrivait au bout de la page devant une masse
    indistincte. Le panneau coûte son rembourrage, et c'est ce rembourrage qui
    fait exister la limite.

  Deux virgule trois pour cent à 360. La page reste à 1 210 px sous son état
  d'avant la refonte, et c'est le seul repère qui compte ici : ce plafond garde
  une somme, il ne dit rien de ce que cette somme achète.
*/
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS `PLAFONDS.length`.

  Le dériver de la liste surveillée rend la garde d'accord avec elle-même :
  vider `PLAFONDS`, et l'inspection compare 0 à 0 puis se déclare verte. La même
  mutation a trouvé ce piège quatre lots de suite.

  4 = deux largeurs × deux langues.
*/
const ATTENDUS = 4

/**
 * LE NOMBRE DE SECTIONS, GARDÉ AVEC LA HAUTEUR.
 *
 * Sans lui, la façon la plus simple de passer sous le plafond serait de
 * SUPPRIMER une section — la page raccourcirait et la garde applaudirait. Ce
 * n'est pas ce qu'on veut : on veut la même page, plus dense. Le compte est
 * écrit, pas dérivé.
 */
const SECTIONS_ATTENDUES = 8

async function servir() {
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE + '/')).ok) return fils
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error('plafond-vitrine : le serveur de prévisualisation n’a pas répondu.')
}

const serveur = await servir()
const plaintes = []
const releve = []
let inspectes = 0

try {
  const navigateur = await chromium.launch()
  for (const point of PLAFONDS) {
    const contexte = await navigateur.newContext({
      viewport: { width: point.largeur, height: 800 },
      locale: point.langue === 'fr' ? 'fr-FR' : 'en-US',
      colorScheme: 'light',
    })
    const page = await contexte.newPage()
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('gestloc.lang', l)
      } catch {
        /* stockage refusé : la langue reste celle du contexte */
      }
    }, point.langue)
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)

    const m = await page.evaluate(() => {
      const main = document.querySelector('main')
      /* La première action visible du contenu : c'est elle qu'un visiteur doit
         atteindre sans défiler longtemps. */
      const cta = [...main.querySelectorAll('a')].find((a) => {
        const s = getComputedStyle(a)
        const r = a.getBoundingClientRect()
        return s.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.height > 20
      })
      return {
        hDoc: document.documentElement.scrollHeight,
        sections: main ? main.children.length : 0,
        actionY: cta ? Math.round(cta.getBoundingClientRect().top + window.scrollY) : null,
      }
    })
    await contexte.close()

    const nom = `${point.langue}@${point.largeur}`
    inspectes++
    releve.push({ nom, ...m, ...point })

    if (m.hDoc > point.plafond) {
      plaintes.push(
        `${nom} : ${m.hDoc} px de document pour un plafond de ${point.plafond}.\n` +
          `   Avant ce lot : ${point.avant}. Avant la refonte : ${point.origine}.\n` +
          "   C'est le seul écran que voit un visiteur sans compte, et celui qui décide\n" +
          "   s'il en ouvre un.",
      )
    }
    if (m.sections !== SECTIONS_ATTENDUES) {
      plaintes.push(
        `${nom} : ${m.sections} section(s) pour ${SECTIONS_ATTENDUES} attendue(s).\n` +
          '   Raccourcir la page en lui retirant une section n’est pas la densifier.',
      )
    }
    if (m.actionY === null) {
      plaintes.push(`${nom} : aucune action principale trouvée dans le contenu.`)
    }
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

if (inspectes === 0) {
  plaintes.push(
    "AUCUN état inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} état(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}

for (const r of releve) {
  console.log(
    `  ${r.nom.padEnd(10)} ${String(r.hDoc).padStart(6)} px  (plafond ${String(r.plafond).padStart(6)} · ` +
      `avant ce lot ${String(r.avant).padStart(6)} · avant la refonte ${String(r.origine).padStart(6)})  ` +
      `${r.sections} sections · action à ${r.actionY} px`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ plafond-vitrine : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ plafond-vitrine : ${inspectes}/${ATTENDUS} états sous leur plafond, ${SECTIONS_ATTENDUES} sections intactes.\n` +
    "  Ce script garde une SOMME, pas une composition, et ne dit rien de la lisibilité —\n" +
    '  voir son en-tête.',
)
