import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UN LIEN POSÉ SUR LA MAUVAISE PERSONNE SE VOIT, ET SE DÉFAIT.
 *
 * ═══ L'INCIDENT QUI L'A FAIT ÉCRIRE ═══
 *
 * Relevé sur la production le 2026-08-31, en croisant deux captures. « Accès au
 * parc » : ELOUNDOU CHARLES ne porte plus « Relier à une fiche », donc il EST
 * relié ; BEKONO LANDRY le porte encore, donc il ne l'est pas. « Locataires et
 * baux » : la fiche « Bekono Landry · A1 » n'a PAS la pastille « Sans compte »,
 * donc elle appartient à un compte — et le seul compte relié du parc est celui
 * de Charles.
 *
 * Charles détenait donc le bail, les quittances, les relevés et la caution de
 * Landry. Landry, lui, ouvrait un espace vide. C'est mot pour mot ce que les
 * commentaires de ce dépôt appellent depuis trois lots « la faute la plus grave
 * que cet écran puisse commettre, et elle est silencieuse ».
 *
 * ═══ ET RIEN NE PERMETTAIT DE LA DÉFAIRE ═══
 *
 * `POST /tenants/:id/compte` relie. Aucune route ne déliait. `Tenant.userId`
 * s'écrivait une fois pour toutes : la fiche restait captive de son compte, et
 * relier le bon locataire rendait 409 `already_linked` — POUR TOUJOURS.
 *
 * Pire, la sortie apparente était un piège. « Retirer l'accès » ne touche que
 * `Membership.status` : la fiche demeurait tenue par un compte qui ne peut plus
 * entrer, donc invisible à son détenteur ET inaccessible à son propriétaire
 * légitime. Le geste qui semblait réparer scellait le défaut.
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

/** Le montage EXACT de la production : Charles tient la fiche de Landry. */
async function ficheReliieAuMauvaisCompte() {
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
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId: a1.body.unit.id, fullName: 'Bekono Landry' })

  /** Deux comptes de locataire entrent par deux codes SANS logement. */
  const entrer = async (email: string, fullName: string) => {
    const inv = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant' })
    const compte = await request(serveur)
      .post('/api/auth/signup')
      .send({ email, password: MDP, fullName, acceptTerms: true, invitationCode: inv.body.code })
    return { cookie: cookieDe(compte), userId: compte.body.user.id as string }
  }
  const charles = await entrer('charles@example.com', 'Eloundou Charles')
  const landry = await entrer('romel@example.com', 'Bekono Landry')

  const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
  const ficheId = acces.body.unlinkedTenants[0].id as string

  // LE GESTE FAUTIF : la fiche de Landry est reliée au compte de Charles.
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
    .set('Cookie', cookie)
    .send({ userId: charles.userId })

  return { cookie, parkId, ficheId, charles, landry }
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

describe('voir à qui une fiche est reliée', () => {
  it('nomme la fiche que le membre détient, et son logement', async () => {
    const { cookie, parkId, charles } = await ficheReliieAuMauvaisCompte()

    const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
    const membre = acces.body.members.find((m: { userId: string }) => m.userId === charles.userId)

    /* SANS CE NOM, L'ERREUR EST INVISIBLE. Le registre disait « relié » par une
       absence de bouton ; il ne disait pas à QUOI. Le propriétaire ne pouvait
       donc pas voir que Charles détient la fiche de Landry — il ne pouvait que
       constater que Landry, lui, n'a rien. */
    expect(membre.tenantName, 'le registre ne dit pas quelle fiche ce compte détient').toBe(
      'Bekono Landry',
    )
    expect(membre.tenantUnitLabel).toBe('A1')
  })
})

describe('défaire un lien', () => {
  it('rend la fiche libre, et le bon locataire peut la recevoir', async () => {
    const { cookie, parkId, ficheId, landry } = await ficheReliieAuMauvaisCompte()

    const avant = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
      .set('Cookie', cookie)
      .send({ userId: landry.userId })
    expect(avant.status, 'le montage du cas est faux : la fiche n’était pas captive').toBe(409)

    const delie = await request(serveur)
      .delete(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
      .set('Cookie', cookie)
    expect(delie.status, `déliaison refusée : ${JSON.stringify(delie.body)}`).toBe(204)

    const apres = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
      .set('Cookie', cookie)
      .send({ userId: landry.userId })
    expect(apres.status, 'la fiche reste captive après avoir été déliée').toBe(204)

    const parc = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', landry.cookie)
    expect(
      (parc.body.buildings as { units: unknown[] }[]).flatMap((b) => b.units),
      'le bon locataire ne voit toujours pas son logement',
    ).toHaveLength(1)
  })

  it('retire au mauvais compte ce qu’il ne devait pas voir', async () => {
    const { cookie, parkId, ficheId, charles } = await ficheReliieAuMauvaisCompte()

    const avant = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', charles.cookie)
    expect(
      (avant.body.buildings as { units: unknown[] }[]).flatMap((b) => b.units),
      'le montage du cas est faux : le mauvais compte ne voyait rien',
    ).toHaveLength(1)

    await request(serveur).delete(`/api/parks/${parkId}/tenants/${ficheId}/compte`).set('Cookie', cookie)

    const apres = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', charles.cookie)
    expect(
      (apres.body.buildings as { units: unknown[] }[]).flatMap((b) => b.units),
      'le mauvais compte voit encore le bail d’un autre',
    ).toHaveLength(0)
  })

  it('trace la déliaison au registre des décisions', async () => {
    const { cookie, parkId, ficheId } = await ficheReliieAuMauvaisCompte()
    await request(serveur).delete(`/api/parks/${parkId}/tenants/${ficheId}/compte`).set('Cookie', cookie)

    const journal = await request(serveur).get(`/api/parks/${parkId}/decisions`).set('Cookie', cookie)
    expect(
      (journal.body.decisions as { action: string }[]).map((d) => d.action),
      'retirer un accès à des données n’est pas tracé',
    ).toContain('access.unlink')
  })

  it('y écrit le NOM de la fiche, et pas seulement un identifiant de compte', async () => {
    /* `payload: { userId }` seul est un UUID — du bruit qui a l'air d'une
       information, et que l'écran refuse d'afficher brut. Le sujet de la phrase
       « fiche déliée de son compte » est la FICHE ; `entityId` porte déjà son
       identifiant, le payload porte désormais son nom. */
    const { cookie, parkId, ficheId } = await ficheReliieAuMauvaisCompte()
    await request(serveur).delete(`/api/parks/${parkId}/tenants/${ficheId}/compte`).set('Cookie', cookie)

    const trace = await prisma.auditEvent.findFirst({
      where: { parkId, action: 'access.unlink' },
      select: { payload: true },
    })
    expect(
      (trace?.payload as { tenantName?: string })?.tenantName,
      'le registre ne dit pas QUELLE fiche a été déliée',
    ).toBe('Bekono Landry')
  })

  it('refuse une fiche qui n’a pas de compte', async () => {
    const { cookie, parkId, ficheId } = await ficheReliieAuMauvaisCompte()
    await request(serveur).delete(`/api/parks/${parkId}/tenants/${ficheId}/compte`).set('Cookie', cookie)

    const encore = await request(serveur)
      .delete(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
      .set('Cookie', cookie)
    expect(encore.status).toBe(409)
    expect(encore.body.error).toBe('not_linked')
  })
})

describe('retirer un accès', () => {
  it('libère la fiche que le compte détenait', async () => {
    /**
     * SANS CELA, LE GESTE QUI SEMBLE RÉPARER SCELLE LE DÉFAUT.
     *
     * « Retirer l'accès » ne touchait que `Membership.status`. La fiche restait
     * tenue par un compte qui ne peut plus entrer : invisible à son détenteur,
     * et inaccessible au locataire légitime, puisque relier rend alors 409
     * `already_linked`. Un propriétaire qui cherchait à corriger fabriquait donc
     * une impasse définitive avec le seul bouton que l'écran lui offrait.
     */
    const { cookie, parkId, ficheId, charles, landry } = await ficheReliieAuMauvaisCompte()

    const acces = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookie)
    const membre = acces.body.members.find((m: { userId: string }) => m.userId === charles.userId)
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${membre.id}/revoke`)
      .set('Cookie', cookie)

    const rep = await request(serveur)
      .post(`/api/parks/${parkId}/tenants/${ficheId}/compte`)
      .set('Cookie', cookie)
      .send({ userId: landry.userId })
    expect(rep.status, 'la fiche reste captive d’un compte qui n’a plus accès').toBe(204)
  })
})
