import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * L'ORIGINE d'une intervention, et ce que son montant représente.
 *
 * Deux manques qui n'en font qu'un : l'écran affichait un nombre nu à côté d'une
 * pastille de statut, sans dire ni d'où venait le travail ni si la somme était
 * une proposition ou une dépense. Le serveur, lui, distinguait les deux montants
 * depuis toujours — « un devis révisé après coup ne doit pas réécrire ce qui a
 * été engagé » — et le client les aplatissait en un seul par un `??`.
 *
 * Le déclarant, lui, était écrit en base depuis l'origine et rendu nulle part :
 * le bailleur recevait un problème sans savoir qui l'avait vu, donc sans pouvoir
 * rappeler ni faire ouvrir la porte à l'artisan.
 */

const ligne = (titre: RegExp) =>
  screen.getByRole('heading', { name: titre }).closest('div')!.parentElement!.parentElement!

describe('origine des interventions — en démonstration', () => {
  async function ouvrir() {
    renderApp('/demo/travaux')
    await attendreLeChargement()
  }

  it('dit qui a signalé, et le nomme', async () => {
    await ouvrir()
    // A3 est louée à Serge Mbarga : c'est lui qui a vu la fuite, et c'est lui
    // que le bailleur doit rappeler pour faire ouvrir la porte.
    expect(ligne(/évier de la cuisine/i)).toHaveTextContent('Signalé par Serge Mbarga')
  })

  /**
   * La réfection de B4 était une initiative du bailleur DEPUIS TOUJOURS sans
   * pouvoir le dire : un chantier de relocation, décidé entre deux locataires,
   * et dont le corps de métier — « multi » — est justement celui que
   * `TRADES_REPORTABLE` exclut de ce qu'un locataire peut déclarer.
   */
  it('distingue ce que le bailleur a décidé de ce qu’un locataire subit', async () => {
    await ouvrir()
    const refection = ligne(/réfection complète/i)
    expect(refection).toHaveTextContent('Ouvert par Arsène Nkolo')
    expect(refection).not.toHaveTextContent('Signalé par')
  })

  /**
   * LE MONTANT DIT CE QU'IL EST.
   *
   * 45 000 sur la fuite est un devis que personne n'a validé ; 78 000 sur le
   * disjoncteur est une dépense engagée. Le même nombre nu servait pour les
   * deux, et le lecteur devait le déduire de la pastille de statut.
   */
  it('qualifie le montant : proposé, ou engagé', async () => {
    await ouvrir()
    const devis = ligne(/évier de la cuisine/i)
    expect(devis).toHaveTextContent('45 000')
    // « Devis » et non « Devis proposé » : ce dernier est le libellé du STATUT,
    // que la pastille porte déjà sur la même ligne.
    expect(devis).toHaveTextContent('Devis')
    expect(devis).not.toHaveTextContent('Engagé')

    const engage = ligne(/disjoncteur/i)
    expect(engage).toHaveTextContent('78 000')
    expect(engage).toHaveTextContent('Engagé')
  })

  it('ne chiffre pas ce qui n’a pas de devis', async () => {
    await ouvrir()
    const sansDevis = ligne(/peinture du séjour/i)
    expect(sansDevis).toHaveTextContent('Pas encore chiffré')
    expect(sansDevis).not.toHaveTextContent('Devis proposé')
  })

  /**
   * Le locataire ne lit toujours AUCUN montant.
   *
   * La règle vient des maquettes — « le coût des travaux n'est jamais exposé au
   * locataire » — et scinder le montant en deux double les occasions de la
   * rompre. Le cas la garde sur l'écran des travaux, que `ecranSignaler` ne
   * couvre pas.
   */
  it('n’expose ni devis ni engagé au locataire', async () => {
    renderApp('/demo/travaux')
    await switchRole('tenant')
    await attendreLeChargement()
    const page = screen.getByRole('main')
    // Le statut reste — « Devis proposé », « Validé » — c'est le MONTANT qui
    // s'en va. Le locataire a droit à savoir si ça avance.
    expect(page).not.toHaveTextContent('Engagé')
    expect(page.textContent).not.toMatch(/FCFA|€/)
  })
})

/**
 * Sur un VRAI parc, et c'est là que l'écart entre devisé et engagé se voit.
 *
 * Le jeu de démonstration n'a aucune intervention dont le montant validé
 * diffère du devis : la révision d'un devis après coup — le cas que le serveur
 * documente en propre — n'y est donc gardée par personne.
 */
describe('origine des interventions — un devis révisé', () => {
  const PARC = '55555555-6666-4777-8888-999999999999'
  const UNITE = 'eeeeeeee-ffff-4000-8111-222222222222'

  function session(): EtatSession {
    return {
      statut: 'connecte',
      compte: COMPTE_FICTIF,
      adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
    }
  }

  function serveur(work: Record<string, unknown>) {
    const faux = installerFauxServeur()
    faux.quand('GET', `/parks/${PARC}/portfolio`, {
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
                rentMinor: 90000,
                tenant: { id: 'loc-1', fullName: 'Awa Bello', phoneE164: null },
                status: 'paid',
                leaseId: 'bail-1',
                leaseStartsOn: '2025-03-01T00:00:00.000Z',
                paidMinor: 90000,
                overdueDays: null,
              },
            ],
          },
        ],
        works: [work],
        deposits: [],
        readings: [],
        inspections: [],
        notifications: [],
        leaseCharges: [],
      },
    })
  }

  const BASE = {
    id: 'w-1',
    reference: 'SIG-2026-050',
    unitId: UNITE,
    title: 'Remplacement du ballon d’eau chaude',
    trade: 'plumbing' as const,
    status: 'approved' as const,
    urgency: 'normal' as const,
    reportedAt: '2026-07-02T00:00:00.000Z',
  }

  /**
   * 60 000 devisés, 95 000 engagés : le devis a été revu à la hausse après la
   * proposition. C'est précisément ce que le serveur refuse d'écraser, et ce que
   * l'aplatissement du client effaçait — l'écran n'affichait que 95 000, sans
   * rien qui laisse soupçonner une dérive de 58 %.
   */
  it('montre l’engagé ET le devis d’origine quand ils diffèrent', async () => {
    serveur({ ...BASE, quotedAmountMinor: 60000, approvedAmountMinor: 95000, origin: 'ownerInitiative', reportedBy: 'Arsène Nkolo' })
    renderApp('/app/travaux', { session: session() })
    await attendreLeChargement()

    const carte = ligne(/ballon d’eau chaude/i)
    expect(carte).toHaveTextContent('95 000')
    expect(carte).toHaveTextContent('Engagé')
    expect(carte).toHaveTextContent('devisé')
    expect(carte).toHaveTextContent('60 000')
  })

  it('ne répète pas le devis quand il n’a pas bougé', async () => {
    serveur({ ...BASE, quotedAmountMinor: 60000, approvedAmountMinor: 60000, origin: 'tenantReport', reportedBy: 'Awa Bello' })
    renderApp('/app/travaux', { session: session() })
    await attendreLeChargement()

    const carte = ligne(/ballon d’eau chaude/i)
    expect(carte).toHaveTextContent('Engagé')
    // Une ligne « devisé 60 000 » sous « 60 000 engagé » ne dirait rien et
    // ferait douter d'une différence qui n'existe pas.
    expect(carte).not.toHaveTextContent('devisé')
  })

  /**
   * L'origine SERVIE par le serveur arrive bien à l'écran.
   *
   * Ce cas manquait, et la mutation l'a montré : retirer la conversion de
   * `origin` dans `apiPortfolio` laissait la suite entière verte. Les cas de
   * démonstration vérifiaient l'affichage sur le jeu LOCAL, où l'origine ne
   * traverse aucune conversion ; celui d'absence vérifiait le silence, que
   * supprimer la conversion rend seulement plus vrai.
   *
   * Entre les deux, le chemin réel — celui de tout parc en production —
   * n'était gardé par personne.
   */
  it('rend l’origine et le déclarant que le serveur envoie', async () => {
    serveur({ ...BASE, quotedAmountMinor: 60000, approvedAmountMinor: 60000, origin: 'tenantReport', reportedBy: 'Awa Bello' })
    renderApp('/app/travaux', { session: session() })
    await attendreLeChargement()

    expect(ligne(/ballon d’eau chaude/i)).toHaveTextContent('Signalé par Awa Bello')
  })

  it('distingue l’initiative du bailleur sur un vrai parc', async () => {
    serveur({ ...BASE, quotedAmountMinor: 60000, approvedAmountMinor: 60000, origin: 'ownerInitiative', reportedBy: 'Arsène Nkolo' })
    renderApp('/app/travaux', { session: session() })
    await attendreLeChargement()

    const carte = ligne(/ballon d’eau chaude/i)
    expect(carte).toHaveTextContent('Ouvert par Arsène Nkolo')
    expect(carte).not.toHaveTextContent('Signalé par')
  })

  /**
   * Un serveur antérieur à ces champs ne rend aucune origine — et l'écran se
   * tait plutôt que d'en supposer une. Étiqueter « signalement » par défaut
   * inventerait un locataire déclarant là où personne n'a rien dit.
   */
  it('n’invente pas d’origine quand le serveur n’en rend pas', async () => {
    serveur({ ...BASE, quotedAmountMinor: 60000, approvedAmountMinor: 60000 })
    renderApp('/app/travaux', { session: session() })
    await attendreLeChargement()

    const carte = ligne(/ballon d’eau chaude/i)
    expect(carte).not.toHaveTextContent('Signalé par')
    expect(carte).not.toHaveTextContent('Ouvert par')
    expect(carte).not.toHaveTextContent('initiative')
  })
})
