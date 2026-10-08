#!/usr/bin/env node
/**
 * LE GESTE DE DÉPLACEMENT SE VOIT, ET LE PANNEAU LE SUIT.
 *
 * ═══ POURQUOI CETTE PORTE EXISTE : DEUX ANGLES MORTS AVOUÉS ═══
 *
 * Deux lots ont livré des propriétés que RIEN ne mesurait, et les deux l'ont
 * écrit dans leur rapport plutôt que de le taire :
 *
 *  1. LA POIGNÉE. La fiche de logement se porte et se dépose depuis le lot du
 *     rail réordonnable ; rien ne l'annonçait, et une poignée a été posée dans
 *     la gouttière gauche. Sa position — cinq pixels à dix-sept, sans mordre
 *     sur le numéro — a été relevée À LA MAIN. `mesure-ui` ne survole rien.
 *
 *  2. LE PANNEAU QUI SUIT. « Déplacer ‹ › » réordonne le rail sans émettre ni
 *     `scroll` ni `resize`, et le panneau du menu restait trois cents pixels en
 *     arrière, au-dessus de la fiche voisine. Le remède — suivre la position du
 *     déclencheur tant que le menu est ouvert — est éprouvé en jsdom avec une
 *     horloge fausse, et N'A JAMAIS TOURNÉ DANS UN VRAI NAVIGATEUR : le volet
 *     de développement est MASQUÉ, `document.hidden` y vaut vrai, et zéro trame
 *     y a été comptée en 800 ms.
 *
 * Ici, Playwright peint pour de bon : `requestAnimationFrame` y est appelé, le
 * survol existe, et la mise en page aussi. C'est le seul endroit du dépôt où
 * ces deux propriétés peuvent être vues.
 *
 * ═══ CE QUE CE SCRIPT NE DIT PAS ═══
 *
 * Il ne mesure pas le porter-déposer AU POINTEUR — la prise, le glissement, la
 * dépose. Il mesure ce que la fiche ANNONCE et ce que le panneau FAIT quand la
 * fiche bouge. Un glisser réel reste gardé par `ficheReordonnable.test.tsx`,
 * en jsdom, avec sa géométrie posée à la main.
 *
 * Il ne juge pas non plus l'ESTHÉTIQUE de la poignée : ni sa teinte, ni son
 * contraste. `couleur-non-seule` ne la voit pas — elle n'est pas un état.
 *
 *   node scripts/geste-qui-se-voit.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { exit } from 'node:process'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'

/*
  4182, ET LE CHOIX EST MESURÉ. La plage 4181-4199 est occupée par les autres
  portes ; 4182 et 4183 étaient les deux seuls trous. 4190 est écarté quoi qu'il
  arrive : c'est un port de la liste WHATWG que `fetch` refuse, et le dépôt a
  déjà payé ce piège — « bad port » alors que le serveur écoute et que curl rend
  200. Un trou dans la plage n'est pas forcément une place libre.
*/
const PORT = 4182
const BASE = `http://127.0.0.1:${PORT}`

/*
  DEUX FICHES, ET LE COMPTE EST ÉCRIT.

  La première pour la poignée, la deuxième pour le déplacement — il lui faut une
  voisine à droite où aller. Les fiches au-delà de la quatrième sont hors du
  champ visible du rail, et un panneau ancré à un déclencheur hors champ se pose
  hors champ : on mesurerait le rail, pas le menu. C'est le même raisonnement,
  et la même limite, que `menu-qui-couvre`.

  Le dériver du nombre de fiches trouvées rendrait la garde d'accord avec
  elle-même : un rail vide passerait au vert.
*/
const FICHES_INSPECTEES = 2

/*
  LA TOLÉRANCE SUR L'ALIGNEMENT, et pourquoi elle n'est pas zéro.

  Le panneau s'aligne à droite de son déclencheur, mais le bord mesuré est celui
  de la SURFACE PEINTE, qui porte son propre rembourrage. L'écart à l'ouverture
  n'est donc pas nul — il valait −20 px au relevé du 2026-10-08. Ce qu'on garde
  n'est pas l'écart lui-même, c'est qu'il NE CHANGE PAS quand la fiche bouge.

  Quatre pixels : de quoi absorber un arrondi de sous-pixel, pas de quoi laisser
  passer les trois cents pixels du défaut d'origine.
*/
const DERIVE_TOLEREE_PX = 4

const serveur = await servirLaPrevisualisation('geste-qui-se-voit', PORT)
const plaintes = []
const releve = []
let inspectes = 0

try {
  const navigateur = await chromium.launch()
  const contexte = await navigateur.newContext({
    ...SANS_AGENT_DE_SERVICE,
    viewport: { width: 1280, height: 900 },
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
      FICHES_INSPECTEES,
      { timeout: 10000 },
    )
    .catch(() => {})

  /* ─── 1. LA POIGNÉE SE VOIT AU SURVOL, SANS MORDRE SUR LE NUMÉRO ─────── */

  const fiches = page.locator('#main [data-fiche-logement]')
  for (let rang = 0; rang < FICHES_INSPECTEES; rang++) {
    const fiche = fiches.nth(rang)
    await fiche.scrollIntoViewIfNeeded().catch(() => {})
    /* LE SURVOL EST UN VRAI SURVOL : `hover()` déplace le pointeur, donc les
       règles `group-hover` s'appliquent pour de bon. C'est ce qu'aucune autre
       porte de ce dépôt ne fait sur une fiche. */
    await fiche.hover().catch(() => {})
    await page.waitForTimeout(250)

    const mesure = await fiche.evaluate((f) => {
      const numero = f.querySelector('[data-section="entete"] a')
      const poignee = f.querySelector('span[aria-hidden="true"] svg')?.closest('span')
      if (!numero || !poignee) return { trouvee: Boolean(poignee), nom: numero?.textContent.trim() }
      const n = numero.getBoundingClientRect()
      const p = poignee.getBoundingClientRect()
      const fr = f.getBoundingClientRect()
      return {
        trouvee: true,
        nom: numero.textContent.trim(),
        opacite: Number(getComputedStyle(poignee).opacity),
        /* En coordonnées DE LA FICHE : les absolues dépendent du défilement du
           rail, et un relevé qu'on ne peut pas relire n'apprend rien. */
        gauche: Math.round(p.left - fr.left),
        droite: Math.round(p.right - fr.left),
        numeroCommenceA: Math.round(n.left - fr.left),
        /* `pointer-events` : la poignée ne doit JAMAIS prendre le pointeur —
           elle couvrirait la zone de frappe du lien, qui est la fiche entière. */
        prendLePointeur: getComputedStyle(poignee).pointerEvents !== 'none',
      }
    })

    const point = `/demo/parc#${rang + 1} poignée`
    if (!mesure.trouvee) {
      plaintes.push(
        `${point} : aucune poignée sous un span \`aria-hidden\`.\n` +
          "   Absence de mesure, et non absence de défaut : la garde refuse.",
      )
      continue
    }
    inspectes++
    if (mesure.opacite === 0) {
      plaintes.push(
        `${point} (${mesure.nom}) : invisible alors que la fiche est survolée.\n` +
          '   Le geste existe et rien ne l’annonce — c’est le défaut que cette poignée referme.',
      )
    }
    if (mesure.droite > mesure.numeroCommenceA) {
      plaintes.push(
        `${point} (${mesure.nom}) : elle s’étend jusqu’à ${mesure.droite} px et le numéro ` +
          `commence à ${mesure.numeroCommenceA}.\n` +
          '   Elle mord sur le numéro ; sa place est la gouttière, pas le texte.',
      )
    }
    if (mesure.prendLePointeur) {
      plaintes.push(
        `${point} (${mesure.nom}) : elle prend le pointeur.\n` +
          '   Elle couvre alors la zone de frappe du lien, qui est la fiche entière.',
      )
    }
    releve.push(
      `  ${point.padEnd(28)} ${mesure.gauche}→${mesure.droite} px, numéro à ` +
        `${mesure.numeroCommenceA} · opacité ${mesure.opacite}`,
    )
  }

  /* ─── 2. LE PANNEAU SUIT SA FICHE QUAND ELLE SE DÉPLACE ──────────────── */

  const suivi = await page.evaluate(async (tolerance) => {
    const lire = () => [...document.querySelectorAll('#main [data-fiche-logement]')]
    const ordre = () =>
      lire().map((f) => f.querySelector('[data-section="entete"] a')?.textContent.trim())

    const fiche = lire()[0]
    if (!fiche) return { etape: 'aucune fiche' }
    const declencheur = fiche.querySelector('button[aria-haspopup], button[aria-expanded]')
    const nom = fiche.querySelector('[data-section="entete"] a')?.textContent.trim()
    if (!declencheur || !nom) return { etape: 'ni déclencheur ni nom' }

    fiche.scrollIntoView({ block: 'center', inline: 'center' })
    await new Promise((r) => setTimeout(r, 150))
    declencheur.click()
    await new Promise((r) => setTimeout(r, 350))

    const panneau = document.querySelector('[data-surface-de-menu]')
    if (!panneau) return { etape: 'aucun panneau', nom }

    const ecart = () => {
      /* LE DÉCLENCHEUR EST RETROUVÉ PAR SON NOM, pas gardé en variable : la
         fiche se déplace entre les deux mesures, et c'est tout le sujet. */
      const sienne = lire().find(
        (f) => f.querySelector('[data-section="entete"] a')?.textContent.trim() === nom,
      )
      const d = sienne?.querySelector('button[aria-haspopup], button[aria-expanded]')
      if (!d) return null
      return Math.round(panneau.getBoundingClientRect().right - d.getBoundingClientRect().right)
    }

    const avant = ecart()
    const ordreAvant = ordre().join(' ')

    /* « Déplacer à droite » par son nom accessible : un rang d'entrée changerait
       au premier remaniement du menu, et la garde mesurerait autre chose sans
       le dire. */
    const droite = [...panneau.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') ?? '').toLowerCase().includes('droite'),
    )
    if (!droite) return { etape: 'aucune entrée « déplacer à droite »', nom }
    droite.click()
    /* DEUX TRAMES PUIS UN SOUFFLE : le réordonnancement est validé par React
       après le clic, et le suivi du panneau se fait à la trame d'après. */
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await new Promise((r) => setTimeout(r, 250))

    const apres = ecart()
    const ordreApres = ordre().join(' ')
    declencheur.click?.()
    return { etape: 'mesuré', nom, avant, apres, ordreAvant, ordreApres, tolerance }
  }, DERIVE_TOLEREE_PX)

  if (suivi.etape !== 'mesuré') {
    plaintes.push(
      `/demo/parc panneau-qui-suit : ${suivi.etape}.\n` +
        "   Absence de mesure, et non absence de défaut : la garde refuse.",
    )
  } else if (suivi.ordreAvant === suivi.ordreApres) {
    /* LE PLANCHER DE CE CAS : sans déplacement, le panneau n'a rien à suivre et
       « l'écart n'a pas bougé » serait vrai pour la pire des raisons. */
    plaintes.push(
      `/demo/parc panneau-qui-suit : l’ordre n’a pas changé (${suivi.ordreApres}).\n` +
        '   La fiche n’a pas bougé : le cas serait vert sans rien avoir éprouvé.',
    )
  } else if (suivi.avant === null || suivi.apres === null) {
    plaintes.push(
      '/demo/parc panneau-qui-suit : le déclencheur est introuvable après le déplacement.',
    )
  } else {
    inspectes++
    const derive = Math.abs(suivi.apres - suivi.avant)
    if (derive > DERIVE_TOLEREE_PX) {
      plaintes.push(
        `/demo/parc panneau-qui-suit (${suivi.nom}) : l’écart au déclencheur passe de ` +
          `${suivi.avant} à ${suivi.apres} px (dérive ${derive}).\n` +
          '   Le panneau est resté où la fiche n’est plus : il flotte au-dessus de sa voisine,\n' +
          '   en portant le titre de celle qu’il a quittée.',
      )
    }
    releve.push(
      `  /demo/parc panneau-qui-suit   écart ${suivi.avant} → ${suivi.apres} px · ` +
        `ordre ${suivi.ordreAvant} → ${suivi.ordreApres}`,
    )
  }

  await contexte.close()
  await navigateur.close()
} finally {
  serveur.kill()
}

/* LE COMPTE EST ÉCRIT, JAMAIS DÉRIVÉ : deux poignées et un suivi. Le calculer
   depuis ce qu'on a trouvé rendrait la garde d'accord avec elle-même. */
const ATTENDUS = FICHES_INSPECTEES + 1

if (inspectes === 0) {
  plaintes.push(
    "AUCUN point inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS && plaintes.length === 0) {
  plaintes.push(`${inspectes} point(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}

for (const ligne of releve) console.log(ligne)

if (plaintes.length > 0) {
  console.error(`\n✗ geste-qui-se-voit : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ geste-qui-se-voit : ${inspectes}/${ATTENDUS} points — la poignée paraît au survol sans\n` +
    '  mordre sur le numéro, et le panneau suit sa fiche quand elle se déplace.\n' +
    '  Ce script ne dit RIEN du porter-déposer au pointeur : voir `ficheReordonnable.test.tsx`.',
)
