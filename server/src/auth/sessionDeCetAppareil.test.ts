import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'
import { empreinteJeton } from './token.js'

/**
 * « RESTER CONNECTÉ SUR CET APPAREIL » — LA MOITIÉ QUI COMPTE.
 *
 * L'écran garde que le choix PART (`src/routes/sessionDeCetAppareil.test.tsx`).
 * Ici on garde qu'il ARRIVE, et surtout qu'il produit une session réellement
 * plus courte — la seule chose qu'un utilisateur puisse constater.
 *
 * ═══ POURQUOI LES DEUX MOITIÉS, ET NON LE COOKIE SEUL ═══
 *
 * Un cookie sans échéance meurt « à la fermeture du navigateur », et c'était la
 * réponse évidente. Elle ne tient pas : Chrome, Edge et Firefox restaurent les
 * cookies de session quand « reprendre là où vous en étiez » est actif, et il
 * l'est par défaut sur plusieurs d'entre eux. Une promesse dont la tenue
 * dépend d'un réglage que l'utilisateur ignore n'est pas une promesse.
 *
 * L'échéance est donc écrite AUSSI en base, où aucun navigateur ne l'atteint.
 * Le cookie de session reste, pour le cas ordinaire ; la base tient le reste.
 */
const app = createApp()
const serveur = app.listen(0)

const INSCRIPTION = {
  email: 'sarah@example.com',
  password: 'un-mot-de-passe-assez-long',
  fullName: 'Sarah Ngassa',
  acceptTerms: true,
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
})

afterAll(async () => {
  await new Promise((resoudre) => serveur.close(resoudre))
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
})

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error('aucun cookie de session dans la réponse')
  return trouve
}

/** L'échéance écrite en base pour la session que ce cookie présente. */
async function echeanceEnBase(cookie: string): Promise<Date> {
  const jeton = decodeURIComponent(cookie.slice(NOM_COOKIE.length + 1).split(';')[0]!)
  const session = await prisma.session.findUnique({
    where: { tokenHash: empreinteJeton(jeton) },
  })
  if (!session) throw new Error('la session du cookie est introuvable en base')
  return session.expiresAt
}

const HEURE = 60 * 60 * 1000
const JOUR = 24 * HEURE

const seConnecter = (corps: Record<string, unknown>) =>
  request(serveur)
    .post('/api/auth/login')
    .send({ email: INSCRIPTION.email, password: INSCRIPTION.password, ...corps })

describe('la connexion sur un appareil qu’on ne veut pas retenir', () => {
  it('pose un cookie SANS échéance, qui meurt avec le navigateur', async () => {
    const res = await seConnecter({ persistent: false })
    expect(res.status).toBe(200)

    const cookie = cookieDe(res)
    /* Ni l'un ni l'autre : `Expires` est la forme historique, `Max-Age` la
       moderne, et un seul des deux suffit à faire persister le cookie. */
    expect(cookie, 'le cookie survit à la fermeture du navigateur').not.toMatch(/Expires=/i)
    expect(cookie).not.toMatch(/Max-Age=/i)
  })

  it('écrit une échéance COURTE en base, hors de portée du navigateur', async () => {
    const cookie = cookieDe(await seConnecter({ persistent: false }))

    const restant = (await echeanceEnBase(cookie)).getTime() - Date.now()
    expect(
      restant,
      'la session vaut encore des jours : le navigateur qui restaure ses cookies ' +
        'de session rendrait l’accès au parc',
    ).toBeLessThan(JOUR)
    // Et pas si courte qu'une journée de travail la coupe.
    expect(restant, 'la session est trop brève pour une journée de travail').toBeGreaterThan(6 * HEURE)
  })

  it('ne se laisse pas rendre longue par une valeur qui n’est pas un booléen', async () => {
    /* `"false"` est VRAI en JavaScript. Une coercition laxiste ici ferait donc
       de la chaîne « false » — ce qu'un client mal écrit enverrait — une
       session de trente jours, au moment exact où l'utilisateur demande le
       contraire. On refuse plutôt que de deviner. */
    const res = await seConnecter({ persistent: 'false' })
    expect(res.status, 'une chaîne est acceptée à la place du choix').toBe(400)
  })
})

describe('la connexion ordinaire', () => {
  it('ne change pas : cookie daté et session de trente jours', async () => {
    /* Le champ ABSENT vaut « oui ». C'est ce que font les clients déjà
       déployés — l'application installée sur les téléphones garde son ancien
       paquet un moment —, et les déconnecter en silence serait le seul effet
       visible de ce lot pour eux. */
    const cookie = cookieDe(await seConnecter({}))

    expect(cookie, 'le cookie a perdu son échéance').toMatch(/Expires=|Max-Age=/i)
    const restant = (await echeanceEnBase(cookie)).getTime() - Date.now()
    expect(restant).toBeGreaterThan(29 * JOUR)
  })
})
