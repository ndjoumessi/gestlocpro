import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'

/**
 * LE CODE D'INVITATION ATTEINT LA FICHE QU'IL DÉSIGNE.
 *
 * ═══ CE QUI ÉTAIT CASSÉ, SIGNALÉ SUR LA PRODUCTION ═══
 *
 * « Lorsque le locataire fait son login, on ne voit aucune info, pourtant il
 * s'est déjà inscrit. » C'est exact, et la cause tient en une phrase : les DEUX
 * chemins qui consomment un code — l'inscription et `/api/join` — créaient
 * l'ADHÉSION et rien d'autre. `Invitation.unitId` était écrit à l'émission et
 * n'était RELU nulle part.
 *
 * Or tout ce qu'un locataire voit passe par `tenant: { userId }` — voir
 * `auth/guards.ts` et les lectures de `parks/routes.ts`. Sa fiche gardant
 * `userId: null`, chacune de ces requêtes ne trouvait rien. Le compte existait,
 * l'adhésion existait, le bail existait : ils n'étaient reliés par personne.
 *
 * Le schéma le disait pourtant, sur `Tenant.userId` : « renseigné quand
 * l'invitation a été utilisée ». Personne ne le renseignait.
 *
 * ═══ POURQUOI LE PARCOURS ENTIER, ET NON LA SEULE ÉCRITURE ═══
 *
 * Une garde qui poserait `userId` à la main puis vérifierait la lecture
 * n'attraperait pas ce défaut-ci : c'est le CHAÎNON qui manquait, pas les deux
 * bouts. On part donc du propriétaire qui crée son parc et on va jusqu'à ce que
 * le locataire voit son loyer, comme sur la capture.
 */
const app = createApp()
const serveur = app.listen(0)

const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`inscription sans cookie — ${res.status} ${String(res.text).slice(0, 160)}`)
  return trouve
}

/** Le parc du signalement : un immeuble, un logement, un locataire en place. */
async function parcAvecUnLocataireEnPlace() {
  const proprio = await request(serveur)
    .post('/api/auth/signup')
    .send({
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

  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Residence Djoumessi', district: 'Bastos' })
  const buildingId = immeuble.body.building.id as string

  const logement = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
    .set('Cookie', cookie)
    .send({ label: 'B1', type: 'T3', surfaceSqm: 120, baseRentMinor: 70000 })
  const unitId = logement.body.unit.id as string

  const fiche = await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Djoumessi Martial', phoneE164: '+237677111111' })
  expect(fiche.status, `la fiche n’a pas été créée : ${String(fiche.text).slice(0, 160)}`).toBe(201)

  return { cookie, parkId, unitId }
}

/** Émet le code pour CE logement — celui où le locataire vit déjà. */
async function emettreLeCode(cookie: string, parkId: string, unitId: string) {
  const res = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant', unitId })
  expect(res.status, `le code n’a pas été émis : ${String(res.text).slice(0, 160)}`).toBe(201)
  return res.body.code as string
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

describe('le locataire qui s’inscrit avec son code', () => {
  it('voit son logement, et non un espace vide', async () => {
    const { cookie, parkId, unitId } = await parcAvecUnLocataireEnPlace()
    const code = await emettreLeCode(cookie, parkId, unitId)

    const locataire = await request(serveur).post('/api/auth/signup').send({
      email: 'romel.djoumessi@example.com',
      password: MDP,
      fullName: 'Djoumessi Martial',
      acceptTerms: true,
      invitationCode: code,
    })
    const sien = cookieDe(locataire)

    const vue = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', sien)
    expect(vue.status).toBe(200)
    /* `unitesVisibles` borne le locataire à SES logements, dans la requête. La
       liste vide n'est donc pas un affichage manquant : c'est le cloisonnement
       qui fonctionne sur une fiche que rien ne relie à ce compte. */
    const logements = (vue.body.buildings as { units: { id: string }[] }[]).flatMap((b) => b.units)
    expect(
      logements,
      'le locataire est membre du parc et n’y voit rien : sa fiche n’a jamais été rattachée à son compte',
    ).toHaveLength(1)
    expect(logements[0]!.id).toBe(unitId)
  })

  it('et sa FICHE porte désormais son compte', async () => {
    /* La moitié qu'on ne voit pas à l'écran, et qui commande tout le reste :
       chaque lecture d'un locataire filtre sur `tenant: { userId }`. */
    const { cookie, parkId, unitId } = await parcAvecUnLocataireEnPlace()
    const code = await emettreLeCode(cookie, parkId, unitId)

    const locataire = await request(serveur).post('/api/auth/signup').send({
      email: 'romel.djoumessi@example.com',
      password: MDP,
      fullName: 'Djoumessi Martial',
      acceptTerms: true,
      invitationCode: code,
    })

    const fiche = await prisma.tenant.findFirstOrThrow({ where: { parkId } })
    expect(fiche.userId, 'la fiche reste orpheline').toBe(locataire.body.user.id)
  })
})

describe('le locataire qui a DÉJÀ un compte et rejoint par code', () => {
  it('est rattaché lui aussi — les deux chemins consomment le même code', async () => {
    /* `/api/join` portait le même défaut, mot pour mot. Le garder à part est le
       point : corriger un seul des deux chemins laisserait la moitié des
       locataires devant un espace vide, et le symptôme serait identique. */
    const { cookie, parkId, unitId } = await parcAvecUnLocataireEnPlace()
    const code = await emettreLeCode(cookie, parkId, unitId)

    const compte = await request(serveur).post('/api/auth/signup').send({
      email: 'deja-inscrit@example.com',
      password: MDP,
      fullName: 'Djoumessi Martial',
      acceptTerms: true,
    })
    const sien = cookieDe(compte)

    const rejoint = await request(serveur)
      .post('/api/join')
      .set('Cookie', sien)
      .send({ invitationCode: code })
    expect(rejoint.status).toBe(201)

    const fiche = await prisma.tenant.findFirstOrThrow({ where: { parkId } })
    expect(fiche.userId, 'la fiche reste orpheline après /api/join').toBe(compte.body.user.id)
  })
})
