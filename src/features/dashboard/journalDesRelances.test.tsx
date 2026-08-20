import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE JOURNAL DES RELANCES — « rappel n° 4 » plutôt qu'une relance de plus.
 *
 * Deux manques distincts, et l'écran ne montrait ni l'un ni l'autre.
 *
 * Le RANG : les relances s'empilaient dans un flux plat où N rappels sur le
 * même bail produisaient N cartes indistinctes. Le bailleur relançait une
 * cinquième fois sans savoir qu'il en avait déjà envoyé quatre — et le produit,
 * lui, comptait déjà, puisque la garde « déjà relancé aujourd'hui » lit ces
 * mêmes lignes.
 *
 * L'ENVOI : le schéma porte `channel` et `sentAt` depuis l'origine, avec sa
 * justification écrite — « sans trace d'envoi, le produit relancerait deux fois
 * le même locataire le même jour ». La route les écrivait scrupuleusement,
 * `sentAt` n'étant posé QUE si le fournisseur a confirmé. Le `select` de la
 * lecture les omettait tous les deux. Le bailleur ne pouvait donc pas
 * distinguer un SMS réellement parti d'une relance restée dans le produit —
 * sur un produit dont la vitrine vend « SMS déclenchés à J+1, J+7, J+15 ».
 */

const PARC = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const UNITE = 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb'

function session(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Une notification, telle que le serveur la rend. */
interface NotifApi {
  id: string
  kind: string
  messageKey: string
  params: Record<string, unknown>
  severity: string
  unitId: string | null
  createdAt: string
  read: boolean
  rank?: number | null
  channel?: 'in_app' | 'email' | 'sms'
  sentAt?: string | null
}

function serveur(notifications: NotifApi[]) {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Essos',
          district: 'Essos',
          units: [
            {
              id: UNITE,
              label: 'B7',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 115000,
              tenant: { id: 'loc-1', fullName: 'Serge Mbarga', phoneE164: null },
              status: 'overdue',
              leaseId: 'bail-1',
              leaseStartsOn: '2025-03-01T00:00:00.000Z',
              paidMinor: 0,
              overdueDays: 24,
            },
          ],
        },
      ],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications,
      leaseCharges: [],
    },
  })
}

const relance = (n: Partial<NotifApi> & { id: string }): NotifApi => ({
  kind: 'payment',
  messageKey: 'rentReminder',
  params: { tenant: 'Serge Mbarga', count: 24, amount: 115000, leaseId: 'bail-1' },
  severity: 'high',
  unitId: UNITE,
  createdAt: '2026-08-18T08:00:00.000Z',
  read: false,
  ...n,
})

/**
 * La carte d'une notification, DÉSIGNÉE PAR SON ÉLÉMENT DE LISTE.
 *
 * C'était `closest('div')!.parentElement!` — deux ancêtres anonymes, donc un
 * pari sur la profondeur du DOM. Ce dépôt a déjà vu la même chaîne s'arrêter
 * avant ce qu'elle prétendait tenir, en laissant vertes des assertions
 * d'absence qui ne gardaient rien. Les cartes de cet écran portent
 * `role="listitem"` depuis qu'elles forment une liste nommée ; le cas s'y
 * adosse plutôt que de compter les enveloppes.
 */
const carte = (titre: RegExp) =>
  screen.getByRole('heading', { name: titre }).closest<HTMLElement>('[role="listitem"]')!

async function ouvrir(notifications: NotifApi[]) {
  serveur(notifications)
  renderApp('/app/signalements', { session: session() })
  await attendreLeChargement()
}

describe('journal des relances — le rang', () => {
  it('numérote chaque rappel du bail', async () => {
    await ouvrir([
      relance({ id: 'n3', rank: 3, createdAt: '2026-08-18T08:00:00.000Z' }),
      relance({ id: 'n2', rank: 2, createdAt: '2026-08-11T08:00:00.000Z' }),
      relance({ id: 'n1', rank: 1, createdAt: '2026-08-04T08:00:00.000Z' }),
    ])
    const rangs = screen.getAllByText(/^Rappel n° \d+$/).map((e) => e.textContent)
    expect(rangs).toEqual(['Rappel n° 3', 'Rappel n° 2', 'Rappel n° 1'])
  })

  /**
   * Le rang ne s'affiche QUE là où il a un sens.
   *
   * Un relevé manquant n'est pas un rappel, et lui coller un numéro suggérerait
   * une série qui n'existe pas.
   */
  it('n’en met aucun sur ce qui n’est pas une relance', async () => {
    await ouvrir([
      relance({ id: 'n1', rank: 1 }),
      {
        id: 'n2',
        kind: 'meter',
        messageKey: 'metersMissing',
        params: { count: 2, period: { year: 2026, month: 7 }, units: ['A5'] },
        severity: 'medium',
        unitId: UNITE,
        createdAt: '2026-08-17T08:00:00.000Z',
        read: true,
      },
    ])
    expect(screen.getAllByText(/^Rappel n° \d+$/)).toHaveLength(1)
  })

  /**
   * Un serveur antérieur à ce champ ne rend aucun rang — et l'écran se tait
   * plutôt que d'en inventer un. « Rappel n° 1 » par défaut affirmerait que
   * c'est la première, ce que personne ne sait.
   */
  it('n’invente pas de rang quand le serveur n’en rend pas', async () => {
    await ouvrir([relance({ id: 'n1' })])
    expect(screen.queryByText(/^Rappel n°/)).toBeNull()
  })
})

describe('journal des relances — l’envoi', () => {
  it('dit par où le message est parti, et quand', async () => {
    await ouvrir([relance({ id: 'n1', rank: 1, channel: 'sms', sentAt: '2026-08-04T09:12:00.000Z' })])
    expect(carte(/Rappel de loyer/)).toHaveTextContent('Parti par SMS le 4 août')
  })

  /**
   * LE CAS QUI COMPTE : un canal SANS date d'envoi.
   *
   * Ce n'est pas une contradiction. `sentAt` n'est posé que si le fournisseur a
   * confirmé, et le fournisseur de journal rend toujours faux : une relance peut
   * donc porter `channel: 'sms'` sans jamais être partie. C'est exactement ce
   * que le bailleur doit lire avant de croire son locataire prévenu — et c'est
   * ce que l'écran taisait.
   */
  it('avoue qu’une relance n’est pas partie, même avec un canal', async () => {
    await ouvrir([relance({ id: 'n1', rank: 1, channel: 'sms', sentAt: null })])
    const c = carte(/Rappel de loyer/)
    expect(c).toHaveTextContent('Pas encore parti')
    expect(c).not.toHaveTextContent('Parti par')
  })

  it('ne dit rien de l’envoi sur ce qui ne s’envoie pas', async () => {
    await ouvrir([
      {
        id: 'n1',
        kind: 'meter',
        messageKey: 'metersMissing',
        params: { count: 2, period: { year: 2026, month: 7 }, units: ['A5'] },
        severity: 'medium',
        unitId: UNITE,
        createdAt: '2026-08-17T08:00:00.000Z',
        read: true,
      },
    ])
    expect(screen.queryByText(/Pas encore parti/)).toBeNull()
    expect(screen.queryByText(/Parti par/)).toBeNull()
  })

  /**
   * La date d'envoi se lit dans la CHAÎNE, pas par un fuseau.
   *
   * C'est la date qu'on oppose au locataire — « la relance est partie le 4 août
   * ». Sérialisée à 00h12 UTC, `new Date()` la ramènerait au 3 dans tout fuseau
   * négatif. `vitest.config.ts` force `TZ: 'UTC'` : ce cas ne peut pas attraper
   * le défaut, seul `jourCalendaire` le prévient. Il fixe au moins que la date
   * affichée est celle du champ, et non celle de création.
   */
  it('affiche la date d’ENVOI et non celle de création', async () => {
    await ouvrir([
      relance({
        id: 'n1',
        rank: 1,
        channel: 'sms',
        createdAt: '2026-08-18T08:00:00.000Z',
        sentAt: '2026-08-04T00:12:00.000Z',
      }),
    ])
    const c = carte(/Rappel de loyer/)
    expect(c).toHaveTextContent('4 août')
    expect(c).not.toHaveTextContent('18 août')
  })
})

/**
 * LA DÉMONSTRATION relance, ce qu'elle ne faisait pas.
 *
 * C'est l'argument du lot appliqué à l'écran qu'on ouvre le plus souvent. Le
 * semis serveur ne suffit pas : `/demo` ne le lit pas, il sert les sept alertes
 * statiques du module — où ni `rentReminder` ni `formalNotice` ne figuraient.
 * Les deux gabarits existaient dans les deux dictionnaires, le type les
 * connaissait, et personne ne les voyait jamais en développant.
 */
describe('journal des relances — en démonstration', () => {
  async function ouvrirDemo() {
    renderApp('/demo/signalements')
    await attendreLeChargement()
  }

  /**
   * Le titre n'AFFIRME plus un envoi que le produit ne fait pas.
   *
   * Il disait « Relance envoyée à Serge Mbarga » au-dessus de « Pas encore
   * parti » : une contradiction frontale dans les deux lignes d'une même carte,
   * que les tests ne voyaient pas parce qu'ils vérifiaient chaque moitié
   * séparément. Le fournisseur qui tourne aujourd'hui rend toujours faux —
   * « pas parti » est donc le cas ORDINAIRE, et le titre le démentait à chaque
   * fois.
   */
  it('ne dit pas « envoyée » sur une relance qui n’est pas partie', async () => {
    await ouvrirDemo()
    const enAttente = screen.getAllByText(/Pas encore parti/)
    expect(enAttente.length).toBeGreaterThan(0)
    for (const ligne of enAttente) {
      /* La carte ENTIÈRE, et non deux enveloppes au hasard : l'assertion est
         une ABSENCE, donc plus la portée est large, plus elle garde. Une chaîne
         d'ancêtres qui s'arrête trop tôt rend ce cas vert sans rien vérifier. */
      const carte = ligne.closest<HTMLElement>('[role="listitem"]')!
      expect(carte).not.toHaveTextContent(/Relance envoyée/)
    }
  })

  it('montre les trois rappels, numérotés', async () => {
    await ouvrirDemo()
    expect(screen.getAllByText(/^Rappel n° \d+$/).map((e) => e.textContent)).toEqual([
      'Rappel n° 3',
      'Rappel n° 2',
      'Rappel n° 1',
    ])
  })

  /**
   * L'écart entre parti et resté ici, VISIBLE sur le jeu.
   *
   * Sans lui, l'écran ne montrerait jamais la différence : trois relances toutes
   * envoyées, ou toutes en attente, laisseraient croire à un état unique. Le
   * fournisseur qui tourne aujourd'hui — `MessagerieDeJournal` — rend toujours
   * faux, donc « resté ici » est le cas ORDINAIRE, pas l'exception.
   */
  it('distingue celle qui est partie des deux qui attendent', async () => {
    await ouvrirDemo()
    expect(screen.getAllByText(/Pas encore parti/)).toHaveLength(2)
    expect(screen.getByText(/Parti par SMS le 4 août/)).toBeInTheDocument()
  })
})
