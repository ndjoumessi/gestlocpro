import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * L'EXPORT DE SES DONNÉES — la portabilité, tenue par le serveur.
 *
 * La politique de confidentialité renvoie aujourd'hui vers une adresse postale
 * pour exercer ses droits : le produit ne rend rien. Cette route rend le
 * dossier complet de qui la demande, et c'est le serveur qui décide de son
 * étendue — jamais l'écran.
 *
 * TROIS RÈGLES, et la troisième est celle qui compte le plus :
 *
 *  1. CHAQUE NATURE DE DONNÉE EST LÀ. Un export qui oublie une table est pire
 *     qu'absent : il fait croire à la personne qu'elle tient tout.
 *  2. AUCUN SECRET N'EN SORT. Ni empreinte de mot de passe, ni jeton de
 *     session : ce sont des données SUR la personne que personne, elle
 *     comprise, n'a de raison de tenir en clair.
 *  3. LE PÉRIMÈTRE EST CELUI DE LA LECTURE ORDINAIRE. Un locataire exporte sa
 *     fiche et son bail, pas ceux de ses voisins ; un gestionnaire, les
 *     immeubles qu'on lui a confiés. L'export est une lecture de plus : il se
 *     borne comme les autres, dans la requête.
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

/** Le parc de démonstration : dix logements, des baux, des versements, des relances. */
async function parcDeDemonstration() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Djoumessi Nelson',
    acceptTerms: true,
    parkName: 'Parc Bonamoussadi',
    countryCode: 'CM',
    seedDemo: true,
  })
  const cookie = cookieDe(proprio)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  return { cookie, parkId: moi.body.memberships[0].parkId as string }
}

const exporter = (parkId: string, cookie?: string) => {
  const appel = request(serveur).get(`/api/parks/${parkId}/export`)
  return cookie ? appel.set('Cookie', cookie) : appel
}

/** Les natures que le dossier doit porter, nommées ici et non dérivées du code. */
const NATURES = [
  'parc',
  'immeubles',
  'logements',
  'locataires',
  'baux',
  'loyersAppeles',
  'versements',
  'cautions',
  'releves',
  'tarifs',
  'etatsDesLieux',
  'travaux',
  'avis',
  'adhesions',
  'invitations',
  'journal',
] as const

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

describe('l’export des données d’un propriétaire', () => {
  it('rend le compte et chaque nature de donnée du parc', async () => {
    const { cookie, parkId } = await parcDeDemonstration()

    const res = await exporter(parkId, cookie)
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    expect(res.body.compte.email).toBe('proprio@example.com')
    expect(res.body.compte.fullName).toBe('Djoumessi Nelson')
    /* La date de l'export est DANS le dossier : un fichier sans date ne dit pas
       de quand il parle, et deux exports se confondent. */
    expect(typeof res.body.exporteLe).toBe('string')

    for (const nature of NATURES) {
      expect(Array.isArray(res.body[nature]) || typeof res.body[nature] === 'object').toBe(true)
    }
    /* Non vides, celles que la démonstration sème : sans ce contrôle, un
       dossier de seize listes vides passerait pour complet. */
    for (const nature of ['immeubles', 'logements', 'locataires', 'baux', 'loyersAppeles', 'versements', 'cautions', 'releves', 'tarifs', 'etatsDesLieux', 'travaux', 'avis'] as const) {
      expect(res.body[nature].length, `${nature} est vide`).toBeGreaterThan(0)
    }
  })

  it('n’en laisse sortir aucun secret', async () => {
    const { cookie, parkId } = await parcDeDemonstration()
    const res = await exporter(parkId, cookie)

    /* NON VACANT : sur une réponse d'erreur, toutes les négations ci-dessous
       seraient vraies et ce cas passerait sans rien avoir mesuré. */
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const dossier = JSON.stringify(res.body)
    expect(dossier.length, 'dossier trop court pour contenir un parc').toBeGreaterThan(2000)
    for (const secret of ['passwordHash', 'tokenHash', 'password', '$argon', '$2b$']) {
      expect(dossier, `le dossier porte « ${secret} »`).not.toContain(secret)
    }
  })

  it('refuse à qui n’a pas de session', async () => {
    const { parkId } = await parcDeDemonstration()
    const res = await exporter(parkId)
    expect(res.status).toBe(401)
  })
})

describe('l’export borné au périmètre du demandeur', () => {
  it('ne rend au locataire que sa fiche, son bail et son logement', async () => {
    const { cookie, parkId } = await parcDeDemonstration()

    /* Un locataire relié à un compte, par le geste du produit : la fiche existe
       déjà dans la démonstration, on lui ouvre un accès. */
    const bail = await prisma.lease.findFirstOrThrow({
      where: { unit: { building: { parkId } }, status: 'active' },
      orderBy: { unit: { label: 'asc' } },
      select: { unitId: true, tenant: { select: { id: true, fullName: true } } },
    })
    const fiche = bail.tenant!
    const invitation = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant', unitId: bail.unitId })
    expect(invitation.status, JSON.stringify(invitation.body)).toBe(201)
    const locataire = await request(serveur).post('/api/auth/signup').send({
      email: 'locataire@example.com',
      password: MDP,
      fullName: fiche.fullName,
      acceptTerms: true,
      invitationCode: invitation.body.code,
    })

    const res = await exporter(parkId, cookieDe(locataire))
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    expect(res.body.compte.email).toBe('locataire@example.com')
    expect(res.body.locataires.length).toBe(1)
    expect(res.body.locataires[0].fullName).toBe(fiche.fullName)
    expect(res.body.logements.length).toBe(1)
    /* Les voisins n'y sont pas — et c'est la règle qui vaut le cas. */
    const dossier = JSON.stringify(res.body)
    const voisins = await prisma.tenant.findMany({
      where: { parkId, id: { not: fiche.id } },
      select: { fullName: true },
    })
    expect(voisins.length).toBeGreaterThan(0)
    for (const voisin of voisins) {
      expect(dossier, `le dossier du locataire nomme ${voisin.fullName}`).not.toContain(voisin.fullName)
    }
  })

  /**
   * LE REGISTRE DES DÉCISIONS EST AU PROPRIÉTAIRE, ET L'EXPORT NE LE CONTOURNE PAS.
   *
   * `GET /decisions` porte `exigerRole('owner')`, et son écran le redit : « le
   * gestionnaire n'y trouverait que ses propres actes rassemblés pour son
   * employeur ». Un export qui le lui rendrait ouvrirait par une porte dérobée
   * ce que la porte principale refuse — c'est le défaut que ce cas refuse, et
   * il a été introduit par la première rédaction de cette route.
   */
  it('ne rend pas le registre des décisions au gestionnaire', async () => {
    const { cookie, parkId } = await parcDeDemonstration()
    const immeuble = await prisma.building.findFirstOrThrow({
      where: { parkId },
      orderBy: { name: 'asc' },
      select: { id: true },
    })
    /* Une décision ÉCRITE par le geste du produit : sans elle, « le registre est
       vide » et « le registre est refusé » se ressembleraient. */
    await request(serveur)
      .patch(`/api/parks/${parkId}/buildings/${immeuble.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence renommée' })
      .expect(200)

    const inv = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager' })
    const gestionnaire = await request(serveur).post('/api/auth/signup').send({
      email: 'cabinet2@example.com',
      password: MDP,
      fullName: 'Cabinet Njoya',
      acceptTerms: true,
      invitationCode: inv.body.code,
    })

    const duProprio = await exporter(parkId, cookie)
    expect(duProprio.body.journal.length, 'aucune décision écrite — le cas ne prouve rien').toBeGreaterThan(0)

    const duGestionnaire = await exporter(parkId, cookieDe(gestionnaire))
    expect(duGestionnaire.status).toBe(200)
    expect(duGestionnaire.body.journal).toEqual([])
  })

  it('ne rend au gestionnaire que les immeubles qu’on lui a confiés', async () => {
    const { cookie, parkId } = await parcDeDemonstration()
    const immeubles = await prisma.building.findMany({
      where: { parkId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    expect(immeubles.length).toBeGreaterThan(1)

    const inv = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager' })
    const gestionnaire = await request(serveur).post('/api/auth/signup').send({
      email: 'cabinet@example.com',
      password: MDP,
      fullName: 'Cabinet Njoya',
      acceptTerms: true,
      invitationCode: inv.body.code,
    })
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, role: 'manager' },
      select: { id: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/immeubles`)
      .set('Cookie', cookie)
      .send({ buildingIds: [immeubles[0]!.id] })

    const res = await exporter(parkId, cookieDe(gestionnaire))
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    expect(res.body.immeubles.map((i: { name: string }) => i.name)).toEqual([immeubles[0]!.name])
    expect(JSON.stringify(res.body)).not.toContain(immeubles[1]!.name)
  })
})
