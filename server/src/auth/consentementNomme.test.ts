import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { NOM_COOKIE } from './session.js'

/**
 * UNE DATE DE CONSENTEMENT NE DIT RIEN SANS LE TEXTE QU'ELLE DATE.
 *
 * ═══ LA DETTE, ÉCRITE PAR CELUI QUI L'A CONTRACTÉE ═══
 *
 * `efd8654` a corrigé la case de l'inscription : elle faisait « accepter les
 * conditions générales », qui n'existent pas, et elle fait désormais confirmer
 * la LECTURE de la politique de confidentialité, qui existe. Sa section « ce que
 * je peux avoir raté » nommait ce qui restait :
 *
 *   « Le serveur garde `acceptTerms` et `termsAcceptedAt` : les noms disent
 *     encore "conditions", la donnée dit désormais "lecture de la politique".
 *     Un compte créé avant ce commit a accepté un autre texte, et rien ne
 *     distingue les deux. »
 *
 * Deux défauts, et le second est le grave. Le premier est un nom qui ment. Le
 * second est un REGISTRE QUI CONFOND DEUX ENGAGEMENTS : la colonne affirme de
 * chaque compte qu'il a accepté des conditions générales, y compris de ceux à
 * qui l'on n'a jamais montré que la politique. C'est la seule pièce que ce
 * produit garde pour dire ce qu'une personne a consenti, et elle dit faux.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 *  1. LE TEXTE EST NOMMÉ, et pas seulement daté. Sans lui, la troisième
 *     rédaction — celle du jour où les conditions générales existeront —
 *     recontractera la même dette.
 *  2. L'ANCIEN NOM NE SUFFIT PLUS. Sans ce cas, on pourrait renommer la colonne
 *     en laissant le serveur accepter `acceptTerms` : le contrat continuerait de
 *     dire « conditions » à qui lit l'API.
 *  3. LE DOSSIER EXPORTÉ PORTE LES DEUX. Une personne qui demande ses données au
 *     titre de l'article 20 reçoit la pièce entière, ou elle reçoit une date
 *     dont elle ne peut rien faire.
 */
const app = createApp()
const serveur = app.listen(0)
const MDP = 'un-mot-de-passe-assez-long'

const INSCRIPTION = {
  email: 'consentement@example.com',
  password: MDP,
  fullName: 'Djoumessi Nelson',
  confirmLegal: true,
  parkName: 'Parc Bonamoussadi',
  countryCode: 'CM',
}

function cookieDe(res: request.Response): string {
  const entetes = res.headers['set-cookie']
  const liste = Array.isArray(entetes) ? entetes : entetes ? [entetes] : []
  const trouve = liste.find((c) => c.startsWith(`${NOM_COOKIE}=`))
  if (!trouve) throw new Error(`aucun cookie de session — ${res.status}`)
  return trouve
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

describe('le registre du consentement', () => {
  it('nomme le texte confirmé, et pas seulement sa date', async () => {
    const res = await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    expect(res.status, JSON.stringify(res.body)).toBe(201)

    const compte = await prisma.userAccount.findFirstOrThrow()
    expect(compte.legalConfirmedAt).toBeInstanceOf(Date)
    /* LES VERBES SONT DANS LA VALEUR, parce que ce sont eux qui distinguent les
       textes : on ACCEPTE des conditions générales, on LIT une politique de
       confidentialité. `acceptedTermsReadPrivacy` depuis le 2026-09-18, date à
       laquelle les conditions ont été publiées et la case rouverte. */
    expect(compte.legalConfirmation).toBe('acceptedTermsReadPrivacy')
  })

  /**
   * CE QUE LA TROISIÈME RÉDACTION NE DOIT PAS FAIRE : relire le passé.
   *
   * C'est pour cela que `legalConfirmation` existe. Sans elle, rouvrir la case
   * aurait laissé croire que tout compte du produit avait accepté des conditions
   * générales — y compris les 
   * comptes créés entre le 2026-09-14 et le 2026-09-18, à qui la case ne parlait
   * que de la politique. La dette que `consentement_nomme` venait d'éteindre se
   * serait rallumée à la rédaction suivante.
   */
  it('laisse aux comptes d’avant le texte qu’ils ont vu', async () => {
    const res = await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    expect(res.status).toBe(201)
    /* Un compte de l'époque `readPrivacy`, posé à la main : le produit ne sait
       plus en créer, et c'est précisément ce qu'on veut éprouver. */
    const avant = await prisma.userAccount.create({
      data: {
        email: 'avant@example.com',
        passwordHash: 'peu-importe',
        fullName: 'Compte d’avant',
        legalConfirmedAt: new Date('2026-09-15'),
        legalConfirmation: 'readPrivacy',
      },
    })

    const relu = await prisma.userAccount.findUniqueOrThrow({ where: { id: avant.id } })
    expect(relu.legalConfirmation).toBe('readPrivacy')
    const neuf = await prisma.userAccount.findFirstOrThrow({
      where: { email: INSCRIPTION.email },
    })
    expect(neuf.legalConfirmation).toBe('acceptedTermsReadPrivacy')
  })

  it('refuse l’ancien nom, qui disait « conditions »', async () => {
    const { confirmLegal: _, ...sansLeChamp } = INSCRIPTION
    const res = await request(serveur)
      .post('/api/auth/signup')
      .send({ ...sansLeChamp, acceptTerms: true })

    expect(res.status).toBe(400)
    expect(await prisma.userAccount.count()).toBe(0)
  })

  it('exige la confirmation, à false comme à l’absence', async () => {
    for (const confirmLegal of [false, undefined]) {
      const res = await request(serveur)
        .post('/api/auth/signup')
        .send({ ...INSCRIPTION, confirmLegal })
      expect(res.status).toBe(400)
    }
    expect(await prisma.userAccount.count()).toBe(0)
  })

  it('rend les deux au dossier exporté, et plus l’ancien nom', async () => {
    const inscription = await request(serveur).post('/api/auth/signup').send(INSCRIPTION)
    const cookie = cookieDe(inscription)
    const moi = await request(serveur).get('/api/auth/me').set('Cookie', cookie)
    const parkId = moi.body.memberships[0].parkId as string

    const dossier = await request(serveur)
      .get(`/api/parks/${parkId}/export`)
      .set('Cookie', cookie)
    expect(dossier.status, JSON.stringify(dossier.body)).toBe(200)

    expect(dossier.body.compte.legalConfirmation).toBe('acceptedTermsReadPrivacy')
    expect(typeof dossier.body.compte.legalConfirmedAt).toBe('string')
    /* Le dossier rend les colonnes telles quelles : un `termsAcceptedAt` qui
       survivrait ici prouverait que la colonne n'a pas bougé. */
    expect(dossier.body.compte.termsAcceptedAt).toBeUndefined()
  })
})
