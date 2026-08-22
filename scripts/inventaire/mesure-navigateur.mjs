/**
 * RELEVÉ AU NAVIGATEUR — DES VALEURS, PAS DES VERDICTS.
 *
 * Ce fichier ne garde rien. `scripts/mesure-ui.mjs` garde ; lui décide, il a
 * des seuils, il rougit. Celui-ci MESURE et rend des nombres bruts pour les 23
 * adresses du produit, à onze largeurs et deux langues, afin qu'on puisse
 * répondre à une question que ni les tests de sources ni la porte existante ne
 * savent poser : les défauts d'usage sont-ils CONCENTRÉS sur quelques écrans et
 * quelques composants partagés, ou RÉPARTIS uniformément ?
 *
 * La distinction est le sujet. Une porte qui rougit dit « il y a un défaut
 * ici » ; elle ne dit jamais « voilà la marge qui reste partout ailleurs ». Un
 * écran vert à 45 px de cible et un écran vert à 96 px se lisent pareil dans un
 * journal, et pourtant le premier est à une traduction du rouge. Ce relevé
 * écrit les deux nombres.
 *
 * ─── CE QU'IL RÉUTILISE, ET CE QU'IL N'A PAS PU RÉUTILISER ─────────────────
 *
 * `scripts/inventaire/routes.mjs` est IMPORTÉ : les adresses ne sont pas
 * recopiées, et sa garde du garde (`exigerUnInventairePlein`) refuse ici comme
 * ailleurs un inventaire tombé sous 23.
 *
 * `scripts/mesure-ui.mjs` n'exporte RIEN : c'est un script à effets, avec des
 * `await` de tête et des `process.exit`. L'importer lancerait un build et un
 * balayage complet. Ses techniques sont donc RECOPIÉES, chacune citée à
 * l'endroit où elle sert :
 *   - le sondage des cibles AU POINT DE CONTACT (`elementFromPoint`),
 *   - la mesure de débordement par `scrollTo(400, 0)` plutôt que `scrollWidth`,
 *   - l'attente d'`aria-busy` plutôt qu'un délai fixe,
 *   - le repli d'en-tête lu par les BOÎTES et non par `flexWrap`,
 *   - le jeu de la barre publique via son marqueur `data-mesure`,
 *   - le serveur de prévisualisation et le redimensionnement plutôt que le
 *     rechargement.
 * Chaque recopie porte le nom de son original dans le commentaire qui la
 * précède, pour qu'une dérive future se voie.
 *
 * `scripts/contrast-audit.js` est un fichier de console — une IIFE qui
 * s'évalue en `{ failures, items, examines }`, c'est-à-dire qui ne rend QUE les
 * textes SOUS le seuil. Or ce relevé veut le contraste le PLUS BAS, seuil
 * franchi ou non, et il le veut séparé en texte principal et secondaire :
 * l'audit ne peut pas le rendre. Sa mathématique (oklab → sRGB, compositage
 * alpha des fonds, luminance WCAG) est donc recopiée dans `SONDE_COULEUR`, et
 * — parce qu'une copie dérive en silence, ce que ce dépôt a déjà payé — le
 * relevé exécute l'ORIGINAL sur un état témoin et compare les deux comptes de
 * fautes. Un écart fait refuser.
 *
 * ─── AXE NEUF : L'ÉCART ENTRE DEUX CIBLES ADJACENTES ───────────────────────
 *
 * Il n'existe nulle part dans le dépôt. `cibles.test.ts` lit des classes,
 * `mesure-ui.mjs` mesure des TAILLES de cibles. Aucun des deux ne regarde ce
 * qui se passe ENTRE deux cibles — or une cible de 44 px collée à sa voisine
 * se rate autant qu'une cible de 20 px isolée : le doigt qui manque la
 * première atterrit sur la seconde, et l'erreur est SILENCIEUSE (l'autre action
 * s'exécute) là où un raté sur du vide ne fait rien.
 *
 * DÉFINITION RETENUE, et elle est géométrique, pas heuristique :
 *
 *   Deux cibles A et B sont ADJACENTES SUR L'AXE HORIZONTAL si leurs
 *   projections VERTICALES se recouvrent, c'est-à-dire si
 *   `A.haut < B.bas && B.haut < A.bas`. L'écart est alors la distance
 *   bord-à-bord sur l'axe horizontal : `max(B.gauche − A.droite,
 *   A.gauche − B.droite)`. Symétriquement pour l'axe vertical.
 *   L'écart relevé pour la paire est le PLUS PETIT des écarts positifs sur les
 *   axes où elles sont adjacentes.
 *
 * POURQUOI CE CRITÈRE. Le recouvrement perpendiculaire est exactement la
 * condition pour que la voisine soit SUR LA TRAJECTOIRE du doigt qui manque :
 * deux boutons d'une même rangée se disputent le pouce, deux boutons de deux
 * rangées éloignées jamais. Et la distance bord-à-bord est exactement ce que
 * le doigt doit ne pas franchir. Le critère se calcule sans seuil, sans
 * paramètre à régler, et sur ce que la page rend vraiment.
 *
 * CE QU'IL NE VOIT PAS, et il faut le dire avant de lire ses chiffres :
 *
 *  1. LES VOISINES EN DIAGONALE. Deux cibles décalées dont ni les projections
 *     verticales ni les horizontales ne se recouvrent ne sont adjacentes sur
 *     aucun axe — même séparées de 3 px de coin à coin. WCAG 2.5.8 emploie un
 *     critère de DISQUES de 24 px qui, lui, les voit. Le critère retenu ici est
 *     plus sévère en rangée (il mesure une distance, pas un franchissement de
 *     seuil) et aveugle en diagonale. C'est un choix : les rangées de commandes
 *     sont la forme dominante du dépôt (barres d'actions, pieds de carte,
 *     cellules de tableau), les damiers de cibles n'y existent pas.
 *
 *  2. LA SURFACE RÉELLE quand elle dépasse la boîte. L'écart se calcule sur le
 *     RECTANGLE EFFECTIF : la boîte, ÉLARGIE par le sondage au point de contact
 *     là où ce sondage a eu lieu (cibles dont la boîte est petite). Au-delà,
 *     c'est la boîte seule. Une cible dont un `::after` étend la surface bien
 *     au-delà d'une grande boîte — le lien du parc, 18 × 17 de boîte pour
 *     72 × 68 de cible — verrait donc son écart SURESTIMÉ. Le biais est
 *     UNIDIRECTIONNEL et il est le bon sens : l'écart relevé est un MAJORANT du
 *     vrai. Ce relevé peut manquer une proximité, il ne peut pas en inventer.
 *
 *  3. LE TEMPS. Une cible qui n'apparaît qu'au survol, au focus ou après une
 *     ouverture de modale n'est pas dans le DOM au moment du sondage.
 *
 *  4. LES CONTENEURS À DÉFILEMENT. Deux cibles logées dans deux conteneurs
 *     différents sont comparées par leurs coordonnées d'écran à défilement nul.
 *     C'est juste pour ce qui est visible, et muet sur ce qui ne l'est qu'après
 *     défilement horizontal d'un tableau.
 *
 *  5. LES PAIRES IMBRIQUÉES sont écartées : un lien DANS un bouton n'est pas
 *     deux cibles voisines, c'est une cible et sa doublure. Le critère est le
 *     DOM (`a.contains(b)`), pas la géométrie.
 *
 *  6. LES RECOUVREMENTS 2D (les deux projections se recouvrent) ne sont pas un
 *     écart : ils sont comptés à part, sous `recouvrements`. Un écart négatif
 *     n'a pas de sens et en produire un ferait passer pour « très serré » ce
 *     qui est en réalité « superposé ».
 *
 * ─── TEXTE PRINCIPAL / TEXTE SECONDAIRE ────────────────────────────────────
 *
 * La distinction n'est pas devinée : elle est DÉCLARÉE dans
 * `src/design-system/tokens.css`, qui écrit en toutes lettres
 * « --color-ink : texte principal » et « --color-muted : texte secondaire ».
 * La sonde lit donc les JETONS RÉSOLUS sur `:root` dans la page — pas leurs
 * valeurs hexadécimales recopiées ici, qui dériveraient au premier réglage —
 * et classe chaque texte par la couleur qu'il porte vraiment.
 *
 *   SECONDAIRE : la couleur calculée égale `--color-muted`, `--color-muted-soft`,
 *                `--color-on-dark-muted`, `--color-on-dark-faint` ou
 *                `--color-neutral`.
 *   PRINCIPAL  : elle égale `--color-ink`, `--color-ink-2`, `--color-ink-3`
 *                ou `--color-on-dark`.
 *   NI L'UN NI L'AUTRE (encres d'accent, de statut, couleurs ad hoc) : on
 *                retombe sur la typographie — sous `--text-body` (14 px), ou
 *                opacité effective < 1, c'est du secondaire ; sinon du
 *                principal.
 *
 * POURQUOI LE JETON PLUTÔT QUE LA TAILLE SEULE. Parce que la taille se trompe
 * dans les deux sens dans ce dépôt : `--text-body` vaut 14 px et porte le corps
 * de TOUTE l'application (donc du principal à 14 px), tandis que
 * `--color-muted` s'emploie aussi à 16 px sur la vitrine (donc du secondaire à
 * 16 px). Trier par taille aurait rangé la moitié de l'application dans le
 * secondaire. Le jeton dit le RÔLE ; la taille ne dit que la taille. La
 * retombée typographique n'est là que pour ce que le jeton ne couvre pas, et
 * chaque texte relevé porte le motif de son classement (`classePar`), pour
 * qu'on puisse contester le tri sans relire ce commentaire.
 *
 * ─── ÉCHANTILLONNAGES, DÉCLARÉS ────────────────────────────────────────────
 *
 * Cibles, écarts, débordement, en-tête, barre publique : 23 × 11 largeurs × 2
 * langues, COMPLET, 506 états.
 *
 * Contraste : 2 largeurs (360, 1280) × 2 thèmes × 2 langues, 92 états. La
 * raison est celle qu'écrit déjà `mesure-ui.mjs` : entre 360 et 375 aucune
 * couleur ne change, mais à 1280 la barre basse, le panneau et les variantes
 * compactes ne sont pas rendus du tout — une largeur de poche, une de bureau.
 *
 * CLS : 2 largeurs (320, 1280) × 2 langues, 92 chargements. Le CLS ne se mesure
 * qu'AU CHARGEMENT — un redimensionnement ne le rejoue pas — donc onze largeurs
 * voudraient dire 506 chargements à froid. C'est l'axe le plus cher du lot et
 * c'est celui qui est échantillonné.
 *
 * Poids du premier chargement : 23 × 2 langues, un contexte NEUF par couple,
 * donc un cache vide et une traversée réelle des paquets paresseux.
 *
 * ─── PIÈGE TAILWIND v4 ─────────────────────────────────────────────────────
 *
 * Voir `scripts/mesure-ui.mjs` (commentaire de `CIBLES_EXEMPTES`) : la
 * détection automatique des sources balaie ce fichier, et une classe citée en
 * littéral serait RÉELLEMENT générée dans le CSS livré — c'est-à-dire que ce
 * relevé ferait grossir le paquet dont il mesure le poids. Aucun motif de
 * classe utilitaire n'est donc écrit d'un seul tenant ici : voir `parClasse()`,
 * qui les assemble par fragments.
 *
 * ─── USAGE ─────────────────────────────────────────────────────────────────
 *
 *   node scripts/inventaire/mesure-navigateur.mjs              → JSON sur stdout
 *   node scripts/inventaire/mesure-navigateur.mjs releve.json  → JSON dans le fichier
 *
 * Variables d'environnement, toutes réservées à la MISE AU POINT et toutes
 * marquant le relevé comme non recevable :
 *   MESURE_NAV_ROUTES=/,/demo   restreint le balayage (`partiel: true`, sortie ≠ 0)
 *   MESURE_NAV_CASSER=/tarifs   vide le rendu de cette adresse, pour vérifier
 *                               que le refus « page non rendue » rougit vraiment
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright'

import { RACINE, exigerUnInventairePlein, inventaireDesRoutes, nommerRoles } from './routes.mjs'

/**
 * Assemble un motif de classe utilitaire par FRAGMENTS.
 *
 * `parClasse('sr-', 'only')` vaut la même chaîne que le littéral, mais la
 * détection de sources de Tailwind v4 ne la reconnaît pas : elle balaie du
 * texte, elle ne concatène pas. Sans cela, ce fichier ferait exister dans le
 * CSS livré chaque classe qu'il cite — et ce relevé pèse justement le CSS livré.
 */
const parClasse = (...fragments) => fragments.join('')

/** `sr-only`, la classe des textes réservés aux lecteurs d'écran. */
const CLASSE_LECTEUR_D_ECRAN = parClasse('sr-', 'only')

/**
 * Le port : 4184, et non le 4183 de `mesure-ui.mjs`.
 *
 * Les deux relevés doivent pouvoir tourner en parallèle. Partager le port ferait
 * mesurer à l'un le paquet servi par l'autre, ou échouer le second sans dire
 * pourquoi — un silence de plus dans un lot qui existe pour les supprimer.
 */
const PORT = 4184
const BASE = `http://127.0.0.1:${PORT}`

/** Les onze largeurs de `mesure-ui.mjs`, recopiées à l'identique et pour la même raison. */
const LARGEURS = [320, 360, 375, 414, 700, 768, 800, 900, 1024, 1280, 1440]

/** Les deux langues, aucune n'étant « la large » partout — c'est un résultat du lot. */
const LANGUES = ['en-US', 'fr-FR']

const THEMES = ['light', 'dark']

/** Une largeur de poche, une de bureau : voir l'échantillonnage déclaré en tête. */
const LARGEURS_COULEUR = [360, 1280]

/** Le CLS ne se rejoue qu'au chargement : deux largeurs, la plus étroite et la bande pleine. */
const LARGEURS_CLS = [320, 1280]

/** La hauteur de fenêtre, constante : ce relevé ne mesure aucun axe vertical de fenêtre. */
const HAUTEUR = 900

/**
 * Le rayon de sondage autour du centre d'une cible.
 *
 * `mesure-ui.mjs` s'arrête à 22 parce qu'il ne pose qu'une question binaire
 * (44 px, oui ou non) et qu'un pixel de plus suffit à y répondre. Ce relevé,
 * lui, veut la VALEUR : 26 rend 53 px mesurables, ce qui laisse voir la marge
 * au-dessus du plancher au lieu de la tronquer à 45 partout.
 */
const RAYON_SONDAGE = 26

/**
 * Au-dessus de cette taille de boîte, on ne sonde pas.
 *
 * Une cible ne peut que GRANDIR en s'écartant du centre (argument de
 * `mesure-ui.mjs`) : une boîte de 52 px garantit une cible d'au moins 52 px, et
 * sonder pour le confirmer coûterait des centaines de milliers d'appels à
 * `elementFromPoint` sur les cibles déjà confortables. Ces cibles-là sont
 * relevées avec `sonde: false` — la valeur rendue est alors un MINORANT, ce que
 * le champ dit au lieu de le taire.
 */
const SEUIL_SONDAGE = 52

/** Le plancher WCAG, cité pour situer les valeurs. Aucun verdict n'en est tiré ici. */
const PLANCHER_CIBLE = 44

/**
 * L'écart de référence pour LIRE les valeurs, jamais pour trancher.
 *
 * 24 px est le diamètre du critère d'espacement de WCAG 2.5.8. Il n'apparaît
 * dans ce fichier que pour compter combien d'états passent en dessous — un
 * chiffre du rapport, pas une porte. C'est tout le sujet : cet axe est MESURÉ
 * et NON APPLIQUÉ.
 */
const ECART_DE_REFERENCE = 24

/**
 * La frontière typographique entre corps et retrait, pour la RETOMBÉE seule.
 *
 * 14 px, parce que `tokens.css` déclare `--text-body: 0.875rem`, annoté « 14 —
 * corps application » : c'est la taille du corps de l'application, donc la
 * plus petite qui soit encore du texte principal par convention du dépôt. En
 * dessous vivent `--text-body-s` (13), `--text-label` (12, « plancher
 * typographique ») et `--text-caps` (12) — des rôles de retrait.
 *
 * Elle ne sert QU'AUX couleurs qu'aucun jeton d'encre ne reconnaît : le jeton
 * dit le rôle, la taille ne dit que la taille, et trier par la taille seule
 * rangerait tout le corps de l'application dans le secondaire.
 */
const PLANCHER_CORPS = 14

/**
 * L'attente, recopiée de `mesure-ui.mjs` avec son argumentaire.
 *
 * On attend la disparition d'`aria-busy`, JAMAIS un délai fixe : un délai
 * mesure les squelettes de chargement. Les dépassements sont COMPTÉS et non
 * avalés — « la page est lente » et « la page est cassée » ne doivent pas
 * s'écrire pareil.
 *
 * Le `null` en deuxième argument de `waitForFunction` n'est pas décoratif :
 * c'est l'argument passé à la fonction. Sans lui, `{ timeout }` part à une
 * fonction qui n'attend rien et le délai par défaut de trente secondes
 * s'applique — six minutes sur toute page qui ne se stabilise pas.
 */
const lenteurs = new Map()

function marquerLenteur(ou, quoi) {
  const cle = `${ou} — ${quoi}`
  lenteurs.set(cle, (lenteurs.get(cle) ?? 0) + 1)
}

async function attendre(page, ou) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => marquerLenteur(ou, 'réseau'))
  await page
    .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, { timeout: 5000 })
    .catch(() => marquerLenteur(ou, 'chargement'))
  await page
    .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
    .catch(() => marquerLenteur(ou, 'polices'))
}

/* ══════════════════════════════════════════════════════════════════════════
   LES SONDES — exécutées DANS la page par `page.evaluate`.

   Elles sont écrites comme des expressions de fonction autonomes : rien de ce
   qu'elles ferment sur le module n'existe dans le navigateur, donc toute
   constante dont elles ont besoin leur est passée en argument.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LA SONDE DE GÉOMÉTRIE — un seul aller-retour pour cinq axes.
 *
 * Cinq mesures dans un seul `evaluate`, et c'est une décision de coût : 506
 * états × 5 allers-retours contre 506 × 1. Elles partagent d'ailleurs le même
 * travail — la liste des cibles visibles sert à la fois à la plus petite
 * cible et au plus petit écart.
 *
 * L'ORDRE INTERNE EST CONTRAINT, et pas par le goût :
 *   1. le débordement, qui déplace le défilement et le remet (technique de
 *      `MESURER` dans `mesure-ui.mjs` : `scrollTo(400, 0)`, jamais
 *      `scrollWidth`, qui compte la mise en page des descendants d'un
 *      conteneur à défilement et invente un débordement sur chaque tableau) ;
 *   2. l'en-tête et la barre publique, lus à défilement nul — l'en-tête
 *      collant change de fond dès le neuvième pixel ;
 *   3. les BOÎTES des cibles, toutes, à défilement nul : elles fixent le
 *      repère commun dans lequel les écarts se calculent ;
 *   4. le SONDAGE au point de contact, qui fait défiler la page et ne peut donc
 *      venir qu'après le repère ;
 *   5. la reconstruction des rectangles effectifs et les écarts, calculés hors
 *      DOM sur les valeurs des étapes 3 et 4.
 */
const SONDE_GEOMETRIE = (config) => {
  const { rayon, seuilSondage, classeLecteurEcran, ecartDeReference } = config

  /* ---- 1. DÉBORDEMENT ---------------------------------------------------
     Recopie de `MESURER` (mesure-ui.mjs). On TENTE de défiler ; si la fenêtre
     a bougé, la page déborde vraiment, et on ne retient comme coupables que
     les éléments dont aucun ancêtre ne défile — les vrais, pas leurs parents. */
  const avantX = window.scrollX
  window.scrollTo(400, 0)
  const decalage = window.scrollX
  window.scrollTo(avantX, 0)

  const largeurVue = document.documentElement.clientWidth
  const coupables = []
  if (decalage) {
    for (const el of document.querySelectorAll('*')) {
      const boite = el.getBoundingClientRect()
      if (boite.width === 0) continue
      if (boite.right <= largeurVue + 1) continue
      let ancetre = el.parentElement
      let contenu = false
      while (ancetre) {
        const dx = getComputedStyle(ancetre).overflowX
        if (dx === 'auto' || dx === 'scroll' || dx === 'hidden') {
          contenu = true
          break
        }
        ancetre = ancetre.parentElement
      }
      if (contenu) continue
      coupables.push({
        balise: el.tagName.toLowerCase(),
        classes: typeof el.className === 'string' ? el.className.slice(0, 90) : '',
        largeur: Math.round(boite.width),
        bordDroit: Math.round(boite.right),
        depassement: Math.round(boite.right - largeurVue),
        texte: (el.textContent || '').trim().slice(0, 44),
      })
    }
    coupables.sort((a, b) => b.depassement - a.depassement)
  }
  const debordement = {
    decalage,
    largeurVue,
    depassementMax: coupables.length > 0 ? coupables[0].depassement : 0,
    coupables: coupables.slice(0, 5),
  }

  /* ---- 2. EN-TÊTE ET BARRE PUBLIQUE -------------------------------------
     Repli lu par les BOÎTES et non par `flexWrap` (recopie de `MESURER_REPLI`) :
     la classe dit ce qui est PERMIS, pas ce qui ARRIVE. Un enfant dont le haut
     atteint le bas d'un autre commence une rangée nouvelle ; la tolérance d'un
     pixel écarte les arrondis d'un alignement centré. */
  const entetes = []
  for (const entete of document.querySelectorAll('header')) {
    const hauteur = Math.round(entete.getBoundingClientRect().height)
    let rangeesEmpilees = 0
    let rangeesSouples = 0
    for (const rangee of entete.querySelectorAll('*')) {
      const style = getComputedStyle(rangee)
      if (style.display !== 'flex' || style.flexWrap !== 'wrap') continue
      rangeesSouples++
      const boites = [...rangee.children]
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 0)
      if (boites.length < 2) continue
      if (boites.some((a) => boites.some((b) => a.top >= b.bottom - 1))) rangeesEmpilees++
    }
    entetes.push({ hauteur, rangeesSouples, rangeesEmpilees })
  }
  const entete =
    entetes.length === 0
      ? null
      : {
          nombre: entetes.length,
          hauteurMax: Math.max(...entetes.map((e) => e.hauteur)),
          replie: entetes.some((e) => e.rangeesEmpilees > 0),
          rangeesEmpilees: entetes.reduce((a, e) => a + e.rangeesEmpilees, 0),
        }

  /* La rangée SE DÉSIGNE, elle ne se devine pas : les rangées d'en-tête des
     écrans d'entrée épousent leur contenu et leur jeu vaut zéro par
     construction. D'où le marqueur, posé dans `PublicHeader.tsx`. (Recopie de
     `MESURER_JEU`.) `null` ici veut dire « pas d'en-tête public sur cet
     écran », pas « jeu nul » — le compteur global distingue les deux. */
  let barre = null
  const rangee = document.querySelector('[data-mesure="rangee-entete-vitrine"]')
  if (rangee) {
    const style = getComputedStyle(rangee)
    const boite = rangee.getBoundingClientRect()
    const dispo = boite.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
    const gouttiere = parseFloat(style.columnGap) || 0
    const enfants = [...rangee.children]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => Math.round(e.getBoundingClientRect().width))
      .filter((l) => l > 0)
    if (enfants.length > 0) {
      const occupe = enfants.reduce((a, l) => a + l, 0) + gouttiere * (enfants.length - 1)
      barre = { jeu: Math.round(dispo - occupe), dispo: Math.round(dispo), enfants: enfants.length }
    }
  }

  /* ---- 3. LES BOÎTES DES CIBLES, À DÉFILEMENT NUL -----------------------
     Le sélecteur ratisse ce qu'un doigt peut viser : commandes natives, rôles
     ARIA qui en tiennent lieu, et tout ce qui est tabulable. Il exclut ce qui
     n'est pas visé : masqué, hors flux, neutralisé, ou réservé aux lecteurs
     d'écran. (Recopie du sélecteur de `MESURER_CIBLES`.) */
  const SELECTEUR = [
    'a[href]',
    'button',
    'input:not([type=hidden])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="radio"]',
    '[role="checkbox"]',
    '[role="tab"]',
    '[role="switch"]',
    '[role="menuitem"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  const nommer = (el) => {
    const texte = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    if (texte) return texte
    const label = (el.getAttribute('aria-label') || '').trim().slice(0, 40)
    if (label) return label
    const titre = (el.getAttribute('title') || '').trim().slice(0, 40)
    if (titre) return titre
    return ''
  }

  /* Un sélecteur court et LISIBLE : de quoi remonter au composant source sans
     recopier 200 caractères de liste de classes dans le relevé. */
  const designer = (el) => {
    const balise = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ''
    const role = el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''
    const test = el.getAttribute('data-mesure') ? `[data-mesure=${el.getAttribute('data-mesure')}]` : ''
    const type = balise === 'input' ? `[type=${el.getAttribute('type') || 'text'}]` : ''
    let chemin = ''
    let p = el.parentElement
    let profondeur = 0
    while (p && profondeur < 3) {
      const marque = p.getAttribute && p.getAttribute('data-mesure')
      if (marque) {
        chemin = `[data-mesure=${marque}] `
        break
      }
      const t = p.tagName.toLowerCase()
      if (['nav', 'header', 'footer', 'aside', 'main', 'table', 'dialog', 'form'].includes(t)) {
        chemin = `${t} `
        break
      }
      p = p.parentElement
      profondeur++
    }
    return `${chemin}${balise}${id}${role}${test}${type}`
  }

  const cibles = []
  for (const el of document.querySelectorAll(SELECTEUR)) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (el.classList.contains(classeLecteurEcran)) continue
    if (el.closest('[inert]')) continue
    const boite = el.getBoundingClientRect()
    if (boite.width === 0 || boite.height === 0) continue
    cibles.push({
      el,
      gauche: boite.left,
      droite: boite.right,
      haut: boite.top,
      bas: boite.bottom,
      largeurBoite: Math.round(boite.width),
      hauteurBoite: Math.round(boite.height),
      raison: el.getAttribute('data-cible'),
      /* DÉSACTIVÉE : le sondage au point de contact rend 0 × 0 sur toute
         commande en `pointer-events: none` — `elementFromPoint` traverse et
         renvoie le parent. Ce n'est pas une cible minuscule, c'est une cible
         inexistante, et la confondre avec la première invente un défaut.

         MESURÉ, et c'est un angle mort partagé : `mesure-ui.mjs` porte la même
         cécité, masquée par un raccourci. Sa sonde saute tout élément dont la
         BOÎTE atteint déjà 44 px dans les deux sens, et les deux boutons
         désactivés du produit — « Continuer » de `/inscription` (320 × 48) et
         « Envoyer la demande » de `/demo/documents` (143 × 44) — passent
         justement ce raccourci d'un cheveu. Abaisser son seuil de sondage sans
         ajouter ce champ ferait rougir la porte sur deux boutons parfaitement
         corrects. */
      desactive:
        el.disabled === true ||
        el.getAttribute('aria-disabled') === 'true' ||
        style.pointerEvents === 'none',
    })
  }

  /* ---- 4. LE SONDAGE AU POINT DE CONTACT --------------------------------
     `elementFromPoint`, et rien d'autre : une boîte se calcule, une cible se
     touche. Les deux pièges de `mesure-ui.mjs` sont honorés — `scrollIntoView`
     d'abord, parce que la fonction ne répond que dans le cadre visible et rend
     `null` ailleurs ; et `el.contains(touche)`, parce que le point touché est
     presque toujours un DESCENDANT (l'icône dans le bouton).

     CE QU'ON GARDE EN PLUS de `mesure-ui.mjs` : les quatre demi-extensions.
     Elles servent à reconstruire le RECTANGLE EFFECTIF de la cible, c'est-à-dire
     ce sur quoi les écarts se calculent. Sans elles, un `::after` étendu ferait
     croire à un écart qui n'existe pas. */
  let sondees = 0
  for (const c of cibles) {
    const petite = c.largeurBoite < seuilSondage || c.hauteurBoite < seuilSondage
    if (!petite) {
      c.sonde = false
      c.largeurUtile = c.largeurBoite
      c.hauteurUtile = c.hauteurBoite
      c.ext = { gauche: c.largeurBoite / 2, droite: c.largeurBoite / 2, haut: c.hauteurBoite / 2, bas: c.hauteurBoite / 2 }
      continue
    }
    sondees++
    c.el.scrollIntoView({ block: 'center', inline: 'center' })
    const vue = c.el.getBoundingClientRect()
    const cx = Math.round(vue.left + vue.width / 2)
    const cy = Math.round(vue.top + vue.height / 2)
    const touche = (x, y) => {
      const cible = document.elementFromPoint(x, y)
      return !!cible && (cible === c.el || c.el.contains(cible))
    }
    let g = 0
    let d = 0
    let h = 0
    let b = 0
    let atteinte = false
    if (touche(cx, cy)) {
      atteinte = true
      while (g < rayon && touche(cx - g - 1, cy)) g++
      while (d < rayon && touche(cx + d + 1, cy)) d++
      while (h < rayon && touche(cx, cy - h - 1)) h++
      while (b < rayon && touche(cx, cy + b + 1)) b++
    }
    c.sonde = true
    c.atteinte = atteinte
    c.largeurUtile = atteinte ? g + d + 1 : 0
    c.hauteurUtile = atteinte ? h + b + 1 : 0
    /* L'extension est comptée depuis le CENTRE DE LA BOÎTE mesurée à
       défilement nul : le sondage a déplacé la page, pas la cible dans sa
       rangée. On la borne par la demi-boîte, pour qu'une cible recouverte
       (extension nulle) ne rétrécisse pas artificiellement son rectangle et
       n'invente pas un écart plus grand qu'il n'est. */
    c.ext = {
      gauche: Math.max(g, c.largeurBoite / 2),
      droite: Math.max(d, c.largeurBoite / 2),
      haut: Math.max(h, c.hauteurBoite / 2),
      bas: Math.max(b, c.hauteurBoite / 2),
    }
  }

  // Le défilement a bougé : le rendre, sinon la mesure suivante hérite d'une
  // page à mi-hauteur. (Même précaution que `MESURER_CIBLES`.)
  window.scrollTo(0, 0)

  /* ---- 5. RECTANGLES EFFECTIFS, PLUS PETITE CIBLE, PLUS PETIT ÉCART ----- */
  for (const c of cibles) {
    const cx = (c.gauche + c.droite) / 2
    const cy = (c.haut + c.bas) / 2
    c.rect = {
      gauche: Math.min(c.gauche, cx - c.ext.gauche),
      droite: Math.max(c.droite, cx + c.ext.droite),
      haut: Math.min(c.haut, cy - c.ext.haut),
      bas: Math.max(c.bas, cy + c.ext.bas),
    }
  }

  /* DEUX MINIMA, ET C'EST NÉCESSAIRE. La plus petite cible d'un écran est
     presque toujours une colonne de graphe, qui porte `data-cible="donnee"` :
     sa largeur est celle que la donnée et la fenêtre lui laissent, elle
     n'agit pas, et WCAG 2.5.8 l'exempte au titre d'« essentiel ». La rendre
     seule masquerait la plus petite cible AGISSANTE, qui est le vrai sujet.
     On rend donc les deux, et le lecteur choisit laquelle il lit. */
  const fiche = (c) => ({
    cote: Math.min(c.largeurUtile, c.hauteurUtile),
    surface: c.largeurUtile * c.hauteurUtile,
    largeur: c.largeurUtile,
    hauteur: c.hauteurUtile,
    boite: `${c.largeurBoite}x${c.hauteurBoite}`,
    sonde: c.sonde,
    atteinte: c.sonde ? c.atteinte : true,
    texte: nommer(c.el),
    role: c.el.getAttribute('role') || c.el.tagName.toLowerCase(),
    selecteur: designer(c.el),
    raison: c.raison,
    desactive: c.desactive,
    classes: typeof c.el.className === 'string' ? c.el.className.slice(0, 80) : '',
  })
  const plusPetitQue = (a, b) => b === null || a.cote < b.cote || (a.cote === b.cote && a.surface < b.surface)

  let plusPetite = null
  let plusPetiteAgissante = null
  let plusPetiteActionnable = null
  let exemptees = 0
  let desactivees = 0
  for (const c of cibles) {
    const f = fiche(c)
    if (plusPetitQue(f, plusPetite)) plusPetite = f
    if (c.raison) {
      exemptees++
      continue
    }
    if (plusPetitQue(f, plusPetiteAgissante)) plusPetiteAgissante = f
    if (c.desactive) {
      desactivees++
      continue
    }
    if (plusPetitQue(f, plusPetiteActionnable)) plusPetiteActionnable = f
  }

  const chevauche = (a1, a2, b1, b2) => a1 < b2 && b1 < a2

  let plusPetitEcart = null
  let recouvrements = 0
  let pairesExaminees = 0
  const sousReference = new Set()
  /* L'ORDRE DES TESTS EST UNE DÉCISION DE COÛT. `Node.contains` est un appel
     DOM ; l'écarter en premier coûterait n²/2 appels par état, soit une dizaine
     de millions sur le balayage. Les recouvrements se testent en arithmétique
     pure ; l'imbrication n'est vérifiée que sur les paires qui allaient
     compter, c'est-à-dire une poignée. */
  for (let i = 0; i < cibles.length; i++) {
    const A = cibles[i]
    for (let j = i + 1; j < cibles.length; j++) {
      const B = cibles[j]
      const recouvreX = chevauche(A.rect.gauche, A.rect.droite, B.rect.gauche, B.rect.droite)
      const recouvreY = chevauche(A.rect.haut, A.rect.bas, B.rect.haut, B.rect.bas)
      if (!recouvreX && !recouvreY) continue // Voisines en diagonale : hors critère, dit en tête.

      // Une cible et sa doublure ne sont pas deux voisines : le critère est le
      // DOM, pas la géométrie.
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue
      pairesExaminees++

      if (recouvreX && recouvreY) {
        recouvrements++
        continue
      }

      let ecart
      let axe
      if (recouvreY) {
        ecart = Math.max(B.rect.gauche - A.rect.droite, A.rect.gauche - B.rect.droite)
        axe = 'horizontal'
      } else {
        ecart = Math.max(B.rect.haut - A.rect.bas, A.rect.haut - B.rect.bas)
        axe = 'vertical'
      }
      if (ecart < 0) continue

      if (ecart < ecartDeReference) {
        sousReference.add(i)
        sousReference.add(j)
      }
      if (plusPetitEcart === null || ecart < plusPetitEcart.ecart) {
        plusPetitEcart = {
          ecart: Math.round(ecart * 10) / 10,
          axe,
          a: { texte: nommer(A.el), selecteur: designer(A.el), taille: `${A.largeurUtile}x${A.hauteurUtile}` },
          b: { texte: nommer(B.el), selecteur: designer(B.el), taille: `${B.largeurUtile}x${B.hauteurUtile}` },
        }
      }
    }
  }

  return {
    debordement,
    entete,
    barre,
    cibles: {
      total: cibles.length,
      sondees,
      exemptees,
      desactivees,
      plusPetite,
      plusPetiteAgissante,
      plusPetiteActionnable,
    },
    ecart: {
      plusPetit: plusPetitEcart,
      pairesExaminees,
      recouvrements,
      ciblesSousReference: sousReference.size,
    },
  }
}

/**
 * LA SONDE DE COULEUR — le contraste le plus bas, principal et secondaire.
 *
 * La mathématique est celle de `scripts/contrast-audit.js`, recopiée parce que
 * ce fichier est une IIFE de console qui ne rend QUE les fautes et ne peut donc
 * pas répondre à « quel est le plus bas ». Trois pièges y sont hérités tels
 * quels, chacun payé une fois là-bas :
 *   - Tailwind v4 émet de l'`oklab()` dès qu'une couleur porte un alpha, et le
 *     canvas ne le décode pas : il retombe SILENCIEUSEMENT sur la valeur
 *     précédente, ce qui faisait passer un fond crème pour du noir. D'où la
 *     conversion explicite, et la sentinelle `#010203` pour le reste.
 *   - Un fond semi-transparent doit être COMPOSITÉ sur ce qu'il recouvre.
 *   - Seuls les éléments portant DIRECTEMENT du texte sont comptés, sinon
 *     chaque ancêtre l'est en double.
 *
 * La dérive entre cette copie et l'original est surveillée : le relevé exécute
 * les deux sur un état témoin et compare leurs comptes de fautes.
 */
const SONDE_COULEUR = (config) => {
  const { classeLecteurEcran, plancherCorps } = config
  const ctx = document.createElement('canvas').getContext('2d')

  const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)))
  const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
  function oklabToRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b
    const s_ = L - 0.0894841775 * a - 1.291485548 * b
    const l = l_ * l_ * l_
    const m = m_ * m_ * m_
    const s = s_ * s_ * s_
    return [
      clamp255(gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
      clamp255(gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
      clamp255(gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    ]
  }
  function toRgba(input) {
    if (!input || input === 'transparent') return [0, 0, 0, 0]
    const oklab = input.match(/^oklab\(([^)]+)\)$/)
    if (oklab) {
      const parts = oklab[1].split('/')
      const [L, a, b] = parts[0].trim().split(/\s+/).map(parseFloat)
      const alphaRaw = parts[1] ? parts[1].trim() : '1'
      const alpha = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw)
      return [...oklabToRgb(L, a, b), alpha]
    }
    ctx.fillStyle = '#010203'
    ctx.fillStyle = input
    const norm = ctx.fillStyle
    if (norm === '#010203' && input !== '#010203') return [0, 0, 0, 0]
    if (norm.startsWith('#')) {
      const h = norm.slice(1)
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
    }
    const n = norm.match(/[\d.]+/g).map(Number)
    return [n[0], n[1], n[2], n[3] ?? 1]
  }
  const over = (src, dst) => {
    const a = src[3]
    return [src[0] * a + dst[0] * (1 - a), src[1] * a + dst[1] * (1 - a), src[2] * a + dst[2] * (1 - a), 1]
  }
  function fondEffectif(el) {
    const pile = []
    let node = el
    while (node && node !== document.documentElement) {
      const rgba = toRgba(getComputedStyle(node).backgroundColor)
      if (rgba[3] > 0) {
        pile.push(rgba)
        if (rgba[3] === 1) break
      }
      node = node.parentElement
    }
    let base = [255, 255, 255, 1]
    for (let i = pile.length - 1; i >= 0; i--) base = over(pile[i], base)
    return base
  }
  const lineaire = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const luminance = ([r, g, b]) => 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b)
  const contraste = (a, b) => {
    const la = luminance(a)
    const lb = luminance(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  /* LES JETONS SONT LUS DANS LA PAGE, jamais recopiés : `tokens.css` déclare
     lui-même lequel porte le « texte principal » et lequel le « texte
     secondaire », et ses valeurs changent avec le thème. Une copie
     hexadécimale ici se périmerait au premier réglage, en silence. */
  const racine = getComputedStyle(document.documentElement)
  const cle = (rgba) => `${Math.round(rgba[0])},${Math.round(rgba[1])},${Math.round(rgba[2])},${rgba[3].toFixed(3)}`
  const registre = new Map()
  const inscrire = (nom, role) => {
    const brut = racine.getPropertyValue(nom).trim()
    if (!brut) return
    const rgba = toRgba(brut)
    if (rgba[3] === 0) return
    registre.set(cle(rgba), { jeton: nom, role })
  }
  for (const n of ['--color-ink', '--color-ink-2', '--color-ink-3', '--color-on-dark']) inscrire(n, 'principal')
  for (const n of [
    '--color-muted',
    '--color-muted-soft',
    '--color-on-dark-muted',
    '--color-on-dark-faint',
    '--color-neutral',
  ]) {
    inscrire(n, 'secondaire')
  }
  /* LES ENCRES D'ACCENT ET DE STATUT NE TRANCHENT PAS LE RÔLE, elles le
     NOMMENT. `tokens.css` ne les annote ni « principal » ni « secondaire » —
     un lien or est du texte de premier plan sur une carte et une mention en
     retrait dans un pied — donc leur rôle se décide à la typographie, comme
     pour toute couleur inconnue. Les inscrire quand même sert à une chose :
     que `classePar` dise « --color-gold-ink, 18px » plutôt que « couleur
     inconnue », et qu'on puisse contester le tri sans relire le CSS. */
  for (const n of [
    '--color-gold',
    '--color-gold-ink',
    '--color-gold-on-dark',
    '--color-gold-on-ink',
    '--color-ok',
    '--color-warn',
    '--color-danger',
    '--color-danger-strong',
    '--color-on-danger',
  ]) {
    if (!registre.has(cle(toRgba(racine.getPropertyValue(n).trim() || 'transparent')))) inscrire(n, 'accent')
  }
  const jetonsLus = registre.size

  let examines = 0
  const parRole = {
    principal: { min: null, sousSeuil: 0 },
    secondaire: { min: null, sousSeuil: 0 },
  }
  const fautes = []

  document.querySelectorAll('*').forEach((el) => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return
    const propre = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()
    if (propre.length < 2) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.opacity === '0') return
    if (el.classList.contains(classeLecteurEcran)) return

    const encre = toRgba(cs.color)
    const fond = fondEffectif(el)
    const premier = over(encre, fond)
    const ratio = contraste(premier, fond)
    examines++

    const taille = parseFloat(cs.fontSize)
    const graisse = parseInt(cs.fontWeight, 10) || 400
    const grand = taille >= 24 || (taille >= 18.66 && graisse >= 700)
    const requis = grand ? 3 : 4.5

    /* Opacité EFFECTIVE : `opacity` se multiplie le long des ancêtres, et
       c'est cette chaîne-là qui décide si un texte est en retrait. La lire sur
       le seul élément raterait un bloc entier posé à 0.7. */
    let opacite = 1
    let n = el
    while (n && n !== document.documentElement) {
      opacite *= parseFloat(getComputedStyle(n).opacity)
      n = n.parentElement
    }

    const connu = registre.get(cle(encre))
    let role
    let classePar
    if (connu && connu.role !== 'accent') {
      role = connu.role
      classePar = `jeton ${connu.jeton}`
    } else {
      const nomme = connu ? `${connu.jeton} (accent) ` : 'couleur hors jetons d’encre '
      if (taille < plancherCorps) {
        role = 'secondaire'
        classePar = `${nomme}+ taille ${taille}px < ${plancherCorps}`
      } else if (opacite < 0.999) {
        role = 'secondaire'
        classePar = `${nomme}+ opacité ${opacite.toFixed(2)}`
      } else {
        role = 'principal'
        classePar = `${nomme}+ ${taille}px pleine opacité`
      }
    }

    const bloc = parRole[role]
    if (ratio < requis) bloc.sousSeuil++
    if (bloc.min === null || ratio < bloc.min.ratio) {
      bloc.min = {
        ratio: Math.round(ratio * 100) / 100,
        requis,
        texte: propre.slice(0, 45),
        taille,
        graisse,
        opacite: Math.round(opacite * 100) / 100,
        encre: cs.color,
        fond: `rgb(${fond.slice(0, 3).map((v) => Math.round(v)).join(', ')})`,
        classePar,
        balise: el.tagName.toLowerCase(),
      }
    }
    if (ratio < requis) {
      fautes.push({ texte: propre.slice(0, 45), ratio: Math.round(ratio * 100) / 100, requis, role, classePar })
    }
  })

  return { examines, jetonsLus, principal: parRole.principal, secondaire: parRole.secondaire, fautes }
}

/** Exécutée DANS la page : de quoi dire si elle a RENDU quelque chose. */
const SONDE_RENDU = () => ({
  texte: (document.body.innerText || '').trim().length,
  elements: document.querySelectorAll('body *').length,
  titre: document.title,
  racineVide: !document.getElementById('root') || document.getElementById('root').children.length === 0,
})

/** Exécutée DANS la page : ce que le réseau a livré pour arriver ici. */
const SONDE_RESEAU = () => {
  const nav = performance.getEntriesByType('navigation')[0]
  return {
    document: nav ? { nom: location.pathname, transfert: nav.transferSize, encode: nav.encodedBodySize } : null,
    ressources: performance.getEntriesByType('resource').map((r) => ({
      nom: r.name,
      type: r.initiatorType,
      transfert: r.transferSize,
      encode: r.encodedBodySize,
    })),
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   LE SERVEUR ET LE PAQUET
   ══════════════════════════════════════════════════════════════════════════ */

/** Sert `dist/`, et rend de quoi l'arrêter quoi qu'il arrive ensuite. (Recopie de `servir`.) */
async function servir() {
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let essai = 0; essai < 60; essai++) {
    try {
      const reponse = await fetch(BASE + '/')
      if (reponse.ok) return fils
    } catch {
      /* Le serveur n'écoute pas encore. */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error(`mesure-navigateur : le serveur de prévisualisation n'a pas répondu sur ${BASE}`)
}

/**
 * LES ACTIFS IMPATIENTS SE LISENT DANS `dist/index.html`, jamais recopiés.
 *
 * Argument de `mesurerPremierChargement` (mesure-ui.mjs) : un nom de fichier
 * construit porte un hachage de contenu qui change à chaque build. `index.html`
 * liste exactement ce qu'un navigateur télécharge SANS ATTENDRE ; tout ce qu'un
 * relevé de route voit EN PLUS est, par construction, un paquet PARESSEUX
 * traversé pour atteindre cette adresse — ce que ce lot veut compter.
 */
function actifsImpatients() {
  const html = readFileSync(join(RACINE, 'dist/index.html'), 'utf8')
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])
  const feuilles = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1])
  return new Set([...scripts, ...styles, ...feuilles].filter((h) => h.startsWith('/')))
}

/**
 * Le poids réel, gzippé.
 *
 * `vite preview` ne négocie pas la compression : `transferSize` rend donc des
 * octets NUS, deux à quatre fois le poids qu'un serveur de production livrerait.
 * Les deux nombres sont rendus — `octetsNus` pour ce que le navigateur a
 * vraiment reçu ici, `octetsGzip` pour ce que le marché visé paierait. C'est ce
 * second que `mesure-ui.mjs` budgète, et c'est donc lui qui se compare.
 */
function gzipDuChemin(chemin) {
  const fichier = join(RACINE, 'dist', chemin.replace(/^\//, ''))
  if (!existsSync(fichier)) return null
  return gzipSync(readFileSync(fichier)).length
}

/* ══════════════════════════════════════════════════════════════════════════
   LE RELEVÉ
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * @returns {Promise<object>} la structure complète, refus compris.
 *
 * NE JETTE PAS sur un défaut de page : elle le CONSIGNE. Un relevé amputé
 * d'une ligne est exactement ce que ce lot interdit — c'est à l'appelant, et à
 * `main` plus bas, de refuser bruyamment sur `refus` non vide, avec le relevé
 * complet écrit à côté.
 */
export async function releverAuNavigateur(options = {}) {
  const routes = exigerUnInventairePlein(inventaireDesRoutes())

  const filtre = options.routes ?? (process.env.MESURE_NAV_ROUTES || '').split(',').filter(Boolean)
  const casser = options.casser ?? process.env.MESURE_NAV_CASSER ?? ''
  const partiel = filtre.length > 0
  const balayees = partiel ? routes.filter((r) => filtre.includes(r.adresse)) : routes
  if (balayees.length === 0) {
    throw new Error(
      `mesure-navigateur : le filtre MESURE_NAV_ROUTES=« ${filtre.join(',')} » ne retient AUCUNE route. ` +
        'Un balayage vide ne dit pas « aucun défaut », il ne dit rien.',
    )
  }

  const journal = options.journal ?? ((m) => process.stderr.write(m))
  const impatients = actifsImpatients()
  if (impatients.size === 0) {
    throw new Error(
      "mesure-navigateur : aucun actif impatient lu dans `dist/index.html`. Le paquet n'est pas construit, " +
        'ou le motif de lecture est cassé — dans les deux cas, le poids par route ne veut plus rien dire.',
    )
  }
  const AUDIT_ORIGINAL = readFileSync(join(RACINE, 'scripts/contrast-audit.js'), 'utf8')

  const releve = {
    genere: new Date().toISOString(),
    partiel,
    routes: balayees.map((r) => ({
      adresse: r.adresse,
      roles: nommerRoles(r.roles),
      origine: r.origine,
      vitrine: r.vitrine,
    })),
    echantillonnage: {
      geometrie: `COMPLET — ${balayees.length} routes × ${LARGEURS.length} largeurs × ${LANGUES.length} langues`,
      couleur: `ÉCHANTILLONNÉ — ${LARGEURS_COULEUR.join('/')} px × ${THEMES.length} thèmes × ${LANGUES.length} langues`,
      cls: `ÉCHANTILLONNÉ — ${LARGEURS_CLS.join('/')} px × ${LANGUES.length} langues, un rechargement par point`,
      chargement: `COMPLET — ${balayees.length} routes × ${LANGUES.length} langues, contexte neuf à chaque fois`,
    },
    seuilsCites: { plancherCible: PLANCHER_CIBLE, ecartDeReference: ECART_DE_REFERENCE },
    geometrie: [],
    couleur: [],
    chargement: [],
    cls: [],
    erreursDePage: [],
    refus: [],
    lenteurs: {},
    totaux: {},
  }

  const compteurs = {
    ciblesVues: 0,
    ciblesSondees: 0,
    pairesExaminees: 0,
    textesAudites: 0,
    actifsLus: 0,
    etatsGeometrie: 0,
    etatsCouleur: 0,
    barresMesurees: 0,
    clsObserves: 0,
  }

  const serveur = await servir()
  let navigateur
  try {
    navigateur = await chromium.launch()

    /* ---- PASSE 1 : géométrie, chargement à froid, CLS -------------------
       UN CONTEXTE NEUF PAR (route, langue), et c'est le prix du poids à froid :
       un contexte réutilisé a le cache chaud dès la deuxième route, et toutes
       les routes suivantes déclareraient un premier chargement de zéro octet.
       On redimensionne ensuite au lieu de recharger — argument de
       `mesure-ui.mjs` : onze chargements par écran contre un. */
    for (const langue of LANGUES) {
      for (const route of balayees) {
        const adresse = route.adresse
        const depart = Date.now()
        journal(`   ${langue}  ${adresse} … `)

        const contexte = await navigateur.newContext({
          viewport: { width: LARGEURS_CLS[0], height: HAUTEUR },
          locale: langue,
        })
        /* Le CLS ne se lit qu'AVANT le premier rendu : posé après, l'observateur
           manque les décalages qu'il devait compter. `buffered: true` rattrape
           ceux d'avant l'abonnement. Le drapeau `__clsPose` distingue « aucun
           décalage » de « aucun observateur » — le silence que ce lot traque. */
        await contexte.addInitScript(() => {
          window.__cls = 0
          window.__clsEntrees = 0
          window.__clsPose = false
          try {
            new PerformanceObserver((liste) => {
              for (const e of liste.getEntries()) {
                if (!e.hadRecentInput) {
                  window.__cls += e.value
                  window.__clsEntrees++
                }
              }
            }).observe({ type: 'layout-shift', buffered: true })
            window.__clsPose = true
          } catch {
            window.__clsPose = false
          }
        })

        const page = await contexte.newPage()
        const erreursPage = []
        page.on('pageerror', (e) => erreursPage.push(String(e.message).slice(0, 200)))

        /* LE REFUS DOIT ÊTRE TESTABLE, sinon il n'est qu'une intention.
           `MESURE_NAV_CASSER=<adresse>` coupe le JavaScript de cette adresse :
           le HTML arrive, la racine reste vide, rien ne rend. C'est la panne
           exacte que la garde du garde plus bas doit crier, et la seule façon
           de vérifier qu'elle la crie sans casser une source du produit.
           Une première version vidait `#root` après coup ; React le
           reconstruisait au rendu suivant et le refus restait muet — ce qui
           est précisément pourquoi un refus non testé ne vaut rien. */
        if (casser && casser === adresse) {
          await page.route('**/*.js', (r) => r.abort())
        }

        const reponse = await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
        await attendre(page, adresse)

        /* --- LE RENDU, AVANT TOUTE MESURE ---------------------------------
           Mesurer une page blanche rendrait « aucun défaut » avec l'aplomb d'un
           balayage complet : c'est LA panne que ce lot existe pour interdire.
           Quatre symptômes valent refus, et ils sont disjoints — un statut
           d'erreur, une racine React vide, un arbre squelettique, un écran sans
           texte. Chacun couvre une façon différente de ne pas rendre.

           CE QUI NE VAUT PAS REFUS, et le distinguer est essentiel : une
           EXCEPTION NON RATTRAPÉE sur une page qui rend quand même. Elle est
           consignée à part (`erreursDePage`), avec le nombre d'écrans touchés,
           parce qu'ici elle est ATTENDUE : `vite preview` ne monte pas le proxy
           `/api` de `vite.config.ts` — il n'existe que sous `server:` — donc
           toute sonde de session part dans le vide sur chacun des 23 écrans.
           En faire un refus déclarerait les 23 pages non rendues alors qu'elles
           affichent 500 éléments chacune ; la taire laisserait passer le jour
           où une VRAIE exception casse un écran. On la compte. */
        const rendu = await page.evaluate(SONDE_RENDU)
        const statut = reponse ? reponse.status() : 0
        if (statut >= 400 || rendu.racineVide || rendu.elements < 3 || rendu.texte < 40) {
          releve.refus.push({
            genre: 'page-non-rendue',
            adresse,
            langue,
            statut,
            texte: rendu.texte,
            elements: rendu.elements,
            racineVide: rendu.racineVide,
            erreurs: erreursPage,
          })
        }
        if (erreursPage.length > 0) {
          releve.erreursDePage.push({ adresse, langue, erreurs: [...new Set(erreursPage)] })
        }

        // --- Le réseau : ce qu'il a fallu télécharger pour arriver ici.
        const reseau = await page.evaluate(SONDE_RESEAU)
        const actifs = []
        let octetsNus = reseau.document ? reseau.document.transfert || 0 : 0
        let octetsGzip = 0
        /* TROIS FAMILLES, ET LES CONFONDRE FAUSSERAIT LE COMPTE. Un paquet
           PARESSEUX est un fichier construit que `dist/index.html` ne cite
           pas : c'est ce que la route a fait traverser en plus, et c'est le
           sujet. Un APPEL D'API n'est pas un paquet — il ne pèse rien et
           n'existe qu'à cause de la sonde de session. Un actif EXTERNE (la
           police) n'est pas construit par ce dépôt et son `transferSize` est
           d'ailleurs masqué faute de `Timing-Allow-Origin`. */
        const paresseux = []
        const appelsApi = []
        let externes = 0
        for (const r of reseau.ressources) {
          const url = new URL(r.nom)
          const local = url.origin === BASE
          if (!local) {
            externes++
            actifs.push({ nom: r.nom.slice(0, 90), famille: 'externe', transfert: r.transfert || null })
            continue
          }
          octetsNus += r.transfert || 0
          const g = gzipDuChemin(url.pathname)
          const impatient = impatients.has(url.pathname)
          let famille
          if (g === null) {
            famille = 'api'
            appelsApi.push(url.pathname)
          } else {
            octetsGzip += g
            famille = impatient ? 'impatient' : 'paresseux'
            if (!impatient) paresseux.push(url.pathname)
          }
          actifs.push({ nom: url.pathname, famille, transfert: r.transfert || 0, gzip: g })
        }
        compteurs.actifsLus += actifs.length
        releve.chargement.push({
          adresse,
          langue,
          requetes: 1 + reseau.ressources.length,
          koNus: Math.round((octetsNus / 1024) * 10) / 10,
          koGzip: Math.round((octetsGzip / 1024) * 10) / 10,
          externes,
          paquetsParesseux: paresseux,
          appelsApi,
          actifs,
        })

        // --- CLS à la première largeur, lu tel que l'observateur l'a accumulé.
        const cls0 = await page.evaluate(() => ({
          valeur: window.__cls,
          entrees: window.__clsEntrees,
          pose: window.__clsPose,
        }))
        if (cls0.pose) compteurs.clsObserves++
        releve.cls.push({
          adresse,
          langue,
          largeur: LARGEURS_CLS[0],
          cls: Math.round(cls0.valeur * 10000) / 10000,
          entrees: cls0.entrees,
          observe: cls0.pose,
        })

        // --- Les onze largeurs, par redimensionnement.
        for (const largeur of LARGEURS) {
          await page.setViewportSize({ width: largeur, height: HAUTEUR })
          await attendre(page, adresse)
          const g = await page.evaluate(SONDE_GEOMETRIE, {
            rayon: RAYON_SONDAGE,
            seuilSondage: SEUIL_SONDAGE,
            classeLecteurEcran: CLASSE_LECTEUR_D_ECRAN,
            ecartDeReference: ECART_DE_REFERENCE,
          })
          compteurs.etatsGeometrie++
          compteurs.ciblesVues += g.cibles.total
          compteurs.ciblesSondees += g.cibles.sondees
          compteurs.pairesExaminees += g.ecart.pairesExaminees
          if (g.barre) compteurs.barresMesurees++
          releve.geometrie.push({ adresse, langue, largeur, ...g })
        }

        // --- CLS à la seconde largeur : un CHARGEMENT, pas un redimensionnement.
        //     Le script d'initialisation remet le compteur à zéro de lui-même.
        await page.setViewportSize({ width: LARGEURS_CLS[1], height: HAUTEUR })
        await page.reload({ waitUntil: 'domcontentloaded' })
        await attendre(page, adresse)
        const cls1 = await page.evaluate(() => ({
          valeur: window.__cls,
          entrees: window.__clsEntrees,
          pose: window.__clsPose,
        }))
        if (cls1.pose) compteurs.clsObserves++
        releve.cls.push({
          adresse,
          langue,
          largeur: LARGEURS_CLS[1],
          cls: Math.round(cls1.valeur * 10000) / 10000,
          entrees: cls1.entrees,
          observe: cls1.pose,
        })

        await contexte.close()
        journal(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
      }
    }

    /* ---- PASSE 2 : couleur -----------------------------------------------
       PASSE SÉPARÉE, argument de `mesure-ui.mjs` : les deux passes n'ont pas
       les mêmes axes — onze largeurs sans thème d'un côté, deux thèmes et deux
       largeurs de l'autre — et les fondre donnerait le produit des deux pour
       redire partout ce qui ne varie que quelque part. Ce qui coûte cher (un
       build, un serveur, un navigateur) est déjà mutualisé. */
    let temoinFait = false
    for (const langue of LANGUES) {
      for (const theme of THEMES) {
        const contexte = await navigateur.newContext({
          viewport: { width: LARGEURS_COULEUR[0], height: HAUTEUR },
          locale: langue,
          colorScheme: theme,
        })
        const page = await contexte.newPage()
        for (const route of balayees) {
          const adresse = route.adresse
          const depart = Date.now()
          journal(`   ${langue}  ${theme}  ${adresse} … `)
          for (const largeur of LARGEURS_COULEUR) {
            await page.setViewportSize({ width: largeur, height: HAUTEUR })
            if (largeur === LARGEURS_COULEUR[0]) {
              await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
            }
            await attendre(page, adresse)

            const c = await page.evaluate(SONDE_COULEUR, {
              classeLecteurEcran: CLASSE_LECTEUR_D_ECRAN,
              plancherCorps: PLANCHER_CORPS,
            })
            compteurs.etatsCouleur++
            compteurs.textesAudites += c.examines

            /* LA GARDE ANTI-DÉRIVE, une fois : la copie et l'original doivent
               compter les mêmes fautes. Une copie qui dérive en silence est
               exactement ce que `contrast-audit.js` écrit avoir déjà payé. */
            if (!temoinFait) {
              temoinFait = true
              const original = await page.evaluate(AUDIT_ORIGINAL)
              if (!original || typeof original.examines !== 'number') {
                releve.refus.push({
                  genre: 'audit-original-muet',
                  detail:
                    "`contrast-audit.js` n'a pas rendu `{ failures, items, examines }` — son expression doit " +
                    "rester une IIFE qui s'évalue en cet objet.",
                })
              } else {
                releve.temoinCouleur = {
                  ou: `${adresse} ${largeur}px ${langue} ${theme}`,
                  originalExamines: original.examines,
                  copieExamines: c.examines,
                  originalFautes: original.failures,
                  copieFautes: c.fautes.length,
                }
                if (Math.abs(original.examines - c.examines) > 2 || original.failures !== c.fautes.length) {
                  releve.refus.push({
                    genre: 'derive-copie-contraste',
                    detail:
                      `L'original voit ${original.examines} textes / ${original.failures} fautes, ` +
                      `la copie ${c.examines} / ${c.fautes.length}. La copie a dérivé de son original.`,
                  })
                }
              }
            }

            releve.couleur.push({
              adresse,
              langue,
              theme,
              largeur,
              examines: c.examines,
              jetonsLus: c.jetonsLus,
              principal: c.principal,
              secondaire: c.secondaire,
              fautes: c.fautes.length,
            })
          }
          journal(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
        }
        await contexte.close()
      }
    }
  } finally {
    if (navigateur) await navigateur.close().catch(() => {})
    serveur.kill()
  }

  releve.lenteurs = Object.fromEntries([...lenteurs].sort((a, b) => b[1] - a[1]))
  releve.totaux = { ...compteurs }

  /* ══ LA GARDE DU GARDE ═══════════════════════════════════════════════════
     « Rien trouvé » et « rien regardé » s'écrivent pareil dans un journal.
     Chacune de ces conditions distingue les deux, et chacune fait refuser. */
  if (compteurs.etatsGeometrie === 0) {
    releve.refus.push({ genre: 'aucun-etat', detail: 'Zéro état de géométrie mesuré.' })
  }
  if (compteurs.ciblesSondees === 0) {
    releve.refus.push({
      genre: 'zero-cible-sondee',
      detail:
        `${compteurs.ciblesVues} cibles vues, ZÉRO sondée au point de contact. Le sélecteur ne rend plus rien, ` +
        "ou `elementFromPoint` ne répond plus — ce n'est pas « aucune petite cible ».",
    })
  }
  if (compteurs.pairesExaminees === 0) {
    releve.refus.push({
      genre: 'zero-paire-examinee',
      detail: "Zéro paire de cibles examinée : l'axe des écarts n'a rien regardé, il n'a pas rien trouvé.",
    })
  }
  if (compteurs.textesAudites === 0) {
    releve.refus.push({
      genre: 'zero-texte-audite',
      detail: "Zéro texte audité en couleur. La sonde ne voit plus de texte — ce n'est pas « aucun contraste bas ».",
    })
  }
  if (compteurs.actifsLus === 0) {
    releve.refus.push({
      genre: 'zero-actif-lu',
      detail: 'Zéro actif de chargement lu. Le poids par route est vide, pas nul.',
    })
  }
  if (compteurs.barresMesurees === 0) {
    releve.refus.push({
      genre: 'zero-barre-mesuree',
      detail:
        "La rangée `data-mesure=rangee-entete-vitrine` n'a été trouvée nulle part : le marqueur a disparu de " +
        "`PublicHeader.tsx`, et le jeu de la barre publique n'a pas été mesuré une seule fois.",
    })
  }
  if (compteurs.clsObserves === 0) {
    releve.refus.push({
      genre: 'cls-non-observe',
      detail:
        "Aucun `PerformanceObserver('layout-shift')` posé : les zéros de la colonne CLS veulent dire " +
        '« non observé », pas « aucun décalage ».',
    })
  }
  if (partiel) {
    releve.refus.push({
      genre: 'releve-partiel',
      detail:
        `MESURE_NAV_ROUTES restreint le balayage à ${balayees.length} route(s) sur ${routes.length}. ` +
        'Un relevé partiel ne peut pas passer pour complet.',
    })
  }

  return releve
}

/* ══════════════════════════════════════════════════════════════════════════
   EXÉCUTION AUTONOME
   ══════════════════════════════════════════════════════════════════════════ */

const executeSeul = process.argv[1] && process.argv[1].endsWith('mesure-navigateur.mjs')
if (executeSeul) {
  const destination = process.argv[2]
  let releve
  try {
    releve = await releverAuNavigateur()
  } catch (e) {
    console.error(`\n✗ mesure-navigateur : ${e.message}\n`)
    process.exit(1)
  }

  if (destination) writeFileSync(destination, JSON.stringify(releve, null, 2))
  else process.stdout.write(JSON.stringify(releve, null, 2))

  if (Object.keys(releve.lenteurs).length > 0) {
    console.error(`\n⚠ ${Object.keys(releve.lenteurs).length} attente(s) dépassée(s) :`)
    for (const [cle, n] of Object.entries(releve.lenteurs)) console.error(`   ${n}× ${cle}`)
  }

  if (releve.refus.length > 0) {
    console.error(`\n✗ mesure-navigateur : ${releve.refus.length} refus.\n`)
    for (const r of releve.refus) {
      console.error(`   [${r.genre}] ${r.adresse ? `${r.adresse} (${r.langue}) — ` : ''}${r.detail ?? ''}`)
      if (r.genre === 'page-non-rendue') {
        console.error(
          `      statut ${r.statut}, ${r.elements} éléments, ${r.texte} caractères, racine vide : ${r.racineVide}` +
            (r.erreurs.length > 0 ? `, erreurs : ${r.erreurs.join(' | ')}` : ''),
        )
      }
    }
    console.error(
      `\n   Le relevé complet a tout de même été écrit${destination ? ` dans ${destination}` : ' sur stdout'} : ` +
        "un tableau amputé d'une ligne serait pire qu'un refus bruyant.\n",
    )
    process.exit(1)
  }

  console.error(
    `\n✓ ${releve.routes.length} routes · ${releve.totaux.etatsGeometrie} états de géométrie · ` +
      `${releve.totaux.ciblesVues} cibles vues (${releve.totaux.ciblesSondees} sondées) · ` +
      `${releve.totaux.pairesExaminees} paires · ${releve.totaux.textesAudites} textes · ` +
      `${releve.totaux.actifsLus} actifs\n`,
  )
}
