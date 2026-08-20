import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * Contrat entre le serveur et les écrans, éprouvé contre un VRAI parc.
 *
 * Un défaut a échappé à 264 tests client et 72 tests serveur : les alertes
 * s'affichaient « Loyer {unit} en retard de 24 jours ». Le serveur semait des
 * paramètres — `count`, `amount` — et les messages du client en interpolaient
 * d'autres — `unit`, `tenant`, `date`. Chaque moitié était juste ; c'est leur
 * jonction qui ne l'était pas.
 *
 * Aucune des deux suites ne pouvait le voir. Celles du client tournent sans
 * parc, donc sur les constantes ; celles du serveur vérifient la forme de la
 * réponse, pas ce que l'autre côté en fait. Ce fichier est le seul endroit où
 * les deux se rencontrent : il lit les **vrais gabarits de traduction** du
 * client et vérifie que la réponse du serveur les satisfait.
 *
 * Il ne monte pas React — il n'en a pas besoin. Ce qui manquait n'était pas un
 * rendu, c'était un accord sur les noms.
 */
const app = createApp()
/**
 * Un serveur unique pour le fichier : `request(serveur)` en ouvrait un par appel.
 * Voir `parks/routes.test.ts`, où la collision de ports éphémères se voyait —
 * une exécution sur trois, jamais au même endroit.
 */
const serveur = app.listen(0)

/** Noms interpolés par un gabarit : `{unit}`, `{count}`… */
function placeholders(gabarit: string): string[] {
  return [...gabarit.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)
}

/**
 * Gabarits de messages, lus dans le dictionnaire français du client.
 *
 * Lus et non recopiés : une copie se désynchroniserait au premier message
 * modifié, et ce test deviendrait exactement le genre de garde qui rassure
 * sans rien vérifier.
 */
function gabaritsDuClient(): Map<string, string[]> {
  const source = readFileSync(new URL('../../../src/i18n/fr.ts', import.meta.url), 'utf8')
  const bloc = source.slice(source.indexOf('      msg: {'))
  const parMessage = new Map<string, string[]>()

  // `sinkLeak: { title: '…', detail: '…' }` — on relève chaque clé de message
  // et les gabarits qu'elle porte.
  const messages = [...bloc.matchAll(/^        (\w+): \{\n((?:.*\n)*?)^        \},$/gm)]
  for (const [, cle, corps] of messages) {
    const noms = [...(corps ?? '').matchAll(/: '([^']*)'/g)].flatMap((m) => placeholders(m[1]!))
    parMessage.set(cle!, [...new Set(noms)])
  }
  return parMessage
}

/**
 * Correspondance entre les noms interpolés et les champs de `params`.
 *
 * Elle reproduit `useAlertMessage` côté client — le seul endroit où un `on` ou
 * un `dueOn` devient un `{date}`. La duplication est assumée : c'est justement
 * cette traduction qui n'était vérifiée nulle part.
 */
const CHAMP_POUR = new Map<string, string[]>([
  ['unit', ['unitId']],
  ['tenant', ['tenant']],
  ['workId', ['workId']],
  ['count', ['count']],
  ['amount', ['amount']],
  ['total', ['total']],
  ['date', ['on', 'dueOn']],
  ['period', ['period']],
  ['units', ['units']],
])

let cookie: string
let parkId: string

beforeAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()

  const res = await request(serveur).post('/api/auth/signup').send({
    email: 'contrat@example.com',
    password: 'un-mot-de-passe-assez-long',
    fullName: 'Compte de contrat',
    acceptTerms: true,
    countryCode: 'CM',
    parkName: 'Parc de contrat',
    seedDemo: true,
  })
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  cookie = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))!

  const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  parkId = parcs.body.memberships[0].parkId
})

afterAll(async () => {
  await new Promise((resoudre) => serveur.close(resoudre))
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
})

async function portefeuille() {
  const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
  expect(res.status).toBe(200)
  return res.body
}

describe('les notifications portent ce que leurs messages interpolent', () => {
  it('ne laisse aucune accolade sans valeur', async () => {
    // LE défaut qui a échappé. Sans ce cas, l'écran affiche « Loyer {unit} en
    // retard de 24 jours » et rien ne le signale — ni compilation, ni test.
    const { notifications } = await portefeuille()
    const gabarits = gabaritsDuClient()
    expect(gabarits.size).toBeGreaterThan(0)

    const manquants: string[] = []
    for (const n of notifications) {
      const attendus = gabarits.get(n.messageKey)
      expect(attendus, `aucun gabarit pour « ${n.messageKey} »`).toBeDefined()

      for (const nom of attendus!) {
        const champs = CHAMP_POUR.get(nom) ?? [nom]
        const present = champs.some((c) => n.params?.[c] !== undefined && n.params[c] !== null)
        if (!present) manquants.push(`${n.messageKey}.{${nom}}`)
      }
    }
    expect(manquants).toEqual([])
  })

  /**
   * Les notifications que le PRODUIT écrit, et non celles que la démonstration
   * a semées.
   *
   * Le cas ci-dessus lit le portefeuille d'un parc fraîchement créé : il ne
   * voit donc que les sept notifications du jeu de démonstration, toutes
   * écrites à la main avec les bonnes clés. Deux chemins en créent pourtant
   * d'autres à l'exécution — la relance d'impayé et la mise en demeure — et
   * tous deux étaient faux, chacun d'une façon que ce fichier savait déjà
   * attraper :
   *
   *   — la clé portait un préfixe (`notifications.rentReminder`), absent des
   *     deux dictionnaires : l'écran affichait la clé brute ;
   *   — les paramètres portaient les noms du domaine (`overdueDays`,
   *     `dueMinor`) quand le client n'interpole que `count` et `amount` : les
   *     accolades seraient restées à l'écran.
   *
   * Ils ont tenu parce que rien ne les DÉCLENCHAIT ici. Ce cas les déclenche.
   */
  it('vaut aussi pour les notifications qu’une action vient de créer', async () => {
    const avant = await portefeuille()
    const enRetard = avant.buildings
      .flatMap((b: { units: { id: string; leaseId: string | null; status: string }[] }) => b.units)
      .filter((u: { leaseId: string | null; status: string }) => u.leaseId && u.status === 'overdue')
    // Le jeu de démonstration porte des impayés : sans eux, ce cas ne
    // vérifierait rien tout en restant vert.
    expect(enRetard.length).toBeGreaterThan(0)

    const relance = await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', cookie)
      .send({ leaseIds: enRetard.map((u: { leaseId: string }) => u.leaseId) })
    expect(relance.status, JSON.stringify(relance.body)).toBe(200)
    // `sent` est la LISTE des baux relancés, pas leur compte : la route rend
    // `{ sent: string[], skipped: string[] }`.
    expect(relance.body.sent.length).toBeGreaterThan(0)

    const demeure = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${enRetard[0].leaseId}/formal-notice`)
      .set('Cookie', cookie)
      .send({ reason: 'Deux mois de loyer impayés malgré quatre relances.' })
    // 201 : la mise en demeure CRÉE un avis, elle ne met rien à jour.
    expect(demeure.status, JSON.stringify(demeure.body)).toBe(201)

    const { notifications } = await portefeuille()
    const gabarits = gabaritsDuClient()
    const nouvelles = notifications.filter((n: { messageKey: string }) =>
      ['rentReminder', 'formalNotice'].includes(n.messageKey),
    )
    // Les deux chemins ont bien écrit : sans cette borne, un renommage de clé
    // rendrait la liste vide et le reste du cas passerait à vide.
    expect(nouvelles.map((n: { messageKey: string }) => n.messageKey)).toEqual(
      expect.arrayContaining(['rentReminder', 'formalNotice']),
    )

    const manquants: string[] = []
    for (const n of nouvelles) {
      const attendus = gabarits.get(n.messageKey)
      expect(attendus, `aucun gabarit pour « ${n.messageKey} »`).toBeDefined()
      for (const nom of attendus!) {
        const champs = CHAMP_POUR.get(nom) ?? [nom]
        const present = champs.some((c) => n.params?.[c] !== undefined && n.params[c] !== null)
        if (!present) manquants.push(`${n.messageKey}.{${nom}}`)
      }
    }
    expect(manquants).toEqual([])
  })

  it('nomme l’unité par son libellé et non par son identifiant', async () => {
    // `params.unitId` est AFFICHÉ. S'il portait l'uuid, l'utilisateur lirait
    // « Loyer 3f7a91c2-… en retard ».
    const { notifications } = await portefeuille()
    const avecUnite = notifications.filter((n: { params: { unitId?: string } }) => n.params.unitId)
    expect(avecUnite.length).toBeGreaterThan(0)
    for (const n of avecUnite) {
      expect(n.params.unitId).toMatch(/^[A-C]\d$/)
    }
  })
})

describe('le parc satisfait ce que les écrans lisent', () => {
  it('rend chaque unité avec les champs que la table affiche', async () => {
    const { buildings } = await portefeuille()
    const unites = buildings.flatMap((b: { units: unknown[] }) => b.units)
    expect(unites).toHaveLength(12)

    for (const u of unites) {
      // `label` est ce qui s'affiche, `id` ce qui sert de clé : les confondre
      // était le défaut corrigé sur dix écrans.
      expect(typeof u.label).toBe('string')
      expect(u.label).not.toBe(u.id)
      expect(['paid', 'partial', 'overdue', 'pending', 'vacant']).toContain(u.status)
      expect(Number.isInteger(u.rentMinor)).toBe(true)
    }
  })

  it('rend une ligne de relevé par unité et par fluide, manque compris', async () => {
    // Une unité non relevée a une ligne à `indexValue: null` — c'est ce manque
    // que l'écran doit montrer, et le confondre avec « pas de ligne » ferait
    // disparaître l'alerte de facturation incomplète.
    const { readings } = await portefeuille()
    expect(readings).toHaveLength(20)
    expect(readings.filter((r: { indexValue: null }) => r.indexValue === null)).toHaveLength(4)
    // L'index précédent est dérivé de la période antérieure, pas recopié.
    expect(readings.every((r: { previousIndex: number | null }) => r.previousIndex !== null)).toBe(
      true,
    )
  })

  it('rend des intitulés de travaux libres, sans clé de traduction', async () => {
    // Le client portait cinq clés ; rattachée à un compte, la donnée redevient
    // de la saisie — et une saisie ne se traduit pas.
    const { works } = await portefeuille()
    expect(works.length).toBeGreaterThan(0)
    for (const w of works) {
      expect(w.title).toBeTruthy()
      expect(w.title).not.toMatch(/^[a-z][A-Za-z]+$/)
      expect(w.reference).toMatch(/^SIG-\d{4}-\d{3}$/)
    }
  })

  it('rend des montants entiers, jamais des flottants', async () => {
    // Une comptabilité qui dérive d'un centime par ligne est indéfendable, et
    // la dérive ne se voit qu'au bout de plusieurs mois.
    const { buildings, deposits } = await portefeuille()
    const montants = [
      ...buildings.flatMap((b: { units: { rentMinor: number; paidMinor: number }[] }) =>
        b.units.flatMap((u) => [u.rentMinor, u.paidMinor]),
      ),
      ...deposits.flatMap((d: { heldMinor: number; withheldMinor: number }) => [
        d.heldMinor,
        d.withheldMinor,
      ]),
    ]
    expect(montants.every((m) => Number.isInteger(m))).toBe(true)
  })
})
