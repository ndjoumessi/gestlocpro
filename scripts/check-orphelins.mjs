#!/usr/bin/env node
/**
 * Garde-fou contre le travail livré sans son bout manquant.
 *
 * Trois fois dans l'histoire de ce dépôt, une route serveur a vécu des lots
 * entiers sans écran : le registre des accès, les tarifs de refacturation, puis
 * le message groupé et la réponse au locataire. Deux fois, une colonne du
 * schéma a été écrite sans jamais être relue — `Payment.reference` — ou n'a
 * jamais été ni écrite ni lue — `displayCurrency`, `emailVerifiedAt`. À chaque
 * fois le défaut a été trouvé par hasard, des semaines plus tard, en cherchant
 * autre chose.
 *
 * Ces trois manques ont la même forme : un maillon qui existe et que rien
 * n'appelle. C'est mécaniquement détectable, donc ça n'a pas à se découvrir par
 * hasard.
 *
 *   node scripts/check-orphelins.mjs     ·     npm run lint:orphelins
 *
 * Sortie 1 dès qu'un maillon est orphelin, pour bloquer en intégration.
 *
 * LES EXEMPTIONS SONT NOMMÉES ET MOTIVÉES, jamais silencieuses. Une liste
 * d'exceptions sans raison écrite devient le tapis sous lequel on glisse le
 * prochain défaut — et c'est exactement ce que ce contrôle existe pour empêcher.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exit } from 'node:process'

const RACINE = new URL('..', import.meta.url).pathname
const IGNORES = new Set(['node_modules', 'generated', 'dist', '.git', 'coverage'])

/**
 * UNE EXEMPTION NE SURVIT PAS À CE QU'ELLE EXEMPTE.
 *
 * Les trois listes ci-dessous étaient de simples `Set` traversés par un
 * `continue` muet. Le défaut est celui que ce fichier traque partout ailleurs,
 * retourné : un maillon qui existe et que plus rien n'appelle — sauf qu'ici le
 * maillon est l'exemption elle-même. Le jour où l'on écrit l'écran d'une route
 * exemptée, l'exemption cesse de supprimer une plainte et reste pourtant dans
 * le fichier, où le lecteur suivant la prendra pour une décision encore vraie.
 *
 * Ce registre compte donc les exemptions CONSOMMÉES — celles qui ont réellement
 * supprimé une plainte — et fait rougir les autres. Corollaire important pour
 * les sections ci-dessous : l'exemption ne se consulte qu'APRÈS avoir constaté
 * le défaut, jamais avant. Consultée avant, elle serait « consommée » par un
 * maillon parfaitement branché et ne périmerait jamais.
 *
 * Mesuré à l'écriture de ce registre : `InspectionFinding.inspectionId` était
 * déjà périmée. Le code nomme `inspectionId`, donc elle ne supprimait rien
 * depuis un moment ; elle est retirée, et son retrait ne change aucun verdict.
 */
function registre(intitule, entrees) {
  const motifs = new Map(entrees)
  const consommees = new Set()
  return {
    /** Rend le motif si la clé est exemptée, et note la consommation. */
    couvre(cle) {
      if (!motifs.has(cle)) return false
      consommees.add(cle)
      return true
    },
    perimees() {
      return [...motifs.keys()]
        .filter((c) => !consommees.has(c))
        .map(
          (c) =>
            `exemption périmée · ${intitule} « ${c} » · elle ne supprime plus aucune plainte : ` +
            `le maillon est branché, ou son nom a changé. Retirez-la — une exemption qui ne ` +
            `couvre rien est une décision périmée que le lecteur suivant croira encore vraie. ` +
            `(motif inscrit : ${motifs.get(c)})`,
        )
    },
  }
}

/**
 * Champs de schéma qu'on n'attend PAS de voir nommés dans le code.
 *
 * `updatedAt` est tenu par Prisma lui-même (`@updatedAt`) : le nommer serait
 * l'écrire à la main, ce qui est justement ce qu'on ne veut pas.
 */
const CHAMPS_EXEMPTS = registre('colonne', [
  ['updatedAt', 'tenu par Prisma via @updatedAt ; le nommer serait l’écrire à la main'],
])

/**
 * Méthodes d'API sans écran, et qui n'en veulent pas.
 *
 * `health` est une sonde : elle sert au déploiement et aux tests de contrat, pas
 * à un utilisateur. Lui exiger un bouton serait inventer une fonctionnalité.
 */
const API_EXEMPTES = registre('méthode d’API', [
  ['health', 'sonde de déploiement et de test de contrat, pas une fonctionnalité'],
])

/**
 * Routes serveur dont le client est un lot à venir — NOMMÉES UNE PAR UNE.
 *
 * IL N'EN RESTE QU'UNE des quatre routes photo. Trois ont trouvé leur client :
 * la réservation et la confirmation au lot de la rangée de photos, la LECTURE
 * au lot des preuves du locataire. C'était bien une avance assumée du serveur
 * sur le client, et elle se résorbe route par route.
 *
 * AUCUN MOTIF À JOKERS. Chaque route est une chaîne complète, comparée par
 * égalité à la forme étoilée produite par `etoiler`. Les `*` qu'on y lit sont
 * les paramètres de chemin, pas des jokers d'exemption : `POST
 * /api/parks/*​/photos/*​/confirmation` n'exempte que cette route-là. Une
 * cinquième route photo écrite demain ne sera couverte par aucune des quatre et
 * fera rougir la porte, ce qui est exactement le comportement voulu.
 *
 * LIMITE, et il faut la dire : la comparaison porte sur la forme étoilée. Deux
 * routes serveur distinctes qui s'étoileraient en la même chaîne seraient
 * exemptées ensemble par une seule entrée. Aucune des quatre n'est dans ce cas
 * aujourd'hui — les vérifier reste à la charge de qui ajoute une entrée.
 */
const MOTIF_SUPPRESSION = 'aucun écran ne supprime encore une photo confirmée ; le retrait avant envoi est local'

/**
 * TROIS EXEMPTIONS SONT PARTIES, ET C'EST LA GARDE QUI L'A DIT — À CHAQUE FOIS.
 *
 * `POST …/findings/*​/photos` et `POST …/photos/*​/confirmation` au lot de la
 * rangée de photos ; `GET …/photos/*​` à celui des preuves du locataire, qui
 * lui a donné son premier appelant. Chaque fois, l'exemption a cessé de
 * supprimer une plainte, la péremption l'a nommée, elle est retirée. C'est
 * exactement le cycle pour lequel ce registre a été posé — et il ne s'est
 * jamais déclenché autrement que par la porte.
 *
 * LA DERNIÈRE porte SON motif, et non plus un motif commun devenu faux :
 * « bloqué sur une mesure » ne décrivait plus rien une fois la mesure faite, et
 * « le lot du locataire » ne décrit plus rien maintenant qu'il est écrit. Ce
 * qui reste est vrai : le locataire REGARDE, il ne supprime pas — lui ouvrir la
 * suppression lui donnerait d'effacer la pièce qui l'accuse — et aucun écran de
 * bailleur ne retire encore une photo confirmée.
 */
const ROUTES_EXEMPTES = registre('route', [
  ['DELETE /api/parks/*/photos/*', MOTIF_SUPPRESSION],
])

async function fichiers(depart, extensions) {
  const sortie = []
  async function descendre(dossier) {
    let entrees
    try {
      entrees = await readdir(dossier, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entrees) {
      if (IGNORES.has(e.name)) continue
      const chemin = join(dossier, e.name)
      if (e.isDirectory()) await descendre(chemin)
      else if (extensions.some((x) => e.name.endsWith(x))) sortie.push(chemin)
    }
  }
  await descendre(depart)
  return sortie
}

async function concatener(chemins, garder = () => true) {
  const morceaux = await Promise.all(
    chemins.filter(garder).map((c) => readFile(c, 'utf8')),
  )
  return morceaux.join('\n')
}

const SCALAIRES = new Set([
  'String', 'Int', 'Boolean', 'DateTime', 'Json', 'Float', 'Decimal', 'Bytes', 'BigInt',
])

/** Les champs de DONNÉE du schéma — les relations n'en sont pas. */
function champsDeDonnee(schema) {
  const enums = new Set([...schema.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]))
  const champs = []
  for (const bloc of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const [, modele, corps] = bloc
    for (const ligne of corps.split('\n')) {
      const l = ligne.trim()
      if (!l || l.startsWith('//') || l.startsWith('@@')) continue
      const m = /^(\w+)\s+([\w[\]?]+)/.exec(l)
      if (!m) continue
      const type = m[2].replace(/[?[\]]/g, '')
      if (SCALAIRES.has(type) || enums.has(type)) champs.push({ modele, nom: m[1] })
    }
  }
  return champs
}

const plaintes = []

// ─── 1. Une colonne que personne ne nomme ────────────────────────────────────
{
  const schema = await readFile(join(RACINE, 'server/prisma/schema.prisma'), 'utf8')
  const code = await concatener([
    ...(await fichiers(join(RACINE, 'src'), ['.ts', '.tsx'])),
    ...(await fichiers(join(RACINE, 'server/src'), ['.ts'])),
  ])
  const mots = new Set(code.match(/\w+/g) ?? [])

  for (const { modele, nom } of champsDeDonnee(schema)) {
    // Le défaut D'ABORD, l'exemption ensuite : voir `registre`.
    if (mots.has(nom)) continue
    if (CHAMPS_EXEMPTS.couvre(`${modele}.${nom}`) || CHAMPS_EXEMPTS.couvre(nom)) continue
    plaintes.push(
      `colonne orpheline · ${modele}.${nom} · aucun chemin du code ne la nomme. ` +
        `Branchez-la, ou retirez-la par migration.`,
    )
  }
}

// ─── 2. Une méthode d'API qu'aucun écran n'appelle ───────────────────────────
{
  const clientPath = join(RACINE, 'src/api/client.ts')
  const client = await readFile(clientPath, 'utf8')
  const methodes = [...client.matchAll(/^ {2}(\w+): (?:<T>)?\(/gm)].map((m) => m[1])

  // Les TESTS sont exclus : un appel qui n'existe que sous test décrit une
  // fonctionnalité que personne ne peut déclencher — c'est le défaut même.
  const ecrans = await concatener(
    await fichiers(join(RACINE, 'src'), ['.ts', '.tsx']),
    (c) => c !== clientPath && !/\.test\.tsx?$/.test(c),
  )

  for (const nom of methodes) {
    // `.nom(` autant que `.nom<{ … }>(` : le paramètre de type s'intercale.
    if (new RegExp(`\\.${nom}\\s*[<(]`).test(ecrans)) continue
    if (API_EXEMPTES.couvre(nom)) continue
    plaintes.push(
      `méthode d'API orpheline · api.${nom} · aucun écran ni fournisseur ne l'appelle. ` +
        `Livrez son écran, ou retirez-la.`,
    )
  }
}

// ─── 3. Une route serveur qu'aucun chemin du client ne compose ───────────────
//
// LE MOTIF EST EXACT, et il a fallu s'y reprendre. Première rédaction : « chaque
// segment fixe de la route apparaît-il quelque part dans client.ts ? ». Elle
// était MUETTE — retirer `updatePark` en entier ne la faisait pas broncher,
// parce que `PATCH /:parkId` n'a aucun segment fixe, et parce que chercher
// « payments » n'importe où dans le fichier trouve toujours quelque chose.
// C'est le défaut que ce dépôt traque partout ailleurs : un contrôle plus large
// que ce qu'il prétend garder.
//
// On compare donc des CHEMINS COMPLETS, méthode comprise, après avoir remplacé
// les paramètres par une étoile des deux côtés :
//
//   serveur  parksRouter.patch('/:parkId')            → PATCH /api/parks/*
//   client   requete(`/parks/${parkId}`, { method })  → PATCH /api/parks/*
{
  const MONTAGES = [
    // Le préfixe sous lequel `app.ts` monte chaque routeur. Le client, lui,
    // préfixe tout par `/api` dans `requete`.
    ['authRouter', '/api/auth'],
    ['rejoindreRouter', '/api/join'],
    ['parksRouter', '/api/parks'],
  ]

  const etoiler = (chemin) =>
    chemin
      .replace(/\$\{[^}]*\}/g, '*')
      .replace(/:[A-Za-z]\w*/g, '*')
      .replace(/\/+$/, '')

  // Ce que le CLIENT sait composer. `requete` porte le chemin en littéral de
  // gabarit et la méthode dans son initialiseur ; sans `method`, c'est un GET.
  const client = await readFile(join(RACINE, 'src/api/client.ts'), 'utf8')
  const composables = new Set()
  for (const m of client.matchAll(/requete<[^>]*>\(\s*`([^`]+)`([^)]*)/g)) {
    const methode = /method:\s*'(\w+)'/.exec(m[2])?.[1] ?? 'GET'
    composables.add(`${methode.toUpperCase()} ${etoiler('/api' + m[1])}`)
  }
  // `requete<void>('/chemin')` sans gabarit : même forme, guillemets simples.
  for (const m of client.matchAll(/requete<[^>]*>\(\s*'([^']+)'([^)]*)/g)) {
    const methode = /method:\s*'(\w+)'/.exec(m[2])?.[1] ?? 'GET'
    composables.add(`${methode.toUpperCase()} ${etoiler('/api' + m[1])}`)
  }

  const routesServeur = await concatener(
    await fichiers(join(RACINE, 'server/src'), ['routes.ts']),
  )
  for (const m of routesServeur.matchAll(
    /(\w*Router)\.(get|post|patch|delete|put)\(\s*'([^']*)'/g,
  )) {
    const [, routeur, verbe, chemin] = m
    const prefixe = MONTAGES.find(([nom]) => nom === routeur)?.[1]
    // Un routeur qu'`app.ts` ne monte pas n'a pas de chemin public : il est
    // hors de portée de ce contrôle, et le dire vaut mieux que l'ignorer.
    if (!prefixe) continue
    const complet = `${verbe.toUpperCase()} ${etoiler(prefixe + chemin)}`
    if (composables.has(complet)) continue
    if (ROUTES_EXEMPTES.couvre(complet)) continue
    plaintes.push(
      `route orpheline · ${complet} · aucun appel de src/api/client.ts ne compose ` +
        `ce chemin. Le serveur a pris de l’avance sur le client.`,
    )
  }
}

// ─── 4. Un écran que rien ne monte ───────────────────────────────────────────
//
// LA FORME SUIVANTE DU MÊME DÉFAUT, et c'est une mutation muette qui l'a
// désignée. Retirer `<ReplyModal … />` de `Works.tsx` ne faisait broncher aucun
// des trois contrôles ci-dessus : le composant existait toujours, il appelait
// toujours `api.replyToWork`, et la méthode avait donc toujours son appelant.
// Le maillon rompu n'était pas la route ni la méthode — c'était la porte
// d'entrée de l'écran.
//
// Les cinq cas historiques étaient tous « une route sans écran ». Celui-ci est
// « un écran sans porte d'entrée » : il se compile, ses tests passent puisqu'ils
// le montent eux-mêmes, et aucun utilisateur ne peut l'atteindre.
{
  const tsx = await fichiers(join(RACINE, 'src'), ['.tsx'])
  const sources = new Map()
  for (const chemin of tsx.filter((c) => !/\.test\.tsx$/.test(c))) {
    sources.set(chemin, await readFile(chemin, 'utf8'))
  }

  const composants = new Map()
  for (const [chemin, texte] of sources) {
    for (const m of texte.matchAll(/^export function ([A-Z]\w+)/gm)) {
      composants.set(m[1], chemin)
    }
  }

  for (const [nom, source] of composants) {
    // Monté PAR UN AUTRE FICHIER. Un composant qui ne s'emploie que chez lui
    // n'a pas d'entrée non plus — et le fichier de test ne compte pas : s'y
    // monter soi-même est exactement ce qui masque le défaut.
    const monte = [...sources].some(
      ([chemin, texte]) => chemin !== source && new RegExp(`<${nom}[\\s/>]`).test(texte),
    )
    if (!monte) {
      plaintes.push(
        `écran orphelin · <${nom}> · aucun autre fichier de src/ ne le monte ` +
          `(${source.replace(RACINE, '')}). Il se compile, ses tests passent, ` +
          `et personne ne peut l’atteindre.`,
      )
    }
  }
}

// ─── 5. Une destination que la vitrine promet et que rien ne sert ────────────
//
// LE DÉFAUT SYMÉTRIQUE DES QUATRE PRÉCÉDENTS. Ceux-là traquent un maillon qui
// EXISTE et que rien n'appelle ; celui-ci traque un appel qui existe et dont le
// maillon n'existe pas. Le pied de page en portait cinq d'un coup — « À
// propos », « Contact », « Conditions générales », « Confidentialité »,
// « Cookies » — dont trois documents juridiques.
//
// LES CINQ RÉSOLVAIENT POURTANT, et c'est ce qui rend ce contrôle nécessaire
// plutôt qu'évident : elles pointaient toutes vers `#faq` ou `#roles`, des
// ancres bien réelles. Ce contrôle ne peut pas voir qu'un libellé ment sur sa
// destination — cela reste un jugement, et il est écrit en tête de
// `PublicFooter.tsx`. Ce qu'il voit, et que personne ne verra à l'œil le jour
// où quelqu'un écrira `/mentions-legales` en attendant la page : une
// destination qui n'est servie par rien du tout.
//
// LA PORTÉE EST CELLE DE LA VITRINE, pas de l'application : c'est la surface
// qu'un prospect méfiant vérifie, et la seule dont toutes les destinations
// tiennent dans deux listes closes — les routes déclarées et les ancres
// rendues. Élargir à `src/` entier demanderait de résoudre des chemins
// composés, et un contrôle plus large que ce qu'il sait garder est le défaut
// que ce fichier traque partout ailleurs.
{
  const SURFACES = [
    join(RACINE, 'src/features/marketing'),
    join(RACINE, 'src/components/layout/PublicFooter.tsx'),
  ]

  const app = await readFile(join(RACINE, 'src/App.tsx'), 'utf8')
  /*
    Les routes DÉCLARÉES, étoilées comme dans le contrôle des routes serveur.
    `/inscription/:role` devient `/inscription/*` et couvre donc les trois
    chemins par rôle que la section des rôles compose.
  */
  const routes = new Set(
    [...app.matchAll(/<Route\s+[^>]*path="([^"]+)"/g)]
      .map((m) => m[1].replace(/:[A-Za-z]\w*/g, '*').replace(/\/\*$/, '/*'))
      .filter((p) => p !== '*'),
  )
  const sert = (chemin) => {
    if (routes.has(chemin)) return true
    // Une route en `/app/*` sert `/app/parc` : on remonte segment par segment.
    const segments = chemin.split('/').filter(Boolean)
    for (let i = segments.length; i > 0; i--) {
      if (routes.has('/' + segments.slice(0, i).join('/') + '/*')) return true
    }
    return false
  }

  // Les ancres RENDUES : tout `id="…"` posé quelque part dans `src/`. On lit
  // large à dessein — une ancre peut vivre hors de la vitrine, et se tromper
  // dans ce sens ne fait que rendre le contrôle moins bavard, jamais faux.
  const toutLeClient = await concatener(
    await fichiers(join(RACINE, 'src'), ['.tsx']),
    (c) => !/\.test\.tsx$/.test(c),
  )
  const ancres = new Set([...toutLeClient.matchAll(/\bid="([^"{}]+)"/g)].map((m) => m[1]))

  /*
    LES COMMENTAIRES SONT RETIRÉS, et c'est la règle elle-même qui l'a exigé :
    à sa première exécution elle a rapporté `/#features` et `#id`, deux
    destinations qui n'existent que dans la prose qui explique pourquoi on ne
    les écrit PAS — le commentaire en tête de `COLUMNS` cite `<Link
    to="/#features">` comme contre-exemple. Un contrôle qui lit les explications
    d'un défaut comme le défaut lui-même désigne le mauvais coupable, ce que ce
    fichier reproche déjà ailleurs à une première rédaction trop large.

    `zonesSures.test.ts` a rencontré le même écueil et le traite pareil : « les
    commentaires citent les classes qu'ils expliquent ».
  */
  const sansCommentaires = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

  const surface = sansCommentaires(
    await concatener(
      (
        await Promise.all(
          SURFACES.map(async (s) =>
            s.endsWith('.tsx') ? [s] : await fichiers(s, ['.ts', '.tsx']),
          ),
        )
      )
        .flat()
        .filter((c) => !/\.test\.tsx?$/.test(c)),
    ),
  )

  // `to=` comme `href=`, en attribut JSX ou en propriété d'objet — le pied de
  // page et la grille des rôles déclarent leurs destinations dans des tableaux,
  // pas dans le balisage. On ne retient que l'INTERNE : `http`, `mailto` et
  // `tel` sortent de la portée de ce contrôle, qui ne sait rien du dehors.
  const destinations = new Set(
    [...surface.matchAll(/\b(?:to|href):?=?\s*['"]([^'"{}]+)['"]/g)]
      .map((m) => m[1])
      .filter((d) => d.startsWith('/') || d.startsWith('#')),
  )

  for (const d of destinations) {
    const ok = d.startsWith('#') ? ancres.has(d.slice(1)) : sert(d)
    if (!ok) {
      plaintes.push(
        `destination orpheline · ${d} · promise par la vitrine, servie par ` +
          `${d.startsWith('#') ? 'aucune ancre rendue' : 'aucune route déclarée'}. ` +
          `Servez-la, ou retirez le lien : un pied de page qui liste des pages ` +
          `absentes est la première chose qu’un prospect méfiant vérifie.`,
      )
    }
  }

  // Garde du garde : le motif doit continuer de trouver des destinations. Un
  // jour où `to=` s'écrirait autrement, la boucle ci-dessus tournerait à vide
  // et la porte dirait « aucune destination orpheline » sans en avoir lu une.
  if (destinations.size < 5) {
    plaintes.push(
      `contrôle des destinations · ${destinations.size} destination(s) interne(s) lue(s) ` +
        `dans la vitrine, ce qui est trop peu pour être vrai. Le motif de lecture ` +
        `est-il encore accordé à la façon dont les liens s’y écrivent ?`,
    )
  }
}

// ─── 6. Une exemption qui ne couvre plus rien ────────────────────────────────
//
// Se lit APRÈS les cinq sections, puisqu'il faut les avoir toutes traversées
// pour savoir laquelle a consommé quoi.
plaintes.push(...CHAMPS_EXEMPTS.perimees(), ...API_EXEMPTES.perimees(), ...ROUTES_EXEMPTES.perimees())

if (plaintes.length > 0) {
  console.error(`✗ ${plaintes.length} maillon(s) orphelin(s) :\n`)
  for (const p of plaintes) console.error('  ' + p)
  console.error(
    '\nUn maillon que rien n’appelle est une promesse que le produit ne tient pas.\n' +
      'Si l’exception est légitime, inscrivez-la — avec son motif — dans scripts/check-orphelins.mjs.',
  )
  exit(1)
}

console.log('✓ Aucune colonne, méthode, route, écran ni destination orpheline.')
