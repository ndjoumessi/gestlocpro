import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LA DEVISE SE CHOISIT PARTOUT, ET LES MONTANTS SE CONVERTISSENT.
 *
 * Ce fichier gardait l'inverse : le sélecteur ne survivait qu'en démonstration,
 * parce que le produit ne convertissait rien. Un parc camerounais lu en euros
 * affichait les mêmes chiffres sous un autre symbole — 655 fois d'écart — et
 * une quittance imprimait « 50,00 € » pour 50 000 FCFA.
 *
 * LA CONVERSION EXISTE : parité légale pour le franc CFA, cours de la Banque
 * centrale européenne pour les deux dollars. Le choix redevient un choix, et ce
 * fichier garde ce que la règle protégeait vraiment — QUE LE COMPTE Y SOIT.
 *
 * Les deux coquilles ont chacune leur appel au sélecteur : celle du bailleur,
 * en barre latérale, et celle du locataire, horizontale. C'est exactement
 * l'endroit où une règle se perd d'un côté sans qu'aucun cas ne bronche, et
 * c'est pourquoi les deux sont éprouvées.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

/**
 * Le nom accessible du sélecteur : « Devise » suivi du libellé courant.
 *
 * IL FAUT OUVRIR LES RÉGLAGES D'ABORD, et c'est le lot de la coquille qui l'a
 * rendu nécessaire : langue, devise et thème occupaient la moitié droite de la
 * barre sur les 23 écrans et repliaient l'en-tête sur trois lignes à 360 px.
 * Ils vivent désormais derrière un point d'entrée unique. L'invariant que ce
 * fichier garde — le sélecteur existe en démonstration, jamais sur un vrai
 * parc — n'a pas bougé d'un pouce ; seule sa PROFONDEUR a changé, et le cas
 * doit descendre au même endroit que l'utilisateur.
 *
 * On ouvre par le RÔLE et le nom accessible, jamais par une classe : c'est ce
 * qui fait que ce cas continuerait de tenir si le panneau changeait de forme.
 * La coquille du locataire, elle, garde ses trois segmentés dépliés — il n'y a
 * pas de bouton à ouvrir, et `ouvrirLesReglages` ne trouve alors rien à faire.
 */
async function ouvrirLesReglages() {
  const bouton = screen.queryByRole('button', { name: /Réglages|Settings/ })
  if (bouton) await userEvent.click(bouton)
}

const selecteurDeDevise = () => screen.queryByRole('button', { name: /^Devise|^Currency/ })

function sessionReelle(role: 'owner' | 'tenant'): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    // Un parc camerounais : c'est le cas où la devise du navigateur et celle du
    // parc divergent, et où l'écart se paie.
    adhesions: [{ parkId: PARC, role, parkName: 'Parc Bonamoussadi', currency: 'XAF' }],
  }
}

/** Un vrai parc, portant un logement à 50 000 de loyer. */
function serveurReel() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
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
              rentMinor: 50000,
              tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
              status: 'paid',
              leaseId: 'bail-1',
              leaseStartsOn: '2026-01-01T00:00:00.000Z',
              paidMinor: 50000,
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
    },
  })
  return serveur
}

/**
 * LES DEUX CAS DE PRÉSENCE VIENNENT EN PREMIER, et ce n'est pas de la politesse.
 *
 * Sans eux, supprimer purement et simplement le composant du dépôt ferait passer
 * les cas d'absence : on garderait l'invariant en ayant perdu la fonctionnalité.
 * En démonstration le sélecteur est légitime — les montants y sont fictifs, et
 * la vitrine ancre ses tarifs par devise.
 */
describe('en démonstration, la devise se choisit', () => {
  it('offre le sélecteur au bailleur', async () => {
    await renderApp('/demo')
    await attendreLeChargement()
    await ouvrirLesReglages()
    expect(selecteurDeDevise()).toBeInTheDocument()
  })

  /**
   * Le locataire a sa PROPRE coquille — une barre horizontale, pas la barre
   * latérale du bailleur. Elle a son propre appel au sélecteur, donc sa propre
   * garde : c'est exactement l'endroit où l'invariant pouvait se perdre sans
   * qu'aucun cas ne bronche.
   */
  it('offre le sélecteur au locataire, dans sa coquille distincte', async () => {
    await renderApp('/demo')
    await switchRole('tenant')
    await attendreLeChargement()
    await ouvrirLesReglages()
    expect(selecteurDeDevise()).toBeInTheDocument()
  })
})

describe('sur un vrai parc, la devise se choisit aussi', () => {
  it('offre le sélecteur au bailleur', async () => {
    serveurReel()
    await renderApp('/app', { session: sessionReelle('owner') })
    await attendreLeChargement()
    await ouvrirLesReglages()
    expect(selecteurDeDevise()).toBeInTheDocument()
  })

  it('offre le sélecteur au locataire, dans sa coquille distincte', async () => {
    serveurReel()
    await renderApp('/app/mon-espace', { session: sessionReelle('tenant') })
    await attendreLeChargement()
    await ouvrirLesReglages()
    expect(selecteurDeDevise()).toBeInTheDocument()
  })

  /**
   * LE CHOIX CONVERTIT, IL NE RÉ-ÉTIQUETTE PAS.
   *
   * C'est toute la différence avec ce que ce fichier interdisait. Le parc est en
   * francs, le navigateur arrive avec l'euro en mémoire : l'écran affiche des
   * euros, et le montant n'est pas le même nombre.
   *
   * 50 000 francs valent 76,22 € à la parité légale. Le cas vérifie les DEUX —
   * le symbole ET le chiffre — parce que le symbole seul repasserait au vert le
   * jour où la conversion se remettrait à ré-étiqueter.
   */
  it('convertit les montants au lieu de changer le symbole', async () => {
    serveurReel()
    await renderApp('/app', { session: sessionReelle('owner'), currency: 'EUR' })
    await attendreLeChargement()

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('€')
    expect(main.textContent, 'le montant du parc n’a pas été converti').not.toMatch(/50\s?000/)
  })
})
