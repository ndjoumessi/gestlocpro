import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'
import { DELAI_D_EFFACEMENT_JOURS } from './fermeture.js'
import { compteRenduDEffacement, effacerLesComptesFermes } from './effacementDesComptes.js'
import { remplacerStockage } from '../stockage/stockage.js'
import type { Stockage } from '../stockage/contrat.js'

/**
 * L'EFFACEMENT — ce que la fermeture a promis, et que rien ne tenait encore.
 *
 * ═══ CE QU'IL EFFACE, ET CE QU'IL LAISSE ═══
 *
 * Le compte, et les parcs dont il est le SEUL propriétaire — avec leurs
 * immeubles, leurs baux, leurs fiches, leurs quittances et les photos du
 * volume. Un parc qui a un autre propriétaire SURVIT : effacer le bien commun
 * parce qu'un copropriétaire s'en va serait effacer les données de quelqu'un
 * d'autre à sa place.
 *
 * ═══ CE QUE LES CAS TIENNENT, ET QUE LA RELECTURE NE TIENT PAS ═══
 *
 *  1. L'ÉCHÉANCE. Un compte fermé hier ne s'efface pas aujourd'hui.
 *  2. LE PARC SUIT, cascade comprise — un parc de démonstration entier, pas une
 *     coquille : c'est le seul jeu où l'on voit tomber baux, versements et
 *     registres ensemble.
 *  3. LES PHOTOS DU VOLUME suivent aussi. La base les oublie par cascade ; les
 *     fichiers, eux, ne s'effacent pas tout seuls, et personne ne les
 *     retrouverait ensuite — ils ne seraient plus reliés à rien.
 *  4. LES VERROUS. Un compte qui a émis un code ou saisi un encaissement
 *     s'efface quand même : ces lignes perdent leur auteur et gardent leur
 *     contenu, ce qui est exactement ce qu'un effacement doit faire.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`aucun cookie de session — ${res.status}`)
  return trouve
}

async function inscrire(email: string, options: Record<string, unknown> = {}) {
  const res = await request(serveur)
    .post('/api/auth/signup')
    .send({ email, password: MDP, fullName: 'Djoumessi Nelson', acceptTerms: true, ...options })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return { cookie: cookieDe(res), id: res.body.user.id as string }
}

/** Ferme le compte, et antidate la demande pour la placer avant l'échéance. */
async function fermerIlYA(cookie: string, jours: number) {
  await request(serveur).post('/api/auth/me/closure').set('Cookie', cookie).expect(200)
  const quand = new Date(Date.now() - jours * 86_400_000)
  await prisma.userAccount.updateMany({
    where: { closureRequestedAt: { not: null } },
    data: { closureRequestedAt: quand },
  })
}

/** Un stockage de sonde : il retient ce qu'on lui demande d'effacer. */
function stockageDeSonde() {
  const effacees: string[] = []
  const faux = {
    async ecrire() {},
    async lire() {
      return null
    },
    async supprimer(cle: string) {
      effacees.push(cle)
    },
  } as unknown as Stockage
  return { effacees, restaurer: remplacerStockage(faux) }
}

let sonde: ReturnType<typeof stockageDeSonde>

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  sonde = stockageDeSonde()
})

afterEach(() => {
  sonde.restaurer()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
  await new Promise((resoudre) => serveur.close(resoudre))
})

describe('l’effacement des comptes fermés', () => {
  it('attend l’échéance, et pas un jour de moins', async () => {
    const { cookie } = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
    })
    await fermerIlYA(cookie, DELAI_D_EFFACEMENT_JOURS - 1)

    const bilan = await effacerLesComptesFermes()
    expect(bilan.comptes).toBe(0)
    expect(await prisma.userAccount.count()).toBe(1)
    expect(await prisma.park.count()).toBe(1)
  })

  it('efface le compte, son parc et tout ce qu’il portait', async () => {
    const { cookie } = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    /* Le jeu de démonstration porte des baux, des versements, des cautions et
       des relances : sans lui, « le parc est parti » ne dirait presque rien. */
    expect(await prisma.lease.count()).toBeGreaterThan(0)
    expect(await prisma.payment.count()).toBeGreaterThan(0)

    await fermerIlYA(cookie, DELAI_D_EFFACEMENT_JOURS + 1)
    const bilan = await effacerLesComptesFermes()

    expect(bilan.comptes).toBe(1)
    expect(bilan.parcs).toBe(1)
    expect(await prisma.userAccount.count()).toBe(0)
    expect(await prisma.park.count()).toBe(0)
    expect(await prisma.lease.count()).toBe(0)
    expect(await prisma.payment.count()).toBe(0)
    expect(await prisma.notification.count()).toBe(0)
    expect(await prisma.auditEvent.count()).toBe(0)
  })

  it('efface les photos du volume, que la base oublie sans les supprimer', async () => {
    const { cookie } = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    const constat = await prisma.inspectionFinding.findFirstOrThrow({
      select: { id: true },
    })
    await prisma.inspectionPhoto.create({
      data: {
        findingId: constat.id,
        storageKey: 'photos/sonde-a-effacer',
        contentType: 'image/webp',
        sizeBytes: 1024,
      },
    })

    await fermerIlYA(cookie, DELAI_D_EFFACEMENT_JOURS + 1)
    const bilan = await effacerLesComptesFermes()

    expect(bilan.photos).toBe(1)
    expect(sonde.effacees).toEqual(['photos/sonde-a-effacer'])
    expect(await prisma.inspectionPhoto.count()).toBe(0)
  })

  it('laisse debout un parc qui a un autre propriétaire', async () => {
    const { cookie } = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
    })
    const parc = await prisma.park.findFirstOrThrow({ select: { id: true } })
    const second = await inscrire('associe@example.com')
    await prisma.membership.create({
      data: { parkId: parc.id, userId: second.id, role: 'owner', status: 'active' },
    })

    await fermerIlYA(cookie, DELAI_D_EFFACEMENT_JOURS + 1)
    const bilan = await effacerLesComptesFermes()

    expect(bilan.comptes).toBe(1)
    expect(bilan.parcs).toBe(0)
    /* Le parc reste, et l'adhésion du partant s'en va avec son compte. */
    expect(await prisma.park.count()).toBe(1)
    expect(await prisma.membership.count({ where: { parkId: parc.id } })).toBe(1)
  })

  it('efface un compte qui avait émis un code et saisi un encaissement', async () => {
    const { cookie, id } = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    const parc = await prisma.park.findFirstOrThrow({ select: { id: true } })
    /* Un SECOND parc, qui survit : c'est lui qui garde les lignes dont ce compte
       était l'auteur, et c'est là que les deux verrous se seraient refermés. */
    /* LE PARC VOISIN N'A PAS DE JEU DE DÉMONSTRATION, et ce n'est pas un
       raccourci : deux démonstrations dans la même base font tomber la seconde
       (référence `SIG-2026-001` déjà prise, défaut rapporté le 2026-09-16).
       Le parc voisin est donc monté à la main, avec juste ce qu'il faut pour
       porter un encaissement. */
    const autre = await inscrire('voisine@example.com', {
      parkName: 'Parc voisin',
      countryCode: 'CM',
    })
    const parcVoisin = await prisma.park.findFirstOrThrow({
      where: { id: { not: parc.id } },
      select: { id: true },
    })
    const immeuble = await prisma.building.create({
      data: { parkId: parcVoisin.id, name: 'Résidence voisine', district: 'Bastos' },
    })
    const logement = await prisma.unit.create({
      data: { buildingId: immeuble.id, label: 'V1', type: 'T2', surfaceSqm: 50, baseRentMinor: 100000 },
    })
    const locataire = await prisma.tenant.create({
      data: { parkId: parcVoisin.id, fullName: 'Voisin Locataire' },
    })
    const bail = await prisma.lease.create({
      data: {
        unitId: logement.id,
        tenantId: locataire.id,
        startsOn: new Date('2026-01-01'),
        rentMinor: 100000,
        status: 'active',
      },
    })
    await prisma.membership.create({
      data: { parkId: parcVoisin.id, userId: id, role: 'manager', status: 'active' },
    })
    const echeance = await prisma.rentCharge.create({
      data: {
        leaseId: bail.id,
        periodStart: new Date('2026-09-01'),
        dueOn: new Date('2026-09-05'),
        rentMinor: 100000,
      },
    })
    const versement = await prisma.payment.create({
      data: {
        chargeId: echeance.id,
        amountMinor: 50000,
        currency: 'XAF',
        method: 'cash',
        paidOn: new Date(),
        recordedById: id,
      },
    })
    await prisma.invitation.create({
      data: {
        parkId: parcVoisin.id,
        role: 'tenant',
        codeHash: 'empreinte-de-sonde',
        codeHint: 'SOND',
        issuedById: id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    })

    await fermerIlYA(cookie, DELAI_D_EFFACEMENT_JOURS + 1)
    const bilan = await effacerLesComptesFermes()
    expect(bilan.comptes).toBe(1)

    /* LES LIGNES RESTENT, LEUR AUTEUR S'EN VA. Un versement effacé serait de
       l'argent disparu du registre d'un locataire qui n'a rien demandé. */
    const apres = await prisma.payment.findUniqueOrThrow({ where: { id: versement.id } })
    expect(apres.recordedById).toBeNull()
    expect(apres.amountMinor).toBe(50000)
    expect(
      (await prisma.invitation.findFirstOrThrow({ where: { parkId: parcVoisin.id } })).issuedById,
    ).toBeNull()
    expect(await prisma.park.count()).toBe(1)
    expect(autre.id).not.toBe(id)
  })
})

/**
 * LE COMPTE RENDU — muet sur ce qu'il n'a pas fait, chiffré sur ce qu'il a fait.
 *
 * Même règle que les deux lignes voisines du passage quotidien : « 0 compte
 * effacé » se lirait comme un parcours infructueux là où il n'y avait rien à
 * faire. La fonction est PURE, donc elle s'éprouve — voir l'en-tête de
 * `compteRenduDuPassage.test.ts`, qui a payé la leçon inverse.
 */
describe('le compte rendu de l’effacement', () => {
  it('dit qu’aucun compte n’était à échéance, plutôt qu’un zéro', () => {
    expect(compteRenduDEffacement({ comptes: 0, parcs: 0, photos: 0 })).toMatch(/aucun n’était à échéance/)
  })

  it('chiffre les trois natures quand il a effacé', () => {
    const ligne = compteRenduDEffacement({ comptes: 2, parcs: 1, photos: 7 })
    expect(ligne).toContain('2 compte(s)')
    expect(ligne).toContain('1 parc(s)')
    expect(ligne).toContain('7 photo(s)')
  })
})
