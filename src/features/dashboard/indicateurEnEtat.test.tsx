import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * CE QUI APPELLE UN GESTE SE DISTINGUE DE CE QUI RENSEIGNE.
 *
 * ═══ L'OBJET A CHANGÉ, LA DOCTRINE NON ═══
 *
 * Ces cas observaient une `StatCard` du tableau de bord : sur quatre cartes
 * rigoureusement identiques, celle du reste à percevoir prenait une pastille et
 * une bordure rouges quand quelqu'un devait encore.
 *
 * Le tableau de bord OUVRE désormais sur une file de travaux, et cette file
 * porte l'urgence — sous exactement la même condition. Garder la pastille de la
 * carte revenait à peindre deux fois le même fait, avec le même chiffre, à deux
 * cents pixels d'écart : les deux s'allumaient et s'éteignaient ensemble, elles
 * ne pouvaient pas diverger. La carte a rendu son état ; la file l'a pris.
 *
 * CE QUE CES DEUX CAS GARDENT N'A PAS BOUGÉ D'UN POUCE : la CONDITION, pas la
 * peinture. Une alerte allumée en permanence cesse d'alerter au bout d'une
 * semaine — elle devient du décor, et le jour où elle a raison personne ne la
 * regarde. Le premier cas vérifie qu'elle s'allume sur la donnée qui la
 * justifie ; le second, qu'elle s'éteint toute seule quand plus personne ne doit
 * rien. C'est le second qui a de la valeur — le premier tomberait sur une file
 * peinte en dur, pas lui.
 *
 * Ils lisent des marqueurs `data-` et non des classes : voir le commentaire de
 * `StatCard` pour les deux erreurs inverses qu'une assertion sur la teinte
 * commettrait.
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

describe('l’urgence de la file du jour', () => {
  it('s’allume quand quelqu’un doit encore', async () => {
    parcAvec({ status: 'overdue', paidMinor: 0, overdueDays: 24 })
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })

    const impayes = await screen.findByText(/1 loyer n’est pas soldé/i)
    const entree = impayes.closest('[data-file-entree]')
    expect(entree).not.toBeNull()
    expect(entree).toHaveAttribute('data-file-entree', 'impayes')
    /* L'AMPLEUR EST DITE, pas seulement le compte. Une entrée qui annoncerait
       « 1 loyer » sans le montant ni l'ancienneté obligerait à ouvrir l'écran
       pour savoir si elle presse — et une file qu'il faut ouvrir pour la lire
       n'est plus une file. */
    expect(entree).toHaveTextContent(/145\s?000/)
    expect(entree).toHaveTextContent(/24 jours/i)
    /* ET LE GESTE, nommé. Une ligne qui décrit un travail sans dire où il se
       fait est une notification, pas une file. */
    expect(entree?.querySelector('a')).not.toBeNull()
  })

  it('ne porte aucune urgence quand tout le monde a payé', async () => {
    parcAvec({ status: 'paid', paidMinor: 145000, overdueDays: null })
    await renderApp('/app', { session: SESSION_PROPRIETAIRE })

    // Un témoin de rendu qui n'est PAS l'objet du cas : si le tableau de bord
    // ne s'affichait pas du tout, le comptage à zéro ci-dessous passerait au
    // vert sur une page vide — c'est-à-dire sur rien.
    await screen.findByText(/taux d’occupation/i)
    // NI dans la file, NI ailleurs sur la page : un état qui s'allume dans une
    // carte sur un parc sain serait le même défaut déplacé d'une case — et
    // c'est exactement ce qui vient d'être retiré de l'indicateur du reste à
    // percevoir, qui doublait la première entrée de la file.
    expect(document.querySelectorAll('[data-file-entree]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-etat]')).toHaveLength(0)
  })
})
