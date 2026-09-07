import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { prisma } from './db.js'
import { NOM_COOKIE } from './auth/session.js'
import { installerArretPropre } from './arretPropre.js'

/**
 * LES TRANSACTIONS QUI COMPTENT VRAIMENT, ET LE BUDGET QU'ELLES CONSOMMENT.
 *
 * Le lot précédent a mesuré qu'une transaction survit au signal, et s'est fermé
 * sur sa limite : « la transaction du cas est une écriture SIMPLE, une ligne
 * dans une table. Les transactions qui comptent vraiment dans ce produit —
 * l'arbitrage d'une caution, l'appel de loyers — en écrivent plusieurs et
 * touchent des relations. Rien ne suggère qu'elles se comportent autrement ;
 * mais je ne l'ai pas mesuré, et "rien ne suggère" est exactement le genre de
 * phrase que ces lots ont passé leur temps à remplacer par une mesure. »
 *
 * ═══ DEUX QUESTIONS, ET LA SECONDE EST CELLE QUI POUVAIT MAL TOURNER ═══
 *
 * 1. UNE TRANSACTION À PLUSIEURS ÉCRITURES LIÉES survit-elle entière ? La
 *    réponse tient à `serveur.close()` qui attend la réponse HTTP, donc elle ne
 *    dépend pas de la FORME de la transaction — mais c'est un raisonnement, et
 *    ce fichier l'observe sur trois tables et deux relations.
 *
 * 2. LA PLUS LOURDE TIENT-ELLE DANS LE BUDGET DE DIX SECONDES ? Celle-là
 *    pouvait mal tourner, et c'est la vraie raison de ce lot. L'appel de loyers
 *    écrit UNE LIGNE PAR BAIL : sa durée grandit avec le parc, là où toutes les
 *    autres sont bornées. Si elle dépassait le délai de grâce, une relève
 *    pendant un appel de loyers couperait la facturation d'un parc entier —
 *    et le lot qui a posé « dix secondes » ne l'avait jamais éprouvé.
 */

const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'
const BAUX = 120

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`inscription sans cookie — ${res.status}`)
  return trouve
}

/**
 * Un parc de `combien` baux, semé DIRECTEMENT en base.
 *
 * Par l'API, cent vingt baux demanderaient trois cent soixante requêtes et
 * feraient de ce cas une minute d'attente : on mesurerait la création, pas
 * l'appel de loyers. Le semis est donc direct ; ce qui est mesuré, lui, passe
 * par la vraie route.
 */
async function parcDeTaille(combien: number) {
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

  const immeuble = await prisma.building.create({
    data: { parkId, name: 'Residence Djoumessi', district: 'Bastos' },
  })
  for (let i = 0; i < combien; i += 1) {
    const unite = await prisma.unit.create({
      data: { buildingId: immeuble.id, label: `A${i}`, type: 'T2', surfaceSqm: 60, baseRentMinor: 70000 },
    })
    const locataire = await prisma.tenant.create({ data: { parkId, fullName: `Locataire ${i}` } })
    await prisma.lease.create({
      data: {
        unitId: unite.id,
        tenantId: locataire.id,
        startsOn: new Date(Date.UTC(2026, 0, 1)),
        rentMinor: 70000,
        status: 'active',
      },
    })
  }
  return { cookie, parkId }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('l’appel de loyers face au budget d’arrêt', () => {
  it('écrit une ligne par bail, et tient LARGEMENT dans les dix secondes', async () => {
    const { cookie, parkId } = await parcDeTaille(BAUX)

    const depart = Date.now()
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-09-01' })
    const duree = Date.now() - depart

    expect(res.status).toBe(200)
    const ecrites = await prisma.rentCharge.count()
    expect(ecrites, 'une échéance par bail').toBe(BAUX)

    /*
      LA MESURE QUI JUSTIFIE « DIX SECONDES ».

      C'est la SEULE transaction du produit dont la durée grandit avec le parc :
      toutes les autres écrivent un nombre borné de lignes. Si elle approchait
      le délai de grâce, une relève pendant un appel de loyers couperait la
      facturation d'un parc entier — et le nombre posé par le lot de l'arrêt
      propre serait un chiffre inventé.

      Le seuil est à UN CINQUIÈME du budget, pas à sa limite : un cas qui
      passerait à neuf secondes sur dix ne garderait rien du tout. Ce qu'on
      tient, c'est une MARGE, et une régression qui la mangerait — un N+1
      glissé dans la boucle — rougirait ici avant d'atteindre la production.
    */
    expect(
      duree,
      `l’appel de loyers sur ${BAUX} baux a pris ${duree} ms ; le budget d’arrêt est de 10 000 ms`,
    ).toBeLessThan(2_000)
  }, 120_000)
})

describe('une transaction à écritures multiples survit au signal', () => {
  it('valide les TROIS écritures liées, ou aucune', async () => {
    /*
      TROIS TABLES, DEUX RELATIONS — la forme des transactions qui comptent
      dans ce produit : l'arbitrage d'une caution écrit la caution et son
      journal, l'encaissement écrit l'échéance, le paiement et son journal.

      Ce qui est réel : la transaction, ses relations, et le code d'arrêt. La
      doublure est le serveur, comme dans le fichier voisin — aucune route de
      l'API ne dure assez pour qu'on glisse un signal en son milieu.
    */
    const proprio = await request(serveur).post('/api/auth/signup').send({
      email: 'multi@example.com',
      password: MDP,
      fullName: 'Djoumessi Nelson',
      acceptTerms: true,
      parkName: 'Parc Multi',
      countryCode: 'CM',
    })
    const cookie = cookieDe(proprio)
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = moi.body.memberships[0].parkId as string
    const compte = await prisma.userAccount.findFirstOrThrow({ where: { email: 'multi@example.com' } })

    const journal: string[] = []
    const sorties: number[] = []
    const marque = randomUUID()

    const doublure = createServer((_, reponse) => {
      journal.push('transaction ouverte')
      void prisma
        .$transaction(
          async (tx) => {
            const immeuble = await tx.building.create({
              data: { parkId, name: `Immeuble ${marque}`, district: 'Bastos' },
            })
            /* LA PAUSE EST ENTRE DEUX ÉCRITURES LIÉES : le signal arrive alors
               que l'immeuble est écrit et que le logement qui le référence ne
               l'est pas encore. C'est exactement l'état qu'une coupure rendrait
               incohérent — un immeuble sans ses logements. */
            await new Promise((suite) => setTimeout(suite, 300))
            await tx.unit.create({
              data: { buildingId: immeuble.id, label: 'Z1', type: 'T2', surfaceSqm: 60, baseRentMinor: 70000 },
            })
            await tx.auditEvent.create({
              data: {
                parkId,
                actorId: compte.id,
                action: 'test.multi',
                entity: 'Building',
                entityId: immeuble.id,
                payload: { marque },
              },
            })
          },
          { timeout: 20_000 },
        )
        .then(() => {
          journal.push('transaction validée')
          reponse.writeHead(200)
          reponse.end('TROIS')
        })
    })
    await new Promise<void>((pret) => doublure.listen(0, pret))
    const port = (doublure.address() as { port: number }).port

    installerArretPropre(doublure, {
      sortir: (code) => {
        journal.push(`fermeture (code ${code})`)
        sorties.push(code)
      },
      delaiDeGraceMs: 10_000,
    })

    const enVol = fetch(`http://127.0.0.1:${port}/`).then((r) => r.text())
    await new Promise<void>((ouverte) => {
      const guet = setInterval(() => {
        if (journal.includes('transaction ouverte')) {
          clearInterval(guet)
          ouverte()
        }
      }, 10)
    })
    process.emit('SIGTERM')

    expect(await enVol).toBe('TROIS')
    await new Promise<void>((ferme) => {
      const guet = setInterval(() => {
        if (sorties.length > 0) {
          clearInterval(guet)
          ferme()
        }
      }, 10)
    })
    expect(journal).toEqual(['transaction ouverte', 'transaction validée', 'fermeture (code 0)'])

    /*
      LES TROIS SONT LÀ, ET LA RELATION TIENT. Compter les lignes ne suffirait
      pas : on relit le logement PAR SON IMMEUBLE, ce qui exige que la clé
      étrangère pointe sur une ligne réellement validée.
    */
    const immeuble = await prisma.building.findFirstOrThrow({
      where: { name: `Immeuble ${marque}` },
      include: { units: true },
    })
    expect(immeuble.units, 'le logement lié à l’immeuble').toHaveLength(1)
    const trace = await prisma.auditEvent.findFirst({ where: { entityId: immeuble.id } })
    expect(trace, 'le journal de la décision').not.toBeNull()

    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
  }, 30_000)
})
