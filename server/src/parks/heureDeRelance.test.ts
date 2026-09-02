import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../db.js'
import { remplacerMessagerie } from '../messagerie/messagerie.js'
import {
  executerRelancesAutomatiques,
  heureDansLeFuseau,
} from '../scripts/executerRelancesAutomatiques.js'

/**
 * L'HEURE D'ENVOI SORT DE LA PLANIFICATION ET ENTRE DANS LE PARC.
 *
 * ═══ CE QUI CHANGE DANS LE CRON ═══
 *
 * Il passait une fois par jour à 6 h UTC. Il passe désormais TOUTES LES HEURES
 * et ne fait rien pour un parc dont ce n'est pas l'heure. La planification ne
 * sait plus QUAND envoyer, seulement quand REGARDER — et c'est exactement ce
 * qui rend l'heure réglable depuis le produit.
 *
 * Le prix est explicite : vingt-trois lectures inutiles par parc et par jour.
 * Il se paie volontiers contre un propriétaire obligé d'ouvrir un tableau de
 * bord d'hébergeur pour décaler un envoi d'une heure.
 *
 * ═══ LE FUSEAU N'EST PAS UN LUXE ═══
 *
 * « 7 h » ne veut rien dire seul, et le pays ne le donne pas : ce produit a en
 * production un parc qui porte `FR` et loue à Yaoundé. C'est le fuseau de qui
 * REÇOIT qui compte, jamais celui de qui administre.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * Le RÉSUMÉ du fil n'a pas d'heure par parc — il appartient au compte qui le
 * reçoit, et un gestionnaire de trois parcs n'en reçoit qu'un. Il garde donc
 * l'heure historique, et le dernier cas vérifie que cette borne existe, faute
 * de pouvoir l'éprouver : elle vit dans le bloc d'exécution directe, que ce
 * fichier ne peut pas importer sans déclencher le parcours complet.
 */
let rendre: () => void = () => {}
let envoyes: string[] = []

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  envoyes = []
  rendre = remplacerMessagerie({
    async envoyerSms() {
      return false
    },
    async envoyerEmail(adresse) {
      envoyes.push(adresse)
      return true
    },
  })
})

afterEach(() => {
  rendre()
})

/** Un parc, un bail en retard de sept jours, et son locataire joignable. */
async function parcEnRetard(reglages: Record<string, unknown>) {
  const maintenant = new Date()
  const minuit = new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
  )
  const parc = await prisma.park.create({
    data: { name: 'Parc de sonde', countryCode: 'CM', currency: 'XAF', ...reglages },
  })
  const immeuble = await prisma.building.create({
    data: { parkId: parc.id, name: 'Résidence', district: 'Bastos' },
  })
  const unite = await prisma.unit.create({
    data: {
      buildingId: immeuble.id,
      label: 'A1',
      type: 'T2',
      surfaceSqm: 50,
      baseRentMinor: 100000,
    },
  })
  const locataire = await prisma.tenant.create({
    data: { parkId: parc.id, fullName: 'Paul Kamga', email: 'paul@example.com' },
  })
  const bail = await prisma.lease.create({
    data: {
      unitId: unite.id,
      tenantId: locataire.id,
      startsOn: new Date(minuit.getTime() - 200 * 86_400_000),
      rentMinor: 100000,
      status: 'active',
    },
  })
  await prisma.rentCharge.create({
    data: {
      leaseId: bail.id,
      periodStart: new Date(minuit.getTime() - 7 * 86_400_000),
      dueOn: new Date(minuit.getTime() - 7 * 86_400_000),
      rentMinor: 100000,
    },
  })
  return parc
}

/*
  AUCUN CAS NE FIGE L'HORLOGE. Chacun lit l'heure qu'il est vraiment, dans le
  fuseau qu'il veut éprouver, et règle le parc dessus — ou juste à côté. Une
  horloge simulée aurait dû cohabiter avec les délais d'un vrai Postgres ; la
  question posée ici ne le vaut pas.
*/
describe('l’heure du parc', () => {
  it('relance quand c’est son heure', async () => {
    await parcEnRetard({ reminderTimeZone: 'UTC', reminderHour: new Date().getUTCHours() })
    expect((await executerRelancesAutomatiques()).envoyes).toBe(1)
  })

  it('ne relance PAS une heure trop tôt', async () => {
    /* C'est ce que fait le cron vingt-trois fois sur vingt-quatre, et c'est
       tout ce qu'il doit faire. */
    await parcEnRetard({
      reminderTimeZone: 'UTC',
      reminderHour: (new Date().getUTCHours() + 1) % 24,
    })
    expect((await executerRelancesAutomatiques()).envoyes).toBe(0)
    expect(envoyes, 'rien n’a même été tenté').toEqual([])
  })

  it('lit l’heure dans le FUSEAU du parc, et non en UTC', async () => {
    /* Tokyo est à UTC+9 : son heure locale ne coïncide JAMAIS avec l'heure UTC.
       Un parc réglé sur l'heure de Tokyo doit donc partir, et il ne partirait
       pas si le lanceur comparait à l'heure UTC. */
    const maintenant = new Date()
    const aTokyo = heureDansLeFuseau(maintenant, 'Asia/Tokyo')
    expect(aTokyo, 'la garde ne vaut que si les deux heures diffèrent').not.toBe(
      maintenant.getUTCHours(),
    )
    await parcEnRetard({ reminderTimeZone: 'Asia/Tokyo', reminderHour: aTokyo })
    expect((await executerRelancesAutomatiques()).envoyes).toBe(1)
  })

  it('compte MINUIT comme zéro, et non comme vingt-quatre', async () => {
    /* `hour12: false` rend « 24 » à minuit dans certaines versions d'ICU. Un
       parc réglé sur 0 ne serait alors jamais relancé — un défaut qui ne se
       verrait qu'une heure par jour, et jamais aux heures de bureau. */
    expect(heureDansLeFuseau(new Date('2026-01-01T00:30:00Z'), 'UTC')).toBe(0)
    expect(heureDansLeFuseau(new Date('2026-01-01T23:30:00Z'), 'UTC')).toBe(23)
  })

  it('garde SIX HEURES UTC quand le parc n’a rien choisi', async () => {
    /* Le couple par défaut reproduit l'ancien cron `0 6 * * *` à la seconde
       près : personne ne change d'heure d'envoi au moment où le réglage
       apparaît. */
    const parc = await parcEnRetard({})
    expect([parc.reminderHour, parc.reminderTimeZone]).toEqual([6, 'UTC'])
  })
})

describe('le mode à blanc', () => {
  it('IGNORE l’heure, et compte ce qui partirait à celle du parc', async () => {
    /* Sans cela, la seule lecture qui précède la décision rendrait zéro pour la
       seule raison qu'on l'a lancée à 21 h. La ligne imprimée le dit mot pour
       mot : « PARTIRAIENT À L'HEURE DE LEUR PARC ». */
    await parcEnRetard({
      reminderTimeZone: 'UTC',
      reminderHour: (new Date().getUTCHours() + 1) % 24,
    })
    const blanc = await executerRelancesAutomatiques({ aBlanc: true })
    expect(blanc.partiraient).toBe(1)
    expect(envoyes, 'et rien ne part pour autant').toEqual([])
  })
})

describe('le résumé du fil', () => {
  it('reste borné à une heure, sous un passage devenu horaire', () => {
    /*
      LE PIÈGE QUE CE LOT INTRODUIT. Le résumé partait une fois par jour parce
      que le cron passait une fois par jour. Le passage devient horaire : sans
      borne, chaque compte recevrait VINGT-QUATRE résumés quotidiens, et cela ne
      se serait vu qu'en production, sur de vraies boîtes aux lettres.

      Ce cas lit la SOURCE plutôt que d'exécuter : la borne vit dans le bloc
      d'exécution directe, qu'importer déclencherait le parcours complet.
    */
    const source = readFileSync(
      join(import.meta.dirname, '..', 'scripts', 'executerRelancesAutomatiques.ts'),
      'utf8',
    )
    expect(
      source.includes('HEURE_DU_RESUME_UTC'),
      'la borne horaire du résumé a disparu du lanceur',
    ).toBe(true)
    expect(
      source,
      'l’appel au résumé n’est plus conditionné à son heure',
    ).toMatch(/heureDuResume\s*\?\s*await envoyerLesResumesDuFil/)
  })
})
