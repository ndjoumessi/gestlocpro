import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessagerieResend } from './resend.js'

/**
 * `List-Unsubscribe` — L'EN-TÊTE QUE J'AVAIS ÉCARTÉ TROP VITE.
 *
 * ═══ CE QUE J'AVAIS DIT, ET POURQUOI C'ÉTAIT FAUX ═══
 *
 * « Le poser exigerait soit une URL qui agit seule — ce que le lot du pied
 * refuse — soit une adresse de retour que ce produit n'a pas. » La seconde
 * moitié est vraie ; la première ne l'est pas.
 *
 * Une URL dans `List-Unsubscribe` n'agit d'elle-même QUE si `List-Unsubscribe-Post`
 * l'accompagne : c'est ce second en-tête qui déclare le « un clic », et lui seul
 * autorise un client à POSTer sans montrer la page. Sans lui, le client OUVRE le
 * lien, et l'on retombe exactement sur le comportement que le pied de message a
 * choisi : le lien mène au produit, le geste reste un geste.
 *
 * On pose donc `List-Unsubscribe` SANS `List-Unsubscribe-Post`. Le bouton natif
 * du client de messagerie apparaît, et il ouvre le réglage au lieu de le
 * basculer.
 */
const FAUX_ENVOI = () =>
  vi.fn(
    async (_url: string, _init?: { body?: string }) =>
      new Response(JSON.stringify({ id: 'x' }), { status: 200 }),
  ) as unknown as ReturnType<typeof vi.fn> & {
    mock: { calls: [string, { body: string }][] }
  }

afterEach(() => {
  vi.unstubAllGlobals()
})

async function enTetesEnvoyes() {
  const espion = FAUX_ENVOI()
  vi.stubGlobal('fetch', espion)
  const messagerie = new MessagerieResend('cle-de-sonde', 'GestLocPro <no-reply@example.com>')
  await messagerie.envoyerEmail('romel@example.com', 'Sujet', {
    texte: 'texte',
    html: '<p>html</p>',
  })
  const corps = JSON.parse(espion.mock.calls[0]![1]!.body as string)
  return corps.headers as Record<string, string> | undefined
}

describe('l’en-tête de désabonnement', () => {
  it('accompagne chaque envoi', async () => {
    const entetes = await enTetesEnvoyes()
    expect(
      entetes?.['List-Unsubscribe'],
      'certains clients en font un bouton natif — c’est le geste le plus visible',
    ).toMatch(/^<https?:\/\/.+>$/)
  })

  it('ne déclare PAS le « un clic »', async () => {
    /* `List-Unsubscribe-Post` est ce qui autorise un client à POSTer sans
       montrer la page — et le désabonnement le plus dangereux est celui que
       personne n'a demandé. Sans cet en-tête, le client OUVRE le lien. */
    const entetes = await enTetesEnvoyes()
    expect(entetes?.['List-Unsubscribe-Post']).toBeUndefined()
  })
})
