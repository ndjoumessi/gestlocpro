import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../db.js'
import {
  JOURS_AVANT_LE_DEPART,
  JOURS_AVANT_LE_TERME,
  dansLeDelai,
  executerAvisDEcheance,
  joursJusqua,
} from '../scripts/executerAvisDEcheance.js'

/**
 * LES ÉCHÉANCES DE BAIL PRÉVIENNENT.
 *
 * ═══ CE QUE CES CAS GARDENT ═══
 *
 * D'abord que l'avis PART, parce que le défaut d'origine était une absence
 * totale : `leaseRenewal` existait dans les deux dictionnaires avec son pluriel
 * et ses quatre variables, et RIEN ne l'écrivait. Un libellé sans écrivain ne
 * rougit nulle part — c'est la troisième fois que ce dépôt trouve cette forme.
 *
 * Ensuite l'IDEMPOTENCE, qui est le vrai risque de ce lot : le cron passe
 * toutes les heures, et un bail à soixante jours de son terme produirait sans
 * garde 1 440 avis pour un seul fait. Deux cas la tiennent — le second passage
 * se tait, et déplacer l'échéance rouvre le droit de parler.
 *
 * Enfin la BORNE BASSE de la fenêtre, qui est celle qu'on oublie : sans elle,
 * le premier passage en production aurait annoncé le terme de tous les baux
 * échus depuis l'origine du parc, et le libellé aurait rendu « à renouveler
 * dans −400 jours » tel quel.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * UN BAIL `active` DONT LE TERME EST DÉJÀ PASSÉ. Il court sans que rien ne le
 * signale, et c'est un vrai défaut — mais ce n'est pas une échéance à venir,
 * c'est une incohérence installée, qui demande une correction du bail ou un
 * avenant et non un avis que personne ne peut refermer. Nommé, pas construit.
 *
 * LE RENDU DU LIBELLÉ. Que `{unit}`, `{count}`, `{tenant}` et `{date}` soient
 * tous fournis est tenu par `variablesDAvis.test.ts`, qui confronte les
 * libellés au bâtisseur de variables. Le dernier cas d'ici tient l'autre
 * moitié, celle qu'aucune des deux gardes ne voyait : que la clé écrite par le
 * serveur EXISTE dans le dictionnaire.
 */

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

/** Un bail actif, avec l'échéance qu'on veut éprouver et rien d'autre. */
async function bailAvecEcheance(echeances: { endsOn?: Date; moveOutOn?: Date }) {
  const parc = await prisma.park.create({
    data: { name: 'Parc de sonde', countryCode: 'CM', currency: 'XAF' },
  })
  const immeuble = await prisma.building.create({
    data: { parkId: parc.id, name: 'Résidence', district: 'Bastos' },
  })
  const unite = await prisma.unit.create({
    data: {
      buildingId: immeuble.id,
      label: 'B7',
      type: 'T3',
      surfaceSqm: 70,
      baseRentMinor: 150000,
    },
  })
  const locataire = await prisma.tenant.create({
    data: { parkId: parc.id, fullName: 'Serge Mbarga', email: 'serge@example.com' },
  })
  const bail = await prisma.lease.create({
    data: {
      unitId: unite.id,
      tenantId: locataire.id,
      startsOn: new Date(Date.now() - 300 * 86_400_000),
      rentMinor: 150000,
      status: 'active',
      ...echeances,
    },
  })
  return { parc, unite, bail }
}

/** Dans `n` jours, à minuit UTC. */
function dansNJours(n: number): Date {
  const maintenant = new Date()
  return new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() + n),
  )
}

describe('le terme du bail', () => {
  it('annonce un terme dans la fenêtre, sur une clé que le dictionnaire connaît', async () => {
    const { parc, unite } = await bailAvecEcheance({ endsOn: dansNJours(45) })
    const resultat = await executerAvisDEcheance()
    expect(resultat.termes).toBe(1)
    const avis = await prisma.notification.findMany({ where: { parkId: parc.id } })
    expect(avis).toHaveLength(1)
    expect(avis[0]?.messageKey).toBe('leaseRenewal')
    expect(avis[0]?.kind).toBe('lease')
    expect(avis[0]?.unitId, 'le logement, pour que l’écran résolve son libellé').toBe(unite.id)
    const params = avis[0]?.params as {
      tenant?: string
      count?: number
      dueOn?: { year: number; month: number; day: number }
    }
    expect(params.tenant).toBe('Serge Mbarga')
    expect(params.count, 'le décompte porte aussi l’accord en nombre').toBe(45)
    /* LE MOIS EST À BASE ZÉRO — c'est la forme de `DateParts`, que
       `useAlertMessage` passe à `d.fullDate`. Un mois à base un décalerait
       toutes les dates d'avis d'un mois, et décembre deviendrait janvier de
       l'année suivante. */
    const echeance = dansNJours(45)
    expect(params.dueOn).toEqual({
      year: echeance.getUTCFullYear(),
      month: echeance.getUTCMonth(),
      day: echeance.getUTCDate(),
    })
  })

  it('n’annonce RIEN hors de la fenêtre', async () => {
    await bailAvecEcheance({ endsOn: dansNJours(JOURS_AVANT_LE_TERME + 5) })
    expect((await executerAvisDEcheance()).termes).toBe(0)
    expect(await prisma.notification.count()).toBe(0)
  })

  it('n’annonce PAS une échéance déjà passée', async () => {
    /*
      LA BORNE BASSE, et c'est celle qu'on oublie. Sans elle, le premier
      passage de ce cron en production aurait annoncé le terme de tous les baux
      échus depuis l'origine du parc — et le libellé « à renouveler dans
      {count} jours » aurait rendu un nombre NÉGATIF tel quel.
    */
    await bailAvecEcheance({ endsOn: dansNJours(-10) })
    expect((await executerAvisDEcheance()).termes).toBe(0)
    expect(await prisma.notification.count()).toBe(0)
  })
})

describe('le départ annoncé', () => {
  it('annonce un départ sur sa propre clé, et plus urgemment qu’un terme', async () => {
    const { parc } = await bailAvecEcheance({ moveOutOn: dansNJours(20) })
    expect((await executerAvisDEcheance()).departs).toBe(1)
    const avis = await prisma.notification.findMany({ where: { parkId: parc.id } })
    expect(avis[0]?.messageKey, 'et non `leaseRenewal` : un partant ne se renouvelle pas').toBe(
      'leaseMoveOut',
    )
    expect(avis[0]?.severity, 'un départ ouvre une liste de gestes datés').toBe('high')
  })

  it('a une fenêtre PLUS COURTE que le terme', async () => {
    /*
      Les deux délais ne sont pas une symétrie manquée : renouveler se négocie
      — écrire, s'entendre sur un loyer — alors qu'un départ est décidé et qu'il
      ne reste qu'une liste à exécuter. Prévenir deux mois à l'avance d'un geste
      d'une semaine fabrique un avis qu'on apprend à ignorer.

      Le cas prend une date DANS la fenêtre du terme et HORS de celle du départ,
      ce qui n'existe que si les deux délais diffèrent dans ce sens.
    */
    expect(JOURS_AVANT_LE_DEPART).toBeLessThan(JOURS_AVANT_LE_TERME)
    await bailAvecEcheance({ moveOutOn: dansNJours(JOURS_AVANT_LE_DEPART + 10) })
    expect((await executerAvisDEcheance()).departs).toBe(0)
  })

  it('annonce les DEUX échéances d’un bail qui les porte toutes les deux', async () => {
    /* Un congé donné sur un bail qui arrivait de toute façon à son terme : les
       deux faits sont vrais, et les deux gestes diffèrent. Les confondre
       ferait taire l'un des deux. */
    await bailAvecEcheance({ endsOn: dansNJours(50), moveOutOn: dansNJours(20) })
    const resultat = await executerAvisDEcheance()
    expect(resultat.termes).toBe(1)
    expect(resultat.departs).toBe(1)
    expect(resultat.bauxLus, 'un seul bail, deux avis').toBe(1)
    expect(await prisma.notification.count()).toBe(2)
  })
})

describe('l’idempotence', () => {
  it('ne répète PAS un avis à l’heure suivante', async () => {
    /*
      LE RISQUE PRINCIPAL DE CE LOT. Le cron passe toutes les heures : sans
      garde, un bail à soixante jours de son terme produirait vingt-quatre avis
      par jour pendant soixante jours, soit 1 440 lignes pour un seul fait.
    */
    await bailAvecEcheance({ endsOn: dansNJours(45) })
    expect((await executerAvisDEcheance()).termes).toBe(1)
    expect((await executerAvisDEcheance()).termes, 'le second passage se tait').toBe(0)
    expect((await executerAvisDEcheance()).termes, 'et le troisième aussi').toBe(0)
    expect(await prisma.notification.count()).toBe(1)
  })

  it('rouvre le droit d’en parler quand l’ÉCHÉANCE se déplace', async () => {
    /*
      `dueOn` EST DANS LA CLÉ D'UNICITÉ, et c'est pour ce cas. Un congé retiré
      puis redonné à une autre date est une échéance NEUVE : elle doit pouvoir
      se dire. Une colonne `renewalNoticedAt` sur le bail l'aurait tue en
      gardant la trace de l'ancienne.
    */
    const { bail } = await bailAvecEcheance({ moveOutOn: dansNJours(20) })
    expect((await executerAvisDEcheance()).departs).toBe(1)
    await prisma.lease.update({
      where: { id: bail.id },
      data: { moveOutOn: dansNJours(25) },
    })
    expect((await executerAvisDEcheance()).departs, 'la date neuve se dit').toBe(1)
    expect(await prisma.notification.count()).toBe(2)
  })

  it('n’écrit NI avis NI trace en mode à blanc', async () => {
    await bailAvecEcheance({ endsOn: dansNJours(45) })
    expect((await executerAvisDEcheance({ aBlanc: true })).termes, 'il l’annonce').toBe(1)
    expect(await prisma.notification.count(), 'et n’écrit pas l’avis').toBe(0)
    expect(
      await prisma.leaseDeadlineNotice.count(),
      'ni la trace — qui consommerait le tour qu’elle devait décrire',
    ).toBe(0)
  })
})

describe('le décompte des jours', () => {
  it('compte en JOURS DE CALENDRIER, et non en tranches de vingt-quatre heures', () => {
    /*
      Les deux bornes sont ramenées à minuit UTC avant la soustraction. Sans
      cela, une échéance lue à 23 h et un « aujourd'hui » lu à 1 h rendraient
      59,08 jours là où le calendrier en compte 60 — et le bail serait annoncé
      un jour trop tard, une fois sur vingt-quatre.
    */
    expect(
      joursJusqua(new Date('2026-12-01T23:00:00Z'), new Date('2026-10-02T01:00:00Z')),
      'du 2 octobre au 1er décembre',
    ).toBe(60)
    expect(joursJusqua(new Date('2026-10-02T23:59:00Z'), new Date('2026-10-02T00:01:00Z'))).toBe(0)
  })

  it('tient le jour MÊME de l’échéance comme encore annonçable', () => {
    /*
      Le dernier jour où l'avis vaut quelque chose, et le seul où un bail que le
      cron n'a pas vu pendant deux mois peut encore être rattrapé.

      AUCUNE ASSERTION SUR UN NOMBRE NÉGATIF ICI, et c'est une correction que
      la mutation a imposée. Cette fonction portait aussi `jours >= 0`, et la
      borne y était MORTE : la requête filtre déjà `gte: aujourdhui`, si bien
      qu'une échéance passée n'atteint jamais cette ligne. Le cas d'à côté —
      « n'annonce PAS une échéance déjà passée » — éprouve donc la REQUÊTE, et
      c'est là que la garde vit désormais, seule.
    */
    expect(dansLeDelai(0, JOURS_AVANT_LE_TERME)).toBe(true)
    expect(dansLeDelai(JOURS_AVANT_LE_TERME, JOURS_AVANT_LE_TERME), 'la borne haute').toBe(true)
    expect(dansLeDelai(JOURS_AVANT_LE_TERME + 1, JOURS_AVANT_LE_TERME)).toBe(false)
    expect(dansLeDelai(JOURS_AVANT_LE_DEPART + 1, JOURS_AVANT_LE_DEPART), 'le départ').toBe(false)
  })
})

describe('la clé écrite existe dans le dictionnaire', () => {
  it('nomme deux libellés que `fr.ts` et `en.ts` portent tous les deux', () => {
    /*
      LA MOITIÉ QU'AUCUNE GARDE NE VOYAIT.

      `variablesDAvis.test.ts` confronte les VARIABLES d'un libellé au
      bâtisseur : il refuse un libellé qui réclame une variable que personne ne
      pose. Il ne dit rien du sens inverse — une clé que le SERVEUR écrit et
      que le dictionnaire ignore. L'écran affiche alors la clé elle-même, et
      c'est exactement ce qui est arrivé à `rentReminder` et `formalNotice`,
      « jamais en démonstration, ce qui est exactement pourquoi le défaut a
      tenu ».

      La lecture porte sur les DEUX dictionnaires : une clé posée en français
      seulement rendrait l'avis illisible en anglais, et la garde de parité
      i18n compare des ensembles de clés sans savoir lesquelles le serveur
      utilise.
    */
    const racine = join(import.meta.dirname, '../../..')
    const source = readFileSync(
      join(racine, 'server/src/scripts/executerAvisDEcheance.ts'),
      'utf8',
    )
    /* LES DEUX BRANCHES DU TERNAIRE, et non « les chaînes de la ligne » : la
       condition en porte une troisième — `=== 'term'` — et une lecture naïve
       prenait le genre pour une clé de libellé. */
    const clesEcrites = [
      ...source.matchAll(/messageKey:[^\n]*\?\s*'(\w+)'\s*:\s*'(\w+)'/g),
    ].flatMap((m) => [m[1]!, m[2]!])
    expect(clesEcrites, 'les deux clés sont lues dans la source, jamais recopiées ici').toEqual([
      'leaseRenewal',
      'leaseMoveOut',
    ])
    for (const dictionnaire of ['src/i18n/fr.ts', 'src/i18n/en.ts']) {
      const texte = readFileSync(join(racine, dictionnaire), 'utf8')
      for (const cle of clesEcrites) {
        expect(texte, `${cle} manque à ${dictionnaire}`).toContain(`${cle}: {`)
      }
    }
  })
})
