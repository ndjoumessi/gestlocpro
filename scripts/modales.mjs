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
 * CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE — c'est la règle enfreinte à sa
 * première rédaction, qui inspectait CINQ modales sur douze en annonçant
 * « 20 états » :
 *
 *   — DEUX MODALES SUR DOUZE NE S'OUVRENT PAS ICI, nommément `TariffsModal` et
 *     `ParkSettingsModal`. Leurs boutons sont gardés par `adhesionActive`,
 *     c'est-à-dire par un COMPTE RÉEL : en démonstration l'adhésion est nulle,
 *     donc le bouton n'est pas rendu du tout. Aucune manipulation du navigateur
 *     n'y donne accès sans serveur d'authentification. Elles sont comptées à
 *     part — `NON_OUVRABLES` — et leur GÉOMÉTRIE N'EST DONC MESURÉE PAR
 *     PERSONNE. C'est une dette, elle est nommée, et elle se lèvera le jour où la
 *     démonstration portera une adhésion fictive plutôt qu'aucune.
 *     `clavierDesModales.test.tsx` NE LES COUVRE PAS : ses quatre cas sont
 *     « Ajouter un immeuble », « Ajouter un logement », « Ouvrir un chantier »,
 *     « Enregistrer un paiement ».
 *
 *   — le CLAVIER. Piège de focus, Échap, retour du focus : ce sont les cas de
 *     `clavierDesModales.test.tsx`, joués sous jsdom où la tabulation est
 *     simulée fidèlement. Les rejouer ici doublerait la couverture sans rien
 *     ajouter ;
 *
 *   — la PERTINENCE d'un champ, l'ordre des questions, le bien-fondé d'un
 *     libellé. Aucune garde ne sait cela, et celle-ci ne prétend pas le savoir ;
 *
 *   — ce que devient la modale au-delà de 1280 px, et entre 360 et 1280. Deux
 *     largeurs, choisies parce que la boîte a deux formes — feuille collée en
 *     bas sous `sm`, boîte centrée au-delà — et non parce que deux suffisent.
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
  { nom: 'AddBuilding', adresse: '/demo/parc', bouton: /^Ajouter un immeuble$|^Add a building$/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'AddUnit', adresse: '/demo/parc', bouton: /^Ajouter un logement$|^Add a unit$/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'OpenWork', adresse: '/demo/travaux', bouton: /^Ouvrir un chantier$|^Open a job$/, defil: { 360: 130, 1280: 0 }, avant: { 360: 1056, 1280: 913 } },
  { nom: 'RecordPayment', adresse: '/demo/paiements', bouton: /^Enregistrer un paiement$|^Record a payment$/, defil: { 360: 460, 1280: 40 }, avant: { 360: 522, 1280: 236 } },
  { nom: 'Receipt', adresse: '/demo/paiements', bouton: /Quittance|Receipt/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'Inspection', adresse: '/demo/etats-des-lieux', bouton: /^Établir un état des lieux$|^Record an inspection$/, defil: { 360: 250, 1280: 0 }, avant: { 360: 237, 1280: 0 } },
  { nom: 'Invite', adresse: '/demo/locataires', bouton: /^Inviter par code$|^Invite by code$/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'Announce', adresse: '/demo/locataires', bouton: /^Prévenir les locataires$|^Notify tenants$/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'Reply', adresse: '/demo/travaux', bouton: /^Répondre$|^Reply$/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /* Le seul écran de la démonstration où le rôle change ce qui est rendu : la
     modale du locataire n'existe que pour lui. Le radio de profil est `sr-only`,
     donc invisible au sens de Playwright — d'où le clic FORCÉ, qui est ici la
     vérité du geste et non un contournement : à la souris, c'est l'étiquette
     qu'on vise, et elle est bien visible. */
  { nom: 'Report', adresse: '/demo/travaux', profil: /Locataire|Tenant/, bouton: /^Signaler un problème$|^Report an issue$/, defil: { 360: 620, 1280: 250 }, avant: { 360: 0, 1280: 0 } },
]

/**
 * LES DEUX QUI NE S'OUVRENT PAS, ET POURQUOI — voir l'en-tête.
 *
 * Écrites ici plutôt que passées sous silence : leur nombre entre dans le
 * compte gardé, donc une troisième modale qui deviendrait inatteignable ferait
 * rougir, et l'une de ces deux qui redeviendrait atteignable aussi.
 */
const NON_OUVRABLES = ['TariffsModal', 'ParkSettingsModal']
const LARGEURS = [360, 1280]
const LANGUES = ['fr', 'en']
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UN PRODUIT CALCULÉ.

  `MODALES.length * LARGEURS.length * LANGUES.length` rendrait la garde
  d'accord avec elle-même : vider `MODALES`, et l'inspection comparerait 0 à 0
  puis se déclarerait verte. La même mutation a trouvé ce piège trois lots de
  suite. Ajouter une modale oblige à toucher ce nombre, et le diff le montre.

  40 = 10 modales ouvrables × 2 largeurs × 2 langues.
  2  = les modales que la démonstration ne rend pas, nommées dans `NON_OUVRABLES`.
*/
const ATTENDUS = 40
const NON_OUVRABLES_ATTENDUES = 2

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

        if (modale.profil) {
          /* SOUS `lg`, LE SÉLECTEUR VIT DANS LE TIROIR. La barre latérale n'est
             rendue qu'à partir de 1024 px ; en dessous, il faut l'ouvrir. Sans
             ce geste la garde ne trouvait rien à 360 et se plaignait d'un
             défaut qui n'en est pas un — l'écran est correct, c'est la garde
             qui ne savait pas y entrer. */
          const tiroir = page.getByRole('button', { name: /Ouvrir la navigation|Open navigation/ }).first()
          if ((await tiroir.count()) > 0 && (await tiroir.isVisible())) {
            await tiroir.click()
            await page.waitForTimeout(400)
          }
          const radio = page.getByRole('radio', { name: modale.profil }).first()
          if ((await radio.count()) === 0) {
            plaintes.push(
              `${nom} : le sélecteur de profil est introuvable — cette modale n'existe que pour ce profil.`,
            )
            await contexte.close()
            continue
          }
          /* Clic FORCÉ : le radio est `sr-only`, donc invisible au sens de
             Playwright. À la souris c'est l'étiquette qu'on vise, et elle est
             bien visible — le forçage est ici la vérité du geste. */
          await radio.click({ force: true })
          await page.waitForTimeout(500)
          /* Le tiroir se referme : il recouvre l'écran, et la modale s'ouvre
             derrière lui. */
          const fermer = page.getByRole('button', { name: /Fermer|Close/ }).first()
          if ((await fermer.count()) > 0 && (await fermer.isVisible())) {
            await fermer.click()
            await page.waitForTimeout(400)
          }
        }

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
          /*
            LE PORTAIL, VÉRIFIÉ DIRECTEMENT ET NON PAR COÏNCIDENCE.

            Avant ce contrôle, retirer `createPortal` ne se voyait que TANT QUE
            `<main>` portait `animate-rise` : les deux retirés ensemble, la
            modale se replaçait correctement et la garde passait au vert avec le
            défaut réarmé pour le prochain `transform` posé n'importe où.

            On vérifie donc la STRUCTURE : le conteneur `fixed inset-0` de la
            modale est un enfant direct de `<body>`. C'est la seule position où
            aucun ancêtre ne peut lui voler son bloc conteneur, et c'est
            exactement ce que le portail garantit. La mesure ne dépend plus de
            ce que `<main>` décide.
          */
          const conteneur = d.parentElement
          return {
            enfantDeBody: conteneur?.parentElement === document.body,
            profondeur: (() => {
              let n = 0
              for (let e = conteneur; e && e !== document.body; e = e.parentElement) n++
              return n
            })(),
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

        if (!m.enfantDeBody) {
          plaintes.push(
            `${nom} : la modale n'est PAS un enfant direct de <body> — ${m.profondeur} niveau(x) au-dessus.\n` +
              "   Son conteneur `fixed` peut alors se faire voler son bloc conteneur par n'importe\n" +
              '   quel ancêtre portant transform, filter, contain ou will-change. Voir le portail\n' +
              "   de `Modal` et l'en-tête de ce script.",
          )
        }
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
if (NON_OUVRABLES.length !== NON_OUVRABLES_ATTENDUES) {
  plaintes.push(
    `${NON_OUVRABLES.length} modale(s) déclarée(s) non ouvrable(s) pour ${NON_OUVRABLES_ATTENDUES} attendue(s).\n` +
      "   La liste est périmée dans un sens ou dans l'autre : une modale redevenue atteignable\n" +
      '   doit rejoindre la mesure, une nouvelle inatteignable doit être nommée.',
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
  `\n✓ modales : ${inspectees}/${ATTENDUS} états ouverts et mesurés sur ${MODALES.length} modales,\n` +
    `  plus ${NON_OUVRABLES.length} que la démonstration ne rend pas : ${NON_OUVRABLES.join(', ')}.\n` +
    "  Le CLAVIER est mesuré ailleurs — `clavierDesModales.test.tsx` — sur QUATRE modales :\n" +
    "  Ajouter un immeuble, Ajouter un logement, Ouvrir un chantier, Enregistrer un paiement.\n" +
    "  TariffsModal et ParkSettingsModal NE SONT PAS COUVERTES par les cas clavier.\n" +
    "  La PERTINENCE d'un champ n'est mesurée nulle part : voir l'en-tête.",
)
