import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'

/**
 * L'ANNONCE PUBLIQUE : CE QUI SORT, ET CE QUI NE DOIT SURTOUT PAS SORTIR.
 *
 * ═══ POURQUOI CE FICHIER EST SURTOUT UNE GARDE DE FUITE ═══
 *
 * C'est la seule route de lecture du produit SANS authentification. Tout ce
 * qu'elle rend est public pour toujours : il n'y a pas de « on retirera plus
 * tard » quand un nom de candidat est passé par un lien partagé sur WhatsApp.
 *
 * LA GARDE PRINCIPALE EST DONC EXHAUSTIVE SUR LES CLÉS, et non une liste de
 * champs interdits. Une liste d'interdits ne voit pas le champ qu'on ajoutera
 * demain ; un jeu de clés EXACT refuse tout ajout non délibéré, y compris celui
 * qu'on ferait en remplaçant `CHAMPS_PUBLICS` par `CHAMPS_ANNONCE` « pour ne pas
 * dupliquer » — ce dernier embarque les candidats.
 *
 * ═══ LE SECOND SUJET : UN SEUL REFUS ═══
 *
 * 404 pour l'absente, le brouillon, la fermée et l'identifiant mal formé.
 * Distinguer ces cas ferait de la route un DÉTECTEUR de brouillons : on
 * apprendrait qu'un logement se libère, à une adresse qu'on connaît. Même règle
 * que `/api/access-requests`, qui « répond PAREIL que l'adresse existe ou non ».
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * LA CADENCE. Rien ne limite le nombre d'appels à cette route, parce que RIEN
 * ne la limite nulle part dans ce serveur — mesuré, et signalé à part. C'est
 * aussi la raison pour laquelle ce lot n'ouvre AUCUNE écriture publique : le
 * formulaire de candidature attend une limite.
 */
const app = createApp()
const serveur = app.listen(0)

/**
 * LES CLÉS EXACTES que le prospect reçoit. Toute entrée en plus ou en moins
 * fait rougir — c'est le point du fichier.
 */
const CLES_ATTENDUES = [
  'availableFrom',
  'buildingName',
  'currency',
  'depositMinor',
  'description',
  'district',
  'parkName',
  'rentMinor',
  'surfaceSqm',
  'unitLabel',
  'unitType',
].sort()

/** Un parc, un immeuble, un logement OCCUPÉ, et une annonce au statut voulu. */
async function annonce(statut: 'draft' | 'published' | 'closed') {
  const parc = await prisma.park.create({
    data: { name: 'Parc Bastos', countryCode: 'CM', currency: 'XAF' },
  })
  const immeuble = await prisma.building.create({
    data: { parkId: parc.id, name: 'Résidence Bonamoussadi', district: 'Bonamoussadi' },
  })
  const unite = await prisma.unit.create({
    data: {
      buildingId: immeuble.id,
      label: 'B7',
      type: 'T3',
      surfaceSqm: 72,
      baseRentMinor: 150000,
    },
  })
  /* UN LOCATAIRE ENCORE EN PLACE : un logement en vacance peut être occupé
     jusqu'au départ, et son nom ne doit pas partir avec l'annonce. Sans lui, la
     garde de fuite passerait sur une base qui n'a personne à divulguer. */
  const locataire = await prisma.tenant.create({
    data: { parkId: parc.id, fullName: 'Serge Mbarga', email: 'serge@example.com' },
  })
  await prisma.lease.create({
    data: {
      unitId: unite.id,
      tenantId: locataire.id,
      startsOn: new Date('2026-01-01T00:00:00.000Z'),
      rentMinor: 150000,
      status: 'active',
    },
  })

  const ligne = await prisma.listing.create({
    data: {
      unitId: unite.id,
      rentMinor: 160000,
      depositMinor: 320000,
      currency: 'XAF',
      availableFrom: new Date('2026-12-01T00:00:00.000Z'),
      description: 'Deux chambres, eau et courant séparés.',
      status: statut,
    },
  })
  /* UN CANDIDAT : c'est LA donnée que cette route ne doit jamais publier. Sans
     lui, la garde exhaustive passerait sur une annonce qui n'a personne à
     trahir — le cas négatif vert à vide que ce dépôt connaît. */
  await prisma.applicant.create({
    data: {
      listingId: ligne.id,
      fullName: 'Awa Diallo',
      phoneE164: '+237600000000',
      email: 'awa@example.com',
      status: 'received',
      appliedOn: new Date('2026-10-01T00:00:00.000Z'),
    },
  })
  return { listingId: ligne.id, parkId: parc.id, unitId: unite.id }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('ce qui sort', () => {
  it('SERT UNE ANNONCE PUBLIÉE sans aucun compte', async () => {
    const { listingId } = await annonce('published')
    /* AUCUN COOKIE : c'est tout l'objet de la route, et le mettre en évidence
       ici évite qu'on la croie protégée par la session du test. */
    const vu = await request(serveur).get(`/api/annonces/${listingId}`)
    expect(vu.status, JSON.stringify(vu.body)).toBe(200)
    expect(vu.body.rentMinor).toBe(160000)
    expect(vu.body.depositMinor).toBe(320000)
    expect(vu.body.availableFrom).toBe('2026-12-01')
    expect(vu.body.unitLabel).toBe('B7')
    expect(vu.body.district).toBe('Bonamoussadi')
    expect(vu.body.parkName, 'une annonce anonyme ne se croit pas').toBe('Parc Bastos')
  })

  it('NE REND QUE LES ONZE CLÉS PRÉVUES, ni une de plus', async () => {
    /*
      LA GARDE QUI PORTE LE LOT. Exhaustive par construction : elle refuse tout
      champ ajouté sans décision, et en particulier le remplacement de
      `CHAMPS_PUBLICS` par `CHAMPS_ANNONCE` — qui embarque les candidats — que
      quelqu'un ferait un jour « pour ne pas dupliquer un select ».

      Une liste de champs INTERDITS n'aurait pas cette propriété : elle ne voit
      pas ce qu'on inventera.
    */
    const { listingId } = await annonce('published')
    const vu = await request(serveur).get(`/api/annonces/${listingId}`)
    expect(Object.keys(vu.body).sort()).toEqual(CLES_ATTENDUES)
  })

  it('NE LAISSE FUIR NI CANDIDAT, NI LOCATAIRE, NI IDENTIFIANT INTERNE', async () => {
    /*
      LA MÊME RÈGLE, DITE SUR LE CORPS SÉRIALISÉ. Le cas précédent garde les
      clés de PREMIER niveau ; celui-ci cherche les valeurs n'importe où, y
      compris dans un objet imbriqué qu'un futur champ introduirait.

      Les trois noms sont ceux du fixture, et chacun désigne une fuite d'une
      nature différente : une personne qui a postulé, une personne qui habite
      encore, et une clé à essayer sur les routes authentifiées.
    */
    const { listingId, parkId, unitId } = await annonce('published')
    const vu = await request(serveur).get(`/api/annonces/${listingId}`)
    const corps = JSON.stringify(vu.body)

    expect(corps, 'un candidat').not.toContain('Awa Diallo')
    expect(corps, 'son téléphone').not.toContain('+237600000000')
    expect(corps, 'son courriel').not.toContain('awa@example.com')
    expect(corps, 'le locataire encore en place').not.toContain('Serge Mbarga')
    expect(corps, 'l’identifiant du parc').not.toContain(parkId)
    expect(corps, 'celui du logement').not.toContain(unitId)
  })
})

describe('le refus, et il est unique', () => {
  it('REFUSE UN BROUILLON comme une absente', async () => {
    /*
      LE CŒUR DE LA RÈGLE. Un 403, un 404 avec un autre corps, ou même un délai
      différent apprendrait qu'une annonce EXISTE sans être publiée — donc qu'un
      logement se libère, à une adresse que le curieux connaît déjà.
    */
    const { listingId } = await annonce('draft')
    const brouillon = await request(serveur).get(`/api/annonces/${listingId}`)
    const absente = await request(serveur).get(
      '/api/annonces/00000000-0000-4000-8000-000000000000',
    )
    expect(brouillon.status).toBe(404)
    expect(brouillon.body).toEqual(absente.body)
  })

  it('REFUSE UNE ANNONCE FERMÉE, qui a pourtant été publiée', async () => {
    /* Le logement est reloué. L'annonce RESTE en base — c'est elle qui dit à
       quel prix on avait demandé — mais elle ne se lit plus du dehors. */
    const { listingId } = await annonce('closed')
    expect((await request(serveur).get(`/api/annonces/${listingId}`)).status).toBe(404)
  })

  it('REFUSE UN IDENTIFIANT MAL FORMÉ par le même 404', async () => {
    /* 422 aurait appris au curieux qu'il a au moins la bonne forme. Il ne peut
       désigner aucune annonce : le refus est le même. */
    const malForme = await request(serveur).get('/api/annonces/pas-un-uuid')
    const absente = await request(serveur).get(
      '/api/annonces/00000000-0000-4000-8000-000000000000',
    )
    expect(malForme.status).toBe(404)
    expect(malForme.body).toEqual(absente.body)
  })
})
