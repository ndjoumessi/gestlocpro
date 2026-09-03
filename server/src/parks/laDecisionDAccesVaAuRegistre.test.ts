import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * ACCORDER L'ACCÈS À UN PARC NE LAISSAIT AUCUNE TRACE.
 *
 * ═══ UNE OMISSION DE SYMÉTRIE ═══
 *
 * Le registre des décisions trace DÉJÀ quatre gestes d'accès : relier une fiche
 * locataire à un compte, l'en délier, reprendre un accès, confier un périmètre
 * d'immeubles. Chacun porte son commentaire, et celui de la reprise dit
 * exactement pourquoi : « le registre des ACCÈS dit qui a le droit aujourd'hui ;
 * il ne dit pas qui l'avait hier ni qui le lui a repris ».
 *
 * La route qui ARBITRE une demande d'accès — livrée ce matin — n'écrivait rien.
 * Or elle fait entrer quelqu'un dans un parc, ou lui en ferme la porte. C'est
 * le geste le plus lourd des cinq, et le seul muet.
 *
 * Le trou se voyait à l'œil : `access.link`, `access.revoke`, `access.scope`,
 * `access.unlink` d'un côté ; `membership.update` suivi d'un `204` de l'autre.
 *
 * ═══ DEUX ACTIONS, PAS UNE AVEC UN DRAPEAU ═══
 *
 * `access.grant` et `access.refuse` sont deux lignes distinctes du registre.
 * `access.scope` a fait le choix inverse — un libellé pour les deux sens —
 * mais pour une raison qui ne vaut pas ici : son sens se lit dans la LISTE que
 * porte sa charge utile. Le sens d'une décision, lui, n'est déductible
 * d'aucune donnée ; le cacher derrière un booléen obligerait le registre à
 * décoder une charge utile pour dire ce qui s'est passé, et l'écran ne le fait
 * pas — une action sans recette de détail n'affiche que son libellé.
 *
 * ═══ CE QUI EST CONSIGNÉ ═══
 *
 * L'adhésion visée et le rôle demandé. Pas le courriel du demandeur : il est
 * dans le registre des accès, où l'on décide, et un journal se lit longtemps
 * après par des gens qui n'ont pas à connaître la clientèle d'hier.
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

async function uneDemandeEnAttente() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Nelson D',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookieProprio = cookieDe(proprio)
  const parkId = (await prisma.park.findFirstOrThrow()).id

  const demandeur = await request(serveur).post('/api/auth/signup').send({
    email: 'gestion@example.com',
    password: MDP,
    fullName: 'Gestion Aire',
    acceptTerms: true,
  })
  await request(serveur)
    .post('/api/access-requests')
    .set('Cookie', cookieDe(demandeur))
    .send({ ownerEmail: 'proprio@example.com' })

  const adhesion = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })
  expect(adhesion.status, 'le montage est faux : la demande n’est pas en attente').toBe('requested')
  return { cookieProprio, parkId, adhesionId: adhesion.id }
}

const decider = (cookie: string, parkId: string, adhesionId: string, accorder: boolean) =>
  request(serveur)
    .patch(`/api/parks/${parkId}/memberships/${adhesionId}/decision`)
    .set('Cookie', cookie)
    .send({ accorder })

/** Les décisions d'accès consignées pour ce parc, les plus récentes d'abord. */
const traces = (parkId: string) =>
  prisma.auditEvent.findMany({
    where: { parkId, action: { startsWith: 'access.' } },
    orderBy: { createdAt: 'desc' },
  })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('la décision d’accès', () => {
  it('consigne l’ACCORD, que rien ne gardait', async () => {
    const { cookieProprio, parkId, adhesionId } = await uneDemandeEnAttente()
    expect((await decider(cookieProprio, parkId, adhesionId, true)).status).toBe(204)

    const [trace, ...reste] = await traces(parkId)
    expect(trace, 'faire entrer quelqu’un dans un parc ne laissait aucune trace').toBeDefined()
    expect(reste, 'une décision, une ligne').toHaveLength(0)
    expect(trace!.action).toBe('access.grant')
    expect(trace!.entity).toBe('Membership')
    expect(trace!.entityId, 'sans la cible, le registre dit qu’on a accordé sans dire à qui').toBe(
      adhesionId,
    )
    expect(trace!.actorId, 'un registre qui ne dit pas QUI a décidé ne fait pas autorité').toBeTruthy()
    expect((trace!.payload as { role?: string }).role).toBe('manager')
  })

  it('consigne le REFUS, qui est aussi une décision', async () => {
    /* Refuser n'écrit rien de visible au registre des accès — la ligne passe
       `revoked` et disparaît de la file. Sans trace, le geste serait
       parfaitement invisible après coup. */
    const { cookieProprio, parkId, adhesionId } = await uneDemandeEnAttente()
    expect((await decider(cookieProprio, parkId, adhesionId, false)).status).toBe(204)

    const [trace] = await traces(parkId)
    expect(trace, 'refuser ne laissait rien').toBeDefined()
    expect(trace!.action).toBe('access.refuse')
    expect(trace!.entityId).toBe(adhesionId)
  })

  it('n’écrit RIEN quand la décision est refusée par la route', async () => {
    /* Non-régression : le 404 protège d'un identifiant deviné et d'une adhésion
       active. Consigner ces tentatives remplirait le registre de décisions qui
       n'ont pas eu lieu. */
    const { cookieProprio, parkId } = await uneDemandeEnAttente()
    const inexistante = await decider(
      cookieProprio,
      parkId,
      '00000000-0000-0000-0000-000000000000',
      true,
    )
    expect(inexistante.status).toBe(404)
    expect(await traces(parkId), 'une décision qui n’a pas eu lieu ne se consigne pas').toHaveLength(
      0,
    )
  })
})
