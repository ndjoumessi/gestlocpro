#!/usr/bin/env node
/**
 * LA TABLE DU CLIENT ET LES PAYLOADS DU SERVEUR DISENT LES MÊMES CHAMPS.
 *
 * ═══ LA DIVERGENCE QUE CE SCRIPT FERME ═══
 *
 * Le registre des décisions rend `payload` — un `Json` dont la forme varie selon
 * l'action — au moyen d'une table de recettes côté client : pour `deposit.settle`,
 * montrer `withheldMinor` comme un montant et `reason` comme du texte.
 *
 * Rien ne tenait les deux bouts. Si le serveur renomme `withheldMinor`, la
 * recette ne trouve plus rien et rend une ligne MUETTE — pas une erreur, pas un
 * test rouge : « Caution arbitrée » sans son montant, exactement l'état que le
 * lot précédent existait pour supprimer. Une régression silencieuse dans un
 * registre d'audit est la pire espèce : on ne s'en aperçoit qu'en cherchant à
 * s'en servir, c'est-à-dire le jour où quelque chose a mal tourné.
 *
 * ═══ POURQUOI UN SCRIPT ET NON UN CAS ═══
 *
 * Le fichier qui dérive le plus est CELUI DU CLIENT, et un cas serveur ne
 * tournerait qu'à la porte serveur — qu'on ne passe pas pour un changement
 * purement client. `check-orphelins` lit déjà `server/src/parks/routes.ts`
 * depuis la porte du client, pour la même raison et sur la même frontière.
 *
 * ═══ TROIS PLAINTES ═══
 *
 *  1. un champ de recette que le serveur n'écrit pas — la ligne serait muette ;
 *  2. une recette pour une action que le serveur n'écrit plus — du code mort
 *     qui donne l'illusion d'une couverture ;
 *  3. une action écrite par le serveur sans libellé au dictionnaire — l'écran
 *     rendrait « Décision enregistrée », ce qui est vrai et sans valeur.
 *
 * ═══ LE TÉMOIN ═══
 *
 * L'analyse tourne d'abord sur une source FABRIQUÉE dont on connaît le verdict.
 * Sans lui, un analyseur qui ne trouve rien et un analyseur cassé rendent la
 * même chose : « ✓ ». C'est la convention de `check-montants`, reprise telle
 * quelle.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exit } from 'node:process'

const RACINE = process.env.RACINE_TEST ?? new URL('..', import.meta.url).pathname

/** L'objet `{…}` qui commence à `depart`, accolades équilibrées comprises. */
function objetEquilibre(source, depart) {
  const ouvrant = source.indexOf('{', depart)
  if (ouvrant === -1) return null
  let profondeur = 0
  for (let i = ouvrant; i < source.length; i++) {
    if (source[i] === '{') profondeur++
    else if (source[i] === '}') {
      profondeur--
      if (profondeur === 0) return { texte: source.slice(ouvrant + 1, i), fin: i }
    }
  }
  return null
}

/** Blanchit les commentaires en gardant les positions — voir `clesDePremierNiveau`. */
function sansCommentaires(source) {
  const blanchir = (bloc) => bloc.replace(/[^\n]/g, ' ')
  return source.replace(/\/\*[\s\S]*?\*\//g, blanchir).replace(/\/\/[^\n]*/g, blanchir)
}

/**
 * Les clés de PREMIER niveau d'un corps d'objet — les imbriquées ne comptent pas.
 *
 * PAR CARACTÈRES ET NON PAR LIGNES, et le témoin l'a exigé. Une première
 * rédaction cherchait `^\s*clé:` sur chaque ligne : elle ne voyait donc QUE LA
 * PREMIÈRE clé d'un objet écrit d'un trait — ce que sont la plupart des payloads
 * du serveur, `{ amountMinor: …, method: …, unitId: … }`. Le script aurait alors
 * réclamé deux champs sur trois comme absents, sur du code parfaitement juste.
 *
 * Une clé est un identifiant suivi de deux-points, à profondeur nulle, précédé
 * du début de l'objet ou d'une virgule. Les chaînes sont sautées : un
 * `'a: b'` dans une valeur n'est pas une clé.
 */
function clesDePremierNiveau(brut) {
  /*
    LES COMMENTAIRES SONT BLANCHIS D'ABORD, et c'est le code RÉEL qui l'a exigé —
    le témoin n'en portait pas. Le payload d'`inspection.record` explique son
    calcul en deux lignes de commentaire français, apostrophes comprises : le
    sauteur de chaînes prenait la première pour un guillemet ouvrant et avalait
    tout jusqu'à la suivante, emportant la clé qui suivait. Le script réclamait
    donc `billableMinor` comme absent d'un payload qui le porte.
  */
  /* UNE VIRGULE SENTINELLE : le corps rendu par `objetEquilibre` s'arrête AVANT
     l'accolade fermante, si bien qu'une clé abrégée en dernière position —
     `{ periodStart, count }` — n'avait aucun délimiteur derrière elle et
     échappait au relevé. Trouvé sur `rent.call`, qui l'écrit ainsi. */
  const corps = sansCommentaires(brut) + ','
  const cles = []
  let profondeur = 0
  let precedent = ','

  for (let i = 0; i < corps.length; i++) {
    const c = corps[i]

    if (c === "'" || c === '"' || c === '`') {
      const guillemet = c
      i++
      while (i < corps.length && corps[i] !== guillemet) i += corps[i] === '\\' ? 2 : 1
      precedent = 'x'
      continue
    }
    if (c === '{' || c === '[' || c === '(') {
      profondeur++
      precedent = c
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      profondeur--
      precedent = c
      continue
    }
    if (/\s/.test(c)) continue

    if (profondeur === 0 && precedent === ',' && /[A-Za-z_$]/.test(c)) {
      /* LA FORME ABRÉGÉE COMPTE AUTANT. `{ periodStart, count }` écrit deux
         champs ; exiger les deux-points en aurait manqué un, et le script
         réclamait `count` comme absent du payload de `rent.call`, qui l'écrit.
         Trouvé sur le code réel, pas sur le témoin — qui ne l'employait pas. */
      const m = /^([A-Za-z_$][\w$]*)\s*([:,}])/.exec(corps.slice(i))
      if (m) {
        cles.push(m[1])
        /* On ne consomme pas le délimiteur d'une forme abrégée : la virgule
           doit rester pour annoncer la clé suivante. */
        i += m[0].length - (m[2] === ':' ? 1 : 2)
        precedent = m[2] === ':' ? ':' : ','
        continue
      }
    }
    precedent = c
  }
  return cles
}

/**
 * Ce que le SERVEUR écrit : action → champs du payload.
 *
 * Une action composée — `` `document.${statut}` `` — est retenue sous son
 * préfixe suivi d'une étoile. Le client la reconnaîtra de même : on ne peut pas
 * énumérer statiquement ce qu'une interpolation produira, et prétendre le
 * contraire ferait rougir la garde sur du code juste.
 */
function payloadsDuServeur(source) {
  const par = new Map()
  let depuis = 0
  for (;;) {
    const i = source.indexOf('auditEvent.create(', depuis)
    if (i === -1) break
    depuis = i + 1
    const appel = objetEquilibre(source, i)
    if (!appel) continue

    const action =
      /action:\s*'([^']+)'/.exec(appel.texte)?.[1] ??
      /action:\s*`([^$`]*)\$\{/.exec(appel.texte)?.[1].concat('*')
    if (!action) continue

    const iPayload = appel.texte.indexOf('payload:')
    const payload = iPayload === -1 ? null : objetEquilibre(appel.texte, iPayload)
    par.set(action, payload ? clesDePremierNiveau(payload.texte) : [])
  }
  return par
}

/** Ce que le CLIENT attend : action → champs nommés par ses recettes. */
function recettesDuClient(source) {
  const par = new Map()
  const debut = source.indexOf('const DETAIL')
  if (debut === -1) return par
  const table = objetEquilibre(source, debut)
  if (!table) return par

  for (const m of table.texte.matchAll(/'([\w.]+)':\s*\[([\s\S]*?)\],\n/g)) {
    par.set(m[1], [...m[2].matchAll(/champ:\s*'([^']+)'/g)].map((c) => c[1]))
  }
  return par
}

/** Les actions que le dictionnaire sait nommer — imbriquées sous `actions`. */
function actionsDuDictionnaire(source) {
  const i = source.indexOf('      actions: {')
  if (i === -1) return new Set()
  const bloc = objetEquilibre(source, i)
  if (!bloc) return new Set()

  const connues = new Set()
  for (const m of bloc.texte.matchAll(/^\s{8}([\w]+):\s*\{([\s\S]*?)^\s{8}\},/gm)) {
    for (const f of m[2].matchAll(/^\s{10}([\w]+):/gm)) connues.add(`${m[1]}.${f[1]}`)
  }
  return connues
}

/** Une action composée du serveur — `document.*` — couvre-t-elle cette clé ? */
const couverte = (action, connues) =>
  action.endsWith('*')
    ? [...connues].some((c) => c.startsWith(action.slice(0, -1)))
    : connues.has(action)

function plaintesDe(serveur, client, dictionnaire) {
  const ecrits = payloadsDuServeur(serveur)
  const recettes = recettesDuClient(client)
  const nommees = actionsDuDictionnaire(dictionnaire)
  const plaintes = []

  for (const [action, champs] of recettes) {
    const payload = ecrits.get(action)
    if (!payload) {
      plaintes.push(
        `recette orpheline · ${action} · le serveur n’écrit plus cette décision.\n` +
          '   Une recette sans écriture donne l’illusion d’une couverture.',
      )
      continue
    }
    for (const champ of champs) {
      if (!payload.includes(champ))
        plaintes.push(
          `champ absent · ${action}.${champ} · le payload du serveur porte ` +
            `[${payload.join(', ')}].\n` +
            '   La recette rendrait une ligne MUETTE, sans qu’aucun test ne rougisse.',
        )
    }
  }

  for (const action of ecrits.keys()) {
    if (!couverte(action, nommees))
      plaintes.push(
        `action sans libellé · ${action} · le dictionnaire ne la nomme pas.\n` +
          '   L’écran rendrait « Décision enregistrée », ce qui est vrai et sans valeur.',
      )
  }

  return plaintes
}

/* ─── LE TÉMOIN ───────────────────────────────────────────────────────────────
   Trois défauts, un par plainte, et deux accords qui doivent rester muets :
   une recette juste, et une action composée que le dictionnaire couvre par son
   préfixe. Sans ces deux-là, un analyseur qui se plaindrait de TOUT passerait. */
const SERVEUR_TEMOIN = `
  await prisma.auditEvent.create({
    data: { parkId, action: 'a.juste', entity: 'X', entityId: x.id,
      payload: {
        montantMinor: 1,
        // Un commentaire à l'apostrophe française, qui a cassé la première
        // rédaction : le sauteur de chaînes avalait la clé suivante.
        motif: null,
        // Et la forme abrégée, qui n'a pas de deux-points.
        abrege,
      } },
  })
  await prisma.auditEvent.create({
    data: { parkId, action: 'b.renomme', entity: 'X', entityId: x.id,
      payload: { nouveauNom: 2, imbrique: { dedans: 3 } } },
  })
  await prisma.auditEvent.create({
    data: { parkId, action: 'c.sansLibelle', entity: 'X', entityId: x.id, payload: {} },
  })
  await prisma.auditEvent.create({
    data: { parkId, action: \`d.\${corps.statut}\`, entity: 'X', entityId: x.id,
      payload: { sorte: 'x' } },
  })
`
const CLIENT_TEMOIN = `
const DETAIL: Record<string, Champ[]> = {
  'a.juste': [
    { champ: 'montantMinor', nature: 'argent' },
    { champ: 'motif', nature: 'texte' },
    { champ: 'abrege', nature: 'texte' },
  ],
  'b.renomme': [{ champ: 'ancienNom', nature: 'argent' }],
  'z.disparue': [{ champ: 'quoi', nature: 'texte' }],
}
`
const DICTIONNAIRE_TEMOIN = `
      actions: {
        a: {
          juste: 'A',
        },
        b: {
          renomme: 'B',
        },
        d: {
          fait: 'D',
        },
        unknown: 'Décision enregistrée',
      },
`
const TEMOIN_ATTENDU = [
  'champ absent · b.renomme.ancienNom',
  'recette orpheline · z.disparue',
  'action sans libellé · c.sansLibelle',
]

const obtenu = plaintesDe(SERVEUR_TEMOIN, CLIENT_TEMOIN, DICTIONNAIRE_TEMOIN).map((p) =>
  p.split(' · ').slice(0, 2).join(' · '),
)
if (JSON.stringify(obtenu.sort()) !== JSON.stringify([...TEMOIN_ATTENDU].sort())) {
  console.error('✗ TÉMOIN :', JSON.stringify(obtenu, null, 1))
  console.error('  attendu :', JSON.stringify(TEMOIN_ATTENDU, null, 1))
  exit(1)
}

const plaintes = plaintesDe(
  await readFile(join(RACINE, 'server/src/parks/routes.ts'), 'utf8'),
  await readFile(join(RACINE, 'src/features/dashboard/Decisions.tsx'), 'utf8'),
  await readFile(join(RACINE, 'src/i18n/fr.ts'), 'utf8'),
)

if (plaintes.length) {
  console.error(`✗ decisions-nommees : ${plaintes.length} divergence(s) :\n`)
  for (const p of plaintes) console.error('  ▸ ' + p + '\n')
  console.error(
    'Le registre des décisions rendrait une ligne muette ou un libellé générique,\n' +
      'sans qu’aucun test ne rougisse. C’est ce que ce script existe pour empêcher.',
  )
  exit(1)
}

console.log(
  '✓ decisions-nommees : témoin classé, et chaque recette du registre nomme des champs',
)
console.log('  que le serveur écrit vraiment.')
