#!/usr/bin/env node
/**
 * LA PAGE NE BOUGE PAS SOUS LE POINTEUR.
 *
 * LE DÉFAUT, ET SA MESURE. Le bandeau de lecture du graphique du tableau de
 * bord changeait de HAUTEUR selon la colonne visée : la note de période ouverte
 * n'existait que pour la dernière, et l'ajouter poussait tout ce qui suit de
 * 17 px sur téléphone, de 26 px au-delà. Décalage cumulé à l'interaction
 * mesuré avant correction : 0,126 à 0,310 selon la largeur, pour un seuil de
 * 0,1. Le même défaut vivait une seconde fois sur la page d'accueil.
 *
 * CE QUE CE SCRIPT MESURE, ET CE QU'IL NE MESURE PAS.
 *
 * Il ouvre un écran, s'abonne aux `layout-shift` du navigateur, puis SURVOLE
 * puis FOCALISE chaque commande d'un graphique, une par une, en relâchant entre
 * chaque. Ce qu'il additionne est donc le décalage causé par le POINTAGE seul —
 * distinct du décalage de chargement, que la porte mesure ailleurs et qui ne
 * dit rien de celui-ci : une page peut se charger sans un tressaillement et
 * sauter à chaque passage de souris.
 *
 * Il mesure AUSSI le déplacement en pixels d'un repère pris sous le graphique.
 * Les deux nombres ne disent pas la même chose et il faut les deux : le
 * décalage cumulé pondère par la surface touchée, donc un petit élément qui
 * bouge beaucoup s'y écrase ; le déplacement en pixels, lui, est brutal et
 * lisible — il vaut zéro ou il ne vaut rien.
 *
 * IL NE DIT RIEN DE LA BEAUTÉ D'UNE MISE EN PAGE, ni de sa hiérarchie, ni du
 * bien-fondé d'un survol. Il dit que rien ne se déplace. Une garde qui
 * prétendrait juger du reste serait une décoration, et ce dépôt les fait
 * disparaître.
 *
 * L'EXEMPTION EST ÉCRITE ET CHIFFRÉE. L'épaississement de l'arc du recouvrement
 * — 11 à 14 unités de boîte de vue au survol — est une géométrie qui change.
 * Mesuré : boîte du `<svg>`, hauteur de la figure, hauteur du document et
 * largeur de la légende INCHANGÉES, déplacement 0 px, décalage résiduel 0,0003.
 * L'anneau croît dans une boîte qui ne bouge pas. Le plafond ci-dessous est
 * donc au-dessus de ce résidu, et il est écrit qu'il l'est.
 *
 *   node scripts/stabilite-au-pointage.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et il n'y en a aucun besoin — ce script ne
 * connaît que des rectangles et des événements.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4189
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LE PLAFOND, ET POURQUOI IL VAUT CE QU'IL VAUT.
 *
 * 0,01 — dix fois sous le seuil « bon » de 0,1 que Chrome retient pour le
 * décalage de chargement, et trente fois au-dessus du résidu de l'anneau
 * (0,0003), qui est la seule géométrie que ce produit assume de faire varier
 * au survol. Entre les deux il y a un facteur trente : c'est cet intervalle
 * qui rend le plafond falsifiable plutôt que décoratif. Le réintroduire d'un
 * bandeau à hauteur variable — mutation M1 — rend 0,12 à 0,31.
 */
const PLAFOND_DECALAGE = 0.01
/** Le déplacement, lui, ne se négocie pas : un repère qui bouge a bougé. */
const PLAFOND_PIXELS = 1

/**
 * LES POINTS D'INSPECTION.
 *
 * Les deux écrans qui portent un graphique interrogeable, aux deux largeurs de
 * référence, dans les deux langues : la longueur d'un libellé change la mise en
 * page, donc elle peut changer ce qui se déplace.
 */
const POINTS = [
  { adresse: '/', largeur: 360, langue: 'fr' },
  { adresse: '/', largeur: 1280, langue: 'fr' },
  { adresse: '/', largeur: 360, langue: 'en' },
  { adresse: '/demo', largeur: 360, langue: 'fr' },
  { adresse: '/demo', largeur: 1280, langue: 'fr' },
  { adresse: '/demo', largeur: 360, langue: 'en' },
]
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UNE SOMME DE `POINTS`.

  Le dériver de la chose surveillée produit une garde d'accord avec elle-même :
  `POINTS` vidé, l'inspection compare 0 à 0 et passe au vert. Ce piège a été
  trouvé par la même mutation deux lots de suite ; le nombre est donc écrit à
  la main, et l'ajout d'un point oblige à le changer dans le diff.

  6 = accueil à 360 et 1280 en français, accueil à 360 en anglais, et les trois
  mêmes états du tableau de bord.
*/
const ATTENDUS = 6
/** Sous ce compte, un écran n'a pas de graphique à pointer : c'est un défaut. */
const COMMANDES_MINIMUM = 3

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
  throw new Error('stabilité : le serveur de prévisualisation n’a pas répondu.')
}

const serveur = await servir()
const plaintes = []
const releve = []
let pointsInspectes = 0
let commandesPointees = 0

try {
  const navigateur = await chromium.launch()
  for (const point of POINTS) {
    const contexte = await navigateur.newContext({
      viewport: { width: point.largeur, height: 900 },
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
    await page.goto(BASE + point.adresse, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(700)

    /* L'abonnement est posé APRÈS le chargement : sans `buffered`, seul ce qui
       suit est compté, et c'est exactement la frontière qu'on veut. */
    await page.evaluate(`window.__d=0;window.__n=0;
      new PerformanceObserver((l)=>{for(const e of l.getEntries())
        if(!e.hadRecentInput){window.__d+=e.value;window.__n++}})
      .observe({type:'layout-shift',buffered:false})`)

    const mesure = await page.evaluate(async () => {
      let deplacement = 0
      let commandes = 0
      for (const figure of document.querySelectorAll('figure')) {
        const boutons = [...figure.querySelectorAll('button')]
        if (boutons.length === 0) continue
        figure.scrollIntoView({ block: 'center' })
        await new Promise((r) => requestAnimationFrame(r))
        /* Le repère est pris SOUS la figure : c'est lui qui encaisse tout ce
           qu'une hauteur variable pousse vers le bas. */
        const repere = figure.parentElement?.nextElementSibling ?? figure.nextElementSibling
        const y0 = repere ? Math.round(repere.getBoundingClientRect().top) : null
        for (const b of boutons) {
          b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
          b.dispatchEvent(new MouseEvent('mouseenter'))
          b.focus()
          await new Promise((r) => setTimeout(r, 80))
          if (y0 !== null && repere) {
            deplacement = Math.max(deplacement, Math.abs(Math.round(repere.getBoundingClientRect().top) - y0))
          }
          b.blur()
          b.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
          b.dispatchEvent(new MouseEvent('mouseleave'))
          await new Promise((r) => setTimeout(r, 50))
          commandes++
        }
      }
      await new Promise((r) => setTimeout(r, 350))
      return { decalage: window.__d, evenements: window.__n, deplacement, commandes }
    })

    const nom = `${point.adresse}@${point.largeur}/${point.langue}`

    if (mesure.commandes < COMMANDES_MINIMUM) {
      plaintes.push(
        `${nom} : ${mesure.commandes} commande(s) pointée(s), moins que les ${COMMANDES_MINIMUM} attendues.\n` +
          "   Un écran dont on ne pointe rien rend zéro décalage — et zéro s'écrit alors\n" +
          "   comme « aucun défaut » alors qu'il veut dire « rien regardé ».",
      )
      await contexte.close()
      continue
    }

    pointsInspectes++
    commandesPointees += mesure.commandes
    releve.push({ nom, ...mesure })

    if (mesure.decalage > PLAFOND_DECALAGE) {
      plaintes.push(
        `${nom} : décalage à l'interaction ${mesure.decalage.toFixed(5)} pour un plafond de ${PLAFOND_DECALAGE}\n` +
          `   (${mesure.evenements} événement(s) sur ${mesure.commandes} commandes pointées).\n` +
          '   Quelque chose change de géométrie au survol ou au focus, et la page bouge sous le pointeur.',
      )
    }
    if (mesure.deplacement > PLAFOND_PIXELS) {
      plaintes.push(
        `${nom} : le repère sous le graphique s'est déplacé de ${mesure.deplacement} px au pointage.\n` +
          '   La surbrillance se fait par la couleur, l’opacité ou l’ombre ; l’espace du contenu\n' +
          '   variable se réserve à sa hauteur maximale.',
      )
    }
    await contexte.close()
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

/* ─── LA GARDE DU GARDE ─────────────────────────────────────────────────── */
if (pointsInspectes === 0) {
  plaintes.push(
    "AUCUN point inspecté. Ce n'est pas une absence de défaut, c'est une absence\n" +
      "   d'inspection. La garde refuse plutôt que de se déclarer verte sur du vide.",
  )
}
if (pointsInspectes !== ATTENDUS) {
  plaintes.push(
    `${pointsInspectes} point(s) inspecté(s) pour ${ATTENDUS} attendu(s).\n` +
      "   La garde n'a pas regardé ce qu'elle prétend garder.",
  )
}

for (const r of releve) {
  console.log(
    `  ${r.nom.padEnd(22)} décalage ${r.decalage.toFixed(5)}  ` +
      `déplacement ${String(r.deplacement).padStart(3)} px  ` +
      `${String(r.commandes).padStart(3)} commandes pointées  ${r.evenements} évts`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ stabilite-au-pointage : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ stabilite-au-pointage : ${pointsInspectes}/${ATTENDUS} points, ` +
    `${commandesPointees} commandes survolées ET focalisées une à une.\n` +
    `  Plafonds : ${PLAFOND_DECALAGE} de décalage cumulé, ${PLAFOND_PIXELS} px de déplacement.\n` +
    "  Ce script ne dit RIEN de la hiérarchie ni du bien-fondé d'un survol — voir son en-tête.",
)
