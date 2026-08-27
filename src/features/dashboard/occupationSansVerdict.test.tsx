import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN RATIO D'OCCUPATION N'EST PAS UN VERDICT.
 *
 * « Répartition du parc » rendait `ok` à 100 % d'occupation et `warn` en
 * dessous. Donc, par construction, TOUJOURS un état : chaque immeuble, tous les
 * jours, vert ou ambre à perpétuité. C'est l'alerte permanente que le reste du
 * produit s'interdit — celle qu'on cesse de lire au bout d'une semaine, et qui
 * n'est plus là le jour où elle a raison.
 *
 * TROIS PREUVES QUE C'ÉTAIT CETTE CARTE QUI AVAIT TORT, et non les quatre
 * autres endroits où l'occupation s'affiche sans état :
 *
 * 1. L'écran se contredisait à trois lignes d'écart — l'indicateur « Taux
 *    d'occupation », en haut de la même page, écrit « 2 unités vacantes » en
 *    gris muet et ne porte aucun état.
 * 2. `PAYMENT_TONES` associe déjà `vacant` à `neutral` : le produit avait
 *    tranché, en toutes lettres, dans son propre vocabulaire.
 * 3. Les cartes du Parc, son taux global et les deux miniatures de la vitrine
 *    la rendent toutes sans état. Une sur cinq jugeait.
 *
 * CE CAS SE LIT SUR `data-ton` ET NON SUR UNE CLASSE : une assertion sur
 * `bg-warn-tint` rougirait au premier renommage d'utilitaire et passerait au
 * vert le jour où le même verdict revient sous une autre teinte.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

function loue(id: string, label: string) {
  return {
    id,
    label,
    type: 'apartment',
    surfaceSqm: 45,
    rentMinor: 185000,
    paidMinor: 185000,
    status: 'paid',
    leaseId: `bail-${id}`,
    leaseStartsOn: '2026-01-01',
    overdueDays: null,
    tenant: { id: `t-${id}`, fullName: 'Charles Ngassa', phoneE164: '+237677214408' },
  }
}

function vacant(id: string, label: string) {
  return {
    id,
    label,
    type: 'apartment',
    surfaceSqm: 45,
    rentMinor: 185000,
    paidMinor: 0,
    status: 'vacant',
    overdueDays: null,
    tenant: null,
  }
}

/**
 * UN IMMEUBLE PLEIN ET UN IMMEUBLE TROUÉ, et c'est ce couple qui fait le cas.
 *
 * Avec deux immeubles pleins, l'assertion « les deux pastilles portent le même
 * ton » passerait au vert sur l'ANCIEN code, qui rendait `ok` aux deux. Il faut
 * précisément un cas où l'ancien code divergeait.
 */
function parcMixte() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'b-plein',
          name: 'Résidence Pleine',
          district: 'Bastos',
          units: [loue('u-1', 'A1'), loue('u-2', 'A2')],
        },
        {
          id: 'b-troue',
          name: 'Résidence Trouée',
          district: 'Akwa',
          units: [loue('u-3', 'B1'), vacant('u-4', 'B2')],
        },
      ],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

/** Les pastilles de ratio — « 2/2 », « 1/2 » — et rien d'autre. */
function pastillesDeRatio() {
  return Array.from(document.querySelectorAll('[data-ton]')).filter((p) =>
    /^\d+\/\d+$/.test(p.textContent?.trim() ?? ''),
  )
}

describe('la répartition du parc', () => {
  it('rend le même ton à un immeuble plein et à un immeuble troué', async () => {
    parcMixte()
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })
    await screen.findByText(/répartition du parc/i)

    const pastilles = pastillesDeRatio()

    /*
      GARDE DU GARDE — LE CAS DOIT AVOIR VU LES DEUX SITUATIONS.

      Sans ces deux lignes, un jeu de données où tous les immeubles seraient
      pleins ferait passer l'assertion suivante au vert sur l'ANCIEN code, qui
      rendait `ok` à tout le monde. Un cas qui ne peut pas échouer ne garde rien.
    */
    expect(pastilles.map((p) => p.textContent?.trim())).toEqual(['2/2', '1/2'])

    // LE MÊME ton pour les deux : c'est l'assertion. L'ancien code rendait `ok`
    // au plein et `warn` au troué.
    const tons = new Set(pastilles.map((p) => p.getAttribute('data-ton')))
    expect(tons.size, 'un seul ton pour les deux immeubles').toBe(1)
  })

  it('emploie le ton que le produit donne déjà à une vacance', async () => {
    parcMixte()
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })
    await screen.findByText(/répartition du parc/i)

    /*
      `neutral` n'est pas un choix de goût : c'est ce que `PAYMENT_TONES` associe
      à `vacant`. Ce cas relie les deux endroits — le jour où quelqu'un décide
      qu'une vacance mérite un ton, il devra le changer AUX DEUX, ce qui est
      précisément la discussion qu'il faut avoir.
    */
    /* `onDark` et non `neutral` : la carte est en ton sombre, son fond est figé,
       et une pastille neutre y devenait invisible en thème sombre — 1,07:1
       mesuré. Ce qui compte pour CE cas n'a pas changé : le ton employé est
       celui qui ne rend AUCUN verdict, ni `ok` ni `warn`. */
    for (const p of pastillesDeRatio()) {
      expect(p).toHaveAttribute('data-ton', 'onDark')
      expect(['ok', 'warn', 'danger']).not.toContain(p.getAttribute('data-ton'))
    }
  })
})
