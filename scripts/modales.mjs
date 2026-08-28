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
  /*
    PARKSETTINGS ENTRE DANS LA LISTE, ET C'EST UNE DETTE QUI SE LÈVE.

    Elle était comptée sous `NON_OUVRABLES` : son bouton était gardé par
    `adhesionActive`, c'est-à-dire par un COMPTE RÉEL, donc rien ne la rendait en
    démonstration et sa géométrie n'était mesurée par personne. L'en-tête de ce
    fichier annonçait la levée « le jour où la démonstration portera une adhésion
    fictive » ; ce n'est pas le chemin qui a été pris, et il vaut mieux.

    La condition confondait deux choses : « personne à qui écrire » — vrai d'un
    compte sans parc — et « rien ne s'écrit » — vrai de la démonstration, comme
    de TOUS les gestes de cet écran. Le bouton suit désormais le rôle ACTIF, et
    la modale, qui savait déjà qu'elle n'avait pas de parc, le DIT au lieu de ne
    rien faire.

    Ce qu'on y a trouvé le jour où elle s'est ouverte : ses deux listes
    déroulantes n'avaient pas d'option vide, donc elles affichaient la première —
    « Belgique » et « FCFA — Afrique centrale ». L'écran écrit pour réparer un
    pays déduit du premier de la liste le rejouait dans son propre formulaire.
    Personne ne pouvait le voir, faute de pouvoir l'ouvrir.
  */
  /*
    LE PLAFOND DE 48, ET CE QU'IL ACHÈTE.

    Première mesure de cette modale, à 360 px, en français : 35 px de défilement
    et « pied — » au relevé, c'est-à-dire une action QUI S'EN VA AVEC LE CORPS.
    Elle était la seule des onze dans ce cas — son bouton vivait sous les quatre
    champs au lieu du pied.

    Le bouton épinglé, le défilement MONTE à 48 : le pied prend la hauteur que le
    corps n'a plus. Ces treize pixels sont exactement le prix de la règle que ce
    fichier porte dans son titre — « leur action reste sous les yeux » — et c'est
    le meilleur des deux échanges : un corps qui défile de 48 px sur un écran de
    780 est un corps normal, une action qu'on doit aller chercher ne l'est pas.

    On n'a PAS raboté les indications des champs pour rentrer sous zéro. Elles
    disent ce que le pays suggère, ce que la devise engage et ce que la
    délégation borne — sur l'écran où une erreur se paie en relisant tous les
    montants du parc dans la mauvaise unité.

    `avant` porte le 35 : il ne dit pas « ce lot a coûté », il dit d'où l'on
    vient et pourquoi le nombre a grandi.
  */
  /*
    TARIFFS ENTRE À SON TOUR, ET SON EXAMEN A RAPPORTÉ PLUS QUE LE PRÉCÉDENT.

    Sa garde avait la même forme que celle de la correction du parc — `role ===
    'owner' && adhesionActive !== null` — et le même motif écrit : « la
    démonstration n'a pas de parc à qui écrire ». Même confusion, même remède.

    MAIS SON CAS ÉTAIT PIRE. L'écran des relevés AFFICHE les deux prix de la
    démonstration, en indicateurs, lus sur ses relevés. La modale qui existe
    pour les montrer et les poser était inatteignable — et, ouverte telle
    quelle, aurait affiché « aucun prix posé » : l'éditeur des prix démentant, à
    un clic, la page qui les affiche. Elle sert donc en démonstration les prix
    de la démonstration, dérivés de la même constante que les relevés.

    ET C'EST EN L'OUVRANT QU'ON A VU LE DÉFAUT DE PRODUCTION : son historique
    datait chaque prix d'un MOIS DE TROP. La conversion `AAAA-MM-JJ` vers les
    parties de date était recopiée quatre fois dans le dépôt, et trois copies
    oubliaient que les mois y sont indexés à partir de zéro — la quittance et
    l'état des lieux frais étaient touchés aussi. Voir `lib/datesISO.test.ts`.
  */
  /*
    LE PLAFOND DE 11, ET CE QU'IL NE GARDE PAS.

    Onze pixels à 360 px, dans les deux langues, pied tenu : c'est la dernière
    ligne de l'HISTORIQUE des prix qui dépasse. Trois champs et deux lignes de
    liste, sur un écran de 780 — la modale est courte, et son action ne bouge pas.

    CE CHIFFRE NE VAUT QUE POUR LA DÉMONSTRATION, et il faut le dire : la
    longueur de l'historique dépend des DONNÉES. La démonstration en porte deux
    lignes ; un parc qui aurait redaté ses prix vingt fois en porterait vingt, et
    le corps défilerait d'autant. Ce plafond garde la forme de la modale, pas
    celle d'un parc — aucune porte de ce dépôt ne visite un parc réel.
  */
  { nom: 'Tariffs', adresse: '/demo/releves', bouton: /^Prix de refacturation$|^Rebilling prices$/, defil: { 360: 11, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'ParkSettings', adresse: '/demo/parc', bouton: /^Corriger le parc$|^Correct the park$/, defil: { 360: 48, 1280: 0 }, avant: { 360: 35, 1280: 0 } },
  { nom: 'AddBuilding', adresse: '/demo/parc', bouton: /^Ajouter un immeuble$|^Add a building$/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'AddUnit', adresse: '/demo/parc', bouton: /^Ajouter un logement$|^Add a unit$/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  { nom: 'OpenWork', adresse: '/demo/travaux', bouton: /^Ouvrir un chantier$|^Open a job$/, defil: { 360: 130, 1280: 0 }, avant: { 360: 1056, 1280: 913 } },
  { nom: 'RecordPayment', adresse: '/demo/paiements', bouton: /^Enregistrer un paiement$|^Record a payment$/, defil: { 360: 460, 1280: 40 }, avant: { 360: 522, 1280: 236 } },
  { nom: 'Receipt', adresse: '/demo/paiements', bouton: /Quittance|Receipt/, defil: { 360: 0, 1280: 0 }, avant: { 360: 0, 1280: 0 } },
  /*
    INSPECTION : LE PLAFOND MONTE, ET VOICI CE QU'IL ACHÈTE.

    Mesuré à 360 px : 237 px de défilement avant la rangée de photos, 323 avec
    elle dans sa première rédaction, 297 après avoir retiré le titre de rangée
    — qui répétait ce que le bouton dit déjà et que le lecteur d'écran
    annonçait deux fois. Les 60 px qui restent sont le BOUTON lui-même, ses
    44 px de cible et sa marge : ils ne se réduisent pas sans rendre la
    commande intouchable au doigt, ce que la porte des cibles refuserait à
    juste titre.

    Le plafond passe donc de 250 à 300, et de 0 à 20 à 1280 px. Ce n'est pas un
    défilement « qui n'achète rien » : il achète la seule façon de joindre une
    preuve à une réserve depuis le lieu où on la constate. Une vignette ajoutée
    coûte en plus sa hauteur, et c'est un choix de l'utilisateur, pas un défaut
    de l'écran — la mesure ci-dessous se fait sans photo choisie.
  */
  { nom: 'Inspection', adresse: '/demo/etats-des-lieux', bouton: /^Établir un état des lieux$|^Record an inspection$/, defil: { 360: 300, 1280: 20 }, avant: { 360: 237, 1280: 0 } },
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
/*
  VIDE, ET C'EST UN ÉTAT QUI SE GARDE COMME UN AUTRE.

  Les douze modales du produit sont désormais toutes ouvrables en démonstration.
  La liste reste, avec son compte : une treizième que la démonstration ne
  rendrait pas devrait s'y inscrire et faire bouger `NON_OUVRABLES_ATTENDUES`,
  donc apparaître dans un diff. Retirer la liste parce qu'elle est vide, c'est
  retirer le seul endroit où l'on remarquerait qu'elle a cessé de l'être.
*/
const NON_OUVRABLES = []

/**
 * Les libellés que `clavierDesModales.test.tsx` joue, recopiés pour que la ligne
 * de succès puisse nommer CE QUI RESTE dehors plutôt que de l'affirmer.
 *
 * Recopiés et non importés : ce script est un module Node, l'autre un fichier de
 * cas sous jsdom, et les relier ferait dépendre une porte du chargement de
 * l'autre. Le prix est cette liste ; le garde-fou est `COUVERTES_AU_CLAVIER`,
 * qui rougirait si les deux comptes cessaient de s'accorder, et la vérification
 * juste dessous, qui refuse un libellé sans modale correspondante ici.
 *
 * ELLE LES PORTE TOUTES LES DOUZE depuis que les six dernières sont entrées
 * dans les cas clavier. Trois d'entre elles demandaient plus qu'un clic : la
 * quittance et la réponse se répètent PAR LIGNE — dix et quatre boutons
 * mesurés — et le signalement n'existe que pour le LOCATAIRE.
 */
const COUVERTS = [
  'Ajouter un immeuble',
  'Ajouter un logement',
  'Ouvrir un chantier',
  'Enregistrer un paiement',
  'Corriger le parc',
  'Prix de refacturation',
  'Quittance',
  'Établir un état des lieux',
  'Inviter par code',
  'Prévenir les locataires',
  'Répondre',
  'Signaler un problème',
]
const LARGEURS = [360, 1280]
const LANGUES = ['fr', 'en']
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UN PRODUIT CALCULÉ.

  `MODALES.length * LARGEURS.length * LANGUES.length` rendrait la garde
  d'accord avec elle-même : vider `MODALES`, et l'inspection comparerait 0 à 0
  puis se déclarerait verte. La même mutation a trouvé ce piège trois lots de
  suite. Ajouter une modale oblige à toucher ce nombre, et le diff le montre.

  48 = 12 modales ouvrables × 2 largeurs × 2 langues.
  0  = plus aucune modale hors de portée de la démonstration.

  Les deux nombres ont bougé ENSEMBLE, deux fois de suite : `ParkSettings` puis
  `Tariffs` sont passées de la seconde ligne à la première. C'est exactement ce
  que ce compte écrit à la main sert à rendre visible dans un diff.
*/
const ATTENDUS = 48
const NON_OUVRABLES_ATTENDUES = 0

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
          const troisPoints = page
            .locator('[data-en-tete-de-page] [aria-haspopup="menu"]')
            .first()
          if ((await troisPoints.count()) > 0) {
            await troisPoints.click()
            await page.waitForTimeout(200)
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

/*
  LA LIGNE DE SUCCÈS SUIT L'ÉTAT, elle ne le récite pas.

  Elle disait « TariffsModal et ParkSettingsModal ne sont pas couvertes par les
  cas clavier » et « sur QUATRE modales » — deux phrases écrites en dur, vraies
  le jour où on les a tapées et fausses depuis que les deux modales ont rejoint
  les cas clavier, qui sont six. Une porte dont le rapport se périme apprend à
  ne plus lire son rapport.

  `COUVERTES_AU_CLAVIER` est donc écrit ICI, à la main, comme `ATTENDUS` — et
  pour la même raison : dérivé de l'autre fichier il ne dirait rien, recopié
  sans compte il se périmerait encore. Le nombre force à toucher cette ligne le
  jour où la couverture bouge.
*/
const COUVERTES_AU_CLAVIER = 12
/*
  GARDE DU GARDE : le nombre écrit et la liste recopiée doivent s'accorder, et
  la liste doit désigner des modales qui EXISTENT. Sans cette vérification, un
  libellé mal recopié sortirait sa modale du compte des couvertes et la ferait
  passer pour non couverte — un rapport plus faux que celui qu'on vient de
  corriger, parce qu'il aurait l'air d'avoir été vérifié.
*/
const introuvables = COUVERTS.filter((c) => !MODALES.some((m) => m.bouton.test(c)))
if (COUVERTS.length !== COUVERTES_AU_CLAVIER || introuvables.length > 0) {
  console.error(
    `\n✗ modales : la liste des modales couvertes au clavier ne tient pas.\n` +
      `   ${COUVERTS.length} libellé(s) recopié(s) pour ${COUVERTES_AU_CLAVIER} annoncé(s).\n` +
      (introuvables.length
        ? `   Sans modale correspondante ici : ${introuvables.join(', ')}\n`
        : ''),
  )
  exit(1)
}
const horsClavier = MODALES.filter((m) => !COUVERTS.some((c) => m.bouton.test(c)))

console.log(
  `\n✓ modales : ${inspectees}/${ATTENDUS} états ouverts et mesurés sur ${MODALES.length} modales,\n` +
    (NON_OUVRABLES.length === 0
      ? '  et AUCUNE que la démonstration ne rende pas — la liste est vide et gardée vide.\n'
      : `  plus ${NON_OUVRABLES.length} que la démonstration ne rend pas : ${NON_OUVRABLES.join(', ')}.\n`) +
    '  Le CLAVIER est mesuré ailleurs — `clavierDesModales.test.tsx` — sur ' +
    `${COUVERTES_AU_CLAVIER} modales ;\n` +
    (horsClavier.length === 0
      ? '  TOUTES y sont — entrée du focus, piège, Échap, retour au bouton.\n'
      : `  les ${horsClavier.length} autres ne le sont pas : ${horsClavier.map((m) => m.nom).join(', ')}.\n`) +
    "  La PERTINENCE d'un champ n'est mesurée nulle part : voir l'en-tête.",
)
