import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE COURRIEL D'UNE FICHE, LU DEPUIS TOUJOURS ET JAMAIS ÉCRIT.
 *
 * ═══ UN CHEMIN COMPLET, ET SA PREMIÈRE MOITIÉ MANQUAIT ═══
 *
 * La réponse à un signalement part au locataire par cette ligne :
 *
 *     [travail.reportedByTenant.user?.email ?? travail.reportedByTenant.email]
 *
 * Le repli est écrit, typé, en place : quand la fiche n'a PAS de compte, on
 * écrit à l'adresse de la FICHE. Mais aucun écran ne collectait jamais cette
 * adresse — ni la création, ni la correction posée cette nuit. `Tenant.email`
 * était donc toujours nul, et la seconde branche n'a jamais servi.
 *
 * C'est ce que la bannière du produit annonce sans le savoir : « 1 locataire
 * n'a pas de compte : il ne voit ni bail, ni quittance, ni relevé, ET NE REÇOIT
 * AUCUNE ANNONCE ».
 *
 * ═══ FACULTATIF, ET IL DOIT L'ÊTRE ═══
 *
 * L'exiger fermerait la saisie d'un locataire déjà en place dont on n'a que le
 * téléphone — le cas de tout parc qu'on reprend en main, celui pour lequel
 * `startsOn` a déjà été rendu facultatif.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * La saisie, la correction, l'effacement, le refus d'une adresse qui n'en est
 * pas une — et surtout le PAYOFF : qu'une réponse atteigne une fiche sans
 * compte. Sans ce dernier, on aurait ajouté une colonne de plus.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`sans cookie — ${res.status} ${String(res.text).slice(0, 200)}`)
  return trouve
}

async function parcAvecUnLogement() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio-courriel@example.com',
    password: MDP,
    fullName: 'Djoumessi Nelson',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const imm = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Residence Djoumessi', district: 'Bastos' })
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })

  return { cookie, parkId, unitId: a1.body.unit.id as string }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
  await new Promise((resoudre) => serveur.close(resoudre))
})

describe('le courriel d’une fiche locataire', () => {
  it('se saisit à la création', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLogement()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', email: 'landry@example.com' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const fiche = await prisma.tenant.findFirstOrThrow({ where: { parkId } })
    expect(fiche.email).toBe('landry@example.com')
  })

  it('reste FACULTATIF, comme la date de début', async () => {
    /* L'exiger fermerait la saisie d'un locataire déjà en place dont on n'a que
       le téléphone — le cas de tout parc qu'on reprend en main. */
    const { cookie, parkId, unitId } = await parcAvecUnLogement()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((await prisma.tenant.findFirstOrThrow({ where: { parkId } })).email).toBeNull()
  })

  it('se corrige, et s’efface par la chaîne vide', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLogement()
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', email: 'faute@example.com' })
    const fiche = await prisma.tenant.findFirstOrThrow({ where: { parkId } })

    await request(serveur)
      .patch(`/api/parks/${parkId}/tenants/${fiche.id}`)
      .set('Cookie', cookie)
      .send({ email: 'landry@example.com' })
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: fiche.id } })).email).toBe(
      'landry@example.com',
    )

    await request(serveur)
      .patch(`/api/parks/${parkId}/tenants/${fiche.id}`)
      .set('Cookie', cookie)
      .send({ email: '' })
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: fiche.id } })).email).toBeNull()
  })

  it('refuse ce qui n’est pas une adresse', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLogement()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', email: 'pas-une-adresse' })

    /* 400 : la convention du dépôt pour tout refus de FORME, et le champ est
       nommé pour que l'écran rattache l'erreur au bon endroit. */
    expect(res.status).toBe(400)
    expect(res.body.fields?.[0]?.path).toBe('email')
    expect(await prisma.tenant.count({ where: { parkId } })).toBe(0)
  })

  it('REND ce courriel au chemin qui le lisait déjà', async () => {
    /**
     * LE PAYOFF, et sans lui on n'aurait ajouté qu'une colonne.
     *
     * La réponse à un signalement vise
     * `reportedByTenant.user?.email ?? reportedByTenant.email`. Ce cas ne poste
     * pas de réponse — il vérifie que la SECONDE branche a désormais de quoi
     * répondre : une fiche sans compte qui porte son adresse.
     */
    const { cookie, parkId, unitId } = await parcAvecUnLogement()
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Bekono Landry', email: 'landry@example.com' })

    const fiche = await prisma.tenant.findFirstOrThrow({
      where: { parkId },
      select: { userId: true, email: true },
    })
    expect(fiche.userId, 'la fiche ne doit PAS avoir de compte pour que ce cas ait un sens').toBeNull()
    /* `userId` NUL prouve l'absence de compte ; l'adresse de la fiche est donc la
       seule que le repli puisse prendre. On ne relit pas `user` : il n'y en a
       pas, et le demander ferait croire qu'on l'a vérifié. */
    expect(fiche.email).toBe('landry@example.com')
  })
})
