import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessagerieTwilio } from './twilio.js'
import type { Messagerie } from './messagerie.js'
import { MessagerieDeJournal, composerLaMessagerie } from './messagerie.js'

/**
 * L'ADAPTATEUR TWILIO.
 *
 * ═══ CE QU'IL DÉBLOQUE ═══
 *
 * Le produit appelle `envoyerSms` à DEUX endroits depuis longtemps — le code
 * d'invitation, et la relance du locataire en retard — et les deux recevaient
 * `false` : aucun fournisseur n'était branché. « SMS non envoyé — aucun
 * fournisseur configuré » est ce que le journal de production écrivait. Sur le
 * marché visé, c'est le canal qui atteint les gens ; le courriel est celui
 * qu'on avait.
 *
 * ═══ CE QUE CES CAS GARDENT ═══
 *
 * Pas « Twilio fonctionne » : le CONTRAT de la couture, dont chaque clause a
 * été écrite contre un mensonge possible — rendre `true` quand rien n'est
 * parti, LEVER au lieu de rendre `false`, ou écrire dans le journal ce qui
 * ouvre un parc.
 *
 * `fetch` est remplacé plutôt qu'appelé : un test qui frappe une API tierce
 * échoue le jour où le réseau tousse, et FACTURE de vrais SMS pour vérifier du
 * code qui n'est pas le sien.
 */
describe('l’envoi de SMS par Twilio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const twilio = new MessagerieTwilio('ACfaux', 'un-jeton', '+15550000000')

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

  it('poste le message au compte, signé en authentification simple', async () => {
    const appels = fauxFetch(new Response('{"sid":"SM1"}', { status: 201 }))

    const parti = await twilio.envoyerSms('+237677111111', 'votre code : ABCD')
    expect(parti).toBe(true)

    expect(appels).toHaveLength(1)
    expect(appels[0]!.url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACfaux/Messages.json')
    const entetes = appels[0]!.init.headers as Record<string, string>
    /* `Basic` et non `Bearer` : Twilio authentifie par SID + jeton. Le poser en
       porteur rendrait 401 sur chaque envoi, et le `false` serait muet. */
    expect(entetes.Authorization).toBe(`Basic ${Buffer.from('ACfaux:un-jeton').toString('base64')}`)

    /* Formulaire et non JSON : cette API-ci ne lit pas de corps JSON. */
    const corps = new URLSearchParams(String(appels[0]!.init.body))
    expect(corps.get('To')).toBe('+237677111111')
    expect(corps.get('From')).toBe('+15550000000')
    expect(corps.get('Body')).toBe('votre code : ABCD')
  })

  it('rend FAUX quand le fournisseur refuse, sans lever', async () => {
    fauxFetch(new Response('{"message":"unverified number","code":21608}', { status: 400 }))
    await expect(twilio.envoyerSms('+237677111111', 'texte')).resolves.toBe(false)
  })

  it('rend FAUX quand le réseau lâche, sans lever', async () => {
    /* Un code d'invitation reste valable même si le SMS échoue — le
       propriétaire peut le dicter. Lever ici perdrait le code au lieu de
       sauver le message. C'est la clause écrite dans l'interface. */
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    await expect(twilio.envoyerSms('+237677111111', 'texte')).resolves.toBe(false)
  })

  it('n’écrit JAMAIS le texte dans le journal — il porte le code d’un parc', async () => {
    const journal = vi.spyOn(console, 'log').mockImplementation(() => {})
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    fauxFetch(new Response('{"message":"refusé"}', { status: 400 }))

    await twilio.envoyerSms('+237677111111', 'GestLocPro — votre code : SECRET-42')

    const tout = [...journal.mock.calls, ...erreurs.mock.calls].flat().join(' ')
    expect(tout).not.toContain('SECRET-42')
    /* Ni le numéro entier : il identifie une personne, et le journal se lit par
       bien plus de gens qu'une base. */
    expect(tout).not.toContain('+237677111111')
  })

  it('ne prétend pas envoyer de COURRIEL', async () => {
    /* Le miroir exact de `MessagerieResend.envoyerSms`. Rendre `true` pour
       faire propre annoncerait un envoi qui n'a pas lieu. */
    /* Appelé À TRAVERS l'interface : c'est elle que le reste du serveur tient,
       et c'est donc elle qui doit rendre `false`. */
    const parLaCouture: Messagerie = twilio
    await expect(
      parLaCouture.envoyerEmail('a@b.cm', 'Sujet', { texte: 't', html: '<p>t</p>' }),
    ).resolves.toBe(false)
  })
})

describe('la composition des deux fournisseurs', () => {
  /**
   * Resend envoie des courriels et pas de SMS ; Twilio l'inverse. Une seule
   * instance ne peut donc plus servir les deux, et le choix ne peut plus être
   * un ternaire sur une clé.
   */
  it('achemine le SMS d’un côté et le courriel de l’autre', async () => {
    const traces: string[] = []
    const sms = {
      async envoyerSms() { traces.push('sms'); return true },
      async envoyerEmail() { traces.push('sms→courriel'); return false },
    }
    const courriel = {
      async envoyerSms() { traces.push('courriel→sms'); return false },
      async envoyerEmail() { traces.push('courriel'); return true },
    }
    const composee = composerLaMessagerie(sms, courriel)

    expect(await composee.envoyerSms('+237677111111', 'x')).toBe(true)
    expect(await composee.envoyerEmail('a@b.cm', 's', { texte: 't', html: 'h' })).toBe(true)
    expect(traces, 'un aiguillage croisé enverrait le code par la mauvaise porte').toEqual([
      'sms',
      'courriel',
    ])
  })

  it('retombe sur le journal quand un côté manque, sans emporter l’autre', async () => {
    const courriel = {
      async envoyerSms() { return false },
      async envoyerEmail() { return true },
    }
    const composee = composerLaMessagerie(new MessagerieDeJournal(), courriel)
    expect(await composee.envoyerSms('+237677111111', 'x')).toBe(false)
    expect(await composee.envoyerEmail('a@b.cm', 's', { texte: 't', html: 'h' })).toBe(true)
  })
})
