import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'

/**
 * LE CONSENTEMENT À LA LETTRE D'INFORMATION SE RETIRE COMME IL S'EST DONNÉ.
 *
 * La case de l'inscription l'enregistre (`newsletterOptIn`) ; rien ne permettait
 * de le retirer ensuite, sinon par courrier. La politique de confidentialité
 * disait pourtant qu'on « peut le retirer ». Le RGPD (art. 7.3) veut que retirer
 * soit aussi simple que donner : un geste dans le produit, pas une lettre.
 */
const app = createApp()
const serveur = app.listen(0)

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  return (liste.find((c) => c.startsWith(`${NOM_COOKIE}=`)) ?? '').split(';')[0]!
}

let cookie = ''

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  const inscription = await request(serveur).post('/api/auth/signup').send({
    email: 'lettre@example.com',
    password: 'un-mot-de-passe-assez-long',
    fullName: 'Awa Mbarga',
    acceptTerms: true,
    newsletterOptIn: true,
  })
  cookie = cookieDe(inscription)
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('le retrait du consentement à la lettre', () => {
  it('se lit sur le compte, tel qu’il a été donné', async () => {
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(moi.body.user.newsletterOptIn).toBe(true)
  })

  it('se retire par le compte lui-même, et la base le garde', async () => {
    const retrait = await request(serveur)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ newsletterOptIn: false })
    expect(retrait.status).toBe(200)
    expect(retrait.body.user.newsletterOptIn).toBe(false)

    const compte = await prisma.userAccount.findUniqueOrThrow({ where: { email: 'lettre@example.com' } })
    expect(compte.newsletterOptIn).toBe(false)
  })

  it('ne se règle pas sans session', async () => {
    const res = await request(serveur).patch('/api/auth/me').send({ newsletterOptIn: false })
    expect(res.status).toBe(401)
  })
})
