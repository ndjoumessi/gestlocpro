import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN AVIS ANCIEN NE MONTRE PAS SES ACCOLADES.
 *
 * ═══ TROUVÉ SUR LA PRODUCTION, DANS UN PARC RÉEL ═══
 *
 * La carte d'un signalement affichait « Signalement SIG-2026-002 · {unit} »,
 * accolades comprises. Le libellé attend un logement ; la charge de l'avis n'en
 * portait pas.
 *
 * LE DÉFAUT D'ORIGINE ÉTAIT DÉJÀ CORRIGÉ. Le serveur pose `params.unitId`
 * depuis le 2026-08-31, avec le LIBELLÉ et non l'identifiant. Mais une
 * notification est une LIGNE ÉCRITE : corriger celui qui écrit ne répare pas ce
 * qui l'a été avant, et rien ne le fera jamais. L'avis fautif date de la veille
 * du correctif, et il vivra dans cette base tant que personne ne l'effacera.
 *
 * ═══ POURQUOI LA RÉPARATION N'EST PAS DANS `interpolate` ═══
 *
 * Il serait tentant de faire disparaître tout jeton non résolu au moment de la
 * substitution. Ce serait ÉTEINDRE L'ALARME : un jeton qui survit est
 * exactement ce que `MESURER_GABARITS` cherche sur chaque écran, et c'est ce
 * qui a permis de trouver celui-ci. Le masquer rendrait invisible la prochaine
 * variable renommée.
 *
 * ═══ LA DONNÉE EXISTE, ELLE N'ÉTAIT PAS LUE ═══
 *
 * L'avis porte `unitId` à SON niveau, à côté de `data` — le serveur l'a
 * toujours écrit dans la colonne. La carte ne lisait que `data.unitId`. Elle
 * lit désormais l'autre quand le premier manque, et la résout en LIBELLÉ par
 * le portefeuille : c'est ce que le lecteur attend de voir, pas un identifiant.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const A1 = 'aaaaaaaa-1111-4000-8111-111111111111'

const session: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

function portefeuille(data: Record<string, unknown>) {
  return {
    scoped: false,
    accessUntil: null,
    collections: [],
    buildings: [
      {
        id: 'imm-1',
        name: 'Résidence Bonamoussadi',
        district: 'Bonamoussadi',
        units: [
          {
            id: A1,
            label: 'A1',
            type: 'T2',
            surfaceSqm: 52,
            rentMinor: 90000,
            tenant: { id: 'loc-A1', fullName: 'Bekono Landry', phoneE164: null },
            status: 'paid',
            leaseId: 'bail-A1',
            leaseStartsOn: '2025-03-01T00:00:00.000Z',
            paidMinor: 90000,
            overdueDays: null,
          },
        ],
      },
    ],
    works: [],
    deposits: [],
    readings: [],
    inspections: [],
    leaseCharges: [],
    notifications: [
      {
        id: 'avis-1',
        kind: 'work',
        /* La forme du SERVEUR — `messageKey` et `params`, pas `message` et
           `data` : c'est `apiPortfolio` qui les renomme. */
        messageKey: 'tenantReport',
        params: data,
        /* La COLONNE, que le serveur a toujours écrite. */
        unitId: A1,
        createdAt: '2026-08-31T09:00:00.000Z',
        severity: 'high',
        read: false,
        channel: 'in_app',
      },
    ],
  }
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrirLesSignalements(data: Record<string, unknown>) {
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: portefeuille(data) })
  await renderApp('/app/signalements', { session })
  await attendreLeChargement()
}

describe('un avis écrit avant le correctif', () => {
  it('ne montre AUCUNE accolade, et nomme le logement', async () => {
    /* La charge exacte capturée en production : une référence, un texte, et pas
       de logement. */
    await ouvrirLesSignalements({
      workId: 'w-1',
      reference: 'SIG-2026-002',
      text: 'Manque de courant',
    })

    const carte = screen.getByText((_t, n) => (n?.textContent ?? '').includes('SIG-2026-002') && n?.children.length === 0)
    expect(
      carte.textContent,
      'l’utilisateur lisait « Signalement SIG-2026-002 · {unit} », accolades comprises',
    ).not.toMatch(/\{[a-z]+\}/i)
    expect(carte.textContent, 'le LIBELLÉ, pas l’identifiant').toContain('A1')
  })
})

describe('un avis écrit après le correctif', () => {
  it('garde le libellé que le serveur a posé', async () => {
    /* `params.unitId` porte déjà le libellé depuis le 2026-08-31 : la
       résolution de secours ne doit pas l’écraser. */
    await ouvrirLesSignalements({
      workId: 'w-1',
      reference: 'SIG-2026-002',
      text: 'Manque de courant',
      unitId: 'A1',
    })
    const carte = screen.getByText((_t, n) => (n?.textContent ?? '').includes('SIG-2026-002') && n?.children.length === 0)
    expect(carte.textContent).toContain('A1')
    expect(carte.textContent).not.toMatch(/\{[a-z]+\}/i)
  })
})

describe('toutes les familles d’avis, sur une charge vide', () => {
  /**
   * ═══ LE SECOURS NE VALAIT QUE POUR `{unit}` ═══
   *
   * Le lot précédent a réparé la seule variable qu'un avis de production avait
   * montrée. Les douze autres familles restaient exposées : un avis ancien
   * auquel manquerait `{tenant}`, `{amount}` ou `{reference}` afficherait
   * encore ses accolades, et rien ne le dirait.
   *
   * Ce cas les prend TOUTES, avec une charge VIDE — le pire qu'une ligne
   * ancienne puisse porter. Aucune ne doit rendre une accolade.
   */
  const FAMILLES = [
    'tenantReport',
    'tenantReply',
    'rentOverdue',
    'rentReminder',
    'formalNotice',
    'quotePending',
    'metersMissing',
    'leaseRenewal',
    'partialPayment',
    'announcement',
    'workReply',
    'workDone',
    'receiptAvailable',
  ] as const

  it.each(FAMILLES)('« %s » ne montre aucune accolade', async (famille) => {
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        ...portefeuille({}),
        notifications: [
          {
            id: `avis-${famille}`,
            kind: 'work',
            messageKey: famille,
            /* VIDE : ce qu'une ligne écrite avant un champ peut porter de pire. */
            params: {},
            unitId: null,
            createdAt: '2026-08-01T09:00:00.000Z',
            severity: 'medium',
            read: false,
            channel: 'in_app',
          },
        ],
      },
    })
    await renderApp('/app/signalements', { session })
    await attendreLeChargement()

    const texte = document.querySelector('main')?.textContent ?? ''
    const jetons = [...texte.matchAll(/\{[A-Za-z]\w*\}/g)].map((m) => m[0])
    expect(
      jetons,
      `« ${famille} » affiche ${jetons.join(', ')} à l’utilisateur`,
    ).toEqual([])
  })
})
