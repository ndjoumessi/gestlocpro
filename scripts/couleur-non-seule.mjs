#!/usr/bin/env node
/**
 * LA COULEUR N'EST JAMAIS SEULE.
 *
 * Un statut porté par la seule teinte est illisible pour une déficience de
 * perception rouge-vert — environ un homme sur douze. Aucune garde existante
 * ne le voit : le contraste de LUMINANCE passe l'AA, les cibles sont
 * conformes, rien ne déborde. La porte reste verte sur un écran qu'une partie
 * des lecteurs ne peut pas déchiffrer.
 *
 * CE QUE CE SCRIPT MESURE, ET COMMENT.
 *
 * Il rend chaque état d'un site, à sa TAILLE RÉELLE, et compare les
 * SILHOUETTES : la couleur est binarisée en encre / fond, puis retirée. Ce qui
 * reste est la seule chose qu'un daltonien garde — la géométrie. Deux états
 * dont les silhouettes se recouvrent sont deux états qu'il ne distingue pas,
 * quelle que soit la distance chromatique entre leurs teintes.
 *
 * UN SEUIL, une SURFACE absolue : 12 px² CSS de forme non partagée. Il refuse
 * une forme trop peu différente, et aussi une forme différente mais trop petite
 * pour que la différence existe à l'œil — réduire la pastille de 10 px à 5 px
 * divise cette surface par quatre. Un second critère, en pourcentage de la
 * boîte, a vécu ici deux lots sans jamais décider seul : voir `SEUIL_SURFACE`.
 *
 * DEUX MODES, PARCE QU'UN ARC N'EST PAS UN DISQUE.
 *
 * Le mode BOÎTE ci-dessus compare des vignettes rectangulaires : il convient à
 * une pastille, dont la boîte est la même pour les trois états. Il ne convient
 * PAS à une part d'anneau, dont la largeur angulaire EST la donnée — 245°, 9°
 * et 106° sur le tableau de bord. Comparer les vignettes de trois arcs de
 * tailles différentes ne mesure que la différence des montants, et la mutation
 * « les trois parts reprennent la même forme » passerait au vert.
 *
 * Le mode POLAIRE compare donc le PROFIL RADIAL. Pour chaque part, une fenêtre
 * de 18 × 6 px CSS prise en coordonnées (rayon × abscisse curviligne) autour de
 * son angle médian : la largeur radiale d'une bande est constante et
 * indépendante des montants, c'est donc la seule dimension où une forme puisse
 * porter un état. La fenêtre étant alignée sur le rayon, deux parts de MÊME
 * forme rendent la même grille où qu'elles soient sur l'anneau.
 *
 * L'ÉCHANTILLONNAGE EST BILINÉAIRE, et ce n'est pas un raffinement. Arrondi au
 * pixel appareil, le bord rasterisé d'un arc se place différemment selon
 * l'angle : mesuré, trois parts RIGOUREUSEMENT IDENTIQUES rendaient jusqu'à
 * 6,9 % d'écart, soit un plancher de bruit à un point du seuil de refus. En
 * bilinéaire ce plancher tombe à 5,4 % ; le dessin livré mesure 33 % et plus.
 * Ces trois nombres sont le rapport de force de cette garde, et ils sont écrits
 * ici pour qu'on puisse les contester.
 *
 * CE QU'IL NE VOIT PAS, et il faut le dire — c'est une dette, nommée :
 * il n'inspecte QUE les sites qui se déclarent par `data-jauge`. Un nouveau
 * statut peint en couleur nue ailleurs dans le produit ne lui apparaît pas.
 * Il garde ce qui est corrigé contre la régression ; il ne découvre rien. Une
 * garde qui prétendrait balayer tout le produit mentirait : « un statut » n'a
 * pas de signature statique dans le DOM.
 *
 * LA GARDE DU GARDE. Le nombre de sites inspectés est VÉRIFIÉ contre
 * `ATTENDUS`, jamais supposé. Si l'inspection ne trouve plus rien — attribut
 * retiré, écran déplacé, sélecteur périmé — le script REFUSE. Il n'écrit
 * jamais « aucun défaut » sur une inspection vide : c'est exactement la
 * décoration qu'il est là pour ne pas être.
 *
 *   node scripts/couleur-non-seule.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé par le générateur d'utilitaires.
 * Aucun nom de classe n'est écrit ici, et il n'y en a aucun besoin : le script
 * ne connaît les sites que par `data-jauge` et par le rôle ARIA.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { lirePNG } from './lire-png.mjs'
import { imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4188
const BASE = `http://127.0.0.1:${PORT}`

/**
 * UN SEUL SEUIL, ET C'EST LA SURFACE. Le critère de PART est retiré.
 *
 * Il y en avait deux : une part de la boîte (8 %) et une surface absolue
 * (12 px²). Mesuré sur les deux lots qui les ont employés, le premier n'a
 * JAMAIS décidé :
 *   — plancher de bruit du mode polaire : 5,8 % (trois formes identiques) ;
 *   — mutation M4a du lot de l'anneau : 8,3 % de part, donc AU-DESSUS des 8 %,
 *     et pourtant refusée — par la surface, à 9,0 px² pour 12 exigés.
 * Un critère dont la zone d'action utile est l'intervalle [5,8 % ; 8 %] et
 * qu'aucune mutation n'a jamais fait rougir seul ne garde rien : il ajoute une
 * ligne au message d'erreur et une condition à lire. La surface, elle, est
 * celle qui attrape — et elle a l'avantage de parler la même unité pour une
 * pastille de 10 px et pour une fenêtre polaire de 108 px².
 *
 * CE QUE CE RETRAIT COÛTE, et il faut le dire : sur une boîte très grande, une
 * différence de 12 px² pourrait passer en étant proportionnellement minuscule.
 * Aucune des deux boîtes surveillées n'est grande — 100 px² pour la pastille,
 * 108 pour la fenêtre polaire — donc le cas n'existe pas ici. Il existera le
 * jour où un site d'état sera plus grand, et ce jour-là il faudra un critère
 * relatif, mais calibré sur du bruit mesuré et non posé à 8 % par symétrie.
 */
const SEUIL_SURFACE = 12 // px² CSS

/**
 * LES POINTS D'INSPECTION, ET LEUR COMPTE ATTENDU.
 *
 * `sites` énumère ce qui DOIT être trouvé à cette largeur. La grille des
 * périodes est masquée sous 640 px (`hidden sm:table-cell`) : à 360 px, il n'y
 * a que la légende, et l'exiger là serait une garde qui refuse une chose
 * correcte. La légende, elle, est rendue à TOUTES les largeurs.
 *
 * Les deux thèmes : la jauge tire sa couleur de `currentColor` et sa forme
 * d'aucune, donc la silhouette ne devrait pas bouger. « Ne devrait pas » est
 * précisément ce qu'une garde vérifie.
 */
const POINTS = [
  /* 320 px : la plus étroite des onze largeurs mesurées par `mesure-ui`, et la
     seule où l'on soit sûr que rien ne s'y cache. La légende y est rendue ; la
     grille non. */
  { adresse: '/demo/paiements', largeur: 320, theme: 'light', sites: ['legende'] },
  { adresse: '/demo/paiements', largeur: 360, theme: 'light', sites: ['legende'] },
  { adresse: '/demo/paiements', largeur: 1280, theme: 'light', sites: ['legende', 'grille'] },
  { adresse: '/demo/paiements', largeur: 1280, theme: 'dark', sites: ['legende', 'grille'] },

  /* L'ANNEAU DU RECOUVREMENT, sur l'écran que le propriétaire ouvre en premier.
     UNE SEULE LARGEUR ÉTROITE, et c'est mesuré, non supposé : le `<svg>` fait
     128 px aux ONZE largeurs de `mesure-ui` — 320, 360, 375, 414, 700, 768,
     800, 900, 1024, 1280, 1440 — et la pastille de légende 10 px partout.
     L'anneau ne disparaît sous aucun point de rupture, contrairement à la
     grille des périodes ; sa géométrie ne dépend pas de la fenêtre, donc une
     seconde largeur étroite ne mesurerait que la même chose deux fois.
     Les deux thèmes, en revanche, sont tenus : la forme vient de la géométrie
     et non de `currentColor`, et « ne devrait pas bouger » est précisément ce
     qu'une garde vérifie. */
  { adresse: '/demo', largeur: 360, theme: 'light', sites: ['anneau', 'legende'] },
  { adresse: '/demo', largeur: 1280, theme: 'light', sites: ['anneau', 'legende'] },
  { adresse: '/demo', largeur: 1280, theme: 'dark', sites: ['anneau', 'legende'] },
]

/**
 * CE QU'EST CHAQUE SITE, ET COMMENT ON LE MESURE.
 *
 * `legende` désigne les jauges HORS tableau — la légende des paiements comme
 * celle de l'anneau : même composant, même disque de 10 px, donc même mesure.
 * Le mode d'un site n'est pas déduit de ce qu'on y trouve : il est déclaré ici,
 * sans quoi un site vide se mesurerait « comme il peut » au lieu de refuser.
 */
const SITES = {
  legende: { mode: 'boite', dansGrille: false },
  grille: { mode: 'boite', dansGrille: true },
  anneau: { mode: 'polaire' },
}
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, ET NON UNE SOMME DE `POINTS`.

  Premier jet : `POINTS.reduce((n, p) => n + p.sites.length, 0)`. Mutation M3 —
  vider `POINTS` — et la garde passait au VERT : elle avait inspecté 0 site sur
  0 attendu, et 0 === 0. Une garde du garde qui tire son attente de la chose
  qu'elle surveille ne surveille rien ; elle se contente de dire qu'elle est
  d'accord avec elle-même.

  Le nombre est donc écrit à la main, une fois, ici. Ajouter un point de mesure
  oblige à le changer — c'est le coût, et il est voulu : il rend visible dans le
  diff toute variation de ce que la garde regarde.

  6 = légende à 320 et à 360 en clair · légende + grille à 1280 clair · idem sombre.
  6 = anneau + légende du recouvrement, à 360 clair, à 1280 clair, à 1280 sombre.

  LA CORRECTION TIENT-ELLE SUR LES SITES AJOUTÉS ? C'est la question, et la
  réponse est oui pour la même raison qu'avant : ce 12 ne descend d'aucune
  propriété de `POINTS`. Vider `POINTS`, retirer l'anneau de la liste, ou
  supprimer un `data-jauge` du `<circle>` fait chuter le compte constaté sans
  toucher l'attente — et l'écart arrête la porte. Rejoué : voir M3 au rapport.
*/
const ATTENDUS = 12
/** Les trois états que chaque site doit montrer. Un état absent est un état non prouvé. */
const ETATS = ['paid', 'partial', 'overdue']

async function servir() {
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(BASE + '/')).ok) return fils
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error('couleur-non-seule : le serveur de prévisualisation n’a pas répondu.')
}

/**
 * La silhouette d'un rendu : un masque booléen encre / fond.
 *
 * Le fond est LU sur les bords de la vignette — la marge autour de la pastille
 * — et non supposé blanc : la garde tourne aussi en thème sombre, et une
 * cellule de tableau n'a pas la couleur de la page.
 *
 * LE SEUIL EST RELATIF À L'ENCRE DE CETTE VIGNETTE-CI, et c'est le point
 * délicat. Un seuil absolu — « à plus de 0,18 du fond » — binarise un disque
 * pâle plus petit qu'un disque foncé : deux disques IDENTIQUES en géométrie
 * rendaient alors jusqu'à 17 % d'écart, du seul fait que leurs jetons n'ont pas
 * la même luminance. Une garde contre la couleur seule qui se laisse convaincre
 * par une différence de couleur est exactement la décoration qu'on veut éviter
 * — mesuré, c'est ainsi que la mutation M2 a failli passer.
 *
 * On prend donc, par vignette, la moitié de la distance entre le fond et son
 * encre la plus franche. Le pâle et le foncé binarisent alors au même disque,
 * et il ne reste que la FORME.
 */
function silhouette(png, marge, echelle) {
  const { largeur, hauteur, canaux, px } = png
  const lum = (i) => (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
  const bords = []
  for (let x = 0; x < largeur; x++) {
    bords.push(lum(x * canaux), lum(((hauteur - 1) * largeur + x) * canaux))
  }
  bords.sort((a, b) => a - b)
  const fond = bords[bords.length >> 1]

  const m = marge * echelle
  let extreme = 0
  for (let y = m; y < hauteur - m; y++) {
    for (let x = m; x < largeur - m; x++) {
      extreme = Math.max(extreme, Math.abs(lum((y * largeur + x) * canaux) - fond))
    }
  }
  /* Plancher de 0,10 : sous cette distance il n'y a pas d'encre du tout, et la
     moitié de rien ferait binariser le bruit d'antialiasing en silhouette. */
  const seuil = Math.max(0.1, extreme) / 2

  const masque = []
  for (let y = m; y < hauteur - m; y++) {
    for (let x = m; x < largeur - m; x++) {
      masque.push(Math.abs(lum((y * largeur + x) * canaux) - fond) > seuil ? 1 : 0)
    }
  }
  return masque
}

/** Part de la boîte où deux silhouettes ne posent pas la même encre. */
function ecart(a, b) {
  if (a.length !== b.length) return null
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++
  return (n / a.length) * 100
}

/* ─── MODE POLAIRE ────────────────────────────────────────────────────────
   La fenêtre : 2×9 px CSS le long du rayon — la bande fait 14,1 px, il reste
   donc deux pixels de fond de chaque côté, et c'est ce fond qui donne son
   niveau de référence — sur 2×3 px d'abscisse curviligne. Six pixels, parce
   que la plus petite part MESURÉE de l'écran en fait huit : au-delà, la
   fenêtre mordrait sur les voisines et lirait leur teinte comme une forme. */
const DEMI_R = 9
const DEMI_S = 3
const PAS = 0.5
const AIRE_POLAIRE = 2 * DEMI_R * 2 * DEMI_S // 108 px² CSS

/** Luminance bilinéaire en un point non entier — voir l'en-tête. */
function lumBilineaire(png, xf, yf) {
  const { largeur, canaux, px } = png
  const x0 = Math.floor(xf)
  const y0 = Math.floor(yf)
  const fx = xf - x0
  const fy = yf - y0
  const g = (x, y) => {
    const i = (y * largeur + x) * canaux
    return (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
  }
  return (
    g(x0, y0) * (1 - fx) * (1 - fy) +
    g(x0 + 1, y0) * fx * (1 - fy) +
    g(x0, y0 + 1) * (1 - fx) * fy +
    g(x0 + 1, y0 + 1) * fx * fy
  )
}

/**
 * Grille polaire binarisée d'une part : le profil radial, à sa taille réelle.
 *
 * `centre` est en pixels CSS relatifs à la capture, `angle` en degrés depuis
 * midi, `rayon` en pixels CSS. Le fond est lu sur les DEUX EXTRÉMITÉS RADIALES
 * de la fenêtre — hors de la bande — et le seuil vaut la moitié de la distance
 * du fond à son encre la plus franche, comme en mode boîte et pour la même
 * raison : un seuil absolu binariserait la part pâle plus petite que la foncée
 * et lirait une différence de COULEUR comme une différence de forme.
 */
function grillePolaire(png, echelle, centre, angle, rayon) {
  const a0 = ((angle - 90) * Math.PI) / 180
  const ech = []
  for (let dr = -DEMI_R; dr <= DEMI_R + 1e-9; dr += PAS) {
    for (let ds = -DEMI_S; ds <= DEMI_S + 1e-9; ds += PAS) {
      const a = a0 + ds / rayon
      const r = rayon + dr
      ech.push(
        lumBilineaire(png, (centre.x + r * Math.cos(a)) * echelle, (centre.y + r * Math.sin(a)) * echelle),
      )
    }
  }
  const parLigne = Math.round((2 * DEMI_S) / PAS) + 1
  const bords = []
  for (let i = 0; i < parLigne; i++) bords.push(ech[i], ech[ech.length - 1 - i])
  bords.sort((x, y) => x - y)
  const fond = bords[bords.length >> 1]
  const extreme = Math.max(...ech.map((v) => Math.abs(v - fond)))
  const seuil = Math.max(0.1, extreme) / 2
  return ech.map((v) => (Math.abs(v - fond) > seuil ? 1 : 0))
}

const serveur = await servir()
const plaintes = []
/** Ce qui a VRAIMENT été inspecté. Compté, jamais supposé. */
let sitesInspectes = 0
let etatsRendus = 0
const releve = []

try {
  const navigateur = await chromium.launch()
  for (const point of POINTS) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: point.largeur, height: 900 },
      locale: 'fr-FR',
      colorScheme: point.theme,
      deviceScaleFactor: 2,
    })
    await imposerLaPoliceLarge(contexte)
    const page = await contexte.newPage()
    await page.goto(BASE + point.adresse, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(500)

    for (const site of point.sites) {
      const nom = `${point.adresse}@${point.largeur}/${point.theme}/${site}`

      if (SITES[site].mode === 'polaire') {
        /* ─── L'ANNEAU ────────────────────────────────────────────────────
           On lit la géométrie DÉCLARÉE — rayon, épaisseur, part et départ de
           chaque segment — puis on la retrouve dans les pixels. Lire l'une
           sans l'autre serait deux mensonges possibles : une géométrie juste
           qui ne se peint pas, ou des pixels qu'on n'a pas su situer. */
        const anneau = await page.evaluate(() => {
          const svg = document.querySelector('svg:has(circle[data-jauge])')
          if (!svg) return null
          svg.scrollIntoView({ block: 'center', inline: 'center' })
          const r = svg.getBoundingClientRect()
          const parts = {}
          for (const c of svg.querySelectorAll('circle[data-jauge]')) {
            const R = Number(c.getAttribute('r'))
            const circ = 2 * Math.PI * R
            const dash = Number.parseFloat(c.getAttribute('stroke-dasharray').split(' ')[0])
            const off = -Number.parseFloat(c.getAttribute('stroke-dashoffset'))
            ;(parts[c.dataset.jauge] ??= []).push({
              R,
              sw: Number(c.getAttribute('stroke-width')),
              fraction: dash / circ,
              debut: off / circ,
            })
          }
          return { x: r.x, y: r.y, taille: r.width, vb: svg.viewBox.baseVal.width, parts }
        })

        if (!anneau) {
          plaintes.push(`${nom} : aucun anneau portant \`data-jauge\` sur cet écran.`)
          continue
        }
        const absents = ETATS.filter((e) => !anneau.parts[e])
        if (absents.length > 0) {
          plaintes.push(
            `${nom} : ${absents.length} part(s) introuvable(s) — ${absents.join(', ')}.\n` +
              "   Une part qu'on ne rend pas est une part dont la distinction n'est pas prouvée.",
          )
          continue
        }

        const MARGE = 4
        const buf = await page.screenshot({
          clip: {
            x: anneau.x - MARGE,
            y: anneau.y - MARGE,
            width: anneau.taille + 2 * MARGE,
            height: anneau.taille + 2 * MARGE,
          },
          scale: 'device',
        })
        const png = lirePNG(buf)
        const echelle = png.largeur / (anneau.taille + 2 * MARGE)
        const unite = anneau.taille / anneau.vb // px CSS par unité de boîte de vue
        const centre = { x: MARGE + anneau.taille / 2, y: MARGE + anneau.taille / 2 }

        /* PRÉCONDITIONS, ET ELLES REFUSENT PLUTÔT QUE DE MESURER MAL.
           Une fenêtre qui déborde de la capture, ou qui est plus large que la
           part qu'elle échantillonne, rend un nombre — et ce nombre parle des
           voisines ou du vide. Mieux vaut un refus lisible. */
        const grilles = {}
        let refuse = false
        for (const etat of ETATS) {
          const segs = anneau.parts[etat]
          const rMed = (Math.min(...segs.map((g) => g.R - g.sw / 2)) +
            Math.max(...segs.map((g) => g.R + g.sw / 2))) / 2 * unite
          const longueur = segs[0].fraction * 2 * Math.PI * rMed
          if (longueur < 2 * DEMI_S) {
            plaintes.push(
              `${nom} : la part « ${etat} » ne fait que ${longueur.toFixed(1)} px d'arc, ` +
                `moins que les ${2 * DEMI_S} px de la fenêtre.\n` +
                '   La mesure lirait ses voisines. La garde refuse plutôt que de rendre un chiffre faux.',
            )
            refuse = true
            break
          }
          if (rMed + DEMI_R > anneau.taille / 2 + MARGE) {
            plaintes.push(`${nom} : la fenêtre déborde de la capture (rayon ${rMed.toFixed(1)} px).`)
            refuse = true
            break
          }
          const angle = (segs[0].debut + segs[0].fraction / 2) * 360
          grilles[etat] = grillePolaire(png, echelle, centre, angle, rMed)
          etatsRendus++
        }
        if (refuse) continue

        const mesures = [
          ['paid', 'partial'],
          ['partial', 'overdue'],
          ['paid', 'overdue'],
        ].map(([a, b]) => {
          const part = ecart(grilles[a], grilles[b])
          return { a, b, part, surface: part === null ? null : (part / 100) * AIRE_POLAIRE }
        })
        sitesInspectes++
        releve.push({ nom, mode: 'profil', boite: `${2 * DEMI_R}×${2 * DEMI_S}`, mesures })

        for (const m of mesures) {
          if (m.surface < SEUIL_SURFACE) {
            plaintes.push(
              `${nom} : les parts « ${m.a} » et « ${m.b} » ont le MÊME PROFIL RADIAL à ` +
                `${m.surface.toFixed(1)} px² près (sur ${AIRE_POLAIRE} px² de fenêtre, soit ${m.part.toFixed(1)} %).\n` +
                `   Seuil : ${SEUIL_SURFACE} px². En dessous, seule la couleur sépare ces deux parts —\n` +
                '   et elle ne sépare rien pour un lecteur deutéranope.',
            )
          }
        }
        continue
      }

      /* Un représentant VISIBLE par état, AMENÉ SOUS LES YEUX.
         « Présent dans le DOM » ne suffit pas : une colonne masquée rend une
         boîte de 0 px, dont la silhouette est vide — et deux silhouettes vides
         se ressemblent parfaitement. Hors champ ne suffit pas non plus : une
         capture ne montre que la fenêtre, et la grille défile dans sa propre
         boîte. On amène donc chaque état au centre AVANT de lire sa boîte, un
         état à la fois — un défilement déplace les rectangles des autres. */
      const viser = (etat) =>
        page.evaluate(
          ({ site, etat }) => {
            const e = [...document.querySelectorAll(`[data-jauge="${etat}"]`)].find((n) => {
              /* Les parts de l'anneau portent le même attribut et se mesurent
                 autrement : un `<circle>` n'a pas de boîte à comparer. */
              if (n.ownerSVGElement) return false
              const dansGrille = !!n.closest('table')
              return (site === 'grille') === dansGrille && n.getBoundingClientRect().width > 0
            })
            if (!e) return null
            e.scrollIntoView({ block: 'center', inline: 'center' })

            /*
              CALAGE SUR LA GRILLE DE PIXELS, et sans lui la garde mesure du bruit.

              Chaque état vit à une abscisse fractionnaire différente — la légende
              les pose à la suite d'un texte de largeur quelconque. Deux disques
              GÉOMÉTRIQUEMENT IDENTIQUES posés à un demi-pixel l'un de l'autre ne
              partagent pas leur bord antialiasé : mesuré, cela produisait 11 à
              17 % d'écart de silhouette pour deux formes rigoureusement égales,
              soit un plancher de bruit au-dessus du seuil de refus. La garde
              aurait déclaré « formes distinctes » sur deux disques identiques.

              On décale donc chaque élément de la partie fractionnaire de sa
              position avant de le capturer. Le produit n'est pas touché : le
              décalage vit le temps d'une capture et vaut moins d'un pixel.
            */
            const av = e.getBoundingClientRect()
            e.style.transform = `translate(${Math.round(av.x) - av.x}px, ${Math.round(av.y) - av.y}px)`
            const r = e.getBoundingClientRect()
            return { x: Math.round(r.x), y: Math.round(r.y), w: r.width, h: r.height }
          },
          { site, etat },
        )

      const boites = {}
      for (const etat of ETATS) {
        const b = await viser(etat)
        if (b) boites[etat] = b
      }

      const manquants = ETATS.filter((e) => !boites[e])
      if (manquants.length > 0) {
        plaintes.push(
          `${nom} : ${manquants.length} état(s) introuvable(s) — ${manquants.join(', ')}.\n` +
            "   Un état qu'on ne rend pas est un état dont la distinction n'est pas prouvée.",
        )
        continue
      }

      const MARGE = 2
      const masques = {}
      let boite = null
      for (const etat of ETATS) {
        /* Re-visé juste avant la capture : la boîte lue au tour précédent a pu
           bouger sous le défilement d'un autre état. */
        const b = (await viser(etat)) ?? boites[etat]
        boite = b
        const buf = await page.screenshot({
          clip: { x: b.x - MARGE, y: b.y - MARGE, width: b.w + 2 * MARGE, height: b.h + 2 * MARGE },
          scale: 'device',
        })
        masques[etat] = silhouette(lirePNG(buf), MARGE, 2)
        etatsRendus++
      }

      const paires = [
        ['paid', 'partial'],
        ['partial', 'overdue'],
        ['paid', 'overdue'],
      ]
      const mesures = paires.map(([a, b]) => {
        const part = ecart(masques[a], masques[b])
        return { a, b, part, surface: part === null ? null : (part / 100) * boite.w * boite.h }
      })
      sitesInspectes++
      releve.push({ nom, mode: 'boîte', boite: `${boite.w}×${boite.h}`, mesures })

      for (const m of mesures) {
        if (m.part === null) {
          plaintes.push(`${nom} : ${m.a} et ${m.b} n'ont pas la même boîte — comparaison impossible.`)
          continue
        }
        if (m.surface < SEUIL_SURFACE) {
          plaintes.push(
            `${nom} : « ${m.a} » et « ${m.b} » ont la MÊME FORME à ${m.surface.toFixed(1)} px² près ` +
              `(sur une boîte de ${boite.w}×${boite.h}, soit ${m.part.toFixed(1)} %).\n` +
              `   Seuil : ${SEUIL_SURFACE} px². En dessous, seule la couleur sépare ces deux états —\n` +
              '   et elle ne sépare rien pour un lecteur deutéranope.',
          )
        }
      }
    }
    await contexte.close()
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

/* ─── LA GARDE DU GARDE ───────────────────────────────────────────────────
   Une inspection vide n'est pas une absence de défaut : c'est une absence
   d'inspection, et les deux s'écrivent pareil dans un journal si on ne les
   sépare pas ici. Ce bloc REFUSE, il ne se contente jamais d'un avertissement. */
if (sitesInspectes === 0) {
  plaintes.push(
    'AUCUN site inspecté. Ce n\'est pas une absence de défaut, c\'est une absence\n' +
      "   d'inspection — et les deux s'écrivent pareil dans un journal si on ne les sépare\n" +
      '   pas ici. La garde refuse plutôt que de se déclarer verte sur du vide.',
  )
}
if (sitesInspectes !== ATTENDUS) {
  plaintes.push(
    `${sitesInspectes} site(s) inspecté(s) pour ${ATTENDUS} attendu(s).\n` +
      "   La garde n'a pas regardé ce qu'elle prétend garder. Un attribut `data-jauge` retiré,\n" +
      '   un écran déplacé, un sélecteur périmé : dans les trois cas le refus est le bon geste.',
  )
}
if (etatsRendus !== ATTENDUS * ETATS.length) {
  plaintes.push(
    `${etatsRendus} état(s) rendu(s) pour ${ATTENDUS * ETATS.length} attendu(s) ` +
      `(${ATTENDUS} sites × ${ETATS.length} états).`,
  )
}

for (const r of releve) {
  const pire = Math.min(...r.mesures.map((m) => m.part ?? 0))
  console.log(
    `  ${r.nom.padEnd(44)} ${r.mode} ${r.boite.padEnd(7)} ` +
      r.mesures.map((m) => `${m.a[0]}/${m.b[0]} ${(m.part ?? 0).toFixed(1).padStart(5)} %`).join('  ') +
      `   pire ${pire.toFixed(1)} %`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ couleur-non-seule : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  exit(1)
}

console.log(
  `\n✓ couleur-non-seule : ${sitesInspectes}/${ATTENDUS} sites inspectés, ` +
    `${etatsRendus} états rendus et comparés deux à deux.\n` +
    "  Ce script ne découvre AUCUN site : il ne voit que `data-jauge` — voir son en-tête.",
)
