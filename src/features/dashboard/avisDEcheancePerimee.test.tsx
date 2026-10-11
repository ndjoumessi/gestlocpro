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
        kind: 'lease',
        /* La forme du SERVEUR — `messageKey` et `params`, pas `message` et
           `data` : c'est `apiPortfolio` qui les renomme. */
        messageKey: MESSAGE,
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

let MESSAGE = 'leaseRenewal'

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
})

async function ouvrirLesSignalements(data: Record<string, unknown>) {
  serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: portefeuille(data) })
  await renderApp('/app/signalements', { session })
  await attendreLeChargement()
}


/**
 * UN AVIS D'ÉCHÉANCE NE PROMET PLUS UN AVENIR RÉVOLU.
 *
 * ═══ LE DÉFAUT, VU À L'ÉCRAN SUR LA DÉMONSTRATION ═══
 *
 * Le 2026-10-11, `/demo/signalements` rendait ceci :
 *
 *     Bail B1 à renouveler dans 45 jours
 *     Jean-Paul Eboa · échéance au 30/09/2026
 *
 * Onze jours APRÈS l'échéance. Le titre promettait, le détail démentait.
 *
 * LE GABARIT EST AU PRÉSENT ET TOURNÉ VERS L'AVENIR — « à renouveler DANS
 * {count} jours » affirme une durée qui RESTE. Or `count` est écrit UNE FOIS
 * par le serveur, à la naissance de l'avis, et cet avis ne se réécrit jamais :
 * `executerAvisDEcheance` refuse de reparler d'une échéance déjà annoncée.
 *
 * CES CAS GARDENT LES DEUX MOITIÉS DU CORRECTIF : que le compte se RECALCULE
 * depuis la date, et que le titre BASCULE quand elle est franchie.
 */
function dansNJours(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

describe('un avis d’échéance de bail', () => {
  it('RECALCULE son compte, au lieu de répéter celui que le serveur a figé', async () => {
    /* Le serveur a écrit 45 ; l'échéance est dans dix jours. C'est dix qu'il
       faut lire — sinon l'avis ment d'un mois et demi. */
    await ouvrirLesSignalements({ tenant: 'Jean-Paul Eboa', count: 45, dueOn: dansNJours(10) })

    const titre = screen.getByText((_t, n) => (n?.textContent ?? '').includes('à renouveler') && n?.children.length === 0)
    expect(titre.textContent, 'le compte figé du serveur a été répété tel quel').not.toContain('45')
    expect(titre.textContent, 'le compte n’a pas été recalculé depuis la date').toContain('10')
  })

  it('bascule AU PASSÉ une fois l’échéance franchie, sans nombre négatif', async () => {
    await ouvrirLesSignalements({ tenant: 'Jean-Paul Eboa', count: 45, dueOn: dansNJours(-11) })

    const titre = screen.getByText((_t, n) => (n?.textContent ?? '').includes('à renouveler') && n?.children.length === 0)
    expect(titre.textContent, 'le titre promet encore un avenir révolu').toContain('dépassée')
    expect(titre.textContent, 'le compte est rendu négatif au lieu d’être absolu').not.toContain('-11')
    expect(titre.textContent, 'la valeur absolue du retard n’est pas dite').toContain('11')
  })

  it('SE TAIT sur le compte au-delà de deux mois, et garde la date', async () => {
    /* « dépassée de 400 jours » est exact et inutile : au-delà du seuil, ce
       n'est plus un délai qu'on lit mais un état. Le détail, lui, continue de
       porter la date exacte — c'est ce qui autorise le titre à se taire. */
    await ouvrirLesSignalements({ tenant: 'Jean-Paul Eboa', count: 45, dueOn: dansNJours(-400) })

    const titre = screen.getByText((_t, n) => (n?.textContent ?? '').includes('à renouveler') && n?.children.length === 0)
    /* LE COMPTE, ET NON TOUT CHIFFRE : le libellé du logement en porte un —
       « Bail A1 à renouveler ». Une première rédaction cherchait `/\d/` et
       rougissait sur « A1 », ce qui aurait fait passer le code pour fautif. */
    expect(titre.textContent, 'le titre égrène encore un compte qui n’apprend rien').not.toMatch(
      /\d+\s*(jour|day)/i,
    )
    expect(titre.textContent, 'le compte exact est encore là').not.toContain('400')
    expect(titre.textContent, 'le titre ne dit plus que l’échéance est dépassée').toContain('dépassée')

    const detail = screen.getByText((_t, n) => (n?.textContent ?? '').includes('Jean-Paul Eboa') && n?.children.length === 0)
    expect(detail.textContent, 'la date exacte a disparu avec le compte').toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })
})
