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

    // Dix lignes : chaque unité a une ligne par fluide pour la période
    // courante, même quand elle n'a PAS été relevée — c'est ce manque que
    // l'écran doit montrer.
    expect(eau).toHaveLength(10)
    expect(elec).toHaveLength(10)
    // Huit relevées, deux non : A5 et C2.
    expect(eau.filter((r: { indexValue: number | null }) => r.indexValue !== null)).toHaveLength(8)
    // L'index précédent est dérivé de la période antérieure, non recopié.
    expect(eau.every((r: { previousIndex: number | null }) => r.previousIndex !== null)).toBe(true)
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

    // Deux fluides pour une seule unité : deux lignes.
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

describe('saisie des immeubles', () => {
  /**
   * La première pierre de la saisie.
   *
   * Jusqu'ici un propriétaire pouvait créer son compte et n'en rien faire :
   * indicateurs, encaissements, relevés, cautions et travaux opéraient tous sur
   * un parc qu'aucune route ne permettait de constituer. La démonstration en
   * montrait un rempli ; le produit ne savait pas le remplir.
   */
  it('crée un immeuble dans le parc du propriétaire', async () => {
    const { cookie } = await inscrire('batisseur@example.com', { parkName: 'Parc Makepe' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id

    const res = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.building).toMatchObject({ name: 'Résidence Makepe', district: 'Makepe' })

    // Et il ressort du portefeuille : créer sans que l'écran le voie ne
    // servirait à rien.
    const portefeuille = await request(app)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    expect(portefeuille.body.buildings.map((b: { name: string }) => b.name)).toContain(
      'Résidence Makepe',
    )
  })

  it('refuse un nom ou un quartier trop court, en nommant le champ', async () => {
    const { cookie } = await inscrire('court@example.com', { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id

    const res = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'A', district: 'Makepe' })

    expect(res.status).toBe(400)
    expect(res.body.fields?.[0]?.path).toBe('name')
  })

  it('accepte deux immeubles de même nom dans deux quartiers', async () => {
    // Refuser sur cette base ferait perdre du temps à celui qui a raison : deux
    // « Résidence Les Palmiers » dans deux quartiers, cela existe.
    const { cookie } = await inscrire('homonyme@example.com', { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id

    const corps = { name: 'Les Palmiers', district: 'Bonapriso' }
    const un = await request(app).post(`/api/parks/${parkId}/buildings`).set('Cookie', cookie).send(corps)
    const deux = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ ...corps, district: 'Deïdo' })

    expect(un.status).toBe(201)
    expect(deux.status).toBe(201)
  })

  it('refuse un compte qui n’appartient pas au parc, en 404 et non en 403', async () => {
    // 403 confirmerait l'existence du parc à qui l'a deviné.
    const { cookie: proprio } = await inscrire('chez-moi@example.com', { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', proprio)
    const parkId = parcs.body.parks[0].id

    const { cookie: etranger } = await inscrire('etranger@example.com')
    const res = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', etranger)
      .send({ name: 'Résidence', district: 'Ailleurs' })

    expect(res.status).toBe(404)
  })
})

describe('saisie des logements', () => {
  async function parcAvecImmeuble(email: string) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id
    const immeuble = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    return { cookie, parkId, buildingId: immeuble.body.building.id as string }
  }

  it('crée un logement, et le portefeuille le rend', async () => {
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('logements@example.com')

    const res = await request(app)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.unit).toMatchObject({ label: 'A1', type: 'T3', surfaceSqm: 78 })

    const portefeuille = await request(app)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    const unites = portefeuille.body.buildings.flatMap((b: { units: unknown[] }) => b.units)
    expect(unites).toHaveLength(1)
    // Vacant, et non « à jour » : aucun bail n'existe encore. Marquer un
    // logement occupé fausserait le taux d'occupation dès sa création.
    expect(unites[0]).toMatchObject({ label: 'A1', tenant: null, status: 'vacant' })
  })

  it('refuse deux fois le même numéro dans le même immeuble, en 409', async () => {
    /**
     * 409 et non 400 : la saisie est bien formée, c'est l'état du parc qui s'y
     * oppose. L'écran doit pouvoir distinguer « corrigez votre saisie » de « ce
     * numéro est déjà pris » — deux gestes différents pour l'utilisateur.
     *
     * Deux « A1 » indiscernables dans un immeuble feraient encaisser sur le
     * mauvais logement.
     */
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('doublon@example.com')
    const corps = { label: 'A1', type: 'T2', surfaceSqm: 54, baseRentMinor: 110000 }

    const un = await request(app)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send(corps)
    const deux = await request(app)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send(corps)

    expect(un.status).toBe(201)
    expect(deux.status).toBe(409)
    expect(deux.body.error).toBe('label_taken')
  })

  it('accepte le même numéro dans deux immeubles différents', async () => {
    // « A1 » existe dans presque tous les immeubles du monde : l'unicité est
    // locale à l'immeuble, jamais globale.
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('deux-immeubles@example.com')
    const autre = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Villa Deïdo', district: 'Deïdo' })

    const corps = { label: 'A1', type: 'T2', surfaceSqm: 54, baseRentMinor: 110000 }
    const un = await request(app)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send(corps)
    const deux = await request(app)
      .post(`/api/parks/${parkId}/buildings/${autre.body.building.id}/units`)
      .set('Cookie', cookie)
      .send(corps)

    expect(un.status).toBe(201)
    expect(deux.status).toBe(201)
  })

  it('refuse un immeuble qui n’est pas dans le parc, en 404', async () => {
    const { cookie, parkId } = await parcAvecImmeuble('mien@example.com')
    const { buildingId: ailleurs } = await parcAvecImmeuble('sien@example.com')

    const res = await request(app)
      .post(`/api/parks/${parkId}/buildings/${ailleurs}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T1', surfaceSqm: 30, baseRentMinor: 50000 })

    expect(res.status).toBe(404)
  })
})

describe('saisie du bail', () => {
  async function parcAvecLogement(email: string) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id
    const immeuble = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(app)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    return { cookie, parkId, unitId: logement.body.unit.id as string }
  }

  it('retient la date de début saisie, sans la décaler d’un jour', async () => {
    /**
     * Le cas de TOUT nouveau compte : déclarer des locataires déjà en place.
     *
     * La route posait systématiquement la date du jour, donc l'ancienneté et
     * les impayés cumulés étaient faux dès la saisie. Et la colonne est de type
     * `date` : une date construite à minuit LOCAL recule d'un jour pour tout
     * fuseau à l'est de Greenwich — un défaut qui ne se voit pas depuis Douala
     * et se voit partout ailleurs.
     */
    const { cookie, parkId, unitId } = await parcAvecLogement('bail-date@example.com')

    const res = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2023-04-01' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const bail = await prisma.lease.findUniqueOrThrow({ where: { id: res.body.lease.id } })
    expect(bail.startsOn.toISOString().slice(0, 10)).toBe('2023-04-01')
  })

  it('retient le loyer du contrat quand il diffère du loyer de référence', async () => {
    // Loyer négocié, ancien bail non revalorisé, meublé : le montant dû est
    // celui du contrat. Le loyer de référence propose, il ne décide pas.
    const { cookie, parkId, unitId } = await parcAvecLogement('bail-loyer@example.com')

    const res = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Mireille Fotso', rentMinor: 120000 })

    const bail = await prisma.lease.findUniqueOrThrow({ where: { id: res.body.lease.id } })
    expect(bail.rentMinor).toBe(120000)
  })

  it('retombe sur le loyer de référence et sur aujourd’hui quand rien n’est saisi', async () => {
    // Un vrai emménagement du jour n'a rien à saisir : les deux champs restent
    // facultatifs, et le comportement d'origine est préservé.
    const { cookie, parkId, unitId } = await parcAvecLogement('bail-defaut@example.com')

    const res = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Serge Mbarga' })

    const bail = await prisma.lease.findUniqueOrThrow({ where: { id: res.body.lease.id } })
    expect(bail.rentMinor).toBe(145000)
    // La colonne est de type `date` : elle tronque à minuit UTC. Comparer à
    // « maintenant » échouerait toute la journée — on compare donc le JOUR,
    // qui est ce que la colonne prétend porter.
    expect(bail.startsOn.toISOString().slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
  })

  it('refuse une date mal formée en nommant le champ', async () => {
    const { cookie, parkId, unitId } = await parcAvecLogement('bail-mauvaise@example.com')

    const res = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Aline Tchoumi', startsOn: '01/04/2023' })

    expect(res.status).toBe(400)
    expect(res.body.fields?.[0]?.path).toBe('startsOn')
  })
})

describe('encaissements', () => {
  async function parcAvecBail(email: string) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id
    const immeuble = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(app)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const unitId = logement.body.unit.id as string
    await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01', rentMinor: 145000 })
    return { cookie, parkId, unitId }
  }

  it('enregistre le versement et crée l’échéance de la période', async () => {
    /**
     * L'écran affichait « Paiement enregistré · quittance envoyée » sans rien
     * écrire nulle part. C'est le mensonge le plus coûteux d'un logiciel de
     * gestion : le gestionnaire repart en croyant l'argent tracé, et l'impayé
     * réapparaît le mois suivant sans qu'on sache si le locataire a payé.
     */
    const { cookie, parkId, unitId } = await parcAvecBail('encaissement@example.com')

    const res = await request(app)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 145000, method: 'mobile' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const charge = await prisma.rentCharge.findFirstOrThrow({
      where: { periodStart: new Date('2026-07-01T00:00:00Z') },
      include: { payments: true },
    })
    // Loyer FIGÉ du bail : refacturer juillet au tarif d'août est faux.
    expect(charge.rentMinor).toBe(145000)
    expect(charge.payments).toHaveLength(1)
    expect(charge.payments[0]!.amountMinor).toBe(145000)
  })

  it('admet un versement partiel, et les cumule sur la même période', async () => {
    // Payer ce qu'on peut, quand on peut, est le cas COURANT. Interdire le
    // partiel forcerait à ne rien enregistrer, donc à perdre la trace.
    const { cookie, parkId, unitId } = await parcAvecBail('partiel@example.com')
    const corps = { unitId, periodStart: '2026-07-01', method: 'cash' as const }

    await request(app).post(`/api/parks/${parkId}/payments`).set('Cookie', cookie).send({ ...corps, amountMinor: 40000 })
    await request(app).post(`/api/parks/${parkId}/payments`).set('Cookie', cookie).send({ ...corps, amountMinor: 60000 })

    const charge = await prisma.rentCharge.findFirstOrThrow({
      where: { periodStart: new Date('2026-07-01T00:00:00Z') },
      include: { payments: true },
    })
    // UNE échéance, deux versements : la période n'est pas dupliquée.
    expect(charge.payments).toHaveLength(2)
    expect(charge.payments.reduce((t, p) => t + p.amountMinor, 0)).toBe(100000)
  })

  it('impute sur la période SAISIE, et non sur le mois du versement', async () => {
    // Un versement du 2 août peut couvrir juillet. Deviner la période
    // produirait des mois soldés à tort et des impayés fantômes.
    const { cookie, parkId, unitId } = await parcAvecBail('periode@example.com')

    await request(app)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 145000, method: 'transfer', paidOn: '2026-08-02' })

    const charge = await prisma.rentCharge.findFirstOrThrow({
      where: { periodStart: new Date('2026-07-01T00:00:00Z') },
      include: { payments: true },
    })
    expect(charge.payments[0]!.paidOn.toISOString().slice(0, 10)).toBe('2026-08-02')
  })

  it('refuse un montant nul ou négatif', async () => {
    const { cookie, parkId, unitId } = await parcAvecBail('montant@example.com')
    const res = await request(app)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 0, method: 'cash' })
    expect(res.status).toBe(400)
    expect(res.body.fields?.[0]?.path).toBe('amountMinor')
  })

  it('refuse un logement d’un autre parc, en 404', async () => {
    const { cookie, parkId } = await parcAvecBail('ici@example.com')
    const { unitId: ailleurs } = await parcAvecBail('la-bas@example.com')
    const res = await request(app)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId: ailleurs, periodStart: '2026-07-01', amountMinor: 1000, method: 'cash' })
    expect(res.status).toBe(404)
  })
})

describe('émission des quittances', () => {
  async function parcPaye(email: string, montant: number) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id
    const immeuble = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(app)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const unitId = logement.body.unit.id as string
    await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01', rentMinor: 145000 })
    if (montant > 0) {
      await request(app)
        .post(`/api/parks/${parkId}/payments`)
        .set('Cookie', cookie)
        .send({ unitId, periodStart: '2026-07-01', amountMinor: montant, method: 'mobile' })
    }
    return { cookie, parkId, unitId }
  }

  it('émet une QUITTANCE quand la période est intégralement soldée', async () => {
    const { cookie, parkId, unitId } = await parcPaye('quittance@example.com', 145000)

    const res = await request(app)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.document).toMatchObject({
      kind: 'quittance',
      tenant: 'Charles Ngassa',
      unit: 'A1',
      dueMinor: 145000,
      paidMinor: 145000,
      balanceMinor: 0,
    })
  })

  it('émet un REÇU, et non une quittance, sur un règlement partiel', async () => {
    /**
     * La règle qui gouverne tout le reste.
     *
     * Une quittance vaut preuve : le bailleur ne peut pas la reprendre.
     * L'émettre pour un mois non soldé lui ferait signer une preuve de paiement
     * qu'il n'a pas reçu. Le reçu, lui, n'atteste que le montant reçu.
     */
    const { cookie, parkId, unitId } = await parcPaye('recu@example.com', 60000)

    const res = await request(app)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(res.body.document.kind).toBe('recu')
    expect(res.body.document.paidMinor).toBe(60000)
    expect(res.body.document.balanceMinor).toBe(85000)
  })

  it('rend un solde NÉGATIF sur un trop-perçu, sans le ramener à zéro', async () => {
    // Le ramener à zéro effacerait une avance que le locataire pourra réclamer.
    const { cookie, parkId, unitId } = await parcPaye('avance@example.com', 200000)

    const res = await request(app)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(res.body.document.kind).toBe('quittance')
    expect(res.body.document.balanceMinor).toBe(-55000)
  })

  it('trace l’émission, avec son auteur', async () => {
    // Sert le jour où un locataire dit « je n'ai jamais reçu ma quittance de
    // mars ». La trace n'empêche pas la réémission : elle la consigne.
    const { cookie, parkId, unitId } = await parcPaye('trace@example.com', 145000)
    await request(app)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'receipt.issued' },
    })
    expect(trace.actorId).not.toBeNull()
    expect(trace.payload).toMatchObject({ kind: 'quittance', periodStart: '2026-07-01' })
  })

  it('refuse d’inventer un document pour une période sans échéance', async () => {
    // Un document vide laisserait croire à un mois traité.
    const { cookie, parkId, unitId } = await parcPaye('vide@example.com', 0)

    const res = await request(app)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-03-01' })

    expect(res.status).toBe(404)
  })
})

describe('codes d’invitation', () => {
  async function parcAvecCode(email: string, role: 'tenant' | 'manager' = 'manager') {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id
    const res = await request(app)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send({ role })
    return { cookie, parkId, code: res.body.code as string, res }
  }

  it('émet un code lisible, et n’en garde que l’empreinte', async () => {
    /**
     * Le modèle décrivait ces codes depuis l'origine et rien ne les écrivait :
     * l'assistant d'inscription en réclamait un, le validait, et il n'existait
     * aucun code valide à saisir.
     */
    const { code, res, parkId } = await parcAvecCode('emetteur@example.com')

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(code).toMatch(/^GES-[A-Z2-9]{4}-[A-Z2-9]{4}$/)

    const enBase = await prisma.invitation.findFirstOrThrow({ where: { parkId } })
    // Le code clair n'est stocké NULLE PART : une sauvegarde ou un journal ne
    // donnent accès à aucun parc.
    expect(enBase.codeHash).not.toBe(code)
    expect(JSON.stringify(enBase)).not.toContain(code)
    // L'indice suffit à reconnaître le code envoyé, pas à le rejouer.
    expect(code.endsWith(enBase.codeHint)).toBe(true)
  })

  it('fait rejoindre le parc avec le rôle de l’INVITATION, pas celui saisi', async () => {
    // Quelqu'un qui poste `role: 'owner'` n'obtient rien de plus que ce que le
    // propriétaire lui a accordé.
    const { parkId, code } = await parcAvecCode('inviteur@example.com', 'manager')

    const rejoint = await request(app).post('/api/auth/signup').send({
      email: 'invite@example.com',
      password: MDP,
      fullName: 'Diane Fotso',
      acceptTerms: true,
      invitationCode: code,
      role: 'owner',
    })
    expect(rejoint.status, JSON.stringify(rejoint.body)).toBe(201)

    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, user: { email: 'invite@example.com' } },
    })
    expect(adhesion.role).toBe('manager')
  })

  it('tolère la casse et les espaces, jamais le contenu', async () => {
    // Un code se recopie à la main : « ges-4a7b 92cd » est le même code.
    const { code } = await parcAvecCode('casse@example.com')
    const res = await request(app).post('/api/auth/signup').send({
      email: 'casse-invite@example.com',
      password: MDP,
      fullName: 'Test Casse',
      acceptTerms: true,
      invitationCode: ` ${code.toLowerCase()} `,
    })
    expect(res.status).toBe(201)
  })

  it('refuse un code déjà accepté, et de la même façon qu’un code inexistant', async () => {
    /**
     * Le même refus pour tous les cas — invalide, expiré, révoqué, déjà
     * accepté. Les distinguer dirait à qui essaie des codes au hasard lesquels
     * ont existé.
     */
    const { code } = await parcAvecCode('rejoue@example.com')
    await request(app).post('/api/auth/signup').send({
      email: 'premier@example.com', password: MDP, fullName: 'Premier', acceptTerms: true, invitationCode: code,
    })

    const second = await request(app).post('/api/auth/signup').send({
      email: 'second@example.com', password: MDP, fullName: 'Second', acceptTerms: true, invitationCode: code,
    })
    const inexistant = await request(app).post('/api/auth/signup').send({
      email: 'tiers@example.com', password: MDP, fullName: 'Tiers', acceptTerms: true, invitationCode: 'GES-ZZZZ-ZZZZ',
    })

    expect(second.status).toBe(400)
    expect(second.body).toEqual(inexistant.body)
  })

  it('refuse un code expiré', async () => {
    const { code, parkId } = await parcAvecCode('perime@example.com')
    await prisma.invitation.updateMany({
      where: { parkId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const res = await request(app).post('/api/auth/signup').send({
      email: 'tard@example.com', password: MDP, fullName: 'Tard', acceptTerms: true, invitationCode: code,
    })
    expect(res.status).toBe(400)
  })
})

describe('envoi du code par SMS', () => {
  it('n’annonce PAS un envoi quand aucun fournisseur n’est configuré', async () => {
    /**
     * Le cœur de la couture.
     *
     * L'adaptateur de journal n'envoie rien et le DIT — il rend `false`. Rendre
     * `true` aurait été plus simple et aurait produit exactement le mensonge
     * qu'on retire partout ailleurs : un succès affiché que rien ne recouvre.
     */
    const { cookie } = await inscrire('sansfournisseur@example.com', { parkName: 'Parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)

    const res = await request(app)
      .post(`/api/parks/${parcs.body.parks[0].id}/invitations`)
      .set('Cookie', cookie)
      .send({ role: 'tenant', phoneE164: '+237677214408' })

    expect(res.status).toBe(201)
    expect(res.body.envoye).toBe(false)
    // Et le code reste rendu : c'est lui qui compte, l'envoi n'est qu'un
    // confort.
    expect(res.body.code).toMatch(/^LOC-/)
  })

  it('émet quand même le code si l’envoi échoue', async () => {
    // Un code reste valable même si le SMS ne part pas : le propriétaire peut
    // le dicter. Refuser l'invitation perdrait le code au lieu de sauver le
    // message.
    const { remplacerMessagerie } = await import('../messagerie/messagerie.js')
    const restaurer = remplacerMessagerie({
      envoyerSms: async () => {
        throw new Error('fournisseur injoignable')
      },
    })
    try {
      const { cookie } = await inscrire('panne@example.com', { parkName: 'Parc' })
      const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
      const res = await request(app)
        .post(`/api/parks/${parcs.body.parks[0].id}/invitations`)
        .set('Cookie', cookie)
        .send({ role: 'tenant', phoneE164: '+237677214408' })

      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.envoye).toBe(false)
      expect(res.body.code).toMatch(/^LOC-/)
    } finally {
      restaurer()
    }
  })

  it('annonce l’envoi quand un fournisseur le confirme', async () => {
    const { remplacerMessagerie } = await import('../messagerie/messagerie.js')
    const envoyes: string[] = []
    const restaurer = remplacerMessagerie({
      envoyerSms: async (destinataire, texte) => {
        envoyes.push(`${destinataire}|${texte}`)
        return true
      },
    })
    try {
      const { cookie } = await inscrire('fournisseur@example.com', { parkName: 'Parc' })
      const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
      const res = await request(app)
        .post(`/api/parks/${parcs.body.parks[0].id}/invitations`)
        .set('Cookie', cookie)
        .send({ role: 'tenant', phoneE164: '+237677214408' })

      expect(res.body.envoye).toBe(true)
      expect(envoyes).toHaveLength(1)
      // Le message porte le code : c'est tout son objet.
      expect(envoyes[0]).toContain(res.body.code)
    } finally {
      restaurer()
    }
  })
})

/**
 * Défaire une création d'immeuble.
 *
 * Le nom n'est délibérément pas contraint à l'unicité — deux immeubles peuvent
 * légitimement porter le même dans deux quartiers. La contrepartie, c'est
 * qu'une saisie en double produit deux entrées rigoureusement indiscernables,
 * et qu'il n'existait aucun moyen d'en retirer une. Toute faute de frappe était
 * définitive.
 *
 * La garde porte sur le VIDE : un immeuble qui porte des logements porte aussi
 * des baux, des cautions et des encaissements, et rien ici ne doit pouvoir
 * emporter tout cela en cascade.
 */
describe('suppression d’un immeuble', () => {
  async function parcAvecImmeuble(email: string) {
    const { cookie } = await inscrire(email, { parkName: 'Parc Bastos', countryCode: 'CM' })
    const parcs = await request(app).get('/api/parks').set('Cookie', cookie)
    const parkId = parcs.body.parks[0].id
    const cree = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Residence Djoumessi', district: 'Bastos' })
    return { cookie, parkId, buildingId: cree.body.building.id as string }
  }

  it('retire un immeuble vide, et le parc ne le rend plus', async () => {
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('vide@example.com')

    const res = await request(app)
      .delete(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(204)

    const parc = await request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    expect(parc.body.buildings).toHaveLength(0)
  })

  it('refuse un immeuble qui porte des logements, sans rien détruire', async () => {
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('plein@example.com')
    await request(app)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      // `baseRentMinor` : le champ du contrat, que `rentMinor` — le nom rendu
      // par la LECTURE du parc — ne remplace pas. Une charge mal formée passait
      // en 400, l'immeuble restait vide, et la suppression avait alors raison
      // de réussir : le cas ne vérifiait rien.
      .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 20000 })

    const res = await request(app)
      .delete(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
    // 409 et non 400 : la requête est bien formée, c'est l'état du parc qui s'y
    // oppose. L'écran doit pouvoir dire quoi vider d'abord.
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('building_not_empty')

    const parc = await request(app).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    expect(parc.body.buildings).toHaveLength(1)
  })

  it('ne laisse pas supprimer l’immeuble d’un autre parc', async () => {
    const { buildingId } = await parcAvecImmeuble('proprio-a@example.com')
    const { cookie: cookieB } = await inscrire('proprio-b@example.com', {
      parkName: 'Parc B',
      countryCode: 'CM',
    })
    const parcsB = await request(app).get('/api/parks').set('Cookie', cookieB)
    const parkIdB = parcsB.body.parks[0].id

    const res = await request(app)
      .delete(`/api/parks/${parkIdB}/buildings/${buildingId}`)
      .set('Cookie', cookieB)
    // 404 et non 403 : un 403 confirmerait que cet immeuble existe ailleurs.
    expect(res.status).toBe(404)
  })
})

/**
 * Relance des loyers, et mise en demeure.
 *
 * La page de tarifs vend « Relances automatiques · SMS et e-mail déclenchés à
 * J+1, J+7, J+15 » depuis le premier jour, et aucune ligne de code n'en
 * produisait une. La démonstration en affichait pourtant — « relance partie
 * le … » — ce qui est le pire des deux mondes : la fonction est vendue, montrée,
 * et absente.
 *
 * Ces cas portent d'abord sur ce qu'une relance ne doit PAS faire. Relancer un
 * locataire à jour, ou le relancer deux fois le même matin, coûte plus cher que
 * ne pas le relancer du tout : le premier est une accusation fausse, le second
 * fait passer le bailleur pour un harceleur. C'est la raison d'être du champ
 * `Notification.channel`, dont le commentaire de schéma disait déjà tout.
 */
describe('relance des loyers', () => {
  let parkId: string
  let proprio: string
  let gestionnaire: string
  let leaseId: string

  /** Une échéance EXIGIBLE et impayée : c'est le seul cas relançable. */
  async function echeanceEnRetard(rentMinor = 145000) {
    const charge = await prisma.rentCharge.create({
      data: {
        leaseId,
        periodStart: new Date('2026-06-01T00:00:00Z'),
        dueOn: new Date('2026-06-05T00:00:00Z'),
        rentMinor,
      },
      select: { id: true },
    })
    return charge.id
  }

  beforeEach(async () => {
    const p = await inscrire('bailleur@example.com', { parkName: 'Parc' })
    proprio = p.cookie
    const parcs = await request(app).get('/api/parks').set('Cookie', proprio)
    parkId = parcs.body.parks[0].id

    const immeuble = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(app)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const bail = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({ unitId: logement.body.unit.id, fullName: 'Paul Kamga', startsOn: '2026-01-01' })
    leaseId = bail.body.lease.id

    const g = await inscrire('diane@example.com')
    gestionnaire = g.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
  })

  it('laisse une trace datée, sans prétendre avoir envoyé quoi que ce soit', async () => {
    await echeanceEnRetard()

    const res = await request(app)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.sent).toEqual([leaseId])

    const trace = await prisma.notification.findFirstOrThrow({
      where: { parkId, messageKey: 'notifications.rentReminder' },
    })
    expect(trace.channel).toBe('in_app')
    /**
     * `sentAt` NUL, et c'est le point.
     *
     * Rien n'est encore expédié — pas de SMS, pas d'e-mail. Poser une date
     * d'envoi par avance ferait mentir le dossier le jour où un locataire
     * contestera avoir été prévenu, ce qui est exactement le moment où cette
     * trace servira.
     */
    expect(trace.sentAt).toBeNull()
  })

  it('ne relance pas deux fois le même locataire dans la même journée', async () => {
    await echeanceEnRetard()
    await request(app)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    const second = await request(app)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    // 200 et non une erreur : l'appel est licite, il n'a simplement rien à
    // faire. Le corps le dit, plutôt que de laisser croire à un second envoi.
    expect(second.status).toBe(200)
    expect(second.body.sent).toEqual([])
    expect(second.body.skipped[0].reason).toBe('already_reminded_today')
    expect(await prisma.notification.count({ where: { parkId } })).toBe(1)
  })

  it('relance séparément deux baux successifs du même logement', async () => {
    /**
     * Ce cas a remplacé un test qui NE POUVAIT PAS échouer.
     *
     * Il citait deux fois le même bail pour éprouver une garde en mémoire —
     * mais `findMany` dédoublonne les identifiants, donc la boucle ne voyait
     * qu'une ligne et la garde n'était jamais atteinte. Le retirer du code ne
     * faisait pas tomber le test : c'est ainsi qu'il s'est dénoncé.
     *
     * En cherchant le cas qui l'atteindrait vraiment, le vrai défaut est
     * apparu : la garde du jour était posée sur le LOGEMENT. Un ancien
     * locataire parti en laissant des arriérés et celui qui l'a remplacé
     * partagent le même logement et sont deux personnes. Relancer l'un aurait
     * silencieusement avalé la relance de l'autre.
     */
    await echeanceEnRetard()

    const unite = await prisma.lease.findUniqueOrThrow({
      where: { id: leaseId },
      select: { unitId: true },
    })
    const ancien = await prisma.tenant.create({
      data: { parkId, fullName: 'Ancien locataire' },
      select: { id: true },
    })
    const bailClos = await prisma.lease.create({
      data: {
        unitId: unite.unitId,
        tenantId: ancien.id,
        startsOn: new Date('2025-01-01T00:00:00Z'),
        endsOn: new Date('2025-12-31T00:00:00Z'),
        rentMinor: 145000,
        status: 'ended',
        charges: {
          create: {
            periodStart: new Date('2025-11-01T00:00:00Z'),
            dueOn: new Date('2025-11-05T00:00:00Z'),
            rentMinor: 145000,
          },
        },
      },
      select: { id: true },
    })

    const res = await request(app)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId, bailClos.id] })

    // DEUX relances : deux locataires, deux dettes, même logement.
    expect(res.body.sent).toHaveLength(2)
    expect(await prisma.notification.count({ where: { parkId } })).toBe(2)
  })

  it('refuse de relancer un locataire à jour', async () => {
    const chargeId = await echeanceEnRetard()
    await prisma.payment.create({
      data: {
        chargeId,
        amountMinor: 145000,
        method: 'cash',
        paidOn: new Date('2026-06-04T00:00:00Z'),
        recordedById: (
          await prisma.userAccount.findUniqueOrThrow({ where: { email: 'bailleur@example.com' } })
        ).id,
      },
    })

    const res = await request(app)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    // Accuser à tort est le défaut le plus coûteux de cette route : le client
    // affiche « à jour » au même instant.
    expect(res.body.sent).toEqual([])
    expect(res.body.skipped[0].reason).toBe('nothing_due')
    expect(await prisma.notification.count({ where: { parkId } })).toBe(0)
  })

  it('refuse de relancer un bail dont rien n’est encore exigible', async () => {
    await prisma.rentCharge.create({
      data: {
        leaseId,
        periodStart: new Date('2099-01-01T00:00:00Z'),
        dueOn: new Date('2099-01-05T00:00:00Z'),
        rentMinor: 145000,
      },
    })

    const res = await request(app)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    // Les échéances futures ne sont pas même lues : le bail n'a rien d'exigible.
    expect(res.body.sent).toEqual([])
    expect(res.body.skipped[0].reason).toBe('nothing_due')
  })

  it('ignore le bail d’un autre parc sans dire qu’il existe', async () => {
    await echeanceEnRetard()
    const autre = await inscrire('voisin@example.com', { parkName: 'Autre parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', autre.cookie)

    const res = await request(app)
      .post(`/api/parks/${parcs.body.parks[0].id}/reminders`)
      .set('Cookie', autre.cookie)
      .send({ leaseIds: [leaseId] })

    // `not_found` et non `nothing_due` : la réponse ne doit pas renseigner sur
    // l'état d'un bail qui appartient à quelqu'un d'autre.
    expect(res.body.sent).toEqual([])
    expect(res.body.skipped[0].reason).toBe('not_found')
  })

  it('ouvre la relance au gestionnaire, dont c’est le métier quotidien', async () => {
    await echeanceEnRetard()

    const res = await request(app)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', gestionnaire)
      .send({ leaseIds: [leaseId] })

    expect(res.status).toBe(200)
    expect(res.body.sent).toEqual([leaseId])
  })
})

describe('mise en demeure', () => {
  let parkId: string
  let proprio: string
  let gestionnaire: string
  let leaseId: string

  const MOTIF = 'Trois échéances impayées malgré deux relances restées sans réponse.'

  beforeEach(async () => {
    const p = await inscrire('bailleur2@example.com', { parkName: 'Parc' })
    proprio = p.cookie
    const parcs = await request(app).get('/api/parks').set('Cookie', proprio)
    parkId = parcs.body.parks[0].id

    const immeuble = await request(app)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(app)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const bail = await request(app)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({ unitId: logement.body.unit.id, fullName: 'Paul Kamga', startsOn: '2026-01-01' })
    leaseId = bail.body.lease.id

    const g = await inscrire('diane2@example.com')
    gestionnaire = g.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane2@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
  })

  async function impaye() {
    await prisma.rentCharge.create({
      data: {
        leaseId,
        periodStart: new Date('2026-06-01T00:00:00Z'),
        dueOn: new Date('2026-06-05T00:00:00Z'),
        rentMinor: 145000,
      },
    })
  }

  it('trace la décision et le montant, des deux côtés', async () => {
    await impaye()

    const res = await request(app)
      .post(`/api/parks/${parkId}/leases/${leaseId}/formal-notice`)
      .set('Cookie', proprio)
      .send({ reason: MOTIF })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.formalNotice.dueMinor).toBe(145000)

    /**
     * Deux traces, et ce n'est pas une redondance : `AuditEvent` garde la pièce
     * du côté de qui a décidé — c'est elle qu'on produit — et `Notification` la
     * porte du côté du locataire, qui doit la voir.
     */
    const decision = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'lease.formal_notice' },
    })
    expect((decision.payload as { reason: string }).reason).toBe(MOTIF)
    // Le montant est FIGÉ : il sera contesté, et un montant recalculé plus tard
    // ne serait plus celui qui a été notifié.
    expect((decision.payload as { dueMinor: number }).dueMinor).toBe(145000)

    const avis = await prisma.notification.findFirstOrThrow({
      where: { parkId, messageKey: 'notifications.formalNotice' },
    })
    expect(avis.severity).toBe('high')
  })

  it('la refuse au gestionnaire, qui propose mais ne décide pas', async () => {
    await impaye()

    const res = await request(app)
      .post(`/api/parks/${parkId}/leases/${leaseId}/formal-notice`)
      .set('Cookie', gestionnaire)
      .send({ reason: MOTIF })

    expect(res.status).toBe(403)
    // Un refus qui laisse une trace n'est pas un refus.
    expect(await prisma.auditEvent.count({ where: { action: 'lease.formal_notice' } })).toBe(0)
  })

  it('la refuse quand rien n’est dû', async () => {
    const res = await request(app)
      .post(`/api/parks/${parkId}/leases/${leaseId}/formal-notice`)
      .set('Cookie', proprio)
      .send({ reason: MOTIF })

    // Mettre en demeure un locataire à jour n'est pas une maladresse
    // d'interface : c'est une faute, et elle est écrite.
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('nothing_due')
  })

  it('exige un motif, comme la retenue sur caution', async () => {
    await impaye()

    const res = await request(app)
      .post(`/api/parks/${parkId}/leases/${leaseId}/formal-notice`)
      .set('Cookie', proprio)
      // Six caractères. « trop court » en faisait dix — exactement le minimum,
      // donc accepté : le fixture disait le contraire de ce qu'il annonçait.
      .send({ reason: 'impayé' })

    expect(res.status).toBe(400)
    expect(await prisma.notification.count({ where: { parkId } })).toBe(0)
  })

  it('ne met pas en demeure sur le bail d’un autre parc', async () => {
    await impaye()
    const autre = await inscrire('voisin2@example.com', { parkName: 'Autre parc' })
    const parcs = await request(app).get('/api/parks').set('Cookie', autre.cookie)

    const res = await request(app)
      .post(`/api/parks/${parcs.body.parks[0].id}/leases/${leaseId}/formal-notice`)
      .set('Cookie', autre.cookie)
      .send({ reason: MOTIF })

    // 404 et non 403 : un 403 confirmerait que ce bail existe ailleurs.
    expect(res.status).toBe(404)
  })
})
