import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * RELIER UNE FICHE LOCATAIRE PAR UN CODE NE LAISSAIT AUCUNE TRACE.
 *
 * ═══ LA DERNIÈRE ASYMÉTRIE DE LA FAMILLE ═══
 *
 * Le registre des accès porte `access.link` — « Fiche locataire reliée à un
 * compte » — écrit par la route du registre, celle où un propriétaire répare un
 * rattachement à la main. Son commentaire dit pourquoi : « donner un accès est
 * une décision, au même titre que le reprendre ».
 *
 * Le même geste, accompli par un CODE, n'écrivait rien. Or c'est le chemin
 * NORMAL : `rattacherLaFicheLocataire` est appelée à QUATRE endroits — une fois
 * à l'inscription, trois fois dans `/api/join` — et aucun ne consignait. Le
 * propriétaire voyait donc au registre les accès qu'il avait réparés, et pas
 * ceux que le produit avait donnés tout seul.
 *
 * C'est la troisième asymétrie du même circuit corrigée aujourd'hui, après
 * `access.join` et la politique de transaction. Les quatre appels sont pris
 * ensemble : n'en tracer qu'un reproduirait ce que cette journée a passé son
 * temps à défaire.
 *
 * ═══ L'ACTEUR EST L'ÉMETTEUR DU CODE ═══
 *
 * Comme pour `access.join`. Écrire celui qui saisit ferait dire au registre que
 * le locataire s'est relié lui-même à une fiche qu'il n'a pas choisie.
 *
 * ═══ ET LA TRACE SUIT L'ACTE, JAMAIS L'INVERSE ═══
 *
 * L'écriture vit HORS de la transaction qui relie, conformément à la politique
 * que le commit précédent a mise sous garde : « le journal ne doit pas pouvoir
 * faire échouer l'écriture qu'il décrit ». Le prix est le même partout — une
 * panne entre les deux laisse une fiche reliée sans sa ligne.
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

/** Un parc, un logement, et une fiche de locataire SANS compte. */
async function unParcAvecUneFicheOrpheline() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Djoumessi Nelson',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookieProprio = cookieDe(proprio)
  const parkId = (await prisma.park.findFirstOrThrow()).id
  const emetteurId = (
    await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'owner' },
      select: { userId: true },
    })
  ).userId

  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookieProprio)
    .send({ name: 'Residence Djoumessi', district: 'Bastos' })
  const logement = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
    .set('Cookie', cookieProprio)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
  const unitId = logement.body.unit.id as string

  const fiche = await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookieProprio)
    .send({ unitId, fullName: 'Bekono Landry', phoneE164: '+237677000001' })
  expect(fiche.status, `fiche non créée : ${String(fiche.text).slice(0, 160)}`).toBe(201)

  return { cookieProprio, parkId, unitId, emetteurId }
}

const codeDe = async (
  cookie: string,
  parkId: string,
  corps: Record<string, unknown>,
): Promise<string> => {
  const res = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send(corps)
  expect(res.status, `code non émis : ${String(res.text).slice(0, 160)}`).toBe(201)
  return res.body.code as string
}

const rejoindre = (cookie: string, invitationCode: string) =>
  request(serveur).post('/api/join').set('Cookie', cookie).send({ invitationCode })

const liens = (parkId: string) =>
  prisma.auditEvent.findMany({ where: { parkId, action: 'access.link' } })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('relier une fiche par un code', () => {
  it('se CONSIGNE à l’inscription', async () => {
    const { cookieProprio, parkId, unitId, emetteurId } = await unParcAvecUneFicheOrpheline()
    const code = await codeDe(cookieProprio, parkId, { role: 'tenant', unitId })
    const compte = await request(serveur).post('/api/auth/signup').send({
      email: 'locataire@example.com',
      password: MDP,
      fullName: 'Bekono Landry',
      acceptTerms: true,
      invitationCode: code,
    })
    expect(compte.status, `inscription refusée : ${String(compte.text).slice(0, 160)}`).toBe(201)

    const [trace, ...reste] = await liens(parkId)
    expect(trace, 'le produit a donné un accès et le registre n’en savait rien').toBeDefined()
    expect(reste, 'un rattachement, une ligne').toHaveLength(0)
    expect(trace!.entity).toBe('Tenant')
    expect(trace!.actorId, 'l’acteur est l’ÉMETTEUR du code, pas qui le saisit').toBe(emetteurId)
    expect(
      (trace!.payload as { tenantName?: string }).tenantName,
      'le registre ne dit pas QUELLE fiche a été reliée — un `userId` seul est un UUID',
    ).toBe('Bekono Landry')
  })

  it('se CONSIGNE quand /api/join crée l’adhésion', async () => {
    const { cookieProprio, parkId, unitId } = await unParcAvecUneFicheOrpheline()
    // Un compte qui existait AVANT de recevoir son code.
    const cookie = cookieDe(
      await request(serveur).post('/api/auth/signup').send({
        email: 'locataire@example.com',
        password: MDP,
        fullName: 'Bekono Landry',
        acceptTerms: true,
      }),
    )
    const res = await rejoindre(cookie, await codeDe(cookieProprio, parkId, { role: 'tenant', unitId }))
    expect(res.status, `join refusé : ${String(res.text).slice(0, 160)}`).toBe(201)
    expect(await liens(parkId), 'le chemin le plus courant était le seul muet').toHaveLength(1)
  })

  it('se CONSIGNE quand /api/join répare un membre déjà là', async () => {
    /* Le montage exact du défaut que `leCodeRattacheUnMembre` décrit : un
       premier code SANS logement laisse la fiche orpheline, un second la
       répare. */
    const { cookieProprio, parkId, unitId } = await unParcAvecUneFicheOrpheline()
    const cookie = cookieDe(
      await request(serveur).post('/api/auth/signup').send({
        email: 'locataire@example.com',
        password: MDP,
        fullName: 'Bekono Landry',
        acceptTerms: true,
        invitationCode: await codeDe(cookieProprio, parkId, { role: 'tenant' }),
      }),
    )
    expect(await liens(parkId), 'un code sans logement ne relie rien').toHaveLength(0)

    const res = await rejoindre(cookie, await codeDe(cookieProprio, parkId, { role: 'tenant', unitId }))
    expect(res.status).toBe(200)
    expect(res.body.linked).toBe(true)
    expect(await liens(parkId)).toHaveLength(1)
  })

  it('se CONSIGNE quand un révoqué revient avec son logement', async () => {
    const { cookieProprio, parkId, unitId } = await unParcAvecUneFicheOrpheline()
    const cookie = cookieDe(
      await request(serveur).post('/api/auth/signup').send({
        email: 'locataire@example.com',
        password: MDP,
        fullName: 'Bekono Landry',
        acceptTerms: true,
        invitationCode: await codeDe(cookieProprio, parkId, { role: 'tenant', unitId }),
      }),
    )
    const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'tenant' } })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/revoke`)
      .set('Cookie', cookieProprio)
      .send({})
    const apresRetrait = (await liens(parkId)).length

    const res = await rejoindre(cookie, await codeDe(cookieProprio, parkId, { role: 'tenant', unitId }))
    expect(res.status, `retour refusé : ${String(res.text).slice(0, 160)}`).toBe(201)
    expect(
      (await liens(parkId)).length,
      'le retrait a libéré la fiche ; la rendre est un accès DONNÉ, comme le premier',
    ).toBe(apresRetrait + 1)
  })
})

describe('ce qui ne relie rien ne consigne rien', () => {
  it('un code de gestionnaire', async () => {
    const { cookieProprio, parkId } = await unParcAvecUneFicheOrpheline()
    const cookie = cookieDe(
      await request(serveur).post('/api/auth/signup').send({
        email: 'gestion@example.com',
        password: MDP,
        fullName: 'Gestion Aire',
        acceptTerms: true,
      }),
    )
    expect((await rejoindre(cookie, await codeDe(cookieProprio, parkId, { role: 'manager' }))).status).toBe(201)
    expect(await liens(parkId), 'aucune fiche n’a été reliée').toHaveLength(0)
  })
})
