import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * LE REGISTRE DES DÉCISIONS PERD DES LIGNES À LA FRONTIÈRE D'UNE PAGE.
 *
 * L'inventaire des paramètres de requête, demandé après celui de `?mois=`, a
 * trouvé quatre familles : le mois (une VUE, traitée), les jetons signés du
 * stockage (des CRÉANCES, gardées ailleurs), et `?avant=` — un CURSEUR de
 * pagination sur `/decisions`. Sa borne n'est pas un défaut, c'est sa raison
 * d'être. Mais un curseur porté par un SEUL champ a un piège connu, et
 * celui-ci le porte.
 *
 * ═══ LE PIÈGE, EN UNE PHRASE ═══
 *
 * Le curseur est `createdAt`, la page suivante demande `createdAt < curseur`,
 * et l'ordre est `createdAt desc`. Deux événements qui partagent la MÊME
 * milliseconde se retrouvent donc à cheval sur la frontière : le premier ferme
 * la page, et le second est écarté par le `<` strict. Il n'apparaît sur AUCUNE
 * page. Le registre ne dit pas qu'il manque quelque chose — il se termine
 * proprement, avec une ligne de moins.
 *
 * ═══ POURQUOI CE N'EST PAS THÉORIQUE ═══
 *
 * `createdAt` est daté par la base à la milliseconde. Deux décisions prises
 * dans la même seconde par deux gestionnaires d'un même cabinet, ou deux
 * requêtes concurrentes sur un parc actif, suffisent. Le registre des
 * décisions est précisément l'écran qu'on ouvre pour savoir QUI a fait QUOI :
 * une ligne qui s'évapore y est le pire défaut possible, parce qu'elle
 * s'évapore sans trace.
 *
 * ═══ CE QUE LE CAS FABRIQUE ═══
 *
 * Cent un événements, dont les deux plus anciens partagent l'horodatage — donc
 * exactement à cheval sur la frontière des cent. On pagine jusqu'au bout et on
 * compte les identifiants DISTINCTS obtenus. Cent un existent ; le curseur d'un
 * seul champ en rend cent.
 */

const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'
const TAILLE = 100

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`inscription sans cookie — ${res.status}`)
  return trouve
}

/** Un parc, et `combien` décisions dont les DEUX plus anciennes sont ex æquo. */
async function parcAvecDecisions(combien: number) {
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
  const compte = await prisma.userAccount.findFirstOrThrow({ where: { email: 'proprio@example.com' } })

  const base = Date.UTC(2026, 8, 1, 12, 0, 0)
  const lignes = Array.from({ length: combien }, (_, i) => ({
    parkId,
    actorId: compte.id,
    action: 'test.decision',
    entity: 'Lease',
    /* `entityId` est un UUID en base — la colonne le refuse autrement, et
       c'est la base qui me l'a appris plutôt que le schéma. */
    entityId: randomUUID(),
    /*
      L'EX ÆQUO EST POSÉ À LA FRONTIÈRE, et pas ailleurs : c'est le seul
      endroit où il coûte quelque chose. Deux décisions qui partagent leur
      milliseconde au MILIEU d'une page se rendent toutes les deux — la page
      les contient. C'est la coupure qui perd.
    */
    createdAt: new Date(base - Math.min(i, combien - 2) * 60_000),
  }))
  await prisma.auditEvent.createMany({ data: lignes })

  return { cookie, parkId }
}

/** Parcourt tout le registre en suivant les curseurs, et rend les identifiants. */
async function toutLeRegistre(parkId: string, cookie: string): Promise<string[]> {
  const vus: string[] = []
  let curseur: string | null = null
  /* Une borne de sécurité : un curseur qui n'avancerait pas boucherait le cas
     plutôt que de le faire rougir, et une porte qui pend ne dit rien. */
  for (let page = 0; page < 10; page += 1) {
    const url = curseur
      ? `/api/parks/${parkId}/decisions?avant=${encodeURIComponent(curseur)}`
      : `/api/parks/${parkId}/decisions`
    const res: request.Response = await request(serveur).get(url).set('Cookie', cookie)
    expect(res.status).toBe(200)
    for (const d of res.body.decisions as { id: string }[]) vus.push(d.id)
    curseur = res.body.suivant as string | null
    if (!curseur) break
  }
  return vus
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('le curseur du registre des décisions', () => {
  it('rend TOUTES les décisions, même quand deux partagent leur horodatage', async () => {
    const combien = TAILLE + 1
    const { cookie, parkId } = await parcAvecDecisions(combien)

    const vus = await toutLeRegistre(parkId, cookie)
    expect(new Set(vus).size, 'aucune décision rendue deux fois').toBe(vus.length)
    expect(vus.length, 'le registre entier, sans trou à la frontière de page').toBe(combien)
  })

  it('ne boucle pas quand la dernière page est un ex æquo', async () => {
    /* LE DÉFAUT SYMÉTRIQUE de celui qu'on corrige, et il coûte plus cher : un
       curseur en `<=` rendrait bien toutes les lignes, puis REPRENDRAIT la
       même page indéfiniment. Le cas exige donc les deux à la fois — rien de
       perdu, rien de servi deux fois. */
    const { cookie, parkId } = await parcAvecDecisions(TAILLE + 1)
    const vus = await toutLeRegistre(parkId, cookie)
    expect(vus.length).toBeLessThanOrEqual(TAILLE + 1)
  })

  it('garde une page pleine quand rien n’est ex æquo', async () => {
    /* Le cas témoin : sans ex æquo, la pagination marchait déjà. Il tient que
       le correctif ne casse pas le chemin ordinaire. */
    const { cookie, parkId } = await parcAvecDecisions(5)
    const res = await request(serveur)
      .get(`/api/parks/${parkId}/decisions`)
      .set('Cookie', cookie)
    expect(res.body.decisions).toHaveLength(5)
    expect(res.body.suivant, 'cinq lignes tiennent en une page').toBeNull()
  })
})
