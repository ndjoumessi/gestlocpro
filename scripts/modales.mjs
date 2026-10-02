#!/usr/bin/env node
/**
 * LES MODALES TIENNENT DANS LA FENÊTRE, ET LEUR ACTION RESTE SOUS LES YEUX.
 *
 * TROIS DÉFAUTS MESURÉS, ET LE PLUS GRAVE NE VENAIT PAS DU CONTENU.
 *
 * 1. LE BLOC CONTENEUR VOLÉ. Le conteneur de la modale est `fixed inset-0` : il
 *    devrait couvrir la fenêtre. Il ne le faisait pas. `<main>` PORTAIT ALORS
 *    `animate-rise`, et une animation de `transform` laisse au repos une matrice
 *    IDENTITÉ — qui est une transformation. (`animate-rise` a été retiré de
 *    `<main>` le 2026-09-24 ; cette porte ne s'en trouve pas désarmée — voir
 *    plus bas, elle mesure la STRUCTURE du portail et non ce que `<main>`
 *    décide.) Un ancêtre transformé devient le
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
 *   — PLUS AUCUNE MODALE N'ÉCHAPPE À CE FICHIER, et c'est récent. Deux d'entre
 *     elles — `ParkSettingsModal`, puis `TariffsModal` — avaient leur bouton
 *     gardé par `adhesionActive`, c'est-à-dire par un COMPTE RÉEL : en
 *     démonstration l'adhésion est nulle, le bouton n'était pas rendu, et leur
 *     géométrie n'était mesurée par personne.
 *
 *     La même confusion dans les deux cas : « personne à qui écrire » — vrai
 *     d'un compte connecté sans parc — et « rien ne s'écrit » — vrai de la
 *     démonstration, comme de tous les gestes de leurs écrans. Les deux suivent
 *     désormais le rôle ACTIF.
 *
 *     Le second examen a rapporté un défaut de PRODUCTION que le premier n'avait
 *     pas : l'historique des prix datait chaque ligne d'un mois de trop, et la
 *     même conversion fautive servait la date de règlement d'une quittance.
 *
 *     `clavierDesModales.test.tsx` LES COUVRE TOUTES LES DEUX depuis.
 *
 *   — le CLAVIER. Piège de focus, Échap, retour du focus : ce sont les cas de
 *     `clavierDesModales.test.tsx`, joués sous jsdom où la tabulation est
 *     simulée fidèlement, et qui couvrent désormais les DOUZE. Les rejouer ici
 *     doublerait la couverture sans rien ajouter ;
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
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
/* `POLICE_LARGE` EST REVENU ICI LE 2026-10-01, et ce n'est pas un retour en
   arrière : il était parti avec `plafondDe` vers `modales/plafonds.mjs`, et il
   revient pour une AUTRE question — savoir si la colonne native appartient à
   cette machine. Le témoin ci-dessous en a besoin ; le choix de colonne, non. */
import { POLICE_LARGE, imposerLaPoliceLarge } from './police-large.mjs'
import { laColonneNormalePeutEtreANous, releverLeTemoin } from './temoin-de-la-machine.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
/* La MÊME sonde que `mesure-ui` et `espace-connecte`, bornée au dialogue. */
import {
  MESURER_CIBLES,
  MESURER_GABARITS,
  PLANCHER_CIBLE,
  RAYON_SONDAGE,
  RELEVER_LES_CLOTURES_PERMEABLES,
  SELECTEUR_DE_COMMANDE,
} from './sondes-de-rendu.mjs'
import { readFileSync } from 'node:fs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'
import { MODALES } from './modales/registre.mjs'
import {
  ATTENDUS,
  LANGUES,
  LARGEURS,
  NON_OUVRABLES,
  NON_OUVRABLES_ATTENDUES,
  plafondDe,
} from './modales/plafonds.mjs'
import { attendreQueLaBoiteSePose } from './modales/attente.mjs'
import { mesurerLaBoite } from './modales/mesure-de-la-boite.mjs'
import { lireLaCouvertureClavier } from './modales/couverture-clavier.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * L'AUDIT DE CONTRASTE, LU ET NON RECOPIÉ — le même fichier que la console,
 * `mesure-ui` et `espace-connecte`. Sa racine est posée sur le dialogue par
 * `__AUDIT_RACINE__` avant l'évaluation : lu sur le document, il verrait la page
 * derrière — que les deux autres portes tiennent déjà.
 */
const AUDIT_CONTRASTE = readFileSync(join(RACINE, 'scripts/contrast-audit.js'), 'utf8')
const PORT = 4192
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES MODALES INSPECTÉES, ET COMMENT ON LES OUVRE : `scripts/modales/registre.mjs`.
 *
 * Le registre a quitté ce fichier le 2026-09-30, quand la fumée s'est mise à
 * ouvrir les mêmes modales sur l'hôte vivant. Son en-tête dit pourquoi. Ce qui
 * reste ici est la MESURE — les plafonds y sont lus, ils n'y sont pas écrits.
 */

/**
 * LES PLAFONDS, LE COMPTE GARDÉ ET LES NON-OUVRABLES : `scripts/modales/plafonds.mjs`.
 *
 * Sortis d'ici le 2026-10-01 avec leur historique — chaque palier d'`ATTENDUS`
 * et le lot qui l'a fait bouger, et les deux colonnes de police. Ce qui reste
 * dans ce fichier est la MESURE : les plafonds y sont lus, jamais écrits.
 */

/* LE PAQUET AVANT TOUT LE RESTE : ce script mesure `dist/`, jamais les
   sources. Un paquet périmé rendrait un verdict sur le code d'AVANT, en
   silence — voir `paquet-a-jour.mjs`, qui porte les trois cas mesurés. */
exigerUnPaquetAJour()


const serveur = await servirLaPrevisualisation('modales', PORT)
const plaintes = []
/*
  LE TÉMOIN DE LA MACHINE, et cette porte n'en avait pas.

  Elle porte deux colonnes — `defil` et `defilLarge` — depuis le 2026-09-09, et
  refusait sur la NATIVE quelle que soit la machine. C'est exactement le faux
  rapport que `temoin-de-la-machine` a été écrit pour corriger le 2026-09-27 ;
  la correction n'avait visé que trois portes sur cinq, et celle-ci était du
  mauvais côté. Sur un exécuteur Linux sans commutateur, elle refuse des modales
  sur des plafonds relevés sous SF Pro, qu'aucune de ses mesures ne concerne.

  `true` par défaut : en police IMPOSÉE, Verdana est posée par CSS et toute
  machine la rend pareil — cette colonne-là n'appartient à personne en
  particulier, donc elle se juge partout.
*/
let temoinDeLaMachine = null
let colonneANous = true
/* Combien de modales la sonde des gabarits a lues — voir sa garde du garde. */
let gabaritsInspectes = 0
/* Ce que les deux audits de modale ont réellement examiné — leurs gardes. */
/* Les états dont la boîte n'a jamais cessé de bouger — mesurés quand même, et
   NOMMÉS dans le rapport. */
const attentesExpirees = []
let laPlusLenteMs = 0

let textesDeModaleAudites = 0
let ciblesDeModaleSondees = 0
/* Combien d'états ont été confrontés aux clôtures perméables — voir leur garde. */
let cloturesDeModaleSondees = 0
const releve = []
let inspectees = 0

try {
  const navigateur = await chromium.launch()
  for (const modale of MODALES) {
    for (const largeur of LARGEURS) {
      for (const langue of LANGUES) {
        const contexte = await navigateur.newContext({
          ...SANS_AGENT_DE_SERVICE,
          viewport: { width: largeur, height: largeur === 360 ? 780 : 900 },
          locale: langue === 'fr' ? 'fr-FR' : 'en-US',
          colorScheme: 'light',
        })
        await imposerLaPoliceLarge(contexte)
        const page = await contexte.newPage()
        await page.addInitScript((l) => {
          try {
            localStorage.setItem('gestlocpro.locale', l)
          } catch {
            /* stockage refusé : la langue reste celle du contexte */
          }
        }, langue)
        await page.goto(BASE + modale.adresse, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(400)
        /* UNE FOIS SUFFIT : le témoin décrit la MACHINE, pas la modale. Relevé
           sur la première page ouverte plutôt que dans une page à lui. */
        if (temoinDeLaMachine === null) {
          temoinDeLaMachine = await releverLeTemoin(page)
          if (!POLICE_LARGE) colonneANous = laColonneNormalePeutEtreANous(temoinDeLaMachine)
        }

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

        /*
          LE PRÉALABLE, quand la modale n'a rien à ouvrir sans lui.

          Une seule s'en sert : la suppression d'un immeuble, dont l'issue
          n'existe que sur un immeuble VIDE — voir son entrée. La sonde suit
          alors le chemin de l'utilisateur au lieu qu'on maquille les données.
        */
        if (modale.prealable) {
          try {
            await modale.prealable(page)
          } catch (erreur) {
            plaintes.push(
              `${nom} : le préalable a échoué — ${String(erreur).split('\n')[0]}\n` +
                "   La modale n'a pas pu être amenée à l'écran, donc rien n'a été mesuré.",
            )
            await contexte.close()
            continue
          }
        }

        /*
          LE MENU DE DÉBORDEMENT EST OUVERT D'ABORD, s'il faut.

          Trois de ces modales s'ouvrent depuis une action que l'en-tête replie
          derrière trois points — poser un prix, corriger le parc, prévenir les
          locataires. Le bouton n'a pas disparu : il vit une porte plus loin, et
          la sonde suit le même chemin que l'utilisateur.

          On ouvre le menu de L'EN-TÊTE, jamais le premier de la page : la
          coquille en porte déjà un pour le compte, et l'ouvrir mènerait à la
          déconnexion.
        */
        if ((await page.getByRole('button', { name: modale.bouton }).count()) === 0) {
          /*
            DEUX NIVEAUX REPLIENT : la rangée d'actions de la page, et les cartes
            d'intervention. On essaie donc les déclencheurs un par un, l'en-tête
            d'abord, et l'on REFERME celui qui ne portait pas ce qu'on cherche —
            un panneau laissé ouvert se poserait au-dessus du suivant.

            La coquille porte le même attribut tout en haut pour son menu de
            compte : ouvert par mégarde, il mène à la déconnexion. Les deux
            sélecteurs l'écartent par son ancêtre.
          */
          const candidats = await page
            .locator('[data-en-tete-de-page] [aria-haspopup="menu"], main [aria-haspopup="menu"]')
            .all()
          for (const trois of candidats) {
            await trois.click()
            await page.waitForTimeout(150)
            if ((await page.getByRole('menuitem', { name: modale.bouton }).count()) > 0) break
            await page.keyboard.press('Escape')
            await page.waitForTimeout(100)
          }
        }

        const bouton = page
          .getByRole('button', { name: modale.bouton })
          .or(page.getByRole('menuitem', { name: modale.bouton }))
          .first()
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

        /*
          LE GESTE FAIT DANS LA MODALE, une fois qu'elle est ouverte.

          `prealable` amène la modale à l'écran ; il n'y avait rien pour agir
          DEDANS. Or une modale n'a pas un état, elle en a autant que ses
          champs : le choix « Gestionnaire délégué » remplace le menu des
          logements par une note de quatre lignes, et ce second état n'était
          mesuré par personne — c'est l'angle mort que `notes-conditionnelles`
          a nommé le 2026-08-31.

          On mesure donc l'état DEMANDÉ, pas seulement celui d'ouverture.
        */
        if (modale.apres) {
          try {
            await modale.apres(page)
            await page.waitForTimeout(250)
            /*
              LA NOTE EXIGÉE, quand l'entrée en déclare une.

              Un geste qui cesserait d'atteindre l'état demandé — un sélecteur
              renommé, une option disparue — mesurerait l'état d'OUVERTURE une
              seconde fois, en silence, et ce script rendrait vert sur une
              modale qu'il n'a pas ouverte comme il le croit. La note est la
              preuve que le geste a porté.
            */
            if (modale.note) {
              const boite = page.getByRole('dialog').first()
              const texte = (await boite.innerText().catch(() => '')) || ''
              if (!modale.note.test(texte)) {
                plaintes.push(
                  `${nom} : le geste est passé mais l'état demandé n'est PAS là — ` +
                    `la note ${modale.note} ne paraît pas dans la boîte.\n` +
                    "   C'est donc l'état d'ouverture qui allait être mesuré une " +
                    'seconde fois.',
                )
                await contexte.close()
                continue
              }
            }
          } catch (erreur) {
            plaintes.push(
              `${nom} : le geste dans la modale a échoué — ${String(erreur).split('\n')[0]}\n` +
                "   L'état demandé n'a pas été atteint, donc c'est un AUTRE état qui aurait\n" +
                '   été mesuré — et « pas mesuré » ne doit jamais s’écrire comme « sans défaut ».',
            )
            await contexte.close()
            continue
          }
        }

        const assise = await attendreQueLaBoiteSePose(page)
        if (!assise.posee) attentesExpirees.push(`${nom} (${assise.polices})`)
        if (assise.ms > laPlusLenteMs) laPlusLenteMs = assise.ms

        const m = await mesurerLaBoite(page)
        /**
         * AUCUN GABARIT NE SURVIT DANS UNE MODALE NON PLUS.
         *
         * Les deux portes qui cherchent les `{jeton}` non résolus balaient des
         * PAGES : `mesure-ui` sur la démonstration, `espace-connecte` derrière une
         * session. Ni l'une ni l'autre n'ouvre une boîte de dialogue, et l'en-tête
         * de la sonde le dit depuis le jour où elle est née — « les modales, qui
         * ne sont pas ouvertes par les balayages qui l'emploient ».
         *
         * Vingt modales, quatre-vingts états, et pas un seul regardé sous cet
         * angle. Ce script les ouvre déjà toutes : la sonde ne coûte qu'un
         * `evaluate` de plus dans une boîte qui est là.
         *
         * BORNÉE AU DIALOGUE. Lue sur `body`, elle verrait la page derrière — que
         * les deux autres portes tiennent déjà — et ferait rougir une modale
         * innocente pour le jeton de son fond.
         */
        const gabarits = await page.evaluate(MESURER_GABARITS, '[role="dialog"],[role="alertdialog"]')

        /**
         * CONTRASTE ET CIBLES, DANS LA BOÎTE OUVERTE — la dette que
         * `mesure-ui` déclarait à chaque passage : « les DIX modales du
         * produit n'en sont pas ; leur contraste et leurs cibles restent NON
         * audités ». Vingt modales aujourd'hui, quatre-vingts états, et tous
         * les gestes qu'on ne défait pas — arbitrer une caution, délier une
         * fiche, reprendre un accès — vivent précisément ici.
         *
         * LA SONDE DES CIBLES SE BORNE D'ELLE-MÊME : « une modale ouverte
         * borne le balayage à elle-même », écrit dans son propre en-tête,
         * pour la raison qu'`elementFromPoint` rend la couche derrière elle.
         * L'audit de contraste, lui, reçoit sa racine par
         * `__AUDIT_RACINE__` — même geste que `MESURER_GABARITS`.
         *
         * LES DEUX THÈMES, parce que la moitié des jetons ne vit qu'en
         * sombre — `warn` y vaut #e0b877 sur #54421f, aucun des deux
         * n'existant en clair. La bascule se fait à chaud sur la boîte déjà
         * ouverte, animations gelées : sans le gel, `mesure-ui` a mesuré
         * que 13 points sur 24 rendaient un relevé different — la page est
         * MIXTE pendant les 150 ms de transition, et l'audit invente des
         * fautes. Les cibles, elles, ne dépendent pas du thème : une fois.
         */
        await page
          .addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
          .catch(() => {})
        await page.evaluate(() => {
          window.__AUDIT_RACINE__ = '[role="dialog"],[role="alertdialog"]'
        })
        for (const theme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: theme })
          const contraste = await page.evaluate(AUDIT_CONTRASTE)
          if (!contraste || typeof contraste.examines !== 'number') {
            plaintes.push(
              nom + ' : `contrast-audit.js` n\'a pas rendu `{ failures, items, examines }`.',
            )
          } else {
            textesDeModaleAudites += contraste.examines
            for (const item of contraste.items) {
              plaintes.push(
                `${nom} · ${largeur}px · ${langue} · ${theme} : contraste ${item.ratio} sous le seuil ` +
                  `WCAG AA dans la modale — ${(item.text ?? '').slice(0, 44)} (${item.color} sur ${item.bg})`,
              )
            }
          }
        }
        await page.emulateMedia({ colorScheme: 'light' })

        /**
         * LES CLÔTURES PERMÉABLES, DANS LA BOÎTE OUVERTE.
         *
         * LA DERNIÈRE DETTE DE CETTE FAMILLE, écrite dans les trois lots qui
         * l'ont précédée : « les MODALES restent hors de portée des deux
         * portes ». `plafond-hauteurs` et `espace-connecte` tiennent la règle
         * sur des pages ; aucune des deux n'ouvre une boîte de dialogue.
         *
         * ET LA FORME EST PRÉCISÉMENT CELLE DU DÉFAUT D'ORIGINE. Une modale
         * borne son corps — `max-h-…` puis `overflow-y-auto` — pour que son
         * pied reste sous les yeux : c'est la MÊME construction que le panneau
         * du portail, par où 2 198 px de vide sont entrés le 2026-09-09. Il y
         * manquait juste quelqu'un pour regarder.
         *
         * BORNÉE AU DIALOGUE, comme `MESURER_GABARITS` juste au-dessus et pour
         * le même motif : lue sur `body`, elle rendrait les clôtures de la page
         * derrière — que `plafond-hauteurs` tient déjà — et le refus nommerait
         * une modale innocente.
         *
         * CE QU'ON N'APPLIQUE PAS ICI, ET POURQUOI : la règle du défilement
         * fantôme. Elle compare la hauteur DÉROULÉE du document à celle du
         * corps ; une modale est `fixed`, donc elle ne participe à aucun des
         * deux nombres. Appliquée la boîte ouverte, elle mesurerait la page
         * derrière — déjà mesurée, sans la modale, par `plafond-hauteurs`.
         */
        const clotures = await page.evaluate(
          RELEVER_LES_CLOTURES_PERMEABLES,
          '[role="dialog"],[role="alertdialog"]',
        )
        cloturesDeModaleSondees++
        for (const c of clotures) {
          plaintes.push(
            `${nom} · ${largeur}px · ${langue} : une CLÔTURE PERMÉABLE dans la modale — ` +
              `<${c.balise}> ${c.classes}\n` +
              `   découpe ${c.decoupe} px sur ${c.axe}, et ${c.combien} descendant(s) absolu(s) ` +
              'lui échappent :\n' +
              c.evades
                .map(
                  (e) =>
                    `      <${e.balise}> ${e.classes} ${e.taille}  « ${e.texte} »\n` +
                    `         borné par ${e.borne}`,
                )
                .join('\n') +
              '\n   `position: relative` suffit, et ne déplace rien à l’œil.',
          )
        }

        const cibles = await page.evaluate(MESURER_CIBLES, {
          plancher: PLANCHER_CIBLE,
          rayon: RAYON_SONDAGE,
          selecteur: SELECTEUR_DE_COMMANDE,
        })
        ciblesDeModaleSondees += cibles.sondees
        for (const defaut of cibles.defauts) {
          plaintes.push(
            `${nom} · ${largeur}px · ${langue} : cible touchable ${defaut.cible} px ` +
              `(boîte ${defaut.boite}) dans la modale, sous le plancher de ${PLANCHER_CIBLE} — ` +
              `<${defaut.balise}> ${defaut.texte || defaut.classes}`,
          )
        }

        await contexte.close()

        if (gabarits.vu) {
          gabaritsInspectes++
          if (gabarits.jetons.length > 0) {
            plaintes.push(
              `${nom} · ${largeur}px · ${langue} : gabarit NON RÉSOLU dans la modale — ` +
                `${gabarits.jetons.join(", ")}` +
                "\n   Le paramètre n'atteint pas t(), ou le message est écrit en ICU " +
                "imbriqué, que le fournisseur ne lit pas.",
            )
          }
        }

        if (!m) {
          plaintes.push(`${nom} : le bouton a été cliqué et aucune boîte de dialogue n'est apparue.`)
          continue
        }
        inspectees++
        releve.push({ nom, largeur, ...m, plafond: plafondDe(modale, largeur), avant: modale.avant[largeur] })

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
        /*
          LE CORPS DIT-IL QU'IL CONTINUE ?

          La coupe est NETTE aux deux bords : une ligne tranchée à mi-hauteur
          sous l'en-tête, un champ disparu sous le pied, et rien pour
          distinguer « le formulaire s'arrête là » de « il reste six champs ».
          Le liseré des bandes ne dit rien de la direction — posé en haut d'un
          corps déjà défilé, il ressemble même à un début.

          Cette mesure ne peut vivre qu'ICI : dans le rendu d'essai, un corps
          n'a ni hauteur ni défilement, donc la question n'a pas de réponse.

          On l'exige DANS LES DEUX SENS, et le second est celui qu'on oublie :
          un voile du bas qui ne s'éteint jamais annonce une suite qui n'existe
          pas, en bas d'un formulaire dont on cherche justement le bouton.
        */
        if (m.defil > 0) {
          if (m.voilesEnHaut.bas !== true)
            plaintes.push(
              `${nom} : ${m.defil} px à lire plus bas, et le corps ne le dit pas.\n` +
                '   La coupe sous le pied ne distingue pas la fin du formulaire de sa suite.',
            )
          if (m.voilesEnHaut.haut !== false)
            plaintes.push(`${nom} : le corps annonce une suite au-dessus alors qu'il est en haut.`)
          if (m.voilesEnBas.haut !== true)
            plaintes.push(
              `${nom} : défilé jusqu'en bas, le corps ne dit pas que quelque chose reste au-dessus.`,
            )
          if (m.voilesEnBas.bas !== false)
            plaintes.push(
              `${nom} : arrivé en bas, le corps annonce encore une suite.\n` +
                "   Un voile qui ne s'éteint pas fait chercher un contenu qui n'existe pas.",
            )
        } else if (m.voilesEnHaut.haut || m.voilesEnHaut.bas) {
          plaintes.push(
            `${nom} : le corps tient entier et annonce pourtant une suite ` +
              `(${m.voilesEnHaut.haut ? 'au-dessus' : ''}${m.voilesEnHaut.bas ? ' en dessous' : ''}).`,
          )
        }
        for (const v of m.valeursRognees) {
          plaintes.push(
            `${nom} : « ${v.texte} » est COUPÉ dans son champ — ${v.manque} px de trop pour ` +
              `${v.offert} px offerts.\n` +
              '   Un texte coupé DANS sa boîte ne déborde de rien : aucune autre règle ne le voit.\n' +
              "   Remèdes : élargir le champ ; raccourcir ce qu'il MONTRE une fois fermé, en\n" +
              '   gardant la forme longue dans sa liste (`OptionCombobox.resume`).',
          )
        }
        /* ON NE REFUSE QUE SUR UNE COLONNE QUI EST LA NÔTRE — voir la
           déclaration de `colonneANous` et son motif. */
        if (m.defil > plafondDe(modale, largeur) && colonneANous) {
          plaintes.push(
            `${nom} : ${m.defil} px de défilement pour un plafond de ${plafondDe(modale, largeur)}.\n` +
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
/**
 * GARDE DU GARDE — la sonde des gabarits a-t-elle lu une seule modale ?
 *
 * Elle est née VERTE : aucun jeton non résolu dans les quatre-vingts états. Un
 * vert de ce genre est indistinguable d'une sonde qui ne trouve plus son
 * dialogue — un sélecteur changé, une modale montée ailleurs qu'en portail. Le
 * compte est la seule chose qui les sépare, et il suit `ATTENDUS` sans le
 * doubler : ce sont les mêmes ouvertures.
 */
/**
 * GARDES DU GARDE des deux audits de modale — nés VERTS, donc sans rouge pour
 * prouver qu'ils regardent. Seuls ces comptes séparent « aucune faute » de
 * « rien d'examiné » : une racine qui ne résout plus, un sélecteur changé, et
 * les deux rendraient le même silence.
 *
 * Planchers très en dessous du relevé — ils prouvent que les audits trouvent
 * encore leurs éléments, jamais la richesse des boîtes.
 */
const TEXTES_DE_MODALE_ATTENDUS = 400
if (textesDeModaleAudites < TEXTES_DE_MODALE_ATTENDUS) {
  plaintes.push(
    `contraste des modales : ${textesDeModaleAudites} texte(s) examiné(s) pour ` +
      `${TEXTES_DE_MODALE_ATTENDUS} attendus au moins. Une racine qui ne résout plus rend le ` +
      'même vert que des boîtes saines.',
  )
}

const CIBLES_DE_MODALE_ATTENDUES = 150
if (ciblesDeModaleSondees < CIBLES_DE_MODALE_ATTENDUES) {
  plaintes.push(
    `cibles des modales : ${ciblesDeModaleSondees} sondée(s) pour ` +
      `${CIBLES_DE_MODALE_ATTENDUES} attendues au moins.`,
  )
}

/*
  GARDE DU GARDE — la règle des clôtures a-t-elle vu TOUS les états ?

  Le compte est ÉGAL, et adossé à `ATTENDUS`, que ce fichier tient déjà. La
  règle ne rend une plainte que sur une modale malade : son silence ressemble
  donc trait pour trait au silence d'une sonde qu'on aurait sautée.
*/
if (cloturesDeModaleSondees !== ATTENDUS) {
  plaintes.push(
    `clôtures des modales : ${cloturesDeModaleSondees} état(s) confronté(s) pour ` +
      `${ATTENDUS} attendu(s). La sonde a été sautée quelque part.`,
  )
}

if (gabaritsInspectes !== ATTENDUS) {
  plaintes.push(
    `la sonde des gabarits a lu ${gabaritsInspectes} modale(s) pour ${ATTENDUS} ouverture(s). ` +
      "Ce n'est pas « aucun jeton », c'est une sonde qui ne trouve plus son dialogue.",
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

/* LA LIGNE DE SUCCÈS SUIT L'ÉTAT, elle ne le récite pas — et ce qu'elle dit du
   CLAVIER est lu dans le registre du clavier, jamais recopié ici :
   `scripts/modales/couverture-clavier.mjs`. Son en-tête porte les deux
   rédactions qui se sont périmées à cet endroit, dont un `17` que la porte a
   imprimé trois jours comme une vérité vérifiée. */
const { fichiers: fichiersAuClavier, horsClavier } = lireLaCouvertureClavier(RACINE, MODALES)

console.log(
  `\n✓ modales : ${inspectees}/${ATTENDUS} états ouverts et mesurés sur ${MODALES.length} modales,\n` +
    /* AU VERT AUSSI : un vert obtenu sur une colonne qui n'est pas la nôtre
       n'est pas une assurance, et il ne se dirait qu'au rouge sans cette ligne. */
    (colonneANous
      ? ''
      : `  ⚠ Colonne « defil » NON JUGÉE : \`system-ui\` vaut ici la face de repli\n` +
        `    (${temoinDeLaMachine?.systeme} px contre ${temoinDeLaMachine?.repli} px) — ce vert ne\n` +
        '    porte que sur ce que cette machine pouvait mesurer.\n') +
    `  ${textesDeModaleAudites} textes confrontés au seuil WCAG AA dans les boîtes, deux thèmes ;\n` +
    `  ${ciblesDeModaleSondees} cibles de modale sondées au doigt, plancher ${PLANCHER_CIBLE} px.\n` +
    `  ${cloturesDeModaleSondees} état(s) confronté(s) aux clôtures perméables : une boîte qui borne\n` +
    '  son corps ne doit pas laisser sortir ses absolus.\n' +
    /* L'ATTENTE SE RAPPORTE AU VERT AUSSI. Une attente dont on ne dit rien ne
       se distingue pas d'une attente absente : c'est ce qui a permis au délai
       fixe de 400 ms de passer pour une garantie pendant des mois. */
    (attentesExpirees.length === 0
      ? `  Toutes les boîtes se sont POSÉES avant mesure — la plus lente en ` +
        `${laPlusLenteMs} ms.\n`
      : `  ⚠ ${attentesExpirees.length} boîte(s) n'ont jamais cessé de bouger et ont été mesurées\n` +
        `    quand même : ${attentesExpirees.join(', ')}.\n` +
        `    Leur relevé est donc une PHOTO d'un état mouvant, pas une mesure.\n`) +
    (NON_OUVRABLES.length === 0
      ? '  et AUCUNE que la démonstration ne rende pas — la liste est vide et gardée vide.\n'
      : `  plus ${NON_OUVRABLES.length} que la démonstration ne rend pas : ${NON_OUVRABLES.join(', ')}.\n`) +
    '  Le CLAVIER est mesuré ailleurs — `clavierDesModales.test.tsx` — sur ' +
    `${fichiersAuClavier.size} fichier(s) de modale ;\n` +
    (horsClavier.length === 0
      ? '  TOUTES y sont — entrée du focus, piège, Échap, retour au bouton.\n'
      : `  ${horsClavier.length === 1 ? "l'autre non" : `les ${horsClavier.length} autres non`} : ` +
        `${horsClavier.map((m) => m.nom).join(', ')}.\n`) +
    "  La PERTINENCE d'un champ n'est mesurée nulle part : voir l'en-tête.",
)
