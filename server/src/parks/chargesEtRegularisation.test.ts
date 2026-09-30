import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LES LIGNES DE CHARGES, ET LE DÉCOMPTE QUI LES ARRÊTE.
 *
 * ═══ CE QUE CE LOT CORRIGE ═══
 *
 * Le produit savait refacturer l'eau et le courant, toutes deux CALCULÉES à
 * partir d'un index et d'un tarif. Tout le reste de ce qu'un bailleur
 * refacture — ordures, gardiennage, ascenseur, entretien des communs — se TAPE,
 * et n'avait aucune place où vivre. Ces sommes finissaient dans le loyer, et la
 * quittance appelait « loyer » ce qui n'en était pas.
 *
 * ═══ LES QUATRE RÈGLES QUE CES CAS TIENNENT ═══
 *
 *   1. LA LIGNE SE FIGE À L'ÉMISSION. Corriger la définition en décembre ne
 *      réécrit pas la quittance de mars.
 *   2. ET SEULEMENT SUR CE QUI VIENT DE NAÎTRE. Rappeler un mois déjà appelé ne
 *      doit poser aucune ligne sur ses échéances : sans quoi le gel serait un
 *      gel pour rien.
 *   3. LE SERVEUR CALCULE LES PROVISIONS. Il ne les accepte pas du client, et
 *      les FORFAITS n'y entrent pas.
 *   4. LE SOLDE N'EST PAS STOCKÉ. Il se déduit des deux sommes arrêtées.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`inscription sans cookie — ${res.status}`)
  return trouve
}

async function parcAvecUnBail() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Arsène Nkolo',
    confirmLegal: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const imm = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Residance Djoumessi', district: 'Bastos' })
  const buildingId = imm.body.building.id as string
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Serge Mbarga', depositMinor: 200000, startsOn: '2026-01-01' })

  const bail = await prisma.lease.findFirstOrThrow({ where: { unitId }, select: { id: true } })
  return { cookie, parkId, buildingId, unitId, leaseId: bail.id }
}

function poserLaLigne(
  parkId: string,
  leaseId: string,
  cookie: string,
  corps: { label: string; amountMinor: number; kind: 'provision' | 'forfait' },
) {
  return request(serveur)
    .post(`/api/parks/${parkId}/leases/${leaseId}/charge-lines`)
    .set('Cookie', cookie)
    .send(corps)
}

function appeler(parkId: string, cookie: string, periodStart: string) {
  return request(serveur)
    .post(`/api/parks/${parkId}/charges`)
    .set('Cookie', cookie)
    .send({ periodStart })
}

/** Les lignes FIGÉES sur l'échéance d'un mois, telles que la base les porte. */
async function lignesFigees(leaseId: string, mois: string) {
  return prisma.rentChargeLine.findMany({
    where: { charge: { leaseId, periodStart: new Date(`${mois}T00:00:00.000Z`) } },
    orderBy: { label: 'asc' },
    select: { label: true, amountMinor: true, kind: true },
  })
}

beforeEach(async () => {
  await prisma.userAccount.deleteMany()
  await prisma.park.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('les lignes de charges', () => {
  it('SE FIGENT SUR L’ÉCHÉANCE À L’ÉMISSION, et la définition suivante ne les touche plus', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Ordures ménagères',
      amountMinor: 5000,
      kind: 'provision',
    })

    await appeler(parkId, cookie, '2026-02-01')
    expect(await lignesFigees(leaseId, '2026-02-01')).toEqual([
      { label: 'Ordures ménagères', amountMinor: 5000, kind: 'provision' },
    ])

    /* LA DÉFINITION CHANGE — on retire la ligne et on en pose une plus chère. */
    const lignes = await request(serveur)
      .get(`/api/parks/${parkId}/leases/${leaseId}/charge-lines`)
      .set('Cookie', cookie)
    await request(serveur)
      .delete(`/api/parks/${parkId}/charge-lines/${lignes.body.lines[0].id}`)
      .set('Cookie', cookie)
    await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Ordures ménagères',
      amountMinor: 9000,
      kind: 'provision',
    })

    /* FÉVRIER N'A PAS BOUGÉ. C'est la quittante déjà remise au locataire. */
    expect(await lignesFigees(leaseId, '2026-02-01')).toEqual([
      { label: 'Ordures ménagères', amountMinor: 5000, kind: 'provision' },
    ])
    /* ET MARS PORTE LA NOUVELLE. */
    await appeler(parkId, cookie, '2026-03-01')
    expect(await lignesFigees(leaseId, '2026-03-01')).toEqual([
      { label: 'Ordures ménagères', amountMinor: 9000, kind: 'provision' },
    ])
  })

  it('NE SE POSENT PAS SUR UN MOIS DÉJÀ APPELÉ quand on rappelle ce mois', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()

    /* Février est appelé SANS aucune ligne convenue. */
    await appeler(parkId, cookie, '2026-02-01')
    expect(await lignesFigees(leaseId, '2026-02-01')).toEqual([])

    /* On convient une ligne APRÈS coup, puis on rappelle février — ce qu'on
       fait en vrai après avoir ajouté un locataire en cours de mois. */
    await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Gardiennage',
      amountMinor: 7000,
      kind: 'forfait',
    })
    const rappel = await appeler(parkId, cookie, '2026-02-01')

    expect(rappel.body.issued).toBe(0)
    /* FÉVRIER RESTE NU. Sans le filtre sur les baux déjà appelés, la ligne
       serait apparue sur une quittance de février déjà remise. */
    expect(await lignesFigees(leaseId, '2026-02-01')).toEqual([])
  })

  it('REFUSENT DEUX FOIS LE MÊME LIBELLÉ sur un bail', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Ascenseur',
      amountMinor: 3000,
      kind: 'provision',
    })
    const second = await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Ascenseur',
      amountMinor: 4000,
      kind: 'provision',
    })
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('libelle_deja_pris')
  })

  it('SURVIVENT AU RETRAIT DE LEUR DÉFINITION : la quittance passée ne se réécrit pas', async () => {
    const { cookie, parkId, leaseId } = await parcAvecUnBail()
    await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Eau commune',
      amountMinor: 6000,
      kind: 'provision',
    })
    await appeler(parkId, cookie, '2026-02-01')

    const lignes = await request(serveur)
      .get(`/api/parks/${parkId}/leases/${leaseId}/charge-lines`)
      .set('Cookie', cookie)
    const retrait = await request(serveur)
      .delete(`/api/parks/${parkId}/charge-lines/${lignes.body.lines[0].id}`)
      .set('Cookie', cookie)

    expect(retrait.status).toBe(204)
    expect(await lignesFigees(leaseId, '2026-02-01')).toHaveLength(1)
  })
})

describe('le décompte de charges', () => {
  /** Deux mois appelés, avec une provision et un forfait convenus d'avance. */
  async function deuxMoisAppeles() {
    const contexte = await parcAvecUnBail()
    const { cookie, parkId, leaseId } = contexte
    await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Eau commune',
      amountMinor: 6000,
      kind: 'provision',
    })
    await poserLaLigne(parkId, leaseId, cookie, {
      label: 'Gardiennage',
      amountMinor: 7000,
      kind: 'forfait',
    })
    await appeler(parkId, cookie, '2026-02-01')
    await appeler(parkId, cookie, '2026-03-01')
    return contexte
  }

  it('NE COMPTE QUE LES PROVISIONS : le forfait est dû quoi qu’il arrive', async () => {
    const { cookie, parkId, leaseId } = await deuxMoisAppeles()

    const brouillon = await request(serveur)
      .get(`/api/parks/${parkId}/leases/${leaseId}/settlement-draft`)
      .query({ from: '2026-01-01', to: '2026-12-31' })
      .set('Cookie', cookie)

    /* 6 000 × 2 mois. Le gardiennage — 7 000 × 2 — n'y est PAS : le rendre au
       locataire reviendrait à réécrire le bail. */
    expect(brouillon.body.draft.provisionedMinor).toBe(12000)
  })

  it('SÉPARE LES DÉPENSES DU LOGEMENT DE CELLES DE L’IMMEUBLE, sans les additionner', async () => {
    const { cookie, parkId, buildingId, unitId, leaseId } = await deuxMoisAppeles()

    await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({
        unitId,
        category: 'utility',
        label: 'Fuite salle de bain',
        amountMinor: 4000,
        incurredOn: '2026-02-10',
      })
    await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({
        buildingId,
        category: 'utility',
        label: 'Facture d’eau de l’immeuble',
        amountMinor: 90000,
        incurredOn: '2026-02-28',
      })

    const brouillon = await request(serveur)
      .get(`/api/parks/${parkId}/leases/${leaseId}/settlement-draft`)
      .query({ from: '2026-01-01', to: '2026-12-31' })
      .set('Cookie', cookie)

    /* DEUX NOMBRES, JAMAIS UN. Les 90 000 de l'immeuble ne sont imputables à ce
       bail que par une clé de répartition que le produit n'a pas — et les
       additionner ici mettrait la facture d'eau du bâtiment entier sur le dos
       d'un seul locataire. */
    expect(brouillon.body.draft.unitExpensesMinor).toBe(4000)
    expect(brouillon.body.draft.buildingExpensesMinor).toBe(90000)
  })

  it('CALCULE LES PROVISIONS LUI-MÊME et ignore ce que le client lui dicte', async () => {
    const { cookie, parkId, leaseId } = await deuxMoisAppeles()

    const arrete = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlements`)
      .set('Cookie', cookie)
      .send({
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        settledOn: '2027-01-15',
        actualMinor: 20000,
        /* Le client tente d'imposer sa propre somme. */
        provisionedMinor: 999999,
      })

    expect(arrete.status).toBe(201)
    expect(arrete.body.settlement.provisionedMinor).toBe(12000)
    /* LE SOLDE SE DÉDUIT : 12 000 appelés contre 20 000 engagés, le locataire
       doit 8 000 de complément. */
    expect(arrete.body.settlement.balanceMinor).toBe(-8000)
  })

  it('REND UN SOLDE POSITIF quand le bailleur a engagé moins qu’il n’a appelé', async () => {
    const { cookie, parkId, leaseId } = await deuxMoisAppeles()

    const arrete = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlements`)
      .set('Cookie', cookie)
      .send({
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        settledOn: '2027-01-15',
        actualMinor: 5000,
      })

    expect(arrete.body.settlement.balanceMinor).toBe(7000)
  })

  it('N’ARRÊTE QU’UNE FOIS LE MÊME EXERCICE', async () => {
    const { cookie, parkId, leaseId } = await deuxMoisAppeles()
    const corps = {
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      settledOn: '2027-01-15',
      actualMinor: 5000,
    }
    await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlements`)
      .set('Cookie', cookie)
      .send(corps)
    const second = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlements`)
      .set('Cookie', cookie)
      .send(corps)

    expect(second.status).toBe(409)
    expect(second.body.error).toBe('exercice_deja_regularise')
  })

  it('REFUSE UN EXERCICE QUI FINIT AVANT DE COMMENCER', async () => {
    const { cookie, parkId, leaseId } = await deuxMoisAppeles()

    const arrete = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/settlements`)
      .set('Cookie', cookie)
      .send({
        periodStart: '2026-12-31',
        periodEnd: '2026-01-01',
        settledOn: '2027-01-15',
        actualMinor: 5000,
      })

    /* Un intervalle vide rendrait ZÉRO provision appelée, donc un solde égal à
       tout ce que le bailleur a engagé — à réclamer au locataire. */
    expect(arrete.status).toBe(400)
  })

  it('NE MONTRE RIEN D’UN BAIL D’UN AUTRE PARC', async () => {
    const { leaseId } = await parcAvecUnBail()

    const intrus = await request(serveur).post('/api/auth/signup').send({
      email: 'intrus@example.com',
      password: MDP,
      fullName: 'Paul Etoga',
      confirmLegal: true,
      parkName: 'Parc Akwa',
      countryCode: 'CM',
    })
    const cookieIntrus = cookieDe(intrus)
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookieIntrus)
    const sonParc = moi.body.memberships[0].parkId as string

    const lecture = await request(serveur)
      .get(`/api/parks/${sonParc}/leases/${leaseId}/charge-lines`)
      .set('Cookie', cookieIntrus)

    /* 404 ET NON 403 : confirmer l'existence du bail à qui a deviné son
       identifiant serait déjà une fuite. */
    expect(lecture.status).toBe(404)
  })
})
