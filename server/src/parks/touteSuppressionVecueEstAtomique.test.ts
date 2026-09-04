import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * UNE SUPPRESSION QUE L'UTILISATEUR A VÉCUE NE PART PAS SANS SA TRACE.
 *
 * ═══ LE CRITÈRE QUI MANQUAIT ═══
 *
 * `leJournalNeFaitPasEchouerLActe` tient déjà la règle : quatre actions
 * déclarées écrivent leur trace DANS la transaction qui détruit, les autres
 * après. Mais rien ne vérifiait que ces quatre-là soient les BONNES. Le critère
 * — « l'entité n'existe plus, donc une trace perdue est indétectable » — vivait
 * dans un commentaire, appliqué à la main. Une cinquième suppression sous un
 * autre nom n'y serait entrée que si quelqu'un y pensait.
 *
 * ═══ POURQUOI LE MODÈLE, ET NON L'ACTION ═══
 *
 * J'ai d'abord cherché à distinguer une suppression « métier » d'un nettoyage
 * interne par la forme du code, et je n'ai rien trouvé qui tienne. Le critère
 * n'est pas dans le geste, il est dans CE QU'ON SUPPRIME.
 *
 * Les modèles forment un ensemble CLOS et énumérable — le schéma les liste. On
 * les classe donc une fois, tous, et la classification devient le critère. Un
 * modèle neuf oblige à trancher : sa disparition se vit-elle, ou non ?
 *
 * ═══ CE QUE LA CLASSIFICATION VEUT DIRE ═══
 *
 * VÉCUE : l'utilisateur connaissait cette chose, elle figurait sur un écran, et
 * après coup rien ne peut plus témoigner qu'elle a existé. Un versement, une
 * fiche de locataire, un immeuble.
 *
 * SANS ENJEU : une ligne de liaison, un jeton, un compteur, une copie. Sa
 * disparition ne retire rien à personne — le rattachement d'un gestionnaire à un
 * immeuble se refait d'un clic, et le registre des accès porte déjà la décision.
 */
const RACINE = join(import.meta.dirname, '../..')

/** Ce dont la disparition se VIT : elle doit partir avec sa trace, atomiquement. */
const MODELES_VECUS = [
  'Building',
  'Deposit',
  'DocumentRequest',
  'Inspection',
  'InspectionFinding',
  'InspectionPhoto',
  'Invitation',
  'Lease',
  'Membership',
  'MeterReading',
  'Park',
  'Payment',
  'RentCharge',
  'Tenant',
  'Unit',
  'UserAccount',
  'UtilityTariff',
  'WorkOrder',
] as const

/** Ce dont la disparition ne retire rien à personne. */
const MODELES_SANS_ENJEU = [
  'AuditEvent',
  'MembershipBuilding',
  'MembershipUnit',
  'Notification',
  'NotificationRecipient',
  'PasswordReset',
  'RentReminderEmail',
  'Session',
  'WorkReferenceCounter',
  'WorkThreadEmail',
] as const

/**
 * Les routes qui suppriment une chose VÉCUE sans trace atomique, ET POURQUOI.
 *
 * Une seule aujourd'hui, et son motif est le seul du genre que j'aie su écrire :
 * elle annule un téléversement que personne n'a jamais vu.
 */
const SANS_TRACE_ATOMIQUE: { route: string; motif: string }[] = [
  {
    route: '/:parkId/photos/:photoId/confirmation',
    motif:
      'Elle ne supprime la photo que sur le chemin de REJET : le stockage a refusé le ' +
      'fichier, la confirmation échoue, et l’on retire une ligne qui n’a jamais désigné ' +
      'une preuve. Rien n’a été vécu — la photo n’a figuré sur aucun écran, personne ne ' +
      'peut la chercher. Consigner ce retrait remplirait le registre de non-événements.',
  },
]

/** Les sources du serveur, tests et code généré exclus. */
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

/** Les modèles déclarés par le schéma Prisma. */
function modelesDuSchema(): string[] {
  const schema = readFileSync(join(RACINE, 'prisma/schema.prisma'), 'utf8')
  return [...schema.matchAll(/^model ([A-Za-z]+)/gm)].map((m) => m[1]!).sort()
}

/** `payment` → `Payment` : le client Prisma nomme en minuscule initiale. */
const enModele = (accesseur: string) => accesseur[0]!.toUpperCase() + accesseur.slice(1)

type Route = { chemin: string; modelesSupprimes: string[]; traceAtomique: boolean }

/** Chaque gestionnaire de route, ce qu'il supprime, et où sa trace est écrite. */
function routes(): Route[] {
  const relevees: Route[] = []
  for (const fichier of sources(join(RACINE, 'src'))) {
    const source = readFileSync(fichier, 'utf8')
    const bornes = [...source.matchAll(/^[a-zA-Z]+Router\.(?:get|post|patch|put|delete)\(/gm)].map(
      (m) => m.index!,
    )
    bornes.push(source.length)
    for (let i = 0; i < bornes.length - 1; i++) {
      const bloc = source.slice(bornes[i]!, bornes[i + 1]!)
      const modelesSupprimes = [
        ...new Set(
          [...bloc.matchAll(/(?:prisma|tx)\.([a-zA-Z]+)\.(?:delete|deleteMany)\(/g)].map((m) =>
            enModele(m[1]!),
          ),
        ),
      ]
      if (modelesSupprimes.length === 0) continue
      relevees.push({
        chemin: (/'([^']*)'/.exec(bloc) ?? [])[1] ?? '?',
        modelesSupprimes,
        traceAtomique: /tx\.auditEvent\.create/.test(bloc),
      })
    }
  }
  return relevees
}

describe('les suppressions', () => {
  it('sont bien TROUVÉES — sans quoi cette garde ne garderait rien', () => {
    /* Une expression rompue rendrait zéro route, et « aucune muette » se lirait
       comme « rien à vérifier ». */
    expect(routes().length).toBeGreaterThanOrEqual(5)
    expect(modelesDuSchema().length).toBeGreaterThanOrEqual(20)
  })

  it('classent CHAQUE modèle du schéma, sans oubli ni invention', () => {
    /* Le cœur du lot. Un modèle neuf qui détruirait quelque chose de vécu
       n'entrerait dans le critère que si quelqu'un y pense ; ici, il fait
       rougir tant qu'on n'a pas tranché. */
    const classes = [...MODELES_VECUS, ...MODELES_SANS_ENJEU].sort()
    expect(
      classes,
      'chaque modèle doit être rangé d’un côté ou de l’autre : sa disparition se ' +
        'vit-elle, ou ne retire-t-elle rien à personne ?',
    ).toEqual(modelesDuSchema())
  })

  it('emportent leur trace dans la même transaction, ou se déclarent', () => {
    const declarees = new Set(SANS_TRACE_ATOMIQUE.map((d) => d.route))
    const vecus = new Set<string>(MODELES_VECUS)
    const muettes = routes()
      .filter((r) => r.modelesSupprimes.some((m) => vecus.has(m)))
      .filter((r) => !r.traceAtomique && !declarees.has(r.chemin))
      .map((r) => `${r.chemin} — supprime ${r.modelesSupprimes.join(', ')}`)

    expect(
      muettes,
      'une panne entre l’acte et la trace effacerait sans que rien ne puisse le ' +
        'dire. Écrivez la trace dans la transaction, ou déclarez la route dans ' +
        `\`SANS_TRACE_ATOMIQUE\` avec son motif :\n  ${muettes.join('\n  ')}`,
    ).toEqual([])
  })

  it('ne laissent AUCUNE déclaration morte', () => {
    const connues = new Set(routes().map((r) => r.chemin))
    const mortes = SANS_TRACE_ATOMIQUE.filter((d) => !connues.has(d.route)).map((d) => d.route)
    expect(
      mortes,
      `ces routes ne suppriment plus rien, ou n’existent plus :\n  ${mortes.join('\n  ')}`,
    ).toEqual([])
  })

  it('donnent un MOTIF, et pas un renvoi', () => {
    const creuses = SANS_TRACE_ATOMIQUE.filter((d) => d.motif.trim().length < 80).map((d) => d.route)
    expect(creuses, 'une dispense sans motif a l’effet d’un oubli').toEqual([])
  })
})
