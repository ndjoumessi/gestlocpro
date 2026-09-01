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
 * puis FOCALISE chaque commande, une par une, en relâchant entre chaque. Ce
 * qu'il additionne est donc le décalage causé par le POINTAGE seul — distinct
 * du décalage de chargement, que la porte mesure ailleurs et qui ne dit rien de
 * celui-ci : une page peut se charger sans un tressaillement et sauter à chaque
 * passage de souris.
 *
 * LE SURVOL EST UN VRAI SURVOL, ET IL NE L'ÉTAIT PAS. La première rédaction
 * envoyait des `MouseEvent` construits en JavaScript. Ils déclenchent bien les
 * gestionnaires React — `onMouseEnter` —, mais PAS la pseudo-classe `:hover`
 * du CSS : le navigateur ne la donne qu'au pointeur physique. Une moitié
 * entière du recensement — toutes les règles `hover:` de Tailwind, qui sont la
 * forme la plus courante du survol dans ce dépôt — échappait donc à la mesure
 * pendant que la garde affichait « 90 commandes survolées ». On déplace
 * désormais le POINTEUR sur le centre de chaque commande, ce qui pose `:hover`
 * pour de bon, et l'on garde le focus en plus : les deux chemins comptent.
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
import { imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

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

  /* LES MODALES. `ouvrir` nomme le bouton qui les fait apparaître ; le pointage
     porte alors sur LEURS commandes — pastilles de métier, d'urgence, segments,
     boutons du pied. C'est le lieu le plus exposé au défaut que ce script
     garde : un formulaire dense, dans une boîte dont la hauteur est bornée,
     où un champ qui grandit au survol pousse l'action principale hors du
     champ de vision. */
  { adresse: '/demo/travaux', largeur: 360, langue: 'fr', ouvrir: /^Ouvrir un chantier$/ },
  { adresse: '/demo/travaux', largeur: 1280, langue: 'fr', ouvrir: /^Ouvrir un chantier$/ },
  { adresse: '/demo/paiements', largeur: 360, langue: 'fr', ouvrir: /^Enregistrer un paiement$/ },
  { adresse: '/demo/paiements', largeur: 1280, langue: 'fr', ouvrir: /^Enregistrer un paiement$/ },
]
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UNE SOMME DE `POINTS`.

  Le dériver de la chose surveillée produit une garde d'accord avec elle-même :
  `POINTS` vidé, l'inspection compare 0 à 0 et passe au vert. Ce piège a été
  trouvé par la même mutation deux lots de suite ; le nombre est donc écrit à
  la main, et l'ajout d'un point oblige à le changer dans le diff.

  10 = accueil à 360 et 1280 en français, accueil à 360 en anglais, les trois
  mêmes états du tableau de bord, et deux modales à deux largeurs.
*/
const ATTENDUS = 10
/** Sous ce compte, un écran n'a pas de graphique à pointer : c'est un défaut. */
const COMMANDES_MINIMUM = 3

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
  try {
    await fetch(BASE + '/', { signal: AbortSignal.timeout(1500) })
    throw new Error(
      `stabilite-au-pointage : quelque chose répond déjà sur ${BASE}.\n` +
        `  Cette porte lance son propre serveur et refuse d'en mesurer un autre.\n` +
        `  Souvent une prévisualisation orpheline d'un passage interrompu :\n` +
        `    lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
    )
  } catch (erreur) {
    /* L'ABSENCE DE RÉPONSE EST CE QU'ON VEUT : `fetch` lève, et l'on continue.
       Seule notre propre plainte est relancée — la reconnaître par son message
       plutôt que par son type évite d'inventer une classe d'erreur pour une
       ligne. */
    if (erreur instanceof Error && erreur.message.includes('répond déjà')) throw erreur
  }
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
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: point.largeur, height: 900 },
      locale: point.langue === 'fr' ? 'fr-FR' : 'en-US',
      colorScheme: 'light',
    })
    await imposerLaPoliceLarge(contexte)
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

    if (point.ouvrir) {
      const bouton = page.getByRole('button', { name: point.ouvrir }).first()
      if ((await bouton.count()) === 0) {
        plaintes.push(
          `${point.adresse}@${point.largeur}/${point.langue} : le bouton qui ouvre la modale est introuvable.\n` +
            "   Une modale qu'on n'ouvre pas est une modale qu'on ne pointe pas, et « pas pointée »\n" +
            "   ne doit jamais s'écrire comme « sans défaut ».",
        )
        await contexte.close()
        continue
      }
      await bouton.click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(300)
    }

    /* Les commandes à pointer, et le repère qui encaisse ce qu'elles poussent.
       Relevées en une fois : les pointer depuis Node demande leurs positions,
       et les redemander à chaque tour ferait mesurer un DOM qui a bougé. */
    const cibles = await page.evaluate(() => {
      const out = []
      let n = 0
      /* Dans une modale, les commandes ne vivent pas dans un `<figure>` : le
         dialogue EST le champ de mesure, et son pied d'action est le repère —
         c'est lui que pousserait un champ qui grandit au survol. Hors modale,
         ce sont les graphiques et le bloc qui les suit. */
      const dialogue = document.querySelector('[role="dialog"]')
      const zones = dialogue ? [dialogue] : [...document.querySelectorAll('figure')]
      /* PAS SEULEMENT LES `<button>`. Les pastilles de choix sont des `<label>`
         portant un radio en `sr-only` : c'est le label qui reçoit le survol et
         qui porte les règles `hover:`, donc c'est lui qu'il faut pointer. La
         première rédaction n'en voyait aucune — trois commandes pointées dans
         « Ouvrir un chantier », qui en compte douze — et affichait « pointées »
         sur ce qu'elle n'avait pas touché. */
      for (const zone of zones) {
        const boutons = [...zone.querySelectorAll('button, label, a[href], summary')]
        if (boutons.length === 0) continue
        if (!dialogue) zone.scrollIntoView({ block: 'center' })
        for (const b of boutons) {
          b.dataset.pointage = String(n++)
          out.push(`[data-pointage="${b.dataset.pointage}"]`)
        }
      }
      if (dialogue) {
        const pied = dialogue.children[dialogue.children.length - 1]
        if (pied) pied.setAttribute('data-repere', '1')
      } else {
        const fig = document.querySelector('figure')
        const repere = fig?.parentElement?.nextElementSibling ?? fig?.nextElementSibling
        if (repere) repere.setAttribute('data-repere', '1')
      }
      return out
    })

    /* EN COORDONNÉES DE DOCUMENT, et non de fenêtre. `hover()` amène la
       commande sous le pointeur en FAISANT DÉFILER la page : lu dans la
       fenêtre, le repère « bougeait » alors de 785 px sans qu'aucune mise en
       page n'ait changé. Le défilement n'est pas un décalage. */
    const lireRepere = () =>
      page.evaluate(() => {
        const r = document.querySelector('[data-repere]')
        return r ? Math.round(r.getBoundingClientRect().top + window.scrollY) : null
      })

    const y0 = await lireRepere()
    let deplacement = 0
    let commandes = 0
    for (const sel of cibles) {
      const el = page.locator(sel)
      /* `hover()` déplace le POINTEUR : c'est ce qui pose `:hover` en CSS.
         `focus()` couvre l'autre chemin. Les deux, un par un, en relâchant. */
      await el.hover({ timeout: 3000 }).catch(() => {})
      await el.focus({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(70)
      const y = await lireRepere()
      if (y0 !== null && y !== null) deplacement = Math.max(deplacement, Math.abs(y - y0))
      await page.mouse.move(0, 0)
      await page.evaluate(() => document.activeElement?.blur?.())
      await page.waitForTimeout(50)
      commandes++
    }
    await page.waitForTimeout(350)
    const mesure = {
      ...(await page.evaluate(() => ({ decalage: window.__d, evenements: window.__n }))),
      deplacement,
      commandes,
    }

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
