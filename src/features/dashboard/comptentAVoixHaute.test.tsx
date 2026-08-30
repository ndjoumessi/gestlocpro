import { describe, expect, it } from 'vitest'
import { renderApp, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN ÉCRAN QUI COMPTE QUELQUE CHOSE LE DIT, ET AU MÊME ENDROIT QUE SES VOISINS.
 *
 * ═══ CE QU'UN AUDIT DES VINGT-TROIS ÉCRANS A TROUVÉ ═══
 *
 * Six écrans ouvrent sur une rangée de cartes d'indicateur — c'est la forme du
 * produit, et c'est ce qu'on cherche des yeux en arrivant. Trois autres
 * calculent exactement le même genre de chiffres et n'en montrent aucun :
 *
 *   · LOCATAIRES compte les baux, les demandes de pièces en attente et les
 *     logements vacants. Les trois vivent dans des variables ; `vacant` ne sert
 *     qu'à griser un bouton, `demandesEnAttente` qu'à décider d'afficher une
 *     carte. L'écran s'ouvre sur un tableau de dix lignes, sans un nombre.
 *   · ACCÈS compte les membres et les invitations. Ni l'un ni l'autre n'est
 *     écrit nulle part : pour savoir combien de personnes ont accès au parc, il
 *     faut compter les lignes à l'œil.
 *   · CAUTIONS a ses trois cartes, mais toutes NUES — un intitulé, un montant,
 *     et rien dessous. Les cartes des cinq autres écrans portent une ligne de
 *     contexte qui dit sur quoi le montant porte ; celles-ci laissent
 *     « 1 226 000 FCFA » sans dire sur combien de cautions.
 *
 * ═══ CE QUE CE FICHIER TIENT, ET CE QU'IL NE TIENT PAS ═══
 *
 * Il ne dit pas « tout écran doit avoir des indicateurs » : la prise en main est
 * une matrice de droits, l'aperçu du portail une image — ils ne comptent rien,
 * et leur en inventer serait pire que leur silence. Il tient une règle plus
 * étroite et vérifiable : LÀ OÙ LE CHIFFRE EST DÉJÀ CALCULÉ, il se montre.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
  }
}

/** Deux logements occupés, un vacant — de quoi faire trois comptes différents. */
const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Résidence Essos',
      district: 'Essos',
      units: [
        {
          id: 'u-1',
          label: 'B7',
          type: 'T2',
          surfaceSqm: 52,
          rentMinor: 90000,
          tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
          status: 'paid',
          leaseId: 'bail-1',
          leaseStartsOn: '2026-06-01T00:00:00.000Z',
          paidMinor: 90000,
          overdueDays: null,
        },
        {
          id: 'u-2',
          label: 'B8',
          type: 'T2',
          surfaceSqm: 50,
          rentMinor: 80000,
          tenant: { id: 'loc-2', fullName: 'Paul Nkodo', phoneE164: null },
          status: 'paid',
          leaseId: 'bail-2',
          leaseStartsOn: '2026-06-01T00:00:00.000Z',
          paidMinor: 80000,
          overdueDays: null,
        },
        {
          id: 'u-3',
          label: 'B9',
          type: 'T1',
          surfaceSqm: 30,
          rentMinor: 0,
          tenant: null,
          status: 'vacant',
          leaseId: null,
          leaseStartsOn: null,
          paidMinor: 0,
          overdueDays: null,
        },
      ],
    },
  ],
  works: [],
  deposits: [
    {
      id: 'dep-1',
      unitId: 'u-1',
      tenant: 'Awa Bello',
      heldMinor: 180000,
      withheldMinor: 0,
      billableMinor: 0,
      status: 'held',
    },
    {
      id: 'dep-2',
      unitId: 'u-2',
      tenant: 'Paul Nkodo',
      heldMinor: 160000,
      withheldMinor: 40000,
      billableMinor: 40000,
      status: 'settling',
    },
  ],
  readings: [],
  inspections: [],
  notifications: [],
}

function serveur() {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  faux.quand('GET', `/parks/${PARC}/access`, {
    status: 200,
    body: {
      members: [
        {
          id: 'm-1',
          fullName: 'Diane Fouda',
          email: 'diane@example.com',
          role: 'manager',
          since: '2026-01-15T00:00:00.000Z',
        },
      ],
      invitations: [
        {
          id: 'i-1',
          role: 'manager',
          codeHint: 'ABCD',
          issuedAt: '2026-08-01T00:00:00.000Z',
          expiresAt: '2026-09-01T00:00:00.000Z',
          unitId: null,
          unitLabel: null,
        },
      ],
    },
  })
  return faux
}

/** Les cartes d'indicateur de l'écran courant, dans l'ordre. */
function indicateurs(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-indicateur]')) as HTMLElement[]
}

const texteDe = (el: HTMLElement) => (el.textContent ?? '').replace(/\s/g, ' ')

async function ouvrir(adresse: string) {
  serveur()
  await renderApp(adresse, { session: sessionProprietaire() })
  await attendreLeChargement()
}

describe('les écrans comptent à voix haute', () => {
  it('le registre des locataires ouvre sur ce qu’il compte', async () => {
    await ouvrir('/app/locataires')
    const cartes = indicateurs()
    expect(cartes.length, 'aucune carte d’indicateur sur les locataires').toBeGreaterThan(0)

    /* Les trois nombres que l'écran calcule déjà : deux baux, un logement
       vacant. On interroge le CONTENU et non l'ordre — la composition de la
       rangée est un choix de mise en page, ce que la rangée DIT ne l'est pas. */
    const tout = cartes.map(texteDe).join(' | ')
    expect(tout, 'le nombre de baux n’est nulle part').toMatch(/2/)
    expect(tout, 'les logements vacants ne sont nulle part').toMatch(/1/)
  })

  it('le registre des accès dit combien de personnes il porte', async () => {
    await ouvrir('/app/acces')
    const tout = indicateurs().map(texteDe).join(' | ')
    expect(tout, 'aucun compte de membres ni d’invitations').not.toBe('')
    expect(tout).toMatch(/1/)
  })

  it('chaque carte des cautions dit sur quoi son montant porte', async () => {
    await ouvrir('/app/cautions')
    const cartes = indicateurs()
    expect(cartes.length, 'les cautions ont perdu leurs cartes').toBe(3)
    /*
      LA LIGNE DE CONTEXTE, ET C'EST ELLE QU'ON MESURE. Un intitulé et un montant
      ne font pas une carte lisible : « 1 226 000 FCFA » ne dit pas sur combien
      de cautions il porte. On compare donc à la carte NUE — intitulé plus
      montant — et l'on exige davantage.
    */
    const tout = cartes.map(texteDe).join(' | ')
    expect(tout, 'le total ne dit pas sur combien de cautions il porte').toMatch(/caution/i)
    expect(tout, 'la retenue ne dit pas combien d’arbitrages courent').toMatch(/arbitrage/i)
    expect(tout, 'le solde ne dit pas combien sont déjà restituées').toMatch(/restitu/i)
  })
})
