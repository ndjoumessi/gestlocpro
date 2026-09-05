import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * LE JOURNAL NE DOIT PAS POUVOIR FAIRE ÉCHOUER L'ÉCRITURE QU'IL DÉCRIT.
 *
 * ═══ LA POLITIQUE EXISTAIT, ÉNONCÉE UNE SEULE FOIS ═══
 *
 * Ces mots sont ceux du dépôt, dans un commentaire de `routes.ts`, à UN seul
 * endroit. Rien ne les appliquait. J'ai moi-même failli les renverser : j'avais
 * relevé « des écritures d'audit hors transaction » comme un défaut, écrit la
 * garde inverse, et j'allais déplacer trois sites — jusqu'à lire le commentaire
 * qui disait « et c'est voulu ».
 *
 * Une politique qui ne vit que dans une phrase est une politique qu'on inverse
 * par erreur. Celle-ci vit maintenant ici.
 *
 * ═══ CE QU'ELLE ÉCHANGE, ET LE PRIX EST RÉEL ═══
 *
 * Une écriture de registre DANS la transaction rend l'acte atomique avec sa
 * trace : jamais de mutation sans sa ligne. Mais elle donne au journal le
 * pouvoir de BLOQUER l'acte — une panne d'écriture de l'audit annule une mise
 * en demeure, une suppression de versement, une entrée dans un parc.
 *
 * Le dépôt a tranché dans l'autre sens : l'acte passe, la trace suit. Le prix,
 * assumé : après une panne entre les deux, une mutation peut exister SANS sa
 * ligne de registre.
 *
 * CE PRIX EST LE PLUS ÉLEVÉ SUR LES SUPPRESSIONS, et il faut le dire là plutôt
 * qu'en note. `payment.delete` et `tenant.delete` étaient précisément les deux
 * sites transactionnels, et le commentaire de l'un plaidait sa cause — « le
 * versement disparaît, sa trace reste, montant compris ; c'est ce qui distingue
 * une correction d'un effacement ». Les sortir de leur transaction rend possible
 * une suppression SANS trace. C'est le choix qui a été fait, en connaissance.
 *
 * ═══ CE QUE LA MESURE A CORRIGÉ DANS MON COMPTE ═══
 *
 * J'avais annoncé « cinq écritures hors transaction » comme un défaut. Le relevé
 * en a compté VINGT-CINQ sur vingt-huit, conformes ; et trois qui contredisaient
 * la politique — un `tx.auditEvent.create`, et deux `$transaction([…])` où
 * l'écriture est un élément atomique du tableau. Ce sont ces trois-là que ce lot
 * a sortis, et cette garde qui les empêche de revenir.
 */
const RACINE = join(import.meta.dirname, '../..')

/** Les sources du serveur, tests et code généré exclus. */
function fichiers(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) {
      if (entree.name === 'generated' || entree.name === 'node_modules') continue
      trouves.push(...fichiers(chemin))
    } else if (entree.name.endsWith('.ts') && !entree.name.endsWith('.test.ts')) {
      trouves.push(chemin)
    }
  }
  return trouves
}

/**
 * TOUT LE SERVEUR, et non le seul fichier de routes.
 *
 * La première rédaction ne lisait que `parks/routes.ts`, où vivaient alors les
 * vingt-huit écritures — relevé, pas supposé. Le lot suivant en a posé une dans
 * `parks/invitations.ts`, et la garde ne l'aurait pas vue. Un périmètre qui se
 * justifie par une concentration cesse de valoir dès qu'elle se disperse.
 */
const source = () =>
  fichiers(join(RACINE, 'src'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')

/** Le bloc équilibré qui commence à `depart`, pour `{}` comme pour `[]`. */
function blocEquilibre(source: string, depart: number, ouvre: string, ferme: string): string {
  let profondeur = 0
  for (let i = depart; i < source.length; i++) {
    if (source[i] === ouvre) profondeur++
    else if (source[i] === ferme) {
      profondeur--
      if (profondeur === 0) return source.slice(depart, i + 1)
    }
  }
  return ''
}

const ligneDe = (s: string, index: number) => s.slice(0, index).split('\n').length

/**
 * LES SUPPRESSIONS QUI DOIVENT ÊTRE ATOMIQUES AVEC LEUR TRACE.
 *
 * ÉCRITE À LA MAIN, et courte exprès : chaque entrée est une exception à la
 * politique générale, et une exception qu'on ajoute sans y penser n'en est plus
 * une. Le critère pour y entrer : l'entité N'EXISTE PLUS après l'acte, donc une
 * trace perdue est indétectable — rien ne peut plus dire qu'il y a eu quelque
 * chose. `access.revoke` et `access.unlink` détruisent aussi, mais leur ligne
 * survit avec son statut : on y perd « qui et quand », jamais le fait.
 */
const DESTRUCTIONS_ATOMIQUES = [
  'building.delete',
  'inspection.photo_delete',
  'payment.delete',
  /* LE RELEVÉ RETIRÉ. L'index disparaît avec sa ligne — la table ne porte ni
     statut ni corbeille —, et cette trace est la SEULE chose qui dira ensuite
     quel index avait été lu. C'est précisément ce qu'on vient chercher quand un
     locataire conteste une refacturation, et un retrait sans trace rendrait la
     question sans réponse pour toujours. */
  'reading.delete',
  /* LE TARIF RETIRÉ. Sa ligne ne survit pas à son retrait — il n'a ni statut ni
     drapeau, la table ne porte que des prix en vigueur —, et la trace est la
     SEULE chose qui dira ensuite à quel prix une période a été affichée. Un
     tarif disparu sans trace rend une refacturation passée inexplicable, ce qui
     est exactement la question qu'un locataire pose quand il conteste. */
  'tariff.delete',
  'tenant.delete',
] as const

/** L'action que porte l'écriture de registre commençant à `depart`. */
function actionDe(s: string, depart: number): string {
  const bloc = blocEquilibre(s, s.indexOf('{', depart), '{', '}')
  return (/action: '([a-z_.]+)'/.exec(bloc) ?? [])[1] ?? '?'
}

/** Les écritures qui participent à une transaction, avec l'action qu'elles portent. */
function ecrituresDansUneTransaction(): { ligne: number; action: string; comment: string }[] {
  const s = source()
  const trouvees: { ligne: number; action: string; comment: string }[] = []

  /* Forme À RAPPEL : le client transactionnel s'appelle `tx` par convention
     dans tout ce fichier, et une écriture qui l'emploie participe donc. */
  for (const m of s.matchAll(/tx\.auditEvent\.create/g))
    trouvees.push({
      ligne: ligneDe(s, m.index!),
      action: actionDe(s, m.index!),
      comment: '`tx.auditEvent.create`',
    })

  /* Forme EN TABLEAU : tout élément du tableau est atomique avec les autres.
     C'est la forme qui m'avait échappé au premier relevé — un `$transaction`
     ouvert deux lignes plus haut, que j'avais lu comme « déjà refermé ». */
  for (const m of s.matchAll(/\$transaction\(\[/g)) {
    const debut = s.indexOf('[', m.index!)
    const tableau = blocEquilibre(s, debut, '[', ']')
    const i = tableau.indexOf('auditEvent.create')
    if (i >= 0)
      trouvees.push({
        ligne: ligneDe(s, m.index!),
        action: actionDe(s, debut + i),
        comment: 'le tableau du `$transaction`',
      })
  }
  return trouvees
}

/** Toutes les écritures de registre, avec l'action qu'elles portent. */
function toutesLesEcritures(): { ligne: number; action: string }[] {
  const s = source()
  return [...s.matchAll(/auditEvent\.create/g)].map((m) => ({
    ligne: ligneDe(s, m.index!),
    action: actionDe(s, m.index!),
  }))
}

describe('l’écriture du registre des décisions', () => {
  it('est bien TROUVÉE — sans quoi cette garde ne garderait rien', () => {
    /* Un renommage rompant l'expression rendrait une liste vide, et le cas
       suivant passerait au vert en ne mesurant rien. */
    const s = source()
    expect([...s.matchAll(/auditEvent\.create/g)].length).toBeGreaterThanOrEqual(20)
    expect([...s.matchAll(/\$transaction\(/g)].length).toBeGreaterThanOrEqual(5)
  })

  it('ne participe PAS à la transaction, sauf pour une suppression déclarée', () => {
    const fautives = ecrituresDansUneTransaction()
      .filter((e) => !(DESTRUCTIONS_ATOMIQUES as readonly string[]).includes(e.action))
      .map((e) => `ligne ${e.ligne} — ${e.comment} porte \`${e.action}\``)

    expect(
      fautives,
      'une panne d’écriture du journal ANNULERAIT l’acte — mise en demeure, ' +
        'entrée dans un parc, périmètre confié. Ces actes-là se relisent après ' +
        'coup ; une trace perdue s’y voit :\n  ' + fautives.join('\n  '),
    ).toEqual([])
  })

  it('participe TOUJOURS pour les suppressions déclarées', () => {
    /* L'autre sens, et il compte autant. Une suppression sortie de sa
       transaction redevient indétectable après une panne, et c'est précisément
       ce qui a été fait le 2026-09-03 au nom de l'uniformité — puis défait le
       lendemain, la distinction ayant été trouvée. */
    const atomiques = new Set(ecrituresDansUneTransaction().map((e) => e.action))
    const dehors = toutesLesEcritures()
      .filter((e) => (DESTRUCTIONS_ATOMIQUES as readonly string[]).includes(e.action))
      .filter((e) => !atomiques.has(e.action))
      .map((e) => `ligne ${e.ligne} — \`${e.action}\` est hors de sa transaction`)

    expect(
      dehors,
      'l’entité n’existera plus : une panne entre l’acte et la trace effacerait ' +
        'sans que rien ne puisse le dire :\n  ' + dehors.join('\n  '),
    ).toEqual([])
  })

  it('déclare des suppressions qui EXISTENT toutes', () => {
    /* Une déclaration morte décrit un acte disparu et dispenserait en silence
       une écriture future qui reprendrait son nom. */
    const connues = new Set(toutesLesEcritures().map((e) => e.action))
    const mortes = DESTRUCTIONS_ATOMIQUES.filter((a) => !connues.has(a))
    expect(mortes, `plus aucune écriture ne porte ces actions :\n  ${mortes.join('\n  ')}`).toEqual(
      [],
    )
  })
})
