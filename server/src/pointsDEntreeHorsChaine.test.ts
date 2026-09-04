import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * UN SCRIPT QUE PERSONNE NE LANCE EST UNE GARDE QUI NE GARDE RIEN.
 *
 * ═══ CE QUE ÇA A COÛTÉ ═══
 *
 * `releve-refonte` refusait son propre relevé — « 624 mesurés pour 598
 * attendus » — depuis le 2026-08-22. Personne ne l'a su : il n'est dans aucune
 * chaîne, on le lance à la main par `npm run releve`, et son attente écrite à la
 * main avait vieilli sans que rien ne parle. Trouvé par accident, en convertissant
 * son contrôle de port.
 *
 * ═══ CE QUE CETTE GARDE FAIT, ET CE QU'ELLE NE FAIT PAS ═══
 *
 * Elle n'oblige personne à entrer dans une chaîne. Certains scripts ne le
 * doivent pas : `fumee` exige des identifiants de PRODUCTION, qu'aucune porte
 * n'a et qu'aucune porte ne doit avoir ; `releve-refonte` DÉCRIT au lieu de
 * refuser, et son en-tête dit qu'« une porte qui décrit devient une décoration ».
 *
 * Elle exige seulement que « hors chaîne » soit un ÉTAT DÉCLARÉ, avec son motif,
 * et non le résultat d'un oubli. Un script neuf qui n'entrerait dans aucune
 * chaîne fera rougir ce cas, et son auteur devra écrire pourquoi.
 *
 * Les deux sens, comme partout ici : une déclaration qui ne correspond plus à
 * rien décrit un état disparu avec l'autorité d'un registre.
 */
const RACINE = join(import.meta.dirname, '../..')

/**
 * LES DEUX MANIFESTES, et le second a été ajouté DIX MINUTES après le premier.
 *
 * La première rédaction ne lisait que le `package.json` de la racine. J'ai
 * écrit dans la foulée un script de maintenance sous `server/`, et cette garde
 * ne l'a pas vu — un périmètre d'un seul fichier, exactement le défaut que
 * `decisions-nommees` portait la veille et que le même geste a fermé. Une garde
 * de périmètre écrite trop étroit se trompe sur le premier cas qui la suit.
 */
const MANIFESTES = ['package.json', 'server/package.json'] as const

/** Les scripts npm qui LANCENT une chaîne de portes. */
const CHAINES = ['check:rapide', 'check:navigateur', 'check'] as const

/**
 * Les points d'entrée qu'aucune chaîne ne couvre, ET POURQUOI.
 *
 * ÉCRITE À LA MAIN : une liste dérivée du `package.json` serait d'accord avec
 * elle-même et accueillerait le prochain oubli sans un mot.
 */
const HORS_CHAINE: { script: string; motif: string }[] = [
  {
    script: 'scripts/fumee.mjs',
    motif:
      'Il éprouve la PRODUCTION, avec des identifiants réels lus dans l’environnement de ' +
      'qui le lance. Aucune porte n’a ces identifiants, et poser un mot de passe de ' +
      'production dans un secret de dépôt pour qu’un robot le tape à chaque poussée est un ' +
      'prix qu’on ne paie pas pour de la mesure.',
  },
  {
    script: 'scripts/setup-test-db.mjs',
    motif:
      'Il PRÉPARE la base de test — création, migrations — avant que les portes ne tournent. ' +
      'Le mettre dans une chaîne de vérification inverserait l’ordre : il fabrique ce que ' +
      'les autres mesurent, il ne mesure rien lui-même.',
  },
  {
    script: 'src/scripts/executerRelancesAutomatiques.ts',
    motif:
      'Il ENVOIE de vrais courriels de relance, et c’est le service Railway `relances` qui ' +
      'le lance à 6 h UTC. Une porte qui l’exécuterait écrirait à des locataires à chaque ' +
      'poussée. Ses parties décidables sont éprouvées par `executerRelancesAutomatiques.test.ts`.',
  },
  {
    script: 'src/scripts/immeublesNonConfies.ts',
    motif:
      'Il RELÈVE l’état d’une base réelle — quels immeubles ne sont confiés à personne — et ' +
      'n’écrit rien. Il n’a de sens que branché sur une vraie `DATABASE_URL`, celle que ' +
      'lance la personne qui veut le savoir. Aucune porte n’a cette base, et aucune ne doit.',
  },
  {
    script: 'scripts/releve-refonte.mjs',
    motif:
      'Il DÉCRIT l’existant au lieu de le refuser — son en-tête le dit : « un relevé qui ' +
      'refuse devient une porte, et une porte qui décrit devient une décoration ». Il rend ' +
      'un JSON de deux mégaoctets qu’on relit avant et après une refonte, pas un verdict ' +
      'qu’on lit à chaque poussée. Son attente, elle, ne peut plus vieillir : elle se dérive ' +
      'désormais des listes qu’il se donne à parcourir.',
  },
]

/* `.mjs` ET `.ts` : les scripts de maintenance du serveur tournent sous `tsx`. */
const CHEMIN = /((?:src\/)?scripts\/[A-Za-z0-9-]+\.(?:mjs|ts))/g

const manifeste = (chemin: string) =>
  JSON.parse(readFileSync(join(RACINE, chemin), 'utf8')) as { scripts: Record<string, string> }

/** Les scripts qu'un script npm lance directement, dans les deux manifestes. */
function pointsDEntree(): string[] {
  const tous = MANIFESTES.map((m) => Object.values(manifeste(m).scripts).join(' ')).join(' ')
  return [...new Set([...tous.matchAll(CHEMIN)].map((m) => m[1]!))].sort()
}

/** Ceux qu'au moins une chaîne couvre, dans l'un ou l'autre manifeste. */
function couverts(): Set<string> {
  const texte = MANIFESTES.flatMap((m) => {
    const s = manifeste(m).scripts
    return CHAINES.map((c) => s[c] ?? '')
  }).join(' ')
  return new Set([...texte.matchAll(CHEMIN)].map((m) => m[1]!))
}

describe('les points d’entrée', () => {
  it('sont bien TROUVÉS — sans quoi cette garde ne garderait rien', () => {
    /* Un `package.json` illisible ou un motif rompu rendrait une liste vide, et
       « aucun oubli » se lirait comme « rien à couvrir ». */
    expect(pointsDEntree().length).toBeGreaterThanOrEqual(15)
    expect(couverts().size).toBeGreaterThanOrEqual(15)
  })

  it('sont couverts par une chaîne, ou DÉCLARÉS hors chaîne avec leur motif', () => {
    const declares = new Set(HORS_CHAINE.map((h) => h.script))
    const couverte = couverts()
    const orphelins = pointsDEntree().filter((s) => !couverte.has(s) && !declares.has(s))

    expect(
      orphelins,
      'ces scripts ne tournent que si quelqu’un y pense. Une garde que personne ne ' +
        'lance ne garde rien — mettez-les dans une chaîne, ou inscrivez-les dans ' +
        `\`HORS_CHAINE\` avec la raison :\n  ${orphelins.join('\n  ')}`,
    ).toEqual([])
  })

  it('ne laissent AUCUNE déclaration morte', () => {
    /* Un script entré dans une chaîne, ou disparu, laisserait un motif qui parle
       d'un état révolu — avec l'autorité d'un registre. */
    const couverte = couverts()
    const connus = new Set(pointsDEntree())
    const mortes = HORS_CHAINE.filter((h) => couverte.has(h.script) || !connus.has(h.script)).map(
      (h) => h.script,
    )
    expect(mortes, `ces déclarations ne décrivent plus rien :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  it('donnent un MOTIF, et pas un renvoi', () => {
    /* Une dispense sans motif a exactement l'effet d'un oubli, en ayant l'air
       d'une décision. */
    const creuses = HORS_CHAINE.filter((h) => h.motif.trim().length < 80).map((h) => h.script)
    expect(creuses, 's’inscrire est un geste ; le motif est ce qui le rend relisible').toEqual([])
  })
})
