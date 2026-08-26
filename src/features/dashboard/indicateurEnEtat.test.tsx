import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * L'INDICATEUR QUI APPELLE UN GESTE SE DISTINGUE DES TROIS QUI RENSEIGNENT.
 *
 * Le tableau de bord posait quatre `StatCard` rigoureusement identiques — même
 * fond, même bordure, même graisse, note en gris muet. Mesuré sur l'écran
 * rendu avant ce lot : ZÉRO pastille d'état sur les quatre, et
 * « 4 locataires · jusqu'à 24 jours de retard » se rendait au pixel près comme
 * « 2 unités vacantes ». La hiérarchie que le fichier affirme en commentaire
 * depuis plusieurs lots — « ce sur quoi il agit, c'est le RESTE À PERCEVOIR »
 * — n'existait donc que dans le commentaire.
 *
 * CE QUE CES DEUX CAS GARDENT, C'EST LA CONDITION, pas la peinture. Une carte
 * d'alerte allumée en permanence cesse d'alerter au bout d'une semaine : elle
 * devient du décor, et le jour où elle a raison personne ne la regarde. Le
 * premier cas vérifie qu'elle s'allume sur la donnée qui la justifie ; le
 * second, qu'elle s'éteint toute seule quand plus personne ne doit rien. C'est
 * le second qui a de la valeur — le premier tomberait sur une carte peinte en
 * dur, pas lui.
 *
 * Ils lisent `data-etat` et non une classe : voir le commentaire de `StatCard`
 * pour les deux erreurs inverses qu'une assertion sur la teinte commettrait.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Un logement, dans l'état de paiement qu'on veut éprouver. */
function parcAvec(
  logement: { status: 'paid' | 'overdue'; paidMinor: number; overdueDays: number | null },
) {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'aaaaaaaa-2222-4333-8444-555555555555',
          name: 'Résidence Bonamoussadi',
          district: 'Bonamoussadi',
          units: [
            {
              id: 'bbbbbbbb-2222-4333-8444-555555555555',
              label: 'A1',
              type: 'T3',
              surfaceSqm: 78,
              rentMinor: 145000,
              tenant: {
                id: 'dddddddd-2222-4333-8444-555555555555',
                fullName: 'Charles Ngassa',
                phoneE164: '+237677214408',
              },
              ...logement,
            },
          ],
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

describe('l’indicateur d’arbitrage du tableau de bord', () => {
  it('porte son état quand quelqu’un doit encore', async () => {
    parcAvec({ status: 'overdue', paidMinor: 0, overdueDays: 24 })
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })

    // La carte est retrouvée par sa NOTE, jamais par son rang : réordonner la
    // rangée est une décision de mise en page, pas une régression. Et pas par
    // son intitulé — « Reste à percevoir » est délibérément répété dans la
    // réconciliation de l'anneau, deux panneaux plus loin, pour que les deux
    // nombres se reconnaissent. Un `getByText` sur l'intitulé trouve donc DEUX
    // éléments et échoue : c'est la note qui désigne la carte sans ambiguïté.
    const note = await screen.findByText(/1 locataire · jusqu’à 24 jours/i)
    const reste = note.closest('[data-etat]')
    expect(reste).not.toBeNull()
    expect(reste).toHaveAttribute('data-etat', 'danger')
    // L'intitulé est bien celui qu'on croit : la note seule pourrait vivre
    // ailleurs le jour où quelqu'un la déplace.
    expect(reste).toHaveTextContent(/reste à percevoir/i)
    // ET LE MOT DE L'ÉTAT, en toutes lettres. C'est la moitié qui survit à une
    // impression en noir et blanc comme à une déficience rouge-vert : une
    // bordure qui rougit sans rien nommer ne dit rien à qui ne voit pas le
    // rouge. Le mot est celui du produit — `status.overdue`, le même que la
    // grille des paiements — et non un second vocabulaire pour le même état.
    expect(reste).toHaveTextContent(/en retard/i)
  })

  it('ne porte aucun état quand tout le monde a payé', async () => {
    parcAvec({ status: 'paid', paidMinor: 145000, overdueDays: null })
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })

    // Un témoin de rendu qui n'est PAS l'objet du cas : si le tableau de bord
    // ne s'affichait pas du tout, le comptage à zéro ci-dessous passerait au
    // vert sur une page vide — c'est-à-dire sur rien.
    await screen.findByText(/taux d’occupation/i)
    // AUCUNE carte de la page, pas seulement celle-ci : un état qui s'allume
    // ailleurs sur un parc sain serait le même défaut déplacé d'une case.
    expect(document.querySelectorAll('[data-etat]')).toHaveLength(0)
  })
})
