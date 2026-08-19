import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessagerieResend } from './resend.js'

/**
 * L'ADAPTATEUR RESEND.
 *
 * Ce que ces cas gardent n'est pas « Resend fonctionne » — c'est le CONTRAT de
 * la couture, dont chaque clause a été écrite contre un mensonge possible :
 * rendre `true` quand rien n'est parti, lever au lieu de rendre `false`, ou
 * écrire dans le journal ce qui ouvre un compte.
 *
 * `fetch` est remplacé plutôt qu'appelé : un test qui frappe une API tierce
 * échoue le jour où le réseau tousse, et facture des envois pour vérifier du
 * code qui n'est pas le sien.
 */
describe('l’envoi de courriels par Resend', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const messagerie = new MessagerieResend('re_une-cle', 'GestLocPro <bonjour@exemple.cm>')

  function fauxFetch(reponse: Response) {
    const appels: { url: string; init: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        appels.push({ url, init })
        return reponse
      }),
    )
    return appels
  }

  it('poste le message à Resend, signé de la clé', async () => {
    const appels = fauxFetch(new Response('{"id":"abc"}', { status: 200 }))

    const parti = await messagerie.envoyerEmail('sarah@example.com', 'Sujet', { texte: 'Le corps', html: '<p>Le corps</p>' })
    expect(parti).toBe(true)

    expect(appels).toHaveLength(1)
    expect(appels[0]!.url).toBe('https://api.resend.com/emails')
    const entetes = appels[0]!.init.headers as Record<string, string>
    expect(entetes.Authorization).toBe('Bearer re_une-cle')

    const corps = JSON.parse(String(appels[0]!.init.body))
    expect(corps).toMatchObject({
      from: 'GestLocPro <bonjour@exemple.cm>',
      to: ['sarah@example.com'],
      subject: 'Sujet',
      text: 'Le corps',
      html: '<p>Le corps</p>',
    })
  })

  it('rend faux quand Resend refuse, sans lever', async () => {
    fauxFetch(new Response('{"message":"domaine non vérifié"}', { status: 403 }))

    /**
     * Le `false` est le cœur de la couture : l'appelant sait que rien n'est
     * parti. Rendre `true` ici produirait exactement le mensonge qu'on retire
     * partout ailleurs — un succès affiché que rien ne recouvre.
     */
    await expect(messagerie.envoyerEmail('sarah@example.com', 'S', { texte: 'C', html: '<p>C</p>' })).resolves.toBe(false)
  })

  it('rend faux quand le réseau lâche, sans lever non plus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND api.resend.com')
      }),
    )

    // « Jamais d'exception » n'est pas une politesse : une panne réseau qui
    // remonterait ferait rendre 500 à la demande de réinitialisation, ce qui
    // apprendrait au passage que l'adresse est connue.
    await expect(messagerie.envoyerEmail('sarah@example.com', 'S', { texte: 'C', html: '<p>C</p>' })).resolves.toBe(false)
  })

  it('ne journalise ni la clé ni le corps du message', async () => {
    const erreurs: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      erreurs.push(args.map(String).join(' '))
    })
    fauxFetch(new Response('{"message":"domaine non vérifié"}', { status: 403 }))

    await messagerie.envoyerEmail('sarah@example.com', 'Réinitialiser', {
      texte: 'https://app.example.cm/reinitialiser?jeton=LE-SECRET-QUI-OUVRE-LE-COMPTE',
      html: '<a href="https://app.example.cm/reinitialiser?jeton=LE-SECRET-QUI-OUVRE-LE-COMPTE">ici</a>',
    })

    const tout = erreurs.join('\n')
    // Le corps porte le lien, qui EST le compte le temps de sa validité. Un
    // journal se lit par bien plus de gens qu'une base.
    expect(tout).not.toContain('LE-SECRET-QUI-OUVRE-LE-COMPTE')
    expect(tout).not.toContain('re_une-cle')
    // Mais le refus de Resend, lui, doit se lire : sans lui on ignore lequel
    // des trois motifs habituels a joué.
    expect(tout).toContain('domaine non vérifié')
  })

  it('n’envoie aucun SMS, et ne prétend pas le contraire', async () => {
    // Resend n'en envoie pas. Rendre `true` pour faire propre annoncerait un
    // envoi qui n'a pas lieu.
    await expect(messagerie.envoyerSms()).resolves.toBe(false)
  })
})
