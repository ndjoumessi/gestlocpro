import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { remplacerMessagerie } from '../messagerie/messagerie.js'
import { remplacerStockage } from '../stockage/stockage.js'
import { StockageLocal } from '../stockage/local.js'
import { PLAFOND_PAR_OBJET_OCTETS } from '../stockage/contrat.js'
import { env } from '../env.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Lecture du parc.
 *
 * Le cloisonnement était jusqu'ici un masquage de boutons et un filtre de
 * rendu : `RoleGuard` retirait des entrées de menu, et les écrans locataires
 * bornaient leurs données en mémoire. Rien de tout cela ne survit à une requête
 * forgée — et c'est exactement ce que ces cas envoient.
 */
/**
 * UN serveur pour tout le fichier, et non un par requête.
 *
 * `request(serveur)` fait ouvrir à supertest un serveur éphémère, servir l'appel,
 * puis le refermer — soit cent quarante-huit ouvertures de port pour ce
 * fichier. Une exécution sur trois échouait, jamais au même endroit, sur des
 * requêtes du `beforeEach` : inscription rendant un 404 en HTML — donc émis par
 * autre chose que cette application, dont le 404 d'API est en JSON —, lecture
 * des parcs rendant un corps vide, erreurs d'analyse HTTP du client.
 *
 * Le mécanisme exact de la collision importe moins que sa cause : un port
 * éphémère par requête. Un serveur unique la retire entièrement.
 *
 * Le commentaire de `createApp` disait déjà l'intention — « les tests la montent
 * directement, sans ouvrir de port » — mais `request(serveur)` en ouvre un quand
 * même, à chaque appel. C'est supertest qui le fait, pas le test qui le demande.
 */
const app = createApp()
const serveur = app.listen(0)

const MDP = 'un-mot-de-passe-assez-long'

async function inscrire(email: string, options: Record<string, unknown> = {}) {
  const res = await request(serveur)
    .post('/api/auth/signup')
    .send({ email, password: MDP, fullName: 'Compte de test', acceptTerms: true, ...options })
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const cookie = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!cookie) {
    throw new Error(
      /**
       * Le message porte le STATUT, et c'est ce qui a permis de trouver.
       *
       * Le helper rendait `liste.find(…)!` — un cookie éventuellement absent,
       * affirmé présent par un `!`. L'échec ne se voyait donc pas ici mais trois
       * lignes plus loin, sous la forme « Invalid value "undefined" for header
       * "Cookie" », qui ne dit rien de l'inscription qui a échoué.
       */
      `inscription sans cookie — ${res.status} ${String(res.text).slice(0, 120)} (${email})`,
    )
  }
  return { res, cookie }
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

describe('création du parc à l’inscription', () => {
  it('crée le parc nommé par l’assistant, que le client jetait', async () => {
    const { cookie } = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
    })

    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.body.memberships).toHaveLength(1)
    expect(res.body.memberships[0].parkName).toBe('Parc Bonamoussadi')
    expect(res.body.memberships[0].role).toBe('owner')
    // La devise vient du pays : « CFA » du client n'est pas un code ISO, et il
    // n'existe pas de code commun aux deux zones franc.
    expect(res.body.memberships[0].currency).toBe('XAF')
  })

  it('tranche entre les deux zones franc selon le pays', async () => {
    const { cookie } = await inscrire('dakar@example.com', {
      parkName: 'Parc Dakar',
      countryCode: 'SN',
    })
    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.body.memberships[0].currency).toBe('XOF')
  })

  it('ne crée aucun parc pour qui rejoint celui d’un autre', async () => {
    // Un gestionnaire ou un locataire n'apporte pas de parc : il en rejoint un.
    const { cookie } = await inscrire('gestionnaire@example.com')
    const res = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    expect(res.body.memberships).toEqual([])
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', c)
    const id = parcs.body.memberships[0].parkId
    return request(serveur).get(`/api/parks/${id}/portfolio`).set('Cookie', c)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio.cookie)
    const parkId = parcs.body.memberships[0].parkId

    const intrus = await inscrire('intrus@example.com')
    const res = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', intrus.cookie)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not_found' })
  })

  it('refuse une requête sans session', async () => {
    const res = await request(serveur).get('/api/auth/me')
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio.cookie)
    const parkId = parcs.body.memberships[0].parkId

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

    const res = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', locataire.cookie)

    const unites: { label: string }[] = res.body.buildings.flatMap(
      (b: { units: { label: string }[] }) => b.units,
    )
    expect(unites.map((u) => u.label)).toEqual(['A1'])
    // Et rien des voisins ne traverse, pas même un nom.
    expect(JSON.stringify(res.body)).not.toContain('Serge Mbarga')
  })

  /**
   * La DATE DE DÉBUT du bail traverse jusqu'au client.
   *
   * Le bail la portait depuis toujours ; la réponse ne la transmettait pas.
   * Le client l'affiche — « bail en cours depuis le … », et il date les travaux
   * « depuis mon entrée le … » : sans elle, les deux phrases restaient amputées
   * pour tout compte réel, quand la démonstration les affichait entières.
   *
   * Le cas VACANT compte autant : une unité sans bail rend `null`, et non
   * l'absence du champ — le client distingue « pas de bail » de « serveur qui
   * ne sait pas », et la nuance décide s'il tait la phrase ou s'en inquiète.
   */
  it('transmet la date de début du bail, et `null` pour une unité vacante', async () => {
    const proprio = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio.cookie)
    const parkId = parcs.body.memberships[0].parkId

    const res = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', proprio.cookie)

    const unites: { label: string; tenant: unknown; leaseStartsOn: string | null }[] =
      res.body.buildings.flatMap((b: { units: unknown[] }) => b.units)

    const loue = unites.find((u) => u.tenant !== null)
    expect(loue, 'le jeu de démonstration doit contenir une unité louée').toBeDefined()
    expect(loue!.leaseStartsOn).toEqual(expect.any(String))
    // Une date, et non une chaîne quelconque : `Date` accepte n'importe quoi et
    // rend `Invalid Date`, que le client afficherait tel quel.
    expect(Number.isNaN(Date.parse(loue!.leaseStartsOn!))).toBe(false)

    const vacante = unites.find((u) => u.tenant === null)
    expect(vacante, 'le jeu de démonstration doit contenir une unité vacante').toBeDefined()
    expect(vacante!.leaseStartsOn).toBeNull()
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

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
    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    return pf.body.works.find((w: { status: string }) => w.status === 'quoted')
  }

  it('refuse la validation d’un devis au gestionnaire', async () => {
    const devis = await devisAArbitrer()
    const res = await request(serveur)
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
    const res = await request(serveur)
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
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${devis.id}/approve`)
      .set('Cookie', proprio)
      .expect(200)
    // Le second appel écraserait la date et l'auteur du premier.
    await request(serveur)
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
    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const caution = pf.body.deposits[0]

    await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: 45000 })
      .expect(400)

    const ok = await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: 45000, reason: 'Reprise de la peinture du séjour' })
      .expect(200)

    // Le seul texte qui défendrait la décision devant un locataire est
    // désormais conservé.
    expect(ok.body.deposit.withheldReason).toBe('Reprise de la peinture du séjour')
  })

  it('refuse une retenue supérieure à la caution', async () => {
    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const caution = pf.body.deposits[0]
    await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: caution.heldMinor + 1, reason: 'Trop, justement' })
      .expect(422)
  })

  it('laisse le gestionnaire créer une fiche locataire', async () => {
    // Il opère le parc au quotidien : c'est l'arbitrage qu'il n'a pas.
    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', gestionnaire)
    const vacante = pf.body.buildings
      .flatMap((b: { units: { id: string; status: string }[] }) => b.units)
      .find((u: { status: string }) => u.status === 'vacant')

    const res = await request(serveur)
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
    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const occupee = pf.body.buildings
      .flatMap((b: { units: { id: string; status: string }[] }) => b.units)
      .find((u: { status: string }) => u.status === 'paid')

    const res = await request(serveur)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
  })

  const pf = (c: string) => request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', c)

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
    // Dix : les sept d'origine, plus les TROIS relances du bail de Serge
    // Mbarga. Le jeu n'en portait aucune, si bien que `rentReminder` — un
    // gabarit pourtant présent dans les deux dictionnaires — ne s'affichait
    // jamais pendant qu'on développe. C'est ainsi qu'il a pu partir en clé
    // brute en production sans qu'aucun regard ne s'y pose.
    expect(res.body.notifications).toHaveLength(10)
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
    // Trois depuis que la démonstration relance : le dernier rappel de Serge
    // Mbarga est NON LU, les deux précédents le sont. C'est ce qu'un bailleur
    // trouve en arrivant — le rappel qu'il vient d'envoyer, et l'historique
    // qu'il a déjà consulté.
    expect(res.body.notifications.filter((n: { read: boolean }) => !n.read)).toHaveLength(3)
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

/**
 * L'historique des échéances.
 *
 * La réponse ne portait qu'UNE échéance par bail — la courante. L'espace du
 * locataire affiche pourtant un tableau de quittances, période par période : il
 * était vide sur un vrai parc, et les deux écrans l'annonçaient comme une case
 * vide du produit. Elle ne l'était pas : ces lignes étaient déjà lues pour
 * l'histogramme des encaissements, puis jetées après l'agrégation par mois.
 */
describe('historique des échéances', () => {
  let parkId: string
  let proprio: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
  })

  const pf = (c: string) => request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', c)

  interface LigneEcheance {
    leaseId: string
    periodStart: string
    dueOn: string
    rentMinor: number
    waterMinor: number
    powerMinor: number
    paidMinor: number
    payments: { amountMinor: number; method: string; paidOn: string }[]
  }

  it('rend les douze périodes de chaque bail, et non la seule échéance courante', async () => {
    const res = await pf(proprio)
    const lignes: LigneEcheance[] = res.body.leaseCharges

    // Dix baux, douze mois chacun — ce que le jeu de démonstration écrit.
    const parBail = new Map<string, LigneEcheance[]>()
    for (const l of lignes) parBail.set(l.leaseId, [...(parBail.get(l.leaseId) ?? []), l])
    expect(parBail.size).toBe(10)
    expect([...parBail.values()].every((p) => p.length === 12)).toBe(true)

    // La plus récente d'abord : c'est l'ordre du tableau de quittances, et le
    // trier au client supposerait qu'il sache toujours le faire.
    const periodes = lignes.map((l) => l.periodStart)
    expect([...periodes].sort().reverse()).toEqual(periodes)
  })

  it('porte le loyer et les charges DE LA PÉRIODE, versements compris', async () => {
    const res = await pf(proprio)
    const lignes: LigneEcheance[] = res.body.leaseCharges

    // Un mois passé est soldé : le versement couvre loyer, eau et électricité.
    const soldee = lignes.find((l) => l.paidMinor === l.rentMinor + l.waterMinor + l.powerMinor)
    expect(soldee).toBeDefined()
    // Les charges sont VENTILÉES par fluide. Un total unique obligerait l'écran
    // à inventer la répartition qu'il affiche en trois colonnes.
    expect(soldee!.waterMinor).toBeGreaterThan(0)
    expect(soldee!.powerMinor).toBeGreaterThan(0)

    // Le moyen et la date de chaque versement : le portail annonce « payé le
    // 03/08 par Mobile Money », et complétait jusqu'ici la phrase avec une
    // constante de démonstration.
    expect(soldee!.payments).toHaveLength(1)
    const versement = soldee!.payments[0]!
    expect(versement.method).toBe('mobile')
    expect(versement.paidOn).toBeTruthy()

    // Un règlement PARTIEL se lit comme tel — A5 verse 40 000 sur 75 000 de
    // loyer. Déduire la part réglée du statut donnait 53 % du loyer, soit deux
    // chiffres pour un seul fait.
    const partielle = lignes.find((l) => l.paidMinor > 0 && l.paidMinor < l.rentMinor)
    expect(partielle).toBeDefined()
  })

  it('borne le locataire à l’historique de son propre bail', async () => {
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
    const lignes: LigneEcheance[] = res.body.leaseCharges

    // Douze périodes, celles d'un seul bail : le sien.
    expect(lignes).toHaveLength(12)
    expect(new Set(lignes.map((l) => l.leaseId)).size).toBe(1)
    // Son loyer, et pas celui du voisin : A1 vaut 145 000.
    expect(lignes.every((l) => l.rentMinor === 145000)).toBe(true)
  })

  it('ne sert pas au locataire parti les échéances du bail qui a suivi', async () => {
    /**
     * Le cloisonnement porte sur le BAIL, non sur l'unité.
     *
     * `unitesVisibles` retient les unités où le compte a un bail, sans regarder
     * s'il court encore. Tant que la réponse ne portait qu'un montant du mois,
     * l'écart ne se voyait pas ; un historique complet aurait servi à
     * l'ancien locataire les échéances de celui qui a pris sa place — période
     * par période, montant par montant, et jusqu'au moyen de paiement.
     */
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })

    const ancien = await prisma.lease.findFirstOrThrow({
      where: { tenant: { userId: compte.id } },
      select: { id: true, unitId: true },
    })
    await prisma.lease.update({
      where: { id: ancien.id },
      data: { status: 'ended', endsOn: new Date() },
    })
    const suivant = await prisma.tenant.create({
      data: { parkId, fullName: 'Locataire suivant' },
    })
    const bailSuivant = await prisma.lease.create({
      data: {
        unitId: ancien.unitId,
        tenantId: suivant.id,
        startsOn: new Date(),
        rentMinor: 145000,
        status: 'active',
      },
    })
    await prisma.rentCharge.create({
      data: {
        leaseId: bailSuivant.id,
        periodStart: new Date(Date.UTC(2030, 0, 1)),
        dueOn: new Date(Date.UTC(2030, 0, 5)),
        rentMinor: 145000,
        waterMinor: 6000,
        powerMinor: 5000,
      },
    })

    const res = await pf(locataire.cookie)
    const lignes: LigneEcheance[] = res.body.leaseCharges

    expect(lignes.every((l) => l.leaseId === ancien.id)).toBe(true)
    expect(lignes.some((l) => l.leaseId === bailSuivant.id)).toBe(false)
  })
})

/**
 * L'occupation d'une unité, bail par bail.
 *
 * Le portefeuille ne rendait que le bail EN COURS. « Que s'est-il passé dans ce
 * logement ? » n'avait donc aucune réponse, alors que le modèle porte des baux
 * datés depuis l'origine — le dossier du logement se construit sur eux.
 */
describe('occupation d’un logement', () => {
  let parkId: string
  let proprio: string

  interface Occupation {
    id: string
    unitId: string
    tenant: string | null
    startsOn: string
    endsOn: string | null
    rentMinor: number
    status: string
  }

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
  })

  const pf = (c: string) => request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', c)

  /** Clôt le bail de Charles et installe un successeur sur la même unité. */
  async function faireSucceder(userId?: string) {
    const ancien = await prisma.lease.findFirstOrThrow({
      where: userId
        ? { tenant: { userId } }
        : { tenant: { fullName: 'Charles Ngassa' }, unit: { building: { parkId } } },
      select: { id: true, unitId: true },
    })
    // L'index unique partiel n'autorise qu'un bail en cours par unité.
    await prisma.lease.update({
      where: { id: ancien.id },
      data: { status: 'ended', endsOn: new Date(Date.UTC(2026, 6, 31)) },
    })
    const suivant = await prisma.tenant.create({
      data: { parkId, fullName: 'Locataire suivant' },
    })
    const bailSuivant = await prisma.lease.create({
      data: {
        unitId: ancien.unitId,
        tenantId: suivant.id,
        startsOn: new Date(Date.UTC(2026, 7, 1)),
        rentMinor: 160000,
        status: 'active',
      },
    })
    return { ancien, bailSuivant }
  }

  /* « au bailleur » et non « au gestionnaire » : ce cas ouvre une session
     PROPRIÉTAIRE. Il passait sous son ancien titre parce que les deux rôles sont
     indiscernables en lecture — donc il ne gardait pas ce qu'il annonçait. Ce
     qu'il vérifie vraiment, c'est l'absence de cloisonnement hors locataire ;
     le rôle du gestionnaire est gardé plus bas, sous son propre cookie. */
  it('rend au bailleur TOUS les baux d’une unité, terminés compris', async () => {
    const { ancien, bailSuivant } = await faireSucceder()
    const res = await pf(proprio)
    const baux: Occupation[] = res.body.leases

    const surLUnite = baux.filter((b) => b.unitId === ancien.unitId)
    expect(surLUnite.map((b) => b.id).sort()).toEqual([ancien.id, bailSuivant.id].sort())

    // Le bail clos porte sa date de SORTIE — un bail terminé sans elle serait
    // une donnée manquante, pas un bail en cours.
    const clos = surLUnite.find((b) => b.id === ancien.id)!
    expect(clos.status).toBe('ended')
    expect(clos.endsOn).toBeTruthy()
    // Et le loyer DE L'ÉPOQUE, pas celui du bail courant.
    expect(clos.rentMinor).toBe(145000)
    expect(surLUnite.find((b) => b.id === bailSuivant.id)!.rentMinor).toBe(160000)
  })

  /**
   * Le cloisonnement porte sur le BAIL, non sur l'unité — le seul scénario où
   * les deux divergent.
   *
   * `unitesVisibles` retient les unités où le compte a un bail sans regarder
   * s'il court encore : un locataire parti reste « visible » sur son ancien
   * logement. Lui rendre l'occupation suivante lui donnerait le NOM de son
   * successeur, sa date d'entrée et son loyer. Le cas du voisin ne mord pas —
   * `filtreUnite` l'écarte déjà.
   */
  it('ne dit pas au locataire parti qui lui a succédé', async () => {
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })

    const { ancien, bailSuivant } = await faireSucceder(compte.id)

    const res = await pf(locataire.cookie)
    const baux: Occupation[] = res.body.leases

    expect(baux.every((b) => b.id === ancien.id)).toBe(true)
    expect(baux.some((b) => b.id === bailSuivant.id)).toBe(false)
    // Le nom, explicitement : c'est lui que la fuite livrerait.
    expect(baux.some((b) => b.tenant === 'Locataire suivant')).toBe(false)
  })
})

/**
 * Les demandes de pièces administratives.
 *
 * Elles n'avaient pas d'objet : l'écran « Documents » les envoyait par la route
 * des interventions, faute de mieux. Le gestionnaire recevait « Attestation de
 * résidence » avec un métier, une urgence, une référence de chantier et un
 * cycle devis → validation → clôture dont rien ne s'applique — et les deux
 * écrans la rangeaient parmi les travaux du logement, à côté d'une fuite
 * d'évier.
 */
describe('demandes de documents', () => {
  let parkId: string
  let proprio: string
  let locataire: string
  let uniteDuLocataire: string

  interface DemandeApi {
    id: string
    unitId: string
    tenant: string | null
    kind: string
    status: string
    requestedAt: string
    resolvedAt: string | null
  }

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const l = await inscrire('charles@example.com')
    locataire = l.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })
    const vue = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', locataire)
    uniteDuLocataire = vue.body.buildings.flatMap((b: { units: { id: string }[] }) => b.units)[0].id
  })

  const demander = (cookie: string, unitId: string, kind: string) =>
    request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/document-requests`)
      .set('Cookie', cookie)
      .send({ kind })

  const portefeuille = (cookie: string) =>
    request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)

  it('enregistre la demande du locataire, et la rend au gestionnaire', async () => {
    const res = await demander(locataire, uniteDuLocataire, 'goodStanding')
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.request).toMatchObject({ kind: 'goodStanding', status: 'pending' })

    // Elle voyage dans la MÊME réponse que le reste du parc, avec le nom de qui
    // demande : le gestionnaire répond à une personne, pas à un identifiant.
    const vue = await portefeuille(proprio)
    const sienne = vue.body.documentRequests.find((d: DemandeApi) => d.kind === 'goodStanding')
    expect(sienne).toMatchObject({
      unitId: uniteDuLocataire,
      tenant: 'Charles Ngassa',
      status: 'pending',
      resolvedAt: null,
    })
  })

  it('n’en enregistre pas deux fois la même tant qu’elle est en attente', async () => {
    await demander(locataire, uniteDuLocataire, 'leaseCopy')
    const doublon = await demander(locataire, uniteDuLocataire, 'leaseCopy')

    // 409 et non 400 : la demande est bien formée, c'est son état qui s'y
    // oppose — l'écran dit « déjà demandée », pas « demande invalide ».
    expect(doublon.status).toBe(409)
    expect(doublon.body).toEqual({ error: 'already_pending' })

    const vue = await portefeuille(proprio)
    expect(
      vue.body.documentRequests.filter((d: DemandeApi) => d.kind === 'leaseCopy'),
    ).toHaveLength(1)
  })

  it('la rouvre une fois la première traitée', async () => {
    // Redemander une attestation six mois plus tard est légitime : l'unicité ne
    // porte que sur les demandes EN ATTENTE.
    const une = await demander(locataire, uniteDuLocataire, 'residence')
    await request(serveur)
      .patch(`/api/parks/${parkId}/document-requests/${une.body.request.id}`)
      .set('Cookie', proprio)
      .send({ status: 'fulfilled' })

    const deux = await demander(locataire, uniteDuLocataire, 'residence')
    expect(deux.status, JSON.stringify(deux.body)).toBe(201)
  })

  it('refuse au locataire le logement d’un autre', async () => {
    const vueProprio = await portefeuille(proprio)
    const toutes = vueProprio.body.buildings.flatMap((b: { units: { id: string }[] }) => b.units)
    const voisine = toutes.find((u: { id: string }) => u.id !== uniteDuLocataire)!

    const res = await demander(locataire, voisine.id, 'residence')
    // 404 et non 403 : un 403 confirmerait l'existence du logement voisin.
    expect(res.status).toBe(404)
  })

  /**
   * Le propriétaire ne DEMANDE pas.
   *
   * La déclaration d'incident est ouverte aux trois rôles — un gestionnaire
   * constate une fuite lui aussi. Une attestation de résidence, non : elle se
   * demande à celui qui la produit, et une route ouverte au propriétaire
   * existerait pour un geste que personne ne fait, en inscrivant son nom dans
   * `requestedBy`.
   */
  it('n’ouvre la demande qu’au locataire', async () => {
    const res = await demander(proprio, uniteDuLocataire, 'residence')
    expect(res.status).toBe(403)
  })

  it('laisse le bailleur répondre, une fois et une seule', async () => {
    const une = await demander(locataire, uniteDuLocataire, 'goodStanding')
    const id = une.body.request.id

    const repondu = await request(serveur)
      .patch(`/api/parks/${parkId}/document-requests/${id}`)
      .set('Cookie', proprio)
      .send({ status: 'fulfilled' })
    expect(repondu.status, JSON.stringify(repondu.body)).toBe(200)
    expect(repondu.body.request.status).toBe('fulfilled')
    expect(repondu.body.request.resolvedAt).toBeTruthy()

    // Répondre deux fois écraserait la première réponse — et sa date, que le
    // locataire a peut-être déjà lue.
    const encore = await request(serveur)
      .patch(`/api/parks/${parkId}/document-requests/${id}`)
      .set('Cookie', proprio)
      .send({ status: 'declined' })
    expect(encore.status).toBe(409)
    expect(encore.body).toEqual({ error: 'not_pending' })

    // La réponse est TRACÉE : « je n'ai jamais reçu mon attestation » se règle
    // en relisant qui a répondu quoi, et quand.
    const trace = await prisma.auditEvent.findFirst({
      where: { entity: 'DocumentRequest', entityId: id },
      select: { action: true, actorId: true },
    })
    expect(trace?.action).toBe('document.fulfilled')
  })

  it('refuse la demande d’un parc voisin au gestionnaire qui n’y appartient pas', async () => {
    const une = await demander(locataire, uniteDuLocataire, 'residence')
    const etranger = await inscrire('ailleurs@example.com', { parkName: 'Autre parc' })

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/document-requests/${une.body.request.id}`)
      .set('Cookie', etranger.cookie)
      .send({ status: 'fulfilled' })
    // Il n'appartient pas à ce parc : la garde d'appartenance tombe avant tout
    // le reste.
    expect([403, 404]).toContain(res.status)
  })

  it('ne montre au locataire que SES demandes', async () => {
    await demander(locataire, uniteDuLocataire, 'residence')

    // Une demande sur le bail d'un voisin, posée directement en base : elle ne
    // doit jamais atteindre la réponse servie à Charles.
    const bailVoisin = await prisma.lease.findFirstOrThrow({
      where: { unit: { building: { parkId } }, unitId: { not: uniteDuLocataire } },
      select: { id: true },
    })
    await prisma.documentRequest.create({
      data: { leaseId: bailVoisin.id, kind: 'leaseCopy' },
    })

    const vue = await portefeuille(locataire)
    expect(vue.body.documentRequests).toHaveLength(1)
    expect(vue.body.documentRequests[0].kind).toBe('residence')

    // Le bailleur, lui, voit les deux — plus celle du jeu de démonstration.
    // (Session propriétaire : le gestionnaire a son propre cas plus bas.)
    const cote = await portefeuille(proprio)
    expect(cote.body.documentRequests.length).toBeGreaterThanOrEqual(2)
  })

  /**
   * Le cloisonnement porte sur le BAIL, et non sur l'unité.
   *
   * Le cas au-dessus ne le vérifie pas, et c'est une mutation qui l'a montré :
   * en retirant de la lecture du portefeuille le filtre par bail, la suite
   * restait ENTIÈREMENT verte. Il pose sa demande voisine sur une AUTRE unité,
   * que `filtreUnite` écarte déjà — le filtre par bail n'y sert à rien.
   *
   * Les deux ne divergent qu'ici. `unitesVisibles` retient les unités où le
   * compte a un bail sans regarder s'il court encore : un locataire parti reste
   * « visible » sur son ancien logement, et lirait alors les demandes de celui
   * qui a pris sa place — la pièce demandée, sa date, et si elle a été fournie.
   */
  it('ne sert pas au locataire parti les demandes du bail qui a suivi', async () => {
    const ancien = await prisma.lease.findFirstOrThrow({
      where: { unitId: uniteDuLocataire },
      select: { id: true },
    })
    // L'index unique partiel n'autorise qu'un bail en cours par unité : le
    // précédent doit être clos avant que le suivant n'existe.
    await prisma.lease.update({
      where: { id: ancien.id },
      data: { status: 'ended', endsOn: new Date() },
    })
    const suivant = await prisma.tenant.create({
      data: { parkId, fullName: 'Locataire suivant' },
    })
    const bailSuivant = await prisma.lease.create({
      data: {
        unitId: uniteDuLocataire,
        tenantId: suivant.id,
        startsOn: new Date(),
        rentMinor: 145000,
        status: 'active',
      },
    })
    const laSienne = await prisma.documentRequest.create({
      data: { leaseId: bailSuivant.id, kind: 'leaseCopy' },
      select: { id: true },
    })

    const vue = await portefeuille(locataire)
    expect(vue.body.documentRequests.some((d: DemandeApi) => d.id === laSienne.id)).toBe(false)
  })
})

/**
 * Le DÉTAIL des états des lieux.
 *
 * `InspectionModal` saisit une pièce, une description, une gravité et un coût
 * depuis l'origine ; la route de création les enregistre ; la retenue proposée
 * sur la caution en dérive. La réponse du portefeuille, elle, ne rendait qu'un
 * NOMBRE — « 3 réserves » —, si bien que la somme opposée au locataire ne se
 * justifiait par rien qu'il puisse lire.
 */
describe('réserves des états des lieux', () => {
  let parkId: string
  let proprio: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
  })

  const portefeuille = (cookie: string) =>
    request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)

  interface EtatApi {
    id: string
    unitId: string
    leaseId: string | null
    kind: string
    issues: number
    findings: {
      id: string
      room: string
      description: string
      severity: string
      costMinor: number | null
    }[]
  }

  it('rend chaque réserve avec sa pièce, sa gravité et son coût', async () => {
    const vue = await portefeuille(proprio)
    const etats: EtatApi[] = vue.body.inspections
    const avecReserves = etats.filter((i) => i.issues > 0)
    expect(avecReserves.length).toBeGreaterThan(0)

    for (const etat of avecReserves) {
      // Le compte et le détail disent la MÊME chose : deux sources qui
      // divergent sur le nombre de réserves seraient pires qu'une seule.
      expect(etat.findings, etat.id).toHaveLength(etat.issues)
      for (const reserve of etat.findings) {
        expect(reserve.room.length).toBeGreaterThan(0)
        expect(reserve.description.length).toBeGreaterThan(0)
        expect(['minor', 'major']).toContain(reserve.severity)
      }
    }

    /**
     * Le coût n'existe QUE sur une sortie.
     *
     * C'est la règle qui donne son sens à l'état des lieux d'entrée : il relève
     * ce qui est déjà abîmé pour que le locataire n'en réponde pas. La route de
     * création refuse d'y chiffrer quoi que ce soit ; la lecture doit montrer
     * la même chose.
     */
    const entrees = etats.filter((i) => i.kind === 'entry')
    expect(entrees.length).toBeGreaterThan(0)
    expect(entrees.flatMap((i) => i.findings).every((r) => r.costMinor === null)).toBe(true)

    const sorties = etats.filter((i) => i.kind === 'exit')
    expect(sorties.flatMap((i) => i.findings).some((r) => (r.costMinor ?? 0) > 0)).toBe(true)
  })

  it('apparie l’entrée et la sortie par le BAIL, et non par le logement', async () => {
    const vue = await portefeuille(proprio)
    const etats: EtatApi[] = vue.body.inspections
    // Sans `leaseId`, comparer deux états des lieux d'une même unité
    // rapprocherait l'entrée d'un locataire de la sortie d'un autre.
    expect(etats.some((i) => i.leaseId !== null)).toBe(true)
  })

  /**
   * Le cloisonnement, et c'est ici qu'il devient sensible.
   *
   * `unitesVisibles` retient le logement d'un locataire même après son départ.
   * Tant que la réponse ne portait qu'un compte, l'écart ne coûtait rien ; le
   * détail, lui, porte des descriptions et des coûts imputés. Ceux du bail
   * SUIVANT ne le regardent pas.
   */
  it('ne détaille pas au locataire parti les réserves du bail qui a suivi', async () => {
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })

    const ancien = await prisma.lease.findFirstOrThrow({
      where: { tenant: { userId: compte.id } },
      select: { id: true, unitId: true },
    })
    // L'index unique partiel n'autorise qu'un bail en cours par unité : on clôt
    // le sien avant d'installer son successeur.
    await prisma.lease.update({
      where: { id: ancien.id },
      data: { status: 'ended', endsOn: new Date() },
    })
    const suivant = await prisma.tenant.create({
      data: { parkId, fullName: 'Locataire suivant' },
    })
    const bailSuivant = await prisma.lease.create({
      data: {
        unitId: ancien.unitId,
        tenantId: suivant.id,
        startsOn: new Date(),
        rentMinor: 145000,
        status: 'active',
      },
    })
    await prisma.inspection.create({
      data: {
        unitId: ancien.unitId,
        leaseId: bailSuivant.id,
        kind: 'entry',
        performedOn: new Date(),
        rooms: 3,
        findings: {
          create: [
            {
              room: 'Chambre du successeur',
              description: 'Trace d’humidité au plafond',
              severity: 'major',
            },
          ],
        },
      },
    })

    const vue = await portefeuille(locataire.cookie)
    const etats: EtatApi[] = vue.body.inspections

    expect(etats.every((i) => i.leaseId !== bailSuivant.id)).toBe(true)
    // La description est ce que la fuite livrerait : on l'assert nommément.
    expect(JSON.stringify(etats)).not.toContain('Chambre du successeur')
  })
})

/**
 * L'historique des relevés de compteur.
 *
 * Le portefeuille LISAIT déjà toutes les périodes — aucun `take` sur
 * `meterReading.findMany` — puis n'en projetait que deux points avant de jeter
 * le reste. L'espace du locataire n'avait donc qu'un chiffre à montrer, quand
 * sa seule question est de savoir à quoi le comparer.
 */
describe('historique des relevés', () => {
  let parkId: string
  let proprio: string

  interface RelevéApi {
    unitId: string
    utility: 'water' | 'power'
    periodStart: string
    indexValue: number
  }

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
  })

  const pf = (c: string) => request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', c)

  /** Regroupe l'historique par (unité, fluide), du plus ancien au plus récent. */
  function parCouple(historique: RelevéApi[]) {
    const groupes = new Map<string, RelevéApi[]>()
    for (const r of historique) {
      const cle = `${r.unitId}|${r.utility}`
      groupes.set(cle, [...(groupes.get(cle) ?? []), r])
    }
    for (const serie of groupes.values())
      serie.sort((a, b) => +new Date(a.periodStart) - +new Date(b.periodStart))
    return groupes
  }

  it('rend plus de DEUX périodes par unité et par fluide', async () => {
    const res = await pf(proprio)
    const groupes = parCouple(res.body.readingHistory)
    expect(groupes.size).toBeGreaterThan(0)

    for (const [cle, serie] of groupes) {
      // Deux, c'est ce que le semis créait : le mois courant et son antérieur.
      expect(serie.length, cle).toBeGreaterThan(2)
      /**
       * Un index qui RECULE prouverait qu'on rend autre chose — des
       * consommations prises pour des index, ou deux unités mélangées. Un
       * compteur ne tourne pas à l'envers.
       */
      for (let i = 1; i < serie.length; i += 1)
        expect(serie[i]!.indexValue, `${cle} @ ${serie[i]!.periodStart}`).toBeGreaterThan(
          serie[i - 1]!.indexValue,
        )
    }
  })

  /**
   * L'historique et `readings` projettent le MÊME tableau.
   *
   * Ce ne sont pas deux sources : l'une garde la période courante et son
   * antérieur, l'autre rend tout, dans la même réponse et au même instant. Si
   * les deux divergeaient, le locataire lirait un chiffre sur sa carte du mois
   * et un autre sur la dernière barre de sa série.
   */
  it('reste d’accord avec la période courante de `readings`', async () => {
    const res = await pf(proprio)
    const groupes = parCouple(res.body.readingHistory)

    const courants = (res.body.readings as { unitId: string; utility: string; indexValue: number | null }[])
      .filter((r) => r.indexValue !== null)
    expect(courants.length).toBeGreaterThan(0)

    for (const courant of courants) {
      const serie = groupes.get(`${courant.unitId}|${courant.utility}`)!
      expect(serie.at(-1)!.indexValue, `${courant.unitId}|${courant.utility}`).toBe(courant.indexValue)
    }
  })

  /**
   * Les relevés du locataire PARTI s'arrêtent à la fin de son bail.
   *
   * Le filtre de la requête porte sur l'UNITÉ, et `unitesVisibles` retient son
   * logement après son départ — voulu, il garde ses quittances. Mais un index
   * postérieur à sa sortie est la consommation de son SUCCESSEUR : douze
   * périodes en feraient un profil de vie, absences comprises.
   */
  it('borne les relevés du locataire parti à la fin de son bail', async () => {
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })

    // Il part au 1er du mois d'il y a deux mois ; le successeur entre le jour
    // même. Deux mois de relevés lui sont donc postérieurs.
    const maintenant = new Date()
    const depart = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 2, 1))
    const ancien = await prisma.lease.findFirstOrThrow({
      where: { tenant: { userId: compte.id } },
      select: { id: true, unitId: true },
    })
    await prisma.lease.update({
      where: { id: ancien.id },
      data: { status: 'ended', endsOn: depart },
    })
    const suivant = await prisma.tenant.create({ data: { parkId, fullName: 'Locataire suivant' } })
    await prisma.lease.create({
      data: {
        unitId: ancien.unitId,
        tenantId: suivant.id,
        startsOn: depart,
        rentMinor: 145000,
        status: 'active',
      },
    })

    // Le BAILLEUR voit des relevés postérieurs au départ — sans quoi ce cas ne
    // prouverait rien : borner une série qui s'arrête déjà est gratuit.
    const vueProprio = await pf(proprio)
    const surLUnite = (vueProprio.body.readingHistory as RelevéApi[]).filter(
      (r) => r.unitId === ancien.unitId,
    )
    const apresLeDepart = surLUnite.filter((r) => new Date(r.periodStart) > depart)
    expect(apresLeDepart.length).toBeGreaterThan(0)

    const vue = await pf(locataire.cookie)
    const sien = vue.body.readingHistory as RelevéApi[]
    expect(sien.length).toBeGreaterThan(0)
    expect(sien.every((r) => new Date(r.periodStart) <= depart)).toBe(true)

    /**
     * `readings` est bornée par la MÊME garde.
     *
     * C'est la moitié qu'on oublie : borner la série et laisser la période
     * courante rendre l'index du successeur ferait fuir par la porte à côté —
     * un seul index, mais le sien.
     */
    const indexDuSuccesseur = new Set(apresLeDepart.map((r) => r.indexValue))
    const courants = vue.body.readings as { indexValue: number | null }[]
    expect(courants.every((r) => r.indexValue === null || !indexDuSuccesseur.has(r.indexValue))).toBe(
      true,
    )
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.building).toMatchObject({ name: 'Résidence Makepe', district: 'Makepe' })

    // Et il ressort du portefeuille : créer sans que l'écran le voie ne
    // servirait à rien.
    const portefeuille = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookie)
    expect(portefeuille.body.buildings.map((b: { name: string }) => b.name)).toContain(
      'Résidence Makepe',
    )
  })

  it('refuse un nom ou un quartier trop court, en nommant le champ', async () => {
    const { cookie } = await inscrire('court@example.com', { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId

    const res = await request(serveur)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId

    const corps = { name: 'Les Palmiers', district: 'Bonapriso' }
    const un = await request(serveur).post(`/api/parks/${parkId}/buildings`).set('Cookie', cookie).send(corps)
    const deux = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ ...corps, district: 'Deïdo' })

    expect(un.status).toBe(201)
    expect(deux.status).toBe(201)
  })

  it('refuse un compte qui n’appartient pas au parc, en 404 et non en 403', async () => {
    // 403 confirmerait l'existence du parc à qui l'a deviné.
    const { cookie: proprio } = await inscrire('chez-moi@example.com', { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    const parkId = parcs.body.memberships[0].parkId

    const { cookie: etranger } = await inscrire('etranger@example.com')
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', etranger)
      .send({ name: 'Résidence', district: 'Ailleurs' })

    expect(res.status).toBe(404)
  })
})

describe('saisie des logements', () => {
  async function parcAvecImmeuble(email: string) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    return { cookie, parkId, buildingId: immeuble.body.building.id as string }
  }

  it('crée un logement, et le portefeuille le rend', async () => {
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('logements@example.com')

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.unit).toMatchObject({ label: 'A1', type: 'T3', surfaceSqm: 78 })

    const portefeuille = await request(serveur)
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

    const un = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send(corps)
    const deux = await request(serveur)
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
    const autre = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Villa Deïdo', district: 'Deïdo' })

    const corps = { label: 'A1', type: 'T2', surfaceSqm: 54, baseRentMinor: 110000 }
    const un = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      .send(corps)
    const deux = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${autre.body.building.id}/units`)
      .set('Cookie', cookie)
      .send(corps)

    expect(un.status).toBe(201)
    expect(deux.status).toBe(201)
  })

  it('refuse un immeuble qui n’est pas dans le parc, en 404', async () => {
    const { cookie, parkId } = await parcAvecImmeuble('mien@example.com')
    const { buildingId: ailleurs } = await parcAvecImmeuble('sien@example.com')

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${ailleurs}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T1', surfaceSqm: 30, baseRentMinor: 50000 })

    expect(res.status).toBe(404)
  })
})

describe('saisie du bail', () => {
  async function parcAvecLogement(email: string) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
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

    const res = await request(serveur)
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

    const res = await request(serveur)
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

    const res = await request(serveur)
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

    const res = await request(serveur)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const unitId = logement.body.unit.id as string
    await request(serveur)
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

    const res = await request(serveur)
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

  it('refuse un versement reçu DEMAIN', async () => {
    /**
     * `paidOn` n'était vérifié que sur sa forme. Une quittance a été émise pour
     * un règlement daté du 17 septembre alors qu'on était le 18 août : le
     * registre portait de l'argent qui n'était pas arrivé, et « encaissé ce
     * mois » le comptait. Une quittance atteste d'un fait ; la dater en avant
     * en fait une promesse.
     */
    const { cookie, parkId, unitId } = await parcAvecBail('futur@example.com')
    const demain = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 145000, method: 'cash', paidOn: demain })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('paid_in_future')
    expect(await prisma.payment.count()).toBe(0)
  })

  it('admet un versement reçu AUJOURD’HUI, quelle que soit l’heure', async () => {
    // La borne est le jour courant en entier : un versement reçu ce matin et
    // saisi ce soir doit passer, quel que soit le fuseau de qui saisit.
    const { cookie, parkId, unitId } = await parcAvecBail('aujourdhui@example.com')
    const aujourdhui = new Date().toISOString().slice(0, 10)

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 145000, method: 'cash', paidOn: aujourdhui })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('admet un versement partiel, et les cumule sur la même période', async () => {
    // Payer ce qu'on peut, quand on peut, est le cas COURANT. Interdire le
    // partiel forcerait à ne rien enregistrer, donc à perdre la trace.
    const { cookie, parkId, unitId } = await parcAvecBail('partiel@example.com')
    const corps = { unitId, periodStart: '2026-07-01', method: 'cash' as const }

    await request(serveur).post(`/api/parks/${parkId}/payments`).set('Cookie', cookie).send({ ...corps, amountMinor: 40000 })
    await request(serveur).post(`/api/parks/${parkId}/payments`).set('Cookie', cookie).send({ ...corps, amountMinor: 60000 })

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

    await request(serveur)
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
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 0, method: 'cash' })
    expect(res.status).toBe(400)
    expect(res.body.fields?.[0]?.path).toBe('amountMinor')
  })

  it('refuse un logement d’un autre parc, en 404', async () => {
    const { cookie, parkId } = await parcAvecBail('ici@example.com')
    const { unitId: ailleurs } = await parcAvecBail('la-bas@example.com')
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId: ailleurs, periodStart: '2026-07-01', amountMinor: 1000, method: 'cash' })
    expect(res.status).toBe(404)
  })
})

describe('émission des quittances', () => {
  async function parcPaye(email: string, montant: number) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const unitId = logement.body.unit.id as string
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01', rentMinor: 145000 })
    if (montant > 0) {
      await request(serveur)
        .post(`/api/parks/${parkId}/payments`)
        .set('Cookie', cookie)
        .send({ unitId, periodStart: '2026-07-01', amountMinor: montant, method: 'mobile' })
    }
    return { cookie, parkId, unitId }
  }

  it('porte la devise du PARC, et non celle de qui l’imprime', async () => {
    /**
     * Le document ne portait AUCUNE unité : le client le mettait en forme avec
     * la devise d'affichage de sa machine. Le même versement imprimé sur deux
     * postes réglés différemment portait deux monnaies — et une quittance est le
     * seul papier que le locataire gardera pour prouver qu'il a payé.
     */
    const { cookie, parkId, unitId } = await parcPaye('devise@example.com', 145000)

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    // Le parc est créé au Cameroun par l'inscription : franc CFA.
    expect(res.body.document.currency).toBe('XAF')
  })

  it('rééditée après un changement de devise, ne contredit pas celle déjà remise', async () => {
    /**
     * LE PAPIER EST DÉJÀ CHEZ LE LOCATAIRE, ET IL NE SE RATTRAPE PAS.
     *
     * La devise du document était prise sur le PARC, lu à chaque émission. Le
     * commentaire de la route disait « figée dans la réponse : une quittance
     * atteste d'un fait passé, et le parc pourrait changer de devise demain sans
     * que ce fait change » — vrai le temps d'une requête, et faux de la seconde.
     *
     * Or la route autorise explicitement la réédition : « un document perdu doit
     * pouvoir être refait ». Un bailleur qui corrige la devise de son parc rend
     * donc une quittance de 145 000 EUR là où le locataire en détient une de
     * 145 000 XAF, pour le même versement. Aucune des deux ne porte de trace de
     * l'autre : la charge utile de `receipt.issued` ne consignait pas la devise.
     *
     * LE VERSEMENT EST LE FAIT. La devise appartient à l'argent reçu, pas au
     * réglage du jour où on l'imprime.
     */
    const { cookie, parkId, unitId } = await parcPaye('devise-changee@example.com', 145000)

    const avant = await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })
    expect(avant.body.document.currency).toBe('XAF')

    await request(serveur)
      .patch(`/api/parks/${parkId}`)
      .set('Cookie', cookie)
      .send({ currency: 'EUR' })

    const apres = await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    expect(
      apres.body.document.currency,
      'la quittance rééditée porte une AUTRE monnaie que celle déjà remise, pour le même versement',
    ).toBe('XAF')
  })

  it('consigne la devise dans la trace d’émission', async () => {
    /* Sans elle, deux quittances contradictoires ne peuvent plus être
       départagées : la trace disait QUOI et QUAND, jamais EN QUELLE MONNAIE. */
    const { cookie, parkId, unitId } = await parcPaye('trace-devise@example.com', 145000)

    await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01' })

    const trace = await prisma.auditEvent.findFirst({
      where: { parkId, action: 'receipt.issued' },
      orderBy: { createdAt: 'desc' },
    })
    expect((trace?.payload as { currency?: string } | null)?.currency).toBe('XAF')
  })

  it('émet une QUITTANCE quand la période est intégralement soldée', async () => {
    const { cookie, parkId, unitId } = await parcPaye('quittance@example.com', 145000)

    const res = await request(serveur)
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

    const res = await request(serveur)
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

    const res = await request(serveur)
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
    await request(serveur)
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

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/receipts`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-03-01' })

    expect(res.status).toBe(404)
  })
})

describe('codes d’invitation', () => {
  async function parcAvecCode(email: string, role: 'tenant' | 'manager' = 'manager') {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const res = await request(serveur)
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

    const rejoint = await request(serveur).post('/api/auth/signup').send({
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
    const res = await request(serveur).post('/api/auth/signup').send({
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
    await request(serveur).post('/api/auth/signup').send({
      email: 'premier@example.com', password: MDP, fullName: 'Premier', acceptTerms: true, invitationCode: code,
    })

    const second = await request(serveur).post('/api/auth/signup').send({
      email: 'second@example.com', password: MDP, fullName: 'Second', acceptTerms: true, invitationCode: code,
    })
    const inexistant = await request(serveur).post('/api/auth/signup').send({
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

    const res = await request(serveur).post('/api/auth/signup').send({
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)

    const res = await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/invitations`)
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
      // Ces cas n'éprouvent que le SMS ; le courriel complète la couture sans
      // rien promettre — comme l'adaptateur de journal, il ne part pas.
      envoyerEmail: async () => false,
    })
    try {
      const { cookie } = await inscrire('panne@example.com', { parkName: 'Parc' })
      const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
      const res = await request(serveur)
        .post(`/api/parks/${parcs.body.memberships[0].parkId}/invitations`)
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
      envoyerEmail: async () => false,
    })
    try {
      const { cookie } = await inscrire('fournisseur@example.com', { parkName: 'Parc' })
      const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
      const res = await request(serveur)
        .post(`/api/parks/${parcs.body.memberships[0].parkId}/invitations`)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const cree = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Residence Djoumessi', district: 'Bastos' })
    return { cookie, parkId, buildingId: cree.body.building.id as string }
  }

  it('retire un immeuble vide, et le parc ne le rend plus', async () => {
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('vide@example.com')

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(204)

    const parc = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    expect(parc.body.buildings).toHaveLength(0)
  })

  it('refuse un immeuble qui porte des logements, sans rien détruire', async () => {
    const { cookie, parkId, buildingId } = await parcAvecImmeuble('plein@example.com')
    await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${buildingId}/units`)
      .set('Cookie', cookie)
      // `baseRentMinor` : le champ du contrat, que `rentMinor` — le nom rendu
      // par la LECTURE du parc — ne remplace pas. Une charge mal formée passait
      // en 400, l'immeuble restait vide, et la suppression avait alors raison
      // de réussir : le cas ne vérifiait rien.
      .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 20000 })

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/buildings/${buildingId}`)
      .set('Cookie', cookie)
    // 409 et non 400 : la requête est bien formée, c'est l'état du parc qui s'y
    // oppose. L'écran doit pouvoir dire quoi vider d'abord.
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('building_not_empty')

    const parc = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    expect(parc.body.buildings).toHaveLength(1)
  })

  it('ne laisse pas supprimer l’immeuble d’un autre parc', async () => {
    const { buildingId } = await parcAvecImmeuble('proprio-a@example.com')
    const { cookie: cookieB } = await inscrire('proprio-b@example.com', {
      parkName: 'Parc B',
      countryCode: 'CM',
    })
    const parcsB = await request(serveur).get('/api/auth/me').set('Cookie', cookieB)
    const parkIdB = parcsB.body.memberships[0].parkId

    const res = await request(serveur)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const bail = await request(serveur)
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

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.sent).toEqual([leaseId])

    const trace = await prisma.notification.findFirstOrThrow({
      where: { parkId, messageKey: 'rentReminder' },
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
    await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    const second = await request(serveur)
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

    const res = await request(serveur)
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
        // La devise voyage avec l’argent reçu — voir `Payment.currency`.
        currency: 'XAF',
        method: 'cash',
        paidOn: new Date('2026-06-04T00:00:00Z'),
        recordedById: (
          await prisma.userAccount.findUniqueOrThrow({ where: { email: 'bailleur@example.com' } })
        ).id,
      },
    })

    const res = await request(serveur)
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

    const res = await request(serveur)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', autre.cookie)

    const res = await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/reminders`)
      .set('Cookie', autre.cookie)
      .send({ leaseIds: [leaseId] })

    // `not_found` et non `nothing_due` : la réponse ne doit pas renseigner sur
    // l'état d'un bail qui appartient à quelqu'un d'autre.
    expect(res.body.sent).toEqual([])
    expect(res.body.skipped[0].reason).toBe('not_found')
  })

  it('ne pose une date d’envoi que si le message est PARTI', async () => {
    await echeanceEnRetard()
    await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId] })

    const trace = await prisma.notification.findFirstOrThrow({
      where: { parkId, messageKey: 'rentReminder' },
    })
    /**
     * Aucun fournisseur n'est configuré : `MessagerieDeJournal` rend `false`, et
     * c'est le cœur de cette couture. Poser `sentAt` malgré tout ferait mentir
     * le dossier le jour où un locataire contestera avoir été prévenu — le seul
     * jour où cette trace sert.
     */
    expect(trace.sentAt).toBeNull()
    expect(trace.channel).toBe('in_app')
  })

  it('date l’envoi et marque le canal quand un fournisseur le porte', async () => {
    await prisma.tenant.updateMany({ where: { parkId }, data: { phoneE164: '+237677214408' } })
    await echeanceEnRetard()

    const envoyes: string[] = []
    const rendre = remplacerMessagerie({
      async envoyerSms(destinataire: string) {
        envoyes.push(destinataire)
        return true
      },
      async envoyerEmail() {
        return false
      },
    })
    try {
      await request(serveur)
        .post(`/api/parks/${parkId}/reminders`)
        .set('Cookie', proprio)
        .send({ leaseIds: [leaseId] })
    } finally {
      rendre()
    }

    expect(envoyes).toEqual(['+237677214408'])
    const trace = await prisma.notification.findFirstOrThrow({
      where: { parkId, messageKey: 'rentReminder' },
    })
    expect(trace.sentAt).not.toBeNull()
    expect(trace.channel).toBe('sms')
  })

  it('ne relance, en mode jalons, qu’aux échéances vendues', async () => {
    /**
     * La grille tarifaire promet J+1, J+7 et J+15 — pas une relance quotidienne.
     * Relancer tous les jours ferait du produit un harceleur ; le jalon est une
     * donnée du contrat commercial, pas un réglage d'implémentation.
     */
    const hier = new Date(Date.now() - 3 * 86_400_000)
    await prisma.rentCharge.create({
      data: {
        leaseId,
        periodStart: new Date('2026-05-01T00:00:00Z'),
        dueOn: hier,
        rentMinor: 145000,
      },
    })

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [leaseId], only: 'milestones' })

    // Trois jours de retard : ni J+1, ni J+7, ni J+15.
    expect(res.body.sent).toEqual([])
    expect(res.body.skipped[0].reason).toBe('not_a_milestone')
  })

  it('relance tout le parc quand aucune liste n’est fournie', async () => {
    // La forme qu'emprunte la relance automatique : elle ne connaît pas d'avance
    // la liste des retardataires.
    await echeanceEnRetard()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({})

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.sent).toEqual([leaseId])
  })

  it('ouvre la relance au gestionnaire, dont c’est le métier quotidien', async () => {
    await echeanceEnRetard()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', gestionnaire)
      .send({ leaseIds: [leaseId] })

    expect(res.status).toBe(200)
    expect(res.body.sent).toEqual([leaseId])
  })
})

/**
 * LA RELANCE AUTOMATIQUE PAR E-MAIL, jalon J+7 — la plus petite tranche VRAIE.
 *
 * La grille tarifaire vend « SMS et e-mail déclenchés à J+1, J+7, J+15 » depuis
 * le premier jour, et rien ne le produisait : `envoyerSms` rend `false` sans
 * fournisseur, aucun gabarit de courriel n'existait, aucun planificateur non
 * plus. Ce lot construit un seul jalon, par e-mail seulement — J+7, le seul
 * sans ambiguïté de délai (J+1) ni de sévérité (J+15, qui chevauche la mise en
 * demeure) — et le rend VRAI de bout en bout : calcul, garde de course, envoi.
 *
 * `only: 'milestones'` est la forme que le futur cron empruntera. Ces cas
 * n'exercent que cette forme : le geste manuel « Relancer les retards » sans ce
 * paramètre continue de ne toucher que le SMS, inchangé par ce lot.
 */
describe('relance automatique par e-mail — jalon J+7', () => {
  let parkId: string
  let proprio: string
  let leaseId: string

  /** Minuit UTC du jour courant, moins `n` jours — même borne que `debutDuJour`. */
  function ilYA(joursEntiers: number): Date {
    const maintenant = new Date()
    const minuit = new Date(
      Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
    )
    return new Date(minuit.getTime() - joursEntiers * 86_400_000)
  }

  async function echeanceAJours(joursDeRetard: number, rentMinor = 145000) {
    return prisma.rentCharge.create({
      data: {
        leaseId,
        periodStart: new Date('2026-06-01T00:00:00Z'),
        dueOn: ilYA(joursDeRetard),
        rentMinor,
      },
      select: { id: true },
    })
  }

  beforeEach(async () => {
    const p = await inscrire('bailleur-email@example.com', { parkName: 'Parc' })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const bail = await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({ unitId: logement.body.unit.id, fullName: 'Paul Kamga', startsOn: '2026-01-01' })
    leaseId = bail.body.lease.id
  })

  it('envoie un courriel au jalon J+7, et trace un envoi RÉUSSI', async () => {
    await prisma.tenant.updateMany({ where: { parkId }, data: { email: 'paul@example.com' } })
    await echeanceAJours(7)

    const envoyes: { destinataire: string; sujet: string }[] = []
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail(destinataire: string, sujet: string) {
        envoyes.push({ destinataire, sujet })
        return true
      },
    })
    try {
      const res = await request(serveur)
        .post(`/api/parks/${parkId}/reminders`)
        .set('Cookie', proprio)
        .send({ leaseIds: [leaseId], only: 'milestones' })

      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(envoyes).toHaveLength(1)
      expect(envoyes[0]!.destinataire).toBe('paul@example.com')

      const trace = await prisma.rentReminderEmail.findFirstOrThrow({ where: { leaseId } })
      expect(trace.milestone).toBe(7)
      // Réellement PARTI : `envoyerEmail` a rendu `true`.
      expect(trace.deliveredAt).not.toBeNull()
    } finally {
      rendre()
    }
  })

  it('n’envoie pas deux courriels au même bail dans la même journée', async () => {
    await prisma.tenant.updateMany({ where: { parkId }, data: { email: 'paul@example.com' } })
    await echeanceAJours(7)

    let envoyes = 0
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail() {
        envoyes += 1
        return true
      },
    })
    try {
      await request(serveur)
        .post(`/api/parks/${parkId}/reminders`)
        .set('Cookie', proprio)
        .send({ leaseIds: [leaseId], only: 'milestones' })
      await request(serveur)
        .post(`/api/parks/${parkId}/reminders`)
        .set('Cookie', proprio)
        .send({ leaseIds: [leaseId], only: 'milestones' })

      expect(envoyes).toBe(1)
      expect(await prisma.rentReminderEmail.count({ where: { leaseId } })).toBe(1)
    } finally {
      rendre()
    }
  })

  /**
   * LA COURSE, pour de bon — sur le modèle de `auth/routes.test.ts`.
   *
   * Un test SÉQUENTIEL, comme le cas précédent, ne prouve rien ici : il ne
   * peut jamais surprendre deux requêtes en train de lire « rien encore » en
   * même temps. Seules deux exécutions VRAIMENT simultanées éprouvent la
   * contrainte UNIQUE de `RentReminderEmail` — c'est elle, et non une garde en
   * mémoire, qui doit trancher.
   */
  it('LA COURSE : deux exécutions simultanées n’envoient qu’UN SEUL courriel', async () => {
    await prisma.tenant.updateMany({ where: { parkId }, data: { email: 'paul@example.com' } })
    await echeanceAJours(7)

    let envoyes = 0
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail() {
        envoyes += 1
        return true
      },
    })
    try {
      const [a, b] = await Promise.all([
        request(serveur)
          .post(`/api/parks/${parkId}/reminders`)
          .set('Cookie', proprio)
          .send({ leaseIds: [leaseId], only: 'milestones' }),
        request(serveur)
          .post(`/api/parks/${parkId}/reminders`)
          .set('Cookie', proprio)
          .send({ leaseIds: [leaseId], only: 'milestones' }),
      ])

      expect([a.status, b.status], `${a.status}/${JSON.stringify(a.body)} ${b.status}/${JSON.stringify(b.body)}`).toEqual([200, 200])
      expect(envoyes).toBe(1)
      expect(await prisma.rentReminderEmail.count({ where: { leaseId } })).toBe(1)
    } finally {
      rendre()
    }
  })

  it('ne relance jamais un bail soldé, même au jalon', async () => {
    await prisma.tenant.updateMany({ where: { parkId }, data: { email: 'paul@example.com' } })
    const charge = await echeanceAJours(7)
    await prisma.payment.create({
      data: {
        chargeId: charge.id,
        amountMinor: 145000,
        // La devise voyage avec l’argent reçu — voir `Payment.currency`.
        currency: 'XAF',
        method: 'cash',
        paidOn: new Date(),
        recordedById: (
          await prisma.userAccount.findUniqueOrThrow({ where: { email: 'bailleur-email@example.com' } })
        ).id,
      },
    })

    let envoyes = 0
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail() {
        envoyes += 1
        return true
      },
    })
    try {
      await request(serveur)
        .post(`/api/parks/${parkId}/reminders`)
        .set('Cookie', proprio)
        .send({ leaseIds: [leaseId], only: 'milestones' })

      expect(envoyes).toBe(0)
      expect(await prisma.rentReminderEmail.count({ where: { leaseId } })).toBe(0)
    } finally {
      rendre()
    }
  })

  it('ne tente aucun envoi pour un locataire sans adresse, et le rend dans la réponse', async () => {
    // Pas d'e-mail renseigné : c'est l'état par défaut du jeu de fixtures.
    await echeanceAJours(7)

    let envoyes = 0
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail() {
        envoyes += 1
        return true
      },
    })
    try {
      const res = await request(serveur)
        .post(`/api/parks/${parkId}/reminders`)
        .set('Cookie', proprio)
        .send({ leaseIds: [leaseId], only: 'milestones' })

      expect(envoyes).toBe(0)
      expect(await prisma.rentReminderEmail.count({ where: { leaseId } })).toBe(0)
      // Le rendu doit dire QUI est injoignable, comme `AnnounceModal` le fait déjà.
      expect(res.body.emailSkipped).toEqual([{ leaseId, reason: 'no_email' }])
    } finally {
      rendre()
    }
  })

  it('ne relance par e-mail que dans un appel « jalons » — le geste manuel reste inchangé', async () => {
    await prisma.tenant.updateMany({ where: { parkId }, data: { email: 'paul@example.com' } })
    await echeanceAJours(7)

    let envoyes = 0
    const rendre = remplacerMessagerie({
      async envoyerSms() {
        return false
      },
      async envoyerEmail() {
        envoyes += 1
        return true
      },
    })
    try {
      // Aucun `only` : le geste général « Relancer les retards », inchangé.
      await request(serveur)
        .post(`/api/parks/${parkId}/reminders`)
        .set('Cookie', proprio)
        .send({ leaseIds: [leaseId] })

      expect(envoyes).toBe(0)
      expect(await prisma.rentReminderEmail.count({ where: { leaseId } })).toBe(0)
    } finally {
      rendre()
    }
  })
})

/**
 * LE RANG D'UNE RELANCE, dérivé à la lecture.
 *
 * Le produit comptait déjà — la garde « déjà relancé aujourd'hui » lit ces
 * mêmes lignes et les clefe sur `params.leaseId` — mais le compte ne sortait
 * jamais : le bailleur voyait N cartes indistinctes et relançait une cinquième
 * fois sans savoir qu'il en avait envoyé quatre.
 *
 * Dérivé et non stocké. Une colonne figée serait opposable quoi qu'il arrive
 * aux voisines, mais elle coûterait une migration, un remplissage rétroactif et
 * un index unique contre deux relances simultanées. Le rang dérivé vaut
 * immédiatement pour les relances déjà en base. Ce qu'il coûte : une purge de
 * rétention le renuméroterait — aucune n'existe, et la pièce qu'on oppose
 * vraiment n'est pas la relance mais la mise en demeure.
 */
describe('rang des relances', () => {
  let parkId: string
  let proprio: string
  let leaseId: string
  let unitId: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
    const bail = await prisma.lease.findFirstOrThrow({
      where: { unit: { building: { parkId } } },
      select: { id: true, unitId: true },
    })
    leaseId = bail.id
    unitId = bail.unitId
  })

  const portefeuille = () =>
    request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)

  interface NotifApi {
    id: string
    messageKey: string
    rank: number | null
    channel: string
    sentAt: string | null
    params: { leaseId?: string }
  }

  /** Une relance posée directement, pour maîtriser les dates. */
  async function poserRelance(bail: string, unite: string, joursEnArriere: number) {
    return prisma.notification.create({
      data: {
        parkId,
        kind: 'payment',
        messageKey: 'rentReminder',
        params: { leaseId: bail, tenant: 'X', count: 1, amount: 1000 },
        severity: 'medium',
        unitId: unite,
        createdAt: new Date(Date.now() - joursEnArriere * 86_400_000),
      },
      select: { id: true },
    })
  }

  it('numérote du plus ANCIEN au plus récent', async () => {
    const premiere = await poserRelance(leaseId, unitId, 21)
    const seconde = await poserRelance(leaseId, unitId, 14)
    const troisieme = await poserRelance(leaseId, unitId, 7)

    const vue = await portefeuille()
    const parId = new Map<string, NotifApi>(
      (vue.body.notifications as NotifApi[]).map((n) => [n.id, n]),
    )
    // L'ordre de la réponse est le plus récent d'abord — celui de l'écran. Le
    // rang, lui, se compte dans l'autre sens : la première relance porte le n° 1.
    expect(parId.get(premiere.id)!.rank).toBe(1)
    expect(parId.get(seconde.id)!.rank).toBe(2)
    expect(parId.get(troisieme.id)!.rank).toBe(3)
  })

  /**
   * Le rang se compte par BAIL, jamais par unité.
   *
   * Deux locataires successifs dans le même logement ne partagent pas un
   * compteur de relances : le nouvel arrivant recevrait « rappel n° 4 » à sa
   * première relance, pour des impayés qui ne sont pas les siens. C'est la
   * même règle que la garde quotidienne, qui a déjà été corrigée dans ce sens.
   */
  it('ne partage pas le compteur entre deux baux du même logement', async () => {
    await poserRelance(leaseId, unitId, 21)
    await poserRelance(leaseId, unitId, 14)

    await prisma.lease.update({
      where: { id: leaseId },
      data: { status: 'ended', endsOn: new Date() },
    })
    const suivant = await prisma.tenant.create({ data: { parkId, fullName: 'Locataire suivant' } })
    const bailSuivant = await prisma.lease.create({
      data: { unitId, tenantId: suivant.id, startsOn: new Date(), rentMinor: 100000, status: 'active' },
    })
    const sienne = await poserRelance(bailSuivant.id, unitId, 1)

    const vue = await portefeuille()
    const notifs = vue.body.notifications as NotifApi[]
    // Sa PREMIÈRE relance porte le n° 1, alors que le logement en a vu trois.
    expect(notifs.find((n) => n.id === sienne.id)!.rank).toBe(1)
  })

  it('ne numérote pas ce qui n’est pas une relance', async () => {
    const vue = await portefeuille()
    const notifs = vue.body.notifications as NotifApi[]
    const autres = notifs.filter((n) => n.messageKey !== 'rentReminder')
    expect(autres.length).toBeGreaterThan(0)
    for (const n of autres) expect(n.rank, n.messageKey).toBeNull()
  })

  /**
   * Le CANAL et la date d'envoi, que la réponse jetait.
   *
   * Le schéma les porte depuis l'origine avec sa justification — « sans trace
   * d'envoi, le produit relancerait deux fois le même locataire le même jour ».
   * Le `select` de la lecture les omettait tous les deux, si bien que le
   * bailleur ne pouvait pas distinguer un SMS parti d'une relance restée dans
   * le produit.
   */
  it('rend le canal et la date d’envoi', async () => {
    const vue = await portefeuille()
    const notifs = vue.body.notifications as NotifApi[]
    for (const n of notifs) expect(['in_app', 'email', 'sms']).toContain(n.channel)

    const relances = notifs.filter((n) => n.messageKey === 'rentReminder')
    expect(relances.length).toBeGreaterThan(0)
    // Le jeu porte les DEUX cas : une relance partie, deux restées ici. Sans cet
    // écart, l'écran ne pourrait pas montrer la différence.
    expect(relances.some((n) => n.sentAt !== null)).toBe(true)
    expect(relances.some((n) => n.sentAt === null)).toBe(true)
  })

  /**
   * La démonstration relance, ce qu'elle ne faisait pas.
   *
   * Ni `rentReminder` ni `formalNotice` n'y figuraient : les deux gabarits
   * existaient dans les deux dictionnaires et personne ne les voyait jamais
   * pendant qu'on développe. C'est ainsi qu'ils ont pu s'afficher en clé brute
   * en production sans qu'aucun regard ne s'y pose.
   */
  it('sème des relances rattachées à un bail', async () => {
    const vue = await portefeuille()
    const relances = (vue.body.notifications as NotifApi[]).filter(
      (n) => n.messageKey === 'rentReminder',
    )
    expect(relances.length).toBeGreaterThanOrEqual(3)
    // Rattachées à un BAIL : sans `params.leaseId`, ni la garde quotidienne ni
    // le rang ne fonctionnent, et les deux resteraient inertes en démonstration.
    for (const r of relances) expect(typeof r.params.leaseId).toBe('string')
    expect(new Set(relances.map((r) => r.rank)).size).toBe(relances.length)
  })
})

/**
 * LA LIGNE OWNER / MANAGER, gardée là où elle n'était pas.
 *
 * La doctrine du serveur est écrite et cohérente : le gestionnaire OPÈRE —
 * saisir, chiffrer, encaisser, relancer, quittancer, clore un chantier — et le
 * propriétaire ARBITRE : valider une dépense, retenir une caution, mettre en
 * demeure, effacer de l'argent ou une personne. Chaque paire faire/défaire est
 * du même côté de la ligne.
 *
 * Trois trous s'y étaient ouverts, tous invisibles au vert.
 *
 * 1. `deposits/:id/settle` — l'un des DEUX droits fondateurs de la ligne, celui
 *    dont le commentaire dit « il retient l'argent de quelqu'un » — n'avait
 *    aucun cas de refus. Son inverse `unsettle` non plus : les deux cas
 *    existants ouvrent une session propriétaire.
 *
 * 2. Trois cas portaient « gestionnaire » dans leur titre en exerçant une
 *    session PROPRIÉTAIRE. Ils passaient parce que les deux rôles sont
 *    indiscernables en lecture — ils gardaient donc l'absence de cloisonnement,
 *    pas le rôle. Renommés ; ce que leur titre promettait est ici.
 *
 * 3. Un gestionnaire pouvait RECRUTER un gestionnaire. Le code `GES` émis, le
 *    pair entrait sur tout le parc sans que le propriétaire ait rien à dire — et
 *    sans qu'il puisse l'en retirer, aucune route ne révoquant une adhésion.
 *    Silencieux, et irréversible.
 */
describe('la ligne entre le propriétaire et son gestionnaire', () => {
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const d = await inscrire('diane@example.com')
    gestionnaire = d.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({
      data: { userId: compte.id, parkId, role: 'manager' },
    })
  })

  /**
   * Ce que les trois cas renommés annonçaient sans le vérifier : le gestionnaire
   * voit TOUT le parc. `unitesVisibles` ne connaît que la frontière
   * locataire / non-locataire, et c'est un choix — « un gestionnaire opère tout
   * le parc, et lui attacher une unité laisserait croire à un périmètre qui
   * n'existe pas ». Un choix non gardé finit par se perdre.
   */
  it('lui donne tout le parc en lecture, comme au propriétaire', async () => {
    const sien = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', gestionnaire)
    const celui = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', proprio)

    expect(sien.status).toBe(200)
    const unites = (b: { buildings: { units: { id: string }[] }[] }) =>
      b.buildings.flatMap((i) => i.units.map((u) => u.id)).sort()
    expect(unites(sien.body)).toEqual(unites(celui.body))
    expect(unites(sien.body).length).toBeGreaterThan(5)
  })

  /**
   * L'ARBITRAGE D'UNE CAUTION, le droit dont le refus n'était gardé nulle part.
   *
   * Un refus qui laisse une trace n'est pas un refus : on vérifie que la caution
   * n'a pas bougé, pas seulement que la route a rendu 403.
   */
  it('lui refuse l’arbitrage d’une caution', async () => {
    const caution = await prisma.deposit.findFirstOrThrow({
      where: { lease: { unit: { building: { parkId } } }, status: 'held' },
      select: { id: true, withheldMinor: true },
    })

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', gestionnaire)
      .send({ withheldMinor: 20000, reason: 'Peinture à reprendre dans le séjour' })
    expect(res.status).toBe(403)

    const apres = await prisma.deposit.findUniqueOrThrow({ where: { id: caution.id } })
    expect(apres.status).toBe('held')
    expect(apres.withheldMinor).toBe(caution.withheldMinor)
    expect(apres.settledAt).toBeNull()
  })

  /**
   * Et son INVERSE. Rendre à quelqu'un le pouvoir de défaire une décision lui
   * donne cette décision par la bande : c'est le raisonnement que la route de
   * `unapprove` porte déjà en commentaire, et il vaut ici mot pour mot.
   */
  it('lui refuse aussi de défaire un arbitrage', async () => {
    const caution = await prisma.deposit.findFirstOrThrow({
      where: { lease: { unit: { building: { parkId } } }, status: 'held' },
      select: { id: true },
    })
    const arbitre = await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: 20000, reason: 'Peinture à reprendre dans le séjour' })
    expect(arbitre.status, JSON.stringify(arbitre.body)).toBe(200)

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/unsettle`)
      .set('Cookie', gestionnaire)
    expect(res.status).toBe(403)

    const apres = await prisma.deposit.findUniqueOrThrow({ where: { id: caution.id } })
    expect(apres.withheldMinor).toBe(20000)
  })

  /**
   * RECRUTER UN GESTIONNAIRE, et c'est la trouvaille de ce lot.
   *
   * Rien n'empêchait un gestionnaire d'émettre un code `GES`. Le pair invité
   * entrait sur l'intégralité du parc — `unitesVisibles` ne restreint que le
   * locataire — sans validation du propriétaire, et sans retour possible :
   * aucune route ne révoque une adhésion, et `Invitation.revokedAt` est lu sans
   * jamais être écrit.
   *
   * Ce n'était pas une faille : la route faisait exactement ce qu'on lui
   * demandait. C'est la demande qui était trop large.
   */
  it('lui refuse d’émettre un code de gestionnaire', async () => {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', gestionnaire)
      .send({ role: 'manager' })
    expect(res.status).toBe(403)

    // Un refus qui laisse une invitation en base n'est pas un refus : le code
    // serait consommable même sans avoir été rendu à l'appelant.
    expect(await prisma.invitation.count({ where: { parkId, role: 'manager' } })).toBe(0)
  })

  /**
   * Le code LOCATAIRE, lui, reste le sien.
   *
   * Sans ce cas, fermer la route aux deux natures passerait au vert : on aurait
   * corrigé une escalade en retirant au gestionnaire son geste le plus courant.
   */
  it('lui laisse émettre un code de locataire, dont c’est le métier', async () => {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', gestionnaire)
      .send({ role: 'tenant' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.code).toMatch(/^LOC-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  })

  it('laisse le propriétaire recruter un gestionnaire', async () => {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', proprio)
      .send({ role: 'manager' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.code).toMatch(/^GES-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const bail = await request(serveur)
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

    const res = await request(serveur)
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
      where: { parkId, messageKey: 'formalNotice' },
    })
    expect(avis.severity).toBe('high')
  })

  it('la refuse au gestionnaire, qui propose mais ne décide pas', async () => {
    await impaye()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/leases/${leaseId}/formal-notice`)
      .set('Cookie', gestionnaire)
      .send({ reason: MOTIF })

    expect(res.status).toBe(403)
    // Un refus qui laisse une trace n'est pas un refus.
    expect(await prisma.auditEvent.count({ where: { action: 'lease.formal_notice' } })).toBe(0)
  })

  it('la refuse quand rien n’est dû', async () => {
    const res = await request(serveur)
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

    const res = await request(serveur)
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', autre.cookie)

    const res = await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/leases/${leaseId}/formal-notice`)
      .set('Cookie', autre.cookie)
      .send({ reason: MOTIF })

    // 404 et non 403 : un 403 confirmerait que ce bail existe ailleurs.
    expect(res.status).toBe(404)
  })
})

/**
 * Le cycle d'une intervention.
 *
 * Le modèle porte quatre états depuis le premier jour et une seule transition
 * était exposée : la validation du devis. Un compte réel ne pouvait donc rien
 * déclarer, rien chiffrer, rien clore — et `approved` était en pratique
 * TERMINAL : un devis validé restait « à faire » indéfiniment, donc la liste
 * des travaux ne pouvait que grandir.
 */
/**
 * L'ORIGINE d'une intervention.
 *
 * Jusqu'ici elle naissait forcément d'un signalement de locataire — c'était le
 * seul chemin ouvert par l'interface, et l'état vide de l'écran le disait en
 * toutes lettres : « une intervention naît d'un signalement de locataire ». Un
 * bailleur qui remplaçait un chauffe-eau de sa propre initiative n'avait donc
 * aucun endroit où l'enregistrer, et la dépense n'existait nulle part.
 *
 * La route, elle, acceptait déjà les trois rôles. La capacité existait, seule
 * l'interface la refusait — et rien ne distinguait ce qu'on subit de ce qu'on
 * décide.
 */
describe('origine des interventions', () => {
  let parkId: string
  let proprio: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
  })

  const portefeuille = (cookie: string) =>
    request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)

  interface TravailApi {
    id: string
    unitId: string
    title: string
    origin: 'tenantReport' | 'ownerInitiative'
    reportedBy: string | null
  }

  async function uniteDe(label: string) {
    const vue = await portefeuille(proprio)
    for (const immeuble of vue.body.buildings) {
      const u = immeuble.units.find((x: { label: string }) => x.label === label)
      if (u) return u
    }
    throw new Error(`unité ${label} introuvable`)
  }

  it('rend l’origine de chaque intervention', async () => {
    const vue = await portefeuille(proprio)
    const travaux: TravailApi[] = vue.body.works
    expect(travaux.length).toBeGreaterThan(0)
    for (const t of travaux) expect(['tenantReport', 'ownerInitiative']).toContain(t.origin)
    // Les DEUX natures sont représentées : un jeu qui n'en montrerait qu'une
    // laisserait passer une origine écrite en dur.
    expect(travaux.some((t) => t.origin === 'ownerInitiative')).toBe(true)
    expect(travaux.some((t) => t.origin === 'tenantReport')).toBe(true)
  })

  /**
   * Le NOM du déclarant, que la réponse ne rendait pas.
   *
   * `reportedByTenantId` était écrit depuis l'origine et lu nulle part, faute
   * de relation : le bailleur recevait un problème sans savoir qui l'avait vu,
   * donc sans pouvoir rappeler ni faire ouvrir la porte.
   */
  it('nomme le déclarant, locataire ou bailleur', async () => {
    const vue = await portefeuille(proprio)
    const travaux: TravailApi[] = vue.body.works
    for (const t of travaux) {
      expect(typeof t.reportedBy, t.title).toBe('string')
      expect(t.reportedBy!.length).toBeGreaterThan(0)
    }
  })

  /**
   * L'origine se DÉRIVE DU RÔLE, elle ne se saisit pas.
   *
   * C'est l'invariant qui donne son sens au champ : un client qui pourrait
   * l'annoncer pourrait mentir, et une intervention étiquetée « initiative du
   * bailleur » alors qu'un locataire l'a ouverte inverserait la charge d'une
   * dépense.
   */
  it('étiquette « signalement » ce qu’un locataire ouvre', async () => {
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })
    const sien = await prisma.lease.findFirstOrThrow({
      where: { tenant: { userId: compte.id } },
      select: { unitId: true },
    })

    const cree = await request(serveur)
      .post(`/api/parks/${parkId}/units/${sien.unitId}/works`)
      .set('Cookie', locataire.cookie)
      .send({
        title: 'Volet roulant bloqué en position haute',
        trade: 'other',
        urgency: 'normal',
        // Le client ANNONCE le contraire : le serveur ne doit pas l'écouter.
        origin: 'ownerInitiative',
      })
    expect(cree.status).toBe(201)

    const vue = await portefeuille(proprio)
    const travaux: TravailApi[] = vue.body.works
    const nouveau = travaux.find((t) => t.id === cree.body.work.id)!
    expect(nouveau.origin).toBe('tenantReport')
    expect(nouveau.reportedBy).toBe('Charles Ngassa')
  })

  it('étiquette « initiative » ce que le bailleur ouvre, et le nomme', async () => {
    const unite = await uniteDe('A2')
    const cree = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unite.id}/works`)
      .set('Cookie', proprio)
      .send({
        title: 'Remplacement du chauffe-eau avant panne',
        trade: 'plumbing',
        urgency: 'low',
      })
    expect(cree.status).toBe(201)

    const vue = await portefeuille(proprio)
    const travaux: TravailApi[] = vue.body.works
    const nouveau = travaux.find((t) => t.id === cree.body.work.id)!
    expect(nouveau.origin).toBe('ownerInitiative')
    // L'intervention naissait SANS AUCUN AUTEUR dans ce cas : ni nom, ni
    // compte, rien à opposer six mois plus tard à « qui a décidé cette
    // dépense ». `approvedById` existait pour la validation, rien pour
    // l'ouverture.
    expect(nouveau.reportedBy).not.toBeNull()
  })

  /**
   * Le cloisonnement ne bouge pas.
   *
   * Le locataire lit les interventions de SON logement. L'origine et le nom du
   * déclarant en sont deux champs de plus — et le nom d'un voisin n'a rien à
   * faire chez lui.
   */
  it('ne livre pas au locataire le déclarant d’un autre logement', async () => {
    const locataire = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.tenant.updateMany({
      where: { parkId, fullName: 'Charles Ngassa' },
      data: { userId: compte.id },
    })
    const sien = await prisma.lease.findFirstOrThrow({
      where: { tenant: { userId: compte.id } },
      select: { unitId: true },
    })

    const vue = await portefeuille(locataire.cookie)
    const travaux: TravailApi[] = vue.body.works
    expect(travaux.every((t) => t.unitId === sien.unitId)).toBe(true)
  })
})

describe('cycle des interventions', () => {
  let parkId: string
  let proprio: string
  let gestionnaire: string
  let unitId: string

  beforeEach(async () => {
    const p = await inscrire('travaux@example.com', { parkName: 'Parc' })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    unitId = logement.body.unit.id

    const g = await inscrire('diane3@example.com')
    gestionnaire = g.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane3@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
  })

  async function declarer(cookie = proprio) {
    return request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', cookie)
      .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'blocking' })
  }

  it('numérote la première intervention d’un parc qui n’a jamais été semé', async () => {
    /**
     * Le compteur de références n'est créé qu'au semis de la démonstration. Un
     * compte neuf n'en a aucun : avec un `update`, sa toute première
     * intervention aurait échoué sur une ligne absente — c'est-à-dire pour tout
     * client réel, et jamais en démonstration.
     */
    const res = await declarer()

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.work.reference).toMatch(/^SIG-\d{4}-001$/)
    // `reported` : déclarer n'est pas chiffrer.
    expect(res.body.work.status).toBe('reported')
  })

  it('ne réutilise pas un numéro d’une déclaration à l’autre', async () => {
    const un = await declarer()
    const deux = await declarer()

    expect(deux.body.work.reference).not.toBe(un.body.work.reference)
    expect(deux.body.work.reference).toMatch(/-002$/)
  })

  it('laisse le gestionnaire chiffrer, et le propriétaire seul valider', async () => {
    const { body } = await declarer()
    const workId = body.work.id

    // Proposer EST le métier du gestionnaire.
    const devis = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/quote`)
      .set('Cookie', gestionnaire)
      .send({ quotedAmountMinor: 42000 })
    expect(devis.status, JSON.stringify(devis.body)).toBe(200)
    expect(devis.body.work.status).toBe('quoted')

    // Décider ne l'est pas.
    const refus = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/approve`)
      .set('Cookie', gestionnaire)
    expect(refus.status).toBe(403)
  })

  it('refuse de rechiffrer un devis déjà validé', async () => {
    const { body } = await declarer()
    const workId = body.work.id
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/quote`)
      .set('Cookie', proprio)
      .send({ quotedAmountMinor: 42000 })
    await request(serveur).patch(`/api/parks/${parkId}/works/${workId}/approve`).set('Cookie', proprio)

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/quote`)
      .set('Cookie', proprio)
      .send({ quotedAmountMinor: 900000 })

    // Changer le montant sous la décision du propriétaire, après coup et sans
    // qu'il en soit informé.
    expect(res.status).toBe(409)
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: workId } })
    expect(apres.quotedAmountMinor).toBe(42000)
    expect(apres.approvedAmountMinor).toBe(42000)
  })

  it('clôt une intervention validée, et la sort de la liste des travaux à faire', async () => {
    const { body } = await declarer()
    const workId = body.work.id
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/quote`)
      .set('Cookie', proprio)
      .send({ quotedAmountMinor: 42000 })
    await request(serveur).patch(`/api/parks/${parkId}/works/${workId}/approve`).set('Cookie', proprio)

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/complete`)
      .set('Cookie', gestionnaire)
      .send({ completedOn: '2026-08-10' })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: workId } })
    expect(apres.status).toBe('done')
    expect(apres.completedOn?.toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })

  it('clôt aussi une intervention sans devis : tout n’a pas de coût', async () => {
    const { body } = await declarer()

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${body.work.id}/complete`)
      .set('Cookie', gestionnaire)
      .send({})

    // Une intervention jamais chiffrée n'a rien à faire arbitrer : exiger une
    // validation la retiendrait pour une dépense qui n'existe pas.
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  })

  it('refuse de clore un devis en attente d’arbitrage', async () => {
    const { body } = await declarer()
    const workId = body.work.id
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/quote`)
      .set('Cookie', proprio)
      .send({ quotedAmountMinor: 42000 })

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/complete`)
      .set('Cookie', gestionnaire)
      .send({})

    /**
     * C'est le contournement qui compte ici, pas l'état.
     *
     * Clore un devis en attente le ferait disparaître de la carte
     * « ce qui demande une décision » du propriétaire — une décision qu'il n'a
     * jamais prise, pour un montant engagé sans lui.
     */
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('awaiting_approval')
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: workId } })
    expect(apres.status).toBe('quoted')
  })

  it('refuse de clore deux fois', async () => {
    const { body } = await declarer()
    const workId = body.work.id
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/complete`)
      .set('Cookie', proprio)
      .send({ completedOn: '2026-08-01' })

    const second = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/complete`)
      .set('Cookie', proprio)
      .send({ completedOn: '2026-08-20' })

    expect(second.status).toBe(409)
    // La date du premier constat est intacte : c'est elle qui fait foi.
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: workId } })
    expect(apres.completedOn?.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('refuse au locataire de clore une intervention', async () => {
    /**
     * La garde qui compte, et la seule qui tienne : le masquage du bouton à
     * l'écran évite d'offrir un geste voué au refus, il ne protège rien. Une
     * requête forgée ne passe pas par l'écran.
     */
    const { body } = await declarer()
    const l = await inscrire('locataire3@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'locataire3@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${body.work.id}/complete`)
      .set('Cookie', l.cookie)
      .send({})

    expect(res.status).toBe(403)
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: body.work.id } })
    expect(apres.status).toBe('reported')
  })

  it('rouvre une clôture, et rend l’état d’avant plutôt qu’un état choisi', async () => {
    /**
     * L'état de retour est DÉDUIT : `approved` quand la dépense avait été
     * engagée, `reported` sinon. Rendre à `quoted` un devis validé effacerait la
     * décision du propriétaire — il faudrait la reprendre, et le montant serait
     * de nouveau en suspens.
     */
    const { body } = await declarer()
    const workId = body.work.id
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/quote`)
      .set('Cookie', proprio)
      .send({ quotedAmountMinor: 42000 })
    await request(serveur).patch(`/api/parks/${parkId}/works/${workId}/approve`).set('Cookie', proprio)
    await request(serveur).patch(`/api/parks/${parkId}/works/${workId}/complete`).set('Cookie', proprio).send({})

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/reopen`)
      .set('Cookie', gestionnaire)

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.work.status).toBe('approved')
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: workId } })
    // La date de constat s'efface avec la clôture qu'elle datait.
    expect(apres.completedOn).toBeNull()
    expect(apres.approvedAmountMinor).toBe(42000)
  })

  it('rend une intervention jamais chiffrée à l’état déclaré', async () => {
    const { body } = await declarer()
    const workId = body.work.id
    await request(serveur).patch(`/api/parks/${parkId}/works/${workId}/complete`).set('Cookie', proprio).send({})

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/reopen`)
      .set('Cookie', proprio)

    expect(res.body.work.status).toBe('reported')
  })

  it('refuse de rouvrir ce qui n’est pas clos', async () => {
    const { body } = await declarer()

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${body.work.id}/reopen`)
      .set('Cookie', proprio)

    // Sans quoi un devis en attente reculerait vers l'état déclaré, et le
    // montant proposé disparaîtrait de la carte des arbitrages.
    expect(res.status).toBe(409)
  })

  it('laisse le locataire signaler sur SON logement, et le nomme', async () => {
    /**
     * L'origine normale d'une intervention.
     *
     * `reportedByTenantId` existait au modèle depuis le premier jour et rien ne
     * l'écrivait : personne ne pouvait signaler. L'écran des travaux disait
     * pourtant lui-même qu'« une intervention naît d'un signalement de
     * locataire, jamais d'une saisie du bailleur » — la chaîne partait de son
     * deuxième maillon.
     */
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01' })
    const l = await inscrire('charles@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    const fiche = await prisma.tenant.findFirstOrThrow({ where: { fullName: 'Charles Ngassa' } })
    await prisma.tenant.update({ where: { id: fiche.id }, data: { userId: compte.id } })

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/works`)
      .set('Cookie', l.cookie)
      .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'blocking' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const cree = await prisma.workOrder.findUniqueOrThrow({ where: { id: res.body.work.id } })
    // Le bailleur doit savoir QUI a vu le problème : sans cela il ne peut ni
    // rappeler, ni faire ouvrir la porte.
    expect(cree.reportedByTenantId).toBe(fiche.id)
    // Et il déclare, il n'ouvre pas un chantier.
    expect(cree.status).toBe('reported')
  })

  it('refuse au locataire de signaler sur le logement d’un autre', async () => {
    const autreLogement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${(await prisma.building.findFirstOrThrow({ where: { parkId } })).id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'B2', type: 'T2', surfaceSqm: 50, baseRentMinor: 100000 })

    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01' })
    const l = await inscrire('charles2@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'charles2@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    const fiche = await prisma.tenant.findFirstOrThrow({ where: { fullName: 'Charles Ngassa' } })
    await prisma.tenant.update({ where: { id: fiche.id }, data: { userId: compte.id } })

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/units/${autreLogement.body.unit.id}/works`)
      .set('Cookie', l.cookie)
      .send({ title: 'Fuite', trade: 'plumbing' })

    // Un signalement chez le voisin, notifié au bailleur, sur un logement qui
    // n'est pas le sien. 404 et non 403 : un 403 confirmerait qu'il existe.
    expect(res.status).toBe(404)
    expect(await prisma.workOrder.count({ where: { unitId: autreLogement.body.unit.id } })).toBe(0)
  })

  it('ne déclare rien sur le logement d’un autre parc', async () => {
    const autre = await inscrire('voisin3@example.com', { parkName: 'Autre parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', autre.cookie)

    const res = await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/units/${unitId}/works`)
      .set('Cookie', autre.cookie)
      .send({ title: 'Fuite', trade: 'plumbing' })

    // 404 et non 403 : un 403 confirmerait que ce logement existe ailleurs.
    expect(res.status).toBe(404)
  })
})

/**
 * Défaire les deux gestes qui engagent de l'argent.
 *
 * Valider un devis engage une dépense ; arbitrer une caution retient l'argent de
 * quelqu'un. Ce sont les deux droits qui définissent le propriétaire, et aucun
 * des deux n'avait de retour en arrière : une erreur de ligne dans une liste se
 * réparait hors du produit, ou pas du tout.
 */
describe('défaire un arbitrage', () => {
  let parkId: string
  let proprio: string
  let gestionnaire: string

  beforeEach(async () => {
    const p = await inscrire('arbitre@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const g = await inscrire('diane4@example.com')
    gestionnaire = g.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane4@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
  })

  async function devisValide() {
    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const devis = pf.body.works.find((w: { status: string }) => w.status === 'quoted')
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${devis.id}/approve`)
      .set('Cookie', proprio)
    return devis.id as string
  }

  it('rend le devis à l’arbitrage, et efface le seul montant engagé', async () => {
    const workId = await devisValide()

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/unapprove`)
      .set('Cookie', proprio)

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: workId } })
    expect(apres.status).toBe('quoted')
    // Le devis EXISTE toujours : c'est l'accord qui est retiré, pas la
    // proposition. Effacer le montant proposé obligerait à tout redemander.
    expect(apres.quotedAmountMinor).not.toBeNull()
    expect(apres.approvedAmountMinor).toBeNull()
    expect(apres.approvedAt).toBeNull()
  })

  it('la refuse au gestionnaire, qui n’a pas le droit de valider', async () => {
    const workId = await devisValide()

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/unapprove`)
      .set('Cookie', gestionnaire)

    // Lui rendre le pouvoir d'effacer une décision qu'il ne peut pas prendre
    // reviendrait à lui donner ce droit par la bande.
    expect(res.status).toBe(403)
    const apres = await prisma.workOrder.findUniqueOrThrow({ where: { id: workId } })
    expect(apres.status).toBe('approved')
  })

  it('refuse de défaire l’accord d’un travail déjà terminé', async () => {
    const workId = await devisValide()
    await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/complete`)
      .set('Cookie', proprio)
      .send({})

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/works/${workId}/unapprove`)
      .set('Cookie', proprio)

    /**
     * L'artisan est passé, la dépense est réelle. Défaire l'accord laisserait
     * une intervention faite et non engagée — un état que la comptabilité ne
     * sait pas lire. Il faut d'abord rouvrir : deux gestes pour deux faits.
     */
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('not_approved')
  })

  it('rend la caution à son état retenu, et garde les deux traces', async () => {
    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const caution = pf.body.deposits.find((d: { status: string }) => d.status !== 'returned')
    const depositId = (
      await prisma.deposit.findFirstOrThrow({ where: { lease: { unit: { label: caution.unit } } } })
    ).id

    await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${depositId}/settle`)
      .set('Cookie', proprio)
      .send({ withheldMinor: 38000, reason: 'Réserves de l’état des lieux.' })

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${depositId}/unsettle`)
      .set('Cookie', proprio)

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const apres = await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } })
    expect(apres.status).toBe('held')
    expect(apres.withheldMinor).toBe(0)
    expect(apres.withheldReason).toBeNull()

    /**
     * LES DEUX événements restent au journal.
     *
     * Le locataire a pu voir la retenue ; un dossier d'où les décisions
     * disparaissent ne défend plus personne. Et le retrait consigne le montant
     * défait, sans quoi le journal dirait qu'un arbitrage a été retiré sans dire
     * lequel.
     */
    const journal = await prisma.auditEvent.findMany({
      where: { parkId, entityId: depositId },
      orderBy: { createdAt: 'asc' },
    })
    expect(journal.map((e) => e.action)).toEqual(['deposit.settle', 'deposit.unsettle'])
    expect((journal[1]!.payload as { withheldMinor: number }).withheldMinor).toBe(38000)
  })

  it('refuse de défaire une caution jamais arbitrée', async () => {
    const caution = await prisma.deposit.findFirstOrThrow({
      where: { status: 'held', lease: { unit: { building: { parkId } } } },
    })

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/deposits/${caution.id}/unsettle`)
      .set('Cookie', proprio)

    expect(res.status).toBe(409)
  })
})

/**
 * États des lieux.
 *
 * La fonction manquait entièrement : les modèles existaient, la démonstration
 * en servait six, et aucune route ne permettait d'en créer un. L'écran n'avait
 * donc aucune commande — son test d'état vide le gardait explicitement, « le
 * produit ne sait pas en établir un ». C'est la seconde promesse vendue et non
 * tenue de la grille tarifaire, après les relances automatiques.
 */
describe('états des lieux', () => {
  let parkId: string
  let proprio: string
  let unitId: string

  beforeEach(async () => {
    const p = await inscrire('edl@example.com', { parkName: 'Parc' })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    unitId = logement.body.unit.id
  })

  async function avecBail(depositMinor?: number) {
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({
        unitId,
        fullName: 'Charles Ngassa',
        startsOn: '2026-01-01',
        ...(depositMinor ? { depositMinor } : {}),
      })
  }

  const RESERVE = {
    room: 'Cuisine',
    description: 'Rayure profonde sur le plan de travail.',
    severity: 'major' as const,
  }

  it('enregistre l’entrée avec ses réserves, et la rattache au bail', async () => {
    await avecBail()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({ kind: 'entry', rooms: 3, performedOn: '2026-01-02', findings: [RESERVE] })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const etat = await prisma.inspection.findUniqueOrThrow({
      where: { id: res.body.inspection.id },
      include: { findings: true },
    })
    // Rattaché au BAIL et non seulement au logement : la comparaison
    // entrée/sortie porte sur une occupation, pas sur des murs.
    expect(etat.leaseId).not.toBeNull()
    expect(etat.findings).toHaveLength(1)
    expect(etat.performedOn.toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })

  it('REFUSE de chiffrer une réserve d’entrée', async () => {
    await avecBail()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({ kind: 'entry', rooms: 3, findings: [{ ...RESERVE, costMinor: 25000 }] })

    /**
     * C'est la règle qui donne son sens au document d'entrée : il relève ce qui
     * est DÉJÀ abîmé, précisément pour que le locataire n'en réponde pas. Le
     * chiffrer reviendrait à lui facturer les dégâts du précédent — l'exact
     * inverse de la protection qu'il offre.
     */
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('entry_findings_not_billable')
    expect(await prisma.inspection.count()).toBe(0)
  })

  it('chiffre en revanche une réserve de sortie, et fige le total imputable', async () => {
    await avecBail()

    const res = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({
        kind: 'exit',
        rooms: 3,
        findings: [{ ...RESERVE, costMinor: 25000 }, { ...RESERVE, room: 'Salon', costMinor: 13000 }],
      })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const journal = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'inspection.record' },
    })
    // Le chiffre qui sera opposé au locataire lors de la restitution.
    expect((journal.payload as { billableMinor: number }).billableMinor).toBe(38000)
  })

  it('enregistre la caution encaissée avec le bail', async () => {
    /**
     * `deposit.create` n'existait QUE dans le semis de démonstration : un parc
     * réel ne pouvait porter aucune caution, donc l'écran « Cautions » restait
     * vide quoi qu'on fasse et les deux routes d'arbitrage n'avaient rien sur
     * quoi opérer. Toute une surface du produit était inatteignable.
     */
    await avecBail(180000)

    const caution = await prisma.deposit.findFirstOrThrow({
      where: { lease: { unit: { building: { parkId } } } },
    })
    expect(caution.heldMinor).toBe(180000)
    // `held` : encaissée et détenue. Elle ne devient arbitrable qu'à la sortie.
    expect(caution.status).toBe('held')
    expect(caution.withheldMinor).toBe(0)
  })

  it('admet un bail SANS caution : l’imposer bloquerait une saisie légitime', async () => {
    await avecBail()

    // Un locataire déjà en place dont on ne retrouve pas le montant doit
    // pouvoir être déclaré. Fabriquer un chiffre serait pire que l'absence.
    expect(await prisma.deposit.count()).toBe(0)
  })

  it('refuse une sortie sans bail : on ne quitte pas un logement qu’on n’occupe pas', async () => {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({ kind: 'exit', rooms: 3 })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('no_lease')
  })

  it('admet en revanche une entrée avant le bail : on constate avant de remettre les clés', async () => {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({ kind: 'entry', rooms: 3 })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('refuse un second document de la même nature sur le même bail', async () => {
    await avecBail()
    const corps = { kind: 'entry', rooms: 3 }
    await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send(corps)

    const second = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send(corps)

    // « Entrée et sortie comparées » : la comparaison suppose deux documents,
    // pas une pile où rien ne dit lequel fait foi.
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('already_recorded')
    expect(await prisma.inspection.count()).toBe(1)
  })

  it('date la signature quand un signataire est nommé, et pas autrement', async () => {
    await avecBail()

    const sans = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({ kind: 'entry', rooms: 3 })
    const nonSigne = await prisma.inspection.findUniqueOrThrow({
      where: { id: sans.body.inspection.id },
    })
    // Un état des lieux non signé n'engage personne. Le dater quand même le
    // ferait passer pour signé.
    expect(nonSigne.signedAt).toBeNull()

    const avec = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({ kind: 'exit', rooms: 3, signedByName: 'Charles Ngassa' })
    const signe = await prisma.inspection.findUniqueOrThrow({
      where: { id: avec.body.inspection.id },
    })
    expect(signe.signedAt).not.toBeNull()
    expect(signe.signedByName).toBe('Charles Ngassa')
  })

  it('propose au portefeuille ce que les réserves de sortie justifient', async () => {
    /**
     * La moitié manquante de « imputation chiffrée sur la caution ».
     *
     * Le montant était relevé à l'état des lieux, journalisé, puis ressaisi à la
     * main dans l'arbitrage : deux saisies pour un seul fait, dont la seconde
     * pouvait diverger de la première sans que rien ne le dise.
     */
    await avecBail(180000)
    await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({
        kind: 'exit',
        rooms: 3,
        findings: [
          { ...RESERVE, costMinor: 25000 },
          { ...RESERVE, room: 'Salon', costMinor: 13000 },
        ],
      })

    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const caution = pf.body.deposits[0]
    expect(caution.billableMinor).toBe(38000)
    // PROPOSÉ, jamais appliqué : la retenue reste une décision du propriétaire.
    expect(caution.withheldMinor).toBe(0)
    expect(caution.status).not.toBe('returned')
  })

  it('ne propose rien tant qu’aucune sortie n’a été établie', async () => {
    await avecBail(180000)
    await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({ kind: 'entry', rooms: 3, findings: [RESERVE] })

    /**
     * La réserve d'entrée est chiffrée DIRECTEMENT EN BASE, hors de l'API.
     *
     * C'est le seul moyen d'atteindre ce garde, et c'est aussi le seul cas
     * contre lequel il défend. La route refuse en 422 un coût à l'entrée, donc
     * aucune donnée créée par le produit ne peut le déclencher — première
     * version de ce cas : il passait même le filtre retiré, parce que la
     * réserve n'avait de toute façon aucun montant.
     *
     * Restent les données écrites autrement : une reprise d'historique, une
     * correction manuelle, une règle assouplie un jour. Un filtre de lecture qui
     * répète une règle d'écriture n'est pas redondant — il tient le jour où
     * l'écriture n'a pas eu lieu ici.
     */
    const reserve = await prisma.inspectionFinding.findFirstOrThrow({
      where: { inspection: { kind: 'entry' } },
    })
    await prisma.inspectionFinding.update({
      where: { id: reserve.id },
      data: { costMinor: 25000 },
    })

    const pf = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    // L'entrée ne s'impute pas : il n'y a rien à opposer au locataire.
    expect(pf.body.deposits[0].billableMinor).toBe(0)
  })

  it('n’établit rien sur le logement d’un autre parc', async () => {
    const autre = await inscrire('voisin4@example.com', { parkName: 'Autre parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', autre.cookie)

    const res = await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/units/${unitId}/inspections`)
      .set('Cookie', autre.cookie)
      .send({ kind: 'entry', rooms: 3 })

    expect(res.status).toBe(404)
  })
})

/**
 * Appel de loyers.
 *
 * Une échéance n'existait QUE comme effet de bord d'un encaissement. Le
 * locataire qui ne paie pas n'en avait donc aucune, et n'était JAMAIS en retard :
 * ni reste à percevoir, ni relance, ni mise en demeure. Toute la chaîne de
 * recouvrement — celle que la grille tarifaire vend — ne pouvait pas se
 * déclencher sur un parc réel. Elle ne se voyait qu'en démonstration, dont le
 * semis pose les échéances lui-même : le jeu de données masquait l'absence de la
 * fonction, comme il l'avait fait pour les cautions et les états des lieux.
 */
describe('appel de loyers', () => {
  let parkId: string
  let proprio: string
  let unitId: string

  beforeEach(async () => {
    const p = await inscrire('appel@example.com', { parkName: 'Parc' })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    unitId = logement.body.unit.id
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', proprio)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01', rentMinor: 145000 })
  })

  it('rend le loyer EXIGIBLE sans qu’un versement l’ait créé', async () => {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', proprio)
      .send({ periodStart: '2026-06-01' })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.issued).toBe(1)

    const echeance = await prisma.rentCharge.findFirstOrThrow({
      where: { lease: { unitId } },
    })
    // Le loyer du BAIL, et l'échéance au jour convenu.
    expect(echeance.rentMinor).toBe(145000)
    expect(echeance.dueOn.toISOString()).toBe('2026-06-05T00:00:00.000Z')
    // Aucun versement : c'est tout l'intérêt.
    expect(await prisma.payment.count()).toBe(0)
  })

  it('devient relançable, ce qu’un bail sans échéance n’était jamais', async () => {
    /**
     * Le cas qui relie les deux moitiés. Avant cet appel, la relance rendait
     * `nothing_due` sur un locataire qui n'avait rien payé depuis six mois —
     * réponse exacte et absurde : rien n'était dû parce que rien n'avait été
     * appelé.
     */
    const bail = await prisma.lease.findFirstOrThrow({ where: { unitId } })

    const avant = await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [bail.id] })
    expect(avant.body.sent).toEqual([])
    expect(avant.body.skipped[0].reason).toBe('nothing_due')

    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', proprio)
      .send({ periodStart: '2026-06-01' })

    const apres = await request(serveur)
      .post(`/api/parks/${parkId}/reminders`)
      .set('Cookie', proprio)
      .send({ leaseIds: [bail.id] })
    expect(apres.body.sent).toEqual([bail.id])
  })

  it('appelé deux fois, ne double pas la dette', async () => {
    const corps = { periodStart: '2026-06-01' }
    await request(serveur).post(`/api/parks/${parkId}/charges`).set('Cookie', proprio).send(corps)

    const second = await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', proprio)
      .send(corps)

    // Zéro émise : un fait, pas une erreur. On relance l'appel après avoir
    // ajouté un locataire en cours de mois, sans craindre de doubler les autres.
    expect(second.body.issued).toBe(0)
    expect(await prisma.rentCharge.count()).toBe(1)
  })

  it('n’appelle rien sur un bail qui commence après la période', async () => {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', proprio)
      .send({ periodStart: '2025-06-01' })

    // Un bail commencé en 2026 ne doit rien pour juin 2025 : appeler ce mois-là
    // fabriquerait une dette qui n'a jamais existé.
    expect(res.body.issued).toBe(0)
  })

  it('n’appelle rien sur le parc d’un autre', async () => {
    const autre = await inscrire('voisin5@example.com', { parkName: 'Autre parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', autre.cookie)

    await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/charges`)
      .set('Cookie', autre.cookie)
      .send({ periodStart: '2026-06-01' })

    expect(await prisma.rentCharge.count()).toBe(0)
  })
})

describe('suppression d’un versement', () => {
  async function parcAvecVersement(email: string) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const unitId = logement.body.unit.id
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({ unitId, fullName: 'Charles Ngassa', startsOn: '2026-01-01', rentMinor: 145000 })
    const versement = await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 145000, method: 'cash' })
    return { cookie, parkId, paymentId: versement.body.payment.id as string }
  }

  it('rétablit la dette, sans effacer l’échéance', async () => {
    const { cookie, parkId, paymentId } = await parcAvecVersement('gomme@example.com')

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/payments/${paymentId}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(204)
    expect(await prisma.payment.count()).toBe(0)
    /**
     * L'échéance RESTE. Elle a été appelée, elle est due — la supprimer
     * effacerait la dette au lieu de la rétablir, ce qui est l'inverse du geste
     * demandé.
     */
    expect(await prisma.rentCharge.count()).toBe(1)
  })

  it('garde au journal ce qui a été retiré, montant compris', async () => {
    const { cookie, parkId, paymentId } = await parcAvecVersement('journal@example.com')
    await request(serveur)
      .delete(`/api/parks/${parkId}/payments/${paymentId}`)
      .set('Cookie', cookie)

    /**
     * Ce qui distingue une correction d'un effacement. Le jour où un locataire
     * produira un reçu pour une somme absente du registre, ce journal dira quand
     * elle en a été retirée et par qui.
     */
    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'payment.delete' },
    })
    expect((trace.payload as { amountMinor: number }).amountMinor).toBe(145000)
    expect(trace.actorId).not.toBeNull()
  })

  it('la refuse au gestionnaire : c’est de l’argent qu’on déclare ne plus avoir reçu', async () => {
    const { parkId, paymentId } = await parcAvecVersement('refus@example.com')
    const g = await inscrire('diane5@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane5@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/payments/${paymentId}`)
      .set('Cookie', g.cookie)

    expect(res.status).toBe(403)
    // Un refus qui laisse une trace n'est pas un refus.
    expect(await prisma.payment.count()).toBe(1)
  })

  it('ne touche pas au versement d’un autre parc', async () => {
    const { paymentId } = await parcAvecVersement('cible@example.com')
    const autre = await inscrire('voisin6@example.com', { parkName: 'Autre parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', autre.cookie)

    const res = await request(serveur)
      .delete(`/api/parks/${parcs.body.memberships[0].parkId}/payments/${paymentId}`)
      .set('Cookie', autre.cookie)

    // 404 et non 403 : un 403 confirmerait que ce versement existe ailleurs.
    expect(res.status).toBe(404)
    expect(await prisma.payment.count()).toBe(1)
  })
})

/**
 * Retrait d'une fiche locataire.
 *
 * Même manque que les immeubles : on pouvait créer une fiche et jamais la
 * retirer. Sur un objet plus lourd, puisqu'une fiche porte un bail — et la base
 * l'interdit déjà par `Lease.tenant onDelete: NoAction`, précisément pour qu'on
 * ne laisse pas des sommes rattachées à personne.
 */
describe('retrait d’une fiche locataire', () => {
  async function parcAvecLocataire(email: string, depositMinor?: number) {
    const { cookie } = await inscrire(email, { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = parcs.body.memberships[0].parkId
    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', cookie)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', cookie)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })
    const unitId = logement.body.unit.id
    await request(serveur)
      .post(`/api/parks/${parkId}/tenants`)
      .set('Cookie', cookie)
      .send({
        unitId,
        fullName: 'Charles Ngassa',
        startsOn: '2026-01-01',
        rentMinor: 145000,
        ...(depositMinor ? { depositMinor } : {}),
      })
    const fiche = await prisma.tenant.findFirstOrThrow({ where: { parkId } })
    return { cookie, parkId, unitId, tenantId: fiche.id }
  }

  it('retire la fiche et son bail, échéances appelées comprises', async () => {
    const { cookie, parkId, tenantId } = await parcAvecLocataire('retrait@example.com')
    // Une échéance appelée et IMPAYÉE : une attente, pas un mouvement. Elle n'a
    // plus d'objet dès lors que le bail disparaît.
    await request(serveur)
      .post(`/api/parks/${parkId}/charges`)
      .set('Cookie', cookie)
      .send({ periodStart: '2026-06-01' })
    expect(await prisma.rentCharge.count()).toBe(1)

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)

    expect(res.status, JSON.stringify(res.body)).toBe(204)
    expect(await prisma.tenant.count()).toBe(0)
    expect(await prisma.lease.count()).toBe(0)
    expect(await prisma.rentCharge.count()).toBe(0)
    // Le logement, lui, RESTE : ce sont des murs, pas une personne.
    expect(await prisma.unit.count()).toBe(1)
  })

  it('REFUSE tant qu’un versement a été encaissé', async () => {
    const { cookie, parkId, unitId, tenantId } = await parcAvecLocataire('somme@example.com')
    await request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', cookie)
      .send({ unitId, periodStart: '2026-07-01', amountMinor: 145000, method: 'cash' })

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)

    /**
     * De l'argent réel est rattaché à cette personne. L'effacer laisserait un
     * mouvement sans titulaire — ce que la contrainte `NoAction` interdit déjà
     * au niveau de la base, et que cette route refuse en le disant.
     *
     * Le chemin de sortie existe : retirer d'abord les versements depuis la
     * quittance. On défait dans l'ordre inverse de ce qu'on a fait.
     */
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('has_payments')
    expect(await prisma.tenant.count()).toBe(1)
  })

  it('REFUSE tant qu’une caution est détenue', async () => {
    const { cookie, parkId, tenantId } = await parcAvecLocataire('caution@example.com', 180000)

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)

    // Une caution détenue est l'argent de quelqu'un : elle s'arbitre, elle ne
    // s'efface pas avec la fiche de celui à qui elle appartient.
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('has_deposit')
  })

  it('garde au journal qui a été retiré', async () => {
    const { cookie, parkId, tenantId } = await parcAvecLocataire('journal2@example.com')
    await request(serveur)
      .delete(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', cookie)

    // La fiche part ; la trace de son retrait dit qui et par qui.
    const trace = await prisma.auditEvent.findFirstOrThrow({
      where: { parkId, action: 'tenant.delete' },
    })
    expect((trace.payload as { fullName: string }).fullName).toBe('Charles Ngassa')
    expect(trace.actorId).not.toBeNull()
  })

  it('la refuse au gestionnaire', async () => {
    const { parkId, tenantId } = await parcAvecLocataire('roles@example.com')
    const g = await inscrire('diane6@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane6@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/tenants/${tenantId}`)
      .set('Cookie', g.cookie)

    expect(res.status).toBe(403)
    expect(await prisma.tenant.count()).toBe(1)
  })

  it('ne touche pas à la fiche d’un autre parc', async () => {
    const { tenantId } = await parcAvecLocataire('cible2@example.com')
    const autre = await inscrire('voisin7@example.com', { parkName: 'Autre parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', autre.cookie)

    const res = await request(serveur)
      .delete(`/api/parks/${parcs.body.memberships[0].parkId}/tenants/${tenantId}`)
      .set('Cookie', autre.cookie)

    // 404 et non 403 : un 403 confirmerait que cette fiche existe ailleurs.
    expect(res.status).toBe(404)
    expect(await prisma.tenant.count()).toBe(1)
  })
})

describe('rejoindre un parc avec un compte existant', () => {
  it('crée l’adhésion au rôle de l’INVITATION', async () => {
    /**
     * Le code ne se consommait qu'à l'inscription. Un compte existant — celui
     * d'un invité dont le code n'était jamais parti — n'avait aucun moyen de
     * rejoindre quoi que ce soit : l'invitation restait valable et sans porte.
     */
    const p = await inscrire('hote@example.com', { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', p.cookie)
    const parkId = parcs.body.memberships[0].parkId
    const invit = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', p.cookie)
      .send({ role: 'tenant' })

    const invite = await inscrire('invite@example.com', { parkName: 'Son propre parc' })
    const res = await request(serveur)
      .post('/api/join')
      .set('Cookie', invite.cookie)
      .send({ invitationCode: invit.body.code })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'invite@example.com' },
    })
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { userId: compte.id, parkId },
    })
    // Le rôle vient de l'invitation, jamais de la saisie.
    expect(adhesion.role).toBe('tenant')
  })

  it('refuse un code déjà accepté, sans dire qu’il a existé', async () => {
    const p = await inscrire('hote2@example.com', { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', p.cookie)
    const invit = await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/invitations`)
      .set('Cookie', p.cookie)
      .send({ role: 'tenant' })

    const a = await inscrire('premier@example.com', { parkName: 'Parc Premier' })
    await request(serveur)
      .post('/api/join')
      .set('Cookie', a.cookie)
      .send({ invitationCode: invit.body.code })

    const b = await inscrire('second@example.com', { parkName: 'Parc Second' })
    const res = await request(serveur)
      .post('/api/join')
      .set('Cookie', b.cookie)
      .send({ invitationCode: invit.body.code })

    // Le MÊME refus qu'un code inconnu : les distinguer dirait à qui essaie des
    // codes au hasard lesquels ont existé.
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invitation_invalid')
  })

  it('ne brûle pas le code quand on est déjà membre', async () => {
    const p = await inscrire('hote3@example.com', { parkName: 'Parc' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', p.cookie)
    const invit = await request(serveur)
      .post(`/api/parks/${parcs.body.memberships[0].parkId}/invitations`)
      .set('Cookie', p.cookie)
      .send({ role: 'tenant' })

    const res = await request(serveur)
      .post('/api/join')
      .set('Cookie', p.cookie)
      .send({ invitationCode: invit.body.code })

    expect(res.status).toBe(409)
    // Le code reste consommable par celui à qui il était destiné.
    const apres = await prisma.invitation.findFirstOrThrow({ where: { id: invit.body.invitation.id } })
    expect(apres.acceptedAt).toBeNull()
  })
})

/**
 * LE REGISTRE DES ACCÈS.
 *
 * Le produit savait faire entrer et ne savait ni regarder ni reprendre. Aucune
 * route ne listait les membres d'un parc ni les codes en attente ; aucune
 * n'écrivait `Invitation.revokedAt`, pourtant lu à chaque consommation depuis
 * l'origine. La colonne était toujours nulle : une garde qui ne gardait rien.
 *
 * Le blocage qu'elle causait n'avait été vu de personne : l'index unique
 * partiel de `bail_unique_par_unite` empêche un second code sur un logement
 * dont le premier n'a pas servi. Sans révocation, un propriétaire qui s'était
 * trompé de destinataire restait bloqué quatorze jours sur ce logement.
 */
describe('les accès au parc', () => {
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const d = await inscrire('diane@example.com')
    gestionnaire = d.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
  })

  /** Émet un code et rend la réponse entière : le clair n'existe qu'ici. */
  async function emettre(cookie: string, corps: Record<string, unknown>) {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', cookie)
      .send(corps)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body as { code: string; invitation: { id: string } }
  }

  it('liste les membres du parc, le propriétaire en tête', async () => {
    const res = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    // L'ordre n'est pas cosmétique : `ParkRole` est déclaré `owner, manager,
    // tenant` et PostgreSQL trie ses énumérations dans cet ordre-là. Le jour où
    // quelqu'un réordonne l'enum, ce cas le dira.
    expect(res.body.members.map((m: { email: string }) => m.email)).toEqual([
      'proprio@example.com',
      'diane@example.com',
    ])
    expect(res.body.members[0].role).toBe('owner')
    expect(res.body.members[1].role).toBe('manager')
    expect(res.body.members[0].since).toEqual(expect.any(String))
  })

  it('montre les codes en attente par leur indice, jamais en clair', async () => {
    const { code } = await emettre(proprio, { role: 'tenant' })

    const res = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    expect(res.body.invitations).toHaveLength(1)
    expect(res.body.invitations[0].codeHint).toBe(code.slice(-4))

    // Seule l'empreinte est en base : si le clair réapparaissait ici, une
    // sauvegarde ou un journal ouvrirait le parc. L'indice reconnaît un code,
    // il n'en fabrique pas.
    expect(JSON.stringify(res.body)).not.toContain(code)
  })

  it('n’y montre ni le code consommé ni le code repris', async () => {
    const consomme = await emettre(proprio, { role: 'tenant' })
    const repris = await emettre(proprio, { role: 'tenant' })

    const { cookie } = await inscrire('entrant@example.com')
    const rejoint = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookie)
      .send({ invitationCode: consomme.code })
    expect(rejoint.status, JSON.stringify(rejoint.body)).toBe(201)

    const revoque = await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${repris.invitation.id}/revoke`)
      .set('Cookie', proprio)
    expect(revoque.status).toBe(204)

    // La liste montre EXACTEMENT ce que `/api/join` accepterait. Deux
    // définitions de « en attente » divergeraient, et l'écran promettrait alors
    // des codes que la porte refuse.
    const res = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    expect(res.body.invitations).toHaveLength(0)
  })

  it('reprend un code en attente, qui cesse aussitôt d’ouvrir la porte', async () => {
    const { code, invitation } = await emettre(proprio, { role: 'tenant' })

    const revoque = await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${invitation.id}/revoke`)
      .set('Cookie', proprio)
    expect(revoque.status).toBe(204)
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).revokedAt)
      .not.toBeNull()

    // La preuve qui compte n'est pas la colonne, c'est la PORTE : `revokedAt`
    // était déjà lu par `/api/join` avant ce lot, sans que rien ne l'écrive.
    const { cookie } = await inscrire('trop-tard@example.com')
    const entre = await request(serveur)
      .post('/api/join')
      .set('Cookie', cookie)
      .send({ invitationCode: code })
    expect(entre.status).toBe(400)
    expect(entre.body.error).toBe('invitation_invalid')
  })

  it('libère le logement, qu’un code inutilisé bloquait quatorze jours', async () => {
    const unite = await prisma.unit.findFirstOrThrow({
      where: { building: { parkId }, leases: { none: { status: 'active' } } },
      select: { id: true },
    })
    const premier = await emettre(proprio, { role: 'tenant', unitId: unite.id })

    // L'index unique partiel de `bail_unique_par_unite` refuse un second code
    // tant que le premier n'est ni accepté ni révoqué. C'est le blocage réel :
    // un destinataire qui ne s'en sert jamais gèle le logement.
    const bloque = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', proprio)
      .send({ role: 'tenant', unitId: unite.id })
    expect(bloque.status).toBe(409)
    expect(bloque.body.error).toBe('invitation_pending')

    await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${premier.invitation.id}/revoke`)
      .set('Cookie', proprio)
      .expect(204)

    const second = await request(serveur)
      .post(`/api/parks/${parkId}/invitations`)
      .set('Cookie', proprio)
      .send({ role: 'tenant', unitId: unite.id })
    expect(second.status, JSON.stringify(second.body)).toBe(201)
  })

  it('refuse au gestionnaire de reprendre un code de gestionnaire', async () => {
    const { invitation } = await emettre(proprio, { role: 'manager' })

    // Annuler le recrutement décidé par le propriétaire, c'est décider qui
    // n'entre pas — le pendant exact du geste que le lot précédent lui a retiré.
    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${invitation.id}/revoke`)
      .set('Cookie', gestionnaire)
    expect(res.status).toBe(403)

    const apres = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })
    expect(apres.revokedAt).toBeNull()
  })

  it('lui laisse reprendre un code de locataire, dont c’est le métier', async () => {
    const { invitation } = await emettre(gestionnaire, { role: 'tenant' })

    // Sans ce cas, fermer la route aux deux natures passerait au vert : on
    // aurait corrigé une escalade en retirant au gestionnaire son geste courant.
    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${invitation.id}/revoke`)
      .set('Cookie', gestionnaire)
    expect(res.status).toBe(204)
  })

  it('refuse de reprendre un code déjà consommé, et le dit autrement qu’un absent', async () => {
    const { code, invitation } = await emettre(proprio, { role: 'tenant' })
    const { cookie } = await inscrire('deja-entre@example.com')
    await request(serveur)
      .post('/api/join')
      .set('Cookie', cookie)
      .send({ invitationCode: code })
      .expect(201)

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${invitation.id}/revoke`)
      .set('Cookie', proprio)

    // La personne est ENTRÉE : son accès ne tient plus au code mais à son
    // adhésion. Reprendre le code ne fermerait rien tout en ayant l'air de le
    // faire, et le refus doit se distinguer d'un identifiant inconnu pour que
    // l'écran puisse dire quoi faire à la place.
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('already_accepted')
  })

  it('retire au gestionnaire son accès, dès la requête suivante', async () => {
    const membres = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    const sien = membres.body.members.find((m: { role: string }) => m.role === 'manager')

    // AVANT : il lit le parc. Sans cette moitié, une coquille qui casserait le
    // gestionnaire dès le `beforeEach` satisferait le cas.
    await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', gestionnaire)
      .expect(200)

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${sien.id}/revoke`)
      .set('Cookie', proprio)
    expect(res.status, JSON.stringify(res.body)).toBe(204)

    /**
     * APRÈS, et avec LE MÊME COOKIE : c'est tout l'intérêt de `status`.
     * `exigerAppartenance` ne cherche que des adhésions actives, si bien que le
     * retrait vaut dès la requête suivante — sans attendre une reconnexion, et
     * sans qu'on ait à révoquer sa session, qui reste valable pour ses autres
     * parcs. Le 404 est celui d'un inconnu : un 403 confirmerait le parc.
     */
    const apres = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', gestionnaire)
    expect(apres.status).toBe(404)
  })

  it('le fait disparaître du registre, sans effacer ce qu’il a fait', async () => {
    const avant = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    const sien = avant.body.members.find((m: { role: string }) => m.role === 'manager')

    // Une trace du gestionnaire dans le parc : un code qu'il a émis lui survit,
    // parce qu'on retire un accès et non une personne.
    const emis = await emettre(gestionnaire, { role: 'tenant' })

    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${sien.id}/revoke`)
      .set('Cookie', proprio)
      .expect(204)

    const apres = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    expect(apres.body.members.map((m: { role: string }) => m.role)).toEqual(['owner'])
    // Le code qu'il avait émis reste valable : révoquer son émetteur ne ferme
    // pas la porte au locataire qui attend, lequel n'y est pour rien.
    expect(apres.body.invitations.map((i: { id: string }) => i.id)).toContain(emis.invitation.id)
  })

  it('refuse au gestionnaire de retirer qui que ce soit', async () => {
    const membres = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    const celle = membres.body.members.find((m: { role: string }) => m.role === 'owner')

    // Retirer un accès est un acte de propriétaire — celui-ci retirerait le
    // sien, ce qui est le scénario que la garde doit rendre impossible.
    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${celle.id}/revoke`)
      .set('Cookie', gestionnaire)
    expect(res.status).toBe(403)

    const apres = await prisma.membership.findUniqueOrThrow({ where: { id: celle.id } })
    expect(apres.status).toBe('active')
  })

  it('refuse au propriétaire de se retirer lui-même', async () => {
    const membres = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    const sienne = membres.body.members.find((m: { role: string }) => m.role === 'owner')

    // Un parc dont le dernier propriétaire est parti est inatteignable pour
    // toujours : ses immeubles et ses cautions restent en base, et aucune route
    // ne permet de s'y rattacher sans un code que seul un membre peut émettre.
    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${sienne.id}/revoke`)
      .set('Cookie', proprio)
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('cannot_revoke_self')

    await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio).expect(200)
  })

  it('retire deux fois sans se plaindre', async () => {
    // Ce que ce cas garde n'est pas une branche mais l'ABSENCE d'une condition :
    // l'écriture est inconditionnelle, donc reposer `revoked` sur `revoked`
    // réussit. Restreindre le `where` aux adhésions actives — le réflexe naturel
    // — ferait lever Prisma au second appel, et deux écrans ouverts sur le même
    // registre suffiraient à produire une erreur pour un état déjà atteint.

    const membres = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    const sien = membres.body.members.find((m: { role: string }) => m.role === 'manager')
    const chemin = `/api/parks/${parkId}/memberships/${sien.id}/revoke`

    await request(serveur).patch(chemin).set('Cookie', proprio).expect(204)
    await request(serveur).patch(chemin).set('Cookie', proprio).expect(204)
  })

  it('ne retire personne dans le parc d’à côté', async () => {
    const voisin = await inscrire('voisine@example.com', {
      parkName: 'Parc Bastos',
      countryCode: 'CM',
    })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', voisin.cookie)
    const parcVoisin = parcs.body.memberships[0].parkId
    const chezElle = await request(serveur)
      .get(`/api/parks/${parcVoisin}/access`)
      .set('Cookie', voisin.cookie)
    const sienne = chezElle.body.members[0]

    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${sienne.id}/revoke`)
      .set('Cookie', proprio)
    expect(res.status).toBe(404)

    const apres = await prisma.membership.findUniqueOrThrow({ where: { id: sienne.id } })
    expect(apres.status).toBe('active')
  })

  it('reprend deux fois sans se plaindre, et sans réécrire la date', async () => {
    const { invitation } = await emettre(proprio, { role: 'tenant' })
    const chemin = `/api/parks/${parkId}/invitations/${invitation.id}/revoke`

    await request(serveur).patch(chemin).set('Cookie', proprio).expect(204)
    const premier = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })

    // Un second clic, ou deux écrans ouverts sur la même liste : l'état demandé
    // est celui qu'on trouve, refuser serait punir l'utilisateur pour rien. Et
    // la date du PREMIER retrait tient — c'est elle qui dit quand l'accès a
    // cessé d'exister.
    await request(serveur).patch(chemin).set('Cookie', proprio).expect(204)
    const second = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })
    expect(second.revokedAt?.toISOString()).toBe(premier.revokedAt?.toISOString())
  })

  it('n’y montre pas un code expiré, que la porte refuse déjà', async () => {
    const { invitation } = await emettre(proprio, { role: 'tenant' })
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    })

    // La liste et `/api/join` doivent dire la même chose. Un code expiré affiché
    // « en attente » ferait attendre un locataire devant une porte fermée.
    const res = await request(serveur).get(`/api/parks/${parkId}/access`).set('Cookie', proprio)
    expect(res.body.invitations).toHaveLength(0)
  })

  it('ne touche pas au code du parc d’à côté', async () => {
    const voisin = await inscrire('voisin@example.com', {
      parkName: 'Parc Bastos',
      countryCode: 'CM',
    })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', voisin.cookie)
    const parcVoisin = parcs.body.memberships[0].parkId
    const chezLeVoisin = await request(serveur)
      .post(`/api/parks/${parcVoisin}/invitations`)
      .set('Cookie', voisin.cookie)
      .send({ role: 'tenant' })
    expect(chezLeVoisin.status).toBe(201)

    // Le filtre porte `parkId` : sans lui, un identifiant deviné reprendrait le
    // code d'un parc dont on n'est pas membre, et le 404 se confond avec celui
    // d'une invitation absente — « vous n'avez pas le droit » et « cela n'existe
    // pas » doivent se ressembler vu de l'extérieur.
    const res = await request(serveur)
      .patch(`/api/parks/${parkId}/invitations/${chezLeVoisin.body.invitation.id}/revoke`)
      .set('Cookie', proprio)
    expect(res.status).toBe(404)

    const apres = await prisma.invitation.findUniqueOrThrow({
      where: { id: chezLeVoisin.body.invitation.id },
    })
    expect(apres.revokedAt).toBeNull()
  })
})

/**
 * LES TARIFS DE REFACTURATION.
 *
 * Le client portait deux constantes — 520 le mètre cube, 99 le kilowattheure —
 * affichées comme des faits sur l'écran des relevés, avec le total qui en
 * découle. Pour tous les parcs, dans toutes les devises, sans qu'aucun
 * propriétaire puisse les corriger : un locataire lisait ce qu'il doit à partir
 * d'un prix que rien ne fondait.
 *
 * `UtilityTariff` existait depuis l'origine du schéma — par parc, daté, avec sa
 * contrainte d'unicité — et rien ne l'écrivait ni ne la lisait. C'est le
 * troisième champ mort de la même famille, et le seul sur lequel quelqu'un
 * paie.
 */
describe('les tarifs de refacturation', () => {
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const d = await inscrire('diane@example.com')
    gestionnaire = d.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })

    /**
     * Le semis de démonstration POSE des tarifs — un parc de démonstration qui
     * montrerait des mètres cubes sans montant serait juste et illisible. Les
     * cas ci-dessous éprouvent justement l'absence de tarif et le choix de
     * celui qui s'applique : ils repartent donc d'une table vide, et le cas qui
     * garde le semis lui-même vit à part, dans son propre `describe`.
     */
    await prisma.utilityTariff.deleteMany({ where: { parkId } })
  })

  /**
   * Pas `async` : supertest rend un objet chaînable qui porte `.expect()`, et
   * l'envelopper dans une promesse retire cette méthode — l'appel part quand
   * même, ce qui donne une erreur de type à un endroit et un 404 déroutant à un
   * autre, la base ayant été nettoyée entre-temps.
   */
  function poser(cookie: string, corps: Record<string, unknown>) {
    return request(serveur).post(`/api/parks/${parkId}/tariffs`).set('Cookie', cookie).send(corps)
  }

  it('n’applique aucun prix tant que le propriétaire n’en a posé aucun', async () => {
    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    expect(res.status).toBe(200)

    /**
     * LE CAS QUI PORTE LE LOT. `null` et non un prix par défaut : l'écran
     * montrera la quantité relevée sans montant. Poser une valeur ici — fût-ce
     * le tarif réglementé du pays — ramènerait le défaut qu'on retire, un
     * chiffre affirmé à la place de quelqu'un, et il deviendrait faux à la
     * première révision sans que personne ne le sache.
     */
    expect(res.body.readings.length).toBeGreaterThan(0)
    for (const releve of res.body.readings) {
      expect(releve.unitPriceMinor, JSON.stringify(releve)).toBeNull()
    }
  })

  it('applique le prix en vigueur à la période du relevé', async () => {
    const releveAvant = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', proprio)
    const periode: string = releveAvant.body.readings[0].periodStart
    const veille = new Date(new Date(periode).getTime() - 86_400_000).toISOString().slice(0, 10)

    await poser(proprio, { utility: 'water', unitPriceMinor: 520, effectiveFrom: veille }).expect(201)
    await poser(proprio, { utility: 'power', unitPriceMinor: 99, effectiveFrom: veille }).expect(201)

    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const eau = res.body.readings.find((r: { utility: string }) => r.utility === 'water')
    const elec = res.body.readings.find((r: { utility: string }) => r.utility === 'power')
    expect(eau.unitPriceMinor).toBe(520)
    expect(elec.unitPriceMinor).toBe(99)
  })

  it('ignore un tarif qui prend effet APRÈS la période relevée', async () => {
    const avant = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const periode: string = avant.body.readings[0].periodStart
    const lendemain = new Date(new Date(periode).getTime() + 86_400_000).toISOString().slice(0, 10)

    await poser(proprio, { utility: 'water', unitPriceMinor: 999, effectiveFrom: lendemain }).expect(201)

    // Refacturer janvier au tarif de novembre serait faux, et c'est tout
    // l'objet d'`effectiveFrom` : un prix ne vaut pas pour le passé.
    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const eau = res.body.readings.find((r: { utility: string }) => r.utility === 'water')
    expect(eau.unitPriceMinor).toBeNull()
  })

  it('retient le plus récent des prix déjà en vigueur', async () => {
    const avant = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const periode = new Date(avant.body.readings[0].periodStart).getTime()
    const vieux = new Date(periode - 400 * 86_400_000).toISOString().slice(0, 10)
    const recent = new Date(periode - 30 * 86_400_000).toISOString().slice(0, 10)

    await poser(proprio, { utility: 'water', unitPriceMinor: 400, effectiveFrom: vieux }).expect(201)
    await poser(proprio, { utility: 'water', unitPriceMinor: 610, effectiveFrom: recent }).expect(201)

    // Les deux sont en vigueur au sens large ; c'est le plus proche en amont
    // qui vaut. Sans cet ordre, une hausse de prix ne prendrait jamais effet.
    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', proprio)
    const eau = res.body.readings.find((r: { utility: string }) => r.utility === 'water')
    expect(eau.unitPriceMinor).toBe(610)
  })

  it('rend l’historique entier, et pas seulement le prix courant', async () => {
    await poser(proprio, { utility: 'water', unitPriceMinor: 400, effectiveFrom: '2025-01-01' }).expect(201)
    await poser(proprio, { utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-01-01' }).expect(201)

    const res = await request(serveur).get(`/api/parks/${parkId}/tariffs`).set('Cookie', proprio)
    expect(res.status).toBe(200)

    // Un tarif passé explique une quittance de l'an dernier : ne rendre que le
    // dernier obligerait à deviner pourquoi un mois ancien a été facturé
    // autrement, ce qui est la question qu'un locataire pose quand il conteste.
    const eau = res.body.tariffs.filter((t: { utility: string }) => t.utility === 'water')
    expect(eau.map((t: { unitPriceMinor: number }) => t.unitPriceMinor)).toEqual([520, 400])
    expect(eau[0].effectiveFrom).toBe('2026-01-01')
  })

  it('laisse le gestionnaire LIRE les prix, sans lui laisser en poser', async () => {
    await poser(proprio, { utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-01-01' }).expect(201)

    // Il refacture au quotidien : lui cacher le prix lui retirerait le moyen de
    // vérifier ce qu'il présente au locataire.
    const lecture = await request(serveur)
      .get(`/api/parks/${parkId}/tariffs`)
      .set('Cookie', gestionnaire)
    expect(lecture.status).toBe(200)
    expect(lecture.body.tariffs).toHaveLength(1)

    // Mais fixer un prix engage l'argent du locataire — même partage que la
    // validation d'un devis ou l'arbitrage d'une caution.
    const ecriture = await poser(gestionnaire, {
      utility: 'power',
      unitPriceMinor: 99,
      effectiveFrom: '2026-01-01',
    })
    expect(ecriture.status).toBe(403)
    expect(await prisma.utilityTariff.count({ where: { parkId, utility: 'power' } })).toBe(0)
  })

  it('refuse deux prix pour la même énergie le même jour, et le dit', async () => {
    await poser(proprio, { utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-01-01' }).expect(201)

    // Deux prix valables le même jour rendraient indéterminable ce qu'on
    // facture. Sans ce rattrapage, une faute de frappe corrigée le jour même
    // rendait un 500 nu sur un geste ordinaire.
    const res = await poser(proprio, {
      utility: 'water',
      unitPriceMinor: 530,
      effectiveFrom: '2026-01-01',
    })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('tariff_exists')
  })

  it('refuse un prix nul, qui se dit en ne posant pas de tarif', async () => {
    const res = await poser(proprio, {
      utility: 'water',
      unitPriceMinor: 0,
      effectiveFrom: '2026-01-01',
    })
    expect(res.status).toBe(400)
  })

  it('ne montre pas les prix du parc d’à côté', async () => {
    await poser(proprio, { utility: 'water', unitPriceMinor: 520, effectiveFrom: '2026-01-01' }).expect(201)
    const voisin = await inscrire('voisin@example.com', { parkName: 'Parc Bastos', countryCode: 'CM' })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', voisin.cookie)

    const res = await request(serveur)
      .get(`/api/parks/${parcs.body.memberships[0].parkId}/tariffs`)
      .set('Cookie', voisin.cookie)
    expect(res.body.tariffs).toEqual([])
  })
})

describe('les tarifs de la démonstration', () => {
  it('sème des prix qui couvrent tout l’historique relevé', async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', p.cookie)
    const parkId = parcs.body.memberships[0].parkId

    /**
     * Sans ce cas, retirer le semis des tarifs passerait inaperçu : le
     * portefeuille rendrait `null` partout, l'écran montrerait des quantités
     * sans montant, et le produit aurait l'air de se comporter comme prévu —
     * pour un parc de DÉMONSTRATION, qui existe précisément pour montrer ce que
     * la refacturation donne.
     *
     * Ces prix sont des données de démonstration au même titre que les loyers
     * et les noms, et non une valeur par défaut : un parc réel créé sans semis
     * n'en reçoit aucune.
     */
    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', p.cookie)
    expect(res.body.readings.length).toBeGreaterThan(0)
    for (const releve of res.body.readings) {
      expect(releve.unitPriceMinor, JSON.stringify(releve)).not.toBeNull()
    }

    // L'historique ANCIEN aussi : la prise d'effet remonte au-delà du plus
    // vieux relevé, sans quoi les douze périodes se liraient sans prix jusqu'à
    // la date posée.
    const tarifs = await request(serveur).get(`/api/parks/${parkId}/tariffs`).set('Cookie', p.cookie)
    expect(tarifs.body.tariffs).toHaveLength(2)
    const plusVieux = await prisma.meterReading.findFirstOrThrow({
      where: { unit: { building: { parkId } } },
      orderBy: { periodStart: 'asc' },
      select: { periodStart: true },
    })
    for (const tarif of tarifs.body.tariffs) {
      expect(new Date(tarif.effectiveFrom).getTime()).toBeLessThan(+plusVieux.periodStart)
    }
  })
})

/**
 * CORRIGER LE PARC.
 *
 * Aucune route ne modifiait un parc. Un propriétaire dont le parc était né avec
 * la mauvaise devise l'était pour toujours — et le cas n'est pas théorique : le
 * pays du compte se déduisait de la devise affichée sur la vitrine, si bien
 * qu'un visiteur ayant regardé la grille tarifaire en euros naissait français,
 * puis voyait ses loyers de Yaoundé libellés dans une unité six cent
 * cinquante-six fois trop grande.
 */
describe('corriger le parc', () => {
  let parkId: string
  let proprio: string
  let gestionnaire: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bastos',
      countryCode: 'FR',
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const d = await inscrire('diane@example.com')
    gestionnaire = d.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
  })

  function corriger(cookie: string, corps: Record<string, unknown>) {
    return request(serveur).patch(`/api/parks/${parkId}`).set('Cookie', cookie).send(corps)
  }

  it('rétablit la devise d’un parc né dans la mauvaise', async () => {
    // L'état de départ est celui qu'on a trouvé en production : un parc nommé
    // d'après un quartier de Yaoundé, en euros.
    const avant = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    expect(avant.body.memberships[0].currency).toBe('EUR')

    const res = await corriger(proprio, { countryCode: 'CM', currency: 'XAF' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    // La lecture qui compte est celle que l'écran fait : c'est elle qui pose la
    // devise de tous les montants affichés.
    const apres = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    expect(apres.body.memberships[0].currency).toBe('XAF')

    // Et le NOM n'a pas bougé, alors qu'il n'était pas dans la requête. Sans
    // cette moitié, une route qui écraserait les champs absents par une valeur
    // par défaut passerait au vert — et c'est précisément la famille de défaut
    // que ce lot répare.
    expect(apres.body.memberships[0].parkName).toBe('Parc Bastos')
  })

  it('ne change que ce qu’on lui envoie', async () => {
    await corriger(proprio, { name: 'Parc de Bastos' }).expect(200)

    // Exiger le triplet complet obligerait l'écran à renvoyer ce qu'il n'a pas
    // touché, et une lecture périmée écraserait la correction d'un autre.
    const parc = await prisma.park.findUniqueOrThrow({ where: { id: parkId } })
    expect(parc.name).toBe('Parc de Bastos')
    expect(parc.currency).toBe('EUR')
    expect(parc.countryCode).toBe('FR')
  })

  it('refuse une requête qui ne corrige rien', async () => {
    // Elle réussirait silencieusement, et l'écran annoncerait « enregistré »
    // sans qu'aucune écriture ait eu lieu.
    const res = await corriger(proprio, {})
    expect(res.status).toBe(400)
  })

  it('refuse au gestionnaire de fixer l’unité dans laquelle il opère', async () => {
    const res = await corriger(gestionnaire, { currency: 'XAF' })
    expect(res.status).toBe(403)

    const parc = await prisma.park.findUniqueOrThrow({ where: { id: parkId } })
    expect(parc.currency).toBe('EUR')
  })

  it('ne corrige pas le parc d’à côté', async () => {
    const voisin = await inscrire('voisin@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
    })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', voisin.cookie)
    const parcVoisin = parcs.body.memberships[0].parkId

    const res = await request(serveur)
      .patch(`/api/parks/${parcVoisin}`)
      .set('Cookie', proprio)
      .send({ currency: 'EUR' })
    // 404 et non 403 : `exigerAppartenance` ne confirme pas l'existence d'un
    // parc dont on n'est pas membre.
    expect(res.status).toBe(404)

    const parc = await prisma.park.findUniqueOrThrow({ where: { id: parcVoisin } })
    expect(parc.currency).toBe('XAF')
  })
})

/**
 * LE MESSAGE GROUPÉ AUX LOCATAIRES.
 *
 * Le seul envoi à plusieurs destinataires qui existait était la relance
 * d'impayés, sans texte libre : un bailleur devant prévenir d'une coupure d'eau
 * n'avait que son téléphone.
 */
describe('le message groupé', () => {
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
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const d = await inscrire('diane@example.com')
    gestionnaire = d.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
  })

  function annoncer(cookie: string, corps: Record<string, unknown>) {
    return request(serveur)
      .post(`/api/parks/${parkId}/announcements`)
      .set('Cookie', cookie)
      .send(corps)
  }

  /** Donne un compte à un locataire du parc, et rend son identifiant. */
  async function rattacherUnCompte(email: string) {
    const { cookie } = await inscrire(email)
    const compte = await prisma.userAccount.findUniqueOrThrow({ where: { email } })
    const bail = await prisma.lease.findFirstOrThrow({
      where: { status: 'active', unit: { building: { parkId } } },
      select: { tenantId: true },
    })
    await prisma.tenant.update({ where: { id: bail.tenantId }, data: { userId: compte.id } })
    // Le compte doit aussi ÊTRE MEMBRE : rattacher un `userId` à une fiche
    // locataire ne donne aucun accès au parc, c'est l'adhésion qui le fait.
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    return { cookie, userId: compte.id }
  }

  it('écrit UNE notification pour tous, et non une par personne', async () => {
    await rattacherUnCompte('locataire@example.com')

    const res = await annoncer(proprio, { message: 'Coupure d’eau jeudi de 8 h à 12 h.' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.delivered).toBe(1)

    /**
     * Le message est le MÊME pour tous : en fabriquer un par personne créerait
     * quatre faits là où il y en a un, et le bailleur relisant son journal
     * croirait avoir écrit quatre fois.
     */
    const annonces = await prisma.notification.findMany({
      where: { parkId, kind: 'announcement' },
      select: { messageKey: true, params: true, unitId: true, recipients: true },
    })
    expect(annonces).toHaveLength(1)
    /**
     * Les DESTINATAIRES, assertés et non seulement sélectionnés.
     *
     * Ce cas lisait `recipients` sans rien en dire : le `select` avait
     * l'apparence d'une garde sans en être une, et vider la création des
     * destinataires le laissait vert. Une notification sans destinataire n'est
     * lue par personne — c'est précisément ce que ce cas prétend éprouver.
     */
    expect(annonces[0]!.recipients).toHaveLength(1)
    expect(annonces[0]!.params).toEqual({ text: 'Coupure d’eau jeudi de 8 h à 12 h.' })
    // Aucune unité : le message porte sur l'immeuble ou le parc, et l'attacher
    // à un logement le ferait lire comme un événement de celui-là.
    expect(annonces[0]!.unitId).toBeNull()
  })

  it('nomme ceux qui ne recevront rien, plutôt que de les compter comme prévenus', async () => {
    await rattacherUnCompte('locataire@example.com')

    const res = await annoncer(proprio, { message: 'Coupure d’eau jeudi.' })

    /**
     * Un locataire sans compte n'a pas d'espace où lire. Rendre le seul nombre
     * d'envois laisserait croire que tout le monde est prévenu — le bailleur a
     * besoin de savoir qui appeler.
     */
    expect(res.body.unreachable.length).toBeGreaterThan(0)
    expect(res.body.unreachable[0]).toHaveProperty('fullName')
    // Et le compte des joignables ne les inclut pas.
    expect(res.body.delivered).toBe(1)
  })

  it('le locataire le lit dans son portefeuille', async () => {
    const { cookie } = await rattacherUnCompte('locataire@example.com')
    await annoncer(proprio, { message: 'Coupure d’eau jeudi de 8 h à 12 h.' }).expect(201)

    // La preuve qui compte n'est pas la ligne en base, c'est ce que la personne
    // visée voit.
    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    const annonce = res.body.notifications.find(
      (n: { messageKey: string }) => n.messageKey === 'announcement',
    )
    expect(annonce, JSON.stringify(res.body.notifications)).toBeDefined()
    expect(annonce.params.text).toBe('Coupure d’eau jeudi de 8 h à 12 h.')
  })

  it('borne l’envoi à un immeuble quand on le nomme', async () => {
    await rattacherUnCompte('locataire@example.com')
    const immeuble = await prisma.building.findFirstOrThrow({
      where: { parkId, units: { some: { leases: { some: { status: 'active' } } } } },
      select: { id: true },
    })
    const autre = await prisma.building.findFirstOrThrow({
      where: { parkId, id: { not: immeuble.id } },
      select: { id: true },
    })

    const cible = await annoncer(proprio, { buildingId: immeuble.id, message: 'Coupure jeudi.' })
    expect(cible.status).toBe(201)
    const large = await annoncer(proprio, { message: 'Coupure jeudi.' })

    // L'immeuble nommé touche STRICTEMENT moins de monde que le parc entier :
    // sans cette comparaison, un filtre ignoré passerait au vert.
    expect(cible.body.delivered + cible.body.unreachable.length).toBeLessThan(
      large.body.delivered + large.body.unreachable.length,
    )
    expect(autre.id).not.toBe(immeuble.id)
  })

  it('laisse le gestionnaire annoncer, dont c’est le métier', async () => {
    await rattacherUnCompte('locataire@example.com')
    // Prévenir d'une coupure d'eau est un geste d'exploitation, pas un
    // arbitrage : le lui refuser obligerait à réveiller le propriétaire.
    await annoncer(gestionnaire, { message: 'Coupure d’eau jeudi.' }).expect(201)
  })

  it('refuse un message vide, et un immeuble qui n’est pas du parc', async () => {
    await annoncer(proprio, { message: '  ' }).expect(400)

    // Le parc voisin est posé DIRECTEMENT : ce cas éprouve le cloisonnement,
    // pas le parcours d'inscription, et une seconde inscription avec semis
    // coûterait plus cher que ce qu'elle prouve.
    const immeubleVoisin = await prisma.building.create({
      data: {
        name: 'Résidence voisine',
        district: 'Bastos',
        park: { create: { name: 'Parc Bastos', countryCode: 'CM', currency: 'XAF' } },
      },
      select: { id: true },
    })

    // Un immeuble inconnu du parc et un immeuble sans locataire rendent le même
    // refus : les distinguer dirait à qui devine des identifiants lesquels
    // existent.
    const res = await annoncer(proprio, { buildingId: immeubleVoisin.id, message: 'Coupure.' })
    expect(res.status).toBe(404)
  })
})

/**
 * RÉPONDRE AU LOCATAIRE QUI A SIGNALÉ.
 *
 * Le canal existait dans un seul sens : le locataire déclarait une fuite, puis
 * regardait un statut avancer sans jamais savoir quand quelqu'un passerait. Les
 * échanges qui décident d'une dépense se perdaient hors du dossier.
 */
describe('répondre au locataire', () => {
  let parkId: string
  let proprio: string
  let gestionnaire: string
  let workId: string
  let cookieLocataire: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const d = await inscrire('diane@example.com')
    gestionnaire = d.cookie
    const compteGestion = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({
      data: { userId: compteGestion.id, parkId, role: 'manager' },
    })

    // Un locataire réel, avec son compte : c'est lui qui déclare, et c'est à
    // lui qu'on répond.
    const l = await inscrire('locataire@example.com')
    cookieLocataire = l.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'locataire@example.com' },
    })
    /**
     * ON PART DE L'INTERVENTION, la plus rare, et non du bail.
     *
     * Le semis pose DIX baux actifs et CINQ interventions. Tirer d'abord un bail
     * — `findFirstOrThrow` sans `orderBy` n'en promet aucun en particulier —
     * tombait une fois sur deux sur une unité qui n'en porte pas, et le
     * `findFirstOrThrow` suivant levait P2025 : tout le bloc échouait ensemble.
     *
     * Le défaut se voyait environ une exécution sur quatre, et JAMAIS sur le
     * fichier seul. Sans `ORDER BY`, Postgres rend les lignes dans l'ordre du
     * tas, que la suite entière remodèle à mesure qu'elle insère et efface :
     * l'ordre dépendait donc de ce qui avait tourné avant, ce qui rendait le
     * défaut irreproductible en isolation et le faisait passer pour du hasard.
     *
     * `orderBy` sur la référence — unique et croissante — rend le tirage
     * reproductible ; la contrainte sur le bail actif garantit que l'unité
     * retenue en porte un.
     */
    const travail = await prisma.workOrder.findFirstOrThrow({
      where: { unit: { building: { parkId }, leases: { some: { status: 'active' } } } },
      orderBy: { reference: 'asc' },
      select: { id: true, unitId: true },
    })
    const bail = await prisma.lease.findFirstOrThrow({
      where: { status: 'active', unitId: travail.unitId },
      select: { tenantId: true },
    })
    await prisma.tenant.update({ where: { id: bail.tenantId }, data: { userId: compte.id } })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
    await prisma.workOrder.update({
      where: { id: travail.id },
      data: { reportedByTenantId: bail.tenantId },
    })
    workId = travail.id
  })

  function repondre(cookie: string, id: string, corps: Record<string, unknown>) {
    return request(serveur)
      .post(`/api/parks/${parkId}/works/${id}/reply`)
      .set('Cookie', cookie)
      .send(corps)
  }

  it('porte la réponse jusqu’à l’espace du locataire', async () => {
    const res = await repondre(proprio, workId, { message: 'Le plombier passe jeudi matin.' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.delivered).toBe(true)

    // La preuve qui compte n'est pas la ligne en base, c'est ce que le
    // déclarant voit.
    const portefeuille = await request(serveur)
      .get(`/api/parks/${parkId}/portfolio`)
      .set('Cookie', cookieLocataire)
    const reponse = portefeuille.body.notifications.find(
      (n: { messageKey: string }) => n.messageKey === 'workReply',
    )
    expect(reponse, JSON.stringify(portefeuille.body.notifications)).toBeDefined()
    expect(reponse.params.text).toBe('Le plombier passe jeudi matin.')
    // `workId` rattache la réponse au signalement : sans lui, les réponses
    // s'empileraient sans dire de quoi elles parlent.
    expect(reponse.params.workId).toBe(workId)
  })

  it('empile les réponses au lieu de n’en garder qu’une', async () => {
    await repondre(proprio, workId, { message: 'Devis demandé au plombier.' }).expect(201)
    await repondre(proprio, workId, { message: 'Le plombier passe jeudi matin.' }).expect(201)

    /**
     * Un dossier d'où les échanges disparaissent ne défend plus personne. Un
     * champ unique sur l'intervention n'aurait gardé que le dernier message —
     * c'est la raison pour laquelle la réponse passe par le fil des
     * notifications plutôt que par une colonne.
     */
    const fil = await prisma.notification.count({ where: { parkId, messageKey: 'workReply' } })
    expect(fil).toBe(2)
  })

  it('laisse le gestionnaire répondre, dont c’est le métier', async () => {
    await repondre(gestionnaire, workId, { message: 'Nous intervenons demain.' }).expect(201)
  })

  it('refuse de répondre à une intervention sans déclarant', async () => {
    const sansDeclarant = await prisma.workOrder.findFirstOrThrow({
      where: { unit: { building: { parkId } }, reportedByTenantId: null },
      select: { id: true },
    })

    // Celles que le bailleur ouvre lui-même n'ont personne à qui répondre.
    // Écrire quand même produirait une notification sans destinataire, et
    // l'écran annoncerait « réponse envoyée ».
    const res = await repondre(proprio, sansDeclarant.id, { message: 'Bonjour.' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('no_reporter')
    expect(await prisma.notification.count({ where: { parkId, messageKey: 'workReply' } })).toBe(0)
  })

  it('dit que la réponse ne sera pas lue quand le locataire n’a pas de compte', async () => {
    const travail = await prisma.workOrder.findUniqueOrThrow({
      where: { id: workId },
      select: { reportedByTenantId: true },
    })
    await prisma.tenant.update({
      where: { id: travail.reportedByTenantId! },
      data: { userId: null },
    })

    // La réponse est consignée — elle appartient au dossier — mais il reste un
    // appel à passer, et le gestionnaire doit le savoir.
    const res = await repondre(proprio, workId, { message: 'Le plombier passe jeudi.' })
    expect(res.status).toBe(201)
    expect(res.body.delivered).toBe(false)
    expect(res.body.reporter.fullName).toBeTruthy()
  })

  it('ne répond pas à une intervention du parc d’à côté', async () => {
    const ailleurs = await prisma.workOrder.create({
      data: {
        reference: 'SIG-2026-999',
        title: 'Fuite chez le voisin',
        trade: 'plumbing',
        unit: {
          create: {
            label: 'Z9',
            type: 'T2',
            surfaceSqm: 40,
            baseRentMinor: 100000,
            building: {
              create: {
                name: 'Résidence voisine',
                district: 'Bastos',
                park: { create: { name: 'Parc Bastos', countryCode: 'CM', currency: 'XAF' } },
              },
            },
          },
        },
      },
      select: { id: true },
    })

    const res = await repondre(proprio, ailleurs.id, { message: 'Bonjour.' })
    expect(res.status).toBe(404)
  })
})

/**
 * MARQUER COMME LU, ET QUE ÇA TIENNE.
 *
 * `readAt` était au modèle depuis sa création, relu par le portefeuille depuis
 * autant de temps, et écrit par personne : le bouton « tout marquer comme lu »
 * vidait un compteur de session que le rechargement suivant remplissait de
 * nouveau. Le lot précédent a consigné la dette en toutes lettres ; ces cas la
 * ferment.
 */
describe('les notifications lues', () => {
  let parkId: string
  let proprio: string
  let cookieLocataire: string
  let compteLocataireId: string
  let uniteDuLocataire: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const l = await inscrire('locataire@example.com')
    cookieLocataire = l.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'locataire@example.com' },
    })
    compteLocataireId = compte.id
    const bail = await prisma.lease.findFirstOrThrow({
      where: { status: 'active', unit: { building: { parkId } } },
      select: { tenantId: true, unitId: true },
    })
    uniteDuLocataire = bail.unitId
    await prisma.tenant.update({ where: { id: bail.tenantId }, data: { userId: compte.id } })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
  })

  function marquer(cookie: string, ids: string[]) {
    return request(serveur)
      .patch(`/api/parks/${parkId}/notifications/read`)
      .set('Cookie', cookie)
      .send({ ids })
  }

  async function notificationsDe(cookie: string) {
    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    return res.body.notifications as { id: string; read: boolean; messageKey: string }[]
  }

  /**
   * LE BAILLEUR N'EST DESTINATAIRE DE RIEN, nommément.
   *
   * Ses notifications lui parviennent par l'unité — un impayé, un devis en
   * attente — et aucune ligne de `NotificationRecipient` ne les accompagne.
   * Sans création de ligne, il n'aurait RIEN pu marquer, jamais : le cas le
   * plus courant du produit aurait été le seul que la route ne traite pas.
   */
  it('marque ce dont personne n’est destinataire nommé', async () => {
    const avant = await notificationsDe(proprio)
    const nonLues = avant.filter((n) => !n.read)
    expect(nonLues.length, 'la démonstration doit semer des notifications').toBeGreaterThan(0)

    const res = await marquer(proprio, avant.map((n) => n.id))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    // Le compte des NOUVELLES lectures, et non celui des identifiants reçus :
    // le jeu de démonstration en sème déjà des lues, et les recompter ferait
    // passer ce cas pour la mauvaise raison.
    expect(res.body.marked).toBe(nonLues.length)

    // La preuve n'est pas la ligne en base, c'est ce que le portefeuille rend
    // au chargement SUIVANT — celui qui rallumait la pastille.
    const apres = await notificationsDe(proprio)
    expect(apres.every((n) => n.read)).toBe(true)
  })

  /**
   * L'AUTRE MOITIÉ : le locataire, dont la ligne existe déjà et attend sa date.
   *
   * Elle est écrite à l'envoi — c'est elle qui porte « à qui l'on parle » — avec
   * `readAt` nul. Ne traiter que les lignes absentes laisserait le destinataire
   * nommé, seul vrai lecteur du produit, incapable de marquer quoi que ce soit.
   */
  it('marque ce dont on est destinataire nommé', async () => {
    await request(serveur)
      .post(`/api/parks/${parkId}/announcements`)
      .set('Cookie', proprio)
      .send({ message: 'Coupure d’eau jeudi de 8 h à 12 h.' })
      .expect(201)

    const avant = await notificationsDe(cookieLocataire)
    const annonce = avant.find((n) => n.messageKey === 'announcement')
    expect(annonce, JSON.stringify(avant)).toBeDefined()
    expect(annonce!.read).toBe(false)
    // La ligne existe DÉJÀ, posée par l'envoi : c'est la branche « en attente »
    // et non la branche « sans ligne ».
    expect(
      await prisma.notificationRecipient.count({
        where: { notificationId: annonce!.id, userId: compteLocataireId, readAt: null },
      }),
    ).toBe(1)

    const res = await marquer(cookieLocataire, [annonce!.id])
    expect(res.body.marked).toBe(1)

    const apres = await notificationsDe(cookieLocataire)
    expect(apres.find((n) => n.id === annonce!.id)!.read).toBe(true)
  })

  /**
   * « IL L'A VUE LE 12 » EST UN FAIT.
   *
   * Rouvrir l'écran des notifications renvoie la même liste : réécrire la date à
   * chaque passage effacerait la seule information que ce champ porte, et le
   * jour où le produit dira « lue le 12 » il dirait « lue à l'instant ».
   */
  it('ne déplace pas la date d’une notification déjà lue', async () => {
    const liste = await notificationsDe(proprio)
    const cible = liste[0]!.id

    const premier = await marquer(proprio, [cible])
    expect(premier.body.marked).toBe(1)
    const date = await prisma.notificationRecipient.findFirstOrThrow({
      where: { notificationId: cible },
      select: { readAt: true },
    })

    const second = await marquer(proprio, [cible])
    // `0` et non `1` : c'est ce compte qui rend l'idempotence observable, et
    // sans lui la branche morte survivrait sans bruit.
    expect(second.body.marked).toBe(0)

    const apres = await prisma.notificationRecipient.findFirstOrThrow({
      where: { notificationId: cible },
      select: { readAt: true },
    })
    expect(apres.readAt!.getTime()).toBe(date.readAt!.getTime())
  })

  /**
   * LE FILTRE, sans lequel le geste le plus anodin ouvrirait le parc.
   *
   * Marquer crée une ligne de destinataire. Le filtre de lecture du portefeuille
   * sert ensuite ce dont on est destinataire — donc marquer la notification d'un
   * autre logement se la ferait servir au chargement suivant. Le locataire
   * lirait les impayés de son voisin par le bouton « tout marquer comme lu ».
   */
  it('ne marque pas ce que le locataire ne voit pas', async () => {
    const dAilleurs = await prisma.unit.findFirstOrThrow({
      where: { building: { parkId }, id: { not: uniteDuLocataire } },
      select: { id: true },
    })
    const voisine = await prisma.notification.create({
      data: {
        parkId,
        kind: 'payment',
        messageKey: 'rentOverdue',
        params: { tenant: 'Le voisin' },
        severity: 'high',
        unitId: dAilleurs.id,
      },
      select: { id: true },
    })

    const res = await marquer(cookieLocataire, [voisine.id])
    // 200 et non 404 : distinguer « inconnue » de « pas pour vous » dirait à qui
    // devine des identifiants lesquels existent. Rien n'est écrit, et c'est ce
    // que le compte annonce.
    expect(res.status).toBe(200)
    expect(res.body.marked).toBe(0)
    expect(
      await prisma.notificationRecipient.count({ where: { notificationId: voisine.id } }),
    ).toBe(0)

    // ET elle reste invisible : la moitié qui prouve que rien n'a fui.
    const liste = await notificationsDe(cookieLocataire)
    expect(liste.some((n) => n.id === voisine.id)).toBe(false)
  })

  it('ne marque pas les notifications du parc d’à côté', async () => {
    const voisin = await inscrire('ailleurs@example.com', {
      parkName: 'Parc Akwa',
      countryCode: 'CM',
    })
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', voisin.cookie)
    const autreParc = parcs.body.memberships[0].parkId as string
    const dAilleurs = await prisma.notification.create({
      data: {
        parkId: autreParc,
        kind: 'payment',
        messageKey: 'rentOverdue',
        params: { tenant: 'Chez le voisin' },
        severity: 'high',
      },
      select: { id: true },
    })

    const res = await marquer(proprio, [dAilleurs.id])
    expect(res.body.marked).toBe(0)
    expect(
      await prisma.notificationRecipient.count({ where: { notificationId: dAilleurs.id } }),
    ).toBe(0)
  })

  it('refuse un corps vide plutôt que de ne rien faire en silence', async () => {
    // Une liste vide n'est pas un geste : la laisser passer rendrait `marked: 0`
    // — indistinguable d'un refus de périmètre — pour un appel qui n'avait rien
    // à demander.
    const res = await marquer(proprio, [])
    expect(res.status).toBe(400)
  })
})

/**
 * LA DÉLÉGATION CESSE D'ÊTRE UN DÉCOR.
 *
 * `Park.delegation` est au schéma depuis l'origine, avec un commentaire
 * affirmant que « le serveur s'en sert pour autoriser ». Il ne s'en servait
 * nulle part : la colonne était lue une fois pour être recopiée dans la liste
 * des parcs, et aucune décision n'en dépendait. Aucune route ne l'écrivait non
 * plus — l'écran qui la présente la tenait dans un `useState`.
 */
describe('la politique de délégation', () => {
  let parkId: string
  let proprio: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId
  })

  const corriger = (cookie: string, corps: Record<string, unknown>) =>
    request(serveur).patch(`/api/parks/${parkId}`).set('Cookie', cookie).send(corps)

  const inviter = (cookie: string, corps: Record<string, unknown>) =>
    request(serveur).post(`/api/parks/${parkId}/invitations`).set('Cookie', cookie).send(corps)

  async function recruterUnGestionnaire() {
    const d = await inscrire('diane@example.com')
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'diane@example.com' },
    })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'manager' } })
    return { cookie: d.cookie, compteId: compte.id }
  }

  it('s’écrit, et se relit', async () => {
    // Elle naît déléguée : c'est le défaut du schéma, et le cas le fixe pour que
    // la bascule qui suit prouve quelque chose.
    const avant = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    expect(avant.body.memberships[0].delegation).toBe('delegate')

    const res = await corriger(proprio, { delegation: 'solo' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    const apres = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    expect(apres.body.memberships[0].delegation).toBe('solo')
  })

  /**
   * Elle voyage aussi par `/auth/me`, et pas seulement par `/parks`.
   *
   * C'est elle qui décide si l'écran propose de recruter un gestionnaire, et cet
   * écran est monté bien avant qu'on ait listé les parcs : la servir uniquement
   * dans `/parks` laisserait la modale d'invitation décider sans la connaître.
   */
  it('accompagne l’adhésion dès la session', async () => {
    await corriger(proprio, { delegation: 'solo' }).expect(200)
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    expect(moi.body.memberships[0].delegation).toBe('solo')
  })

  /**
   * LE REFUS QUI DONNE SON SENS AU RÉGLAGE.
   *
   * Sans lui, « je gère seul » serait une étiquette : le propriétaire l'aurait
   * posée puis aurait recruté dans la minute, et le mode n'aurait borné personne.
   */
  it('refuse le code gestionnaire quand le parc se gère seul', async () => {
    await corriger(proprio, { delegation: 'solo' }).expect(200)

    const res = await inviter(proprio, { role: 'manager' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('delegation_off')
    expect(await prisma.invitation.count({ where: { parkId, role: 'manager' } })).toBe(0)
  })

  /**
   * L'AUTRE MOITIÉ : gérer seul, c'est se passer d'un tiers, pas de ses
   * locataires. Sans ce cas, tout refuser satisferait le précédent.
   */
  it('émet toujours le code locataire dans un parc qui se gère seul', async () => {
    await corriger(proprio, { delegation: 'solo' }).expect(200)
    const res = await inviter(proprio, { role: 'tenant' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('laisse recruter tant que le parc délègue', async () => {
    const res = await inviter(proprio, { role: 'manager' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  /**
   * ON NE DÉCLARE PAS SEUL UN PARC QUE QUELQU'UN OPÈRE.
   *
   * Le réglage annoncerait qu'aucun tiers n'y touche pendant que Diane garde sa
   * clé, ses écrans et ses gestes. Le refus nomme le geste à faire d'abord
   * plutôt que de révoquer dans le dos du propriétaire une adhésion qu'il n'a
   * pas demandé de retirer.
   */
  it('refuse la gestion seule tant qu’un gestionnaire est en place', async () => {
    await recruterUnGestionnaire()

    const res = await corriger(proprio, { delegation: 'solo' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('has_managers')

    // Et RIEN n'a été écrit : un refus qui laisse la moitié du geste passer est
    // pire que pas de refus du tout.
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    expect(parcs.body.memberships[0].delegation).toBe('delegate')
  })

  it('l’accepte une fois l’accès du gestionnaire retiré', async () => {
    const { compteId } = await recruterUnGestionnaire()
    const adhesion = await prisma.membership.findFirstOrThrow({
      where: { parkId, userId: compteId },
      select: { id: true },
    })
    await request(serveur)
      .patch(`/api/parks/${parkId}/memberships/${adhesion.id}/revoke`)
      .set('Cookie', proprio)
      .expect(204)

    // `exigerAppartenance` filtre déjà sur `status: 'active'` : le compte est la
    // même règle, et une adhésion révoquée ne retient plus rien.
    await corriger(proprio, { delegation: 'solo' }).expect(200)
  })

  it('n’est pas un réglage de gestionnaire', async () => {
    const { cookie } = await recruterUnGestionnaire()
    // Il est précisément celui que la politique borne : la lui laisser changer
    // lui rendrait les deux gestes qu'elle lui retire.
    const res = await corriger(cookie, { delegation: 'solo' })
    expect(res.status).toBe(403)
  })
})

/**
 * LES DEUX TEXTES DU VERSEMENT.
 *
 * `Payment.reference` était saisie à l'encaissement, écrite en base, et rendue à
 * personne : le bailleur tapait « MM-4471 » et ne le revoyait jamais.
 * `Payment.note` n'avait même pas de champ de saisie. Deux colonnes au schéma
 * depuis l'origine, dont l'une écrite pour rien et l'autre jamais écrite.
 *
 * Elles ne se servent PAS aux mêmes gens, et c'est le sujet : la référence est
 * opposable, la note est interne.
 */
describe('la référence et la note d’un versement', () => {
  let parkId: string
  let proprio: string
  let cookieLocataire: string
  let uniteDuLocataire: string
  let bailDuLocataire: string
  let periode: string

  beforeEach(async () => {
    const p = await inscrire('proprio@example.com', {
      parkName: 'Parc Bonamoussadi',
      countryCode: 'CM',
      seedDemo: true,
    })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const l = await inscrire('locataire@example.com')
    cookieLocataire = l.cookie
    const compte = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'locataire@example.com' },
    })
    const bail = await prisma.lease.findFirstOrThrow({
      where: { status: 'active', unit: { building: { parkId } } },
      select: { id: true, tenantId: true, unitId: true },
    })
    uniteDuLocataire = bail.unitId
    bailDuLocataire = bail.id
    await prisma.tenant.update({ where: { id: bail.tenantId }, data: { userId: compte.id } })
    await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })

    const echeance = await prisma.rentCharge.findFirstOrThrow({
      where: { lease: { unitId: uniteDuLocataire } },
      orderBy: { periodStart: 'desc' },
      select: { periodStart: true },
    })
    periode = echeance.periodStart.toISOString().slice(0, 10)
  })

  const encaisser = (corps: Record<string, unknown>) =>
    request(serveur)
      .post(`/api/parks/${parkId}/payments`)
      .set('Cookie', proprio)
      .send({ unitId: uniteDuLocataire, periodStart: periode, amountMinor: 1000, method: 'mobile', ...corps })

  async function versementsVus(cookie: string) {
    const res = await request(serveur).get(`/api/parks/${parkId}/portfolio`).set('Cookie', cookie)
    // `leaseCharges` est plate et porte le BAIL, non l'unité : c'est la clé du
    // cloisonnement, et deux locataires successifs d'un même logement ne
    // partagent pas leurs versements.
    const lignes = (res.body.leaseCharges ?? []) as {
      leaseId: string
      payments: { reference?: string | null; note?: string | null }[]
    }[]
    return lignes.filter((l) => l.leaseId === bailDuLocataire).flatMap((l) => l.payments)
  }

  it('garde la note, que rien n’écrivait', async () => {
    await encaisser({ note: 'Solde promis le 15.' }).expect(201)

    const enBase = await prisma.payment.findFirstOrThrow({
      where: { charge: { lease: { unitId: uniteDuLocataire } } },
      orderBy: { createdAt: 'desc' },
      select: { note: true },
    })
    expect(enBase.note).toBe('Solde promis le 15.')
  })

  /**
   * LA RÉFÉRENCE REVIENT — c'est la moitié qui manquait le plus.
   *
   * Elle était acceptée par le schéma de la route depuis l'origine et absente du
   * `select` de la lecture : écrite, puis perdue de vue pour toujours.
   */
  it('rend la référence au bailleur ET au locataire', async () => {
    await encaisser({ reference: 'MM-4471', note: 'Solde promis le 15.' }).expect(201)

    const cotéBailleur = await versementsVus(proprio)
    expect(cotéBailleur.some((p) => p.reference === 'MM-4471')).toBe(true)

    // C'est avec elle qu'un locataire conteste : la lui cacher lui demanderait
    // de croire sur parole un encaissement qu'il ne peut pas retrouver.
    const cotéLocataire = await versementsVus(cookieLocataire)
    expect(cotéLocataire.some((p) => p.reference === 'MM-4471')).toBe(true)
  })

  /**
   * LA NOTE NE SORT PAS, et le retrait se fait au SERVEUR.
   *
   * Un masquage à l'écran laisserait la phrase dans la réponse, où elle se lit
   * dans l'onglet réseau. C'est ce qu'on écrit SUR le locataire — même ordre
   * que le coût des travaux, que son espace n'affiche pas.
   */
  it('ne sert pas la note au locataire', async () => {
    await encaisser({ reference: 'MM-4471', note: 'Solde promis le 15.' }).expect(201)

    const cotéBailleur = await versementsVus(proprio)
    expect(cotéBailleur.some((p) => p.note === 'Solde promis le 15.')).toBe(true)

    const cotéLocataire = await versementsVus(cookieLocataire)
    // Le champ est ABSENT, et pas seulement vide : `note: null` dirait au
    // locataire qu'il existe une annotation qu'on lui refuse.
    expect(cotéLocataire.every((p) => !('note' in p))).toBe(true)
    expect(JSON.stringify(cotéLocataire)).not.toContain('Solde promis')
  })

  it('accepte un versement sans aucun des deux', async () => {
    // Les espèces ne produisent pas de référence, et tout ne s'annote pas. Les
    // deux champs restent facultatifs : les rendre requis ferait échouer le
    // geste le plus courant du produit.
    await encaisser({}).expect(201)
    const enBase = await prisma.payment.findFirstOrThrow({
      where: { charge: { lease: { unitId: uniteDuLocataire } } },
      orderBy: { createdAt: 'desc' },
      select: { reference: true, note: true },
    })
    expect(enBase.reference).toBeNull()
    expect(enBase.note).toBeNull()
  })

  it('refuse une note plus longue que la colonne', async () => {
    const res = await encaisser({ note: 'x'.repeat(281) })
    expect(res.status).toBe(400)
  })
})

/**
 * ─── LES PHOTOS DE RÉSERVE ───────────────────────────────────────────────────
 *
 * Ce que ces cas gardent n'est pas « on peut déposer une image ». C'est que la
 * photo d'un état des lieux tienne devant un litige : qu'elle soit datée par le
 * serveur, qu'elle disparaisse avec ce qu'elle documente, et que personne
 * d'autre que le parc ne puisse l'atteindre — y compris en forgeant l'adresse.
 *
 * Le dépôt est SUBSTITUÉ vers un dossier temporaire pour toute la section : la
 * suite n'a pas à écrire dans l'arbre du dépôt, et l'horloge fixe permet de
 * faire vieillir une adresse sans attendre.
 */
describe('les photos de réserve', () => {
  let parkId: string
  let proprio: string
  let findingId: string
  /** L'unité qui porte l'état des lieux — les cas de portée en ouvrent d'autres. */
  let unitId: string
  let racine: string
  let restaurerStockage: () => void

  /** Horloge du dépôt, fixe : une adresse ne périme pas au rythme de la machine. */
  const T0 = 1_700_000_000_000

  function image(taille: number): Buffer {
    const octets = Buffer.alloc(taille)
    octets.set([0xff, 0xd8, 0xff], 0) // entête JPEG
    return octets
  }

  beforeEach(async () => {
    racine = await mkdtemp(join(tmpdir(), 'gestlocpro-photos-'))
    restaurerStockage = remplacerStockage(
      new StockageLocal(racine, env.SESSION_SECRET, () => T0),
    )

    const p = await inscrire('photos@example.com', { parkName: 'Parc' })
    proprio = p.cookie
    const parcs = await request(serveur).get('/api/auth/me').set('Cookie', proprio)
    parkId = parcs.body.memberships[0].parkId

    const immeuble = await request(serveur)
      .post(`/api/parks/${parkId}/buildings`)
      .set('Cookie', proprio)
      .send({ name: 'Résidence Makepe', district: 'Makepe' })
    const logement = await request(serveur)
      .post(`/api/parks/${parkId}/buildings/${immeuble.body.building.id}/units`)
      .set('Cookie', proprio)
      .send({ label: 'A1', type: 'T3', surfaceSqm: 78, baseRentMinor: 145000 })

    unitId = logement.body.unit.id

    const etat = await request(serveur)
      .post(`/api/parks/${parkId}/units/${unitId}/inspections`)
      .set('Cookie', proprio)
      .send({
        kind: 'entry',
        rooms: 3,
        performedOn: '2026-02-01',
        findings: [{ room: 'Cuisine', description: 'Rayure profonde.', severity: 'major' }],
      })
    findingId = etat.body.inspection.findings[0].id
  })

  afterEach(async () => {
    restaurerStockage()
    await rm(racine, { recursive: true, force: true })
  })

  async function reserver(sizeBytes: number, contentType = 'image/jpeg') {
    const res = await request(serveur)
      .post(`/api/parks/${parkId}/findings/${findingId}/photos`)
      .set('Cookie', proprio)
      .send({ contentType, sizeBytes })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body as {
      photo: { id: string; confirmedAt: string | null }
      envoi: { url: string; methode: string; entetes: Record<string, string>; expireLe: number }
    }
  }

  function deposer(url: string, octets: Buffer, type = 'image/jpeg') {
    return request(serveur).put(url).set('Content-Type', type).send(octets)
  }

  function confirmer(photoId: string, corps: Record<string, unknown> = {}) {
    return request(serveur)
      .post(`/api/parks/${parkId}/photos/${photoId}/confirmation`)
      .set('Cookie', proprio)
      .send(corps)
  }

  /** Le parcours entier, de la réservation à l'octet servi. */
  async function photoComplete(taille = 256) {
    const { photo, envoi } = await reserver(taille)
    expect((await deposer(envoi.url, image(taille))).status).toBe(204)
    const confirmee = await confirmer(photo.id)
    expect(confirmee.status, JSON.stringify(confirmee.body)).toBe(200)
    return { photoId: photo.id, envoi, taille }
  }

  it('mène une photo de la réservation à l’octet servi', async () => {
    const { photoId, taille } = await photoComplete(512)

    const vue = await request(serveur)
      .get(`/api/parks/${parkId}/photos/${photoId}`)
      .set('Cookie', proprio)
    expect(vue.status).toBe(200)
    expect(vue.body.photo.sizeBytes).toBe(taille)
    expect(vue.body.photo.contentType).toBe('image/jpeg')

    const octets = await request(serveur).get(vue.body.lecture.url)
    expect(octets.status).toBe(200)
    expect(octets.headers['content-type']).toContain('image/jpeg')
    // Le navigateur ne doit pas ré-interpréter ce que le serveur a reconnu.
    expect(octets.headers['x-content-type-options']).toBe('nosniff')
    expect(octets.body.length).toBe(taille)
  })

  /**
   * La clé de stockage ne sort JAMAIS comme un champ.
   *
   * Elle ne circule que dans des adresses signées et périssables. Rendue comme
   * une propriété de la photo, elle finirait dans un état de client, un journal
   * de navigateur, une capture d'écran — et une clé qui traîne annule la
   * protection de la lecture, puisque c'est elle qu'on ne devine pas.
   */
  it('ne rend jamais la clé de stockage comme un champ', async () => {
    const { photo, envoi } = await reserver(64)
    const cle = new URL(envoi.url, 'http://local').pathname.split('/').pop()!

    expect(JSON.stringify(photo)).not.toContain(cle)

    const enBase = await prisma.inspectionPhoto.findUniqueOrThrow({ where: { id: photo.id } })
    expect(enBase.storageKey).toBe(cle)
  })

  /**
   * GARDE — L'HORODATAGE VIENT DU SERVEUR.
   *
   * C'est ce qui donne sa valeur à la photo le jour d'un litige. Une date
   * d'appareil se change dans les réglages de l'appareil ; celle-ci vient d'une
   * horloge que le déposant ne tient pas.
   *
   * L'encadrement est mesuré entre deux instants relevés autour de l'appel, et
   * non comparé à un délai : un test qui tolère « moins de deux secondes »
   * échoue le jour où la machine est chargée.
   */
  it('horodate depuis le serveur, et ignore la date envoyée par le client', async () => {
    const { photo, envoi } = await reserver(128)
    await deposer(envoi.url, image(128))

    const avant = new Date()
    const res = await confirmer(photo.id, {
      confirmedAt: '1999-01-01T00:00:00.000Z',
      takenAt: '1999-01-01T00:00:00.000Z',
      createdAt: '1999-01-01T00:00:00.000Z',
    })
    const apres = new Date()

    expect(res.status).toBe(200)
    const enBase = await prisma.inspectionPhoto.findUniqueOrThrow({ where: { id: photo.id } })
    expect(enBase.confirmedAt).not.toBeNull()
    expect(enBase.confirmedAt!.getTime()).toBeGreaterThanOrEqual(avant.getTime())
    expect(enBase.confirmedAt!.getTime()).toBeLessThanOrEqual(apres.getTime())
    expect(enBase.confirmedAt!.getUTCFullYear()).not.toBe(1999)
  })

  it('refuse une seconde confirmation, qui réécrirait la date', async () => {
    const { photoId } = await photoComplete()

    const rejouee = await confirmer(photoId)

    expect(rejouee.status).toBe(409)
    expect(rejouee.body.error).toBe('already_confirmed')
  })

  /**
   * GARDE — AUCUNE PHOTO ATTEIGNABLE SANS APPARTENANCE.
   *
   * Éprouvée avec un VRAI second compte, membre de son propre parc, et non avec
   * une requête sans jeton : c'est le cas qu'on redoute, celui d'un utilisateur
   * parfaitement authentifié qui essaie l'identifiant du voisin.
   *
   * 404 partout, et non 403 : un 403 confirmerait que la photo existe, et il
   * suffirait alors d'énumérer pour cartographier les états des lieux des
   * autres.
   */
  describe('un compte étranger', () => {
    it('ne lit, ne confirme ni ne supprime la photo d’un autre parc', async () => {
      const { photoId } = await photoComplete()

      const voisin = await inscrire('voisin-photos@example.com', { parkName: 'Parc voisin' })
      const sesParcs = await request(serveur).get('/api/auth/me').set('Cookie', voisin.cookie)
      const sonParc = sesParcs.body.memberships[0].parkId

      // Par SON parc : la photo n'y est pas — la jointure ne la ramène pas.
      for (const chemin of [`/api/parks/${sonParc}/photos/${photoId}`]) {
        expect((await request(serveur).get(chemin).set('Cookie', voisin.cookie)).status).toBe(404)
        expect((await request(serveur).delete(chemin).set('Cookie', voisin.cookie)).status).toBe(404)
      }

      // Par le parc de l'autre : `exigerAppartenance` ne confirme même pas que
      // ce parc existe.
      const parLeParcDeLAutre = `/api/parks/${parkId}/photos/${photoId}`
      expect((await request(serveur).get(parLeParcDeLAutre).set('Cookie', voisin.cookie)).status).toBe(404)
      expect((await request(serveur).delete(parLeParcDeLAutre).set('Cookie', voisin.cookie)).status).toBe(404)
      expect(
        (await request(serveur)
          .post(`/api/parks/${parkId}/photos/${photoId}/confirmation`)
          .set('Cookie', voisin.cookie)
          .send({})).status,
      ).toBe(404)

      // Rien n'a bougé.
      expect(await prisma.inspectionPhoto.count({ where: { id: photoId } })).toBe(1)
    })

    it('n’accroche pas de photo à la réserve d’un autre parc', async () => {
      const voisin = await inscrire('voisin-reserve@example.com', { parkName: 'Parc voisin' })
      const sesParcs = await request(serveur).get('/api/auth/me').set('Cookie', voisin.cookie)
      const sonParc = sesParcs.body.memberships[0].parkId

      const res = await request(serveur)
        .post(`/api/parks/${sonParc}/findings/${findingId}/photos`)
        .set('Cookie', voisin.cookie)
        .send({ contentType: 'image/jpeg', sizeBytes: 64 })

      expect(res.status).toBe(404)
      expect(await prisma.inspectionPhoto.count()).toBe(0)
    })
  })

  /**
   * GARDE — UNE ADRESSE DE LECTURE PÉRIMÉE OU TRAFIQUÉE EST REFUSÉE.
   *
   * Au lot précédent, cette signature était calculée sans que rien ne la
   * contrôle. Ces cas la rendent opposable.
   */
  describe('l’adresse de lecture', () => {
    async function adresse(photoId: string): Promise<string> {
      const vue = await request(serveur)
        .get(`/api/parks/${parkId}/photos/${photoId}`)
        .set('Cookie', proprio)
      return vue.body.lecture.url as string
    }

    it('refuse une adresse PÉRIMÉE', async () => {
      const { photoId } = await photoComplete()
      const url = await adresse(photoId)
      expect((await request(serveur).get(url)).status).toBe(200)

      // Le dépôt vieillit de onze minutes ; l'adresse en valait cinq.
      restaurerStockage()
      restaurerStockage = remplacerStockage(
        new StockageLocal(racine, env.SESSION_SECRET, () => T0 + 11 * 60 * 1000),
      )

      const res = await request(serveur).get(url)
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('expiree')
    })

    it('refuse une signature TRAFIQUÉE', async () => {
      const { photoId } = await photoComplete()
      const url = new URL(await adresse(photoId), 'http://local')
      const signature = url.searchParams.get('signature')!
      url.searchParams.set('signature', (signature[0] === '0' ? '1' : '0') + signature.slice(1))

      const res = await request(serveur).get(url.pathname + url.search)
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('signature')
    })

    it('refuse une échéance REPOUSSÉE — c’est le seul intérêt de la signer', async () => {
      const { photoId } = await photoComplete()
      const url = new URL(await adresse(photoId), 'http://local')
      url.searchParams.set('expire', String(T0 + 365 * 24 * 3600 * 1000))

      const res = await request(serveur).get(url.pathname + url.search)
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('signature')
    })

    it('n’a pas d’adresse tant que la photo n’est pas confirmée', async () => {
      const { photo, envoi } = await reserver(64)
      await deposer(envoi.url, image(64))

      const vue = await request(serveur)
        .get(`/api/parks/${parkId}/photos/${photo.id}`)
        .set('Cookie', proprio)

      expect(vue.status).toBe(404)
    })
  })

  /**
   * GARDE — LE PLAFOND EST LIÉ À L'AUTORISATION.
   *
   * Le refus tombe AVANT que les octets ne soient stockés, donc avant qu'ils ne
   * soient payés. Vérifié à la confirmation seulement, il aurait gardé la base
   * et laissé la facture courir.
   */
  describe('l’autorisation d’envoi', () => {
    it('refuse un dépôt d’une autre taille que celle autorisée', async () => {
      const { photo, envoi } = await reserver(256)

      const trop = await deposer(envoi.url, image(1024))
      const pasAssez = await deposer(envoi.url, image(12))

      expect(trop.status).toBe(413)
      expect(pasAssez.status).toBe(413)

      // Rien n'a été écrit : la confirmation ne trouve pas d'objet.
      const res = await confirmer(photo.id)
      expect(res.status).toBe(422)
      expect(res.body.motif).toBe('absent')
    })

    it('refuse une taille relevée dans l’adresse, signature inchangée', async () => {
      const { envoi } = await reserver(256)
      const url = new URL(envoi.url, 'http://local')
      // SOUS LE PLAFOND, délibérément : ce cas mesure la SIGNATURE, pas la
      // taille. Une valeur au-dessus du plafond ferait répondre 413 à
      // `express.raw` avant que la signature soit seulement lue, et le test
      // passerait au vert en ayant cessé de garder ce qu'il annonce.
      url.searchParams.set('taille', '5000')

      const res = await deposer(url.pathname + url.search, image(5000))

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('signature')
    })

    it('refuse une réservation au-delà du plafond par objet', async () => {
      const res = await request(serveur)
        .post(`/api/parks/${parkId}/findings/${findingId}/photos`)
        .set('Cookie', proprio)
        .send({ contentType: 'image/jpeg', sizeBytes: PLAFOND_PAR_OBJET_OCTETS + 1 })

      expect(res.status).toBe(400)
      expect(await prisma.inspectionPhoto.count()).toBe(0)
    })

    /**
     * La taille passe, la NATURE ne passe pas.
     *
     * Le dépôt accepte : la longueur annoncée est exacte. C'est la confirmation
     * qui regarde les octets et refuse — la preuve que les deux contrôles ne se
     * remplacent pas l'un l'autre.
     */
    it('accepte des octets de la bonne taille, et les refuse à la confirmation', async () => {
      const html = Buffer.from('<script>alert(1)</script>')
      const { photo, envoi } = await reserver(html.length)

      expect((await deposer(envoi.url, html)).status).toBe(204)

      const res = await confirmer(photo.id)
      expect(res.status).toBe(422)
      expect(res.body.motif).toBe('pas-une-image')
      // La ligne ET l'objet sont partis ensemble.
      expect(await prisma.inspectionPhoto.count({ where: { id: photo.id } })).toBe(0)
    })
  })

  /**
   * GARDE — AUCUN ORPHELIN EN BASE.
   *
   * Une ligne qui survit à la réserve qu'elle documente n'est pas seulement du
   * désordre : plus aucune jointure ne la relie à un parc, donc plus aucun
   * contrôle d'appartenance ne saurait la protéger.
   */
  describe('la cascade', () => {
    it('ne laisse aucune photo derrière une réserve supprimée', async () => {
      const { photoId } = await photoComplete()

      await prisma.inspectionFinding.delete({ where: { id: findingId } })

      expect(await prisma.inspectionPhoto.count({ where: { id: photoId } })).toBe(0)
    })

    it('ne laisse aucune photo derrière un état des lieux supprimé', async () => {
      const { photoId } = await photoComplete()

      const reserve = await prisma.inspectionFinding.findUniqueOrThrow({
        where: { id: findingId },
        select: { inspectionId: true },
      })
      await prisma.inspection.delete({ where: { id: reserve.inspectionId } })

      expect(await prisma.inspectionPhoto.count({ where: { id: photoId } })).toBe(0)
    })
  })

  /**
   * ─── LA PORTÉE DU LOCATAIRE ──────────────────────────────────────────────
   *
   * C'est la personne dont on arbitre la caution, et la photo est la pièce qui
   * sert à la retenir : lui fermer la preuve était l'inverse de ce que ce
   * produit dit faire. Ces cas disent où s'arrête l'ouverture.
   *
   * LE CAS NEUF EST LE DEUXIÈME. Le cloisonnement précédent bornait à l'UNITÉ,
   * et une unité a une histoire : l'état des lieux de sortie du locataire
   * d'avant porte les photographies de SON occupation. Un locataire qui verrait
   * tout l'historique de son logement verrait les affaires de quelqu'un
   * d'autre.
   */
  describe('la portée du locataire', () => {
    /** Le locataire dont le bail porte l'état des lieux du montage. */
    let locataire: string
    let sonBail: string
    /** Un voisin du MÊME parc, sur une AUTRE unité. */
    let voisin: string
    /** La réserve de l'état des lieux rattaché au bail SUIVANT, même logement. */
    let reserveDuSuivant: string

    /** Monte la photo d'une réserve de bout en bout — toujours par le bailleur. */
    async function photoDe(reserveId: string, taille = 128): Promise<string> {
      const res = await request(serveur)
        .post(`/api/parks/${parkId}/findings/${reserveId}/photos`)
        .set('Cookie', proprio)
        .send({ contentType: 'image/jpeg', sizeBytes: taille })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect((await deposer(res.body.envoi.url, image(taille))).status).toBe(204)
      const ok = await confirmer(res.body.photo.id)
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      return res.body.photo.id as string
    }

    /** Rattache un compte au parc comme locataire, et rend son identifiant. */
    async function compteLocataire(email: string): Promise<{ cookie: string; id: string }> {
      const { cookie } = await inscrire(email)
      const compte = await prisma.userAccount.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      })
      await prisma.membership.create({ data: { userId: compte.id, parkId, role: 'tenant' } })
      return { cookie, id: compte.id }
    }

    beforeEach(async () => {
      const lui = await compteLocataire('locataire-photos@example.com')
      locataire = lui.cookie
      const saFiche = await prisma.tenant.create({
        data: { parkId, fullName: 'Awa Bello', userId: lui.id },
      })
      const sien = await prisma.lease.create({
        data: {
          unitId,
          tenantId: saFiche.id,
          startsOn: new Date('2024-01-01T00:00:00.000Z'),
          rentMinor: 145000,
          status: 'active',
        },
      })
      sonBail = sien.id
      // L'état des lieux du montage devient LE SIEN : c'est celui qui lui a été
      // opposé à l'entrée.
      const saReserve = await prisma.inspectionFinding.findUniqueOrThrow({
        where: { id: findingId },
        select: { inspectionId: true },
      })
      await prisma.inspection.update({
        where: { id: saReserve.inspectionId },
        data: { leaseId: sonBail },
      })

      // Le bail SUIVANT, sur la MÊME unité. L'index unique partiel n'autorise
      // qu'un bail en cours par unité : on clôt le sien avant d'installer le
      // successeur. Son départ ne lui retire rien — `unitesVisibles` retient le
      // logement, et c'est justement pourquoi la portée par bail est nécessaire.
      await prisma.lease.update({
        where: { id: sonBail },
        data: { status: 'ended', endsOn: new Date() },
      })
      const successeur = await prisma.tenant.create({
        data: { parkId, fullName: 'Locataire suivant' },
      })
      const bailSuivant = await prisma.lease.create({
        data: {
          unitId,
          tenantId: successeur.id,
          startsOn: new Date(),
          rentMinor: 150000,
          status: 'active',
        },
      })
      const etatDuSuivant = await prisma.inspection.create({
        data: {
          unitId,
          leaseId: bailSuivant.id,
          kind: 'entry',
          performedOn: new Date(),
          rooms: 3,
          findings: {
            create: [
              {
                room: 'Chambre du successeur',
                description: 'Trace d’humidité au plafond.',
                severity: 'major',
              },
            ],
          },
        },
        select: { findings: { select: { id: true } } },
      })
      reserveDuSuivant = etatDuSuivant.findings[0]!.id

      // UN VOISIN, dans le même parc, sur une autre unité : membre légitime, et
      // pourtant étranger à ce logement.
      const elle = await compteLocataire('voisine-photos@example.com')
      voisin = elle.cookie
      const immeuble = await prisma.building.findFirstOrThrow({
        where: { parkId },
        select: { id: true },
      })
      const autreUnite = await prisma.unit.create({
        data: {
          buildingId: immeuble.id,
          label: 'B2',
          type: 'T2',
          surfaceSqm: 52,
          baseRentMinor: 90000,
        },
      })
      const saFicheAElle = await prisma.tenant.create({
        data: { parkId, fullName: 'Mireille Fotso', userId: elle.id },
      })
      await prisma.lease.create({
        data: {
          unitId: autreUnite.id,
          tenantId: saFicheAElle.id,
          startsOn: new Date(),
          rentMinor: 90000,
          status: 'active',
        },
      })
    })

    it('sert au locataire la photo de l’état des lieux de SON bail', async () => {
      const photoId = await photoDe(findingId)

      const vue = await request(serveur)
        .get(`/api/parks/${parkId}/photos/${photoId}`)
        .set('Cookie', locataire)

      expect(vue.status, JSON.stringify(vue.body)).toBe(200)
      // L'adresse n'est pas décorative : elle rend les octets.
      const octets = await request(serveur).get(vue.body.lecture.url)
      expect(octets.status).toBe(200)
      expect(octets.headers['content-type']).toContain('image/jpeg')
    })

    /**
     * LE CAS NEUF : SA PROPRE UNITÉ, UN AUTRE BAIL.
     *
     * L'ancien cloisonnement — par unité — laissait passer celui-ci, et c'est le
     * seul endroit où les deux règles rendent un verdict différent.
     */
    it('rend 404 sur la photo d’un AUTRE bail du MÊME logement', async () => {
      const photoId = await photoDe(reserveDuSuivant)

      const vue = await request(serveur)
        .get(`/api/parks/${parkId}/photos/${photoId}`)
        .set('Cookie', locataire)

      // 404 et non 403 : un 403 confirmerait que cette photo existe, et il
      // suffirait d'énumérer pour savoir ce que le voisin a abîmé.
      expect(vue.status).toBe(404)
      expect(vue.body.error).toBe('not_found')
      expect(vue.body.lecture).toBeUndefined()
    })

    it('rend 404 à un locataire voisin du même parc', async () => {
      const photoId = await photoDe(findingId)

      const vue = await request(serveur)
        .get(`/api/parks/${parkId}/photos/${photoId}`)
        .set('Cookie', voisin)

      expect(vue.status).toBe(404)
    })

    /**
     * IL REGARDE, IL NE DÉPOSE PAS.
     *
     * Un locataire qui pourrait déposer fabriquerait la pièce qu'on lui oppose ;
     * un locataire qui pourrait supprimer effacerait celle qui l'accuse. 403 et
     * non 404 : l'existence de la photo lui est déjà acquise par la lecture, il
     * n'y a plus rien à cacher — seulement un droit à refuser.
     */
    it('n’ouvre aucun chemin d’écriture au locataire', async () => {
      const photoId = await photoDe(findingId)

      const reservation = await request(serveur)
        .post(`/api/parks/${parkId}/findings/${findingId}/photos`)
        .set('Cookie', locataire)
        .send({ contentType: 'image/jpeg', sizeBytes: 64 })
      const confirmation = await request(serveur)
        .post(`/api/parks/${parkId}/photos/${photoId}/confirmation`)
        .set('Cookie', locataire)
        .send({})
      const suppression = await request(serveur)
        .delete(`/api/parks/${parkId}/photos/${photoId}`)
        .set('Cookie', locataire)

      expect(reservation.status).toBe(403)
      expect(confirmation.status).toBe(403)
      expect(suppression.status).toBe(403)
      // La photo est intacte, et aucune ligne nouvelle n'a été posée.
      expect(await prisma.inspectionPhoto.count()).toBe(1)
      expect(await prisma.inspectionPhoto.count({ where: { id: photoId } })).toBe(1)
    })

    /**
     * LE PORTEFEUILLE ANNONCE LES PHOTOS, et la même frontière s'y applique.
     *
     * Sans elle, la lecture serait gardée et l'INVENTAIRE ne le serait pas : le
     * locataire n'obtiendrait pas les octets du successeur, mais il saurait
     * combien de photographies documentent la chambre de quelqu'un d'autre.
     */
    it('n’annonce au locataire que les photos de son propre bail', async () => {
      const sienne = await photoDe(findingId)
      const celleDuSuivant = await photoDe(reserveDuSuivant)

      const vue = await request(serveur)
        .get(`/api/parks/${parkId}/portfolio`)
        .set('Cookie', locataire)

      interface PhotoApi { id: string; contentType: string; confirmedAt: string | null }
      const photos: PhotoApi[] = vue.body.inspections.flatMap(
        (i: { findings: { photos: PhotoApi[] }[] }) => i.findings.flatMap((f) => f.photos),
      )

      expect(photos.map((p) => p.id)).toContain(sienne)
      expect(photos.map((p) => p.id)).not.toContain(celleDuSuivant)
      // La date VIENT DU SERVEUR, et c'est elle qu'on oppose : sans elle,
      // l'écran ne pourrait dater la preuve que par l'appareil qui l'a prise.
      expect(photos.every((p) => p.confirmedAt !== null)).toBe(true)
      expect(JSON.stringify(vue.body.inspections)).not.toContain('Chambre du successeur')
    })

    /**
     * UNE RÉSERVATION SANS OCTETS N'EST PAS UNE PHOTO.
     *
     * L'annoncer poserait dans l'écran une vignette qui ne se chargerait jamais,
     * et le locataire lirait « preuve manquante » là où il n'y a jamais eu de
     * preuve. La route de lecture la refuse déjà ; l'inventaire doit dire la
     * même chose.
     */
    it('n’annonce pas une photo réservée dont les octets ne sont jamais arrivés', async () => {
      const reservee = await request(serveur)
        .post(`/api/parks/${parkId}/findings/${findingId}/photos`)
        .set('Cookie', proprio)
        .send({ contentType: 'image/jpeg', sizeBytes: 64 })
      expect(reservee.status).toBe(201)

      const vue = await request(serveur)
        .get(`/api/parks/${parkId}/portfolio`)
        .set('Cookie', proprio)
      const ids: string[] = vue.body.inspections.flatMap(
        (i: { findings: { photos: { id: string }[] }[] }) =>
          i.findings.flatMap((f) => f.photos.map((p) => p.id)),
      )

      expect(ids).not.toContain(reservee.body.photo.id)
      // La ligne existe pourtant : c'est bien la CONFIRMATION qui trie.
      expect(await prisma.inspectionPhoto.count({ where: { id: reservee.body.photo.id } })).toBe(1)
    })
  })

  it('supprime la ligne et les octets ensemble', async () => {
    const { photoId } = await photoComplete()
    const url = await request(serveur)
      .get(`/api/parks/${parkId}/photos/${photoId}`)
      .set('Cookie', proprio)
      .then((r) => r.body.lecture.url as string)

    const res = await request(serveur)
      .delete(`/api/parks/${parkId}/photos/${photoId}`)
      .set('Cookie', proprio)
    expect(res.status).toBe(204)

    expect(await prisma.inspectionPhoto.count({ where: { id: photoId } })).toBe(0)
    // L'adresse était encore valide : ce sont bien les OCTETS qui manquent.
    expect((await request(serveur).get(url)).status).toBe(404)
  })
})
