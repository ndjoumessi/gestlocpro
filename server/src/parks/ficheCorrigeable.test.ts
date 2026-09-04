import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * UNE FICHE LOCATAIRE SE CORRIGE.
 *
 * ═══ CE QUE SON ABSENCE COÛTAIT, ET C'EST VISIBLE EN PRODUCTION ═══
 *
 * Le serveur savait CRÉER une fiche, la SUPPRIMER, lui relier et lui délier un
 * compte. Il ne savait pas la MODIFIER : ni `PATCH`, ni `PUT`. Une faute de
 * frappe dans un nom, un numéro mal saisi, et le seul chemin offert était de
 * supprimer la fiche pour la recréer — ce qui emporte le BAIL, donc l'ancienneté,
 * les échéances et l'historique. Et ce chemin-là se referme dès le premier
 * versement : la suppression rend 409 « has_payments ».
 *
 * Autrement dit : passé le premier loyer encaissé, une faute de frappe était
 * DÉFINITIVE.
 *
 * ═══ LE CAS QUI L'A FAIT ÉCRIRE ═══
 *
 * Capture de la production, écran « Locataires et baux » : la colonne Contact
 * porte `+23760000001`. C'est exactement le numéro que `src/features/auth/
 * validation.ts` documente comme impossible — « huit chiffres, ce n'est pas un
 * numéro camerounais ; il partait, et se retrouvait dans la colonne Contact sous
 * une forme qu'aucun téléphone n'appellera jamais ». La garde de saisie existe
 * désormais à la création ; elle ne pouvait rien pour les fiches DÉJÀ écrites.
 *
 * ═══ CE QUE CETTE ROUTE NE FAIT PAS ═══
 *
 * Elle ne touche NI au bail, NI au compte. Changer le loyer ou le logement
 * déplace de l'argent et se fait là où cet argent se lit ; relier un compte est
 * le geste du registre des accès, et il porte ses propres refus. Cette route
 * corrige une IDENTITÉ — comment cette personne s'appelle et à quel numéro on
 * la joint — et rien d'autre.
 *
 * `email` en est absent : la colonne existe au schéma, mais AUCUNE création ne
 * l'écrit. Ouvrir ici un champ que rien d'autre ne remplit inventerait une
 * donnée à moitié tenue.
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

/** Un parc, un logement, une fiche — et le numéro impossible de la production. */
async function parcAvecUneFiche(email = 'proprio@example.com') {
  const proprio = await request(serveur).post('/api/auth/signup').send({
    email,
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
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })

  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId: a1.body.unit.id, fullName: 'Bekonoo Landry', phoneE164: '+23760000001' })

  const fiche = await prisma.tenant.findFirstOrThrow({ where: { parkId } })
  return { cookie, parkId, tenantId: fiche.id }
}

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

describe('corriger une fiche locataire', () => {
  it('corrige le nom ET le numéro', async () => {
    const { cookie, parkId, tenantId } = await parcAvecUneFiche()

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)
      .send({ fullName: 'Bekono Landry', phoneE164: '+237677111111' })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const apres = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    expect(apres.fullName).toBe('Bekono Landry')
    expect(apres.phoneE164).toBe('+237677111111')
  })

  it('efface un numéro par la chaîne vide, sans effacer le nom', async () => {
    /* Un numéro FAUX vaut moins que pas de numéro : le produit dit alors « pas
       de contact » au lieu d'en promettre un qui ne sonne pas. Le distinguer de
       « champ non transmis » demande une valeur explicite, et c'est la chaîne
       vide — `undefined` ne touche à rien. */
    const { cookie, parkId, tenantId } = await parcAvecUneFiche()

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)
      .send({ phoneE164: '' })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const apres = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    expect(apres.phoneE164).toBeNull()
    expect(apres.fullName, 'un champ non transmis ne se vide pas').toBe('Bekonoo Landry')
  })

  it('refuse un numéro qui n’est pas au format international', async () => {
    const { cookie, parkId, tenantId } = await parcAvecUneFiche()

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)
      .send({ phoneE164: '677111111' })

    /* 400 ET NON 422 : c'est la convention du dépôt pour tout refus de FORME —
       `app.ts` traduit chaque `ZodError` en 400 et nomme les champs fautifs, pour
       que le client rattache l'erreur au bon champ. Le 422 est réservé aux refus
       de FOND, comme la quittance datée en avant. J'attendais 422 ; c'est la
       mesure qui a tranché. */
    expect(res.status).toBe(400)
    expect(res.body.fields?.[0]?.path).toBe('phoneE164')
    const apres = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    expect(apres.phoneE164, 'un refus n’écrit rien').toBe('+23760000001')
  })

  it('cache la fiche d’un AUTRE parc derrière un 404', async () => {
    /* Le cloisonnement se fait en CLAUSE DE REQUÊTE, jamais après lecture : un
       403 sur un identifiant valide dirait déjà que la fiche existe ailleurs. */
    const mien = await parcAvecUneFiche('proprio@example.com')
    const autre = await parcAvecUneFiche('voisin@example.com')

    const res = await request(serveur)
      .patch(`/api/parks/${mien.parkId}/tenants/${autre.tenantId}`)
      .set('Cookie', mien.cookie)
      .send({ fullName: 'Intrus' })

    expect(res.status).toBe(404)
    const intacte = await prisma.tenant.findUniqueOrThrow({ where: { id: autre.tenantId } })
    expect(intacte.fullName).toBe('Bekonoo Landry')
  })

  it('consigne la correction, avec l’AVANT et l’APRÈS', async () => {
    /* Un registre qui ne dit que le nouveau nom ne permet pas de retrouver la
       fiche dont on parle : « la fiche s'appelle maintenant X » n'apprend rien
       à qui cherche ce qu'elle valait. */
    const { cookie, parkId, tenantId } = await parcAvecUneFiche()

    await request(serveur)
      .patch(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)
      .send({ fullName: 'Bekono Landry' })

    const trace = await prisma.auditEvent.findFirst({
      where: { parkId, action: 'tenant.update' },
      orderBy: { createdAt: 'desc' },
    })
    expect(trace, 'aucune trace de la correction').not.toBeNull()
    expect(trace?.payload).toMatchObject({
      fullName: 'Bekono Landry',
      avant: { fullName: 'Bekonoo Landry' },
    })
  })

  it('ne trace RIEN quand la correction ne change rien', async () => {
    /* Rouvrir la modale et refermer sans rien toucher n'est pas une décision.
       Un registre qui compte les non-gestes noie ceux qui comptent. */
    const { cookie, parkId, tenantId } = await parcAvecUneFiche()

    await request(serveur)
      .patch(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)
      .send({ fullName: 'Bekonoo Landry', phoneE164: '+23760000001' })

    expect(await prisma.auditEvent.count({ where: { parkId, action: 'tenant.update' } })).toBe(0)
  })
})
