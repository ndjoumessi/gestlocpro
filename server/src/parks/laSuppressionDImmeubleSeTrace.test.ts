import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * SUPPRIMER UN IMMEUBLE NE LAISSAIT AUCUNE TRACE.
 *
 * ═══ LE SEUL ACTE DESTRUCTEUR MUET ═══
 *
 * Sept routes de ce fichier suppriment quelque chose. Six écrivent au registre
 * des décisions — un versement retiré, une fiche de locataire effacée, une photo
 * de constat. La septième, celle qui supprime un IMMEUBLE, n'écrivait rien.
 *
 * Relevé le 2026-09-04 en balayant les routes qui appellent `delete` ou
 * `deleteMany` : deux ressortaient muettes, et l'une des deux était un faux
 * positif — `/api/join` trace par un auxiliaire plutôt qu'en ligne.
 *
 * ═══ POURQUOI CELLE-CI COMPTE PLUS QUE LES AUTRES ═══
 *
 * Elle est ouverte au GESTIONNAIRE autant qu'au propriétaire. Un cabinet à qui
 * l'on a confié trois immeubles peut en supprimer un, et le propriétaire n'avait
 * aucun moyen de savoir que ça avait eu lieu, ni par qui.
 *
 * La route se garde par ailleurs très bien : elle refuse un immeuble qui porte
 * des logements, elle cherche avec le `parkId` et le périmètre du demandeur. Son
 * propre en-tête dit que « toute faute de frappe était définitive ». C'est
 * exactement le geste qu'un journal existe pour porter.
 *
 * ═══ LE NOM, ÉCRIT À L'INSTANT DE LA DÉCISION ═══
 *
 * Comme `payment.delete` écrit le montant du versement qu'il supprime. Après
 * coup, l'immeuble n'existe plus : son identifiant ne mène nulle part, et seul
 * le nom consigné dit ce qui a disparu.
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

async function unParcAvecUnImmeubleVide() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Nelson D',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookie = cookieDe(proprio)
  const parkId = (await prisma.park.findFirstOrThrow()).id
  const immeuble = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Résidence Éphémère', district: 'Bastos' })
  expect(immeuble.status).toBe(201)
  return { cookie, parkId, buildingId: immeuble.body.building.id as string }
}

const traces = (parkId: string) =>
  prisma.auditEvent.findMany({ where: { parkId, action: 'building.delete' } })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('supprimer un immeuble', () => {
  it('se CONSIGNE, avec le NOM de ce qui a disparu', async () => {
    const { cookie, parkId, buildingId } = await unParcAvecUnImmeubleVide()
    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(204)

    const [trace, ...reste] = await traces(parkId)
    expect(trace, 'un immeuble a disparu sans que rien ne le garde').toBeDefined()
    expect(reste, 'une suppression, une ligne').toHaveLength(0)
    expect(trace!.entity).toBe('Building')
    expect(trace!.entityId, 'sans la cible, le registre ne dit pas lequel').toBe(buildingId)
    const charge = trace!.payload as { name?: string; district?: string }
    expect(
      charge.name,
      'l’immeuble n’existe plus : seul ce qui est consigné dit ce qui a disparu',
    ).toBe('Résidence Éphémère')
    /* LE QUARTIER AUSSI : rien n'impose l'unicité d'un nom d'immeuble dans un
       parc, et deux homonymes rendraient la ligne du journal ambiguë. */
    expect(charge.district, 'le nom seul ne désigne pas un immeuble').toBe('Bastos')
    expect(trace!.actorId, 'un registre qui ne dit pas QUI a supprimé ne fait pas autorité').toBeTruthy()
  })
})

describe('ce qui ne doit RIEN consigner', () => {
  it('un immeuble qui porte des logements — la route refuse', async () => {
    /* 409 : l'acte n'a pas lieu. Consigner une tentative remplirait le registre
       de suppressions qui ne se sont pas produites. */
    const { cookie, parkId, buildingId } = await unParcAvecUnImmeubleVide()
    await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T2', surfaceSqm: 40, baseRentMinor: 100000 })

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(409)
    expect(await traces(parkId), 'une suppression refusée n’est pas une suppression').toHaveLength(0)
  })

  it('un identifiant qui n’est pas de ce parc', async () => {
    const { cookie, parkId } = await unParcAvecUnImmeubleVide()
    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/buildings/00000000-0000-4000-8000-0000000000aa`)
      .set('Cookie', cookie)
    expect(res.status).toBe(404)
    expect(await traces(parkId)).toHaveLength(0)
  })
})
