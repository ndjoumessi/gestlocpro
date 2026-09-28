import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'
import { DELAI_D_EFFACEMENT_JOURS } from './fermeture.js'
import { effacerLesComptesFermes } from './effacementDesComptes.js'

/**
 * LE REGISTRE GARDE LE NOM DE QUI A AGI.
 *
 * ═══ CE QUE L'EFFACEMENT EMPORTAIT AVEC LUI ═══
 *
 * `AuditEvent.actorId` est en `SetNull`, et c'est juste : le registre doit
 * survivre au départ d'un compte, « une décision dont l'auteur est parti reste
 * une décision prise ». Mais le NOM partait avec l'identifiant, et l'écran
 * rendait « Accès repris · Gestionnaire délégué · par qui : Compte supprimé ».
 *
 * La responsabilité s'effaçait donc au moment précis où elle compte. Un registre
 * de décisions existe pour répondre à « qui a fait ça ? » ; celui-ci répondait
 * « personne » dès qu'on partait — et partir est justement ce que fait quelqu'un
 * qui a quelque chose à se reprocher.
 *
 * ═══ LE NOM SE FIGE AU DÉPART, PAS À CHAQUE ÉCRITURE ═══
 *
 * `actorName` reste NUL tant que le compte vit : le nom se lit alors par la
 * relation, et une copie qui vieillirait à côté finirait par le contredire —
 * quelqu'un qui se marie renomme son compte, pas son passé. C'est à
 * l'effacement, et là seulement, qu'on fige ce que la relation ne dira plus.
 *
 * ═══ CE QUE CE FICHIER NE TIENT PAS ═══
 *
 * Les décisions PRISES AVANT ce lot par des comptes DÉJÀ effacés : leur nom
 * n'existe plus nulle part, et aucune migration ne peut le retrouver. Elles
 * resteront « Compte supprimé » pour toujours, et c'est dit au rapport.
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

/**
 * DEUX PROPRIÉTAIRES SUR UN PARC, et c'est indispensable.
 *
 * Un parc dont le partant est le SEUL propriétaire s'efface avec lui : son
 * registre disparaît, et le cas n'aurait plus rien à lire. C'est le second
 * propriétaire qui fait survivre le parc — et c'est exactement la situation où
 * la question « qui a fait ça ? » se pose vraiment.
 */
async function parcAvecUnPartant() {
  const restant = await request(serveur).post('/api/auth/signup').send({
    email: 'restant@example.com',
    password: MDP,
    fullName: 'Arsène Nkolo',
    confirmLegal: true,
    parkName: 'Parc Bastos',
    countryCode: 'CM',
  })
  const cookieRestant = cookieDe(restant)
  const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookieRestant)
  const parkId = moi.body.memberships[0].parkId as string

  const partant = await request(serveur).post('/api/auth/signup').send({
    email: 'partant@example.com',
    password: MDP,
    fullName: 'Diane Fotso',
    confirmLegal: true,
    parkName: 'Parc de Diane',
    countryCode: 'CM',
  })
  const cookiePartant = cookieDe(partant)
  const elle = await request(serveur).get('/api/auth/me').set('Cookie', cookiePartant)
  const sonParc = elle.body.memberships[0].parkId as string
  const sonCompte = await prisma.userAccount.findUniqueOrThrow({
    where: { email: 'partant@example.com' },
    select: { id: true },
  })

  /* ON LA FAIT PROPRIÉTAIRE DU PARC COMMUN, puis on lui fait PRENDRE UNE
     DÉCISION dessus.

     LA CORRECTION D'UN IMMEUBLE, ET NON SA CRÉATION : le registre ne consigne
     pas les créations — il porte `building.update` et `building.delete`, pas
     `building.create`. Une première rédaction créait l'immeuble et lisait un
     registre VIDE ; le cas rougissait pour la mauvaise raison. */
  await prisma.membership.create({
    data: { parkId, userId: sonCompte.id, role: 'owner' },
  })
  const imm = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookiePartant)
    .send({ name: 'Residence Akwa', district: 'Akwa' })
  expect(imm.status, `création d’immeuble refusée — ${JSON.stringify(imm.body)}`).toBe(201)
  const correction = await request(serveur)
    .patch(`/api/parks/${parkId}/buildings/${imm.body.building.id}`)
    .set('Cookie', cookiePartant)
    .send({ district: 'Akwa Nord' })
  expect(correction.status, `correction refusée — ${JSON.stringify(correction.body)}`).toBe(200)

  /* SON PROPRE PARC PART AVEC ELLE — elle en est seule propriétaire. Le parc
     commun, lui, survit grâce à Arsène. */
  await prisma.userAccount.update({
    where: { id: sonCompte.id },
    data: {
      closureRequestedAt: new Date(Date.now() - (DELAI_D_EFFACEMENT_JOURS + 1) * 86_400_000),
    },
  })

  return { cookieRestant, parkId, sonParc }
}

async function registreDe(cookie: string, parkId: string) {
  const vue = await request(serveur).get(`/api/parks/${parkId}/decisions`).set('Cookie', cookie)
  expect(vue.status, `registre illisible — ${JSON.stringify(vue.body)}`).toBe(200)
  return vue.body.decisions as { action: string; actor: string | null; actorGone?: boolean }[]
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('le nom de qui a agi survit à l’effacement du compte', () => {
  it('garde le nom, et dit que le compte est parti', async () => {
    const { cookieRestant, parkId } = await parcAvecUnPartant()

    const avant = await registreDe(cookieRestant, parkId)
    const creationAvant = avant.find((d) => d.action.startsWith('building.'))
    expect(creationAvant?.actor, 'la décision de Diane n’est pas au registre').toBe('Diane Fotso')
    expect(
      creationAvant?.actorGone,
      'le compte vit encore : rien ne doit le dire parti',
    ).toBeFalsy()

    await effacerLesComptesFermes()

    const apres = await registreDe(cookieRestant, parkId)
    const creation = apres.find((d) => d.action.startsWith('building.'))
    expect(creation, 'la décision a disparu avec son auteur').toBeDefined()
    expect(
      creation?.actor,
      'le nom s’est effacé avec le compte : le registre répond « personne » à « qui a fait ça ? »',
    ).toBe('Diane Fotso')
    expect(
      creation?.actorGone,
      'rien ne distingue un nom vivant d’un nom conservé : l’écran ne peut pas le dire',
    ).toBe(true)
  })

  it('ne fige aucun nom tant que le compte vit', async () => {
    /*
      SANS CE CAS, figer à CHAQUE écriture passerait le premier. Or une copie
      posée à l'écriture vieillit : quelqu'un qui change de nom renomme son
      compte, pas son passé, et le registre afficherait deux noms pour la même
      personne selon la date de la ligne.
    */
    const { parkId } = await parcAvecUnPartant()
    const fige = await prisma.auditEvent.count({
      where: { parkId, actorName: { not: null } },
    })
    expect(fige, 'un nom a été figé alors que le compte vit encore').toBe(0)
  })
})
