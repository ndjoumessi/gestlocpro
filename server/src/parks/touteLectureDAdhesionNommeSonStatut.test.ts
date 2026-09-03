import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * TOUTE LECTURE D'ADHÉSION NOMME LES STATUTS QU'ELLE ACCEPTE.
 *
 * ═══ QUATRE FOIS LE MÊME DÉFAUT, EN UN JOUR ═══
 *
 * `Membership.status` vaut `active`, `requested` ou `revoked`. Une requête qui
 * ne le nomme pas les ramasse tous les trois — et une ligne morte ou une
 * demande en attente se met alors à compter comme une adhésion vivante.
 *
 * Ce dépôt a corrigé cette forme QUATRE FOIS, une route à la fois :
 *
 *   1. la branche locataire de `/api/join` — « le code restait en attente dans
 *      le registre des accès, valable et inutilisable » ;
 *   2. le membre RÉVOQUÉ de la même route (`0e4ffd0`) — « retirer l'accès était
 *      une porte à sens unique » ;
 *   3. le DEMANDEUR de la même route encore (`1816041`), le jour même où
 *      `requested` est né ;
 *   4. le périmètre et le retrait (`068e79e`), trouvés en cherchant la forme.
 *
 * Chacune de ces corrections a traité SON cas. Aucune n'a fermé la porte, et
 * trois messages de commit d'affilée ont nommé cette garde-ci sans la faire.
 * La cinquième route ne serait annoncée par rien.
 *
 * ═══ CE QU'ELLE EXIGE ═══
 *
 * Qu'une lecture d'adhésion porte `status` dans son `where` — n'importe quelle
 * forme : une valeur, un `in`, un `not`. La garde ne juge PAS le filtre, elle
 * exige qu'il y ait eu une décision. « Tous les statuts » est une réponse
 * parfaitement valable ; ce qui ne l'est pas, c'est de ne pas s'être posé la
 * question.
 *
 * D'où le second registre : les lectures qui lisent DÉLIBÉRÉMENT tous les
 * statuts s'inscrivent dans `SANS_STATUT_ASSUME`, avec leur motif. S'inscrire
 * est un geste, et c'est tout ce qu'on demande.
 *
 * LA CLÉ EST LE TEXTE DU `where`, PAS UN NUMÉRO DE LIGNE. Un numéro se décale
 * au premier commentaire ajouté trente lignes plus haut, et l'inscription
 * pointerait alors une autre requête sans que rien ne le dise. Le texte, lui,
 * change exactement quand la requête change — c'est-à-dire quand il faut
 * reconsidérer la dispense.
 *
 * ═══ CE QU'ELLE NE COUVRE PAS, ET POURQUOI ═══
 *
 * `update` ET `delete` AU SINGULIER SONT HORS CHAMP. Ils visent une ligne par
 * son identifiant, lequel vient presque toujours d'une lecture déjà filtrée
 * juste au-dessus. Les exiger produirait du bruit sur des sites corrects et
 * ferait perdre à la garde ce qui fait sa valeur : que sa rougeur signifie
 * quelque chose. `updateMany` et `deleteMany`, qui désignent un ENSEMBLE, sont
 * dans le champ.
 *
 * `create` est hors champ : il ÉCRIT un statut, il n'en lit aucun.
 *
 * ELLE NE LIT QUE LA SOURCE. Une requête composée à l'exécution — un `where`
 * assemblé depuis une variable — lui échappe. Il n'y en a aucune aujourd'hui ;
 * il pourrait y en avoir demain, et la garde ne le dirait pas.
 */
const RACINE = new URL('../..', import.meta.url).pathname

/**
 * Les lectures qui embrassent DÉLIBÉRÉMENT tous les statuts.
 *
 * ÉCRITE À LA MAIN, comme tous les registres de ce dépôt : une liste dérivée du
 * code serait d'accord avec elle-même et ne pourrait rien refuser.
 */
const SANS_STATUT_ASSUME: { ou: string; motif: string }[] = [
  {
    ou: "{ userId: req.compteId!, parkId }",
    motif:
      'POST /api/access-requests — « déjà membre, à quelque titre et quel que soit le ' +
      'statut, on ne touche à rien ». Filtrer sur `active` laisserait dédoubler une ' +
      'demande, et contourner une révocation sans que le propriétaire l’ait rouverte.',
  },
  {
    ou: "{ userId: req.compteId!, parkId: invitation.parkId }",
    motif:
      'POST /api/join — cette route AIGUILLE sur le statut : `revoked` et `requested` ' +
      'rouvrent la porte, `active` rend 409. Un filtre ici lui retirerait précisément ' +
      'ce qu’elle a mis quatre correctifs à apprendre.',
  },
]

/** Les fichiers de source du serveur, tests et code généré exclus. */
function sources(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) {
      if (entree.name === 'generated' || entree.name === 'node_modules') continue
      trouves.push(...sources(chemin))
    } else if (entree.name.endsWith('.ts') && !entree.name.endsWith('.test.ts')) {
      trouves.push(chemin)
    }
  }
  return trouves
}

/** Le bloc d'accolades équilibré qui commence à `depart`. */
function blocEquilibre(source: string, depart: number): string {
  let profondeur = 0
  for (let i = depart; i < source.length; i++) {
    if (source[i] === '{') profondeur++
    else if (source[i] === '}') {
      profondeur--
      if (profondeur === 0) return source.slice(depart, i + 1)
    }
  }
  return ''
}

/* `update` et `delete` au singulier sont absents : voir l'en-tête. */
const LECTURES =
  /(?:prisma|tx)\.membership\.(findFirst|findFirstOrThrow|findMany|findUnique|findUniqueOrThrow|count|updateMany|deleteMany)\(/g

type Lecture = { fichier: string; ligne: number; operation: string; ou: string }

function lecturesDAdhesion(): Lecture[] {
  const relevees: Lecture[] = []
  for (const fichier of sources(join(RACINE, 'src'))) {
    const source = readFileSync(fichier, 'utf8')
    const relatif = fichier.slice(RACINE.length)

    for (const trouve of source.matchAll(LECTURES)) {
      const argument = blocEquilibre(source, source.indexOf('{', trouve.index! + trouve[0].length - 1))
      const positionOu = argument.indexOf('where:')
      const ou =
        positionOu < 0 ? '' : blocEquilibre(argument, argument.indexOf('{', positionOu))
      relevees.push({
        fichier: relatif,
        ligne: source.slice(0, trouve.index).split('\n').length,
        operation: trouve[1]!,
        ou: ou.replace(/\s+/g, ' ').trim(),
      })
    }

    /* LES LECTURES IMBRIQUÉES comptent autant : `memberships: { where: … }` sous
       un autre modèle, et surtout `memberships: { some: … }`, qui accorde un
       accès sur la SEULE EXISTENCE d'une ligne. C'est la forme la plus exposée
       de toutes, et celle qu'un futur listing de parcs écrirait en premier. */
    for (const trouve of source.matchAll(/memberships:\s*\{/g)) {
      const bloc = blocEquilibre(source, source.indexOf('{', trouve.index!))
      if (!/^\{\s*(where|some|every|none):/.test(bloc.replace(/\s+/g, ' '))) continue
      relevees.push({
        fichier: relatif,
        ligne: source.slice(0, trouve.index).split('\n').length,
        operation: 'imbriquée',
        ou: bloc.replace(/\s+/g, ' ').trim(),
      })
    }
  }
  return relevees
}

const nommeUnStatut = (ou: string) => /\bstatus\b/.test(ou)
const inscrite = (ou: string) => SANS_STATUT_ASSUME.some((d) => d.ou === ou)

describe('toute lecture d’adhésion', () => {
  it('trouve bien des lectures — sans quoi cette garde ne garderait rien', () => {
    /* Une expression rompue par un renommage rendrait une liste VIDE, et les
       trois cas suivants passeraient au vert en ne mesurant rien. */
    expect(lecturesDAdhesion().length).toBeGreaterThanOrEqual(10)
  })

  it('nomme le statut qu’elle accepte, ou s’en dispense EXPLICITEMENT', () => {
    const muettes = lecturesDAdhesion()
      .filter((l) => !nommeUnStatut(l.ou) && !inscrite(l.ou))
      .map((l) => `${l.fichier}:${l.ligne} (${l.operation})  where=${l.ou || '— aucun —'}`)

    expect(
      muettes,
      'ces lectures ramassent `active`, `requested` ET `revoked` sans le dire. Nommez ' +
        'le statut attendu, ou inscrivez la requête dans `SANS_STATUT_ASSUME` avec son ' +
        'motif :\n  ' + muettes.join('\n  '),
    ).toEqual([])
  })

  it('ne laisse AUCUNE dispense morte derrière elle', () => {
    /* Une dispense qui ne correspond plus à aucune requête est un motif qui
       parle d'un code disparu — et elle couvrirait en silence une requête
       future qui retomberait sur le même texte. */
    const relevees = lecturesDAdhesion()
    const mortes = SANS_STATUT_ASSUME.filter(
      (d) => !relevees.some((l) => l.ou === d.ou && !nommeUnStatut(l.ou)),
    ).map((d) => d.ou)

    expect(
      mortes,
      'ces dispenses ne correspondent plus à aucune lecture sans statut — la requête ' +
        'a été filtrée ou a disparu :\n  ' + mortes.join('\n  '),
    ).toEqual([])
  })

  it('donne un MOTIF à chaque dispense, et pas un renvoi', () => {
    /* Une dispense sans motif est une exception muette : elle a exactement le
       même effet qu'un oubli, en ayant l'air d'une décision. */
    const creuses = SANS_STATUT_ASSUME.filter((d) => d.motif.trim().length < 60).map((d) => d.ou)
    expect(creuses, 's’inscrire est un geste ; le motif est ce qui le rend relisible').toEqual([])
  })
})
