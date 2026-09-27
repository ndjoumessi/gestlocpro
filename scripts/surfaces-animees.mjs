#!/usr/bin/env node
/**
 * UNE SURFACE ANIMÉE OBÉIT À CE QUI LA PLACE, ET REPART DE LÀ OÙ ELLE EST.
 *
 * ═══ UNE SEULE CAUSE, DEUX DÉFAUTS MESURÉS ═══
 *
 * Les panneaux de ce dépôt entraient et sortaient par des IMAGES-CLÉS
 * (`gl-pop`, `gl-feuille`, `gl-drawer-*`), posées en `both`. Deux conséquences,
 * toutes deux relevées sur le produit avant que cette porte existe :
 *
 * 1. UNE ANIMATION REMPLIT, DONC ELLE ÉCRASE CE QUI LA PLACE. `MenuDeDebordement`
 *    se renverse au bas de la fenêtre : il calcule `versLeHaut`, pose un `top`,
 *    retourne son origine — et remonte le panneau par un `translateY(-100%)` EN
 *    LIGNE. Une animation qui remplit `transform: scale(1)` bat une déclaration
 *    en ligne, et le remplissage ne s'arrête pas à la fin de l'animation.
 *    Relevé sur `/demo/parc` en 1280 × 600 : `transform` en ligne
 *    `translateY(-100%)`, `transform` calculée `matrix(1, 0, 0, 1, 0, 0)` — le
 *    menu recouvrait son propre déclencheur et débordait de 69 px SOUS le bord
 *    de la fenêtre, c'est-à-dire exactement ce que le renversement existait pour
 *    éviter.
 *
 * 2. UNE ANIMATION REPART DE SON `from`, ELLE NE SE RE-CIBLE PAS. Fermer pendant
 *    l'entrée remplaçait `gl-pop` par `gl-pop-out`, dont la première image est
 *    `opacity: 1`. Relevé au double-clic sur un bouton de menu : opacité 0,342 à
 *    l'image du clic, puis 1,000 à l'image suivante, puis le fondu. Le panneau
 *    FLASHE à pleine opacité pour s'en aller. Deux trames plus tôt l'écart est
 *    de 1,000 — il flashe sans avoir jamais été vu.
 *
 * `Toast.tsx` portait déjà la bonne règle écrite — « une transition se re-cible
 * depuis sa position courante là où une animation repartirait de zéro » — et la
 * phrase d'à côté posait la prémisse inverse pour les panneaux : « une entrée et
 * une sortie jouent UNE fois et n'ont pas à être interrompues ». Elle est fausse,
 * et `useSortieDifferee` le prouvait déjà par une branche à lui : il gère
 * explicitement la RÉOUVERTURE PENDANT LA SORTIE.
 *
 * ═══ POURQUOI CETTE PORTE N'A PAS DE PAGE TÉMOIN ═══
 *
 * `temoins-de-sonde.mjs` fabrique des pages de toutes pièces parce que « le
 * produit ne peut pas servir de témoin : ses écrans sont verts ». Ce n'était pas
 * le cas ici : les deux propriétés étaient ROUGES sur le produit à la naissance
 * de ce fichier, avec les nombres ci-dessus. La rougeur initiale EST le témoin.
 *
 * ═══ CE QUE MESURE LA PROPRIÉTÉ 1 — LA SORTIE NE SAUTE PAS ═══
 *
 * On ouvre, on échantillonne chaque trame, et on demande la fermeture DÈS QUE la
 * surface est arrivée au tiers de sa présence — voir `DEPART_DE_FERMETURE`, dont
 * l'en-tête porte pourquoi ce n'est pas un compte de trames. On cherche LA FRONTIÈRE : la première trame où la
 * surface est déclarée sortante. La règle y est : une surface qui n'était pas
 * PLEINEMENT là ne doit pas l'être devenue pour partir.
 *
 * ═══ LA RÈGLE A ÉTÉ RESSERRÉE PARCE QUE LA PREMIÈRE ÉTAIT FAUSSE ═══
 *
 * Premier jet : « la présence ne monte pas à la frontière ». Elle a rougi sur le
 * correctif — `0.598` puis `0.765` sur le menu de débordement. Ce n'était pas un
 * saut : la trame d'avant a jusqu'à 17 ms de retard sur la demande, et l'entrée
 * y progresse LÉGITIMEMENT. Au plus raide de l'easeOutQuint d'une entrée de
 * 150 ms, une seule trame vaut 0,45 de présence — une tolérance qui l'absoudrait
 * absoudrait aussi les sauts mesurés (0,235 au plus petit).
 *
 * Ce qui SÉPARE les deux mécanismes n'est donc pas l'ampleur de la montée, c'est
 * sa DESTINATION. Une image clé de sortie part de son `from`, qui est l'état de
 * repos : le saut atterrit sur la présence pleine, toujours, quel que soit
 * l'instant de la fermeture. Une transition part de la valeur courante et ne
 * peut pas atteindre le repos en s'en allant.
 *
 * CE QUE CETTE RÈGLE NE VOIT PAS, ET IL FAUT LE DIRE : une sortie qui sauterait
 * à 0,9 depuis 0,34 passerait. Le relevé imprime l'écart de chaque frontière —
 * c'est ce qui reste lisible pour qui regarde le rapport, et c'est tout ce que
 * cette porte sait offrir contre ce cas-là.
 *
 * « Sortante » se lit sur `aria-hidden`, porté par le nœud ou l'un de ses
 * ascendants. Ce n'est pas un choix de commodité : c'est le CONTRAT que
 * `useSortieDifferee` impose à ses appelants, écrit dans son en-tête, et la
 * seule marque de la sortie qui ne soit pas un nom de classe.
 *
 * ═══ CE QUE MESURE LA PROPRIÉTÉ 2 — LE MENU RENVERSÉ TIENT SA PLACE ═══
 *
 * On amène le déclencheur d'une fiche de logement tout en bas de la fenêtre —
 * assez bas pour que son menu ne tienne plus dessous —, on l'ouvre SANS laisser
 * un outil le recentrer, et on vérifie deux faits d'écran :
 *   — le menu tient dans la fenêtre ;
 *   — il ne recouvre pas le déclencheur qui l'a ouvert.
 *
 * Aucun des deux ne nomme le renversement. C'est délibéré : la propriété est
 * VISIBLE, pas interne, et elle reste vraie le jour où le placement changerait
 * de méthode.
 *
 * ═══ CE QU'ELLE NE VOIT PAS, ET IL FAUT LE DIRE ═══
 *
 * — LES SURFACES NON CITÉES. Cinq sont inspectées : le menu de débordement, le
 *   panneau de réglages, la modale en boîte, la modale en feuille et le tiroir.
 *   Les panneaux de date, la liste cherchable du `Combobox`, le menu de profil
 *   et le panneau de devise partagent leurs classes avec ces cinq-là — la
 *   couverture porte sur le MÉCANISME, pas sur chaque appelant. Un appelant qui
 *   inventerait sa propre animation échapperait à cette porte.
 * — LE VOILE DU TIROIR n'apparaît pas au relevé : la sonde le cherche parmi les
 *   frères fixes de la couche et ne le trouve pas — le panneau du tiroir EST
 *   lui-même la couche fixe, et le voile est son frère à un étage que la sonde
 *   ne remonte pas. Sa paire de classes est pourtant mesurée : c'est celle que la
 *   modale en feuille emploie sous `sm`, et qui figure au relevé sous
 *   `modale en feuille · button`. La classe est couverte, l'appelant ne l'est pas.
 * — LE TOAST. `animate-rise` n'est pas converti : le lot le nomme et le laisse.
 *   Cette porte ne l'inspecte donc pas, et le toast garde donc le même saut si on
 *   le congédie pendant ses 300 ms d'entrée.
 * — LA DOUCEUR. Une sortie qui ne saute pas peut rester laide. Aucune garde ne
 *   sait lire une courbe ; ce fichier sait lire une discontinuité.
 * — LE TIERS est un choix, pas un seuil physique. C'est un point plausible du
 *   double-clic. Plus tard dans l'entrée, le saut mesuré était plus petit mais
 *   atterrissait au même endroit — la règle le dénonce donc aussi longtemps que
 *   la surface n'a pas fini d'entrer. Après la fin de l'entrée, elle est
 *   PLEINE des deux côtés de la frontière et cette porte n'a plus rien à dire :
 *   c'est le cas où il n'y a, de fait, aucun saut.
 *
 *   node scripts/surfaces-animees.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici — ce fichier ne connaît que des nombres.
 */
import { chromium } from 'playwright'
import { exit } from 'node:process'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'
import { neutraliserLApiLocale } from './api-locale-neutralisee.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

const PORT = 4199
const BASE = `http://127.0.0.1:${PORT}`

/**
 * Ce qu'on tient pour la présence PLEINE.
 *
 * Zéro d'écart serait le nombre juste et ne serait pas mesurable : le navigateur
 * rend `0.998` là où la courbe dit `1`, et la dernière trame d'une entrée tombe
 * n'importe où dans ce voisinage. Deux centièmes sont sous le seuil de ce qu'un
 * œil distingue sur un aplat.
 */
const PLEINE = 0.98

/**
 * La présence à partir de laquelle on demande la fermeture.
 *
 * ═══ CE SEUIL A REMPLACÉ UN COMPTE DE TRAMES, ET C'EST UNE CORRECTION ═══
 *
 * Premier jet : « fermer après deux trames », puis quatre — parce qu'à deux, cinq
 * nœuds sur sept n'avaient pas encore bougé et rendaient un verdict sans objet.
 * À quatre, la porte a été VERTE sur une machine au repos (présences relevées de
 * 0,34 à 0,87) puis ROUGE dans la chaîne complète, sur le MÊME commit : les trois
 * surfaces du téléphone plafonnaient à 0,138, 0,238 et 0,296. Une trame n'est pas
 * une durée, et le moment où une transition démarre dépend de ce que le fil
 * principal a d'autre à faire. Un compte de trames rendait donc deux verdicts
 * pour un seul commit — la définition d'une porte qui ne garde rien.
 *
 * On ferme donc quand la surface EST ARRIVÉE À UN TIERS, quel que soit le temps
 * qu'elle y met. Le seuil ne mesure plus la machine, il situe le geste : assez
 * haut pour qu'il y ait quelque chose à interrompre, assez bas pour rester loin
 * de la présence pleine, où la règle n'aurait plus rien à dire.
 */
const DEPART_DE_FERMETURE = 0.33

/** Les surfaces inspectées, et comment on les ouvre. */
const SURFACES = [
  {
    nom: 'menu de débordement',
    adresse: '/demo',
    largeur: 1280,
    hauteur: 900,
    bouton: /^Autres actions$|^More actions$/,
    panneau: '[role="menu"]',
  },
  {
    nom: 'panneau de réglages',
    adresse: '/demo',
    largeur: 1280,
    hauteur: 900,
    bouton: /^Réglages : langue, devise et thème$|^Settings: language, currency and theme$/,
    panneau: '[role="dialog"]',
  },
  {
    nom: 'modale en boîte',
    adresse: '/demo/parc',
    largeur: 1280,
    hauteur: 900,
    bouton: /^Ajouter un immeuble$|^Add a building$/,
    panneau: '[role="dialog"]',
  },
  {
    nom: 'modale en feuille',
    adresse: '/demo/parc',
    largeur: 390,
    hauteur: 740,
    bouton: /^Ajouter un immeuble$|^Add a building$/,
    panneau: '[role="dialog"]',
  },
  {
    nom: 'tiroir de navigation',
    adresse: '/demo',
    largeur: 390,
    hauteur: 740,
    bouton: /^Ouvrir la navigation$|^Open navigation$|^Menu$/,
    /* `[role="dialog"]` SEUL, et c'est une correction mesurée : une liste à
       virgule rend le premier nœud dans l'ordre du DOCUMENT, et le rail de
       navigation porte un `nav` bien avant le tiroir. La sonde visait donc un
       nœud qui ne bouge pas, et se déclarait « rien à mesurer ». */
    panneau: '[role="dialog"]',
  },
]

const plaintes = []
const releve = []
/* Ce que la porte a RÉELLEMENT inspecté — sa garde du garde, plus bas. */
let surfacesInspectees = 0
let noeudsSuivis = 0
let renversementsInspectes = 0

const serveur = await servirLaPrevisualisation('surfaces-animees', PORT)

try {
  const navigateur = await chromium.launch()

  /* ── PROPRIÉTÉ 1 : une sortie ne saute pas ─────────────────────────────── */
  for (const cas of SURFACES) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: cas.largeur, height: cas.hauteur },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    await neutraliserLApiLocale(contexte)
    const page = await contexte.newPage()
    await page.goto(BASE + cas.adresse, { waitUntil: 'domcontentloaded' })
    /* Les polices décident des hauteurs, donc de ce qui tient et de ce qui
       bascule. Une sonde qui mesure avant leur arrivée mesure une autre page. */
    await page.evaluate(() => document.fonts.ready)

    const nom = `${cas.nom}@${cas.largeur}`
    const declencheur = page.getByRole('button', { name: cas.bouton }).first()
    /* ON ATTEND LE DÉCLENCHEUR, PAS UNE DURÉE. L'espace de démonstration vit
       dans un morceau différé : à 400 ms après `domcontentloaded`, la coquille
       est là et l'écran ne l'est pas — mesuré, quatre des cinq surfaces se
       déclaraient « introuvables » sur une table pourtant juste. */
    try {
      await declencheur.waitFor({ state: 'attached', timeout: 10000 })
    } catch {
      plaintes.push(`${nom} : déclencheur introuvable en 10 s — la table est périmée.`)
      await contexte.close()
      continue
    }
    await declencheur.evaluate((el) => el.setAttribute('data-sonde-declencheur', ''))
    await declencheur.click()

    const mesure = await page.evaluate(
      async ({ selecteurPanneau, depart }) => {
        const panneau = document.querySelector(selecteurPanneau)
        if (!panneau) return { erreur: 'panneau absent après le clic' }

        /* LE CONTENEUR QUI RECOUVRE, pour y trouver le voile. Panneau et voile
           sont frères sous lui : c'est la structure que `useSortieDifferee`
           décrit, et la borner ainsi évite de ramasser une barre de graphe ou
           un indicateur d'attente qui vivraient DANS le panneau. */
        let couche = panneau
        while (couche.parentElement && getComputedStyle(couche).position !== 'fixed') {
          couche = couche.parentElement
        }
        const candidats = new Set()
        for (let n = panneau; n; n = n.parentElement) {
          candidats.add(n)
          if (n === couche) break
        }
        for (const enfant of couche.children) candidats.add(enfant)
        /* ET LES FRÈRES FIXES DE LA COUCHE : le voile du tiroir n'est pas DANS
           le panneau, il est à côté — un bouton `fixed inset-0`. Sans cette
           ligne, le voile d'une surface sur deux n'était pas mesuré. */
        if (couche.parentElement) {
          for (const frere of couche.parentElement.children) {
            if (frere !== couche && getComputedStyle(frere).position === 'fixed') {
              candidats.add(frere)
            }
          }
        }

        /* Un nœud ne compte que s'il BOUGE — une animation non perpétuelle, ou
           une transition sur l'opacité ou la transformation. Le perpétuel est
           écarté par `infinite` : un indicateur d'attente n'entre ni ne sort. */
        const suivis = [...candidats].filter((el) => {
          const cs = getComputedStyle(el)
          const anime = cs.animationName !== 'none' && !/infinite/.test(cs.animationIterationCount)
          const transite =
            /opacity|transform|all/.test(cs.transitionProperty) && cs.transitionDuration !== '0s'
          return anime || transite
        })
        if (suivis.length === 0) return { erreur: 'aucun nœud ne bouge : rien à mesurer' }

        /*
          LA PRÉSENCE, ET POURQUOI CE N'EST PAS L'OPACITÉ.

          `gl-drawer-in` et `gl-feuille` ne touchent PAS l'opacité : ils
          translatent. Une règle écrite sur la seule opacité aurait donc rendu le
          tiroir et la feuille VERTS À VIDE — l'écart y vaut zéro parce que le
          nombre ne bouge jamais, pas parce que la sortie est douce. C'est le
          défaut de garde que ce dépôt paie le plus souvent, et il se serait posé
          sur la surface la plus visible du téléphone.

          On compose donc un seul scalaire : combien la surface est LÀ. Opacité
          pleine, aucun décalage → 1. Effacée ou repoussée d'une largeur entière
          → 0. Le décalage est normalisé par la taille non transformée du nœud,
          ce qui rend comparables un `translateY(100%)` de feuille et un
          `translateX(-100%)` de tiroir.

          CE QU'IL CONFOND, ET IL FAUT LE DIRE : un décalage de PLACEMENT — le
          `translateY(-100%)` d'un menu renversé — se lit comme une absence. La
          propriété 1 ne compare que des ÉCARTS à la frontière, où un décalage
          constant s'annule ; la propriété 2, elle, ne regarde pas la présence du
          tout. Aucune des deux ne se fie donc à ce que ce scalaire ignore.
        */
        const presence = (el) => {
          const cs = getComputedStyle(el)
          const m = new DOMMatrix(cs.transform)
          const larg = el.offsetWidth || 1
          const haut = el.offsetHeight || 1
          const partX = 1 - Math.min(1, Math.abs(m.e) / larg)
          const partY = 1 - Math.min(1, Math.abs(m.f) / haut)
          return Number(cs.opacity) * partX * partY
        }

        const sortante = (el) => {
          for (let n = el; n; n = n.parentElement) {
            if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true
          }
          return false
        }

        const series = suivis.map(() => [])
        let ferme = false
        let tFermeture = null
        const debut = performance.now()

        await new Promise((resolve) => {
          function trame() {
            const t = performance.now()
            suivis.forEach((el, i) => {
              series[i].push({ pres: presence(el), sortant: sortante(el) })
            })
            /* LA FERMETURE SUIT L'ÉTAT DU PANNEAU, PAS UN CHRONOMÈTRE : dès qu'il
               est arrivé au seuil, on l'interrompt. */
            const presPanneau = presence(panneau)
            if (!ferme && presPanneau >= depart) {
              ferme = true
              tFermeture = t
              const evt = () => new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
              document.dispatchEvent(evt())
              panneau.dispatchEvent(evt())
            }
            /* Deux secondes de patience pour ATTEINDRE le seuil : c'est six fois
               la plus longue entrée du dépôt, donc un dépassement dit que la
               surface n'entre pas, et non que la machine est lente. */
            if (!ferme && t - debut > 2000) {
              resolve()
              return
            }
            /* Puis 400 ms de suivi : la plus longue sortie dure 200 ms. */
            if (!ferme || t - tFermeture < 400) requestAnimationFrame(trame)
            else resolve()
          }
          requestAnimationFrame(trame)
        })

        if (!ferme) {
          return {
            erreur: `la surface n'a pas atteint la présence ${depart} en 2 s — elle n'entre pas, ou son entrée est déjà finie avant la première trame`,
          }
        }

        return {
          noeuds: series.map((serie, i) => {
            const frontiere = serie.findIndex((e) => e.sortant)
            return {
              etiquette: suivis[i].getAttribute('role') || suivis[i].tagName.toLowerCase(),
              frontiere,
              avant: frontiere > 0 ? serie[frontiere - 1].pres : null,
              apres: frontiere >= 0 ? serie[frontiere].pres : null,
              trames: serie.length,
            }
          }),
        }
      },
      { selecteurPanneau: cas.panneau, depart: DEPART_DE_FERMETURE },
    )

    if (mesure.erreur) {
      plaintes.push(`${nom} : ${mesure.erreur}`)
      await contexte.close()
      continue
    }

    surfacesInspectees += 1
    for (const n of mesure.noeuds) {
      if (n.frontiere < 0) {
        plaintes.push(
          `${nom} · ${n.etiquette} : aucune trame sortante en ${n.trames} — la fermeture n’a pas eu lieu, rien n’est mesuré.`,
        )
        continue
      }
      if (n.frontiere === 0) {
        plaintes.push(
          `${nom} · ${n.etiquette} : sortant dès la première trame — pas de trame d’avant à comparer.`,
        )
        continue
      }
      noeudsSuivis += 1
      const montee = n.apres - n.avant
      releve.push(
        `${nom} · ${n.etiquette} : ${n.avant.toFixed(3)} → ${n.apres.toFixed(3)} (${montee >= 0 ? '+' : ''}${montee.toFixed(3)})`,
      )
      if (n.avant < PLEINE && n.apres >= PLEINE) {
        plaintes.push(
          `${nom} · ${n.etiquette} : la sortie part de la présence PLEINE — ${n.avant.toFixed(3)} puis ${n.apres.toFixed(3)}. La surface n’y était pas : elle a sauté au complet pour s’en aller.`,
        )
      }
    }
    await contexte.close()
  }

  /* ── PROPRIÉTÉ 2 : le menu renversé tient sa place ─────────────────────── */
  for (const vue of [
    { largeur: 1280, hauteur: 600 },
    { largeur: 390, hauteur: 740 },
  ]) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: vue.largeur, height: vue.hauteur },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    await neutraliserLApiLocale(contexte)
    const page = await contexte.newPage()
    await page.goto(BASE + '/demo/parc', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => document.fonts.ready)
    try {
      await page
        .locator('button[aria-haspopup="menu"][aria-label*="logement" i]')
        .first()
        .waitFor({ state: 'attached', timeout: 10000 })
    } catch {
      plaintes.push(`menu de fiche@${vue.largeur}×${vue.hauteur} : aucune fiche de logement en 10 s.`)
      await contexte.close()
      continue
    }

    const nom = `menu de fiche@${vue.largeur}×${vue.hauteur}`
    const mesure = await page.evaluate(async () => {
      const boutons = [...document.querySelectorAll('button[aria-haspopup="menu"]')]
      const b = boutons.find((x) => /logement|unit/i.test(x.getAttribute('aria-label') || ''))
      if (!b) return { erreur: 'aucun menu de fiche de logement' }

      /* On l'amène TOUT EN BAS nous-mêmes. Tout outil qui « vise » un élément le
         fait d'abord défiler au centre — et un déclencheur centré a la place de
         déplier son menu vers le bas, donc ne renverse jamais. */
      const y = b.getBoundingClientRect().top + scrollY
      scrollTo(0, y - (innerHeight - 90))
      await new Promise((r) => setTimeout(r, 300))
      b.click()
      await new Promise((r) => setTimeout(r, 450))

      const p = document.querySelector('[role="menu"]')
      if (!p) return { erreur: 'menu absent après le clic' }
      const rd = b.getBoundingClientRect()
      const rp = p.getBoundingClientRect()
      const barre = document.querySelector('[data-barre-basse]')
      const recouvert = barre ? barre.getBoundingClientRect().height : 0
      return {
        etiquette: b.getAttribute('aria-label'),
        declencheurHaut: Math.round(rd.top),
        declencheurBas: Math.round(rd.bottom),
        menuHaut: Math.round(rp.top),
        menuBas: Math.round(rp.bottom),
        debordeEnBas: Math.round(rp.bottom - (innerHeight - recouvert)),
        recouvre: rp.top < rd.bottom && rp.bottom > rd.top,
        auDessus: rp.bottom <= rd.top + 1,
      }
    })

    if (mesure.erreur) {
      plaintes.push(`${nom} : ${mesure.erreur}`)
      await contexte.close()
      continue
    }

    renversementsInspectes += 1
    releve.push(
      `${nom} : déclencheur ${mesure.declencheurHaut}–${mesure.declencheurBas}, menu ${mesure.menuHaut}–${mesure.menuBas}, ` +
        `débordement ${mesure.debordeEnBas} px, ${mesure.auDessus ? 'au-dessus' : 'en dessous'}`,
    )
    if (mesure.debordeEnBas > 0) {
      plaintes.push(
        `${nom} : le menu déborde de ${mesure.debordeEnBas} px sous le bord utile de la fenêtre.`,
      )
    }
    if (mesure.recouvre) {
      plaintes.push(
        `${nom} : le menu RECOUVRE le déclencheur qui l’ouvre (menu ${mesure.menuHaut}–${mesure.menuBas}, déclencheur ${mesure.declencheurHaut}–${mesure.declencheurBas}).`,
      )
    }
    await contexte.close()
  }

  await navigateur.close()
} finally {
  if (serveur.pid) {
    try {
      process.kill(-serveur.pid, 'SIGTERM')
    } catch {
      /* déjà mort */
    }
  }
}

/* ── GARDE DU GARDE ──────────────────────────────────────────────────────────
   Une porte qui n'inspecte rien est verte. Les trois comptes ci-dessous sont ce
   qui distingue « aucun défaut » de « aucune mesure ». */
if (surfacesInspectees < SURFACES.length) {
  plaintes.push(
    `garde du garde : ${surfacesInspectees} surface(s) inspectée(s) sur ${SURFACES.length}.`,
  )
}
if (noeudsSuivis < SURFACES.length) {
  plaintes.push(`garde du garde : ${noeudsSuivis} nœud(s) suivi(s), moins d’un par surface.`)
}
if (renversementsInspectes < 2) {
  plaintes.push(`garde du garde : ${renversementsInspectes} menu(s) de fiche inspecté(s) sur 2.`)
}

console.log('── surfaces animées ──')
for (const ligne of releve) console.log('  ' + ligne)
console.log(
  `  (${surfacesInspectees} surface(s), ${noeudsSuivis} nœud(s) suivi(s), ${renversementsInspectes} menu(s) de fiche)`,
)

if (plaintes.length > 0) {
  console.error('\nREFUS :')
  for (const p of plaintes) console.error('  — ' + p)
  exit(1)
}
console.log('\nOK : les surfaces obéissent à ce qui les place et repartent de là où elles sont.')
