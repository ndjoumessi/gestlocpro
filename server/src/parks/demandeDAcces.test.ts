import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE GESTIONNAIRE PEUT ENFIN DEMANDER, ET LE PROPRIÉTAIRE ARBITRER.
 *
 * ═══ UNE CASE SANS ROUTE, RETIRÉE POUR ÇA ═══
 *
 * L'assistant d'inscription portait « Je n'ai pas de code — envoyer une demande
 * d'accès ». Elle n'avait AUCUNE route derrière : la cocher désactivait le
 * champ, laissait passer l'étape, et produisait un compte rattaché à aucun
 * parc. `wiring.test.tsx` l'a retirée — « ne propose plus une demande d'accès
 * que rien ne reçoit ».
 *
 * Le modèle, lui, l'attendait depuis le début : `MembershipStatus.requested`
 * est déclaré et documenté — « la demande d'accès du gestionnaire sans code :
 * une décision en attente chez le propriétaire ». AUCUNE LIGNE DU SERVEUR NE
 * L'ÉCRIVAIT. Un état de schéma sans producteur est une fonctionnalité qui
 * n'existe pas.
 *
 * ═══ COMMENT LE PARC EST DÉSIGNÉ ═══
 *
 * Par le COURRIEL DU PROPRIÉTAIRE. Un gestionnaire qui arrive ne connaît aucun
 * identifiant de parc — il connaît son client. La demande atterrit dans le
 * registre des accès de ce propriétaire, qui accorde ou refuse.
 *
 * LA RÉPONSE EST IDENTIQUE que l'adresse existe ou non. C'est la règle déjà
 * appliquée aux codes d'invitation — « les distinguer dirait à qui essaie des
 * codes au hasard lesquels ont existé » — et elle vaut plus encore ici : une
 * réponse qui varie transformerait cette route en détecteur de clientèle.
 *
 * ═══ CE QU'ELLE ACCORDE, ET CE QU'ELLE N'ACCORDE PAS ═══
 *
 * Accordée, l'adhésion naît `declared` — RIEN de confié. Le propriétaire a dit
 * « entrez », pas « voyez tout ». C'est la même naissance que par invitation, et
 * elle rejoint le registre qui sait désormais dire « rien ne lui est encore
 * confié ».
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

/** Un propriétaire avec son parc, et un gestionnaire qui n'a rien. */
async function unProprioEtUnInconnu() {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Nelson D',
    acceptTerms: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const inconnu = await request(serveur).post('/api/auth/signup').send({
    email: 'gestion@example.com',
    password: MDP,
    fullName: 'Gestion Aire',
    acceptTerms: true,
  })
  return {
    cookieProprio: cookieDe(proprio),
    cookieInconnu: cookieDe(inconnu),
    parkId: (await prisma.park.findFirstOrThrow()).id,
  }
}

const demander = (cookie: string, ownerEmail: string) =>
  request(serveur).post('/api/access-requests').set('Cookie', cookie).send({ ownerEmail })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  serveur.close()
})

describe('la demande d’accès', () => {
  it('écrit enfin l’état que le schéma attendait', async () => {
    const { cookieInconnu, parkId } = await unProprioEtUnInconnu()
    expect((await demander(cookieInconnu, 'proprio@example.com')).status).toBe(202)

    const demande = await prisma.membership.findFirstOrThrow({ where: { parkId, role: 'manager' } })
    expect(demande.status).toBe('requested')
    /* `declared` DÈS LA DEMANDE : accordée, elle ne doit pas ouvrir le parc
       entier par le défaut du schéma. */
    expect(demande.scope).toBe('declared')
  })

  it('répond PAREIL sur une adresse qui n’existe pas', async () => {
    const { cookieInconnu } = await unProprioEtUnInconnu()
    const connue = await demander(cookieInconnu, 'proprio@example.com')
    await prisma.membership.deleteMany({ where: { role: 'manager' } })
    const inconnue = await demander(cookieInconnu, 'personne@example.com')

    expect(inconnue.status, 'une réponse qui varie ferait de cette route un détecteur de clientèle').toBe(
      connue.status,
    )
    expect(inconnue.body).toEqual(connue.body)
    expect(await prisma.membership.count({ where: { role: 'manager' } })).toBe(0)
  })

  it('ne double pas une demande déjà posée', async () => {
    const { cookieInconnu } = await unProprioEtUnInconnu()
    await demander(cookieInconnu, 'proprio@example.com')
    await demander(cookieInconnu, 'proprio@example.com')
    expect(await prisma.membership.count({ where: { role: 'manager' } })).toBe(1)
  })

  it('ne touche à rien pour qui est DÉJÀ membre du parc', async () => {
    const { cookieProprio } = await unProprioEtUnInconnu()
    /* Le propriétaire lui-même : sa demande ne doit pas lui coller une seconde
       adhésion de gestionnaire par-dessus la sienne. */
    await demander(cookieProprio, 'proprio@example.com')
    expect(await prisma.membership.count({ where: { role: 'manager' } })).toBe(0)
  })

  it('n’ouvre RIEN tant que le propriétaire n’a pas tranché', async () => {
    const { cookieInconnu, parkId } = await unProprioEtUnInconnu()
    await demander(cookieInconnu, 'proprio@example.com')
    const vu = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookieInconnu)
    expect(vu.status, 'une demande n’est pas un accès').toBe(404)
  })
})

describe('l’arbitrage du propriétaire', () => {
  async function unParcAvecUneDemande() {
    const socle = await unProprioEtUnInconnu()
    await demander(socle.cookieInconnu, 'proprio@example.com')
    const demande = await prisma.membership.findFirstOrThrow({ where: { role: 'manager' } })
    return { ...socle, demandeId: demande.id }
  }

  it('la voit dans le registre des accès, à part des membres', async () => {
    const { cookieProprio, parkId } = await unParcAvecUneDemande()
    const registre = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', cookieProprio)
    expect(registre.status).toBe(200)
    /* À PART : une demande rangée parmi les membres se lirait comme un accès
       déjà accordé, sur le seul écran qui sert à en décider. */
    expect(registre.body.requests).toHaveLength(1)
    expect(registre.body.requests[0].fullName).toBe('Gestion Aire')
    expect(registre.body.members.some((m: { role: string }) => m.role === 'manager')).toBe(false)
  })

  it('accorde, et le gestionnaire entre — sans rien voir', async () => {
    const { cookieProprio, cookieInconnu, parkId, demandeId } = await unParcAvecUneDemande()
    const decision = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${demandeId}/decision`)
      .set('Cookie', cookieProprio)
      .send({ accorder: true })
    expect(decision.status).toBe(204)

    const vu = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookieInconnu)
    expect(vu.status, 'accordée, la demande devient un accès').toBe(200)
    expect(vu.body.scoped, 'et il est borné : rien ne lui a encore été confié').toBe(true)
    expect(vu.body.buildings).toEqual([])
  })

  it('refuse, et la porte reste fermée', async () => {
    const { cookieProprio, cookieInconnu, parkId, demandeId } = await unParcAvecUneDemande()
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${demandeId}/decision`)
      .set('Cookie', cookieProprio)
      .send({ accorder: false })

    const vu = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookieInconnu)
    expect(vu.status).toBe(404)
  })

  it('n’est PAS offert au gestionnaire, qui s’accorderait lui-même', async () => {
    const { cookieInconnu, parkId, demandeId } = await unParcAvecUneDemande()
    const decision = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${demandeId}/decision`)
      .set('Cookie', cookieInconnu)
      .send({ accorder: true })
    expect(decision.status, 'le demandeur n’arbitre pas sa propre demande').not.toBe(204)
  })
})
