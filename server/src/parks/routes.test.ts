import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'

/**
 * Lecture du parc.
 *
 * Le cloisonnement était jusqu'ici un masquage de boutons et un filtre de
 * rendu : `RoleGuard` retirait des entrées de menu, et les écrans locataires
 * bornaient leurs données en mémoire. Rien de tout cela ne survit à une requête
 * forgée — et c'est exactement ce que ces cas envoient.
 */
const app = createApp()

const MDP = 'un-mot-de-passe-assez-long'

async function inscrire(email: string, options: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: MDP, fullName: 'Compte de test', acceptTerms: true, ...options })
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  return { res, cookie: liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))! }
}

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
})

describe('création du parc à l’inscription', () => {
  it('crée le parc nommé par l’assistant, que le client jetait', async () => {
    const { cookie } = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
    })

    const res = await request(app).get('/api/parks').set('Cookie', cookie)
    expect(res.body.parks).toHaveLength(1)
    expect(res.body.parks[0].name).toBe('Parc Bonamoussadi')
    expect(res.body.parks[0].role).toBe('owner')
    // La devise vient du pays : « CFA » du client n'est pas un code ISO, et il
    // n'existe pas de code commun aux deux zones franc.
    expect(res.body.parks[0].currency).toBe('XAF')
  })

  it('tranche entre les deux zones franc selon le pays', async () => {
    const { cookie } = await inscrire('dakar@example.com', {
      parkName: 'Parc Dakar',
      countryCode: 'SN',
    })
    const res = await request(app).get('/api/parks').set('Cookie', cookie)
    expect(res.body.parks[0].currency).toBe('XOF')
  })

  it('ne crée aucun parc pour qui rejoint celui d’un autre', async () => {
    // Un gestionnaire ou un locataire n'apporte pas de parc : il en rejoint un.
    const { cookie } = await inscrire('gestionnaire@example.com')
    const res = await request(app).get('/api/parks').set('Cookie', cookie)
    expect(res.body.parks).toEqual([])
  })
})

describe('parc semé', () => {
  let cookie: string

  beforeEach(async () => {
    cookie = (
      await inscrire('proprio@example.com', {
        parkName: 'Parc Bonamoussadi',
        countryCode: 'CM',
        seedDemo: true,
      })
    ).cookie
  })

  async function portefeuille(c = cookie) {
    const parcs = await request(app).get('/api/parks').set('Cookie', c)
    const id = parcs.body.parks[0].id
    return request(app).get(`/api/parks/${id}/portfolio`).set('Cookie', c)
  }

  it('rend trois immeubles et douze unités', async () => {
    const res = await portefeuille()
    expect(res.body.buildings).toHaveLength(3)
    expect(res.body.buildings.flatMap((b: { units: unknown[] }) => b.units)).toHaveLength(12)
  })

  it('calcule le statut au lieu de le stocker', async () => {
    const res = await portefeuille()
    interface UniteRendue {
      label: string
      status: string
      tenant: { fullName: string } | null
      paidMinor: number
      overdueDays: number | null
    }
    const unites: UniteRendue[] = res.body.buildings.flatMap(
      (b: { units: UniteRendue[] }) => b.units,
    )
    const parLabel = new Map(unites.map((u) => [u.label, u]))

    expect(parLabel.get('A1')?.status).toBe('paid')
    expect(parLabel.get('A3')?.status).toBe('overdue')
    expect(parLabel.get('A5')?.status).toBe('partial')
    // Sans bail : vacant, et le locataire vaut `null` — pas une chaîne.
    expect(parLabel.get('B4')?.status).toBe('vacant')
    expect(parLabel.get('B4')?.tenant).toBeNull()
  })

  it('rend le versement réellement encaissé, et non une part simulée', async () => {
    /**
     * C'est le défaut que cette entité corrige. L'écran Paiements calculait la
     * part réglée à 53 % du loyer — 39 750 pour A5 — pendant qu'une alerte
     * annonçait 40 000 pour le même versement. Deux chiffres pour un seul fait,
     * parce que le fait n'existait nulle part.
     */
    const res = await portefeuille()
    const a5 = res.body.buildings
      .flatMap((b: { units: Record<string, unknown>[] }) => b.units)
      .find((u: { label: string }) => u.label === 'A5')

    expect(a5.paidMinor).toBe(40000)
    expect(a5.paidMinor).not.toBe(Math.round(75000 * 0.53))
  })

  it('compte les jours de retard au lieu de les figer', async () => {
    // `overdueDays: 24` était écrit à la main et ne grandissait jamais. Ici la
    // seule donnée est l'échéance : le retard s'en déduit et vieillit seul.
    const res = await portefeuille()
    const a3 = res.body.buildings
      .flatMap((b: { units: Record<string, unknown>[] }) => b.units)
      .find((u: { label: string }) => u.label === 'A3')

    expect(a3.overdueDays).toBe(24)
  })
})

describe('cloisonnement', () => {
  it('cache le parc d’autrui derrière un 404, et non un 403', async () => {
    /**
     * Un 403 confirmerait l'existence de l'identifiant : il suffirait
     * d'énumérer pour cartographier les parcs des autres. « Vous n'avez pas le
     * droit » et « cela n'existe pas » doivent se ressembler vu du dehors.
     */
    const proprio = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    const parcs = await request(app).get('/api/parks').set('Cookie', proprio.cookie)
    const parkId = parcs.body.parks[0].id

    const intrus = await inscrire('intrus@example.com')
    const res = await request(app)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', intrus.cookie)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not_found' })
  })

  it('refuse une requête sans session', async () => {
    const res = await request(app).get('/api/parks')
    expect(res.status).toBe(401)
  })

  it('ne rend au locataire que les unités de ses baux', async () => {
    /**
     * Le cœur du sujet. Côté client, un locataire était borné par une constante
     * `CURRENT_TENANT_UNIT` et des filtres de rendu ; forger l'URL du parc
     * aurait tout rendu. Ici la clause est dans la requête, et la requête ne
     * PEUT pas ramener les baux des voisins.
     */
    const proprio = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    const parcs = await request(app).get('/api/parks').set('Cookie', proprio.cookie)
    const parkId = parcs.body.parks[0].id

    // Un compte locataire, rattaché au bail de Charles Ngassa.
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({
      data: { userId: compte.id, parkId, role: 'tenant' },
    })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })

    const res = await request(app)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', locataire.cookie)

    const unites: { label: string }[] = res.body.buildings.flatMap(
      (b: { units: { label: string }[] }) => b.units,
    )
    expect(unites.map((u) => u.label)).toEqual(['A1'])
    // Et rien des voisins ne traverse, pas même un nom.
    expect(JSON.stringify(res.body)).not.toContain('Serge Mbarga')
  })
})

/**
 * Mutations réservées.
 *
 * Valider un devis et arbitrer une caution sont les deux droits qui distinguent
 * le propriétaire du gestionnaire. Le client les appliquait par un
 * `canApprove = role === 'owner'` qui masquait un bouton — ce qui ne survit pas
 * à une requête forgée, et c'est ce que ces cas envoient.
 */
describe('droits d’arbitrage', () => {
  let parkId: string
  let proprio: string
  let gestionnaire: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(app).get('/api/parks').set('Cookie', proprio)
    parkId = parcs.body.parks[0].id

    const g = await inscrire('diane@example.com')
    gestionnaire = g.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({
      data: { userId: compte.id, parkId, role: 'manager' },
    })
  })

  async function devisAArbitrer() {
    const pf = await request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    return pf.body.works.find((w: { status: string }) => w.status === 'quoted')
  }

  it('refuse la validation d’un devis au gestionnaire', async () => {
    const devis = await devisAArbitrer()
    const res = await request(app)
      .patch(`/api/parks/${parkId}/works/${devis.id}/approve`)
      .set('Cookie', gestionnaire)

    expect(res.status).toBe(403)
    // Et rien n'a bougé : un refus qui laisse une trace n'est pas un refus.
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: devis.id } })
    expect(apres.status).toBe('quoted')
    expect(apres.approvedAt).toBeNull()
  })

  it('accepte du propriétaire, et fige le montant engagé', async () => {
    const devis = await devisAArbitrer()
    const res = await request(app)
      .patch(`/api/parks/${parkId}/works/${devis.id}/approve`)
      .set('Cookie', proprio)

    expect(res.status).toBe(200)
    expect(res.body.work.status).toBe('approved')
    // Le montant est retenu au moment de la décision : un devis révisé ensuite
    // ne doit pas réécrire ce qui a été engagé.
    expect(res.body.work.approvedAmountMinor).toBe(devis.quotedAmountMinor)
  })

  it('refuse de valider deux fois', async () => {
    const devis = await devisAArbitrer()
    await request(app)
      .patch(`/api/parks/${parkId}/works/${devis.id}/approve`)
      .set('Cookie', proprio)
      .expect(200)
    // Le second appel écraserait la date et l'auteur du premier.
    await request(app)
      .patch(`/api/parks/${parkId}/works/${devis.id}/approve`)
      .set('Cookie', proprio)
      .expect(409)
  })

  it('exige la justification d’une retenue', async () => {
    /**
     * « Un décompte sans motif est indéfendable », dit le commentaire de la
     * modale — ce qui reste vrai quand la requête ne vient pas d'elle. La règle
     * était côté formulaire seulement, et `settleDeposit` jetait le texte.
     */
    const pf = await request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const caution = pf.body.deposits[0]

    await request(app)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: 45000 })
      .expect(400)

    const ok = await request(app)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: 45000, reason: 'Reprise de la peinture du séjour' })
      .expect(200)

    // Le seul texte qui défendrait la décision devant un locataire est
    // désormais conservé.
    expect(ok.body.deposit.withheldReason).toBe('Reprise de la peinture du séjour')
  })

  it('refuse une retenue supérieure à la caution', async () => {
    const pf = await request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const caution = pf.body.deposits[0]
    await request(app)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: caution.heldMinor + 1, reason: 'Trop, justement' })
      .expect(422)
  })

  it('laisse le gestionnaire créer une fiche locataire', async () => {
    // Il opère le parc au quotidien : c'est l'arbitrage qu'il n'a pas.
    const pf = await request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', gestionnaire)
    const vacante = pf.body.buildings
      .flatMap((b: { units: { id: string; status: string }[] }) => b.units)
      .find((u: { status: string }) => u.status === 'vacant')

    const res = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', gestionnaire)
      .send({ unitId: vacante.id, fullName: 'Awa Diallo', phoneE164: '+237688401277' })

    expect(res.status).toBe(201)
    expect(res.body.lease.status).toBe('pending')
  })

  it('refuse un second bail sur une unité déjà louée', async () => {
    /**
     * La règle vit dans un index unique partiel, et non dans le code : deux
     * requêtes simultanées liraient toutes deux « unité libre » avant que l'une
     * n'écrive. Ici on ne fait que traduire son refus.
     */
    const pf = await request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const occupee = pf.body.buildings
      .flatMap((b: { units: { id: string; status: string }[] }) => b.units)
      .find((u: { status: string }) => u.status === 'paid')

    const res = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({ unitId: occupee.id, fullName: 'Quelqu’un d’autre' })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'unit_already_leased' })
  })
})

/**
 * Relevés, états des lieux et notifications.
 *
 * Ils voyagent dans la même réponse que le parc, pour la raison déjà retenue :
 * des collections qui arrivent séparément afficheraient un parc à jour à côté
 * de relevés périmés. Et le cloisonnement du locataire vaut pour eux comme
 * pour le reste — c'est ce que ces cas vérifient.
 */
describe('terrain et notifications', () => {
  let parkId: string
  let proprio: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(app).get('/api/parks').set('Cookie', proprio)
    parkId = parcs.body.parks[0].id
  })

  const pf = (c: string) => request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', c)

  it('rend un index par unité ET par fluide', async () => {
    // Le client stockait un couple `previous`/`current` par unité : un
    // instantané, où l'index précédent était la copie d'une ligne qui aurait dû
    // exister. Ici une ligne par (unité, fluide, période) porte l'index, et la
    // consommation s'en dérive.
    const res = await pf(proprio)
    const eau = res.body.readings.filter((r: { utility: string }) => r.utility === 'water')
    const elec = res.body.readings.filter((r: { utility: string }) => r.utility === 'power')

    // Huit unités relevées sur dix : A5 et C2 ne le sont pas.
    expect(eau).toHaveLength(8)
    expect(elec).toHaveLength(8)
  })

  it('rend les états des lieux avec le compte de réserves et la signature', async () => {
    const res = await pf(proprio)
    expect(res.body.inspections.length).toBeGreaterThan(0)
    const nonSigne = res.body.inspections.find((i: { signedAt: string | null }) => i.signedAt === null)
    // `signed: boolean` ne disait ni qui ni quand : c'est pourtant le champ
    // qu'on oppose au locataire en cas de litige.
    expect(nonSigne).toBeDefined()
    expect(res.body.inspections.some((i: { issues: number }) => i.issues > 0)).toBe(true)
  })

  it('rend les notifications en clé et paramètres, jamais en phrases', async () => {
    const res = await pf(proprio)
    expect(res.body.notifications).toHaveLength(7)
    const retard = res.body.notifications.find(
      (n: { messageKey: string }) => n.messageKey === 'rentOverdue',
    )
    expect(retard.params.count).toBe(24)
    // Aucune phrase dans la donnée : le client en portait sept, chacune figeant
    // en plus une date au format numérique et un pluriel concaténé.
    expect(JSON.stringify(res.body.notifications)).not.toContain('en retard de')
  })

  it('porte l’état « lu » par destinataire', async () => {
    // Le client le tenait dans un `Set` de session, invisible de la barre
    // latérale : la pastille annonçait « 2 » même après tout avoir marqué lu.
    const res = await pf(proprio)
    expect(res.body.notifications.filter((n: { read: boolean }) => !n.read)).toHaveLength(2)
  })

  it('borne le locataire sur ses seules unités, terrain compris', async () => {
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })

    const res = await pf(locataire.cookie)
    const sonUnite = res.body.buildings.flatMap((b: { units: { id: string }[] }) => b.units)[0].id

    // Un fluide par relevé, une seule unité : deux lignes.
    expect(res.body.readings).toHaveLength(2)
    expect(res.body.readings.every((r: { unitId: string }) => r.unitId === sonUnite)).toBe(true)
    expect(res.body.inspections.every((i: { unitId: string }) => i.unitId === sonUnite)).toBe(true)
    // Une notification sans unité — « 2 relevés manquants » — ne le regarde
    // pas : elle s'adresse à qui gère le parc.
    expect(
      res.body.notifications.every((n: { unitId: string | null }) => n.unitId === sonUnite),
    ).toBe(true)
  })
})
