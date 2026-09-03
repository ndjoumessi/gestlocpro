#!/usr/bin/env node
/**
 * RELEVÉ DES SOURCES : trois défauts d'accessibilité, comptés et rattachés à
 * des ÉCRANS.
 *
 *   1. les éléments interactifs qui ne peuvent PAS montrer d'anneau de focus ;
 *   2. les champs de formulaire sans libellé associé ;
 *   3. les sauts dans la hiérarchie des titres, composée à l'exécution.
 *
 * CE MODULE NE CORRIGE RIEN. Il mesure, et il rattache : un défaut sans écran
 * est une ligne de journal, un défaut avec son écran est une décision. C'est ce
 * rattachement qui permet de répondre à la seule question qui commande la suite
 * — les défauts sont-ils CONCENTRÉS sur quelques écrans et quelques composants
 * partagés, ou RÉPARTIS partout ?
 *
 *   node scripts/inventaire/lecture-sources.mjs
 *   node scripts/inventaire/lecture-sources.mjs --json /chemin/releve.json
 *
 * ── POURQUOI « REMONTER LA CHAÎNE » EST LE CŒUR DU FICHIER ──
 *
 * Un relevé naïf compte les SITES : chaque `<Button onClick>`, chaque `<Input>`,
 * chaque titre. Il produit un grand nombre, et ce nombre est faux dans le sens
 * qui coûte le plus cher — il désigne des centaines d'endroits sains. Dans ce
 * dépôt, l'anneau de focus vient d'une règle GLOBALE de `tokens.css`, le libellé
 * d'un composant `Field` partagé, et le niveau d'un titre d'un `CardHeader` dont
 * le défaut vaut 3. Compter les sites revient à compter les consommateurs d'une
 * règle qui les couvre déjà.
 *
 * Chacun des trois relevés remonte donc jusqu'à l'endroit qui DÉCIDE, et compte
 * les faux positifs qu'il écarte au passage — un relevé qui n'annonce pas ce
 * qu'il a écarté ne se relit pas.
 *
 * ── CE QUI EST DÉJÀ GARDÉ AILLEURS, ET QUE CE FICHIER NE DOUBLONNE PAS ──
 *
 * `src/design-system/couches.test.ts` interdit déjà toute neutralisation de
 * l'`outline` dans `src/`. Avec la règle universelle de `tokens.css`, cela
 * signifie que TOUT élément capable de recevoir le focus porte un anneau. Le
 * DELTA que ce relevé mesure est donc l'autre moitié, celle qu'aucun test ne
 * regarde : les éléments qui ne peuvent pas recevoir le focus DU TOUT.
 *
 * PIÈGE TAILWIND v4 : ce fichier est balayé par la détection automatique des
 * sources. Une classe citée en littéral ici serait RÉELLEMENT générée dans le
 * CSS livré — `scripts/mesure-ui.mjs` et `src/design-system/chasseFixe.test.ts`
 * documentent déjà le piège. Tout motif de classe est donc ASSEMBLÉ par
 * fragments, jamais écrit d'un tenant.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { argv, exit } from 'node:process'
import { pathToFileURL } from 'node:url'
import { RACINE, exigerUnInventairePlein, inventaireDesRoutes } from './routes.mjs'

const SRC = join(RACINE, 'src')

/**
 * Les fichiers de TEST sont écartés, et ce n'est pas une commodité.
 *
 * Un test monte ses propres composants, avec des libellés de fixture et des
 * titres inventés. `check-i18n.mjs` écarte les mêmes fichiers pour la même
 * raison, écrite au même endroit : ce ne sont pas des chaînes de produit, et
 * rien de ce qui vit là n'est livré. Les compter ferait monter les trois
 * chiffres sans qu'aucun utilisateur ne voie jamais le défaut correspondant.
 */
const EST_UN_TEST = /\.test\.tsx?$/

/**
 * Les deux fichiers de routage sont des FRONTIÈRES, pas des écrans.
 *
 * Les descendre comme n'importe quel composant ferait entrer les vingt écrans
 * de gestion dans la composition de `/app` — donc dans celle de tous les
 * écrans — et le rattachement, qui est l'objet de ce fichier, ne voudrait plus
 * rien dire. Leur contenu est lu par la table des routes, ci-dessous.
 */
const FRONTIERES = new Set(['src/App.tsx', 'src/app/EspaceApplicatif.tsx'])

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DES FICHIERS
// ─────────────────────────────────────────────────────────────────────────────

function descendre(depuis, sortie = []) {
  for (const entree of readdirSync(depuis)) {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) descendre(chemin, sortie)
    else if (/\.tsx$/.test(entree)) sortie.push(chemin)
  }
  return sortie
}

/**
 * Retire les commentaires SANS déplacer les lignes.
 *
 * `check-orphelins.mjs` a payé cette leçon : sa première rédaction signalait les
 * destinations citées dans la PROSE qui explique pourquoi on ne les écrit pas.
 * Ici c'est pire encore — les commentaires de ce dépôt citent volontiers des
 * balises (`« un second <h1> en ferait deux documents »`), et les lire comme du
 * code inventerait des titres qui n'existent pas.
 *
 * Les caractères sont remplacés par des espaces plutôt que supprimés : les
 * numéros de ligne du rapport doivent désigner le fichier réel.
 */
function sansCommentaires(source) {
  // UN BALAYAGE, ET PAS DEUX EXPRESSIONS RÉGULIÈRES, et il a fallu s'y brûler.
  //
  // La première rédaction faisait comme `check-orphelins.mjs` : deux `replace`.
  // Elle a mangé le routeur. `path="/app/*"` porte le délimiteur d'OUVERTURE
  // d'un commentaire de bloc à l'intérieur d'une chaîne, et le motif a donc
  // blanchi tout `App.tsx` depuis là jusqu'au délimiteur de fermeture suivant
  // — deux routes, la frontière paresseuse et l'écran 404. Le relevé rendait
  // « aucun défaut » sur des écrans dont il n'avait pas lu une ligne.
  //
  // On suit donc les chaînes. Le coût est vingt lignes ; le prix de l'autre
  // solution était un rapport faux qui avait l'air complet.
  const sortie = source.split('')
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (c === '"' || c === "'" || c === '`') {
      i = sauterChaine(source, i)
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      const fin = source.indexOf('*/', i + 2)
      const stop = fin === -1 ? source.length : fin + 2
      for (let k = i; k < stop; k++) if (sortie[k] !== '\n') sortie[k] = ' '
      i = stop
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      let k = i
      while (k < source.length && source[k] !== '\n') sortie[k++] = ' '
      i = k
      continue
    }
    i++
  }
  return sortie.join('')
}

function lignesDe(source) {
  const debuts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') debuts.push(i + 1)
  return (index) => {
    let bas = 0
    let haut = debuts.length - 1
    while (bas < haut) {
      const milieu = (bas + haut + 1) >> 1
      if (debuts[milieu] <= index) bas = milieu
      else haut = milieu - 1
    }
    return bas + 1
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DES BALISES JSX
// ─────────────────────────────────────────────────────────────────────────────

/** Éléments HTML sans contenu : ils ne s'empilent pas. */
const VIDES = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

/**
 * Le vocabulaire HTML retenu.
 *
 * Sert de FILTRE et pas seulement de documentation : sans lui, `useState<Jour>`
 * et `Parameters<typeof Icon>` se lisent comme des balises. Le second garde-fou
 * est le caractère qui PRÉCÈDE le chevron — un `<` collé à un identifiant ouvre
 * un paramètre de type, jamais un élément.
 */
const BALISES_HTML = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote',
  'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist',
  'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr',
  'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map',
  'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output',
  'p', 'param', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section',
  'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'svg',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr',
  'track', 'u', 'ul', 'var', 'video', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'g', 'defs', 'clipPath', 'linearGradient', 'stop', 'text', 'tspan', 'ellipse', 'use',
])

/**
 * Ce qui, COLLÉ au chevron, en fait un paramètre de type et non une balise.
 *
 * Le critère est l'absence d'espace, et il a coûté un essai. La première
 * rédaction regardait le dernier caractère NON BLANC avant le chevron : elle
 * rejetait donc `return <AppShell />`, c'est-à-dire la position la plus
 * courante d'un élément JSX dans tout le dépôt. `Demo` n'avait plus qu'un seul
 * composant, la coquille disparaissait de la composition des vingt écrans de
 * gestion, et le relevé rendait « aucun défaut » sur des écrans qu'il n'avait
 * pas lus — la panne exacte que ce lot existe pour rendre impossible.
 *
 * `useState<Jour>` colle son chevron à l'identifiant ; `return <AppShell />`
 * l'en sépare. C'est la seule différence, et elle suffit.
 */
const AVANT_UNE_BALISE = /[A-Za-z0-9_$]/

/** Saute une chaîne ou un gabarit à partir de son délimiteur ouvrant. */
function sauterChaine(source, i) {
  const fin = source[i]
  i++
  while (i < source.length) {
    const c = source[i]
    if (c === '\\') { i += 2; continue }
    if (fin === '`' && c === '$' && source[i + 1] === '{') {
      let profondeur = 1
      i += 2
      while (i < source.length && profondeur > 0) {
        if (source[i] === '{') profondeur++
        else if (source[i] === '}') profondeur--
        else if (source[i] === '"' || source[i] === "'" || source[i] === '`') { i = sauterChaine(source, i); continue }
        i++
      }
      continue
    }
    if (c === fin) return i + 1
    i++
  }
  return i
}

/**
 * Lit les balises JSX d'une source, ouvrantes et fermantes, avec leurs attributs.
 *
 * Une expression régulière ne suffit pas, et ce n'est pas de la coquetterie :
 * `parc/:unitId` s'écrit sur six lignes dans le routeur — `routes.mjs` le dit
 * déjà — et un `<EmptyState>` porte son `level={2}` trois lignes sous son nom.
 * Un motif mono-ligne les manquerait sans rien dire, ce qui est exactement la
 * forme de silence que ce lot existe pour éviter.
 */
function balisesDe(source) {
  const balises = []
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (c === '"' || c === "'" || c === '`') { i = sauterChaine(source, i); continue }
    if (c !== '<') { i++; continue }

    const precedent = source[i - 1] ?? ''
    const fermante = source[i + 1] === '/'
    let j = i + (fermante ? 2 : 1)
    if (!/[A-Za-z]/.test(source[j] ?? '')) { i++; continue }
    if (!fermante && precedent && AVANT_UNE_BALISE.test(precedent)) { i++; continue }

    let nom = ''
    while (j < source.length && /[A-Za-z0-9_.]/.test(source[j])) nom += source[j++]
    if (/^[a-z]/.test(nom) && !BALISES_HTML.has(nom)) { i++; continue }

    if (fermante) {
      while (j < source.length && source[j] !== '>') j++
      balises.push({ nom, fermante: true, debut: i, fin: j + 1 })
      i = j + 1
      continue
    }

    // Paramètre de type collé au nom : `<DataTable<Unit> …>`.
    if (source[j] === '<') {
      let profondeur = 0
      do {
        if (source[j] === '<') profondeur++
        else if (source[j] === '>') profondeur--
        j++
      } while (j < source.length && profondeur > 0)
    }

    const debutAttrs = j
    let accolades = 0
    let parentheses = 0
    let crochets = 0
    while (j < source.length) {
      const d = source[j]
      if (d === '"' || d === "'" || d === '`') { j = sauterChaine(source, j); continue }
      if (d === '{') accolades++
      else if (d === '}') accolades--
      else if (d === '(') parentheses++
      else if (d === ')') parentheses--
      else if (d === '[') crochets++
      else if (d === ']') crochets--
      else if (d === '>' && accolades <= 0 && parentheses <= 0 && crochets <= 0) break
      j++
    }
    const attrs = source.slice(debutAttrs, j)
    /*
      LE JSX PASSÉ EN PROP, qui vivait hors de portée.

      `<DataTable empty={<EmptyState … />} />` rend un titre, et ce titre est
      DANS un attribut. Sans cette descente, `/demo/paiements` n'avait qu'un
      seul titre au lieu de trois, quatorze `<EmptyState>` sur vingt-quatre
      disparaissaient du relevé, et les boutons passés en `action={…}` avec eux.
      Le compte tombait donc dans le sens qui ment : moins d'éléments lus, donc
      moins de défauts trouvés, donc un rapport plus propre qu'il ne l'est.

      Les indices sont replacés dans le repère du fichier : un défaut se lit
      `fichier:ligne`, pas `fichier:ligne de l'attribut`.
    */
    const sous = attrs.includes('<') ? balisesDe(attrs) : []
    for (const x of sous) {
      x.debut += debutAttrs
      x.fin += debutAttrs
    }
    balises.push({
      nom,
      fermante: false,
      autoFermante: /\/\s*$/.test(attrs) || VIDES.has(nom),
      attrs,
      sous,
      debut: i,
      fin: j + 1,
    })
    i = j + 1
  }
  return balises
}

/**
 * Chaîne d'ancêtres de chaque balise ouvrante, par empilement.
 *
 * Les balises nées d'un ATTRIBUT sont dépliées à leur place, avec la balise
 * porteuse pour ancêtre : c'est bien dedans qu'elles se rendent, et l'axe des
 * libellés en dépend — un `<Input>` passé en `champ={…}` d'un `<Field>` doit
 * continuer de voir son enveloppe.
 */
function empiler(balises, base = []) {
  const pile = [...base]
  const sortie = []
  for (const b of balises) {
    if (b.fermante) {
      for (let k = pile.length - 1; k >= 0; k--) {
        if (pile[k].nom === b.nom) { pile.length = Math.max(k, base.length); break }
      }
      continue
    }
    b.ancetres = [...pile]
    sortie.push(b)
    if (b.sous && b.sous.length > 0) sortie.push(...empiler(b.sous, [...pile, b]))
    if (!b.autoFermante) pile.push(b)
  }
  return sortie
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DES ATTRIBUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{present: boolean, litteral: string|null, expression: string|null}}
 */
function attribut(attrs, nom) {
  const echappe = nom.replace(/[-]/g, '\\-')
  // LA FRONTIÈRE DE NOM EST OBLIGATOIRE, et son absence a coûté l'écran d'accueil
  // de l'espace applicatif. Sans elle, chercher `index` dans
  // `index element={<Dashboard />}` consommait l'espace par `\s*`, tombait sur
  // le `e` d'`element` et concluait à un préfixe — donc `<Route index>` n'était
  // plus une route, donc `/app` et `/demo` n'avaient plus d'écran du tout. Le
  // même piège vaut pour `aria-label` cherché là où vit `aria-labelledby`.
  const motif = new RegExp(`(?:^|[\\s{])${echappe}(?![A-Za-z0-9_-])\\s*(=?)`, 'g')
  let m
  while ((m = motif.exec(attrs))) {
    const apres = m.index + m[0].length
    if (!m[1]) return { present: true, litteral: null, expression: null }
    let k = apres
    while (k < attrs.length && /\s/.test(attrs[k])) k++
    const d = attrs[k]
    if (d === '"' || d === "'") {
      const fin = sauterChaine(attrs, k)
      return { present: true, litteral: attrs.slice(k + 1, fin - 1), expression: null }
    }
    if (d === '{') {
      let profondeur = 0
      let f = k
      while (f < attrs.length) {
        const c = attrs[f]
        if (c === '"' || c === "'" || c === '`') { f = sauterChaine(attrs, f); continue }
        if (c === '{') profondeur++
        else if (c === '}') { profondeur--; if (profondeur === 0) break }
        f++
      }
      return { present: true, litteral: null, expression: attrs.slice(k + 1, f).trim() }
    }
    return { present: true, litteral: null, expression: null }
  }
  return { present: false, litteral: null, expression: null }
}

const aUnAttribut = (attrs, nom) => attribut(attrs, nom).present
const aUnEtalement = (attrs) => /\{\s*\.\.\./.test(attrs)

/** Valeur d'un attribut, littérale ou expression, sous forme de texte. */
function valeur(attrs, nom) {
  const a = attribut(attrs, nom)
  if (!a.present) return null
  return a.litteral ?? a.expression ?? ''
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS ET IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** Déclarations de composant en marge zéro : `export function X`, `const X = …`. */
const DECLARATION = /^(?:export\s+)?(?:function|const)\s+([A-Z]\w*)/gm

function composantsDuFichier(rel, code, ligneDe) {
  const bornes = []
  for (const m of code.matchAll(DECLARATION)) bornes.push({ nom: m[1], debut: m.index })
  if (bornes.length === 0) return []
  return bornes.map((b, k) => ({
    cle: `${rel}::${b.nom}`,
    rel,
    nom: b.nom,
    debut: b.debut,
    fin: k + 1 < bornes.length ? bornes[k + 1].debut : code.length,
    ligne: ligneDe(b.debut),
  }))
}

function resoudreChemin(rel, spec) {
  let base
  if (spec.startsWith('@/')) base = join('src', spec.slice(2))
  else if (spec.startsWith('.')) base = join(dirname(rel), spec)
  else return null
  for (const suffixe of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidat = base + suffixe
    try {
      if (statSync(join(RACINE, candidat)).isFile()) return candidat.split('\\').join('/')
    } catch { /* le chemin suivant */ }
  }
  return null
}

/**
 * `nom importé` → fichier source, ou `null` quand il vient du dehors.
 *
 * LES DEUX GUILLEMETS, et ce n'est pas de la générosité. `src/routes/SignUp.tsx`
 * est le seul fichier du dépôt écrit en guillemets doubles et points-virgules ;
 * un motif à guillemets simples n'y résolvait AUCUN import, donc `AuthLayout`
 * n'y était pas vu, donc l'écran d'inscription — quatre étapes, dix-sept
 * champs — passait pour un écran sans titre et sans rien à mesurer. Le silence
 * d'un motif désaccordé se lit exactement comme « aucun défaut ».
 */
function importsDuFichier(rel, code) {
  const table = new Map()
  const sources = new Map()
  for (const m of code.matchAll(/import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const cible = resoudreChemin(rel, m[2])
    const clause = m[1]
    for (const n of clause.matchAll(/([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?/g)) {
      const nom = n[2] ?? n[1]
      if (/^[A-Z]/.test(nom)) table.set(nom, cible)
      /* LA SOURCE, retenue à côté de la cible. `cible` vaut `null` pour tout ce
         qui vient du dehors, et confond alors « react-router-dom » avec
         n'importe quel paquet inconnu. La distinction est nécessaire à un seul
         endroit — l'anneau de focus, plus bas — et elle est ÉCRITE là-bas, pas
         devinée ici. */
      if (/^[A-Z]/.test(nom)) sources.set(nom, m[2])
    }
  }
  // `const X = lazy(() => import('…'))` : la frontière paresseuse d'`App.tsx`.
  for (const m of code.matchAll(/const\s+([A-Z]\w*)\s*=\s*lazy\([\s\S]{0,120}?import\(['"]([^'"]+)['"]\)/g)) {
    table.set(m[1], resoudreChemin(rel, m[2]))
    sources.set(m[1], m[2])
  }
  table.sources = sources
  return table
}

// ─────────────────────────────────────────────────────────────────────────────
// L'ANNEAU DE FOCUS
// ─────────────────────────────────────────────────────────────────────────────

/*
  Les motifs de classe sont ASSEMBLÉS. Voir l'en-tête du fichier : Tailwind v4
  balaie `scripts/`, et une classe écrite d'un tenant ici existerait pour de bon
  dans la feuille livrée — y compris celle que le dépôt s'interdit.
*/
/**
 * CE QUE LE DEHORS REND, quand on le sait et qu'on peut le dire.
 *
 * ═══ POURQUOI CETTE TABLE EXISTE, ET POURQUOI ELLE EST SI ÉTROITE ═══
 *
 * Le relevé refusait — à juste titre — de compter un site porté par un composant
 * qu'il ne sait pas lire : « tant qu'on ne sait pas ce qu'il rend, on ne peut ni
 * le compter ni l'écarter, et l'écarter en silence est la façon dont un chiffre
 * devient faux par le bas ». Il refusait donc, et le refus a duré.
 *
 * Ce qu'il refusait est UN site : `<Link role="menuitem" to="/" onClick>` dans le
 * menu de compte d'`AppShell`. Le commentaire de la garde l'avait anticipé au
 * mot près — « `<Link>` de react-router rendrait un `<a href>` focalisable, mais
 * aucun site du dépôt ne lui pose de geste, donc rien ne justifie de l'écrire en
 * dur ici ». Un site lui en pose un depuis ; la prémisse a cessé d'être vraie, et
 * le refus est devenu du bruit permanent sur un relevé que personne ne peut plus
 * lire.
 *
 * ═══ CE QUI EST ÉCRIT, ET CE QUI NE L'EST PAS ═══
 *
 * La SOURCE, pas le nom. Un composant maison nommé `Link` ne serait pas couvert :
 * c'est le module qui fait foi, et `react-router-dom` documente que `Link` et
 * `NavLink` rendent un `<a href>` — donc un élément NATIVEMENT focalisable, que
 * la règle universelle `*:focus-visible` de `tokens.css` couvre comme les autres.
 *
 * Rien d'autre n'y figure, et c'est le point : toute autre origine continue de
 * faire REFUSER le relevé. Cette table n'est pas une porte de sortie, c'est une
 * connaissance nommée — et si react-router changeait ce que `Link` rend, la ligne
 * serait fausse, ce qui est exactement le genre d'erreur qu'on veut pouvoir lire.
 */
const RENDUS_NATIFS_DU_DEHORS = {
  'react-router-dom': new Set(['Link', 'NavLink']),
}

const VARIANTE_FOCUS = 'focus' + '-visible'
const NEUTRALISATION_ANNEAU = new RegExp(`outline-${'none'}|outline:\\s*none`)
const ANNEAU_AU_SITE = new RegExp(`${VARIANTE_FOCUS}:|has-\\[:${VARIANTE_FOCUS}\\]`)
const REGLE_GLOBALE = new RegExp(`\\*:${VARIANTE_FOCUS}\\s*\\{[^}]*outline\\s*:`)

/** Éléments qui reçoivent le focus sans qu'on le leur demande. */
const FOCUSABLES = new Set(['button', 'select', 'textarea', 'input', 'summary', 'iframe', 'audio', 'video', 'object'])

/** Gestes d'ACTIVATION. `onChange` ou `onScroll` ne rendent rien interactif. */
const GESTES = ['onClick', 'onKeyDown', 'onKeyUp', 'onKeyPress', 'onPointerDown', 'onMouseDown', 'onDoubleClick']

/** Rôles ARIA qui promettent un élément actionnable. */
const ROLES_INTERACTIFS = new Set(['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'switch', 'checkbox', 'radio', 'slider', 'spinbutton', 'textbox', 'combobox'])

// ─────────────────────────────────────────────────────────────────────────────
// LES CHAMPS ET LEURS LIBELLÉS
// ─────────────────────────────────────────────────────────────────────────────

const CHAMPS_NATIFS = new Set(['input', 'select', 'textarea'])

/**
 * Composants de saisie qui NE POSENT PAS leur libellé et l'attendent de leur
 * appelant. Lu au fichier plutôt que recopié : la garde plus bas vérifie que
 * chacun accepte bien `aria-label` ou `id`, faute de quoi cette liste ment.
 */
const CHAMPS_PARTAGES = {
  Input: 'src/components/primitives/Input.tsx',
  PasswordInput: 'src/components/primitives/Input.tsx',
  Select: 'src/components/primitives/Input.tsx',
  Textarea: 'src/components/primitives/Input.tsx',
  Combobox: 'src/components/primitives/Combobox.tsx',
  DatePicker: 'src/components/primitives/DatePicker.tsx',
  MonthPicker: 'src/components/primitives/DatePicker.tsx',
}

/**
 * Composants de saisie qui POSENT leur propre libellé, par une prop obligatoire.
 *
 * Ce ne sont pas des exemptions de complaisance : chacun rend un `<label>`, une
 * `<legend>` ou un `aria-label` à partir d'une prop que le typage rend
 * obligatoire. Les compter comme des sites gonflerait le chiffre de trois
 * douzaines d'endroits parfaitement sains — le défaut même que ce fichier
 * cherche à ne pas commettre. La garde plus bas vérifie que la prop existe
 * toujours dans leur signature.
 */
const CHAMPS_QUI_SE_NOMMENT = {
  Checkbox: { fichier: 'src/components/primitives/Choice.tsx', prop: 'label' },
  RadioCards: { fichier: 'src/components/primitives/Choice.tsx', prop: 'legend' },
  SegmentedControl: { fichier: 'src/components/primitives/Choice.tsx', prop: 'label' },
}

/** L'enveloppe qui pose libellé, `id` et `aria-describedby` d'un coup. */
const ENVELOPPE_DE_CHAMP = new Set(['Field', 'Champ'])

// ─────────────────────────────────────────────────────────────────────────────
// LES TITRES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les TITREURS DYNAMIQUES : des composants dont le niveau se calcule.
 *
 * Aucune lecture de balise ne peut les voir — `PageHeader` rend `<Titre>`, où
 * `Titre` vaut `'h1'` ou `'h2'` selon un contexte, et `CardHeader` rend
 * `` `h${level}` `` avec 3 par défaut. Ils sont donc déclarés ici, avec une
 * SONDE : un motif qui doit continuer de se retrouver dans leur fichier. Le
 * jour où le défaut de `CardHeader` passe de 3 à 2, la sonde ne trouve plus
 * rien et le relevé refuse de tourner — plutôt que de rendre en silence une
 * hiérarchie qui n'est plus celle du produit.
 */
const TITREURS = {
  PageHeader: {
    fichier: 'src/components/layout/PageHeader.tsx',
    sonde: /const Titre = dansUnCadre \? 'h2' : 'h1'/,
    niveau: (_attrs, dansUnCadre) => (dansUnCadre ? 2 : 1),
    remarque:
      'rend `h1`, sauf monté dans un cadre (`CadreContext`) où il rend `h2` — ' +
      'la prévisualisation du portail est le seul cas, et une lecture statique ' +
      'ne peut pas savoir laquelle des deux branches est montée.',
  },
  CardHeader: {
    fichier: 'src/components/primitives/Card.tsx',
    sonde: /level = 3/,
    niveau: (attrs) => niveauExplicite(attrs) ?? 3,
    remarque: 'niveau par défaut 3 ; `level={2}` au site le remonte.',
  },
  EmptyState: {
    fichier: 'src/components/primitives/DataTable.tsx',
    sonde: /level = 3/,
    niveau: (attrs) => niveauExplicite(attrs) ?? 3,
    remarque: 'niveau par défaut 3 ; `level={2}` au site le remonte.',
  },
}

function niveauExplicite(attrs) {
  const v = valeur(attrs, 'level')
  if (v == null) return null
  const n = Number(String(v).replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n >= 1 && n <= 6 ? n : null
}

/**
 * Les composants montés mais NON RENDUS AU REPOS.
 *
 * `Modal` rend `null` tant qu'`open` est faux — la lecture de son fichier le
 * confirme, et la garde plus bas le vérifie. Un écran monte ses cinq modales en
 * bas de son arbre ; les compter dans la hiérarchie au repos ferait apparaître
 * cinq `h2` qu'aucun utilisateur ne voit tant qu'il n'a rien ouvert. Leur
 * hiérarchie propre est comptée à part : une modale est un `dialog` étiqueté
 * par son propre titre, donc un document dans le document.
 */
const HORS_REPOS = /Modal$/

// ─────────────────────────────────────────────────────────────────────────────
// LE RELEVÉ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LES PLANCHERS DE LECTURE, ET ILS SONT EXPORTÉS POUR ÊTRE TENUS.
 *
 * ═══ CE QU'ILS SONT ═══
 *
 * Un motif de lecture qui cesse de trouver ne doit pas se taire : « zéro champ »
 * et « je ne sais plus lire un champ » s'écrivent pareil dans un rapport.
 * Asymétriques par construction — dépasser ne dérange personne, tomber dessous
 * arrête tout.
 *
 * ═══ CE QU'ILS ÉTAIENT DEVENUS, MESURÉ LE 2026-09-03 ═══
 *
 * Leur commentaire promettait qu'ils « collent au réel plutôt que de flotter
 * loin dessous ». Ils flottaient de 29 % à 68 % dessous :
 *
 *     titres composés            435 réels pour 140  →  68 % perdables
 *     fichiers de test écartés   168 réels pour  60  →  64 %
 *     sites interactifs          273 réels pour 120  →  56 %
 *     composants indexés         318 réels pour 200  →  37 %
 *     balises JSX lues          2563 réels pour 1800 →  30 %
 *     fichiers scannés           100 réels pour  70  →  30 %
 *     champs de formulaire       126 réels pour  90  →  29 %
 *
 * Le relevé des titres pouvait donc perdre LES DEUX TIERS de ce qu'il lit sans
 * qu'une plainte sorte. Ce n'était plus un plancher, c'était une formalité.
 *
 * ═══ POURQUOI PERSONNE NE POUVAIT LE SAVOIR ═══
 *
 * Ces contrôles ne parlent QUE lorsqu'on passe dessous. Au-dessus, silence — et
 * un plancher qu'on n'a pas à monter n'est jamais monté. Rien n'imprimait
 * jamais l'écart. C'est le même défaut que `ROUTES_ATTENDUES` portait, réparé le
 * même jour, à ceci près qu'il ne flottait que d'un cran.
 *
 * ═══ D'OÙ L'EXPORT ═══
 *
 * `planchersDeLecture.test.ts` compare ces valeurs au relevé RÉEL et refuse un
 * écart de plus de 20 %. L'asymétrie d'exécution reste entière : ajouter des
 * fichiers ne fait toujours pas rougir une porte au navigateur. C'est la suite
 * serveur qui réclame la mise à jour, et elle dit quel nombre écrire.
 *
 * Posés à ~90 % du réel du 2026-09-03 : il faut environ 12 % de croissance pour
 * que la garde réclame un tour de clé.
 */
export const PLANCHERS_DE_LECTURE = {
  'fichiers scannés': 90,
  'balises JSX lues': 2300,
  'composants indexés': 285,
  'sites interactifs': 245,
  'champs de formulaire': 113,
  'titres composés': 390,
  'fichiers de test écartés': 151,
}

export function releverLesSources() {
  const routes = exigerUnInventairePlein(inventaireDesRoutes())

  // ── 1. Lire tous les fichiers, une fois ────────────────────────────────────
  const tousLesTsx = descendre(SRC).map((c) => relative(RACINE, c).split('\\').join('/'))
  const testsEcartes = tousLesTsx.filter((c) => EST_UN_TEST.test(c))
  const fichiers = new Map()

  for (const rel of tousLesTsx) {
    if (EST_UN_TEST.test(rel)) continue
    const brut = readFileSync(join(RACINE, rel), 'utf8')
    const code = sansCommentaires(brut)
    const ligneDe = lignesDe(code)
    const balises = empiler(balisesDe(code))
    fichiers.set(rel, {
      rel,
      code,
      brut,
      ligneDe,
      balises,
      imports: importsDuFichier(rel, code),
      composants: composantsDuFichier(rel, code, ligneDe),
    })
  }

  /*
    LE REFUS LE PLUS TÔT POSSIBLE, avant toute lecture qui en dépende.

    Sans lui, un `src/` vide ne rendait pas « je n'ai rien lu » mais une pile
    d'appels sur `f.balises` d'un fichier absent — un plantage se lit, mais il
    ne dit pas CE QUI manque, et le reste des gardes ne tournait jamais.
  */
  if (fichiers.size === 0) {
    throw new Error(
      'lecture-sources : ZÉRO fichier .tsx lu sous src/. Ce n’est pas « aucun défaut », ' +
        'c’est une lecture cassée — vérifiez le chemin de `descendre(SRC)`.',
    )
  }
  for (const frontiere of FRONTIERES) {
    if (!fichiers.has(frontiere)) {
      throw new Error(
        `lecture-sources : ${frontiere} n’a pas été lu. Sans le routeur, aucun écran n’a de ` +
          'composant racine, et les trois relevés rendraient « aucun défaut » sur du vide.',
      )
    }
  }

  // Index global : `fichier::Nom` → composant, et sa tranche de balises.
  const index = new Map()
  for (const f of fichiers.values()) {
    for (const c of f.composants) {
      c.balises = f.balises.filter((b) => b.debut >= c.debut && b.debut < c.fin)
      c.fichier = f
      index.set(c.cle, c)
    }
  }

  const resoudre = (rel, nomTag) => {
    const f = fichiers.get(rel)
    if (!f) return null
    if (f.imports.has(nomTag)) {
      const cible = f.imports.get(nomTag)
      return cible ? (index.get(`${cible}::${nomTag}`) ?? null) : null
    }
    return index.get(`${rel}::${nomTag}`) ?? null
  }

  // ── 2. Gardes des gardes : les motifs doivent encore trouver ───────────────
  const plaintes = []
  const balisesLues = [...fichiers.values()].reduce((n, f) => n + f.balises.length, 0)

  const tokens = readFileSync(join(SRC, 'design-system/tokens.css'), 'utf8')
  const anneauGlobal = REGLE_GLOBALE.test(tokens)
  if (!anneauGlobal) {
    plaintes.push(
      "anneau de focus · la règle universelle `*:" + VARIANTE_FOCUS + '` a disparu de ' +
        'src/design-system/tokens.css. TOUT le relevé de l’axe 1 repose sur elle : sans ' +
        'elle, ce ne sont plus quelques éléments non focalisables qu’il faut compter, mais ' +
        'chaque élément interactif du produit. Refus de rendre un chiffre qui mentirait par ' +
        'le bas.',
    )
  }

  for (const [nom, titreur] of Object.entries(TITREURS)) {
    const f = fichiers.get(titreur.fichier)
    if (!f) plaintes.push(`titres · ${titreur.fichier} introuvable : ${nom} ne peut plus être daté.`)
    else if (!titreur.sonde.test(f.brut)) {
      plaintes.push(
        `titres · la sonde de ${nom} (${titreur.sonde}) ne trouve plus rien dans ` +
          `${titreur.fichier}. Le niveau qu’il rend a changé, ou son écriture. Relisez le ` +
          `fichier et corrigez TITREURS — un niveau supposé faux fausse toute la hiérarchie.`,
      )
    }
  }

  {
    const modal = fichiers.get('src/components/primitives/Modal.tsx')
    if (!modal || !/if \(!open\) return null/.test(modal.brut)) {
      plaintes.push(
        'titres · `Modal` ne rend plus `null` quand il est fermé (motif `if (!open) return null` ' +
          'introuvable). Les modales entrent alors dans la hiérarchie AU REPOS, et l’exclusion ' +
          'posée par HORS_REPOS devient fausse.',
      )
    }
  }

  for (const [nom, decl] of Object.entries(CHAMPS_QUI_SE_NOMMENT)) {
    const f = fichiers.get(decl.fichier)
    const bloc = f?.composants.find((c) => c.nom === nom)
    if (!bloc || !new RegExp(`\\b${decl.prop}\\b`).test(f.code.slice(bloc.debut, bloc.fin))) {
      plaintes.push(
        `libellés · ${nom} ne montre plus de prop \`${decl.prop}\` dans ${decl.fichier}. ` +
          `Il était exempté PARCE QU’il pose son propre libellé ; s’il ne le pose plus, ` +
          `l’exemption couvre un défaut réel.`,
      )
    }
  }

  // ── 3. Table des routes → composants racines ───────────────────────────────
  const tableDesRoutes = (rel) => {
    const f = fichiers.get(rel)
    const sortie = new Map()
    for (const b of f.balises) {
      if (b.nom !== 'Route') continue
      const chemin = attribut(b.attrs, 'path').litteral
      const element = valeur(b.attrs, 'element') ?? ''
      const cibles = [...element.matchAll(/<([A-Z]\w*)/g)]
        .map((m) => resoudre(rel, m[1]))
        .filter((c) => c && !FRONTIERES.has(c.rel))
      const cle = chemin ?? (aUnAttribut(b.attrs, 'index') ? '' : null)
      if (cle === null) continue
      if (!sortie.has(cle)) sortie.set(cle, cibles)
    }
    return sortie
  }

  const routesPubliques = tableDesRoutes('src/App.tsx')
  const routesInternes = tableDesRoutes('src/app/EspaceApplicatif.tsx')
  const coquilleDemo = resoudre('src/app/EspaceApplicatif.tsx', 'Demo')

  const racinesDe = (adresse) => {
    if (routesPubliques.has(adresse)) return routesPubliques.get(adresse)
    if (adresse === '/app' || adresse === '/demo') {
      return [coquilleDemo, ...(routesInternes.get('') ?? [])].filter(Boolean)
    }
    if (adresse.startsWith('/demo/')) {
      const suffixe = adresse.slice('/demo/'.length)
      return [coquilleDemo, ...(routesInternes.get(suffixe) ?? [])].filter(Boolean)
    }
    // L'écran 404 : sa route est `*`, que `routes.mjs` écarte des adresses.
    return routesPubliques.get('*') ?? []
  }

  // ── 4. Composition de chaque écran ─────────────────────────────────────────
  /** Fermeture transitive des composants montés, modales comprises. */
  const composerLEcran = (racines) => {
    const vus = new Set()
    const file = [...racines]
    while (file.length > 0) {
      const c = file.shift()
      if (!c || vus.has(c.cle)) continue
      vus.add(c.cle)
      for (const b of c.balises) {
        if (!/^[A-Z]/.test(b.nom)) continue
        const cible = resoudre(c.rel, b.nom)
        if (cible && !FRONTIERES.has(cible.rel)) file.push(cible)
      }
    }
    return vus
  }

  const ecrans = routes.map((r) => {
    const racines = racinesDe(r.adresse)
    return { ...r, racines: racines.map((c) => c.cle), composants: composerLEcran(racines) }
  })

  const sansComposition = ecrans.filter((e) => e.composants.size === 0).map((e) => e.adresse)
  if (sansComposition.length > 0) {
    plaintes.push(
      `composition · ${sansComposition.length} écran(s) sans aucun composant résolu ` +
        `(${sansComposition.join(', ')}). Ce n’est pas « aucun défaut », c’est une lecture ` +
        `cassée : vérifiez la table des routes et la résolution des imports.`,
    )
  }

  /** Combien d'écrans montent ce composant — la mesure du PARTAGE. */
  const porteeDe = (cle) => ecrans.filter((e) => e.composants.has(cle)).length
  const ecransDe = (cle) => ecrans.filter((e) => e.composants.has(cle)).map((e) => e.adresse)

  const composantDuSite = (rel, index0) => {
    const f = fichiers.get(rel)
    return f?.composants.find((c) => index0 >= c.debut && index0 < c.fin) ?? null
  }

  // ── 5. AXE 1 · l'anneau de focus ───────────────────────────────────────────
  const focus = {
    sitesInteractifs: 0,
    defauts: [],
    fauxPositifs: {
      'natif focalisable, couvert par la règle universelle': 0,
      'composant du dépôt : l’anneau appartient à sa primitive, scannée à part': 0,
      '`tabIndex` posé au site, donc focalisable': 0,
      'cible de focus PROGRAMMATIQUE (`tabIndex={-1}`), sans geste ni rôle': 0,
      'option d’un motif `aria-activedescendant` : le focus reste au champ': 0,
      'conteneur qui DÉLÈGUE le clavier à des descendants focalisables': 0,
      'composant du DEHORS dont on sait qu’il rend un natif focalisable': 0,
    },
    neutralisations: [],
    anneauxDeclaresAuSite: 0,
    horsClavier: [],
    chaineNonRemontee: [],
  }

  for (const f of fichiers.values()) {
    if (NEUTRALISATION_ANNEAU.test(f.code)) focus.neutralisations.push(f.rel)
    for (const b of f.balises) {
      // L'anneau déclaré AU SITE se mesure sur toutes les balises et non sur
      // les seules cibles : `RadioCards` et la barre latérale le posent sur le
      // `<label>` ou la `<li>` qui ENVELOPPE le contrôle, précisément parce que
      // ce n'est pas l'élément qui reçoit le focus. Ne le chercher que sur les
      // cibles rendait zéro, et un motif qui rend zéro ne se relit plus.
      if (ANNEAU_AU_SITE.test(b.attrs)) focus.anneauxDeclaresAuSite++
      const geste = GESTES.some((g) => aUnAttribut(b.attrs, g))
      const role = valeur(b.attrs, 'role')
      const roleActionnable = role != null && ROLES_INTERACTIFS.has(String(role).replace(/['"]/g, ''))
      const natif = /^[a-z]/.test(b.nom)
      const natifInteractif = natif && (FOCUSABLES.has(b.nom) || (b.nom === 'a' && (aUnAttribut(b.attrs, 'href') || aUnAttribut(b.attrs, 'to'))))
      if (!geste && !roleActionnable && !natifInteractif && !aUnAttribut(b.attrs, 'tabIndex')) continue

      focus.sitesInteractifs++

      if (!natif) {
        /*
          REMONTER LA CHAÎNE VEUT DIRE SAVOIR OÙ ELLE MÈNE.

          Un `<Button onClick>` n'est pas un site : c'est un consommateur, et
          l'anneau vit dans `Button.tsx`, que ce balayage lit comme les autres —
          il y trouve `<button>`, `<a href>` et `<Link>`. Écarter sans le dire
          serait pourtant un tour de passe-passe : la ligne se scinde donc en
          trois, et la troisième — un composant venu du dehors qu'on ne sait pas
          nommer — est la seule qui ferait un trou dans le compte. Elle est
          comptée séparément pour qu'on la voie grossir.
        */
        const cible = resoudre(f.rel, b.nom)
        if (cible) {
          focus.fauxPositifs['composant du dépôt : l’anneau appartient à sa primitive, scannée à part']++
        } else if (RENDUS_NATIFS_DU_DEHORS[f.imports.sources?.get(b.nom)]?.has(b.nom)) {
          /* Du dehors, mais SU : voir `RENDUS_NATIFS_DU_DEHORS`. Le module fait
             foi, jamais le nom — un `Link` maison retomberait dans le refus. */
          focus.fauxPositifs['composant du DEHORS dont on sait qu’il rend un natif focalisable']++
        } else {
          // Le TROU du raisonnement : un composant venu du dehors qu'on ne sait
          // pas lire ET dont on n'a rien écrit. Il n'est pas écarté — il est
          // listé, et la garde plus bas le fait rougir.
          focus.chaineNonRemontee.push({ fichier: f.rel, ligne: f.ligneDe(b.debut), composant: b.nom })
        }
        continue
      }
      if (natifInteractif) {
        focus.fauxPositifs['natif focalisable, couvert par la règle universelle']++
        continue
      }

      const tab = attribut(b.attrs, 'tabIndex')
      if (tab.present) {
        /*
          `tabIndex={actif ? 0 : -1}` est un index ROULANT, pas un retrait : le
          composant en garde exactement un focalisable et déplace le 0 aux
          flèches — `Signaler`, `TenantDocuments`, `TenantPortal` et la grille
          de `DatePicker` le font tous. Chercher « -1 » quelque part dans
          l'expression les comptait comme inatteignables, c'est-à-dire
          exactement à l'envers. Seul un `-1` SEUL retire l'élément du parcours.
        */
        const ecrit = String(tab.expression ?? tab.litteral ?? '').trim()
        const negatif = ecrit === '-1'
        if (!negatif) {
          focus.fauxPositifs['`tabIndex` posé au site, donc focalisable']++
          continue
        }
        // `tabIndex={-1}` : focalisable au programme, jamais par le clavier.
        // Ce n'est pas le même défaut ; il est compté à part plutôt que noyé.
        if (geste || roleActionnable) {
          focus.horsClavier.push({
            fichier: f.rel,
            ligne: f.ligneDe(b.debut),
            balise: b.nom,
            motif: 'tabIndex={-1} avec un geste : atteignable à la souris, jamais au clavier',
          })
        } else {
          // Les six conteneurs de dialogue du produit — `Modal`, le tiroir de
          // la coquille, le panneau de l'en-tête public, trois modales du parc.
          // Ils reçoivent le focus À L'OUVERTURE, par programme, et n'ont rien
          // à faire dans le parcours de tabulation : leur anneau ne serait pas
          // un repère mais un cadre autour de la fenêtre entière.
          focus.fauxPositifs['cible de focus PROGRAMMATIQUE (`tabIndex={-1}`), sans geste ni rôle']++
        }
        continue
      }

      /*
        L'OPTION D'UN `aria-activedescendant`, où le focus ne doit PAS aller.

        Le motif ARIA du combobox laisse le focus sur le champ de saisie et
        désigne l'option courante par son identifiant. L'option n'est donc
        volontairement pas focalisable, et lui exiger un anneau reviendrait à
        exiger que le produit casse le motif — le `<li role="option">` de
        `Combobox` porte d'ailleurs `onMouseDown` et non `onClick` pour la même
        raison, écrite au-dessus de lui : un clic ferait perdre le focus au
        champ et refermerait la liste avant la sélection. La condition n'est pas
        « c'est une option », mais « le fichier câble bien le motif ».
      */
      if (role === 'option' && /aria-activedescendant/.test(f.code)) {
        focus.fauxPositifs['option d’un motif `aria-activedescendant` : le focus reste au champ']++
        continue
      }

      /*
        LE CONTENEUR QUI DÉLÈGUE, et il ne prétend pas être une cible.

        `<div role="grid" onKeyDown={auClavier}>` de `DatePicker` écoute les
        flèches pour les trente et un boutons de jour qu'il contient ; la racine
        de `MonthPicker` écoute Échap pour son déclencheur. Aucun des deux ne
        s'active au clic : ce sont des relais, et ce qui reçoit le focus vit
        dessous. Deux conditions, et les deux comptent — AUCUN geste de pointage
        au site, et au moins un descendant focalisable. Un conteneur qui écoute
        le clavier SANS rien de focalisable dessous serait, lui, un vrai défaut.
      */
      const pointage = ['onClick', 'onMouseDown', 'onPointerDown', 'onDoubleClick'].some((g) =>
        aUnAttribut(b.attrs, g),
      )
      const descendantFocalisable = f.balises.some(
        (x) => x.ancetres.includes(b) && (FOCUSABLES.has(x.nom) || /^[A-Z]/.test(x.nom)),
      )
      if (!pointage && !roleActionnable && descendantFocalisable) {
        focus.fauxPositifs['conteneur qui DÉLÈGUE le clavier à des descendants focalisables']++
        continue
      }

      const composant = composantDuSite(f.rel, b.debut)
      focus.defauts.push({
        fichier: f.rel,
        ligne: f.ligneDe(b.debut),
        balise: b.nom,
        composant: composant?.nom ?? null,
        role: role ?? null,
        motif: `<${b.nom}> porte un geste d’activation, ne peut pas recevoir le focus (ni balise focalisable, ni tabIndex) : l’anneau universel ne s’y applique jamais`,
        partage: composant ? porteeDe(composant.cle) : 0,
        ecrans: composant ? ecransDe(composant.cle) : [],
      })
    }
  }

  // ── 6. AXE 2 · les libellés ────────────────────────────────────────────────
  const libelles = {
    champsTrouves: 0,
    defauts: [],
    fauxPositifs: {
      'enveloppé par `Field`, qui pose `<label htmlFor>` et l’`id`': 0,
      '`aria-label` ou `aria-labelledby` au site': 0,
      '`id` repris par un `<label htmlFor>` du même fichier': 0,
      'enveloppé par un `<label>`': 0,
      'composant qui pose son propre libellé (prop obligatoire)': 0,
      'primitive partagée : `id`/`aria-label` délégués à l’appelant': 0,
      'champ caché (`type="hidden"`), sans libellé à porter': 0,
    },
  }

  const PRIMITIVES = new Set(Object.values(CHAMPS_PARTAGES))

  for (const f of fichiers.values()) {
    const htmlFors = new Set(
      f.balises
        .filter((b) => b.nom === 'label')
        .map((b) => valeur(b.attrs, 'htmlFor'))
        .filter((v) => v != null)
        .map((v) => String(v).trim()),
    )

    for (const b of f.balises) {
      const natif = CHAMPS_NATIFS.has(b.nom)
      const partage = Object.hasOwn(CHAMPS_PARTAGES, b.nom)
      const seNomme = Object.hasOwn(CHAMPS_QUI_SE_NOMMENT, b.nom)
      if (!natif && !partage && !seNomme) continue

      libelles.champsTrouves++

      if (seNomme) {
        libelles.fauxPositifs['composant qui pose son propre libellé (prop obligatoire)']++
        continue
      }
      const type = attribut(b.attrs, 'type').litteral
      if (natif && type === 'hidden') {
        libelles.fauxPositifs['champ caché (`type="hidden"`), sans libellé à porter']++
        continue
      }
      if (b.ancetres.some((a) => ENVELOPPE_DE_CHAMP.has(a.nom))) {
        libelles.fauxPositifs['enveloppé par `Field`, qui pose `<label htmlFor>` et l’`id`']++
        continue
      }
      if (aUnAttribut(b.attrs, 'aria-label') || aUnAttribut(b.attrs, 'aria-labelledby')) {
        libelles.fauxPositifs['`aria-label` ou `aria-labelledby` au site']++
        continue
      }
      if (b.ancetres.some((a) => a.nom === 'label')) {
        libelles.fauxPositifs['enveloppé par un `<label>`']++
        continue
      }
      // L'`id` littéral comme l'`id` d'expression : `htmlFor={id}` en regard de
      // `id={id}` associe aussi sûrement que deux chaînes égales, et c'est la
      // forme que prend l'association quand l'identifiant vient d'un `useId`.
      const id = attribut(b.attrs, 'id')
      const ecritureDeLId = (id.litteral ?? id.expression ?? '').trim()
      if (id.present && ecritureDeLId !== '' && htmlFors.has(ecritureDeLId)) {
        libelles.fauxPositifs['`id` repris par un `<label htmlFor>` du même fichier']++
        continue
      }
      // Dans une PRIMITIVE partagée, un `id` ou un `aria-label` d'expression,
      // ou un étalement de props, dit que le libellé vient de l'appelant. Le
      // défaut, s'il existe, est chez l'appelant — qui est scanné lui aussi.
      if (PRIMITIVES.has(f.rel) && (id.present || aUnEtalement(b.attrs))) {
        libelles.fauxPositifs['primitive partagée : `id`/`aria-label` délégués à l’appelant']++
        continue
      }

      const composant = composantDuSite(f.rel, b.debut)
      libelles.defauts.push({
        fichier: f.rel,
        ligne: f.ligneDe(b.debut),
        balise: b.nom,
        composant: composant?.nom ?? null,
        placeholder: valeur(b.attrs, 'placeholder'),
        motif:
          'aucun `<label htmlFor>`, `aria-label`, `aria-labelledby`, ni enveloppe `Field` ' +
          'ne nomme ce champ',
        portee: composant ? porteeDe(composant.cle) : 0,
        ecrans: composant ? ecransDe(composant.cle) : [],
      })
    }
  }

  // ── 7. AXE 3 · la hiérarchie des titres ────────────────────────────────────
  /**
   * La séquence de titres d'un composant, DANS L'ORDRE DE LA SOURCE.
   *
   * Le point du relevé est là : un écran rend `<PageHeader>` — donc `h1` — puis
   * monte un composant partagé qui rend `h3`. Les deux fichiers sont corrects
   * séparément ; c'est leur COMPOSITION qui saute une marche. Une lecture
   * fichier par fichier verrait deux fichiers sains et ne dirait rien.
   */
  /**
   * LES RETOURS JSX D'UN COMPOSANT, qui sont ses ÉTATS MUTUELLEMENT EXCLUSIFS.
   *
   * Sans eux, le relevé annonçait « trois `<h1>` » sur `/reinitialiser`. Les
   * trois existent bien dans le fichier — jeton invalide, mot de passe changé,
   * formulaire — mais ce sont trois clauses de garde, et l'utilisateur n'en voit
   * jamais qu'une. Les additionner invente un défaut sur un écran sain, ce qui
   * coûte plus cher que de n'en signaler aucun : un rapport qui désigne le
   * mauvais fichier apprend à ne pas le lire.
   *
   * Le DERNIER retour est le rendu principal ; les précédents sont les états
   * d'exception. `if (loading) return <PaymentsSkeleton />` tombe exactement
   * dans ce moule, et son squelette devient une variante à part entière plutôt
   * qu'un second `<h1>` imaginaire.
   */
  const retoursJsx = (composant) => {
    const code = composant.fichier.code
    const bornes = []
    const re = /\breturn\b/g
    re.lastIndex = composant.debut
    let m
    while ((m = re.exec(code)) !== null && m.index < composant.fin) {
      let k = m.index + 'return'.length
      while (k < code.length && /[\s(]/.test(code[k])) k++
      if (code[k] !== '<') continue
      /*
        SEULS LES RETOURS DU CORPS, et l'indentation les distingue.

        `PricingSection` et `PublicFooter` rendent leurs lignes par un
        `.map((x) => { return (…) })` : ce sont des retours de RAPPEL, pas des
        états de l'écran, et les compter comme tels rendait le même saut trois
        fois sur la page d'accueil. Prettier indente le corps d'un composant de
        deux espaces, quatre sous une clause de garde, et jamais moins de six
        dans un rappel imbriqué. La marge est donc le critère, et il est franc.
      */
      const debutLigne = code.lastIndexOf('\n', m.index) + 1
      const marge = /^[ \t]*/.exec(code.slice(debutLigne, m.index))[0].length
      if (marge <= 4) bornes.push(m.index)
    }
    return bornes
  }

  /**
   * LA VOIE d'un titre : la suite des sites de montage qui l'ont amené là.
   *
   * Elle est ce qui permet de SUBSTITUER un état à un autre au bon endroit de
   * la séquence, au lieu de le juxtaposer. Sans elle, l'état d'exception d'un
   * composant enfant devenait une séquence orpheline, privée du `<h1>` de
   * l'écran qui l'entoure — et le saut `h1 → h3` qu'il produit peut-être ne se
   * voyait plus. Une variante sans son contexte se lit « pas de saut » alors
   * qu'elle veut dire « pas regardé ».
   */
  const sequenceDe = (composant, vus = new Set(), dansUnCadre = false) => {
    if (!composant || vus.has(composant.cle)) return { principale: [], alternatives: [] }
    const prochain = new Set([...vus, composant.cle])
    const emissions = []
    const alternatives = []

    for (const b of composant.balises) {
      const ligne = composant.fichier.ligneDe(b.debut)
      if (/^h[1-6]$/.test(b.nom)) {
        // `{title && <h2>}` : le titre n'existe que si la prop est passée. Le
        // dire ici évite d'inventer un `h2` dans chaque `<Section>` sans titre.
        const garde = /\{\s*([A-Za-z_$][\w$]*)\s*&&\s*$/.exec(
          composant.fichier.code.slice(Math.max(0, b.debut - 40), b.debut),
        )
        emissions.push({
          index: b.debut,
          voie: [],
          niveau: Number(b.nom[1]),
          source: `${composant.rel}:${ligne}`,
          par: `<${b.nom}>`,
          conditionnelA: garde?.[1] ?? null,
        })
        continue
      }
      if (!/^[A-Z]/.test(b.nom)) continue

      const titreur = TITREURS[b.nom]
      if (titreur && resoudre(composant.rel, b.nom)?.rel === titreur.fichier) {
        emissions.push({
          index: b.debut,
          voie: [],
          niveau: titreur.niveau(b.attrs, dansUnCadre),
          source: `${composant.rel}:${ligne}`,
          par: `<${b.nom}>`,
          conditionnelA: null,
        })
        continue
      }
      if (HORS_REPOS.test(b.nom)) continue

      const cible = resoudre(composant.rel, b.nom)
      if (!cible || FRONTIERES.has(cible.rel)) continue

      /*
        LE CADRE, qui change le niveau de tout ce qui vit dessous.

        `PageHeader` rend `h2` — et non `h1` — quand un écran est monté DANS un
        cadre, et son fichier le dit : « un second `<h1>` en ferait deux
        documents ». La prévisualisation du portail monte ainsi trois écrans de
        gestion. Sans suivre le cadre à travers la récursion, le relevé y
        comptait QUATRE `<h1>` sur `/demo/portail` et signalait un défaut que
        le produit avait déjà résolu — le pire genre de faux positif, celui qui
        conteste un correctif existant.
      */
      const sousCadre = dansUnCadre || b.ancetres.some((a) => a.nom === 'DansUnCadre')
      const sous = sequenceDe(cible, prochain, sousCadre)
      const rhabiller = (t) => ({
        ...t,
        index: b.debut,
        voie: [b.debut, ...t.voie],
        par: `<${b.nom}> ▸ ${t.par}`,
        // LA CONDITION EST CONSOMMÉE ICI, et l'oublier coûtait trois `<h2>`.
        // `<Section>` ne rend son titre que si la prop `title` lui est passée ;
        // `FeatureGrid` la passe, donc le `h2` existe. En laissant la marque,
        // `Landing` la réévaluait contre `<FeatureGrid />`, qui n'a pas de
        // `title`, et le `h2` disparaissait un étage plus haut. La page
        // d'accueil affichait alors un saut `h1 → h3` que le produit ne fait
        // pas — un faux positif qui accuse un fichier innocent.
        conditionnelA: null,
      })
      // Une prop dont le nom garde un titre chez l'enfant : `<Section title=…>`.
      emissions.push(
        ...sous.principale
          .filter((t) => !t.conditionnelA || aUnAttribut(b.attrs, t.conditionnelA))
          .map(rhabiller),
      )
      alternatives.push(
        ...sous.alternatives.map((x) => ({
          nom: `${composant.nom} → ${x.nom}`,
          voie: [b.debut, ...x.voie],
          ancre: b.debut,
          sequence: x.sequence.map(rhabiller),
        })),
      )
    }

    const bornes = retoursJsx(composant)
    if (bornes.length <= 1) return { principale: emissions, alternatives }

    const groupes = new Map(bornes.map((b) => [b, []]))
    for (const e of emissions) {
      const borne = [...bornes].reverse().find((b) => b <= e.index) ?? bornes[0]
      groupes.get(borne).push(e)
    }
    const derniere = bornes[bornes.length - 1]
    const retenues = alternatives.filter((a) => a.ancre >= derniere)
    for (const borne of bornes.slice(0, -1)) {
      const sequence = groupes.get(borne)
      if (sequence.length > 0) {
        retenues.unshift({
          nom: `${composant.nom} · retour ligne ${composant.fichier.ligneDe(borne)}`,
          voie: [],
          ancre: composant.debut,
          sequence,
        })
      }
    }
    return { principale: groupes.get(derniere), alternatives: retenues }
  }

  /** Une variante : la séquence principale où un état d'exception prend sa place. */
  const substituer = (principale, alternative) => {
    const correspond = (t) => alternative.voie.every((v, k) => t.voie[k] === v)
    const premier = principale.findIndex(correspond)
    const reste = principale.filter((t) => !correspond(t))
    const place =
      premier !== -1
        ? Math.min(premier, reste.length)
        : Math.max(0, reste.findIndex((t) => t.index > (alternative.ancre ?? 0)))
    const ou = place === -1 ? reste.length : place
    return [...reste.slice(0, ou), ...alternative.sequence, ...reste.slice(ou)]
  }

  const titres = {
    titresTrouves: 0,
    sauts: [],
    sansH1: [],
    plusieursH1: [],
    parEcran: {},
    variantes: 0,
  }

  for (const e of ecrans) {
    const racines = e.racines.map((c) => index.get(c)).filter(Boolean)
    const parties = racines.map((r) => sequenceDe(r))
    const base = parties.flatMap((p) => p.principale)
    const variantes = [
      { nom: 'au repos', sequence: base },
      ...parties
        .flatMap((p) => p.alternatives)
        .map((a) => ({ nom: a.nom, sequence: substituer(base, a) })),
    ]
    titres.variantes += variantes.length

    const sautsDeLEcran = []
    let h1Min = Infinity
    let h1Max = 0

    for (const v of variantes) {
      titres.titresTrouves += v.sequence.length
      const nbH1 = v.sequence.filter((t) => t.niveau === 1).length
      h1Min = Math.min(h1Min, nbH1)
      h1Max = Math.max(h1Max, nbH1)

      let precedent = 0
      for (const t of v.sequence) {
        if (precedent > 0 && t.niveau > precedent + 1) {
          sautsDeLEcran.push({
            variante: v.nom,
            de: precedent,
            vers: t.niveau,
            source: t.source,
            par: t.par,
          })
        }
        precedent = t.niveau
      }
    }

    /*
      UN SAUT, UN SITE. Le même `h1 → h3` réapparaît dans chaque variante où il
      survit ; le compter à chaque fois gonflerait le chiffre par le nombre
      d'états de l'écran, ce qui ne dit rien de plus sur le défaut. On garde
      donc le site distinct, et la liste des états où il se voit.
    */
    const distincts = new Map()
    for (const s of sautsDeLEcran) {
      const cle = `${s.source}|${s.de}|${s.vers}`
      if (!distincts.has(cle)) distincts.set(cle, { ...s, variantes: [] })
      distincts.get(cle).variantes.push(s.variante)
    }
    const sautsUniques = [...distincts.values()].map(({ variante: _variante, ...s }) => s)

    titres.parEcran[e.adresse] = {
      sauts: sautsUniques.length,
      h1: h1Min === h1Max ? h1Min : `${h1Min}–${h1Max}`,
      variantes: variantes.length,
      sequence: variantes[0].sequence.map((t) => `h${t.niveau} ${t.par} (${t.source})`),
      detail: sautsUniques,
    }
    titres.sauts.push(...sautsUniques.map((s) => ({ ...s, ecran: e.adresse })))
    if (h1Max === 0) titres.sansH1.push(e.adresse)
    if (h1Max > 1) titres.plusieursH1.push({ ecran: e.adresse, h1: h1Max })
  }

  // ── 8. Rattachement écran → nombre, pour les axes 1 et 2 ───────────────────
  const parEcran = (defauts) => {
    const table = {}
    for (const e of ecrans) table[e.adresse] = 0
    for (const d of defauts) for (const a of d.ecrans ?? []) table[a] = (table[a] ?? 0) + 1
    return table
  }

  const partPartagee = (defauts) => {
    const total = defauts.length
    const partages = defauts.filter((d) => (d.partage ?? d.portee ?? 0) > 1)
    return {
      total,
      surDesComposantsPartages: partages.length,
      composantsPartages: [...new Set(partages.map((d) => `${d.fichier}::${d.composant}`))],
    }
  }

  // ── 9. Garde du garde : « rien trouvé » n'est pas « aucun défaut » ─────────
  const perimetre = {
    fichiersScannes: fichiers.size,
    testsEcartes: testsEcartes.length,
    balisesLues,
    routes: routes.length,
    composantsIndexes: index.size,
    anneauUniverselPresent: anneauGlobal,
  }

  /**
   * LES PLANCHERS, et ils collent au réel plutôt que de flotter loin dessous.
   *
   * Même asymétrie que `ROUTES_ATTENDUES` dans `routes.mjs` : dépasser ne
   * dérange personne, tomber dessous arrête tout. Un motif de lecture qui
   * cesse de trouver ne doit pas se taire — « zéro champ » et « je ne sais plus
   * lire un champ » s'écrivent pareil dans un journal, et c'est exactement la
   * confusion que ce lot existe pour rendre impossible.
   */
  const PLANCHERS = [
    ['fichiers scannés', perimetre.fichiersScannes, PLANCHERS_DE_LECTURE['fichiers scannés']],
    ['balises JSX lues', perimetre.balisesLues, PLANCHERS_DE_LECTURE['balises JSX lues']],
    ['composants indexés', perimetre.composantsIndexes, PLANCHERS_DE_LECTURE['composants indexés']],
    ['sites interactifs', focus.sitesInteractifs, PLANCHERS_DE_LECTURE['sites interactifs']],
    ['champs de formulaire', libelles.champsTrouves, PLANCHERS_DE_LECTURE['champs de formulaire']],
    ['titres composés', titres.titresTrouves, PLANCHERS_DE_LECTURE['titres composés']],
    ['fichiers de test écartés', perimetre.testsEcartes, PLANCHERS_DE_LECTURE['fichiers de test écartés']],
  ]
  for (const [quoi, combien, plancher] of PLANCHERS) {
    if (combien === 0) {
      plaintes.push(
        `lecture · ZÉRO ${quoi}. Ce n’est pas « aucun défaut », c’est un motif de lecture ` +
          `qui ne trouve plus rien. Corrigez la lecture avant de lire le rapport.`,
      )
    } else if (combien < plancher) {
      plaintes.push(
        `lecture · ${combien} ${quoi}, moins que le plancher de ${plancher}. Le motif est-il ` +
          `encore accordé à la façon dont ce dépôt s’écrit ? Un relevé qui rétrécit en silence ` +
          `rend « aucun défaut » pour « pas regardé ».`,
      )
    }
  }

  // Les exemptions doivent COUVRIR QUELQUE CHOSE. Une raison qui ne sert plus
  // est un tapis sous lequel on glissera le prochain défaut — `mesure-ui.mjs`
  // fait rougir les siennes pour la même raison.
  for (const [axe, table] of [
    ['anneau de focus', focus.fauxPositifs],
    ['libellés', libelles.fauxPositifs],
  ]) {
    for (const [raison, combien] of Object.entries(table)) {
      if (combien === 0) {
        plaintes.push(
          `${axe} · l’écart « ${raison} » n’écarte plus rien. Soit la forme a disparu du ` +
            `dépôt — retirez la ligne — soit le motif ne la reconnaît plus, et le chiffre est faux.`,
        )
      }
    }
  }

  if (focus.chaineNonRemontee.length > 0) {
    plaintes.push(
      `anneau de focus · ${focus.chaineNonRemontee.length} site(s) portés par un composant que ` +
        `la résolution d’imports ne sait pas suivre : ` +
        `${[...new Set(focus.chaineNonRemontee.map((x) => x.composant))].join(', ')}. ` +
        `Tant qu’on ne sait pas ce qu’il rend, on ne peut ni le compter ni l’écarter — et ` +
        `l’écarter en silence est la façon dont un chiffre devient faux par le bas.`,
    )
  }

  if (focus.anneauxDeclaresAuSite === 0) {
    plaintes.push(
      'anneau de focus · aucun anneau déclaré au site. Le dépôt en pose au moins deux — la ' +
        'tuile de `RadioCards` et l’entrée de la barre latérale — par une variante `has-[…]`. ' +
        'Zéro veut donc dire que le motif ne les reconnaît plus, pas qu’ils ont disparu.',
    )
  }

  /**
   * CE QUE CETTE LECTURE NE VOIT PAS, écrit dans la sortie et non seulement
   * dans un rapport de passage.
   *
   * Chaque garde de ce dépôt dit sa limite dans son propre fichier — `cibles`,
   * `zonesSures`, `rognage`, `check-i18n`. Un relevé qui tairait la sienne
   * laisserait croire que zéro veut dire zéro partout, alors qu'il veut dire
   * « zéro dans ce que je sais lire ».
   */
  const limites = [
    'GÉOMÉTRIE : un anneau de focus peint HORS d’un parent qui rogne (`overflow` ' +
      'non visible) est invisible à l’écran et parfaitement lisible dans le fichier. ' +
      'C’est le défaut que `rognage.test.ts` traque par la cohabitation ; seule une ' +
      'mesure au navigateur le voit vraiment.',
    'CONTRASTE : un anneau présent mais peu contrasté sur son fond compte ici comme ' +
      'un anneau. `scripts/mesure-ui.mjs` mesure les contrastes ; ce relevé compte des ' +
      'balises.',
    'BRANCHES DANS UN SEUL RETOUR : `{onglet === "x" && <A />}{onglet === "y" && <B />}` ' +
      'monte deux écrans exclusifs dans la même expression. Les variantes de ce relevé ' +
      'suivent les RETOURS, pas les ternaires ni les `&&` — la prévisualisation du ' +
      'portail concatène donc ses trois onglets en une seule séquence de titres.',
    'CADRE CONTEXTUEL : `PageHeader` rend `h2` sous `CadreContext`. Le relevé suit le ' +
      'montage `<DansUnCadre>` en lecture directe ; un contexte fourni autrement — par ' +
      'un provider posé ailleurs — lui échapperait.',
    'NIVEAU CALCULÉ : `level={n}` où `n` est une variable n’est pas résolu. Aucun site ' +
      'du dépôt ne l’écrit ainsi aujourd’hui ; le jour où l’un le fera, son titre sera ' +
      'compté au niveau par défaut, donc peut-être au mauvais.',
    'LIBELLÉ VENU D’AILLEURS : un `aria-label` composé dans une variable, ou un `id` ' +
      'passé de deux fichiers plus haut, est vu comme « délégué à l’appelant ». Le ' +
      'relevé remonte UNE marche de la chaîne, pas dix.',
    'MODALES : elles sont retirées de la hiérarchie AU REPOS, puisque `Modal` rend ' +
      '`null` fermé. La hiérarchie de leur contenu ouvert n’est donc pas mesurée ici.',
    'ROUTES À PARAMÈTRE : `parc/:unitId` n’est pas une adresse qu’on visite telle ' +
      'quelle et `routes.mjs` l’écarte. Le dossier d’un logement n’est donc rattaché à ' +
      'aucun écran de ce relevé, alors que ses défauts, eux, existeraient.',
  ]

  return {
    genereLe: new Date().toISOString().slice(0, 10),
    perimetre,
    limites,
    plaintes,
    ecrans: ecrans.map((e) => ({
      adresse: e.adresse,
      roles: e.roles,
      origine: e.origine,
      vitrine: e.vitrine,
      racines: e.racines,
      composants: e.composants.size,
    })),
    anneauDeFocus: {
      ...focus,
      parEcran: parEcran(focus.defauts),
      concentration: partPartagee(focus.defauts),
    },
    libelles: {
      ...libelles,
      parEcran: parEcran(libelles.defauts),
      concentration: partPartagee(libelles.defauts),
    },
    titres,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT
// ─────────────────────────────────────────────────────────────────────────────

function tableau(titre, table, total) {
  const lignes = Object.entries(table)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  console.log(`\n  ${titre} — ${lignes.length} écran(s) touché(s) sur ${Object.keys(table).length}`)
  if (lignes.length === 0) {
    console.log('    (aucun)')
    return
  }
  for (const [adresse, n] of lignes) console.log(`    ${String(n).padStart(4)}  ${adresse}`)
  const cinq = lignes.slice(0, 5).reduce((s, [, n]) => s + n, 0)
  const somme = lignes.reduce((s, [, n]) => s + n, 0)
  console.log(
    `    → les 5 pires écrans portent ${cinq}/${somme} rattachements ` +
      `(${somme ? Math.round((cinq / somme) * 100) : 0} %), pour ${total} défaut(s) distinct(s).`,
  )
}

if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  const releve = releverLesSources()

  const sortieJson = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null
  if (sortieJson) {
    writeFileSync(sortieJson, JSON.stringify(releve, null, 2))
    console.log(`· relevé complet écrit dans ${sortieJson}`)
  }

  const p = releve.perimetre
  console.log(
    `\n· périmètre : ${p.fichiersScannes} fichiers, ${p.composantsIndexes} composants, ` +
      `${p.balisesLues} balises, ${p.routes} routes ; ${p.testsEcartes} fichiers de test écartés.`,
  )

  console.log(`\n═══ AXE 1 · anneau de focus ═══`)
  console.log(`  ${releve.anneauDeFocus.defauts.length} élément(s) interactif(s) qui ne peuvent pas recevoir le focus`)
  console.log(`  sur ${releve.anneauDeFocus.sitesInteractifs} sites interactifs lus`)
  for (const d of releve.anneauDeFocus.defauts) console.log(`    ${d.fichier}:${d.ligne}  <${d.balise}>  ${d.motif}`)
  console.log('  faux positifs écartés :')
  for (const [raison, n] of Object.entries(releve.anneauDeFocus.fauxPositifs)) {
    console.log(`    ${String(n).padStart(4)}  ${raison}`)
  }
  tableau('écran → nombre', releve.anneauDeFocus.parEcran, releve.anneauDeFocus.defauts.length)

  console.log(`\n═══ AXE 2 · libellés de champ ═══`)
  console.log(`  ${releve.libelles.defauts.length} champ(s) sans libellé associé, sur ${releve.libelles.champsTrouves} champs lus`)
  for (const d of releve.libelles.defauts) {
    console.log(`    ${d.fichier}:${d.ligne}  <${d.balise}>  placeholder=${JSON.stringify(d.placeholder)}`)
  }
  console.log('  faux positifs écartés :')
  for (const [raison, n] of Object.entries(releve.libelles.fauxPositifs)) {
    console.log(`    ${String(n).padStart(4)}  ${raison}`)
  }
  tableau('écran → nombre', releve.libelles.parEcran, releve.libelles.defauts.length)

  console.log(`\n═══ AXE 3 · hiérarchie des titres ═══`)
  console.log(`  ${releve.titres.sauts.length} saut(s) de niveau, sur ${releve.titres.titresTrouves} titres composés`)
  console.log(`  ${releve.titres.sansH1.length} écran(s) sans h1 : ${releve.titres.sansH1.join(', ') || '—'}`)
  console.log(
    `  ${releve.titres.plusieursH1.length} écran(s) à plusieurs h1 : ` +
      `${releve.titres.plusieursH1.map((x) => `${x.ecran} (${x.h1})`).join(', ') || '—'}`,
  )
  for (const s of releve.titres.sauts) {
    console.log(`    ${s.ecran} [${(s.variantes ?? []).join(" · ")}]  h${s.de} → h${s.vers}  ${s.par}  ${s.source}`)
  }
  const parEcranTitres = Object.fromEntries(
    Object.entries(releve.titres.parEcran).map(([a, v]) => [a, v.sauts]),
  )
  tableau('écran → nombre', parEcranTitres, releve.titres.sauts.length)

  console.log('\n═══ CE QUE CETTE LECTURE NE VOIT PAS ═══')
  for (const l of releve.limites) console.log(`  · ${l}`)

  if (releve.plaintes.length > 0) {
    console.error(`\n✗ ${releve.plaintes.length} refus de lecture :\n`)
    for (const plainte of releve.plaintes) console.error('  ' + plainte)
    console.error(
      '\nUn relevé qui ne lit rien rend « aucun défaut ». Corrigez la lecture, pas le rapport.',
    )
    exit(1)
  }

  console.log('\n✓ lecture pleine : routes, fichiers, balises, champs et titres tous non vides.')
}
