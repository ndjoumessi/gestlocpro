import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE CODE ÉMIS POUR UN LOGEMENT SERT ENCORE À QUI EST DÉJÀ DANS LE PARC.
 *
 * ═══ L'IMPASSE, TELLE QU'ELLE A ÉTÉ CAPTURÉE EN PRODUCTION ═══
 *
 * Le locataire rejoint le parc par un code SANS logement — le chemin que l'aide
 * du champ d'invitation recommande elle-même : « sans logement, il rejoint le
 * parc sans bail, vous l'y rattacherez ensuite ». Sa fiche reste orpheline, son
 * espace dit « aucun logement rattaché à votre compte ».
 *
 * Le propriétaire fait alors ce que le produit lui montre : il émet un SECOND
 * code, celui-là portant le logement. Le locataire le saisit — et `/api/join`
 * répond 409 `already_member`. Le code reste en attente dans le registre des
 * accès, valable et inutilisable, à côté d'un locataire qui n'a toujours pas de
 * logement. Les deux moitiés du parcours existaient, et elles ne se
 * rejoignaient pas.
 *
 * ═══ CE QUE LA ROUTE FAIT MAINTENANT, ET CE QU'ELLE REFUSE ═══
 *
 * Déjà membre ne veut plus dire « rien à faire » : si le code porte un logement
 * et que le compte n'a pas encore de fiche, il RATTACHE et se consomme. Trois
 * refus tiennent, chacun pour une raison distincte :
 *
 *  · un membre qui n'est pas locataire du parc — lui attacher une fiche lui
 *    donnerait le périmètre d'un locataire par-dessus le sien ;
 *  · un code de GESTIONNAIRE — il n'y a pas de fiche à rattacher, et le
 *    consommer ne ferait que le détruire ;
 *  · un code sans logement, ou un compte déjà relié — il n'y a rien à faire,
 *    et brûler le code perdrait celui du voisin.
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

/**
 * Le montage EXACT du défaut : un locataire membre du parc, une fiche à son nom
 * sur A1 restée orpheline, et un second code portant ce logement.
 */
async function membreSansFicheEtUnCodePourSonLogement() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
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
  const log = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
  const unitId = log.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekono Landry', phoneE164: '+237677000001' })

  // Premier code : SANS logement. C'est lui qui laisse la fiche orpheline.
  const sansLogement = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant' })
  const locataire = await request(serveur).post('/api/auth/signup').send({
    email: 'romel@example.com',
    password: MDP,
    fullName: 'Bekono Landry',
    acceptTerms: true,
    invitationCode: sansLogement.body.code,
  })

  // Second code : celui que le propriétaire émet pour réparer.
  const pourLeLogement = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant', unitId })

  return {
    cookie,
    parkId,
    unitId,
    immeubleId: imm.body.building.id as string,
    cookieLocataire: cookieDe(locataire),
    code: pourLeLogement.body.code as string,
  }
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

describe('rejoindre quand on est déjà membre', () => {
  it('rattache la fiche au lieu de refuser', async () => {
    const { cookieLocataire, code, parkId } = await membreSansFicheEtUnCodePourSonLogement()

    const avant = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieLocataire)
    expect(
      (avant.body.buildings as { units: unknown[] }[]).flatMap((b) => b.units),
      'le locataire voyait déjà son logement : le montage du cas est faux',
    ).toHaveLength(0)

    const rep = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieLocataire)
      .send({ invitationCode: code })
    expect(rep.status, `le code du logement est refusé : ${JSON.stringify(rep.body)}`).toBe(200)
    expect(rep.body.linked, 'la réponse ne dit pas que le rattachement a eu lieu').toBe(true)

    const apres = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieLocataire)
    expect(
      (apres.body.buildings as { units: { label: string }[] }[]).flatMap((b) => b.units),
      'le locataire ne voit toujours pas son logement',
    ).toHaveLength(1)
  })

  it('consomme le code, qui ne resservira pas', async () => {
    const { cookie, cookieLocataire, code, parkId } =
      await membreSansFicheEtUnCodePourSonLogement()

    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieLocataire)
      .send({ invitationCode: code })

    const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
    expect(
      acces.body.invitations,
      'le code reste en attente dans le registre après avoir servi',
    ).toHaveLength(0)
  })

  it('refuse encore quand le code n’a rien à rattacher', async () => {
    const { cookie, cookieLocataire, parkId } = await membreSansFicheEtUnCodePourSonLogement()

    // Un troisième code, SANS logement : il n'y a rien à faire, et le brûler
    // priverait de son code celui à qui on l'avait transmis.
    const nu = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant' })

    const rep = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieLocataire)
      .send({ invitationCode: nu.body.code })
    expect(rep.status).toBe(409)
    expect(rep.body.error).toBe('already_member')
  })

  /**
   * LE REFUS DIT CE QUI BLOQUE, ET IL NE DISAIT PAS LA VÉRITÉ.
   *
   * ═══ CAPTURÉ SUR LA PRODUCTION, TROISIÈME PREUVE DU MÊME DÉFAUT ═══
   *
   * Le locataire saisit le code émis POUR SON LOGEMENT et lit « Ce code ne
   * rattache aucun logement à votre compte. Demandez à votre propriétaire un
   * code émis pour votre logement. » Il en tenait un. La phrase l'envoyait
   * réclamer ce qu'il avait déjà.
   *
   * La vraie cause est ailleurs : `rattacherLaFicheLocataire` cherche un bail
   * dont la fiche n'a PAS de compte — `tenant: { userId: null }`. La fiche de
   * A1 étant tenue par un autre compte, il ne trouve rien et rend `null`, que
   * la route traduisait en `already_member`. Un seul code pour trois causes
   * distinctes, dont celle-ci, qui a un remède précis : délier la fiche.
   *
   * ON NE NOMME PAS L'AUTRE COMPTE. Le locataire apprend que SON logement est
   * pris, ce qui le concerne au premier chef ; par qui ne le regarde pas, et le
   * registre des accès — réservé aux deux rôles de gestion — est le seul endroit
   * qui le dise.
   */
  it('dit que le logement est pris quand sa fiche appartient à un autre compte', async () => {
    const { cookie, parkId, cookieLocataire, code } = await membreSansFicheEtUnCodePourSonLogement()

    // Un TROISIÈME compte entre dans le parc et reçoit la fiche de A1 — le
    // geste fautif relevé sur la production.
    const autre = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant' })
    const charles = await request(serveur).post('/api/auth/signup').send({
      email: 'charles@example.com',
      password: MDP,
      fullName: 'Eloundou Charles',
      acceptTerms: true,
      invitationCode: autre.body.code,
    })
    const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
    const fiche = acces.body.unlinkedTenants.find(
      (f: { unitLabel: string }) => f.unitLabel === 'A1',
    )
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${fiche.id}/compte`)
      .set('Cookie', cookie)
      .send({ userId: charles.body.user.id })

    const rep = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookieLocataire)
      .send({ invitationCode: code })
    expect(rep.status).toBe(409)
    expect(
      rep.body.error,
      'le refus dit « déjà membre » alors que le blocage est la fiche déjà prise',
    ).toBe('unit_record_taken')
  })

  it('ne donne pas de fiche au propriétaire de son propre parc', async () => {
    const { cookie, parkId, immeubleId } = await membreSansFicheEtUnCodePourSonLogement()

    /* UN SECOND LOGEMENT, et ce n'est pas un détour : la base ne tolère qu'un
       seul code vivant par logement — `bail_unique_par_unite` —, et en émettre
       un deuxième sur A1 rendrait 409 avant même d'atteindre le sujet du cas. */
    const autre = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeubleId}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A2', type: 'T2', surfaceSqm: 90, baseRentMinor: 30000 })

    const pourLeProprio = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant', unitId: autre.body.unit.id })

    const rep = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookie)
      .send({ invitationCode: pourLeProprio.body.code })
    expect(rep.status, 'le propriétaire s’est vu attacher une fiche de locataire').toBe(409)
  })
})
