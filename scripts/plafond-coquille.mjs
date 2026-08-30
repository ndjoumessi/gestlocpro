#!/usr/bin/env node
/**
 * LA COQUILLE NE REGROSSIT PAS.
 *
 * LE DÉFAUT, ET SA MESURE. Avant ce lot, 325 px séparaient le haut de l'écran
 * du premier pixel de contenu, à 360 px de large : un en-tête de 185 px dont
 * les trois sélecteurs se repliaient sur trois lignes, plus un bandeau de
 * démonstration de 140 px, répétés sur les 23 écrans. Sur un téléphone de
 * 780 px de haut, c'est 42 % de la fenêtre occupée avant le premier mot.
 *
 * CE QUE CE SCRIPT MESURE. La distance entre le haut du document et le haut de
 * `<main>` — donc tout ce que la coquille empile avant de céder la place. Il ne
 * mesure ni la beauté de cet en-tête, ni le bien-fondé de ce qu'il contient : il
 * mesure une hauteur, et il refuse quand elle remonte. Une garde qui
 * prétendrait juger d'une mise en page serait une décoration.
 *
 * LES PLAFONDS SONT ÉCRITS, ET NON RELEVÉS À L'EXÉCUTION. Un plafond qui
 * s'inscrit tout seul au poids du jour ne garde rien : il entérine. Ils sont
 * donc en dur ci-dessous, avec la valeur d'avant à côté — la marge est
 * lisible dans le diff, et la faire monter demande d'écrire pourquoi.
 *
 * CE QU'IL REGARDE, ET CE QU'IL NE REGARDE PAS — écrit parce qu'il a d'abord
 * regardé cinq points sur deux cent cinquante-trois, sans le dire.
 *
 * IL REGARDE les 23 écrans déduits du routeur, à TROIS largeurs : 320, la plus
 * étroite du marché visé ; 360, l'appareil de référence ; 1280, le poste de
 * bureau. Soixante-neuf points.
 *
 * IL NE REGARDE PAS les huit autres largeurs de `mesure-ui`. Ce n'est pas un
 * oubli : la hauteur de coquille ne change qu'aux points de rupture, et les
 * trois familles de coquille du produit — applicative, publique,
 * authentification — les franchissent toutes entre 320 et 1280. Une quatrième
 * largeur mesurerait la même chose une quatrième fois. Si un jour une coquille
 * se replie à 700 px, ce script ne le verra pas, et c'est écrit ici.
 *
 * IL NE REGARDE PAS non plus ce que cette hauteur CONTIENT. Remplacez l'en-tête
 * par une bande vide de même hauteur et il reste vert. Il garde un nombre.
 *
 *   node scripts/plafond-coquille.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici, et ce script n'en a aucun besoin.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { exit } from 'node:process'
import { inventaireDesRoutes, exigerUnInventairePlein } from './inventaire/routes.mjs'
import { POLICE_LARGE, imposerLaPoliceLarge } from './police-large.mjs'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * CE QU'ON RELÈVE QUAND LA PORTE REFUSE — parce qu'un nombre nu ne s'explique
 * pas, et qu'un rouge rare ne se rejoue pas sur commande.
 *
 * ═══ POURQUOI CECI EXISTE ═══
 *
 * Trois fois en deux lots, cette garde a rendu 128 px là où elle rend 122 au
 * passage suivant. La première fois, on a diagnostiqué la POLICE — « six pixels,
 * l'écart entre la boîte de ligne d'un titre dans la police de repli et la même
 * dans la police chargée » — et l'on a ajouté l'attente de `document.fonts`.
 *
 * CE DIAGNOSTIC EST DÉMENTI. Mesuré le 2026-08-30, à 1280 px sur
 * `/demo/portail` et `/demo/cautions` : la fonte ENTIÈREMENT bloquée, la
 * coquille rend 122 px. Ces écrans ne dépendent pas de la police à cette
 * largeur. L'attente ajoutée alors ne corrigeait donc probablement rien ; le
 * rouge n'est simplement pas revenu.
 *
 * Cent cinquante mesures contrôlées n'ont pas rejoué le 128 : ni fonte bloquée,
 * ni bridage du processeur jusqu'à trente fois, ni largeurs de 1240 à 1280, ni
 * police large, ni la séquence complète des vingt-quatre adresses répétée quatre
 * fois dans une seule page, comme la porte la parcourt.
 *
 * ═══ CE QU'ON FAIT DE CETTE IGNORANCE ═══
 *
 * On cesse de deviner. La cause est INCONNUE, et une seconde hypothèse écrite
 * dans un commentaire aurait exactement la valeur de la première — c'est-à-dire
 * celle d'un rouge qu'on ne peut plus lire.
 *
 * À la place, le prochain refus PORTE SON DOSSIER : la composition de la
 * coquille pièce par pièce, la police réellement rendue, l'état de `fonts`, la
 * position de défilement, et une capture déposée dans `captures/` — que le
 * workflow téléverse déjà en cas d'échec. La prochaine fois, on lira ce qui
 * s'est passé au lieu de le supposer.
 *
 * Ce relevé ne coûte rien tant que la porte est verte : il n'est fait QUE sur
 * refus.
 */
async function releverLaCoquille(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    const haut = main ? main.getBoundingClientRect().top + window.scrollY : null
    /* Les frères de `<main>` : ce sont eux qui empilent la hauteur mesurée. */
    const pieces = []
    for (let n = main?.parentElement?.firstElementChild; n && n !== main; n = n.nextElementSibling) {
      const b = n.getBoundingClientRect()
      pieces.push({
        balise: n.tagName.toLowerCase(),
        classe: (n.className || '').toString().slice(0, 60),
        hauteur: Math.round(b.height),
        position: getComputedStyle(n).position,
      })
    }
    const titre = document.querySelector('h1, h2')
    return {
      haut: haut === null ? null : Math.round(haut),
      defilement: Math.round(window.scrollY),
      pieces,
      police: titre ? getComputedStyle(titre).fontFamily.slice(0, 60) : null,
      corps: titre ? getComputedStyle(titre).fontSize : null,
      interligne: titre ? getComputedStyle(titre).lineHeight : null,
      fontes: document.fonts.status,
      /* Chargées SUR QUATRE déclarées : `status === 'loaded'` dit qu'aucun
         chargement n'est en cours, pas que toutes les fontes sont là. La
         distinction est mesurée — au vert, une seule des quatre l'est. */
      fontesChargees: [...document.fonts].filter((f) => f.status === 'loaded').length,
      fontesDeclarees: document.fonts.size,
      largeurVue: window.innerWidth,
      largeurDocument: document.documentElement.clientWidth,
    }
  })
}

/**
 * La capture du refus — dans un SOUS-RÉPERTOIRE, et ce détail n'en est pas un.
 *
 * `captures/` est ce que le workflow téléverse `if: always()`, donc la seule
 * sortie regardable d'un échec survenu sur une machine qui n'existe plus quand
 * on lit le journal. C'est aussi le répertoire que `poids-ecrans` PURGE au
 * démarrage : il efface tout `.png` qui ne porte pas l'estampille de sa course.
 * Une preuve déposée à la racine y passerait — vérifié dans son code, pas
 * supposé.
 *
 * `readdirSync` ne descend pas dans les sous-répertoires, et son filtre exige
 * `.png` : `captures/coquille/` est donc hors de portée de la purge, tandis que
 * le téléversement, lui, prend l'arborescence entière.
 */
async function consignerLaCapture(page, nom) {
  const fichier = join(RACINE, 'captures', 'coquille', `${nom.replace(/[^\w@-]+/g, '_')}.png`)
  await mkdir(dirname(fichier), { recursive: true }).catch(() => {})
  await page.screenshot({ path: fichier, fullPage: false }).catch(() => {})
  return fichier
}

/** Les refus, avec leur dossier — imprimés à la fin plutôt qu'au fil. */
const instables = []
const PORT = 4191
const BASE = `http://127.0.0.1:${PORT}`

/**
 * LES PLAFONDS, ÉCRAN PAR ÉCRAN ET LARGEUR PAR LARGEUR.
 *
 * `avant` n'est pas décoratif : c'est la mesure d'avant le lot, gardée à côté
 * du plafond pour que le relecteur voie ce que le plafond concède. Un plafond
 * seul est un nombre ; un plafond avec l'avant est une décision.
 *
 * La marge au-dessus du mesuré est de dix pixels, pas de cent : une refonte
 * qui coûte un demi-bouton doit rougir, sinon le plafond n'est qu'un souvenir.
 */
/**
 * LES PLAFONDS, PAR FAMILLE DE COQUILLE ET PAR LARGEUR.
 *
 * TROIS FAMILLES, parce qu'il y en a trois et pas vingt-trois : l'applicative
 * (barre + bandeau + barre basse), la publique (un en-tête seul), celle de
 * l'authentification (une colonne centrée sous un en-tête haut). Les 23 écrans
 * s'y rangent, et un plafond par écran serait vingt-trois fois le même nombre.
 *
 * LE PLAFOND EST LE MESURÉ, SANS MARGE — et c'est le second correctif de ce
 * fichier. La première rédaction autorisait 132 px pour un mesuré de 122 : dix
 * pixels que personne n'avait justifiés, donc dix pixels qu'une refonte
 * distraite pouvait dépenser sans que rien ne le dise. Un plafond au mesuré
 * fait rougir au premier pixel, et le faire monter demande d'écrire ici la
 * valeur d'avant et ce qu'elle achète — comme le fait `poids-ecrans` pour les
 * octets.
 *
 * `avant` garde la mesure d'avant la refonte : un plafond seul est un nombre,
 * un plafond avec l'avant est une décision.
 */
const FAMILLES = {
  applicative: {
    /* 320 : la mention de démonstration passe à deux lignes, +21 px. C'est le
       prix d'une phrase courte QUI NOMME ce qui est fictif, plutôt qu'une
       « Données fictives. » qui tient sur une ligne et n'apprend rien. */
    320: { plafond: 143, plafondLarge: 165, avant: 325 },
    360: { plafond: 122, plafondLarge: 143, avant: 325 },
    1280: { plafond: 122, plafondLarge: 122, avant: 136 },
  },
  publique: {
    320: { plafond: 69, plafondLarge: 69, avant: 69 },
    360: { plafond: 69, plafondLarge: 69, avant: 69 },
    1280: { plafond: 69, plafondLarge: 69, avant: 69 },
  },
  /* QUATRIÈME FAMILLE, TROUVÉE EN ÉLARGISSANT — et c'est ce que l'élargissement
     valait. L'écran introuvable porte son propre en-tête, plus haut que celui
     de la vitrine : 193 px à 320 et 360, 75 px à 1280. Les cinq points de la
     première rédaction ne le voyaient pas, et il aurait passé pour « publique »
     s'il avait été rangé au jugé. Valeurs entérinées, non bénies : cet écran
     n'a pas été refondu. */
  introuvable: {
    320: { plafond: 193, plafondLarge: 69, avant: 193 },
    360: { plafond: 193, plafondLarge: 69, avant: 193 },
    1280: { plafond: 75, plafondLarge: 69, avant: 75 },
  },
  /* Non touchée par la refonte : la valeur est celle d'avant, et le plafond
     l'entérine sans la bénir. C'est le prochain lot qui aura à la défendre. */
  authentification: {
    320: { plafond: 288, plafondLarge: 168, avant: 288 },
    360: { plafond: 288, plafondLarge: 168, avant: 288 },
    1280: { plafond: 82, plafondLarge: 76, avant: 82 },
  },
}

/**
 * UN PLAFOND, DEUX POLICES — et deux nombres plutot qu'un compromis.
 *
 * `--font-sans` commence par `system-ui`, qui designe un dessin DIFFERENT par
 * systeme : « Creer mon espace » rend 132,61 px sur macOS et 146,14 px sur
 * l'executeur Ubuntu, ou il vaut DejaVu Sans. La coquille applicative grandit de
 * 21 px a 360 px sous la police large — non parce qu'une rangee de commandes se
 * replie, mais parce que la DESCRIPTION de page passe de deux lignes a trois.
 * Du texte qui est du texte : un cout, pas un defaut.
 *
 * TROIS ISSUES ETAIENT POSSIBLES, ET DEUX ETAIENT MAUVAISES. Relever le plafond
 * unique a 143 aurait donne 21 px de mou a la mesure locale, qui aurait cesse de
 * voir une vraie regression — le « plafond menteur » que ce depot refuse
 * ailleurs. Rogner la description a deux lignes aurait cache du texte a qui a
 * une police large, c'est-a-dire au marche vise.
 *
 * On garde donc LES DEUX MESURES VRAIES. Sans commutateur, le plafond est celui
 * de cette machine, serre. Avec `MESURER_EN_POLICE_LARGE=1`, c'est celui de la
 * police large — et c'est ce mode que l'integration continue emploie, pour que
 * les deux machines comparent la meme chose au meme nombre.
 *
 * LES DEUX SONT MESURES, SANS MARGE, comme le plafond simple l'etait deja.
 * `plafondLarge` est parfois PLUS BAS que `plafond` : l'ecran introuvable et
 * l'authentification portent des plafonds herites d'avant la refonte, non
 * remesures depuis ; sous police large ils ont ete releves pour de bon.
 */
function plafondDe(p) {
  if (!POLICE_LARGE) return p.plafond
  if (typeof p.plafondLarge !== 'number') {
    throw new Error(
      'plafond-coquille : une entree de FAMILLES n\'a pas de `plafondLarge`.\n' +
        '  Chaque plafond a deux valeurs depuis que les deux polices sont mesurees ;\n' +
        '  une entree qui n\'en porte qu\'une passerait au vert sans etre gardee.',
    )
  }
  return p.plafondLarge
}

/** À quelle famille appartient une adresse. Déduit, jamais recopié. */
function familleDe(adresse) {
  if (adresse === ADRESSE_404) return 'introuvable'
  if (adresse.startsWith('/app') || adresse.startsWith('/demo')) return 'applicative'
  if (['/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser'].includes(adresse))
    return 'authentification'
  return 'publique'
}

const LARGEURS = [320, 360, 1280]

/**
 * Les adresses qui ne rendent PAS d'écran, et pourquoi.
 *
 * `/app` redirige vers le tableau de bord du rôle : il n'a ni contenu ni
 * `<main>`, et lui demander une hauteur de coquille n'aurait pas de sens.
 * Écrite ici plutôt que devinée par l'absence de `<main>` — sans quoi un écran
 * réel qui perdrait son `<main>` par accident se sauterait tout seul.
 */
const SANS_ECRAN = ['/app']
/** L'adresse que `routes.mjs` emploie pour visiter l'écran introuvable. */
const ADRESSE_404 = '/adresse-qui-n-existe-pas'
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UN PRODUIT CALCULÉ.

  Le dériver de la liste surveillée — `ADRESSES.length * LARGEURS.length` —
  rendrait la garde d'accord avec elle-même : vider l'inventaire, et
  l'inspection comparerait 0 à 0 puis se déclarerait verte. La même mutation a
  trouvé ce piège trois lots de suite. Ajouter un écran ou une largeur oblige
  donc à toucher ce nombre, et le diff le montre.

  69 = (24 écrans déduits du routeur − 1 sans écran) × 3 largeurs.
  3  = la route `/app`, redirection sans `<main>`, à ses trois largeurs.

  Passé de 66 à 69 avec le registre des décisions. Ce nombre doit être touché à
  la main, et c'est le but : le diff montre alors qu'un écran est apparu, là où
  un compte dérivé de l'inventaire se serait mis d'accord avec lui-même.
*/
const ATTENDUS = 69
const SAUTEES_ATTENDUES = 3

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
  throw new Error('plafond-coquille : le serveur de prévisualisation n’a pas répondu.')
}

const routes = inventaireDesRoutes()
exigerUnInventairePlein(routes)
const ADRESSES = routes.map((r) => r.adresse)

const serveur = await servir()
const plaintes = []
const releve = []
let inspectes = 0
/** Les routes déclarées sans écran, comptées pour que leur nombre soit gardé. */
let sautees = 0
/** Les points mesurés avant que les polices soient prêtes — voir plus bas. */
const policesEnRetard = []

try {
  const navigateur = await chromium.launch()
  for (const largeur of LARGEURS) {
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: largeur, height: 900 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    await imposerLaPoliceLarge(contexte)
    const page = await contexte.newPage()
    for (const adresse of ADRESSES) {
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      /*
        ON ATTEND LES POLICES — MAIS PLUS POUR LA RAISON QU'ON CROYAIT.

        CE QUE CE COMMENTAIRE AFFIRMAIT, ET QUI EST DÉMENTI. Il disait que les
        128 px rendus sur `/demo/cautions@1280` et `/demo/locataires@1280`
        valaient « six pixels, soit l'écart entre la boîte de ligne d'un titre
        rendu dans la police de repli et la même dans la police chargée ».

        Mesuré le 2026-08-30, la fonte ENTIÈREMENT BLOQUÉE par `page.route` : la
        coquille rend 122 px à 1280. Ces écrans ne dépendent PAS de la police à
        cette largeur. L'attente ajoutée alors ne corrigeait donc probablement
        rien ; le rouge n'est simplement pas revenu, et on a pris l'absence pour
        une guérison.

        ELLE RESTE, et pour deux raisons qui tiennent : à 320 et 360 px la
        coquille applicative DÉPEND bel et bien de la police — 143 contre 165 en
        police large, mesuré — et `networkidle` ne dit que le silence du réseau,
        pas que les boîtes sont refaites. Une attente juste dont la
        justification était fausse se garde ; c'est la justification qu'on
        remplace.

        LA CAUSE DU 128 PX EST INCONNUE. Cent cinquante mesures contrôlées ne
        l'ont pas rejouée : ni fonte bloquée, ni bridage du processeur jusqu'à
        trente fois, ni largeurs de 1240 à 1280, ni police large, ni la séquence
        complète des vingt-quatre adresses répétée quatre fois dans une seule
        page. On cesse donc de deviner : le refus PORTE SON DOSSIER — voir
        `releverLaCoquille` — et la prochaine occurrence s'expliquera au lieu
        d'être supposée.

        UNE GARDE QUI ROUGIT POUR UNE RAISON QUI N'EST PAS DANS LE CODE est pire
        qu'une garde absente : elle apprend à relancer jusqu'au vert, et le jour
        où le rouge est vrai, il est relancé aussi. L'échec de l'attente est donc
        COMPTÉ et dit à la fin, plutôt qu'avalé.
      */
      await page
        .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
        .catch(() => policesEnRetard.push(`${adresse}@${largeur}`))
      await page.waitForTimeout(300)

      const h = await page.evaluate(() => {
        const main = document.querySelector('main')
        if (!main) return null
        return Math.round(main.getBoundingClientRect().top + window.scrollY)
      })

      const nom = `${adresse}@${largeur}`
      /*
        LES ROUTES SANS ÉCRAN, DÉCLARÉES ET COMPTÉES À PART.

        `/app` ne rend pas un écran : il redirige vers le tableau de bord selon
        le rôle. Il n'a donc pas de `<main>`, et exiger une hauteur de coquille
        d'une redirection n'a pas de sens. La liste est ÉCRITE et son compte
        entre dans `ATTENDUS` : une route qui perdrait son `<main>` sans être
        ici fait toujours rougir, et une route qui redeviendrait un écran ferait
        chuter le compte des sautées.
      */
      if (SANS_ECRAN.includes(adresse)) {
        if (h !== null) {
          plaintes.push(
            `${nom} : déclarée sans écran, mais elle rend un <main>.\n` +
              "   La déclaration est périmée : retirez-la, l'écran veut un plafond.",
          )
        }
        sautees++
        continue
      }
      if (h === null) {
        plaintes.push(
          `${nom} : pas de <main> sur cet écran.\n` +
            "   La hauteur de coquille se mesure contre lui ; sans lui il n'y a pas de mesure,\n" +
            '   et une absence de mesure ne doit jamais s’écrire comme une absence de défaut.',
        )
        continue
      }
      const famille = familleDe(adresse)
      const p = FAMILLES[famille][largeur]
      inspectes++
      /* Le releve porte le plafond EFFECTIF, celui contre lequel la comparaison
         vient d'etre faite — sans quoi le rapport imprimerait le plafond serre
         a cote d'une hauteur mesuree en police large, et se contredirait. */
      releve.push({ nom, h, famille, ...p, plafond: plafondDe(p) })
      const plafond = plafondDe(p)
      if (h > plafond) {
        /*
          ON REMESURE, ET LES DEUX LECTURES SONT DITES — SANS QUE LA SECONDE
          SAUVE LA PREMIÈRE.

          Cette garde a rendu 128 px là où elle rend 122 au passage suivant,
          trois fois en deux lots, sans qu'une ligne de source ait bougé. La
          seconde lecture ne lève donc PAS la plainte : refuser sur la meilleure
          des deux serait apprendre à relancer jusqu'au vert, ce que l'en-tête
          de cette garde nomme déjà comme le pire état.

          Elle sert à DIRE LAQUELLE des deux pannes on regarde. « 128 puis 128 »
          est une régression de mise en page : le code a grandi. « 128 puis
          122 » est une instabilité de la mesure : la porte se trompe, et c'est
          elle qu'il faut réparer. Sans ces deux nombres côte à côte, les deux
          se lisent pareil, et l'on répare la mauvaise.
        */
        await page.waitForTimeout(1200)
        const encore = await page.evaluate(() => {
          const main = document.querySelector('main')
          return main ? Math.round(main.getBoundingClientRect().top + window.scrollY) : null
        })
        const dossier = await releverLaCoquille(page)
        await consignerLaCapture(page, nom)
        instables.push({ nom, h, encore, plafond, dossier })
        plaintes.push(
          `${nom} (${famille}) : ${h} px de coquille avant le contenu, pour un plafond de ${plafond}.\n` +
            `   Avant la refonte : ${p.avant} px. Ce qui remonte ici est repris sur le contenu,\n` +
            '   sur tous les écrans de cette famille à la fois.\n' +
            `   SECONDE LECTURE, 1,2 s plus tard : ${encore} px — ` +
            (encore === h
              ? 'la même. La hauteur est STABLE, donc le code a grandi.'
              : "DIFFÉRENTE. La mesure est INSTABLE : c'est la porte qu'il faut réparer,\n" +
                '   pas la mise en page. Le dossier ci-dessous dit avec quoi.'),
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

/* Le relevé est résumé PAR FAMILLE : soixante-neuf lignes noieraient le seul
   nombre qui compte, qui est le pire de chaque famille. */
const parFamille = {}
for (const r of releve) {
  const cle = `${r.famille}@${r.nom.split('@')[1]}`
  if (!parFamille[cle] || r.h > parFamille[cle].h) parFamille[cle] = r
}
for (const [cle, r] of Object.entries(parFamille)) {
  console.log(
    `  ${cle.padEnd(26)} pire ${String(r.h).padStart(4)} px  (plafond ${String(r.plafond).padStart(4)} · ` +
      `avant la refonte ${String(r.avant).padStart(4)} · ` +
      `${r.avant > r.h ? `−${r.avant - r.h}` : `+${r.h - r.avant}`} px)   ${r.nom}`,
  )
}

if (plaintes.length > 0) {
  console.error(`\n✗ plafond-coquille : ${plaintes.length} plainte(s).\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')

  /* LE DOSSIER, pour que ce refus-ci n'ait pas à être rejoué pour être compris.
     La cause du 128 px est inconnue — voir `releverLaCoquille`. Ces lignes
     existent pour qu'elle cesse de l'être à la prochaine occurrence, sur une
     machine qui n'existera plus quand on lira le journal. */
  for (const { nom, h, encore, plafond, dossier } of instables) {
    console.error(`  ── DOSSIER ${nom} : ${h} px puis ${encore} px, plafond ${plafond} ──`)
    console.error(
      `     vue ${dossier.largeurVue} px · document ${dossier.largeurDocument} px · ` +
        `défilement ${dossier.defilement} px`,
    )
    console.error(
      `     fontes ${dossier.fontes} · ${dossier.fontesChargees}/${dossier.fontesDeclarees} chargées`,
    )
    console.error(`     titre : ${dossier.police} · ${dossier.corps} / ${dossier.interligne}`)
    console.error(`     la coquille, pièce par pièce (somme = la hauteur mesurée) :`)
    for (const piece of dossier.pieces) {
      console.error(
        `       ${String(piece.hauteur).padStart(4)} px  ${piece.balise} (${piece.position})  ${piece.classe}`,
      )
    }
    console.error(`     capture dans captures/coquille/ — le workflow la téléverse.\n`)
  }
  exit(1)
}

console.log(
  `\n✓ plafond-coquille : ${inspectes}/${ATTENDUS} écrans sous leur plafond de hauteur avant contenu.\n` +
    '  Ce script ne dit RIEN de ce que cette hauteur contient — voir son en-tête.' +
    (policesEnRetard.length > 0
      ? `\n  ⚠ ${policesEnRetard.length} point(s) mesuré(s) SANS que les polices soient prêtes : ` +
        `${policesEnRetard.join(', ')}.\n` +
        '  Les hauteurs de ces points sont celles de la police de repli, et le verdict ne vaut rien.'
      : ''),
)
