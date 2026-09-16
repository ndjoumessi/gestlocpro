import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'
import { DELAI_D_EFFACEMENT_JOURS } from './fermeture.js'

/**
 * FERMER SON COMPTE — le geste qui manquait au droit d'effacement.
 *
 * ═══ POURQUOI UNE FERMETURE, ET NON UN EFFACEMENT IMMÉDIAT ═══
 *
 * Nelson a choisi le 2026-09-16 un effacement DIFFÉRÉ de trente jours : le
 * compte se ferme tout de suite, il s'efface plus tard, et une reconnexion
 * annule. La suppression est le seul geste du produit que rien ne rattrape ;
 * trente jours sont le filet, et le cron des relances — qui tourne déjà chaque
 * jour — l'exécutera (lot suivant).
 *
 * ═══ POURQUOI PAS `disabledAt` ═══
 *
 * Le schéma porte déjà cette date, et elle a un autre sens : un compte BARRÉ par
 * l'éditeur. La connexion le refuse (`invalid_credentials`), et c'est exactement
 * ce qu'il faut pour un abus — mais exactement ce qu'il ne faut pas ici, où la
 * reconnexion est le moyen d'annuler. Deux faits, deux dates.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 *  1. La fermeture DATE l'effacement et le dit à qui la demande.
 *  2. Elle COUPE les sessions : le compte fermé ne peut plus agir.
 *  3. La reconnexion l'ANNULE, et le dit — sans quoi personne ne saurait que
 *     son compte allait disparaître.
 *  4. Une fermeture refaite après annulation repart d'une échéance neuve — et
 *     le cas dit pourquoi « fermer deux fois » n'est pas un chemin du produit.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'
const COURRIEL = 'proprio@example.com'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`aucun cookie de session — ${res.status}`)
  return trouve
}

async function inscrire() {
  const res = await request(serveur).post('/api/auth/signup').send({
    email: COURRIEL,
    password: MDP,
    fullName: 'Djoumessi Nelson',
    acceptTerms: true,
    parkName: 'Parc Bonamoussadi',
    countryCode: 'CM',
  })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return cookieDe(res)
}

const fermer = (cookie?: string) => {
  const appel = request(serveur).post('/api/auth/me/closure')
  return cookie ? appel.set('Cookie', cookie) : appel
}

const seConnecter = () =>
  request(serveur).post('/api/auth/login').send({ email: COURRIEL, password: MDP })

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

describe('la fermeture d’un compte', () => {
  it('date l’effacement, le dit, et coupe TOUTES les sessions', async () => {
    /* DEUX SESSIONS, ET C'EST TOUT LE CAS. Avec une seule, « révoquer la
       sienne » et « révoquer toutes » rendent le même résultat : la mutation
       qui borne la révocation à la session courante passait au vert, mesuré. */
    const premierAppareil = await inscrire()
    const secondAppareil = cookieDe(await seConnecter())
    await request(serveur).get('/api/auth/me').set('Cookie', premierAppareil).expect(200)

    const avant = Date.now()
    const res = await fermer(secondAppareil)
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    /* LA DATE EST RENDUE : un écran qui l'inventerait pourrait mentir de
       plusieurs jours sur ce qui reste pour se raviser. */
    const effaceLe = new Date(res.body.effaceLe).getTime()
    const attendu = avant + DELAI_D_EFFACEMENT_JOURS * 86_400_000
    expect(Math.abs(effaceLe - attendu)).toBeLessThan(60_000)

    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: COURRIEL },
      select: { closureRequestedAt: true },
    })
    expect(compte.closureRequestedAt).not.toBeNull()

    /* L'AUTRE APPAREIL EST MORT LUI AUSSI. Sans cela, un onglet resté ouvert
       ailleurs continue de gérer un parc dont le propriétaire a demandé
       l'effacement. */
    const restee = await request(serveur).get('/api/auth/me').set('Cookie', premierAppareil)
    expect(restee.status, 'la session de l’autre appareil a survécu').toBe(401)
    const celleQuiFerme = await request(serveur).get('/api/auth/me').set('Cookie', secondAppareil)
    expect(celleQuiFerme.status).toBe(401)
    /* RÉVOQUÉES, pas supprimées : c'est la forme du produit — `fermerSession`
       pose `revokedAt` plutôt que d'effacer la ligne. */
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0)
  })

  it('refuse à qui n’a pas de session', async () => {
    await inscrire()
    expect((await fermer()).status).toBe(401)
    expect(
      (await prisma.userAccount.findUniqueOrThrow({ where: { email: COURRIEL } })).closureRequestedAt,
    ).toBeNull()
  })

  it('s’annule à la reconnexion, et le dit', async () => {
    const cookie = await inscrire()
    await fermer(cookie).expect(200)

    const res = await seConnecter()
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    /* IL FAUT LE DIRE. Annuler en silence laisserait croire que la demande n'a
       jamais été prise, et la prochaine fermeture serait faite « pour de bon »
       par quelqu'un qui doute. */
    expect(res.body.fermetureAnnulee).toBe(true)

    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: COURRIEL },
      select: { closureRequestedAt: true },
    })
    expect(compte.closureRequestedAt).toBeNull()
  })

  it('ne dit « annulée » que lorsqu’il y avait quelque chose à annuler', async () => {
    await inscrire()
    const res = await seConnecter()
    expect(res.status).toBe(200)
    expect(res.body.fermetureAnnulee).toBeUndefined()
  })

  /* CE QUE CE CAS REMPLACE : « fermer deux fois ne repousse pas l'échéance ».
     Ce chemin n'existe pas — la première fermeture COUPE les sessions, et la
     seule façon d'en obtenir une autre est de se reconnecter, ce qui annule.
     L'écrire aurait demandé de fabriquer une session à la main, donc de mesurer
     un état que le produit ne sait pas produire. */
  it('repart d’une échéance neuve après une annulation', async () => {
    const cookie = await inscrire()
    const premiere = await fermer(cookie).expect(200)

    const reconnexion = await seConnecter()
    expect(reconnexion.body.fermetureAnnulee).toBe(true)

    const seconde = await fermer(cookieDe(reconnexion)).expect(200)
    expect(new Date(seconde.body.effaceLe).getTime()).toBeGreaterThanOrEqual(
      new Date(premiere.body.effaceLe).getTime(),
    )
    expect(
      (await prisma.userAccount.findUniqueOrThrow({ where: { email: COURRIEL } })).closureRequestedAt,
    ).not.toBeNull()
  })
})
