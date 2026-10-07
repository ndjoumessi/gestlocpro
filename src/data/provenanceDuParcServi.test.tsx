import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import { usePortfolio } from '@/data/PortfolioProvider'

/**
 * LA PROVENANCE SE MARQUE À CHAQUE LECTURE DU PARC, PAS À UNE SEULE.
 *
 * ═══ UNE SERRURE POUR DEUX PORTES ═══
 *
 * `fromApi` répond à une seule question — « les collections de ce fournisseur
 * viennent-elles du SERVEUR ? » — et DEUX choses en dépendent :
 *
 *   · la boucle d'enregistrement, depuis le lot des relevés orphelins : elle
 *     refuse d'écrire dans la clé de la démonstration ce qui vient du serveur,
 *     et ce refus garde des noms et des téléphones ;
 *   · `tenantUnitIds`, donc `isMine`, donc le PÉRIMÈTRE DU LOCATAIRE. Drapeau
 *     baissé, il retombe sur `[DEMO_TENANT_UNIT]` — l'unité de la
 *     démonstration — et un locataire ne reconnaît alors AUCUN de ses propres
 *     logements : ses écrans filtrent sur rien et se vident.
 *
 * ═══ ET IL N'Y A QU'UN ENDROIT QUI LA LÈVE ═══
 *
 * `setFromApi(true)` ne figure que dans l'effet de chargement. Or QUATRE
 * endroits posent des collections venues du serveur : cet effet, puis
 * `recordReading`, `updateReading`, `deleteReading` et `addTenant`, qui relisent
 * tous le parc après avoir écrit — « on relit le parc plutôt que de deviner
 * l'état résultant », dit leur motif. Aucun des quatre ne lève le drapeau.
 *
 * L'invariant tient donc par coïncidence : si le chargement réussit, le drapeau
 * est levé avant qu'aucune mutation ne soit possible. Il ne tient pas par
 * CONSTRUCTION, et c'est ce que ce cas épingle.
 *
 * ═══ CE QUI EST MESURÉ, ET CE QUI NE L'EST PAS ═══
 *
 * AUCUN CHEMIN DE L'INTERFACE N'ATTEINT CE TROU AUJOURD'HUI, vérifié trois
 * fois : les trois écrans qui portent ces gestes rendent un squelette tant que
 * `loading` est vrai ; `CadreDuParc` ne rend `<Outlet />` que si `echecDuParc`
 * est nul, donc un chargement échoué remplace l'écran entier et aucune commande
 * n'est joignable ; et les quatre mutations retournent tôt si `parkId` est nul.
 *
 * CE CAS NE PASSE DONC PAS PAR L'INTERFACE, et il faut le dire plutôt que de
 * déguiser l'invariant en parcours. Il monte le fournisseur avec une sonde et
 * appelle le geste directement : ce qu'il garde est le CONTRAT du fournisseur,
 * pas un écran. C'est la seule forme qui puisse rougir sur ce défaut — une
 * garde d'écran serait verte quoi qu'il arrive, donc ne garderait rien.
 *
 * CE QUI LE RENDRAIT ATTEIGNABLE, nommé pour qu'on le reconnaisse : un écran
 * qui rendrait ses commandes malgré `echecDuParc` ou malgré `loading`, ou une
 * cinquième relecture posée dans un geste joignable sans chargement réussi.
 */

const PARC = '55555555-6666-4777-8888-999999999999'

const SESSION_PROPRIETAIRE: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Un parc réel minimal : un immeuble, un logement, un locataire nommé. */
function corpsDuParc() {
  return {
    collections: [],
    buildings: [
      {
        id: 'imm-1',
        name: 'Résidence Essos',
        district: 'Essos',
        units: [
          {
            id: 'unite-1',
            label: 'B7',
            type: 'T2',
            surfaceSqm: 52,
            rentMinor: 90000,
            paidMinor: 90000,
            status: 'paid',
            overdueDays: null,
            leaseId: 'bail-1',
            leaseStartsOn: '2026-01-01',
            tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: '+237 6 55 00 11 22' },
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
}

/**
 * La sonde : elle rend le drapeau et offre le geste qui relit le parc.
 *
 * Elle affiche AUSSI le nombre d'unités, sans quoi le cas serait vrai par
 * vacuité — « le drapeau est levé » ne vaut que si des collections du serveur
 * sont bien entrées. La classe est connue de ce dépôt, et ce lot-ci vient
 * justement d'en corriger deux instances.
 */
function Sonde() {
  const { recordReading, fromApi, units } = usePortfolio()
  const [issue, setIssue] = useState<string>('—')

  return (
    <div>
      <p data-sonde="provenance">{fromApi ? 'parc servi' : 'parc local'}</p>
      <p data-sonde="unites">{units.length}</p>
      <p data-sonde="issue">{issue}</p>
      <button
        type="button"
        onClick={async () => {
          const r = await recordReading('unite-1', {
            utility: 'water',
            periodStart: '2026-09-01',
            indexValue: 358,
            readAt: '2026-09-01',
          })
          setIssue(r.ok ? 'posé' : `refusé: ${r.erreur}`)
        }}
      >
        Relever
      </button>
    </div>
  )
}

const sonde = (nom: string) =>
  document.querySelector<HTMLElement>(`[data-sonde="${nom}"]`)!.textContent

describe('la provenance du parc servi', () => {
  it('se lève quand une mutation relit le parc, et pas seulement au chargement', async () => {
    const serveur = installerFauxServeur()

    /*
      LE CHARGEMENT ÉCHOUE, et c'est la seule façon de laisser le drapeau baissé
      pendant qu'une relecture réussit. Un 500 et non un 401 : la session est
      valide, c'est le parc qui n'a pas pu être lu.
    */
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 500, body: { error: 'boom' } })
    serveur.quand('POST', `/parks/${PARC}/units/unite-1/readings`, {
      status: 200,
      body: { charge: { updated: true } },
    })

    renderWithProviders(<Sonde />, { session: SESSION_PROPRIETAIRE })

    // L'état de départ : rien du serveur n'est entré, le drapeau est baissé.
    await waitFor(() => expect(sonde('provenance')).toBe('parc local'))
    const unitesDeDepart = sonde('unites')

    // La relecture qui suit la mutation, elle, réussira.
    serveur.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: corpsDuParc() })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Relever' }))
    await waitFor(() => expect(sonde('issue')).toBe('posé'))

    /* L'AFFIRMATION POSITIVE D'ABORD : les unités du serveur sont bien entrées.
       Sans elle, « le drapeau est levé » pourrait être vrai d'un fournisseur où
       rien n'est arrivé. */
    expect(sonde('unites'), 'la relecture doit avoir remplacé les unités locales').not.toBe(
      unitesDeDepart,
    )
    expect(sonde('unites')).toBe('1')

    /* LE CŒUR DU CAS. Des unités du serveur sont à l'écran ; le fournisseur doit
       le DIRE. S'il ne le dit pas, la boucle d'enregistrement se croit devant un
       parcours de démonstration et le périmètre du locataire retombe sur
       l'unité de la démonstration. */
    expect(
      sonde('provenance'),
      'le parc vient du serveur : les deux lecteurs de ce drapeau doivent le savoir',
    ).toBe('parc servi')
  })
})
