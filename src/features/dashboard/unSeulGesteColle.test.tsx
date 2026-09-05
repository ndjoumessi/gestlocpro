import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * DEUX COLONNES DE GESTE SE COLLENT AU MÊME BORD, ET SE RECOUVRENT.
 *
 * ═══ CE QUE ÇA DONNAIT, CAPTURÉ SUR LA PRODUCTION ═══
 *
 * L'écran des locataires portait « Corriger » et « Retirer ». Le premier
 * s'affichait « Corı » : coupé net, la moitié du mot mangée.
 *
 * `DataTable` épingle chaque colonne de rôle `geste` avec `sticky right-0`.
 * UNE seule s'y colle sans dommage ; DEUX s'y superposent, et la dernière rendue
 * passe au-dessus de la précédente.
 *
 * C'est un défaut que j'ai introduit cette nuit en ajoutant « Corriger » à côté
 * de « Retirer », sur un composant écrit pour un geste unique. `Access.tsx` en
 * porte deux aussi, mais dans DEUX TABLEAUX distincts — vérifié — donc sans
 * recouvrement.
 *
 * ═══ POURQUOI AUCUNE PORTE NE L'A VU ═══
 *
 * Un texte rogné dans sa boîte NE DÉBORDE DE RIEN : `mesure-ui` compare des
 * bords, et ceux-ci sont dans les clous. Le DOM, lui, porte la chaîne entière —
 * « Corriger » y est complet, et jsdom le lit sans se douter qu'un pixel le
 * cache. C'est l'angle mort que `rognage.test.ts` nomme déjà pour l'infobulle du
 * graphe : « la géométrie n'est pas dans le fichier ».
 *
 * CE QUI EST DANS LE DOM, en revanche, c'est le NOMBRE de colonnes épinglées.
 * C'est lui qu'on tient ici — pas le rognage, mais la cohabitation qui le rend
 * possible. Même forme de règle que le rognage, un cran plus haut.
 *
 * ═══ LE REMÈDE N'EST PAS DE DÉCALER LA SECONDE ═══
 *
 * On pourrait poser la première à droite de la largeur de la seconde. Il
 * faudrait alors CONNAÎTRE cette largeur, qui dépend du libellé traduit — « Retirer »
 * fait 51 px, « Remove » 46 — et la figer en dur rouvrirait le défaut dans
 * l'autre langue. Les deux gestes vivent donc dans UNE colonne, côte à côte.
 */

const PARC = '55555555-6666-4777-8888-999999999999'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: 'Residence Djoumessi',
      district: 'Bastos',
      units: [
        {
          id: 'unite-1',
          label: 'A1',
          type: 'T2',
          surfaceSqm: 100,
          rentMinor: 32798,
          tenant: { id: 'loc-1', fullName: 'Bekono Landry', phoneE164: null },
          status: 'pending',
          leaseId: 'bail-1',
          leaseStartsOn: '2026-08-18T00:00:00.000Z',
          paidMinor: 0,
          overdueDays: null,
        },
      ],
    },
  ],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
  leaseCharges: [],
}

describe('les colonnes épinglées d’un tableau', () => {
  it('n’en colle qu’UNE au bord droit, sur l’écran des locataires', async () => {
    const faux = installerFauxServeur({ authentifie: true })
    faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
    await renderApp('/app/locataires', { session: sessionProprietaire() })
    await attendreLeChargement()

    const tableaux = screen.getAllByRole('table')
    for (const tableau of tableaux) {
      const enTetes = tableau.querySelectorAll('thead [data-colonne-tenue]')
      expect(
        enTetes.length,
        'deux colonnes épinglées se collent au MÊME bord et se recouvrent : la ' +
          'dernière rendue rogne la précédente, et aucune règle de débordement ne ' +
          'le voit — le texte reste dans sa boîte.',
      ).toBeLessThanOrEqual(1)
    }
  })

  it('garde ses propres yeux : le tableau porte bien une colonne épinglée', async () => {
    /* GARDE DU GARDE. Si `data-colonne-tenue` disparaissait, le cas du dessus
       compterait zéro et se déclarerait vert sur un écran qui n'épingle plus
       rien — c'est-à-dire sur un autre défaut. */
    const faux = installerFauxServeur({ authentifie: true })
    faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
    await renderApp('/app/locataires', { session: sessionProprietaire() })
    await attendreLeChargement()

    expect(document.querySelectorAll('[data-colonne-tenue]').length).toBeGreaterThan(0)
  })
})
