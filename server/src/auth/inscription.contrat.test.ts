import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'

/**
 * Contrat de l'inscription : ce que le formulaire ENVOIE, ce que le serveur ACCEPTE.
 *
 * Un défaut a traversé les deux suites et n'est apparu qu'en production, sur un
 * déploiement neuf : le sélecteur de pays peut rendre `OTHER` — une sentinelle
 * d'interface signifiant « mon pays n'est pas dans la liste » — et le serveur
 * exige un code ISO de deux caractères. L'inscription échouait en 400, et
 * l'écran n'affichait qu'une « erreur inattendue » : le seul champ fautif était
 * précisément celui dont le message ne parlait pas.
 *
 * Aucune des deux moitiés n'avait tort. Les tests client vérifiaient que le
 * formulaire envoie ce qu'il a saisi ; les tests serveur, qu'il refuse ce qui
 * est mal formé. Personne ne vérifiait que l'ensemble des valeurs que l'un peut
 * produire est inclus dans celui que l'autre accepte.
 *
 * La table des pays est LUE, pas recopiée : une copie se désynchroniserait au
 * premier pays ajouté, et ce fichier deviendrait le genre de garde qui rassure
 * sans rien vérifier.
 */
const app = createApp()
/**
 * Un serveur unique pour le fichier : `request(serveur)` en ouvrait un par appel.
 * Voir `parks/routes.test.ts`, où la collision de ports éphémères se voyait —
 * une exécution sur trois, jamais au même endroit.
 */
const serveur = app.listen(0)

const SOURCE = new URL('../../../src/lib/countries.ts', import.meta.url)

/** Codes que le sélecteur de pays peut rendre, sentinelle comprise. */
function codesDuClient(): { liste: string[]; sentinelle: string } {
  const source = readFileSync(SOURCE, 'utf8')
  const liste = [...source.matchAll(/\{\s*code:\s*'([^']+)'/g)].map((m) => m[1]!)
  const sentinelle = /OTHER_COUNTRY\s*=\s*'([^']+)'/.exec(source)?.[1]
  if (!liste.length || !sentinelle) throw new Error('table des pays illisible')
  return { liste, sentinelle }
}

let n = 0
function inscription(champs: Record<string, unknown> = {}) {
  n += 1
  return {
    email: `contrat.pays.${n}@example.test`,
    password: 'MotDePasseAssezLong1',
    fullName: 'Contrat des pays',
    acceptTerms: true,
    locale: 'fr',
    ...champs,
  }
}

afterAll(async () => {
  await new Promise((resoudre) => serveur.close(resoudre))
  await prisma.userAccount.deleteMany({ where: { email: { contains: 'contrat.pays.' } } })
})

describe('pays proposés à l’inscription', () => {
  const { liste, sentinelle } = codesDuClient()

  it.each(liste)('le serveur accepte %s', async (code) => {
    const reponse = await request(serveur).post('/api/auth/signup').send(inscription({ countryCode: code }))
    expect(reponse.status, JSON.stringify(reponse.body)).toBe(201)
    expect(reponse.body.user.countryCode).toBe(code)
  })

  it('la sentinelle « autre pays » n’est PAS un code ISO, et le serveur la refuse', async () => {
    // Le pendant négatif, et la raison d'être du fichier : c'est bien le
    // serveur qui a raison. Le client ne doit pas envoyer cette valeur — il
    // doit omettre le champ.
    const reponse = await request(serveur)
      .post('/api/auth/signup')
      .send(inscription({ countryCode: sentinelle }))
    expect(reponse.status).toBe(400)
    expect(reponse.body.fields?.[0]?.path).toBe('countryCode')
  })

  it('un pays absent est une absence de pays, et l’inscription passe', async () => {
    const reponse = await request(serveur).post('/api/auth/signup').send(inscription())
    expect(reponse.status, JSON.stringify(reponse.body)).toBe(201)
    expect(reponse.body.user.countryCode).toBeNull()
  })
})

describe('nom du parc', () => {
  it('crée réellement le parc du propriétaire', async () => {
    // Second défaut de la même inscription : `parkName` était saisi, validé,
    // affiché au récapitulatif — puis jeté à l'envoi. Le compte se créait sans
    // parc, et l'application montrait alors le jeu de démonstration : rien ne
    // signalait au propriétaire que son parc n'existait pas.
    const corps = inscription({ parkName: 'Résidence des Palmiers' })
    const reponse = await request(serveur).post('/api/auth/signup').send(corps)
    expect(reponse.status, JSON.stringify(reponse.body)).toBe(201)

    const adhesions = await prisma.membership.findMany({
      where: { user: { email: corps.email } },
      include: { park: true },
    })
    expect(adhesions).toHaveLength(1)
    expect(adhesions[0]!.role).toBe('owner')
    expect(adhesions[0]!.park.name).toBe('Résidence des Palmiers')
  })
})
