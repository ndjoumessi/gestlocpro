import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * TOUTE VALEUR D'ÉNUMÉRATION AFFICHÉE PORTE UN LIBELLÉ, DANS LES DEUX LANGUES.
 *
 * ═══ LA CLASSE DE DÉFAUT, RENCONTRÉE DEUX FOIS EN UN JOUR ═══
 *
 * Le front compose CINQUANTE-NEUF clés de traduction à l'exécution, et la
 * plupart n'ont aucun repli : une clé absente s'affiche EN TOUTES LETTRES.
 *
 * Les dangereuses sont celles dont la partie variable vient de la BASE. Deux
 * ont déjà mordu :
 *
 *   `announcement` — genre d'avis sans libellé, « app.alerts.kind.announcement »
 *     lisible sur une carte, en production, pendant des semaines ;
 *   `document.declined` — le serveur écrit `declined`, le dictionnaire disait
 *     `refused`, et toute demande de pièce refusée s'inscrivait au registre
 *     sous « Action inconnue ».
 *
 * Les deux ont été trouvées par accident, en ajoutant autre chose à côté. Cette
 * garde est là pour que la troisième ne le soit pas.
 *
 * ═══ CE QU'ELLE COUVRE, ET CE QU'ELLE NE COUVRE PAS ═══
 *
 * Les SEPT familles dont j'ai vérifié qu'un site du front compose leur clé
 * directement depuis une valeur d'énumération. Chaque paire nomme aussi le
 * FICHIER qui compose : une famille qui cesserait d'être affichée ainsi doit
 * faire rougir plutôt que de dormir dans un registre.
 *
 * RESTENT DEHORS, et chacune pour sa raison :
 *
 *   `Currency` — le front replie DÉLIBÉRÉMENT `XAF` et `XOF` sur `CFA`, parce
 *     que ce sont deux monnaies de même parité que l'écran ne distingue pas.
 *     Une comparaison directe rougirait sur un dessin correct.
 *   `ParkRole` → `roles.*` — la feuille n'est pas un libellé mais un objet
 *     (`name`, `short`, `rights`, `pitch`). Autre forme, autre garde.
 *   `NotificationKind` — déjà tenue par `genresDAvisNommes.test.ts`, côté front,
 *     avec sa liste écrite à la main.
 *   `PaymentMethod`, `DocumentKind`, `Urgency` et leurs voisines — le front les
 *     traduit par des TABLES de correspondance, pas par composition directe. Je
 *     ne les ai pas tracées ; elles ne sont ni couvertes ni déclarées saines.
 *
 * ═══ LES SEPT FAMILLES SONT DÉDIÉES, ET C'EST RÉCENT ═══
 *
 * Quatre ne l'étaient pas : `app.works` portait ses quatre statuts au milieu de
 * QUATRE-VINGTS libellés d'écran, `app.inspections` ses deux genres au milieu de
 * cinquante-neuf. Une valeur d'énumération qui aurait porté le nom d'une clé
 * existante — un statut `title` — se serait affichée SILENCIEUSEMENT à sa place :
 * bon emplacement, mauvais texte, aucune rougeur.
 *
 * Le danger n'était pas théorique. En isolant `app.inspections`, le sous-bloc
 * `kind` a heurté une clé `kind` qui existait déjà — le libellé « Nature » d'un
 * champ de formulaire. `tsc` l'a refusé, parce qu'un objet littéral ne peut pas
 * porter deux fois le même nom ; c'est ce qui l'a rendu visible. Dans l'autre
 * sens — une VALEUR qui heurte un libellé — rien ne l'aurait dit.
 *
 * Les statuts vivent donc désormais dans leur propre bloc, et la recherche
 * d'orphelins porte sur les SEPT familles au lieu de trois.
 */
const RACINE = join(import.meta.dirname, '../..')

/**
 * Famille du dictionnaire ← énumération Prisma ← fichier qui compose la clé.
 *
 * ÉCRITE À LA MAIN. Une liste dérivée du dictionnaire serait d'accord avec
 * elle-même et passerait sur zéro famille comme sur sept.
 */
const FAMILLES = [
  { chemin: 'app.works.status', enumeration: 'WorkStatus', compose: 'src/features/dashboard/Works.tsx' },
  { chemin: 'app.deposits.status', enumeration: 'DepositStatus', compose: 'src/features/dashboard/Deposits.tsx' },
  { chemin: 'app.documents.reqStatus', enumeration: 'DocumentRequestStatus', compose: 'src/features/dashboard/TenantDocuments.tsx' },
  { chemin: 'app.inspections.kinds', enumeration: 'InspectionKind', compose: 'src/features/dashboard/Inspections.tsx' },
  { chemin: 'app.unitTypes', enumeration: 'UnitType', compose: 'src/features/dashboard/Portfolio.tsx' },
  { chemin: 'app.trades', enumeration: 'Trade', compose: 'src/features/dashboard/Works.tsx' },
  { chemin: 'app.meters.utility', enumeration: 'Utility', compose: 'src/features/dashboard/TariffsModal.tsx' },
] as const

const schema = () => readFileSync(join(RACINE, 'server/prisma/schema.prisma'), 'utf8')

/**
 * Les valeurs d'une énumération Prisma.
 *
 * Les commentaires `///` sont RETIRÉS d'abord : ce schéma les emploie
 * abondamment, en prose, et un relevé naïf ramasse des mots de phrase comme
 * s'ils étaient des valeurs. Mesuré — un premier balayage a rendu « Le,
 * bailleur, qui, parle » pour `NotificationKind`.
 */
function valeursDe(nom: string): string[] {
  const trouve = schema()
    .replace(/^\s*\/\/\/.*$/gm, '')
    .match(new RegExp(`enum ${nom} \\{([^}]*)\\}`))
  if (!trouve) return []
  return trouve[1]!
    .trim()
    .split(/\s+/)
    .filter((v) => /^[A-Za-z][A-Za-z0-9_]*$/.test(v))
}

/** Le bloc littéral d'une famille, commentaires retirés. */
function blocDeLaFamille(langue: 'fr' | 'en', chemin: string): string | null {
  let reste = readFileSync(join(RACINE, `src/i18n/${langue}.ts`), 'utf8')
  let profondeur = 4
  for (const feuille of chemin.split('.').slice(1)) {
    const debut = reste.indexOf(`\n${' '.repeat(profondeur)}${feuille}: {`)
    if (debut < 0) return null
    const ouvrante = reste.indexOf('{', debut)
    let niveau = 0
    let fin = -1
    for (let i = ouvrante; i < reste.length; i++) {
      if (reste[i] === '{') niveau++
      else if (reste[i] === '}') {
        niveau--
        if (niveau === 0) {
          fin = i
          break
        }
      }
    }
    if (fin < 0) return null
    reste = reste.slice(ouvrante, fin + 1)
    profondeur += 2
  }
  return reste.replace(/\/\*[\s\S]*?\*\//g, '')
}

const cles = (bloc: string) => [...bloc.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*): /gm)].map((m) => m[1]!)

describe('les valeurs d’énumération affichées', () => {
  it('sont bien LUES dans le schéma — sans quoi cette garde ne garderait rien', () => {
    /* Une expression rompue rendrait des listes vides, et « chaque valeur porte
       un libellé » passerait au vert en ne comparant rien. */
    for (const famille of FAMILLES)
      expect(valeursDe(famille.enumeration).length, `${famille.enumeration} : aucune valeur lue`)
        .toBeGreaterThanOrEqual(2)
  })

  it.each(['fr', 'en'] as const)('portent toutes un libellé en %s', (langue) => {
    const muettes: string[] = []
    for (const famille of FAMILLES) {
      const bloc = blocDeLaFamille(langue, famille.chemin)
      if (bloc === null) {
        muettes.push(`${famille.chemin} : famille introuvable dans le dictionnaire`)
        continue
      }
      const nommees = new Set(cles(bloc))
      for (const valeur of valeursDe(famille.enumeration))
        if (!nommees.has(valeur)) muettes.push(`${famille.chemin}.${valeur}  (${famille.enumeration})`)
    }

    expect(
      muettes,
      'l’écran afficherait ces clés en toutes lettres, en production :\n  ' + muettes.join('\n  '),
    ).toEqual([])
  })

  it.each(['fr', 'en'] as const)('ne gardent AUCUN libellé orphelin en %s', (langue) => {
    /* Un libellé sans valeur est du texte traduit et maintenu pour rien — et il
       fait CROIRE que le cas est couvert. C'est exactement ce qui masquait
       `document.declined` : « refused » avait tout l'air d'être son libellé.

       SEULEMENT SUR LES FAMILLES DÉDIÉES, et le chiffre dit pourquoi :
       `app.works` porte QUATRE-VINGT-QUATRE clés pour quatre valeurs de
       `WorkStatus`. C'est le dictionnaire d'un écran entier, où les statuts
       cohabitent avec les titres et les boutons. Y chercher des orphelins
       rendrait quatre-vingts faux positifs. */
    const orphelins: string[] = []
    for (const famille of FAMILLES) {
      const bloc = blocDeLaFamille(langue, famille.chemin)
      if (bloc === null) continue
      const valeurs = new Set(valeursDe(famille.enumeration))
      for (const cle of cles(bloc))
        if (!valeurs.has(cle)) orphelins.push(`${famille.chemin}.${cle}  (hors ${famille.enumeration})`)
    }

    expect(
      orphelins,
      'aucune valeur d’énumération ne porte ces noms :\n  ' + orphelins.join('\n  '),
    ).toEqual([])
  })

  it('nomment un fichier qui COMPOSE réellement leur clé', () => {
    /* Le registre dit d'où vient le risque. Une famille qui cesserait d'être
       composée — remplacée par une table de correspondance, par exemple — n'a
       plus rien à faire ici, et doit le dire plutôt que d'y dormir. */
    const perdues = FAMILLES.filter((famille) => {
      const source = readFileSync(join(RACINE, famille.compose), 'utf8')
      return !source.includes('`' + famille.chemin + '.${')
    }).map((f) => `${f.chemin} : ${f.compose} ne compose plus cette clé`)

    expect(perdues, perdues.join('\n  ')).toEqual([])
  })
})
