import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * `?mois=` NE BORNAIT QUE LES ÉCHÉANCES.
 *
 * Le paramètre existe depuis le lot du mois affiché, et la projection le
 * répandait sur UNE seule relation : `charges`. Les relevés l'ignoraient, si
 * bien que `periodeCourante` — « la dernière période relevée du parc » — était
 * la même quel que soit le mois demandé. L'écran des relevés promettait donc
 * « la quittance du mois » et « pour la période » au-dessus de données qu'aucun
 * paramètre ne pouvait déplacer.
 *
 * ═══ CE QUE CE FICHIER GARDE, ET QUE LA DÉMONSTRATION NE PEUT PAS PROUVER ═══
 *
 * Le sélecteur fonctionne côté client sans réseau — les index y sont tous
 * chargés — donc les quinze portes de navigateur voient bien la période
 * basculer. Mais elles ne voient QUE `/demo`. La moitié serveur, elle, n'a
 * aucun autre témoin que celui-ci.
 *
 * ═══ LA BORNE EST `lt`, ET C'EST TOUT LE PIÈGE ═══
 *
 * Borner à l'INTÉRIEUR du mois demandé emporterait l'ANTÉRIEUR. Or l'antérieur
 * n'est pas décoratif : c'est la soustraction des deux index qui fait la
 * consommation, donc le montant refacturé. Une fenêtre stricte rendrait
 * `previousIndex: null` sur toutes les lignes — plus une seule consommation,
 * plus un seul montant, l'écran entier vidé de ce qu'il sert à dire. Le second
 * cas tient exactement cette borne.
 */

const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`inscription sans cookie — ${res.status}`)
  return trouve
}

/** Un parc, un logement loué, et trois mois relevés : juin, juillet, août. */
async function parcAvecTroisMois() {
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

  const imm = await request(serveur)
    .post(`/api/parks/${parkId}/buildings`)
    .set('Cookie', cookie)
    .send({ name: 'Residence Djoumessi', district: 'Bastos' })
  const a1 = await request(serveur)
    .post(`/api/parks/${parkId}/buildings/${imm.body.building.id}/units`)
    .set('Cookie', cookie)
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 70000 })
  const unitId = a1.body.unit.id as string

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({
      unitId,
      fullName: 'Bekonoo Landry',
      phoneE164: '+237690000001',
      startsOn: '2026-01-01',
    })

  await request(serveur)
    .post(`/api/parks/${parkId}/tariffs`)
    .set('Cookie', cookie)
    .send({ utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-01-01' })

  /* Trois index qui montent : 100, 120, 145. Les écarts sont DIFFÉRENTS — 20
     puis 25 — pour qu'une période servie à la place d'une autre se voie dans la
     consommation et pas seulement dans l'index. */
  for (const [periode, index] of [
    ['2026-06-01', 100],
    ['2026-07-01', 120],
    ['2026-08-01', 145],
  ] as const) {
    await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/readings`)
      .set('Cookie', cookie)
      .send({ utility: 'water', periodStart: periode, indexValue: index, readAt: periode })
  }

  return { cookie, parkId }
}

interface LigneDeReleve {
  utility: string
  indexValue: number | null
  previousIndex: number | null
  periodStart: string | null
}

const eauDe = (corps: { readings: LigneDeReleve[] }): LigneDeReleve => {
  const eau = corps.readings.find((r) => r.utility === 'water')
  if (!eau) throw new Error('la réponse ne porte aucun relevé d’eau')
  return eau
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  serveur.close()
  await prisma.$disconnect()
})

describe('les relevés suivent le mois demandé', () => {
  it('sans `mois`, rend la dernière période relevée — comme avant', async () => {
    const { cookie, parkId } = await parcAvecTroisMois()
    const res = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)

    const eau = eauDe(res.body)
    expect(eau.indexValue, 'août est la dernière période relevée').toBe(145)
    expect(eau.previousIndex, 'et son antérieur est juillet').toBe(120)
  })

  it('avec `mois`, rend CETTE période — et son antérieur avec', async () => {
    const { cookie, parkId } = await parcAvecTroisMois()
    const res = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio?mois=2026-07`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)

    const eau = eauDe(res.body)
    expect(eau.indexValue, 'juillet est la période demandée').toBe(120)
    /*
      L'ANTÉRIEUR EST LA MOITIÉ QUI SE PERD. Une borne posée à l'intérieur du
      seul mois demandé rendrait `null` ici, et avec lui la consommation, et
      avec elle le montant refacturé — l'écran entier. La borne est donc `lt`
      sur la fin du mois, jamais la fenêtre du mois.
    */
    expect(eau.previousIndex, 'juin doit rester lisible pour faire la consommation').toBe(100)
  })

  it('rend la période retenue, pour que l’écran cesse de la deviner', async () => {
    const { cookie, parkId } = await parcAvecTroisMois()
    const res = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio?mois=2026-07`)
      .set('Cookie', cookie)

    /* Le client la JETAIT ; il la lit désormais pour étiqueter son sélecteur.
       Sans elle, l'écran ne peut nommer sa période qu'en la devinant — et
       « aujourd'hui » est faux dès qu'une tournée a du retard. */
    expect(eauDe(res.body).periodStart).toContain('2026-07')
  })

  it('un mois ANTÉRIEUR à tout relevé ne fabrique aucune consommation', async () => {
    const { cookie, parkId } = await parcAvecTroisMois()
    const res = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio?mois=2026-03`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)

    /* Rien n'est relevé avant juin : la réponse ne doit porter AUCUN relevé,
       plutôt qu'un index sans antérieur — que le client facturerait comme une
       consommation entière si la garde du `?? 0` venait à retomber. */
    const eaux = (res.body.readings as LigneDeReleve[]).filter((r) => r.utility === 'water')
    expect(eaux).toHaveLength(0)
  })
})
