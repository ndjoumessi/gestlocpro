/**
 * MESURE AU NAVIGATEUR — ce qu'aucune garde de fichier ne peut voir.
 *
 * Les treize tests de `src/design-system/` lisent des FICHIERS, et chacun le
 * motive de la même façon : jsdom ne calcule ni `clamp()`, ni les couches en
 * cascade, ni `env()`, ni la moindre hauteur. C'est un choix juste, et c'est
 * aussi un plafond. Quatre défauts réels ont vécu sous ce plafond : un fanion
 * qui débordait à 320 px, un lien de 18 × 17 px qui était la seule entrée vers
 * l'écran d'un logement, un correctif qui coûtait 255 px de hauteur de tableau
 * en mobile pendant que son commentaire affirmait que « rien ne bouge », et le
 * débordement latéral que ce script garde aujourd'hui.
 *
 * Ce fichier ouvre donc un VRAI navigateur sur le VRAI paquet construit.
 *
 * SUJET DE CETTE GARDE, et un seul : aucun écran ne défile latéralement,
 * à aucune largeur, dans aucune des deux langues.
 *
 * PIÈGES HONORÉS — chacun a été payé une fois :
 *
 *  1. Le débordement ne se mesure PAS par `documentElement.scrollWidth` : cette
 *     valeur compte la largeur de mise en page des descendants d'un conteneur à
 *     défilement, et signale donc un faux positif sur tout tableau large logé
 *     dans un `overflow-x-auto` — ce que le dépôt fait partout. Le seul critère
 *     fiable est de TENTER `window.scrollTo(400, 0)` et de vérifier que
 *     `window.scrollX` est resté à 0.
 *
 *  2. On attend la disparition d'`aria-busy`, JAMAIS un délai fixe. Un délai
 *     mesure les squelettes de chargement : un premier balayage l'a fait, a
 *     rendu « aucun défaut », et le second — en attendant la donnée — a trouvé
 *     159 formes dont le lien de 18 × 17 px.
 *
 *  3. Les deux langues, parce que le défaut fondateur de cette garde
 *     n'existait qu'en anglais : « Record a payment » est plus large que
 *     « Encaisser un paiement » ne l'est en hauteur de rangée.
 *
 *  4. On redimensionne au lieu de recharger : vingt chargements au lieu de
 *     deux cent vingt. Après chaque redimensionnement on réattend `aria-busy`,
 *     parce qu'un changement de largeur peut remonter une requête.
 *
 * COMMENT LE LIRE QUAND IL ROUGIT : il nomme l'écran, la largeur, la langue,
 * et les éléments dont le bord droit dépasse la fenêtre SANS qu'aucun ancêtre
 * ne défile — c'est-à-dire les vrais coupables, pas leurs parents.
 *
 * PRÉREQUIS D'INSTALLATION : `npx playwright install chromium` une fois par
 * machine. Le paquet `playwright` n'embarque pas le navigateur.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4183
const BASE = `http://127.0.0.1:${PORT}`

/**
 * Les largeurs mesurées.
 *
 * 320 est le plancher réel du marché visé. 700-900 est la bande qui a livré
 * les deux défauts fondateurs de cette garde, et c'est justement la bande que
 * personne ne regarde : ni téléphone, ni bureau. 1440 est le poste de travail
 * du gestionnaire.
 */
const LARGEURS = [320, 360, 375, 414, 700, 768, 800, 900, 1024, 1280, 1440]

/** `en` d'abord : c'est la langue la plus large, donc celle qui déborde. */
const LANGUES = ['en-US', 'fr-FR']

/**
 * Les adresses sont LUES dans `App.tsx`, jamais recopiées.
 *
 * Une liste recopiée se périme en silence : `appariements.test.ts` a surveillé
 * pendant des lots trois jetons de couleur que le graphe n'employait plus.
 * Ici, un écran neuf est mesuré le jour où sa route est écrite.
 */
function adressesDeLApplication() {
  const source = readFileSync(join(RACINE, 'src/App.tsx'), 'utf8')
  const chemins = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])

  const publiques = chemins.filter((c) => c.startsWith('/') && !c.includes(':') && c !== '*')
  // Les écrans de l'application sont montés sous deux adresses ; `/demo` est
  // celle qui sert un parc complet sans authentification, donc la seule
  // mesurable ici. `index` n'apparaît pas comme `path` : c'est `/demo` nu.
  const internes = chemins
    .filter((c) => !c.startsWith('/') && !c.includes(':') && c !== '*')
    .map((c) => `/demo/${c}`)

  /*
    `KitchenSink` est écarté, et le dépôt a déjà rendu cet arbitrage.

    `scripts/check-i18n.mjs` l'exempte nommément — « ses libellés décrivent les
    composants eux-mêmes et ne sont pas du produit ». Le même raisonnement vaut
    ici : une page qui aligne tous les composants côte à côte n'a pas de mise en
    page à défendre, et personne ne l'ouvre. Elle déborde à toutes les largeurs,
    ce qui n'apprend rien, et le seul fait de dresser la liste de ses coupables
    coûtait six minutes sur les huit du balayage — pour garder ce que nul
    n'utilise.

    Une exclusion, pas une tolérance : `TOLERES` couvre un débordement de
    PRODUIT qu'on assume, et il meurt avec lui. Ici l'écran entier sort du
    champ, et c'est autre chose.
  */
  const HORS_PRODUIT = ['/kitchen-sink']

  const adresses = [...new Set([...publiques.filter((c) => c !== '/demo'), '/demo', ...internes])].filter(
    (c) => !HORS_PRODUIT.includes(c),
  )

  // Garde du garde : si la lecture d'`App.tsx` casse, le balayage ne doit pas
  // rendre « aucun défaut » sur une liste vide.
  if (adresses.length < 20) {
    throw new Error(
      `mesure-ui : ${adresses.length} adresses lues dans App.tsx, moins que les 20 attendues. ` +
        `La lecture des routes a cessé de fonctionner — ce n'est pas une absence de défaut.`,
    )
  }
  return adresses
}

/**
 * Débordements TOLÉRÉS, avec leur raison écrite.
 *
 * Sur le modèle des `EXEMPTIONS` de `cibles.test.ts` : une dérogation se nomme,
 * se motive, et meurt avec le défaut qu'elle couvrait — la garde du garde plus
 * bas fait rougir toute entrée devenue orpheline.
 *
 * Clé : `adresse@largeur`, indépendante de la langue — un débordement qui
 * n'existe qu'en anglais reste le même défaut de mise en page.
 *
 * SEPT ENTRÉES, ET C'EST UNE DETTE DATÉE, pas un tapis. Chacune porte sa mesure
 * et le lot qui la lèvera ; la garde du garde plus bas fait rougir celle qui ne
 * couvre plus rien, donc aucune ne peut survivre à sa réparation. Elles sont
 * ici parce qu'une garde hors de `check` ne s'exécute jamais — l'audit en fait
 * la démonstration avec `contrast-audit.js`, qui savait trouver un contraste
 * sous le seuil et ne l'a jamais trouvé faute d'être lancé.
 */
const TOLERES = {
  /*
    LA RANGÉE DE SÉLECTEURS D'`AuthLayout`, quatre écrans pour une seule cause.

    `ml-auto flex items-center gap-2` réclame 338 px dans une fenêtre de 320 :
    langue, devise et thème s'y alignent sans jamais se replier. Mesuré
    `scrollX=38` sur les quatre écrans d'authentification, dans les DEUX langues
    — ce n'est donc pas une affaire de longueur de libellé, c'est la rangée qui
    ne sait pas se couper.
  */
  '/connexion@320': 'Rangée de sélecteurs d’AuthLayout, 338 px dans 320. Lot à venir.',
  '/inscription@320': 'Même rangée d’AuthLayout que /connexion.',
  '/mot-de-passe-oublie@320': 'Même rangée d’AuthLayout que /connexion.',
  '/reinitialiser@320': 'Même rangée d’AuthLayout que /connexion.',

  /*
    LA BARRE DE LA VITRINE AU-DESSUS DE `lg`, ET ELLE EST ANTÉRIEURE À CE LOT.

    À 1024 px, `md` et `lg` sont tous deux actifs : la composition de la barre
    est donc IDENTIQUE avant et après le passage des sélecteurs à `lg:flex`, qui
    n'agit qu'entre 768 et 1023. Mesuré sur la page rendue : logo 146 + navigation
    367 + rangée droite 699 = 1212 px réclamés contre ~976 disponibles.
    `scrollX=275` en français, 165 en anglais — l'écart est celui des libellés.

    La mesure à quatre largeurs de l'audit n'avait jamais échantillonné 1024 :
    c'est ce que onze largeurs achètent.
  */
  '/@1024': 'Barre de la vitrine : 1212 px de contenu pour 976 disponibles. Antérieur à ce lot.',
  '/@1280': 'Même barre, 19 px en français seulement — la marge y est nulle.',

  /*
    LA CARTE D'INTERVENTION, et c'est le même défaut que celui-ci corrige.

    `flex shrink-0 flex-wrap items-center gap-3` : `shrink-0` interdit au bloc de
    descendre sous sa largeur `max-content`, donc le repli que `flex-wrap`
    déclare vouloir n'arrive jamais. Exactement ce que `PageHeader` vient de
    perdre — la paire avait essaimé.
  */
  '/demo/travaux@700': 'shrink-0 contre flex-wrap dans la carte d’intervention. Lot à venir.',
}

/**
 * Les attentes, et ce qu'elles coûtent quand elles échouent.
 *
 * Chaque `.catch(() => {})` avale un dépassement de délai : c'est voulu — un
 * écran qui ne se stabilise pas doit être MESURÉ tel quel, pas faire échouer le
 * balayage. Mais avalé en silence, un dépassement de quinze secondes se paie
 * douze fois par langue sur le même écran, et le balayage entier passe de
 * quelques minutes à une demi-heure sans qu'on sache pourquoi.
 *
 * On compte donc les dépassements et on les rend à la fin. Un écran dont
 * l'`aria-busy` ne s'éteint jamais est d'ailleurs un DÉFAUT en soi, que ce
 * compteur nomme au lieu de le laisser peser sur l'horloge.
 */
const lenteurs = new Map()

const attendre = async (page, ou) => {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => marquer(ou, 'réseau'))
  // `waitForFunction(fonction, ARGUMENT, options)` : le deuxième paramètre est
  // l'argument passé à la fonction, PAS les options. Écrit en deuxième position,
  // `{ timeout }` partait donc à une fonction qui n'attend rien, et le délai par
  // défaut de trente secondes s'appliquait — douze attentes par écran, six
  // minutes sur toute page qui ne se stabilise pas. Trois pages s'y sont
  // arrêtées au dixième de seconde près, ce qui a trahi le plafond ; sans le
  // `null`, ces délais ne sont pas des délais, ce sont des commentaires.
  await page
    .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
      timeout: 5000,
    })
    .catch(() => marquer(ou, 'chargement'))
  await page
    .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
    .catch(() => marquer(ou, 'polices'))
}

function marquer(ou, quoi) {
  const cle = `${ou} — ${quoi}`
  lenteurs.set(cle, (lenteurs.get(cle) ?? 0) + 1)
}

/** Exécuté DANS la page : rend les coupables, ou `null` si rien ne déborde. */
const MESURER = () => {
  const avant = window.scrollX
  window.scrollTo(400, 0)
  const decalage = window.scrollX
  window.scrollTo(avant, 0)
  if (!decalage) return null

  const largeurVue = document.documentElement.clientWidth
  const coupables = []
  for (const el of document.querySelectorAll('*')) {
    const boite = el.getBoundingClientRect()
    if (boite.width === 0) continue
    if (boite.right <= largeurVue + 1) continue

    // Un élément large À L'INTÉRIEUR d'un conteneur qui défile n'est pas un
    // coupable : c'est le motif normal des tableaux du dépôt.
    let ancetre = el.parentElement
    let contenu = false
    while (ancetre) {
      const debordement = getComputedStyle(ancetre).overflowX
      if (debordement === 'auto' || debordement === 'scroll' || debordement === 'hidden') {
        contenu = true
        break
      }
      ancetre = ancetre.parentElement
    }
    if (contenu) continue

    coupables.push({
      balise: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className.slice(0, 110) : '',
      largeur: Math.round(boite.width),
      bordDroit: Math.round(boite.right),
      texte: (el.textContent || '').trim().slice(0, 44),
    })
  }
  return { decalage, largeurVue, coupables: coupables.slice(0, 6) }
}

/** Construit le paquet : la garde mesure ce qui sera livré, pas les sources. */
function construire() {
  return new Promise((resolve, reject) => {
    const fils = spawn('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: RACINE })
    let erreur = ''
    fils.stderr.on('data', (d) => (erreur += d))
    fils.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build a échoué :\n${erreur}`)))) 
  })
}

/** Sert le paquet, et rend de quoi l'arrêter quoi qu'il arrive ensuite. */
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
  throw new Error(`mesure-ui : le serveur de prévisualisation n'a pas répondu sur ${BASE}`)
}

const adresses = adressesDeLApplication()
await construire()
const serveur = await servir()
const echecs = []
const tolerancesUtilisees = new Set()

try {
  const navigateur = await chromium.launch()
  for (const langue of LANGUES) {
    const contexte = await navigateur.newContext({
      viewport: { width: LARGEURS[0], height: 900 },
      locale: langue,
    })
    const page = await contexte.newPage()
    for (const adresse of adresses) {
      // Le balayage DIT où il en est. Sans cela il reste muet une demi-heure,
      // et rien ne distingue « il travaille » de « il est bloqué » — l'état
      // dans lequel on désactive une porte plutôt que de la lire.
      const depart = Date.now()
      process.stdout.write(`   ${langue}  ${adresse} … `)
      await page.setViewportSize({ width: LARGEURS[0], height: 900 })
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await attendre(page, adresse)
      for (const largeur of LARGEURS) {
        await page.setViewportSize({ width: largeur, height: 900 })
        await attendre(page, adresse)
        const resultat = await page.evaluate(MESURER)
        if (!resultat) continue
        const cle = `${adresse}@${largeur}`
        if (TOLERES[cle]) {
          tolerancesUtilisees.add(cle)
          continue
        }
        echecs.push({ adresse, largeur, langue, ...resultat })
      }
      process.stdout.write(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
    }
    await contexte.close()
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

/*
  LE RAPPORT DE LENTEUR SORT EN PREMIER, avant tout `process.exit`.

  Écrit après les blocs d'échec, il ne s'imprimait jamais le jour où il compte :
  celui où la porte rougit. Or c'est précisément là qu'on veut savoir si le
  balayage a duré huit minutes parce qu'un écran ne se stabilise pas.
*/
if (lenteurs.size > 0) {
  console.warn(`\n⚠ ${lenteurs.size} attente(s) dépassée(s) — un écran qui ne se stabilise pas :`)
  for (const [cle, n] of [...lenteurs].sort((a, b) => b[1] - a[1])) console.warn(`   ${n}× ${cle}`)
}

// Garde du garde : une tolérance qui ne couvre plus rien doit mourir, sinon
// la liste devient un cimetière qui blanchit des défauts à venir.
const orphelines = Object.keys(TOLERES).filter((cle) => !tolerancesUtilisees.has(cle))
if (orphelines.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${orphelines.length} tolérance(s) ne couvrent plus aucun débordement.\n` +
      orphelines.map((cle) => `   ${cle} — à retirer de TOLERES`).join('\n'),
  )
  process.exit(1)
}

if (echecs.length > 0) {
  console.error(`\n✗ mesure-ui : ${echecs.length} débordement(s) latéral(aux).\n`)
  for (const e of echecs) {
    console.error(`   ${e.adresse}  ${e.largeur}px  ${e.langue}  →  scrollX=${e.decalage}`)
    for (const c of e.coupables) {
      console.error(`      <${c.balise}> largeur=${c.largeur} bordDroit=${c.bordDroit} (fenêtre ${e.largeurVue})`)
      console.error(`         class="${c.classes}"`)
      if (c.texte) console.error(`         texte=${JSON.stringify(c.texte)}`)
    }
  }
  console.error('')
  process.exit(1)
}

console.log(
  `\n✓ mesure-ui : ${adresses.length} écrans × ${LARGEURS.length} largeurs × ${LANGUES.length} langues, aucun débordement latéral.`,
)
