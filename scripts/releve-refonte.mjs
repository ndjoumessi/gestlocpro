#!/usr/bin/env node
/**
 * LE RELEVÉ DE L'EXISTANT, POUR LA REFONTE.
 *
 * Il ne garde rien : il MESURE, et il écrit un JSON qu'on relit avant et après.
 * Une garde dit « non » ; celui-ci dit « voilà ce qu'il y a ». Les deux rôles
 * sont séparés exprès — un relevé qui refuse devient une porte, et une porte
 * qui décrit devient une décoration.
 *
 * DEUX BIAIS DU RELEVÉ PRÉCÉDENT, CORRIGÉS ICI, ET C'EST TOUT L'OBJET.
 *
 * 1. LA TYPOGRAPHIE ÉTAIT ATTRIBUÉE AU NŒUD QUI PORTE LE STYLE, pas à celui qui
 *    porte le SENS. Un titre dont le texte est enveloppé dans un `<span>`
 *    comptait pour le span : le relevé voyait des « spans en 30 px » et aucun
 *    titre, donc il ne pouvait pas dire si la hiérarchie tenait. On remonte
 *    désormais du nœud de texte vers le premier ANCÊTRE SÉMANTIQUE — titre,
 *    paragraphe, cellule, libellé, bouton, lien — et on lui attribue les
 *    valeurs RENDUES du nœud qui les porte.
 *
 * 2. LES ÉCARTS ÉTAIENT MESURÉS ENTRE FRÈRES. Une marge posée par un
 *    grand-parent — et c'est ainsi que se construisent les séparations de
 *    section — n'apparaissait nulle part, et le relevé concluait « la valeur
 *    modale des écarts est 0 ». On mesure donc la DISTANCE VISUELLE : bas du
 *    bloc précédent, haut du suivant, sur la liste ordonnée des blocs de
 *    niveau supérieur du contenu, quel que soit leur conteneur.
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun motif de classe
 * n'est écrit ici en entier — ce fichier ne lit que du style calculé et des
 * rectangles.
 *
 *   node scripts/releve-refonte.mjs --sortie <fichier.json>
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { argv, exit } from 'node:process'
import { inventaireDesRoutes, exigerUnInventairePlein, RACINE } from './inventaire/routes.mjs'

const PORT = Number(process.env.PORT_RELEVE || 4220)
const BASE = `http://127.0.0.1:${PORT}`
const LARGEURS = [320, 360, 375, 414, 700, 768, 800, 900, 1024, 1280, 1440]
const LANGUES = [
  ['fr', 'fr-FR'],
  ['en', 'en-US'],
]
const THEMES = ['light', 'dark']
/** Deux largeurs suffisent aux couleurs : elles ne dépendent pas de la fenêtre. */
const LARGEURS_COULEUR = [360, 1280]

const sortie = argv[argv.indexOf('--sortie') + 1]
if (!sortie || sortie.startsWith('--')) {
  console.error('usage : node scripts/releve-refonte.mjs --sortie <fichier.json>')
  exit(2)
}

const routes = inventaireDesRoutes()
exigerUnInventairePlein(routes)
const ADRESSES = routes.map((r) => r.adresse)

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
  throw new Error('relevé : le serveur de prévisualisation n’a pas répondu.')
}

/* ─── CE QUI EST MESURÉ DANS LA PAGE ──────────────────────────────────────
   Tout ce bloc s'exécute dans le navigateur. Il est écrit en une seule
   fonction sérialisée plutôt qu'en plusieurs appels : chaque aller-retour
   coûte une image, et 23 écrans × 11 largeurs × 2 langues en font beaucoup. */
const DANS_LA_PAGE = () => {
  /** Les balises qui portent un SENS. Un span n'en est pas. */
  const SEMANTIQUES = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'TD', 'TH', 'CAPTION', 'FIGCAPTION',
    'LABEL', 'BUTTON', 'A', 'SUMMARY', 'LEGEND', 'DT', 'DD', 'OPTION', 'BLOCKQUOTE', 'CODE',
  ])
  const ACTIONNABLES = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'

  const visible = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    /* `sr-only` : un pavé d'un pixel écrêté. Il est dans l'arbre, il n'est pas
       à l'écran, et le compter fausserait toute la typographie. */
    if (r.width <= 1 && r.height <= 1) return false
    if (s.clipPath && s.clipPath !== 'none' && r.width <= 2) return false
    return true
  }

  /** Le premier ancêtre porteur de sens, en partant du nœud qui porte le style. */
  const porteur = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (SEMANTIQUES.has(n.tagName)) return n
    }
    return null
  }

  /* ── Typographie, attribuée au porteur de sens ────────────────────────── */
  const typo = new Map()
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if (!n.nodeValue.trim()) continue
    const el = n.parentElement
    if (!el || !visible(el)) continue
    const p = porteur(el)
    if (!p) continue
    const s = getComputedStyle(el)
    const cle = `${p.tagName}|${Math.round(Number.parseFloat(s.fontSize) * 10) / 10}|${s.fontWeight}|${s.color}`
    const e = typo.get(cle) ?? { balise: p.tagName, taille: Number.parseFloat(s.fontSize),
      graisse: Number(s.fontWeight), couleur: s.color, interligne: s.lineHeight, n: 0 }
    e.n++
    typo.set(cle, e)
  }

  /* ── Écarts VISUELS entre blocs de niveau supérieur du contenu ────────── */
  const racine = document.querySelector('main') ?? document.body
  const blocs = [...racine.children].filter(visible)
  /* Un conteneur unique n'est pas un niveau : on descend tant qu'il n'y a
     qu'un seul enfant visible, sinon « le contenu » vaut un seul bloc et le
     relevé ne mesure aucun écart. */
  let niveau = blocs
  let garde = 0
  while (niveau.length === 1 && garde++ < 6) {
    const enfants = [...niveau[0].children].filter(visible)
    if (enfants.length < 2) break
    niveau = enfants
  }
  const ecarts = []
  for (let i = 1; i < niveau.length; i++) {
    const a = niveau[i - 1].getBoundingClientRect()
    const b = niveau[i].getBoundingClientRect()
    /* Colonnes côte à côte : l'écart vertical n'a pas de sens. */
    if (b.top < a.bottom - 1) continue
    ecarts.push(Math.round(b.top - a.bottom))
  }

  /* ── Coquille : hauteur AVANT le contenu ──────────────────────────────── */
  const main = document.querySelector('main')
  const hautDuContenu = main ? Math.round(main.getBoundingClientRect().top + window.scrollY) : null
  /*
    DEUX PREMIERS ACTIONNABLES, ET IL FAUT LES DEUX.

    La première rédaction n'en rendait qu'un : le premier du DOCUMENT. Sur un
    écran applicatif c'est le bouton de menu de la coquille, à y = 10, et il ne
    bouge par construction jamais — d'où une ligne de rapport qui annonçait
    « inchangé sur les 23 écrans » tout en masquant le seul chiffre qui comptait :
    « Exporter le relevé » est passé de 427 à 225 px dans le même lot, et le
    relevé ne l'a pas vu.

    Le premier actionnable du CONTENU répond à la question qu'on pose vraiment —
    à quelle distance est le premier geste que l'écran propose. Celui du
    document répond à une autre, plus étroite : où commence la tabulation. Les
    deux sont rendus, nommés, et ne se confondent plus.
  */
  const premierDe = (racine) => {
    for (const el of racine.querySelectorAll(ACTIONNABLES)) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      return {
        nature: el.tagName.toLowerCase() + (el.getAttribute('type') ? `[${el.getAttribute('type')}]` : ''),
        nom: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        y: Math.round(r.top + window.scrollY),
      }
    }
    return null
  }
  const premier = premierDe(document)
  const premierDuContenu = main ? premierDe(main) : null

  /*
    LA COLONNE DES CIBLES A ÉTÉ RETIRÉE, ET C'EST UNE CORRECTION.

    Elle lisait `getBoundingClientRect()` et comptait 546 cibles « sous 44 px »
    là où `mesure-ui`, qui SONDE réellement le point de contact — rembourrages,
    pseudo-éléments et recouvrements compris — en compte ZÉRO. Une boîte se
    calcule ; une cible se touche, et un lien de 18 × 17 px posé au milieu d'une
    rangée de 44 px est parfaitement atteignable.

    Refaire ici le sondage de `mesure-ui` serait le recopier — et une mesure
    recopiée diverge au premier ajustement. Un relevé qui rend un chiffre faux
    est un piège posé pour le prochain lecteur : on le retire, et l'on dit où
    vit la vraie mesure. `mesure-ui.mjs`, constante `PLANCHER_CIBLE`.
  */

  return {
    typo: [...typo.values()].sort((a, b) => b.n - a.n),
    ecarts,
    hDoc: document.documentElement.scrollHeight,
    hCoquille: hautDuContenu,
    debordement: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    premierActionnable: premier,
    premierActionnableDuContenu: premierDuContenu,
    nActionnables: [...document.querySelectorAll(ACTIONNABLES)].filter(visible).length,
  }
}

const serveur = await servir()
const releve = { adresses: ADRESSES, largeurs: LARGEURS, mesures: {}, froid: {} }
let etatsMesures = 0

try {
  const navigateur = await chromium.launch()

  /* ── Mise en page : 23 écrans × 11 largeurs × 2 langues, thème clair ──── */
  for (const [langue, locale] of LANGUES) {
    const contexte = await navigateur.newContext({
      viewport: { width: LARGEURS[0], height: 900 },
      locale,
      colorScheme: 'light',
    })
    const page = await contexte.newPage()
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('gestloc.lang', l)
      } catch {
        /* stockage refusé : la langue reste celle du contexte */
      }
    }, langue)

    for (const adresse of ADRESSES) {
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(350)
      for (const largeur of LARGEURS) {
        await page.setViewportSize({ width: largeur, height: 900 })
        await page.waitForTimeout(140)
        releve.mesures[`${adresse}|${langue}|${largeur}`] = await page.evaluate(DANS_LA_PAGE)
        etatsMesures++
      }
    }
    await contexte.close()
  }

  /* ── Octets et requêtes À FROID, un contexte neuf par écran ───────────── */
  for (const adresse of ADRESSES) {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 900 }, locale: 'fr-FR' })
    const page = await contexte.newPage()
    let octets = 0
    let requetes = 0
    page.on('response', async (r) => {
      requetes++
      try {
        const l = (await r.allHeaders())['content-length']
        octets += l ? Number(l) : (await r.body().catch(() => Buffer.alloc(0))).length
      } catch {
        /* réponse déjà consommée : elle compte comme requête, pas en octets */
      }
    })
    await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(250)
    releve.froid[adresse] = { octets, requetes }
    await contexte.close()
  }

  /* ── Couleurs : 23 écrans × 2 largeurs × 2 thèmes, français ───────────── */
  for (const theme of THEMES) {
    const contexte = await navigateur.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'fr-FR',
      colorScheme: theme,
    })
    const page = await contexte.newPage()
    for (const adresse of ADRESSES) {
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(300)
      for (const largeur of LARGEURS_COULEUR) {
        await page.setViewportSize({ width: largeur, height: 900 })
        await page.waitForTimeout(140)
        releve.mesures[`${adresse}|couleur|${theme}|${largeur}`] = await page.evaluate(DANS_LA_PAGE)
        etatsMesures++
      }
    }
    await contexte.close()
  }

  await navigateur.close()
} finally {
  serveur.kill()
}

/* ─── LA GARDE DU RELEVÉ ──────────────────────────────────────────────────
   Un relevé vide s'écrit exactement comme un produit sans défaut. Le compte
   attendu est ÉCRIT et non dérivé du relevé : le dériver ferait passer un
   balayage à zéro écran pour un balayage complet. Même piège que celui qu'une
   mutation a trouvé deux lots de suite. */
const ATTENDUS_MISE_EN_PAGE = 23 * 11 * 2 // 506
const ATTENDUS_COULEUR = 23 * 2 * 2 // 92
const ATTENDUS = ATTENDUS_MISE_EN_PAGE + ATTENDUS_COULEUR // 598
if (etatsMesures !== ATTENDUS) {
  console.error(
    `✗ relevé : ${etatsMesures} état(s) mesuré(s) pour ${ATTENDUS} attendu(s).\n` +
      "  Ce n'est pas un produit sans défaut, c'est un balayage incomplet.",
  )
  exit(1)
}

/* Chemin absolu accepté tel quel : `join(RACINE, …)` le préfixait de la racine
   du dépôt et écrivait dans une arborescence fantôme — huit minutes de mesure
   perdues à l'écriture, ce qui est le pire endroit pour perdre une mesure. */
writeFileSync(isAbsolute(sortie) ? sortie : join(RACINE, sortie), JSON.stringify(releve, null, 1))
console.log(
  `✓ relevé : ${etatsMesures} états mesurés (${ADRESSES.length} écrans × ${LARGEURS.length} largeurs × ` +
    `${LANGUES.length} langues, plus ${ATTENDUS_COULEUR} états de couleur) → ${sortie}`,
)
