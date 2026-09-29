#!/usr/bin/env node
/**
 * UN MENU QUI RECOUVRE SA FICHE DIT SUR QUOI IL AGIT.
 *
 * ═══ LE DÉFAUT, ET SA MESURE ═══
 *
 * Mesuré le 2026-09-29 sur `/demo/parc` : ouvrir le menu d'une fiche de
 * logement recouvre 67 % de cette fiche. Le panneau fait 276 px de large pour
 * une fiche de 288. Ce qui disparaît dessous : le nom du locataire, la
 * typologie, le loyer — c'est-à-dire tout ce qui dit QUEL logement on est en
 * train de retirer, pendant que le panneau affirme « Des paiements ou un bail y
 * sont rattachés ».
 *
 * ═══ LE SUJET EXISTAIT DÉJÀ, ET POUR PERSONNE ═══
 *
 * Chaque entrée porte son `nomAccessible` complet — « Retirer le logement B1 ».
 * Une synthèse vocale sait donc toujours sur quoi elle agit ; l'œil, non. C'est
 * exactement le défaut que ce dépôt a déjà nommé une fois, dans ce même menu :
 * « LA RAISON SE LIT, au lieu de n'exister que pour la synthèse vocale ». La
 * règle vaut aussi pour le sujet.
 *
 * ═══ CE QUE CE SCRIPT MESURE ═══
 *
 * Il ouvre le menu de chaque fiche, calcule l'aire du panneau QUI TOMBE SUR la
 * fiche, et n'exige quelque chose que si elle dépasse la moitié : au-delà, la
 * fiche ne se lit plus, et le panneau doit porter le nom de son sujet.
 *
 * LE SEUIL EST UNE RÈGLE, PAS UN PLAFOND MESURÉ. Il ne descend pas avec les
 * mesures : un menu qui couvrirait 49 % de sa fiche laisserait encore lire
 * l'essentiel, et exiger le nom partout alourdirait les menus d'en-tête, qui
 * ne couvrent rien — 3 % mesurés sur celui d'un immeuble.
 *
 * IL NE MESURE PAS ce que le panneau cache d'autre que sa propre fiche : un
 * menu recouvre toujours quelque chose, et c'est le propre d'un menu.
 *
 *   node scripts/menu-qui-couvre.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { exit } from 'node:process'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'

const PORT = 4184
const BASE = `http://127.0.0.1:${PORT}`

/** Au-delà de cette part de la fiche recouverte, le panneau doit se nommer. */
const RECOUVREMENT_QUI_OBLIGE = 0.5

/*
  QUATRE FICHES PAR LARGEUR, ET LE COMPTE EST ÉCRIT.

  Quatre plutôt que douze : les fiches du rail au-delà de la quatrième sont hors
  du champ visible, et un panneau ancré à un déclencheur hors champ se pose hors
  champ — on mesurerait alors le rail, pas le menu. Quatre suffisent : le
  panneau est le MÊME composant sur les douze.

  Le dériver du nombre de fiches trouvées rendrait la garde d'accord avec
  elle-même : un rail vide passerait au vert.
*/
const FICHES_PAR_LARGEUR = 4
const LARGEURS = [1280, 1920]
const ATTENDUS = FICHES_PAR_LARGEUR * LARGEURS.length

const serveur = await servirLaPrevisualisation('menu-qui-couvre', PORT)
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
    await page.goto(BASE + '/demo/parc', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    /* La donnée, pas l'immobilité : on attend les fiches, pas un délai. */
    await page
      .waitForFunction(
        (n) => document.querySelectorAll('#main [data-fiche-logement]').length >= n,
        FICHES_PAR_LARGEUR,
        { timeout: 10000 },
      )
      .catch(() => {})

    for (let rang = 0; rang < FICHES_PAR_LARGEUR; rang++) {
      const mesure = await page.evaluate(
        async ({ rang, seuil }) => {
          const fiches = [...document.querySelectorAll('#main [data-fiche-logement]')]
          const fiche = fiches[rang]
          if (!fiche) return null
          const sujet = fiche.querySelector('[data-section="entete"] a')
          const nom = sujet ? sujet.textContent.trim() : null
          const declencheur = fiche.querySelector('button[aria-haspopup], button[aria-expanded]')
          if (!declencheur || !nom) return null

          fiche.scrollIntoView({ block: 'center', inline: 'center' })
          await new Promise((r) => setTimeout(r, 150))
          declencheur.click()
          await new Promise((r) => setTimeout(r, 350))

          /* LA SURFACE PEINTE, et non l'élément `role="menu"` : depuis que le
             rôle est descendu sur la liste des entrées, il ne couvre plus le
             titre de sujet ni le rembourrage du panneau. Mesurer le rôle
             sous-estimerait le recouvrement de ce que l'œil voit. */
          const panneau = document.querySelector('[data-surface-de-menu]')
          if (!panneau) return { nom, panneau: false }

          const f = fiche.getBoundingClientRect()
          const p = panneau.getBoundingClientRect()
          const largeurCommune = Math.max(0, Math.min(f.right, p.right) - Math.max(f.left, p.left))
          const hauteurCommune = Math.max(0, Math.min(f.bottom, p.bottom) - Math.max(f.top, p.top))
          const part = f.width * f.height > 0 ? (largeurCommune * hauteurCommune) / (f.width * f.height) : 0

          /*
            LE SUJET EST-IL ÉCRIT DANS LE PANNEAU ? On cherche un ÉLÉMENT dont
            le texte EST le nom, et non le nom dans le texte concaténé du
            panneau.

            Une première rédaction cherchait « A1 » entouré de non-lettres dans
            `panneau.textContent`. Ce texte vaut « A1Corriger Déplacer… » : le
            « C » de « Corriger » suit le « 1 » sans séparateur, la frontière
            n'existe pas, et la garde restait ROUGE sur un panneau qui portait
            bel et bien son titre. C'est le piège déjà mesuré dans ce dépôt sur
            « B7Occupant » — un `textContent` n'a pas de frontières de mot.

            On ne lit que le texte VISIBLE : les `aria-label` des entrées
            portent le sujet depuis toujours, et c'est précisément ce qui ne se
            voyait pas.
          */
          const nomme = [...panneau.querySelectorAll('*')].some(
            (e) => e.textContent.trim() === nom,
          )

          declencheur.click()
          await new Promise((r) => setTimeout(r, 150))
          return { nom, panneau: true, part: Math.round(part * 100), nomme, seuil }
        },
        { rang, seuil: RECOUVREMENT_QUI_OBLIGE },
      )

      const nomDuPoint = `/demo/parc#${rang + 1}@${largeur}`
      if (mesure === null) {
        plaintes.push(
          `${nomDuPoint} : ni fiche, ni sujet, ni déclencheur.\n` +
            '   Absence de mesure, et non absence de défaut : la garde refuse.',
        )
        continue
      }
      if (!mesure.panneau) {
        plaintes.push(
          `${nomDuPoint} (${mesure.nom}) : le déclencheur n’a ouvert aucun panneau.\n` +
            '   Un menu qui ne s’ouvre pas n’est pas un menu qui ne couvre rien.',
        )
        continue
      }
      inspectes++
      releve.push({ point: nomDuPoint, ...mesure })
      if (mesure.part >= RECOUVREMENT_QUI_OBLIGE * 100 && !mesure.nomme) {
        plaintes.push(
          `${nomDuPoint} : le menu recouvre ${mesure.part} % de la fiche « ${mesure.nom} », ` +
            'et ne la nomme nulle part.\n' +
            '   Sous le panneau : le locataire, la typologie, le loyer — tout ce qui dit QUEL\n' +
            '   logement on retire. Les entrées le savent, dans leur `nomAccessible` ; l’œil non.',
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
    "AUCUN menu inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} menu(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}

for (const r of releve) {
  console.log(
    `  ${r.point.padEnd(26)} ${String(r.part).padStart(3)} % de la fiche recouverts · ` +
      `sujet « ${r.nom} » ${r.nomme ? 'nommé dans le panneau' : 'ABSENT du panneau'}`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ menu-qui-couvre : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ menu-qui-couvre : ${inspectes}/${ATTENDUS} menus — aucun ne couvre sa fiche sans la nommer.\n` +
    '  Ce script ne dit RIEN de ce qu’un panneau cache d’autre que sa propre fiche.',
)
