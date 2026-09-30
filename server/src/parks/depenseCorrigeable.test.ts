import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * CE QUI SORT DU PARC, ET LES QUATRE FAÇONS DE LE FAIRE MENTIR.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══
 *
 * Le produit savait l'entrant au centime et le sortant par les seuls chantiers.
 * `Expense` ajoute la moitié manquante, et quatre de ses règles ne vivent PAS
 * dans la base — donc rien ne les tiendrait sans ces cas :
 *
 *   1. LA PORTÉE EST EXCLUSIVE. `buildingId` et `unitId` sont tous deux
 *      nullables et PostgreSQL saurait l'interdire par une `CHECK` ; Prisma ne
 *      sait pas la déclarer, et une `CHECK` écrite à la main disparaîtrait au
 *      prochain `migrate dev`. La garde est donc en zod, et son unique gardien
 *      est le cas de ce fichier.
 *
 *   2. LA DEVISE VIENT DU PARC. Le corps de la requête n'en parle pas, et s'il
 *      en parlait il serait ignoré — un même parc à deux unités de compte ne se
 *      verrait dans aucune ligne.
 *
 *   3. UN CHANTIER N'EST PAS RECOPIÉ. Le sortant est la somme de deux tables,
 *      et les deux moitiés sortent SÉPARÉES pour que le lecteur retrouve son
 *      compte. Le chantier compte par son montant APPROUVÉ, jamais par son
 *      devis, et à sa date d'ACHÈVEMENT.
 *
 *   4. LE PÉRIMÈTRE D'UN GESTIONNAIRE EXCLUT LE PARC ENTIER. Une dépense sans
 *      immeuble ni logement lui apprendrait par soustraction ce que coûtent les
 *      immeubles qu'on lui cache.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * Le RÉSULTAT — entrant moins sortant — n'existe pas encore : ce lot livre le
 * sortant, pas la soustraction. Rien ici ne mesure donc un bénéfice, et la
 * lecture ne rend que deux sommes brutes.
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

async function parcAvecUnLogement(email = 'proprio@example.com') {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email,
    password: MDP,
    fullName: 'Djoumessi Nelson',
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

  return { cookie, parkId, buildingId, unitId: a1.body.unit.id as string }
}

const BORNES = { from: '2026-01-01', to: '2026-12-31' }

function lire(parkId: string, cookie: string, bornes = BORNES) {
  return request(serveur)
    .get(`/api/parks/${parkId}/expenses`)
    .query(bornes)
    .set('Cookie', cookie)
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('une dépense saisie', () => {
  it('est SERVIE PAR LA LECTURE, et pas seulement écrite', async () => {
    const { cookie, parkId, buildingId } = await parcAvecUnLogement()

    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({
        category: 'tax',
        label: 'Taxe foncière 2026',
        amountMinor: 120000,
        incurredOn: '2026-03-15',
        buildingId,
      })
    expect(pose.status, JSON.stringify(pose.body)).toBe(201)

    const relue = await lire(parkId, cookie)
    expect(relue.status).toBe(200)
    expect(relue.body.expenses).toHaveLength(1)
    expect(relue.body.expenses[0]).toMatchObject({
      category: 'tax',
      label: 'Taxe foncière 2026',
      amountMinor: 120000,
      incurredOn: '2026-03-15',
      buildingId,
      unitId: null,
      /* `paidOn` SERVI À NULL et non absent : « engagée, pas encore payée » est
         un état que l'écran distingue d'un champ qu'on aurait oublié. */
      paidOn: null,
    })
    expect(relue.body.expensesMinor).toBe(120000)
  })

  it('PREND LA DEVISE DU PARC, que le corps n’a pas le droit de nommer', async () => {
    const { cookie, parkId } = await parcAvecUnLogement()

    await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      /* Un `currency` glissé dans le corps : le schéma l'ignore, et la ligne
         doit porter celle du parc — `XAF` pour un parc camerounais. */
      .send({
        category: 'insurance',
        label: 'Prime multirisque',
        amountMinor: 45000,
        incurredOn: '2026-02-01',
        currency: 'EUR',
      })

    const relue = await lire(parkId, cookie)
    expect(relue.body.expenses[0].currency).toBe('XAF')
  })

  it('REFUSE DE PORTER À LA FOIS SUR UN IMMEUBLE ET SUR UN LOGEMENT', async () => {
    const { cookie, parkId, buildingId, unitId } = await parcAvecUnLogement()

    const refus = await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({
        category: 'upkeep',
        label: 'Produits d’entretien',
        amountMinor: 5000,
        incurredOn: '2026-04-01',
        buildingId,
        unitId,
      })

    /* 400 et non 409 : le corps est mal formé, ce n'est pas un état du métier
       qui s'y oppose. */
    expect(refus.status).toBe(400)
    const relue = await lire(parkId, cookie)
    expect(relue.body.expenses).toHaveLength(0)
  })

  it('REFUSE UN IMMEUBLE QUI N’EST PAS DU PARC, par 404 et non par 403', async () => {
    const { cookie, parkId } = await parcAvecUnLogement()
    const ailleurs = await parcAvecUnLogement('autre@example.com')

    const refus = await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({
        category: 'syndic',
        label: 'Quote-part',
        amountMinor: 30000,
        incurredOn: '2026-05-01',
        buildingId: ailleurs.buildingId,
      })

    expect(refus.status).toBe(404)
  })

  it('NE SORT PAS DE L’INTERVALLE DEMANDÉ', async () => {
    const { cookie, parkId } = await parcAvecUnLogement()

    for (const incurredOn of ['2025-12-31', '2026-06-01', '2027-01-01']) {
      await request(serveur)
        .post(`/api/parks/${parkId}/expenses`)
        .set('Cookie', cookie)
        .send({ category: 'other', label: `Ligne ${incurredOn}`, amountMinor: 1000, incurredOn })
    }

    const relue = await lire(parkId, cookie)
    expect(relue.body.expenses).toHaveLength(1)
    expect(relue.body.expenses[0].incurredOn).toBe('2026-06-01')
    expect(relue.body.expensesMinor).toBe(1000)
  })
})

describe('le sortant a DEUX moitiés, et elles ne se confondent pas', () => {
  it('COMPTE LE CHANTIER PAR SON MONTANT APPROUVÉ, jamais par son devis', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLogement()

    const chantier = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', cookie)
      .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'normal' })
    const workId = chantier.body.work.id as string

    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/quote`)
      .set('Cookie', cookie)
      .send({ quotedAmountMinor: 80000 })

    /* DEVISÉ, PAS ENCORE APPROUVÉ : rien ne doit compter. Sommer des devis
       afficherait comme dépensé de l'argent que personne n'a engagé. */
    expect((await lire(parkId, cookie)).body.worksMinor).toBe(0)

    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/approve`)
      .set('Cookie', cookie)
      .send({})

    /* APPROUVÉ MAIS NON ACHEVÉ : c'est un engagement, pas encore une dépense.
       Il n'entre dans aucun intervalle, faute de date d'achèvement. */
    expect((await lire(parkId, cookie)).body.worksMinor).toBe(0)

    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/complete`)
      .set('Cookie', cookie)
      .send({ completedOn: '2026-07-10' })

    const apres = await lire(parkId, cookie)
    expect(apres.body.worksMinor).toBe(80000)
    /* LES DEUX MOITIÉS RESTENT SÉPARÉES : le chantier n'a pas été recopié en
       dépense, et `expensesMinor` ne l'a donc pas absorbé. */
    expect(apres.body.expensesMinor).toBe(0)
    expect(apres.body.expenses).toHaveLength(0)
  })
})

describe('une dépense corrigée', () => {
  it('CONSIGNE L’AVANT AVEC L’APRÈS', async () => {
    const { cookie, parkId } = await parcAvecUnLogement()
    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({ category: 'tax', label: 'Taxe', amountMinor: 120000, incurredOn: '2026-03-15' })
    const id = pose.body.expense.id as string

    const corrigee = await request(serveur)
      .patch(`/api/parks/${parkId}/expenses/${id}`)
      .set('Cookie', cookie)
      .send({ amountMinor: 132000 })
    expect(corrigee.status, JSON.stringify(corrigee.body)).toBe(200)
    expect((await lire(parkId, cookie)).body.expenses[0].amountMinor).toBe(132000)

    const trace = await prisma.auditEvent.findFirst({
      where: { action: 'expense.update', entityId: id },
      select: { payload: true },
    })
    const charge = trace!.payload as { amountMinor: number; avant: { amountMinor: number } }
    expect(charge.amountMinor).toBe(132000)
    expect(charge.avant.amountMinor).toBe(120000)
  })

  it('N’ÉCRIT RIEN QUAND RIEN NE CHANGE', async () => {
    const { cookie, parkId } = await parcAvecUnLogement()
    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({ category: 'tax', label: 'Taxe', amountMinor: 120000, incurredOn: '2026-03-15' })
    const id = pose.body.expense.id as string

    const rien = await request(serveur)
      .patch(`/api/parks/${parkId}/expenses/${id}`)
      .set('Cookie', cookie)
      .send({ amountMinor: 120000 })

    expect(rien.status).toBe(200)
    expect(
      await prisma.auditEvent.count({ where: { action: 'expense.update', entityId: id } }),
    ).toBe(0)
  })

  it('NE DÉPLACE PAS UNE DÉPENSE D’UNE FAMILLE À L’AUTRE', async () => {
    const { cookie, parkId } = await parcAvecUnLogement()
    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({ category: 'tax', label: 'Taxe', amountMinor: 120000, incurredOn: '2026-03-15' })
    const id = pose.body.expense.id as string

    /* `category` n'est pas au schéma de correction : la clé est ignorée, et la
       ligne garde sa famille. Requalifier n'est pas corriger — la ligne se
       retire, et l'on repose. */
    await request(serveur)
      .patch(`/api/parks/${parkId}/expenses/${id}`)
      .set('Cookie', cookie)
      .send({ category: 'insurance', label: 'Taxe foncière' })

    expect((await lire(parkId, cookie)).body.expenses[0].category).toBe('tax')
  })
})

describe('une dépense retirée', () => {
  it('PART AVEC SA TRACE, et la trace dit ce qui a disparu', async () => {
    const { cookie, parkId } = await parcAvecUnLogement()
    const pose = await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({ category: 'syndic', label: 'Quote-part T1', amountMinor: 30000, incurredOn: '2026-01-20' })
    const id = pose.body.expense.id as string

    const retrait = await request(serveur)
      .delete(`/api/parks/${parkId}/expenses/${id}`)
      .set('Cookie', cookie)
    expect(retrait.status).toBe(204)
    expect((await lire(parkId, cookie)).body.expenses).toHaveLength(0)

    const trace = await prisma.auditEvent.findFirst({
      where: { action: 'expense.delete', entityId: id },
      select: { payload: true },
    })
    expect(trace!.payload).toMatchObject({
      label: 'Quote-part T1',
      amountMinor: 30000,
      incurredOn: '2026-01-20',
    })
  })
})

describe('le périmètre d’un gestionnaire', () => {
  it('LUI CACHE LA DÉPENSE DU PARC ENTIER, et celle d’un immeuble non confié', async () => {
    const { cookie, parkId, buildingId } = await parcAvecUnLogement()

    const second = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Villa Bastos', district: 'Bastos' })
    const autreImmeuble = second.body.building.id as string

    /* Trois dépenses, une par portée. */
    await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({ category: 'other', label: 'Comptable du parc', amountMinor: 50000, incurredOn: '2026-02-02' })
    await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({ category: 'tax', label: 'Taxe confiée', amountMinor: 120000, incurredOn: '2026-03-03', buildingId })
    await request(serveur)
      .post(`/api/parks/${parkId}/expenses`)
      .set('Cookie', cookie)
      .send({
        category: 'tax',
        label: 'Taxe cachée',
        amountMinor: 999000,
        incurredOn: '2026-04-04',
        buildingId: autreImmeuble,
      })

    /* Un gestionnaire, puis le geste qui le borne au PREMIER immeuble. Deux
       routes et non une : l'invitation ne porte pas de périmètre, c'est
       `.../immeubles` qui confie — et c'est bien de ce chemin-là que dépend ce
       que le gestionnaire verra. */
    const invite = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager', email: 'gest@example.com' })
    const code = invite.body.code as string

    const gest = await request(serveur).post('/api/auth/signup').send({
      email: 'gest@example.com',
      password: MDP,
      fullName: 'Awa Diallo',
      confirmLegal: true,
    })
    const cookieGest = cookieDe(gest)
    const entree = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieGest)
      .send({ invitationCode: code })
    expect(entree.status, JSON.stringify(entree.body)).toBe(201)

    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    const confiee = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [buildingId] })
    expect(confiee.status, JSON.stringify(confiee.body)).toBe(200)

    const vue = await lire(parkId, cookieGest)
    expect(vue.status, JSON.stringify(vue.body)).toBe(200)
    const libelles = (vue.body.expenses as { label: string }[]).map((d) => d.label)
    expect(libelles).toEqual(['Taxe confiée'])
    /* LE TOTAL SUIT LE PÉRIMÈTRE, sinon la soustraction rendrait ce que la
       liste cache. */
    expect(vue.body.expensesMinor).toBe(120000)
  })
})
