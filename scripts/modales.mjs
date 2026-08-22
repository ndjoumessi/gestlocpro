#!/usr/bin/env node
/**
 * LES MODALES TIENNENT DANS LA FENÊTRE, ET LEUR ACTION RESTE SOUS LES YEUX.
 *
 * TROIS DÉFAUTS MESURÉS, ET LE PLUS GRAVE NE VENAIT PAS DU CONTENU.
 *
 * 1. LE BLOC CONTENEUR VOLÉ. Le conteneur de la modale est `fixed inset-0` : il
 *    devrait couvrir la fenêtre. Il ne le faisait pas. `<main>` porte
 *    `animate-rise`, et une animation de `transform` laisse au repos une matrice
 *    IDENTITÉ — qui est une transformation. Un ancêtre transformé devient le
 *    bloc conteneur de ses descendants `position: fixed`. Relevé sur « Ajouter
 *    un immeuble », fenêtre de 900 px : la boîte se posait à y = 554 et
 *    finissait à 941, quarante et un pixels SOUS le bord. Le pied — donc
 *    l'action principale — était coupé, sur les vingt états mesurés.
 * 2. LES CARTES POUR UN MOT. « Ouvrir un chantier » rendait six corps de métier
 *    et trois urgences en tuiles pleine largeur, toutes avec `description: ''`
 *    et sans icône : 1517 px de contenu pour une fenêtre de 484, soit 1033 px
 *    de défilement pour neuf mots.
 * 3. UNE SEULE COLONNE À TOUTE LARGEUR. Sept champs empilés sur un écran de
 *    bureau, quand deux d'entre eux se lisent comme une paire.
 *
 * CE QUE CE SCRIPT MESURE. Il OUVRE chaque modale déclarée, aux deux largeurs
 * et dans les deux langues, puis vérifie quatre choses :
 *   — la boîte tient ENTIÈREMENT dans la fenêtre (bords compris, pas seulement
 *     la hauteur : c'est la distinction que le premier relevé avait ratée) ;
 *   — le pied reste visible corps en HAUT **et** corps en BAS ;
 *   — le corps ne demande pas plus de défilement qu'un plafond écrit ;
 *   — l'en-tête et le pied ne défilent pas avec le corps.
 *
 * CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE :
 *   — le CLAVIER. Piège de focus, Échap, retour du focus : ce sont les cas de
 *     `clavierDesModales.test.tsx`, joués sous jsdom où la tabulation est
 *     simulée fidèlement. Les rejouer ici doublerait la couverture sans rien
 *     ajouter ;
 *   — la PERTINENCE d'un champ, l'ordre des questions, le bien-fondé d'un
 *     libellé. Aucune garde ne sait cela, et celle-ci ne prétend pas le savoir.
 *
 *   node scripts/modales.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici — ce script ne connaît que des rectangles.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4192
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES MODALES INSPECTÉES, ET COMMENT ON LES OUVRE.
 *
 * Par le RÔLE et le nom accessible du bouton, jamais par une classe : c'est ce
 * qui fait que l'inspection survit à une refonte de la mise en page et meurt à
 * une refonte du vocabulaire — ce qui est le bon sens de la dépendance.
 *
 * Le plafond de défilement est ÉCRIT par modale, avec la mesure d'avant à côté.
 * Zéro n'est pas la cible : sept champs sur un téléphone défilent, et vouloir
 * l'interdire ferait rétrécir les champs ou disparaître l'aide. Ce qu'on refuse
 * est le défilement qui n'achète rien.
 */
const MODALES = [
  { nom: 'AddBuilding', adresse: '/demo/parc', bouton: /Ajouter un immeuble|Add a building/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'AddUnit', adresse: '/demo/parc', bouton: /Ajouter un logement|Add a unit/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'OpenWork', adresse: '/demo/travaux', bouton: /Ouvrir un chantier|Open a job/, defil: { 360: 130, 1280: 0 }, avant: { 360: 1033, 1280: 873 } },
  { nom: 'RecordPayment', adresse: '/demo/paiements', bouton: /Enregistrer un paiement|Record a payment/, defil: { 360: 460, 1280: 40 }, avant: { 360: 436, 1280: 200 } },
  { nom: 'Receipt', adresse: '/demo/paiements', bouton: /Quittance|Receipt/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
]
const LARGEURS = [360, 1280]
const LANGUES = ['fr', 'en']
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UN PRODUIT CALCULÉ.

  `MODALES.length * LARGEURS.length * LANGUES.length` rendrait la garde
  d'accord avec elle-même : vider `MODALES`, et l'inspection comparerait 0 à 0
  puis se déclarerait verte. La même mutation a trouvé ce piège trois lots de
  suite. Ajouter une modale oblige à toucher ce nombre, et le diff le montre.

  20 = 5 modales × 2 largeurs × 2 langues.
*/
const ATTENDUS = 20

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
  throw new Error('modales : le serveur de prévisualisation n’a pas répondu.')
}

const serveur = await servir()
const plaintes = []
const releve = []
let inspectees = 0

try {
  const navigateur = await chromium.launch()
  for (const modale of MODALES) {
    for (const largeur of LARGEURS) {
      for (const langue of LANGUES) {
        const contexte = await navigateur.newContext({
          viewport: { width: largeur, height: largeur === 360 ? 780 : 900 },
          locale: langue === 'fr' ? 'fr-FR' : 'en-US',
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
        await page.goto(BASE + modale.adresse, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(400)

        const nom = `${modale.nom}@${largeur}/${langue}`
        const bouton = page.getByRole('button', { name: modale.bouton }).first()
        if ((await bouton.count()) === 0) {
          plaintes.push(
            `${nom} : le bouton qui l'ouvre est introuvable.\n` +
              "   Une modale qu'on n'ouvre pas est une modale qu'on n'a pas mesurée, et\n" +
              "   « pas mesurée » ne doit jamais s'écrire comme « sans défaut ».",
          )
          await contexte.close()
          continue
        }
        await bouton.click().catch(() => {})
        await page.waitForTimeout(350)

        const m = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"],[role="alertdialog"]')
          if (!d) return null
          const enfants = [...d.children]
          const corps = enfants.find((e) => getComputedStyle(e).overflowY === 'auto')
          const pied = enfants[enfants.length - 1] !== corps ? enfants[enfants.length - 1] : null
          const entete = enfants[0] !== corps ? enfants[0] : null
          const r = d.getBoundingClientRect()
          const dansLaFenetre = (el) => {
            const b = el.getBoundingClientRect()
            return b.top >= -1 && b.bottom <= window.innerHeight + 1
          }
          /* Corps en haut puis en bas : un pied ÉPINGLÉ ne bouge pas, un pied
             qui suit le contenu sort du champ à la première molette. */
          let piedTenu = pied ? dansLaFenetre(pied) : null
          let enteteTenu = entete ? dansLaFenetre(entete) : null
          if (corps) {
            corps.scrollTop = corps.scrollHeight
            if (pied) piedTenu = piedTenu && dansLaFenetre(pied)
            if (entete) enteteTenu = enteteTenu && dansLaFenetre(entete)
            corps.scrollTop = 0
          }
          return {
            boite: Math.round(r.height),
            debordeEnHaut: Math.round(Math.max(0, -r.top)),
            debordeEnBas: Math.round(Math.max(0, r.bottom - window.innerHeight)),
            defil: corps ? Math.max(0, corps.scrollHeight - corps.clientHeight) : 0,
            piedTenu,
            enteteTenu,
          }
        })
        await contexte.close()

        if (!m) {
          plaintes.push(`${nom} : le bouton a été cliqué et aucune boîte de dialogue n'est apparue.`)
          continue
        }
        inspectees++
        releve.push({ nom, largeur, ...m, plafond: modale.defil[largeur], avant: modale.avant[largeur] })

        if (m.debordeEnHaut > 0 || m.debordeEnBas > 0) {
          plaintes.push(
            `${nom} : la boîte DÉBORDE de la fenêtre — ${m.debordeEnHaut} px en haut, ` +
              `${m.debordeEnBas} px en bas.\n` +
              "   Un ancêtre transformé a repris le bloc conteneur du `fixed`. Voir l'en-tête\n" +
              '   de ce script, et le portail de `Modal`.',
          )
        }
        if (m.piedTenu === false) {
          plaintes.push(
            `${nom} : le pied d'action sort du champ quand le corps défile.\n` +
              "   L'action principale doit rester sous les yeux, pas au bout du formulaire.",
          )
        }
        if (m.enteteTenu === false) {
          plaintes.push(`${nom} : l'en-tête sort du champ quand le corps défile.`)
        }
        if (m.defil > modale.defil[largeur]) {
          plaintes.push(
            `${nom} : ${m.defil} px de défilement pour un plafond de ${modale.defil[largeur]}.\n` +
              `   Avant ce lot : ${modale.avant[largeur]} px.`,
          )
        }
      }
    }
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

/* ─── LA GARDE DU GARDE ─────────────────────────────────────────────────── */
if (inspectees === 0) {
  plaintes.push(
    "AUCUNE modale inspectée. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectees !== ATTENDUS) {
  plaintes.push(
    `${inspectees} état(s) inspecté(s) pour ${ATTENDUS} attendu(s).\n` +
      "   La garde n'a pas ouvert ce qu'elle prétend garder.",
  )
}

for (const r of releve) {
  console.log(
    `  ${r.nom.padEnd(22)} boîte ${String(r.boite).padStart(4)} px  ` +
      `déborde ${String(r.debordeEnHaut).padStart(3)}/${String(r.debordeEnBas).padStart(3)}  ` +
      `défil ${String(r.defil).padStart(4)} (plafond ${String(r.plafond).padStart(4)} · avant ${String(r.avant).padStart(4)})  ` +
      `pied ${r.piedTenu === null ? '—' : r.piedTenu ? 'tenu' : 'PERDU'}`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ modales : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ modales : ${inspectees}/${ATTENDUS} états ouverts et mesurés.\n` +
    "  Le CLAVIER est mesuré ailleurs — `clavierDesModales.test.tsx` — et la PERTINENCE\n" +
    "  d'un champ n'est mesurée nulle part : voir l'en-tête.",
)
