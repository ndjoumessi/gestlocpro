import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { DELAI_D_EFFACEMENT_JOURS } from '../auth/fermeture.js'

/**
 * LE PARC DIT QU'IL VA DISPARAÎTRE — dans le produit, pas seulement par courriel.
 *
 * ═══ CE QUI MANQUAIT ═══
 *
 * 4fe498d prévient les locataires et les gestionnaires PAR COURRIEL, et son
 * message le nomme : « rien dans le produit ne montre ces deux états ». Un
 * locataire qui n'ouvre pas ses messages — ou dont le courriel part en
 * indésirables — ouvre son portail la veille de l'effacement et n'y lit rien.
 *
 * ═══ QUI LE VOIT, ET QUI NE LE VERRA JAMAIS ═══
 *
 * Les MEMBRES du parc. Pas le propriétaire qui a fermé : sa fermeture a coupé
 * ses sessions, et se reconnecter l'annule — il ne peut donc pas être à la fois
 * connecté et sous le coup d'une fermeture. C'est une conséquence du lot
 * précédent, et elle se mesure ici.
 *
 * ═══ CE QUE LE SERVEUR REND ═══
 *
 * La DATE, ou `null`. Jamais « true » : un écran qui dirait « ce parc va être
 * supprimé » sans dire quand laisserait chacun deviner s'il lui reste un jour ou
 * un mois. Et c'est le serveur qui la calcule — le même délai que la route de
 * fermeture et que le balayage.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`aucun cookie de session — ${res.status}`)
  return trouve
}

async function parcAvecUnGestionnaire() {
  const inscription = await request(serveur).post('/api/auth/signup').send({
    email: 'proprio@example.com',
    password: MDP,
    fullName: 'Djoumessi Nelson',
    acceptTerms: true,
    parkName: 'Parc Bonamoussadi',
    countryCode: 'CM',
  })
  const cookie = cookieDe(inscription)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
  const parkId = moi.body.memberships[0].parkId as string

  const invitation = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  const gestionnaire = await request(serveur).post('/api/auth/signup').send({
    email: 'cabinet@example.com',
    password: MDP,
    fullName: 'Cabinet Njoya',
    acceptTerms: true,
    invitationCode: invitation.body.code,
  })

  return { cookie, cookieGestion: cookieDe(gestionnaire), parkId }
}

const portefeuille = (parkId: string, cookie: string) =>
  request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)

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

describe('la fermeture vue depuis le parc', () => {
  it('ne dit rien tant que personne n’a fermé', async () => {
    const { parkId, cookieGestion } = await parcAvecUnGestionnaire()
    const vue = await portefeuille(parkId, cookieGestion).expect(200)
    expect(vue.body.fermetureLe).toBeNull()
  })

  it('rend la date au gestionnaire quand le propriétaire a fermé', async () => {
    const { parkId, cookie, cookieGestion } = await parcAvecUnGestionnaire()
    const fermeture = await request(serveur)
      .post('/api/auth/me/closure')
      .set('Cookie', cookie)
      .expect(200)

    const vue = await portefeuille(parkId, cookieGestion).expect(200)
    /* LA MÊME DATE QUE CELLE ANNONCÉE PAR COURRIEL : deux calculs séparés
       diraient deux jours différents au même gestionnaire. */
    expect(vue.body.fermetureLe).toBe(fermeture.body.effaceLe)
    const jours = (new Date(vue.body.fermetureLe).getTime() - Date.now()) / 86_400_000
    expect(Math.round(jours)).toBe(DELAI_D_EFFACEMENT_JOURS)
  })

  it('ne dit rien quand le parc a un second propriétaire', async () => {
    const { parkId, cookie, cookieGestion } = await parcAvecUnGestionnaire()
    const associe = await request(serveur).post('/api/auth/signup').send({
      email: 'associe@example.com',
      password: MDP,
      fullName: 'Associée',
      acceptTerms: true,
    })
    await prisma.membership.create({
      data: { parkId, userId: associe.body.user.id, role: 'owner', status: 'active' },
    })
    await request(serveur).post('/api/auth/me/closure').set('Cookie', cookie).expect(200)

    /* Le parc survivra : annoncer sa disparition serait la même fausse alerte
       que celle qu'aucun courriel n'envoie. */
    const vue = await portefeuille(parkId, cookieGestion).expect(200)
    expect(vue.body.fermetureLe).toBeNull()
  })

  it('l’oublie dès que la fermeture est annulée', async () => {
    const { parkId, cookie, cookieGestion } = await parcAvecUnGestionnaire()
    await request(serveur).post('/api/auth/me/closure').set('Cookie', cookie).expect(200)
    await request(serveur)
      .post('/api/auth/login')
      .send({ email: 'proprio@example.com', password: MDP })
      .expect(200)

    const vue = await portefeuille(parkId, cookieGestion).expect(200)
    expect(vue.body.fermetureLe).toBeNull()
  })
})
