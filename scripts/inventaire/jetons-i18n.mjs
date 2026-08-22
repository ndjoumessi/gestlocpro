#!/usr/bin/env node
/**
 * RELEVÉ DES JETONS ET DE L'I18N — deux axes, en chiffres, rattachés aux écrans.
 *
 *   node scripts/inventaire/jetons-i18n.mjs
 *   import { releverJetonsEtI18n } from './scripts/inventaire/jetons-i18n.mjs'
 *
 * CE MODULE NE CORRIGE RIEN et ne bloque aucune intégration. Il MESURE, et il
 * refuse de rendre un chiffre qu'il n'a pas réellement lu. C'est sa seule
 * promesse, et c'est la plus difficile à tenir : « aucun défaut » et « je n'ai
 * rien lu » s'écrivent pareil dans un journal. Toutes les gardes du bas de ce
 * fichier existent pour distinguer ces deux phrases.
 *
 * ── CE QU'IL NE DOUBLONNE PAS ─────────────────────────────────────────────
 *
 * `scripts/check-i18n.mjs` garde déjà quatre familles de défauts de langue :
 * les chaînes littérales dans un attribut visible, le texte ACCENTUÉ entre
 * chevrons, les questions posées deux fois dans un écran, les aveux de
 * simulation et les envois promis sur un canal absent. Ce relevé ne remesure
 * aucune des cinq. Il mesure le DELTA : ce qu'un utilisateur LIT et que ce
 * garde-là ne peut pas voir — le texte sans accent, l'attribut cité entre
 * accolades, le libellé passé en propriété d'un composant — plus l'inverse de
 * son défaut : les clés déclarées que plus rien n'emploie.
 *
 * `src/design-system/*.test.ts` gardent déjà la feuille de jetons : couverture
 * du thème sombre, appariements de contraste, échelle des altitudes, durées,
 * graisses. UNE SEULE d'entre elles regarde un hex écrit dans une source de
 * produit — `paletteAffichee.test.ts` — et elle ne regarde qu'UN fichier,
 * `src/routes/KitchenSink.tsx`. Les 117 autres sources ne sont gardées par
 * personne sur ce point. C'est le delta que l'axe 1 mesure.
 *
 * ── PIÈGE TAILWIND v4, ET IL VISE CE FICHIER PLUS QUE LES AUTRES ──────────
 *
 * Tailwind v4 détecte ses sources tout seul : tout fichier texte non ignoré du
 * dépôt est balayé, `scripts/*.mjs` compris, commentaires compris. Une classe
 * citée en littéral ici serait RÉELLEMENT GÉNÉRÉE dans le CSS livré, et une
 * valeur arbitraire — un hex entre crochets derrière un préfixe d'utilitaire —
 * ferait pire : elle ressusciterait dans la feuille exactement la couleur en
 * dur que ce relevé compte. `scripts/mesure-ui.mjs` documente déjà le piège.
 *
 * D'où deux règles tenues dans tout ce fichier :
 *   - AUCUN nom d'utilitaire n'y est écrit en entier ; les rares qu'on compare
 *     sont assemblés par fragments concaténés ;
 *   - AUCUNE valeur de LA PALETTE n'y est écrite en littéral. Le relevé n'en a
 *     pas besoin : les couleurs auxquelles il compare sont LUES dans
 *     `tokens.css`, ce qui les garde justes le jour où un jeton est recorrigé.
 *     Les trois hex qui restent dans ce fichier — au chapitre du motif `HEX` —
 *     illustrent une FORME (`#abc`, six chiffres, huit chiffres) et ne
 *     désignent aucune couleur du produit. Le relevé les compte lui-même, sous
 *     la catégorie « garde », et le rapport les affiche : une exception qu'on ne
 *     voit pas dans le chiffre n'est pas une exception, c'est un trou.
 *
 * ── POURQUOI `scripts/` EST HORS DU BALAYAGE ─────────────────────────────
 *
 * Les gardes du dépôt écrivent des hex et des noms de jetons en clair : c'est
 * leur métier de les comparer. `theme.test.ts` en cite neuf, `orDonnee.test.ts`
 * huit. Un relevé qui les compterait se dénoncerait lui-même et dénoncerait ses
 * voisins, et le chiffre ne voudrait plus rien dire.
 *
 * Mais une exclusion peut CACHER un vrai défaut, donc elle ne se contente pas
 * d'être écrite : `scripts/` et les fichiers de test sont balayés QUAND MÊME,
 * comptés à part sous la catégorie « garde », et le rapport les affiche. On sait
 * donc ce que l'exclusion écarte, au lieu de le supposer.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { argv, exit } from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  analyser,
  aveuxDeSimulation,
  dictionnaireAPlat,
  promessesDeCanal,
} from '../check-i18n.mjs'
import { RACINE, exigerUnInventairePlein, inventaireDesRoutes } from './routes.mjs'

/**
 * L'analyseur de TypeScript, et pourquoi une expression régulière ne suffit pas.
 *
 * Première tentative, mesurée : chercher `>texte<` à l'expression régulière sur
 * du TSX rend 262 « chaînes visibles », dont 244 sont des GÉNÉRIQUES —
 * `useState<Foo>(null)`, `useRef<HTMLDivElement>`, `Promise<void>`. Le taux de
 * bruit est de 93 %, et un relevé à ce taux ne se lit pas : on ne saurait pas
 * distinguer le jour où il passe de deux vrais défauts à trois.
 *
 * `typescript` est une dépendance déclarée du dépôt (`~5.9.3`), et son analyseur
 * distingue nativement un `JsxText` d'un paramètre de type. On l'emploie en mode
 * SYNTAXIQUE seul : aucun programme, aucun type résolu, donc aucun coût de
 * compilation. Son absence est un REFUS et non une dégradation silencieuse —
 * mesurer moins bien sans le dire est exactement ce que ce lot combat.
 */
const requireLocal = createRequire(join(RACINE, 'package.json'))
let ts
try {
  ts = requireLocal('typescript')
} catch (cause) {
  throw new Error(
    "jetons-i18n : `typescript` est introuvable. Ce relevé refuse de retomber sur une expression " +
      'régulière — mesurée, elle rend 93 % de bruit sur du TSX. Lancez `npm install`.',
    { cause },
  )
}

const SRC = join(RACINE, 'src')
const IGNORES = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', 'generated'])

/** Les cinq attributs qui produisent un texte lu ou un nom prononcé. */
const ATTRIBUTS_VISIBLES = new Set(['aria-label', 'aria-description', 'placeholder', 'title', 'alt'])

/**
 * Les propriétés de COMPOSANT qui portent un libellé jusqu'à l'écran.
 *
 * Ce ne sont pas des attributs du DOM : `<Input label="…">` finit dans un
 * `<label>`, `<StatCard unit="…">` dans un `<span>`. `check-i18n.mjs` ne les
 * regarde pas — sa liste est celle des attributs HTML — et c'est un vrai angle
 * mort, mesuré ici plutôt que supposé.
 *
 * La liste est fermée et courte à dessein : toute chaîne littérale passée à un
 * composant n'est pas un libellé, et compter `variant="secondary"` ferait un
 * chiffre de 400 qui ne dirait rien.
 */
const PROPRIETES_LIBELLE = new Set([
  'label',
  'description',
  'hint',
  'error',
  'caption',
  'legend',
  'unit',
  'suffix',
  'dialogLabel',
])

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DES FICHIERS
// ─────────────────────────────────────────────────────────────────────────────

function parcourir(depuis, garder, sortie = []) {
  let entrees
  try {
    entrees = readdirSync(depuis, { withFileTypes: true })
  } catch {
    return sortie
  }
  for (const e of entrees) {
    if (IGNORES.has(e.name)) continue
    const chemin = join(depuis, e.name)
    if (e.isDirectory()) parcourir(chemin, garder, sortie)
    else if (garder(e.name)) sortie.push(chemin)
  }
  return sortie
}

const rel = (chemin) => relative(RACINE, chemin)

/**
 * Neutralise les commentaires — et, sur demande, le contenu des chaînes — EN
 * GARDANT les positions : chaque caractère masqué devient une espace, chaque
 * saut de ligne reste un saut de ligne. Les numéros de ligne restent donc justes.
 *
 * LES CHAÎNES SONT TOUJOURS RECONNUES, même quand on ne les masque pas, et cette
 * ligne-là a coûté une lecture entière. La première version ne les reconnaissait
 * que pour les masquer ; le reste du temps elle balayait leur contenu comme du
 * code. Or `App.tsx` déclare `path="/app/*"` — le `/` du chemin suivi de son
 * joker forme une OUVERTURE DE COMMENTAIRE de bloc, et la fermeture n'arrivait
 * jamais : tout le bas du routeur passait pour du commentaire. La route `*` du
 * 404 disparaissait, et son écran sortait du champ de la mesure en silence,
 * c'est-à-dire exactement de la façon que ce lot existe pour empêcher. Le
 * symptôme était un « 22 routes rattachées sur 23 » que rien n'obligeait à lire.
 *
 * Pourquoi masquer le contenu des chaînes pour la recherche de jetons : les
 * noms de jetons sont cités en toutes lettres dans des commentaires du produit —
 * `TenantPortal` explique pourquoi il n'emploie PAS un utilitaire, en le
 * nommant. Compter ces mentions ferait passer pour vivant un jeton que plus rien
 * ne peint.
 */
function masquer(source, { chaines = false } = {}) {
  let sortie = ''
  const vide = (c) => (c === '\n' ? '\n' : ' ')
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') sortie += vide(source[i++])
      if (i < source.length) sortie += '\n'
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      const fin = source.indexOf('*/', i + 2)
      const stop = fin === -1 ? source.length : fin + 2
      for (let j = i; j < stop; j++) sortie += vide(source[j])
      i = stop - 1
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const guillemet = c
      sortie += c
      i++
      while (i < source.length && source[i] !== guillemet) {
        if (source[i] === '\\') {
          sortie += chaines ? '  ' : source.slice(i, i + 2)
          i += 2
          continue
        }
        sortie += chaines ? vide(source[i]) : source[i]
        i++
      }
      if (i < source.length) sortie += guillemet
      continue
    }
    sortie += c
  }
  return sortie
}

const ligneDe = (source, index) => source.slice(0, index).split('\n').length

// ─────────────────────────────────────────────────────────────────────────────
// RATTACHEMENT AUX ÉCRANS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout un import relatif ou aliasé vers un fichier réel.
 * `@/x` désigne `src/x`, comme le déclare `vite.config.ts`.
 */
function resoudre(depuisFichier, specificateur) {
  let base
  if (specificateur.startsWith('@/')) base = join(SRC, specificateur.slice(2))
  else if (specificateur.startsWith('.')) base = join(dirname(depuisFichier), specificateur)
  else return null
  for (const suffixe of ['.tsx', '.ts', '/index.tsx', '/index.ts', '']) {
    const essai = base + suffixe
    try {
      if (statSync(essai).isFile()) return essai
    } catch {
      /* candidat suivant */
    }
  }
  return null
}

/** Les imports d'un fichier, résolus, sans les paquets externes. */
function importsDe(chemin, source) {
  const nu = masquer(source)
  const specificateurs = [
    ...nu.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1])
  const table = new Map()
  for (const m of nu.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    const cible = resoudre(chemin, m[2])
    if (!cible) continue
    for (const brut of m[1].split(',')) {
      const nom = brut.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim()
      if (nom) table.set(nom, cible)
    }
  }
  for (const m of nu.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g)) {
    const cible = resoudre(chemin, m[2])
    if (cible) table.set(m[1], cible)
  }
  const fichiers = specificateurs.map((s) => resoudre(chemin, s)).filter(Boolean)
  return { fichiers: [...new Set(fichiers)], parNom: table }
}

/**
 * Les composants montés par une `<Route>`, lus dans son `element=`.
 *
 * Le corps est lu jusqu'à la fermeture, sur une ligne ou sur six — même
 * précaution que `routes.mjs`, et pour la même raison : `parc/:unitId` s'écrit
 * sur six lignes, et un motif mono-ligne l'aurait manqué SANS RIEN DIRE.
 */
function composantsDesRoutes(chemin) {
  const source = masquer(readFileSync(chemin, 'utf8'))
  const { parNom } = importsDe(chemin, readFileSync(chemin, 'utf8'))
  const parChemin = new Map()
  const enrole = (cle, corps) => {
    const noms = [...corps.matchAll(/<\s*([A-Z][\w.]*)/g)].map((m) => m[1])
    const cibles = noms.map((n) => parNom.get(n)).filter(Boolean)
    parChemin.set(cle, [...new Set([...(parChemin.get(cle) ?? []), ...cibles])])
  }
  for (const m of source.matchAll(/<Route\s+path="([^"]+)"([\s\S]*?)\/>\s*(?:\n|$)/g)) enrole(m[1], m[2])
  for (const m of source.matchAll(/<Route\s+index\b([\s\S]*?)\/>/g)) enrole('', m[1])
  return { parChemin, parNom }
}

/**
 * Les composants de la COQUILLE : ceux montés par la `<Route>` de mise en page
 * de `EspaceApplicatif`, donc présents sous les vingt et un écrans internes.
 *
 * Ils sont relevés à part et non fondus dans chaque écran : un défaut de la
 * coquille se corrige UNE fois, pas vingt et une, et confondre les deux est
 * exactement ce qui ferait répondre « réparti » à une question dont la réponse
 * est « partagé ».
 */
function coquilleInterne(chemin) {
  const source = masquer(readFileSync(chemin, 'utf8'))
  const { parNom } = importsDe(chemin, readFileSync(chemin, 'utf8'))
  const bloc = source.match(/<Route\s*\n?\s*element=\{([\s\S]*?)\}\s*>/)
  if (!bloc) return []
  const noms = [...bloc[1].matchAll(/<\s*([A-Z][\w.]*)/g)].map((m) => m[1])
  return [...new Set(noms.map((n) => parNom.get(n)).filter(Boolean))]
}

/** Tous les fichiers atteints depuis une racine, imports transitifs compris. */
function atteignables(racines) {
  const vus = new Set()
  const file = [...racines]
  while (file.length) {
    const chemin = file.pop()
    if (!chemin || vus.has(chemin)) continue
    if (!/\.tsx?$/.test(chemin) || /\.test\.tsx?$/.test(chemin)) continue
    vus.add(chemin)
    let source
    try {
      source = readFileSync(chemin, 'utf8')
    } catch {
      continue
    }
    for (const suivant of importsDe(chemin, source).fichiers) file.push(suivant)
  }
  return vus
}

/**
 * Table `fichier → écrans qui le montent`, construite depuis l'inventaire des
 * routes plutôt que depuis une liste recopiée.
 *
 * @returns {{ parFichier: Map<string,string[]>, coquille: Set<string>, routes: object[] }}
 */
export function rattachementDesEcrans() {
  const routes = exigerUnInventairePlein(inventaireDesRoutes())

  const app = composantsDesRoutes(join(SRC, 'App.tsx'))
  const espace = composantsDesRoutes(join(SRC, 'app/EspaceApplicatif.tsx'))
  const fichiersDeCoquille = atteignables(coquilleInterne(join(SRC, 'app/EspaceApplicatif.tsx')))

  const parFichier = new Map()
  const inscrire = (fichier, adresse) => {
    const cle = rel(fichier)
    if (!parFichier.has(cle)) parFichier.set(cle, new Set())
    parFichier.get(cle).add(adresse)
  }

  let racinesTrouvees = 0
  for (const route of routes) {
    let racines = []
    if (route.adresse.startsWith('/demo/')) {
      racines = espace.parChemin.get(route.adresse.slice('/demo/'.length)) ?? []
    } else if (route.adresse === '/app' || route.adresse === '/demo') {
      racines = [
        ...(espace.parChemin.get('') ?? []),
        resoudre(join(SRC, 'App.tsx'), './app/EspaceApplicatif'),
      ].filter(Boolean)
    } else if (route.origine.includes('route `*`')) {
      racines = app.parChemin.get('*') ?? []
    } else {
      racines = app.parChemin.get(route.adresse) ?? []
    }
    if (racines.length > 0) racinesTrouvees++
    for (const fichier of atteignables(racines)) inscrire(fichier, route.adresse)
  }

  return {
    routes,
    racinesTrouvees,
    coquille: new Set([...fichiersDeCoquille].map(rel)),
    parFichier: new Map([...parFichier].map(([k, v]) => [k, [...v].sort()])),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AXE 1 — LES COULEURS ÉCRITES EN DUR, ET LES JETONS QUE PLUS RIEN N'EMPLOIE
// ─────────────────────────────────────────────────────────────────────────────

const TOKENS = join(SRC, 'design-system/tokens.css')

/**
 * `#abc` ou `#aabbcc` ou `#aabbccdd`. Ce motif n'est PAS un candidat Tailwind :
 * une valeur arbitraire s'écrit derrière un préfixe d'utilitaire, et il n'y en a
 * aucun devant ce croisillon. Rien ici ne peut être généré dans la feuille.
 */
const HEX = /#[0-9a-fA-F]{3,8}\b/g

function versRvb(hex) {
  const nu = hex.slice(1)
  const plein =
    nu.length === 3 || nu.length === 4
      ? nu
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : nu.slice(0, 6)
  if (plein.length !== 6) return null
  return [0, 2, 4].map((i) => parseInt(plein.slice(i, i + 2), 16))
}

/** Distance pondérée « à l'œil » — approximation de Riemersma, en unités 0–255. */
function ecartDeCouleur(a, b) {
  const rMoyen = (a[0] + b[0]) / 2
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  return Math.sqrt(
    (2 + rMoyen / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMoyen) / 256) * db * db,
  )
}

/**
 * Les jetons de `tokens.css`, par nom, avec toutes leurs valeurs de thème.
 *
 * Un même nom vaut deux couleurs — claire et sombre — et c'est volontairement
 * conservé : dire qu'un hex de produit « existe déjà en jeton » sans dire dans
 * quel thème serait un demi-renseignement, et le demi-renseignement est ce qui a
 * produit le défaut d'appariement que `appariements.test.ts` garde aujourd'hui.
 */
export function lireLesJetons() {
  const css = readFileSync(TOKENS, 'utf8')
  const nu = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const jetons = new Map()
  for (const m of nu.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    const [, nom, valeur] = m
    // Un nom à DOUBLE tiret intérieur est un MODIFICATEUR de jeton — l'interligne
    // ou l'approche attachés à une taille — et non un jeton à part entière.
    // (L'exemple n'est pas écrit : son début est un nom d'utilitaire valide, et
    // le scanner de Tailwind lit ce fichier commentaires compris.)
    if (/^--[\w-]+--[\w-]+$/.test(nom)) continue
    if (!jetons.has(nom)) jetons.set(nom, [])
    const propre = valeur.trim().replace(/\s+/g, ' ')
    if (!jetons.get(nom).includes(propre)) jetons.get(nom).push(propre)
  }
  return { css, nu, jetons }
}

/** Le jeton de couleur le plus proche d'un hex, et son écart. */
function jetonLePlusProche(hex, jetons) {
  const cible = versRvb(hex)
  if (!cible) return null
  let meilleur = null
  for (const [nom, valeurs] of jetons) {
    for (const valeur of valeurs) {
      const m = valeur.match(/^#[0-9a-fA-F]{3,8}$/)
      if (!m) continue
      const rvb = versRvb(valeur)
      if (!rvb) continue
      const ecart = ecartDeCouleur(cible, rvb)
      if (!meilleur || ecart < meilleur.ecart) meilleur = { jeton: nom, valeur, ecart }
    }
  }
  if (!meilleur) return null
  return { ...meilleur, ecart: Math.round(meilleur.ecart * 10) / 10, identique: meilleur.ecart === 0 }
}

/**
 * Classe un site portant un hex. TROIS catégories, et la frontière compte plus
 * que le total : une illustration prise pour un défaut fait un chiffre qui
 * appelle un correctif inutile, et un défaut pris pour une illustration fait un
 * chiffre qui rassure à tort.
 */
function categoriserHex(cheminRelatif, ligneTexte, dansCommentaire) {
  if (/^scripts\//.test(cheminRelatif)) return 'garde'
  if (/\.test\.tsx?$/.test(cheminRelatif)) return 'garde'
  if (dansCommentaire) return 'commentaire'
  if (/\.svg$/.test(cheminRelatif)) return 'illustration'
  if (/theme-color|<svg|<rect|<path|<circle|<stop|<text|fill=|stroke=/i.test(ligneTexte))
    return 'illustration'
  return 'produit'
}

/**
 * @returns tous les sites portant une couleur hexadécimale, hors `tokens.css`.
 */
export function releverLesHex(jetons) {
  const cibles = [
    ...parcourir(SRC, (n) => /\.(tsx?|css|svg|html)$/.test(n)),
    ...parcourir(join(RACINE, 'public'), (n) => /\.(css|svg|html)$/.test(n)),
    ...parcourir(join(RACINE, 'server/src'), (n) => /\.(tsx?|css|html)$/.test(n)),
    ...parcourir(join(RACINE, 'scripts'), (n) => /\.(mjs|js|css)$/.test(n)),
    join(RACINE, 'index.html'),
  ].filter((c) => c !== TOKENS)

  const sites = []
  let balayes = 0
  for (const chemin of cibles) {
    let source
    try {
      source = readFileSync(chemin, 'utf8')
    } catch {
      continue
    }
    balayes++
    const cheminRelatif = rel(chemin)
    const estCode = /\.(tsx?|mjs|js)$/.test(chemin)
    const sansCommentaires = estCode ? masquer(source) : source
    const lignes = source.split('\n')
    for (const m of source.matchAll(HEX)) {
      const ligne = ligneDe(source, m.index)
      const dansCommentaire = estCode && sansCommentaires.slice(m.index, m.index + m[0].length).trim() === ''
      const categorie = categoriserHex(cheminRelatif, lignes[ligne - 1] ?? '', dansCommentaire)
      sites.push({
        fichier: cheminRelatif,
        ligne,
        couleur: m[0].toLowerCase(),
        categorie,
        proche: jetonLePlusProche(m[0], jetons),
      })
    }
  }
  return { sites, balayes }
}

/**
 * Les jetons que PLUS AUCUN fichier n'emploie — l'inverse du défaut ci-dessus.
 *
 * Un jeton s'emploie de deux façons dans ce dépôt : `var(--nom)` écrit à la
 * main, ou l'utilitaire que Tailwind v4 génère depuis le nom. La seconde ne se
 * cherche PAS par son préfixe — écrire ce préfixe ici le générerait — mais par
 * le SUFFIXE du jeton, qui n'est un nom de classe pour personne.
 *
 * CE COMMENTAIRE A DÉJÀ PAYÉ LA LEÇON QU'IL ÉNONCE. Il portait, en toutes
 * lettres, le nom complet de l'utilitaire d'une teinte d'or, pour illustrer ce
 * qu'il ne fallait pas écrire — et le scanner oxide l'a extrait de ce fichier
 * même. Mesuré : ce nom n'apparaît nulle part dans `src/`, ni dans le CSS
 * livré ; la phrase d'exemple aurait donc AJOUTÉ une règle au paquet. Un
 * exemple d'un piège n'est pas hors du piège. Le nom ne s'écrit plus ici, ni en
 * entier ni en exemple.
 *
 * Trois statuts, parce que « inemployé » recouvre trois situations qui
 * n'appellent pas le même geste :
 *   - `vivant`  : cité par une règle de `tokens.css` elle-même ;
 *   - `garde`   : cité seulement par un test — une garde veille sur une couleur
 *                 que rien ne peint, ce qui est un vert acquis pour rien ;
 *   - `orphelin`: cité nulle part. Candidat au retrait.
 */
export function jetonsSansEmploi(jetons, nuTokens) {
  const sources = parcourir(SRC, (n) => /\.(tsx?|css)$/.test(n)).filter((c) => c !== TOKENS)
  const produit = []
  const gardes = []
  for (const chemin of sources) {
    const brut = readFileSync(chemin, 'utf8')
    const nu = /\.tsx?$/.test(chemin) ? masquer(brut) : brut
    ;(/\.test\.tsx?$/.test(chemin) ? gardes : produit).push(nu)
  }
  produit.push(readFileSync(join(RACINE, 'index.html'), 'utf8'))
  const corpusProduit = produit.join('\n')
  const corpusGardes = gardes.join('\n')

  const echappe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const emploie = (corpus, nom) => {
    const suffixe = nom.replace(/^--[a-z]+-/, '')
    const parVariable = new RegExp('var\\(\\s*' + echappe(nom) + '(?![\\w-])')
    const parUtilitaire = new RegExp('[-:\\s"\'`(\\[]' + echappe(suffixe) + '(?![\\w-])')
    return parVariable.test(corpus) || parUtilitaire.test(corpus)
  }

  const sansEmploi = []
  for (const nom of jetons.keys()) {
    if (emploie(corpusProduit, nom)) continue
    const dansLaFeuille = new RegExp('var\\(\\s*' + echappe(nom) + '(?![\\w-])').test(nuTokens)
    const dansUneGarde = emploie(corpusGardes, nom)
    sansEmploi.push({
      jeton: nom,
      valeurs: jetons.get(nom),
      statut: dansLaFeuille ? 'vivant' : dansUneGarde ? 'garde' : 'orphelin',
    })
  }
  return sansEmploi
}

// ─────────────────────────────────────────────────────────────────────────────
// AXE 2 — LES CHAÎNES VISIBLES ABSENTES DES DICTIONNAIRES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit un dictionnaire par l'analyseur de TypeScript plutôt qu'à l'expression
 * régulière, et ce n'est pas un raffinement gratuit.
 *
 * `dictionnaireAPlat` de `check-i18n.mjs` exige une accolade ouvrante seule sur
 * sa ligne. Or `fr.ts` porte des objets écrits d'un trait —
 * `essential: { name: '…', pitch: '…' },` — et la pile de préfixes ne se
 * dépile jamais après eux. Mesuré : ce lecteur rend 1076 clés là où le fichier
 * en porte 1082, dont 35 sous un NOM FAUX et 41 jamais vues. Le détail est au
 * chapitre `deltaDuLecteurDeCheckI18n` plus bas ; ici on veut simplement la
 * vérité du fichier, et un analyseur la donne.
 */
export function lireDictionnaire(chemin, nomExporte) {
  const source = readFileSync(chemin, 'utf8')
  const sf = ts.createSourceFile(chemin, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let litteral = null
  const chercher = (n) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === nomExporte &&
      n.initializer
    ) {
      let init = n.initializer
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression
      if (ts.isObjectLiteralExpression(init)) litteral = init
    }
    ts.forEachChild(n, chercher)
  }
  chercher(sf)
  if (!litteral) throw new Error(`jetons-i18n : \`export const ${nomExporte}\` introuvable dans ${rel(chemin)}.`)

  const plat = new Map()
  const descendre = (noeud, prefixe) => {
    for (const prop of noeud.properties) {
      if (!ts.isPropertyAssignment(prop)) continue
      const nom = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null
      if (!nom) continue
      const chemin = prefixe ? `${prefixe}.${nom}` : nom
      const v = prop.initializer
      if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) plat.set(chemin, v.text)
      else if (ts.isObjectLiteralExpression(v)) descendre(v, chemin)
    }
  }
  descendre(litteral, '')
  return plat
}

/**
 * Ce qui n'est pas du texte : ponctuation, nombres, entités, symboles.
 *
 * Même doctrine que le `HARMLESS` de `check-i18n.mjs`, et volontairement
 * étroite : une chaîne écartée ici ne sera comptée nulle part, donc le doute
 * profite au signalement.
 */
const SANS_PORTEE = /^([\s\-–—·|/\\.,:;()[\]{}+*=<>&%#@!?"'`~^…×°•]+|[\d\s.,:/+-]+|&[a-z]+;|&#\d+;)$/i

/** Un masque de format : ni minuscule ni espace, donc aucun mot à traduire. */
const MASQUE_DE_FORMAT = /^[^a-zà-ÿ\s]+$/

/** Une unité ou un symbole physique : le même dans les deux langues. */
const UNITE = /^[/\s]*(m[²³]|k?Wh|m3|FCFA|XOF|EUR|USD|CAD|%|pts?)[\s/]*$/

/**
 * Relève tout ce qu'un utilisateur LIT et qui est écrit en littéral dans le TSX.
 *
 * Ce qui est retenu : le contenu d'un nœud JSX, les cinq attributs visibles, les
 * neuf propriétés de composant qui portent un libellé, et une chaîne littérale
 * placée seule entre accolades dans un élément — `<span>{'Texte'}</span>`, forme
 * que le motif d'attribut de `check-i18n.mjs` ne peut pas voir.
 *
 * Ce qui est écarté par CONSTRUCTION, parce que l'analyseur ne les rend jamais
 * comme du texte visible : les clés d'objet, les noms de classe, les chemins,
 * les identifiants de test, les valeurs d'énumération et les paramètres de type.
 * Il n'y a donc aucune heuristique à écrire pour eux, et aucun chiffre à leur
 * accorder : la question « comment tranches-tu ? » se répond ici par « l'arbre
 * syntaxique tranche », ce qui est la seule réponse qui ne se périme pas.
 */
export function releverLesChainesVisibles(valeursConnues) {
  const cibles = parcourir(SRC, (n) => /\.tsx$/.test(n)).filter((c) => !/\.test\.tsx$/.test(c))
  const sites = []
  const ecartes = []
  /**
   * Combien de fois CHAQUE forme de lecture a mordu, retenue ou écartée.
   *
   * C'est le compteur qui fait rougir un motif périmé. Le jour où un composant
   * cesse d'accepter `hint=`, la ligne correspondante tombe à zéro — et zéro
   * ici ne veut pas dire « plus de défaut », il veut dire « on ne regarde plus ».
   */
  const genresVus = new Map()
  let balayes = 0

  for (const chemin of cibles) {
    const cheminRelatif = rel(chemin)
    const source = readFileSync(chemin, 'utf8')
    const sf = ts.createSourceFile(chemin, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    balayes++
    const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

    const noter = (n, genre, brut) => {
      const valeur = brut.replace(/\s+/g, ' ').trim()
      if (!valeur) return
      genresVus.set(genre, (genresVus.get(genre) ?? 0) + 1)
      const site = { fichier: cheminRelatif, ligne: ligne(n), genre, valeur }
      if (SANS_PORTEE.test(valeur)) return ecartes.push({ ...site, raison: 'sans portée linguistique' })
      if (!/[A-Za-zÀ-ÿ]{2}/.test(valeur)) return ecartes.push({ ...site, raison: 'aucun mot' })
      if (UNITE.test(valeur)) return ecartes.push({ ...site, raison: 'unité ou symbole' })
      if (MASQUE_DE_FORMAT.test(valeur)) return ecartes.push({ ...site, raison: 'masque de format' })
      site.dansLeDictionnaire = valeursConnues.has(valeur)
      sites.push(site)
    }

    const visiter = (n) => {
      if (ts.isJsxText(n)) noter(n, 'texte', n.text)
      else if (ts.isJsxAttribute(n)) {
        const nom = n.name.getText(sf)
        const genre = ATTRIBUTS_VISIBLES.has(nom)
          ? nom
          : PROPRIETES_LIBELLE.has(nom)
            ? `propriété ${nom}`
            : null
        if (genre) {
          const i = n.initializer
          let valeur = null
          if (i && ts.isStringLiteral(i)) valeur = i.text
          else if (i && ts.isJsxExpression(i) && i.expression) {
            const e = i.expression
            if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) valeur = e.text
          }
          if (valeur !== null) noter(n, genre, valeur)
        }
      } else if (
        ts.isJsxExpression(n) &&
        n.expression &&
        n.parent &&
        (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))
      ) {
        const e = n.expression
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
          noter(n, 'texte entre accolades', e.text)
      }
      ts.forEachChild(n, visiter)
    }
    visiter(sf)
  }
  return { sites, ecartes, balayes, genresVus: Object.fromEntries(genresVus) }
}

/**
 * CE QUE LES EXEMPTIONS NOMMÉES DE `check-i18n.mjs` CACHENT AUJOURD'HUI.
 *
 * Une exemption est une dette qui ne se rappelle jamais à personne : elle a eu
 * raison le jour où on l'a écrite, et rien ne dit si elle a encore raison. Ce
 * chapitre lui pose la question — pas en relisant son commentaire, mais en
 * REJOUANT `analyser` sur les fichiers qu'elle écarte, sous un nom qui ne
 * déclenche pas l'exemption. Le chiffre rendu est donc ce que le garde AURAIT
 * signalé sans elle.
 *
 * Une exemption à zéro n'est pas forcément à retirer — le fichier a pu être
 * assaini. Mais on le SAIT, au lieu de le supposer, et c'est tout ce qu'un
 * relevé peut faire honnêtement ici.
 */
export function exemptionsDeCheckI18n(dictionnaireFr) {
  const rejouer = (fichiers) => {
    let total = 0
    const details = []
    for (const chemin of fichiers) {
      let source
      try {
        source = readFileSync(chemin, 'utf8')
      } catch {
        continue
      }
      // Un nom neutre : ni test, ni fichier exempté, ni répertoire exempté.
      const trouves = analyser('src/rejoue.tsx', source)
      if (trouves.length > 0) details.push({ fichier: rel(chemin), signalements: trouves.length })
      total += trouves.length
    }
    return { total, details: details.sort((a, b) => b.signalements - a.signalements) }
  }

  const tests = parcourir(SRC, (n) => /\.test\.tsx?$/.test(n))
  const dictionnaires = parcourir(join(SRC, 'i18n'), (n) => /\.tsx?$/.test(n)).filter(
    (c) => !/\.test\.tsx?$/.test(c),
  )
  const donneesDeDemo = parcourir(join(SRC, 'data'), (n) => /\.tsx?$/.test(n)).filter(
    (c) => !/\.test\.tsx?$/.test(c),
  )

  /**
   * Les deux REGISTRES — un aveu assumé, une promesse assumée. Leur question
   * n'est pas « combien cachent-ils » mais « leur clé existe-t-elle encore, et
   * son libellé déclencherait-il encore le motif ? ». Une entrée de registre qui
   * ne couvre plus rien est une dérogation à un défaut disparu : elle
   * protégerait la prochaine récidive sous la même clé, en silence.
   *
   * Les motifs ne sont PAS recopiés ici, et c'est le point : une liste recopiée
   * répondrait sur sa propre copie et se périmerait au premier motif ajouté chez
   * le voisin. On interroge donc la fonction exportée de `check-i18n.mjs`
   * elle-même, en lui présentant le libellé SOUS UNE AUTRE CLÉ — celle du
   * registre étant précisément celle qu'elle saute. Ce qu'elle répond alors est
   * ce qu'elle aurait dit sans la dérogation.
   */
  const registre = (cle, sonde) => {
    const valeur = dictionnaireFr.get(cle)
    return {
      cle,
      clePresente: valeur !== undefined,
      valeur: valeur ?? null,
      declencheraitEncore:
        valeur === undefined ? false : sonde(new Map([['cle.hors.registre', valeur]])).length > 0,
    }
  }

  return {
    'EXEMPT_FILES · src/routes/KitchenSink.tsx': rejouer([join(SRC, 'routes/KitchenSink.tsx')]),
    'EST_UN_TEST · les fichiers de test': rejouer(tests),
    'EXEMPT_TEXT_DIRS · src/i18n/': rejouer(dictionnaires),
    'EXEMPT_TEXT_DIRS · src/data/': rejouer(donneesDeDemo),
    AVEUX_ASSUMES: registre('app.system.offlineNotice', (d) => aveuxDeSimulation('fr', d)),
    PROMESSES_ASSUMEES: registre('app.invite.sentBySms', (d) => promessesDeCanal('fr', d)),
  }
}

/**
 * Les clés déclarées que plus rien n'emploie — l'inverse exact du défaut que
 * `check-i18n.mjs` garde, et que rien ne garde aujourd'hui :
 * `check-orphelins.mjs` suit les colonnes, les méthodes d'API, les routes et
 * les destinations, jamais le dictionnaire.
 *
 * Les clés COMPOSÉES sont résolues, contrairement à `questionsEnDouble` qui les
 * laisse de côté et le dit. Ici on ne peut pas s'en passer : `app.trades.${x}`
 * couvre à lui seul des dizaines de clés, et les compter orphelines rendrait un
 * chiffre faux dans la direction la plus coûteuse — celle qui fait retirer des
 * libellés vivants.
 */
export function clesSansEmploi(dictionnaireFr) {
  const cibles = parcourir(SRC, (n) => /\.tsx?$/.test(n)).filter(
    (c) => !/\.test\.tsx?$/.test(c) && !c.includes(`${'i18n'}/`),
  )
  const corpus = cibles.map((c) => readFileSync(c, 'utf8')).join('\n')

  const citees = new Set(
    [...corpus.matchAll(/['"`]([a-zA-Z][\w]*(?:\.[\w]+)+)['"`]/g)].map((m) => m[1]),
  )
  const SENTINELLE = ' '
  const gabarits = [
    ...new Set(
      [...corpus.matchAll(/`([a-zA-Z][\w.]*\$\{[^`]*)`/g)].map((m) => m[1]).filter((g) => g.includes('.')),
    ),
  ].map((g) => {
    const morceaux = g.replace(/\$\{[^}]*\}/g, SENTINELLE).split(SENTINELLE)
    const motif = morceaux.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\w]+')
    return { gabarit: g, re: new RegExp('^' + motif + '$') }
  })

  const inemployees = []
  for (const cle of dictionnaireFr.keys()) {
    const base = cle.replace(/_(zero|one|two|few|many|other)$/, '')
    if (citees.has(cle) || citees.has(base)) continue
    if (gabarits.some((g) => g.re.test(cle) || g.re.test(base))) continue
    inemployees.push({ cle, valeur: dictionnaireFr.get(cle) })
  }
  return { inemployees, gabarits: gabarits.map((g) => g.gabarit), citees: citees.size }
}

/**
 * Ce que le lecteur de dictionnaire de `check-i18n.mjs` voit du fichier réel.
 *
 * Ce n'est pas une critique de style : `questionsEnDouble` interroge le
 * dictionnaire PAR SA CLÉ, et toute clé rendue sous un nom faux y devient
 * invisible. Les deux gardes qui parcourent les VALEURS — aveux et promesses —
 * perdent, elles, exactement les entrées que ce lecteur ne rend pas.
 */
export function deltaDuLecteurDeCheckI18n(reelFr) {
  const vu = dictionnaireAPlat(readFileSync(join(SRC, 'i18n/fr.ts'), 'utf8'))
  return {
    clesReelles: reelFr.size,
    clesVues: vu.size,
    fantomes: [...vu.keys()].filter((k) => !reelFr.has(k)),
    invisibles: [...reelFr.keys()].filter((k) => !vu.has(k)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LE RELEVÉ
// ─────────────────────────────────────────────────────────────────────────────

/** Regroupe des sites par écran, via le rattachement, et compte. */
function parEcran(sites, parFichier, coquille) {
  const table = new Map()
  const horsEcran = []
  let portes = 0
  for (const site of sites) {
    const ecrans = parFichier.get(site.fichier)
    if (!ecrans || ecrans.length === 0) {
      horsEcran.push(site)
      continue
    }
    portes++
    for (const ecran of ecrans) table.set(ecran, (table.get(ecran) ?? 0) + 1)
  }
  const partages = sites.filter((s) => (parFichier.get(s.fichier) ?? []).length >= 3)
  const dansLaCoquille = sites.filter((s) => coquille.has(s.fichier))
  return {
    table: Object.fromEntries([...table].sort((a, b) => b[1] - a[1])),
    sitesRattaches: portes,
    sitesHorsEcran: horsEcran.map((s) => ({ fichier: s.fichier, ligne: s.ligne })),
    partSurComposantsPartages: partages.length,
    partDansLaCoquille: dansLaCoquille.length,
  }
}

/** Part du total portée par les cinq pires écrans. */
function concentration(table, total) {
  const valeurs = Object.values(table)
  const cinq = valeurs.slice(0, 5).reduce((a, b) => a + b, 0)
  const somme = valeurs.reduce((a, b) => a + b, 0)
  return {
    ecransTouches: valeurs.length,
    porteeTotale: somme,
    cinqPires: cinq,
    partDesCinqPires: somme ? Math.round((cinq / somme) * 1000) / 10 : 0,
    totalDeSites: total,
  }
}

/**
 * LA GARDE DU GARDE, et c'est le cœur du sujet.
 *
 * « Aucun défaut » et « je n'ai rien lu » s'écrivent pareil dans un journal. Un
 * relevé qui balaierait zéro fichier rendrait un rapport parfaitement propre, et
 * ce rapport serait le pire mensonge que ce lot puisse produire. Chaque source
 * de vérité est donc comptée AVANT d'être interprétée, et un compte nul arrête
 * tout — y compris un MOTIF de lecture qui ne trouve plus rien, parce qu'un
 * motif périmé se tait exactement comme un dépôt sain.
 */
function exigerDesLectures(lu) {
  const manques = []
  if (lu.routes === 0) manques.push('ZÉRO route lue dans le routeur')
  if (lu.fichiersHex === 0) manques.push('ZÉRO fichier balayé pour les couleurs')
  if (lu.fichiersTsx === 0) manques.push('ZÉRO fichier TSX analysé pour les chaînes visibles')
  if (lu.jetons === 0) manques.push('ZÉRO jeton lu dans tokens.css')
  if (lu.jetonsDeCouleur === 0) manques.push('ZÉRO jeton de COULEUR lu dans tokens.css')
  if (lu.clesFr === 0) manques.push('ZÉRO clé lue dans fr.ts')
  if (lu.clesEn === 0) manques.push('ZÉRO clé lue dans en.ts')
  if (lu.racinesDEcran === 0) manques.push('AUCUNE route rattachée à un composant : le motif `element=` ne trouve plus rien')
  if (lu.hexTotal === 0) manques.push('ZÉRO couleur hexadécimale trouvée nulle part, pas même dans les gardes : le motif est cassé')
  if (lu.chainesBrutes === 0) manques.push('ZÉRO chaîne littérale trouvée dans le TSX, pas même écartée : l’analyseur ne descend plus dans le JSX')
  if (lu.clesCitees === 0) manques.push('ZÉRO clé citée trouvée dans les sources : le motif d’appel de `t()` est cassé')
  if (lu.gabarits === 0) manques.push('ZÉRO clé composée trouvée : le motif des gabarits est cassé, et des clés vivantes passeraient pour orphelines')
  if (lu.rattachements === 0) manques.push('AUCUN fichier rattaché à un écran : le suivi des imports ne descend plus')

  /**
   * Une FORME de lecture qui ne mord plus, alors que les autres mordent.
   *
   * Les cinq attributs et les neuf propriétés sont lus séparément. Si l'une des
   * deux familles tombe à zéro pendant que l'autre trouve, ce n'est pas le
   * produit qui s'est assaini d'un seul côté : c'est le motif qui a cessé de
   * voir. Le seuil est « au moins une mordue par famille », le plus faible qui
   * distingue encore « rien à signaler » de « plus rien de lu ».
   */
  const parFamille = (noms) => noms.reduce((somme, n) => somme + (lu.genresVus[n] ?? 0), 0)
  const vusAttributs = parFamille([...ATTRIBUTS_VISIBLES])
  const vusProprietes = parFamille([...PROPRIETES_LIBELLE].map((n) => `propriété ${n}`))
  if (lu.genresVus.texte === undefined)
    manques.push('AUCUN nœud de texte JSX lu : l’analyseur ne rend plus de `JsxText`')
  if (vusAttributs === 0)
    manques.push(
      'AUCUN des cinq attributs visibles rencontré avec une valeur littérale, nulle part : ' +
        'la lecture des attributs est cassée',
    )
  if (vusProprietes === 0)
    manques.push(
      'AUCUNE des neuf propriétés de libellé rencontrée, nulle part : la liste ' +
        '`PROPRIETES_LIBELLE` ne couvre plus aucun composant du dépôt',
    )

  /**
   * Le symétrique du zéro : le TOUT. Si la moitié des jetons passait pour
   * inemployée, ce ne serait pas une feuille à nettoyer, ce serait la détection
   * d'emploi qui aurait cessé de fonctionner — et le rapport enverrait retirer
   * la palette.
   */
  if (lu.jetonsSansEmploi > lu.jetons / 2)
    manques.push(
      `${lu.jetonsSansEmploi} jetons sur ${lu.jetons} passent pour inemployés : ` +
        'ce n’est pas une palette morte, c’est la détection d’emploi qui l’est',
    )

  if (manques.length > 0) {
    throw new Error(
      'jetons-i18n : le relevé REFUSE de rendre un chiffre qu’il n’a pas lu.\n  - ' +
        manques.join('\n  - ') +
        '\n\nCe n’est pas « aucun défaut ». C’est une lecture cassée, et les deux ' +
        's’écrivent pareil dans un journal — d’où ce refus.',
    )
  }
}

/**
 * @returns {object} le relevé complet, sérialisable.
 */
export function releverJetonsEtI18n() {
  const { routes, parFichier, coquille, racinesTrouvees } = rattachementDesEcrans()
  const { nu, jetons } = lireLesJetons()

  const jetonsDeCouleur = [...jetons].filter(([, v]) => v.some((x) => /^#[0-9a-fA-F]{3,8}$/.test(x)))

  const { sites: sitesHex, balayes: fichiersHex } = releverLesHex(jetons)
  const sansEmploi = jetonsSansEmploi(jetons, nu)

  const fr = lireDictionnaire(join(SRC, 'i18n/fr.ts'), 'fr')
  const en = lireDictionnaire(join(SRC, 'i18n/en.ts'), 'en')
  const valeursConnues = new Set([...fr.values(), ...en.values()])

  const {
    sites: sitesChaines,
    ecartes,
    balayes: fichiersTsx,
    genresVus,
  } = releverLesChainesVisibles(valeursConnues)
  const { inemployees, gabarits, citees } = clesSansEmploi(fr)
  const exemptions = exemptionsDeCheckI18n(fr)

  exigerDesLectures({
    routes: routes.length,
    fichiersHex,
    fichiersTsx,
    jetons: jetons.size,
    jetonsDeCouleur: jetonsDeCouleur.length,
    clesFr: fr.size,
    clesEn: en.size,
    racinesDEcran: racinesTrouvees,
    rattachements: parFichier.size,
    hexTotal: sitesHex.length,
    chainesBrutes: sitesChaines.length + ecartes.length,
    clesCitees: citees,
    gabarits: gabarits.length,
    jetonsSansEmploi: sansEmploi.length,
    genresVus,
  })

  const hexParCategorie = {}
  for (const s of sitesHex) hexParCategorie[s.categorie] = (hexParCategorie[s.categorie] ?? 0) + 1
  const hexProduit = sitesHex.filter((s) => s.categorie === 'produit')
  const hexEcrans = parEcran(hexProduit, parFichier, coquille)

  // Les chaînes visibles, réparties selon leur place dans le produit.
  const exemptesDeCheckI18n = new Set(['src/routes/KitchenSink.tsx'])
  const chainesProduit = sitesChaines.filter((s) => !exemptesDeCheckI18n.has(s.fichier))
  const chainesExemptees = sitesChaines.filter((s) => exemptesDeCheckI18n.has(s.fichier))
  const chainesEcrans = parEcran(chainesProduit, parFichier, coquille)

  return {
    date: new Date().toISOString().slice(0, 10),

    lu: {
      routes: routes.length,
      fichiersBalayesPourLesCouleurs: fichiersHex,
      fichiersTsxAnalyses: fichiersTsx,
      jetonsLus: jetons.size,
      jetonsDeCouleur: jetonsDeCouleur.length,
      clesFr: fr.size,
      clesEn: en.size,
      routesRattacheesAUnComposant: racinesTrouvees,
      fichiersRattachesAUnEcran: parFichier.size,
      fichiersDeLaCoquille: coquille.size,
    },

    axe1_couleursEnDur: {
      total: sitesHex.length,
      parCategorie: hexParCategorie,
      produit: hexProduit,
      aRemplacerParUnJetonExistant: hexProduit.filter((s) => s.proche?.identique).length,
      demandantUnJetonNeuf: hexProduit.filter((s) => !s.proche?.identique).length,
      illustration: sitesHex.filter((s) => s.categorie === 'illustration'),
      commentaire: sitesHex.filter((s) => s.categorie === 'commentaire'),
      garde: sitesHex.filter((s) => s.categorie === 'garde').length,
      ecrans: hexEcrans,
      concentration: concentration(hexEcrans.table, hexProduit.length),
    },

    axe1bis_jetonsSansEmploi: {
      total: sansEmploi.length,
      orphelins: sansEmploi.filter((j) => j.statut === 'orphelin'),
      gardesSeules: sansEmploi.filter((j) => j.statut === 'garde'),
      vivantsDansLaFeuille: sansEmploi.filter((j) => j.statut === 'vivant'),
    },

    axe2_chainesVisibles: {
      total: sitesChaines.length,
      horsPageDeControle: chainesProduit.length,
      dansLaPageDeControle: chainesExemptees.length,
      sites: chainesProduit,
      dejaDansUnDictionnaire: chainesProduit.filter((s) => s.dansLeDictionnaire).length,
      formesDeLectureQuiOntMordu: genresVus,
      ecartes: {
        total: ecartes.length,
        parRaison: ecartes.reduce((acc, e) => ({ ...acc, [e.raison]: (acc[e.raison] ?? 0) + 1 }), {}),
        details: ecartes,
      },
      ecrans: chainesEcrans,
      concentration: concentration(chainesEcrans.table, chainesProduit.length),
    },

    axe2bis_dictionnaires: {
      asymetrie: {
        dansFrAbsentDeEn: [...fr.keys()].filter((k) => !en.has(k)),
        dansEnAbsentDeFr: [...en.keys()].filter((k) => !fr.has(k)),
      },
      clesSansEmploi: {
        total: inemployees.length,
        cles: inemployees,
        gabaritsResolus: gabarits,
      },
      exemptionsNommeesDeCheckI18n: exemptions,
      lecteurDeCheckI18n: deltaDuLecteurDeCheckI18n(fr),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SORTIE EN CLAIR
// ─────────────────────────────────────────────────────────────────────────────

function tableau(titre, table) {
  console.log(`\n  ${titre}`)
  const entrees = Object.entries(table)
  if (entrees.length === 0) return console.log('    (aucun)')
  const large = Math.max(...entrees.map(([k]) => k.length))
  for (const [k, v] of entrees) console.log(`    ${k.padEnd(large)}  ${v}`)
}

if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  let releve
  try {
    releve = releverJetonsEtI18n()
  } catch (erreur) {
    console.error('✗ ' + erreur.message)
    exit(1)
  }

  const { lu, axe1_couleursEnDur: a1, axe1bis_jetonsSansEmploi: a1b } = releve
  const { axe2_chainesVisibles: a2, axe2bis_dictionnaires: a2b } = releve

  console.log('RELEVÉ JETONS & I18N — ' + releve.date)
  console.log('\nCE QUI A ÉTÉ LU (aucun de ces chiffres ne peut valoir zéro) :')
  for (const [k, v] of Object.entries(lu)) console.log(`  ${k.padEnd(34)} ${v}`)

  console.log('\n── AXE 1 · couleurs hexadécimales hors tokens.css ──')
  console.log(`  total trouvé            ${a1.total}`)
  for (const [k, v] of Object.entries(a1.parCategorie)) console.log(`    ${k.padEnd(20)} ${v}`)
  console.log(`  (a) produit peint       ${a1.produit.length}`)
  console.log(`      dont jeton existant de valeur identique : ${a1.aRemplacerParUnJetonExistant}`)
  console.log(`      dont il faudrait un jeton neuf          : ${a1.demandantUnJetonNeuf}`)
  for (const s of a1.produit)
    console.log(
      `      ${s.fichier}:${s.ligne}  ${s.couleur}` +
        (s.proche ? `  → ${s.proche.jeton} (${s.proche.valeur}, écart ${s.proche.ecart})` : ''),
    )
  console.log(`  (b) illustration        ${a1.illustration.length}`)
  for (const s of a1.illustration)
    console.log(
      `      ${s.fichier}:${s.ligne}  ${s.couleur}` +
        (s.proche ? `  → ${s.proche.jeton} (écart ${s.proche.ecart})` : ''),
    )
  console.log(`  (c) garde hors produit  ${a1.garde}`)
  console.log(`  (d) simple commentaire  ${a1.commentaire.length}`)
  for (const s of a1.commentaire) console.log(`      ${s.fichier}:${s.ligne}  ${s.couleur}`)
  tableau('écran → couleurs en dur', a1.ecrans.table)
  console.log(`    concentration : ${JSON.stringify(a1.concentration)}`)

  console.log('\n── AXE 1 bis · jetons que plus rien n’emploie ──')
  console.log(`  orphelins (nulle part)          ${a1b.orphelins.length}`)
  for (const j of a1b.orphelins) console.log(`      ${j.jeton}  ${j.valeurs.join(' / ')}`)
  console.log(`  cités par une garde seulement   ${a1b.gardesSeules.length}`)
  for (const j of a1b.gardesSeules) console.log(`      ${j.jeton}  ${j.valeurs.join(' / ')}`)
  console.log(`  vivants dans tokens.css         ${a1b.vivantsDansLaFeuille.length}`)
  for (const j of a1b.vivantsDansLaFeuille) console.log(`      ${j.jeton}`)

  console.log('\n── AXE 2 · chaînes visibles écrites en littéral ──')
  console.log(`  total retenu                    ${a2.total}`)
  console.log(`    dans src/routes/KitchenSink   ${a2.dansLaPageDeControle}   (exempté par check-i18n)`)
  console.log(`    ailleurs dans le produit      ${a2.horsPageDeControle}`)
  console.log(`    dont valeur déjà au dico      ${a2.dejaDansUnDictionnaire}`)
  for (const s of a2.sites) console.log(`      ${s.fichier}:${s.ligne}  [${s.genre}] « ${s.valeur} »`)
  console.log(`  écartés comme non-texte         ${a2.ecartes.total}`)
  for (const [k, v] of Object.entries(a2.ecartes.parRaison)) console.log(`      ${k.padEnd(28)} ${v}`)
  tableau('écran → chaînes visibles', a2.ecrans.table)
  console.log(`    concentration : ${JSON.stringify(a2.concentration)}`)

  console.log('\n── AXE 2 bis · les dictionnaires eux-mêmes ──')
  console.log(`  clés fr / en                    ${lu.clesFr} / ${lu.clesEn}`)
  console.log(`  dans fr absent de en            ${a2b.asymetrie.dansFrAbsentDeEn.length}`)
  console.log(`  dans en absent de fr            ${a2b.asymetrie.dansEnAbsentDeFr.length}`)
  console.log(`  clés que plus rien n’emploie    ${a2b.clesSansEmploi.total}`)
  for (const c of a2b.clesSansEmploi.cles) console.log(`      ${c.cle}   « ${c.valeur} »`)
  console.log('\n  ce que les exemptions nommées de check-i18n cachent AUJOURD’HUI :')
  for (const [nom, etat] of Object.entries(a2b.exemptionsNommeesDeCheckI18n)) {
    if (typeof etat.total === 'number') {
      console.log(`    ${nom.padEnd(40)} ${etat.total} signalement(s) rejoué(s)`)
      for (const d of etat.details.slice(0, 5)) console.log(`        ${d.fichier} : ${d.signalements}`)
    } else {
      console.log(
        `    ${nom.padEnd(40)} clé ${etat.clePresente ? 'présente' : 'ABSENTE'}, ` +
          `motif ${etat.declencheraitEncore ? 'toujours déclenché' : 'PLUS DÉCLENCHÉ'}`,
      )
    }
  }

  const l = a2b.lecteurDeCheckI18n
  console.log(`  lecteur de check-i18n.mjs : ${l.clesVues} clés vues pour ${l.clesReelles} réelles`)
  console.log(`      rendues sous un nom FAUX    ${l.fantomes.length}`)
  console.log(`      jamais vues                 ${l.invisibles.length}`)

  const sortie = argv[2]
  if (sortie) {
    writeFileSync(sortie, JSON.stringify(releve, null, 2))
    console.log(`\nJSON complet → ${sortie}`)
  }
}
