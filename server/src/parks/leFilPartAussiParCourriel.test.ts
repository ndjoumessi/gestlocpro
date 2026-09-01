import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from '../auth/session.js'
import { remplacerMessagerie, type Messagerie } from '../messagerie/messagerie.js'

/**
 * LE FIL PART AUSSI PAR COURRIEL.
 *
 * ═══ CE QUI MANQUAIT, ET CE QUE LE PRODUIT PROMETTAIT ═══
 *
 * Trois messages font vivre le fil d'un signalement : la déclaration du
 * locataire qui monte, la réponse du gestionnaire qui descend, la réponse du
 * locataire qui remonte. Les trois étaient `channel: 'in_app'` et rien d'autre.
 *
 * Le résultat se lit dans une phrase que l'écran du locataire affiche en toutes
 * lettres : « votre gestionnaire et votre bailleur le reçoivent IMMÉDIATEMENT ».
 * Ils le recevaient — le jour où ils rouvraient le produit. Une fuite d'eau
 * déclarée un vendredi soir attendait le lundi matin.
 *
 * Les autres canaux du produit existent depuis des lots et servent : la
 * réinitialisation de mot de passe, la relance de loyer, la mise en demeure.
 * Seul le fil restait muet.
 *
 * ═══ UNE COPIE, PAS UN CANAL DE LIVRAISON ═══
 *
 * La notification reste `in_app` : c'est là qu'elle VIT, c'est là qu'on la
 * marque lue, c'est elle que le portefeuille rend. Le courriel en est une COPIE
 * de courtoisie, comme un résumé qu'on s'envoie.
 *
 * Le distinguer n'est pas une subtilité : `channel` sert à l'écran des alertes
 * pour dire « pas encore parti · visible ici seulement », et le passer à
 * `email` sur une notification dont un destinataire sur deux n'a pas d'adresse
 * affirmerait un envoi qui n'a pas eu lieu. Ce dépôt a déjà payé cette
 * confusion une fois.
 *
 * ═══ CE QU'UN ÉCHEC D'ENVOI NE DOIT PAS FAIRE ═══
 *
 * Casser le geste. Un signalement dont le courriel n'est pas parti reste un
 * signalement enregistré : la messagerie de journal rend `false` par défaut —
 * « l'appelant sait que rien n'est parti » — et le produit ne doit pas
 * transformer ce `false` en 500.
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

/** Une messagerie de sonde : elle retient ce qu'on lui donne, et le rend. */
type Envoi = { a: string; sujet: string; texte: string }
let envois: Envoi[] = []
let rendre = true
let rétablir: () => void = () => {}

const messagerieDeSonde: Messagerie = {
  async envoyerSms() {
    return false
  },
  async envoyerEmail(a, sujet, corps) {
    envois.push({ a, sujet, texte: corps.texte })
    return rendre
  },
}

/** Un parc, un gestionnaire, un locataire relié, et un signalement de lui. */
async function parcAvecUnSignalement() {
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
    .send({ label: 'A1', type: 'T2', surfaceSqm: 100, baseRentMinor: 32798 })
  const unitId = a1.body.unit.id as string

  const invGes = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'manager' })
  await request(serveur).post('/api/auth/signup').send({
    email: 'diane@example.com',
    password: MDP,
    fullName: 'Diane Mballa',
    acceptTerms: true,
    invitationCode: invGes.body.code,
  })

  const invLoc = await request(serveur)
    .post(`/api/parks/${parkId}/invitations`)
    .set('Cookie', cookie)
    .send({ role: 'tenant' })
  const locataire = await request(serveur).post('/api/auth/signup').send({
    email: 'romel@example.com',
    password: MDP,
    fullName: 'Bekono Landry',
    acceptTerms: true,
    invitationCode: invLoc.body.code,
  })
  await request(serveur)
    .post(`/api/parks/${parkId}/tenants`)
    .set('Cookie', cookie)
    .send({ unitId, fullName: 'Bekono Landry', userId: locataire.body.user.id })

  return { cookie, parkId, unitId, cookieLocataire: cookieDe(locataire) }
}

const signaler = (parkId: string, unitId: string, cookie: string) =>
  request(serveur)
    .post(`/api/parks/${parkId}/units/${unitId}/works`)
    .set('Cookie', cookie)
    .send({ title: 'Fuite sous l’évier', trade: 'plumbing', urgency: 'normal' })

const repondre = (parkId: string, workId: string, cookie: string, message: string) =>
  request(serveur)
    .post(`/api/parks/${parkId}/works/${workId}/reply`)
    .set('Cookie', cookie)
    .send({ message })

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  envois = []
  rendre = true
  rétablir = remplacerMessagerie(messagerieDeSonde)
})

afterEach(() => {
  rétablir()
})

afterAll(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.$disconnect()
  await new Promise((resoudre) => serveur.close(resoudre))
})

describe('le signalement qui monte', () => {
  it('part par courriel vers le propriétaire ET le gestionnaire', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnSignalement()

    const cree = await signaler(parkId, unitId, cookieLocataire)
    expect(cree.status).toBe(201)

    expect(
      envois.map((e) => e.a).sort(),
      'l’écran promet qu’ils le reçoivent IMMÉDIATEMENT, et ils l’apprenaient au prochain passage',
    ).toEqual(['diane@example.com', 'proprio@example.com'])
  })

  it('porte la référence, le logement et ce que le locataire a écrit', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnSignalement()
    await signaler(parkId, unitId, cookieLocataire)

    const premier = envois[0]!
    /* Sans la référence, on ne peut pas retrouver le signalement ; sans le
       logement, on ne sait pas où aller ; sans le texte, il faut ouvrir le
       produit pour savoir de quoi il s'agit — et c'est précisément ce que le
       courriel doit éviter un vendredi soir. */
    expect(premier.texte).toContain('A1')
    expect(premier.texte).toContain('Fuite sous l’évier')
    expect(premier.sujet).toMatch(/SIG-/)
  })

  it('n’envoie rien au locataire qui vient de l’écrire', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnSignalement()
    await signaler(parkId, unitId, cookieLocataire)

    expect(envois.map((e) => e.a)).not.toContain('romel@example.com')
  })

  it('reste enregistré même quand aucun courriel ne part', async () => {
    /* La messagerie de journal rend `false` par défaut — « l'appelant sait que
       rien n'est parti ». Le produit ne doit pas transformer ce `false` en 500 :
       un signalement dont le courriel échoue reste un signalement. */
    rendre = false
    const { parkId, unitId, cookieLocataire } = await parcAvecUnSignalement()

    const cree = await signaler(parkId, unitId, cookieLocataire)
    expect(cree.status, 'une fuite déclarée ne doit pas dépendre d’un fournisseur de courriel').toBe(
      201,
    )
  })
})

describe('la réponse du gestionnaire', () => {
  it('part par courriel vers le locataire, et vers lui seul', async () => {
    const { cookie, parkId, unitId, cookieLocataire } = await parcAvecUnSignalement()
    const w = await signaler(parkId, unitId, cookieLocataire)
    envois = []

    await repondre(parkId, w.body.work.id, cookie, 'Le plombier passe jeudi matin.')

    expect(envois.map((e) => e.a)).toEqual(['romel@example.com'])
    expect(envois[0]!.texte).toContain('Le plombier passe jeudi matin.')
  })
})

describe('la réponse du locataire', () => {
  it('remonte par courriel vers toute la gestion', async () => {
    const { parkId, unitId, cookieLocataire } = await parcAvecUnSignalement()
    const w = await signaler(parkId, unitId, cookieLocataire)
    envois = []

    await repondre(parkId, w.body.work.id, cookieLocataire, 'Je serai là vendredi matin.')

    expect(envois.map((e) => e.a).sort()).toEqual(['diane@example.com', 'proprio@example.com'])
    expect(envois[0]!.texte).toContain('Je serai là vendredi matin.')
  })
})

describe('la notification reste in_app', () => {
  it('ne prétend pas être partie par courriel', async () => {
    /* `channel` sert à l'écran des alertes pour dire « pas encore parti ·
       visible ici seulement ». Le passer à `email` sur une notification dont un
       destinataire sur deux n'a pas d'adresse affirmerait un envoi qui n'a pas
       eu lieu — la confusion que ce dépôt a déjà payée une fois. Le courriel est
       une COPIE, la notification est le fait. */
    const { parkId, unitId, cookieLocataire } = await parcAvecUnSignalement()
    await signaler(parkId, unitId, cookieLocataire)

    const avis = await prisma.notification.findFirst({
      where: { parkId, messageKey: 'tenantReport' },
      select: { channel: true },
    })
    expect(avis?.channel).toBe('in_app')
  })
})
