import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UNE CARTE EN ÉTAT DIT SON ÉTAT EN TOUTES LETTRES — c'est ce qui rend
 * `etat.libelle` facultatif défendable, et rien d'autre.
 *
 * `StatCard` accepte un état SANS pastille depuis que deux cartes du produit
 * portent un état dont leur propre texte parle déjà : celle des paiements
 * s'intitule « En retard », celle des relevés porte en note « 1 sur 2 saisis ».
 * Y ajouter une pastille écrirait deux fois la même chose à quinze pixels
 * d'écart.
 *
 * MAIS CE `?` EST EXACTEMENT LA RÉGRESSION QUE `couleur-non-seule` EXISTE POUR
 * EMPÊCHER, si personne ne le tient. Rien dans le composant ne peut vérifier
 * que l'intitulé d'une carte nomme son état — il ne connaît qu'une chaîne. La
 * vérification est donc ici, carte par carte, sur les trois du produit qui
 * portent un état : chacune doit CONTENIR en toutes lettres ce que sa teinte
 * affirme, que ce soit par sa pastille, son intitulé ou sa note.
 *
 * Ces trois cas sont ce qui autorise l'omission. Les supprimer ne casserait
 * rien de visible et rendrait la porte muette sur un écran qu'une partie des
 * lecteurs ne peut pas déchiffrer : c'est le pire des verts.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

function logement(
  id: string,
  label: string,
  etat: { status: 'paid' | 'overdue'; paidMinor: number; overdueDays: number | null },
) {
  return {
    id,
    label,
    type: 'apartment',
    surfaceSqm: 45,
    rentMinor: 185000,
    leaseId: `bail-${id}`,
    leaseStartsOn: '2026-01-01',
    tenant: { id: `t-${id}`, fullName: 'Charles Ngassa', phoneE164: '+237677214408' },
    ...etat,
  }
}

/** Un relevé complet — les deux fluides — pour un logement. */
function releves(unitId: string) {
  return (['water', 'power'] as const).map((utility) => ({
    unitId,
    utility,
    indexValue: utility === 'water' ? 358 : 4298,
    previousIndex: utility === 'water' ? 342 : 4120,
    readAt: '2026-07-20T00:00:00.000Z',
    unitPriceMinor: utility === 'water' ? 520 : 99,
  }))
}

/**
 * DEUX logements, et c'est ce qui fabrique les deux états d'un coup : l'un est
 * en retard et relevé, l'autre à jour et JAMAIS relevé. Un seul logement ne
 * pourrait pas porter les deux manques.
 */
function parcEnDefaut() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'b-1',
          name: 'Résidence Essoss',
          district: 'Bastos',
          units: [
            logement('u-a1', 'A1', { status: 'overdue', paidMinor: 0, overdueDays: 24 }),
            logement('u-a2', 'A2', { status: 'paid', paidMinor: 185000, overdueDays: null }),
          ],
        },
      ],
      works: [],
      deposits: [],
      /* A2 a une LIGNE de relevé sans INDEX, et la nuance décide du cas : le
         client replie les deux fluides du serveur en une ligne par unité, et
         cette ligne n'existe que si au moins un relevé la mentionne. Une unité
         absente des `readings` ne compte donc pas comme « manquante » — elle
         n'apparaît pas du tout, et l'écran n'a rien à signaler. */
      readings: [
        ...releves('u-a1'),
        {
          unitId: 'u-a2',
          utility: 'water' as const,
          indexValue: null,
          previousIndex: 289,
          readAt: null,
          unitPriceMinor: 520,
        },
      ],
      inspections: [],
      notifications: [],
    },
  })
  return serveur
}

describe('une carte en état nomme son état', () => {
  /**
   * SUR LE TABLEAU DE BORD, C'EST LA FILE QUI PORTE L'URGENCE — et elle la dit
   * dans son TITRE, ce qui est plus fort qu'une pastille.
   *
   * La carte du reste à percevoir portait un état `danger` et une pastille
   * « En retard ». Elle n'en porte plus : la file s'allume sous la même
   * condition, et deux rouges pour un fait valaient une seconde lecture du
   * rouge.
   *
   * Ce que la file fait de mieux : son urgence n'est pas une pastille à côté
   * d'un nombre, c'est une PHRASE — « 1 loyer n'est pas soldé ». Elle survit
   * donc à une impression en noir et blanc, à une déficience rouge-vert, et à
   * un lecteur d'écran, sans qu'aucun mot de statut n'ait à être ajouté.
   *
   * Le trait de couleur, lui, est `aria-hidden` par construction : il ne dit
   * rien que le titre ne dise, ce qu'exige `couleur-non-seule`.
   */
  it('sur le tableau de bord, par sa PHRASE — la file nomme le travail', async () => {
    parcEnDefaut()
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })

    const entree = (await screen.findByText(/n’est pas soldé/i)).closest('[data-file-entree]')
    expect(entree).toHaveAttribute('data-file-entree', 'impayes')
    /* Le trait d'urgence est retiré de l'arbre d'accessibilité : ce qui reste,
       lu à voix haute, doit suffire. */
    for (const trait of Array.from(entree!.querySelectorAll('span[aria-hidden="true"]'))) {
      expect(trait).toHaveAttribute('aria-hidden', 'true')
    }
    expect(entree).toHaveTextContent(/jours de retard/i)
  })

  it('sur les paiements, par son INTITULÉ — la carte s’appelle « En retard »', async () => {
    parcEnDefaut()
    await renderApp('/app/paiements', { session: SESSION_PROPRIETAIRE })
    await screen.findByText(/loyers attendus|attendus/i)

    const carte = document.querySelector('[data-etat]')
    expect(carte).toHaveAttribute('data-etat', 'danger')
    // Le mot est dans le titre, pas dans une pastille — et c'est tout ce que la
    // règle demande. Ce cas TOMBERAIT si quelqu'un rebaptisait la carte en un
    // intitulé neutre sans lui rendre sa pastille, ce qui est précisément le
    // moment où la couleur redeviendrait seule.
    expect(carte).toHaveTextContent(/en retard/i)

    // UNE SEULE carte en état : l'encaissé et l'attendu ne sont pas des alertes.
    expect(document.querySelectorAll('[data-etat]')).toHaveLength(1)
  })

  it('sur les relevés, par sa NOTE — « 1 sur 2 saisis » dit le manque', async () => {
    parcEnDefaut()
    await renderApp('/app/releves', { session: SESSION_PROPRIETAIRE })
    await screen.findByText(/total refacturé/i)

    const carte = document.querySelector('[data-etat]')
    expect(carte).toHaveAttribute('data-etat', 'warn')
    expect(carte).toHaveTextContent(/1 sur 2 saisis/i)
  })

  it('n’allume rien quand le parc est sain', async () => {
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        collections: [],
        buildings: [
          {
            id: 'b-1',
            name: 'Résidence Essoss',
            district: 'Bastos',
            units: [logement('u-a1', 'A1', { status: 'paid', paidMinor: 185000, overdueDays: null })],
          },
        ],
        works: [],
        deposits: [],
        readings: releves('u-a1'),
        inspections: [],
        notifications: [],
      },
    })

    await renderApp('/app/releves', { session: SESSION_PROPRIETAIRE })
    await screen.findByText(/total refacturé/i)
    // Le pendant indispensable des trois cas ci-dessus : un état qui ne
    // s'éteint jamais est un décor, et les trois passeraient au vert sur une
    // carte peinte en dur.
    expect(document.querySelectorAll('[data-etat]')).toHaveLength(0)
  })
})
