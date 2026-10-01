#!/usr/bin/env node
/**
 * LA COLONNE DE LECTURE DE L'ESPACE CONNECTÉ EST BORNÉE.
 *
 * ═══ LE DÉFAUT, ET SA MESURE ═══
 *
 * `<main>` n'avait AUCUNE largeur maximale dans la coquille applicative. La
 * vitrine porte `max-w-7xl` depuis toujours ; l'application, non. Mesuré le
 * 2026-09-29 dans le navigateur, à 1920 px de fenêtre : la colonne utile fait
 * 1 664 px, et tout ce qui s'aligne à ses deux bords s'écarte d'autant.
 *
 *   /demo/decisions   « Devis validé » → « Arsène Nkolo »      588 à 818 px de vide
 *   /demo/travaux     « Fuite sous l'évier » → « Valider »     857 à 1 061 px
 *   /demo/parc        « Résidence Bonamoussadi » → son loyer   1 009 px
 *
 * Ce ne sont pas des marges : ce sont les distances qu'un œil doit parcourir
 * pour apparier un fait et ce qui le qualifie. À 2560 px elles valent 640 px de
 * plus, et rien dans le produit ne les arrête.
 *
 * ═══ POURQUOI AUCUNE PORTE NE LE VOYAIT ═══
 *
 * `mesure-ui`, `plafond-coquille` et `plafond-hauteurs` mesurent 320, 360 et
 * 1280 px. À 1280 la colonne fait 1 009 px et ce défaut n'existe pas : le vide
 * de Travaux y tombe à 247 px. Les trois portes mesurent donc précisément les
 * largeurs où il n'y a rien à voir. C'est un angle mort de PÉRIMÈTRE, pas un
 * oubli de règle — d'où une porte de plus, et non une règle de plus.
 *
 * ═══ CE QUE CE SCRIPT MESURE, ET CE QU'IL NE MESURE PAS ═══
 *
 * IL MESURE une largeur : celle de la boîte de `<main>` sur les écrans de la
 * coquille applicative, à trois largeurs de fenêtre au-delà de 1280. Il refuse
 * quand elle dépasse le plafond écrit.
 *
 * IL NE MESURE PAS les vides ci-dessus. Ils dépendent du jeu de démonstration —
 * un nom plus long les réduit, un parc vide les supprime —, et une porte qui
 * garderait un vide garderait en réalité une donnée de démonstration. La
 * largeur de la colonne, elle, ne dépend que du code, et c'est la CAUSE des
 * trois. On garde la cause.
 *
 * IL NE MESURE PAS la vitrine, dont le `<main>` est plein écran PAR DESSEIN :
 * ce sont ses sections qui portent chacune leur `max-w-7xl`, parce qu'une bande
 * peinte doit aller d'un bord à l'autre pendant que son texte reste borné.
 * Deux mécanismes, deux familles ; celui-ci ne juge que l'applicative.
 *
 * ═══ POURQUOI PAS DE TÉMOIN SYNTHÉTIQUE ═══
 *
 * `temoins-de-sonde.mjs` en fabrique pour les sondes de `mesure-ui`, dont les
 * verdicts sont construits. Ici la sonde est un `getBoundingClientRect().width`
 * et la vérité attendue vient du produit lui-même : cette porte est née ROUGE
 * sur les 54 points, à 1 664 px pour un plafond de 1 280. Un témoin n'aurait
 * rien établi que ce rouge-là n'établisse.
 *
 *   node scripts/chasse-de-lecture.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { exit } from 'node:process'
import { inventaireDesRoutes, exigerUnInventairePlein } from './inventaire/routes.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'

const PORT = 4186
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LE PLAFOND, ET CE QU'IL VAUT.
 *
 * 1 280 px, soit `max-w-7xl` — LE MÊME NOMBRE QUE LA VITRINE, et c'est tout
 * l'argument. La vitrine fige sa largeur utile à 1 216 px dès 1 280 (gouttière
 * déduite) ; l'espace connecté prend exactement la même, et les deux moitiés du
 * produit cessent de se lire à deux chasses différentes.
 *
 * UNE SEULE VALEUR, PAS UNE PAR ÉCRAN. La colonne est posée par la coquille :
 * dix-huit plafonds identiques seraient dix-huit occasions de diverger.
 *
 * IL NE PORTE AUCUNE MARGE. Un plafond au mesuré fait rougir au premier pixel ;
 * le relever demandera d'écrire ici ce que ces pixels achètent — la règle de
 * `plafond-coquille`, et pour la même raison.
 *
 * `avant` garde les trois mesures d'avant le lot. Un plafond seul est un
 * nombre ; un plafond avec l'avant est une décision.
 */
const PLAFOND = 1280
const AVANT = { 1600: 1344, 1920: 1664, 2560: 2304 }

/**
 * TROIS LARGEURS, ET AUCUNE EN DEÇÀ DE 1 280.
 *
 * 1600 est la borne basse utile : c'est là que la colonne dépasse le plafond
 * pour la première fois, donc le point où la porte doit savoir rougir. 1920 est
 * la largeur des captures de Nelson, celle où le défaut a été trouvé. 2560 dit
 * que la borne TIENT au lieu de suivre : sans elle, une colonne qui grandirait
 * proportionnellement passerait les deux premières.
 *
 * Rien sous 1 280 : `mesure-ui` et `plafond-coquille` y sont déjà, et cette
 * porte n'a rien à y apprendre — voir son en-tête.
 */
const LARGEURS = [1600, 1920, 2560]

/**
 * LA COQUILLE APPLICATIVE, DÉDUITE DU ROUTEUR ET JAMAIS RECOPIÉE.
 *
 * Elle se reconnaît à son préfixe, exactement comme dans `plafond-coquille` :
 * `/app` pour les écrans connectés, `/demo` pour la démonstration, qui est la
 * même coquille remplie d'un parc fictif.
 */
const estApplicative = (adresse) => adresse.startsWith('/app') || adresse.startsWith('/demo')

/**
 * LES ADRESSES SANS ÉCRAN, ÉCRITES ET COMPTÉES.
 *
 * `/app` ne rend pas de `<main>` à cette porte : elle visite sans session, et
 * `RequireAuth` lui rend l'état terminal — serveur injoignable — hors coquille.
 * `neutraliserLApiLocale` est ce qui rend ce fait VRAI PARTOUT : sans elle, une
 * machine où le serveur d'API tourne renverrait vers `/connexion`, qui porte un
 * `<main>`. `plafond-coquille` a rougi exactement ainsi le 2026-09-02.
 *
 * Écrite plutôt que devinée par l'absence de `<main>` : un écran réel qui
 * perdrait le sien par accident doit faire rougir, pas se sauter tout seul.
 */
const SANS_ECRAN = ['/app']

/*
  ATTENDUS EST ÉCRIT À LA MAIN, JAMAIS DÉRIVÉ DE LA LISTE SURVEILLÉE.

  Le calculer depuis l'inventaire rendrait la garde d'accord avec elle-même :
  vider l'inventaire, et elle comparerait 0 à 0 puis se déclarerait verte. Le
  même piège a été trouvé trois lots de suite par mutation dans ce dépôt.

  54 = (19 adresses applicatives − 1 sans écran) × 3 largeurs.
  3  = `/app`, redirection sans `<main>`, à ses trois largeurs.

  Ajouter un écran applicatif oblige donc à toucher ce nombre, et le diff le
  montre.

  54 → 57 (2026-09-30) : les dépenses, l'écran de ce qui sort du parc.
  57 → 60 (2026-09-30) : la vacance, l'écran de ce qui ne rapporte rien — le
  second du même jour, et le dernier des huit lots.
  60 → 63 (2026-10-01) : le manuel d'utilisation. C'est l'écran de ce dépôt où
  cette garde compte le plus : il est fait de PROSE, et une colonne de lecture
  trop large y coûte à chaque ligne, pas seulement sur quelques appariements.
*/
const ATTENDUS = 63
const SAUTEES_ATTENDUES = 3

/* LE PAQUET AVANT TOUT LE RESTE : ce script mesure `dist/`, jamais les
   sources. Un paquet périmé rendrait un verdict sur le code d'AVANT, en
   silence — voir `paquet-a-jour.mjs`. */
exigerUnPaquetAJour()

const routes = inventaireDesRoutes()
exigerUnInventairePlein(routes)
const ADRESSES = routes.map((r) => r.adresse).filter(estApplicative)

const serveur = await servirLaPrevisualisation('chasse-de-lecture', PORT)
const plaintes = []
const releve = []
let inspectes = 0
let sautees = 0

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
    for (const adresse of ADRESSES) {
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      /*
        AUCUNE ATTENTE DE POLICE, et c'est mesuré plutôt que supposé : cette
        porte lit une CONTRAINTE de mise en page — une largeur maximale posée en
        `rem` sur une racine à 16 px —, et non une boîte de texte. Le dessin des
        glyphes ne peut pas la déplacer. `plafond-coquille` attend les polices
        parce qu'il mesure une HAUTEUR, qui, elle, en dépend à 320 et 360 px.
      */
      const mesure = await page.evaluate(() => {
        const main = document.querySelector('main')
        if (!main) return null
        const boite = main.getBoundingClientRect()
        const style = getComputedStyle(main)
        return {
          largeur: Math.round(boite.width),
          /* La colonne utile : la boîte moins ses gouttières. C'est elle que le
             lecteur voit, et c'est elle qu'on compare à la vitrine. */
          utile: Math.round(
            boite.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          ),
        }
      })

      const nom = `${adresse}@${largeur}`
      if (SANS_ECRAN.includes(adresse)) {
        if (mesure !== null) {
          plaintes.push(
            `${nom} : déclarée sans écran, mais elle rend un <main>.\n` +
              "   La déclaration est périmée : retirez-la, l'écran veut un plafond.",
          )
        }
        sautees++
        continue
      }
      if (mesure === null) {
        plaintes.push(
          `${nom} : pas de <main> sur cet écran.\n` +
            '   La colonne de lecture se mesure contre lui ; sans lui il n’y a pas de mesure,\n' +
            '   et une absence de mesure ne doit jamais s’écrire comme une absence de défaut.',
        )
        continue
      }

      inspectes++
      releve.push({ nom, largeur, ...mesure })
      if (mesure.largeur > PLAFOND) {
        plaintes.push(
          `${nom} : colonne de ${mesure.largeur} px (utile ${mesure.utile}), pour un plafond de ${PLAFOND}.\n` +
            `   Avant ce lot, à cette largeur : ${AVANT[largeur]} px.\n` +
            '   Une colonne non bornée écarte de la même quantité tout ce qui s’aligne à ses\n' +
            '   deux bords : une décision de son auteur, une intervention de son geste.',
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
    "AUCUN écran inspecté. Absence d'inspection, et non absence de défaut : la garde refuse.",
  )
}
if (inspectes !== ATTENDUS) {
  plaintes.push(`${inspectes} écran(s) inspecté(s) pour ${ATTENDUS} attendu(s).`)
}
if (sautees !== SAUTEES_ATTENDUES) {
  plaintes.push(
    `${sautees} route(s) sautée(s) pour ${SAUTEES_ATTENDUES} attendue(s).\n` +
      "   La liste des routes sans écran est périmée dans un sens ou dans l'autre.",
  )
}

/* Le relevé se résume PAR LARGEUR : cinquante-quatre lignes noieraient le seul
   nombre qui compte, qui est la pire colonne de chaque largeur. */
const parLargeur = {}
for (const r of releve) {
  if (!parLargeur[r.largeur] || r.largeur > parLargeur[r.largeur].largeurMesuree) {
    parLargeur[r.largeur] = { ...r, largeurMesuree: r.largeur }
  }
}
for (const largeur of LARGEURS) {
  const r = parLargeur[largeur]
  if (!r) continue
  console.log(
    `  fenêtre ${String(largeur).padStart(4)} px   colonne ${String(r.largeur).padStart(4)} px ` +
      `(utile ${String(r.utile).padStart(4)} · plafond ${PLAFOND} · avant ${AVANT[largeur]} · ` +
      `−${AVANT[largeur] - r.largeur} px)`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ chasse-de-lecture : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ chasse-de-lecture : ${inspectes}/${ATTENDUS} écrans applicatifs sous ${PLAFOND} px de colonne.\n` +
    '  Ce script ne dit RIEN des vides qu’une colonne bornée laisse encore — voir son en-tête.',
)
