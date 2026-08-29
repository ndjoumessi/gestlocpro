import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE REGISTRE DES DÉCISIONS — ce que le parc a écrit, et qui l'a écrit.
 *
 * ═══ CE QUI EXISTAIT, ET QUI NE SERVAIT À PERSONNE ═══
 *
 * `AuditEvent` est écrit à seize endroits du serveur depuis plusieurs lots, et
 * LU nulle part — sauf par les tests. Aucune route ne le rend, aucun écran ne
 * le montre. Le produit tient donc une piste d'audit qu'il n'ouvre jamais.
 *
 * ═══ ET IL MENTAIT PAR OMISSION ═══
 *
 * Sur les 33 mutations du serveur, 13 étaient journalisées. Les absences ne
 * sont pas réparties au hasard — elles forment des paires :
 *
 *   tracé                            NON tracé
 *   DELETE /payments/:id             POST /payments
 *   DELETE /tenants/:id              POST /tenants
 *   POST /photos/:id/confirmation    DELETE /photos/:id
 *   deposit.settle                   POST /tariffs
 *   receipt.issued                   PATCH /:parkId
 *
 * Le registre pouvait donc dire « ce versement a été retiré » sans pouvoir dire
 * QUI l'avait saisi. Il traçait l'ajout d'une preuve photo d'état des lieux et
 * pas sa SUPPRESSION — l'inverse exact de ce qu'il faut. Et il ignorait le
 * tarif de refacturation, qui produit les montants des quittances qu'il trace.
 *
 * Ce fichier tient les six écritures manquantes et la route qui les rend.
 *
 * ═══ LE PROPRIÉTAIRE SEUL ═══
 *
 * C'est lui qui délègue, et le registre existe pour qu'il puisse contrôler ce
 * qu'il a délégué. Un gestionnaire qui lirait le journal de ses propres actes
 * n'y trouverait rien qu'il ne sache ; un locataire n'a rien à y voir — les
 * décisions qui le concernent lui sont notifiées, elles ne se consultent pas
 * dans le registre d'un parc entier.
 */

const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

async function inscrire(email: string, options: Record<string, unknown> = {}) {
  const res = await request(serveur)
    .post('/api/auth/signup')
    .send({ email, password: MDP, fullName: 'Compte de test', acceptTerms: true, ...options })
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const cookie = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!cookie) throw new Error(`inscription sans cookie — ${res.status} (${email})`)
  return cookie
}

/** Un parc avec un immeuble, un logement et un locataire. */
async function parc(email: string) {
  const cookie = await inscrire(email, { parkName: 'Parc Bonamoussadi', countryCode: 'CM' })
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Résidence Makepe', district: 'Makepe' })
  const logement = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
  const unitId = logement.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01', rentMinor: 145000 })

  return { cookie, parkId, unitId }
}

/** Les actions écrites pour ce parc, dans l'ordre où elles l'ont été. */
async function actions(parkId: string): Promise<string[]> {
  const evenements = await prisma.auditEvent.findMany({
    where: { parkId },
    orderBy: { createdAt: 'asc' },
    select: { action: true },
  })
  return evenements.map((e) => e.action)
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

describe('les six écritures qui manquaient', () => {
  /**
   * LA PLUS GRAVE DES SIX.
   *
   * Le retrait d'un versement était tracé, sa saisie non. Le registre montrait
   * donc des suppressions sans leurs créations : « quelqu'un a retiré
   * 145 000 FCFA », sans qu'on puisse savoir qui les avait déclarés reçus.
   */
  it('trace la saisie d’un encaissement, et pas seulement son retrait', async () => {
    const { cookie, parkId, unitId } = await parc('encaissement@example.com')
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-08-01' })

    await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({
        unitId,
        periodStart: '2026-08-01',
        amountMinor: 145000,
        method: 'mobile',
        paidOn: '2026-08-03',
      })

    expect(await actions(parkId)).toContain('payment.record')
  })

  /**
   * SUPPRIMER UNE PREUVE EST LE GESTE À TRACER, pas l'ajouter.
   *
   * L'ajout d'une photo d'état des lieux était journalisé, son retrait non.
   * C'est précisément l'inverse : une photo ajoutée se voit dans le dossier,
   * une photo retirée ne se voit nulle part.
   */
  it('trace le retrait d’une photo d’état des lieux', async () => {
    const { cookie, parkId, unitId } = await parc('photo@example.com')
    const etat = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', cookie)
      .send({
        kind: 'entry',
        performedOn: '2026-08-01',
        rooms: 3,
        signedByName: 'Charles Ngassa',
        findings: [{ room: 'Séjour', description: 'Mur marqué', severity: 'minor' }],
      })
    const findingId = etat.body.inspection.findings[0].id as string

    const photo = await request(serveur)
      .post(`/api/parks/${parkId}/findings/${findingId}/photos`)
      .set('Cookie', cookie)
      .send({ contentType: 'image/jpeg', sizeBytes: 1024 })
    const photoId = photo.body.photo.id as string

    await request(serveur)
      .delete(`/api/parks/${parkId}/photos/${photoId}`)
      .set('Cookie', cookie)

    expect(await actions(parkId)).toContain('inspection.photo_delete')
  })

  it('trace un tarif de refacturation, qui produit les montants', async () => {
    const { cookie, parkId } = await parc('tarif@example.com')

    await request(serveur)
      .post(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', cookie)
      .send({ utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-08-01' })

    expect(await actions(parkId)).toContain('tariff.set')
  })

  it('trace la correction du parc — son nom et sa devise', async () => {
    const { cookie, parkId } = await parc('parc@example.com')

    await request(serveur)
      .patch(`/api/parks/${parkId}`)
      .set('Cookie', cookie)
      .send({ name: 'Parc Akwa', currency: 'EUR' })

    expect(await actions(parkId)).toContain('park.update')
  })

  it('trace le retrait d’un accès', async () => {
    const { cookie, parkId } = await parc('acces@example.com')
    const gestionnaire = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager' })
    const invitationId = gestionnaire.body.invitation.id as string

    await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${invitationId}/revoke`)
      .set('Cookie', cookie)

    expect(await actions(parkId)).toContain('access.revoke')
  })

  it('trace la création d’une fiche de locataire', async () => {
    const { parkId } = await parc('fiche@example.com')
    expect(await actions(parkId)).toContain('tenant.create')
  })
})

describe('la route du registre', () => {
  it('rend les décisions du parc, la plus récente d’abord', async () => {
    const { cookie, parkId } = await parc('registre@example.com')
    await request(serveur)
      .post(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', cookie)
      .send({ utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-08-01' })

    const res = await request(serveur)
      .get(`/api/parks/${parkId}/decisions`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    const decisions = res.body.decisions as { action: string; actor: string | null }[]
    /* L'ORDRE EST L'INFORMATION : on ouvre un registre pour savoir ce qui vient
       de se passer, pas ce qui s'est passé le premier jour. */
    expect(decisions[0]!.action).toBe('tariff.set')
    /* L'ACTEUR EST NOMMÉ. Un registre qui dirait « quelqu'un a arbitré une
       caution » n'aurait aucun objet — c'est le nom qui en fait un contrôle. */
    expect(decisions[0]!.actor).toBe('Compte de test')
  })

  /**
   * LE CLOISONNEMENT, ET IL EST DOUBLE.
   *
   * L'appartenance d'abord — un propriétaire parfaitement authentifié ne lit
   * pas le registre du voisin, et le serveur rend 404 pour que « pas le droit »
   * et « n'existe pas » se ressemblent vus de l'extérieur.
   */
  it('ne rend rien du parc d’un autre', async () => {
    const { parkId } = await parc('mien@example.com')
    const etranger = await inscrire('etranger@example.com', { parkName: 'Autre parc' })

    const res = await request(serveur)
      .get(`/api/parks/${parkId}/decisions`)
      .set('Cookie', etranger)

    expect(res.status).toBe(404)
  })

  /**
   * Le rôle ensuite. 403 et non 404 : l'existence du parc est déjà établie par
   * l'appartenance, il n'y a plus rien à cacher — seulement un droit à refuser.
   */
  it('se refuse au gestionnaire, qui n’a pas à se relire', async () => {
    const { cookie, parkId } = await parc('proprio2@example.com')
    const invitation = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'manager' })
    const code = invitation.body.code as string

    const gestionnaire = await inscrire('gestionnaire2@example.com')
    await request(serveur)
      .post('/api/join')
      .set('Cookie', gestionnaire)
      .send({ invitationCode: code })

    const res = await request(serveur)
      .get(`/api/parks/${parkId}/decisions`)
      .set('Cookie', gestionnaire)

    expect(res.status).toBe(403)
  })
})
