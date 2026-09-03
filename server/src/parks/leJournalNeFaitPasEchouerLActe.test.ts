import { readFileSync } from 'node:fs'
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

const source = () => readFileSync(join(RACINE, 'src/parks/routes.ts'), 'utf8')

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

/** Les écritures de registre qui participent à une transaction. */
function ecrituresDansUneTransaction(): string[] {
  const s = source()
  const fautives: string[] = []

  /* Forme À RAPPEL : le client transactionnel s'appelle `tx` par convention
     dans tout ce fichier, et une écriture qui l'emploie participe donc. */
  for (const m of s.matchAll(/tx\.auditEvent\.create/g))
    fautives.push(`ligne ${ligneDe(s, m.index!)} — \`tx.auditEvent.create\` participe à la transaction`)

  /* Forme EN TABLEAU : tout élément du tableau est atomique avec les autres.
     C'est la forme qui m'avait échappé au premier relevé — un `$transaction`
     ouvert deux lignes plus haut, que j'avais lu comme « déjà refermé ». */
  for (const m of s.matchAll(/\$transaction\(\[/g)) {
    const tableau = blocEquilibre(s, s.indexOf('[', m.index!), '[', ']')
    if (/auditEvent\.create/.test(tableau))
      fautives.push(
        `ligne ${ligneDe(s, m.index!)} — le tableau du \`$transaction\` contient une écriture de registre`,
      )
  }
  return fautives
}

describe('l’écriture du registre des décisions', () => {
  it('est bien TROUVÉE — sans quoi cette garde ne garderait rien', () => {
    /* Un renommage rompant l'expression rendrait une liste vide, et le cas
       suivant passerait au vert en ne mesurant rien. */
    const s = source()
    expect([...s.matchAll(/auditEvent\.create/g)].length).toBeGreaterThanOrEqual(20)
    expect([...s.matchAll(/\$transaction\(/g)].length).toBeGreaterThanOrEqual(5)
  })

  it('ne participe JAMAIS à la transaction qu’elle décrit', () => {
    const fautives = ecrituresDansUneTransaction()
    expect(
      fautives,
      'une panne d’écriture du journal ANNULERAIT l’acte — mise en demeure, ' +
        'suppression, entrée dans un parc :\n  ' + fautives.join('\n  '),
    ).toEqual([])
  })
})
