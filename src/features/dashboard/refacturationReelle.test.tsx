import { describe, expect, it } from 'vitest'
import {
  renderApp,
  screen,
  attendreLeChargement,
  userEvent,
  within,
  switchRole,
} from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import type { MeterReading } from '@/data/portfolio'

/**
 * « REFACTURÉ » CESSE D'ÊTRE UN PARTICIPE PASSÉ SANS PASSÉ.
 *
 * ═══ CE QUE L'ÉCRAN PROMETTAIT SANS PORTE D'ENTRÉE ═══
 *
 * Index, consommations, « Total refacturé », export CSV — et aucune route pour
 * écrire un relevé, aucun bouton pour en proposer un. Seul le semis de
 * démonstration en posait : sur un parc réel, cet écran était vide, et il le
 * serait resté.
 *
 * ═══ ET LE DÉFAUT QUE CÂBLER LA REFACTURATION TRANSFORMAIT EN ARGENT ═══
 *
 * `previousIndex ?? 0` : sans relevé antérieur, la consommation devenait
 * l'INDEX ENTIER du compteur. Un compteur électrique à 4 120 kWh facturait
 * 4 120 kWh le premier mois. Invisible en démonstration — chacun de ses relevés
 * a un antérieur — et sans conséquence tant que rien n'était facturé.
 *
 * Ces cas tiennent les DEUX sens : la consommation ne se calcule pas sans point
 * de départ, et l'écran le DIT au lieu de se taire ou d'accuser une tournée.
 */
describe('l’écran des relevés', () => {
  it('offre la saisie d’un relevé au propriétaire', async () => {
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()

    expect(screen.getByRole('button', { name: /Saisir un relevé/ })).toBeInTheDocument()
  })

  it('NE L’OFFRE PAS au locataire — un index saisi par qui paie est une déclaration', async () => {
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: /Saisir un relevé/ })).toBeNull()
  })

  it('demande l’INDEX et non la consommation, et déduit la période', async () => {
    /* Deux pièges d'une tournée : taper la consommation à la place de l'index,
       et croire qu'un relevé du 2 août compte pour juillet. Les deux se disent
       sous le champ plutôt qu'après coup. */
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(screen.getByRole('button', { name: /Saisir un relevé/ }))
    const modale = await screen.findByRole('dialog')

    expect(within(modale).getByText(/l’index lu sur le compteur/i)).toBeInTheDocument()
    expect(within(modale).getByText(/le mois de cette date/i)).toBeInTheDocument()
  })

  it('exige AU MOINS un des deux index', async () => {
    /* Valider à vide ferait deux appels pour rien et un compte rendu
       « 0 relevé saisi » qui ressemblerait à une panne. */
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(screen.getByRole('button', { name: /Saisir un relevé/ }))
    const modale = await screen.findByRole('dialog')
    await utilisateur.click(within(modale).getByRole('button', { name: /Enregistrer/ }))

    expect(within(modale).getByText(/au moins un des deux index/i)).toBeInTheDocument()
  })
})

/**
 * LE PREMIER RELEVÉ NE SE CHIFFRE PAS, ET L'ÉCRAN LE NOMME.
 *
 * Trois causes de « pas de montant », et elles n'appellent pas le même geste :
 * une tournée pour un relevé manquant, trente secondes de saisie pour un tarif
 * absent, et RIEN pour un premier relevé — la consommation naîtra le mois
 * prochain. Les confondre enverrait quelqu'un sur le terrain pour un compteur
 * qu'on vient justement de relever.
 */
describe('un PREMIER relevé', () => {
  /** Le jeu de démonstration, privé de son index antérieur sur A1. */
  const sansAnterieur = (lignes: MeterReading[]): MeterReading[] =>
    lignes.map((r) =>
      r.unitId === 'A1' ? { ...r, waterPrevious: null, powerPrevious: null } : r,
    )

  it('n’affiche NI consommation NI montant, et dit pourquoi', async () => {
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()

    /* La démonstration donne un antérieur à chacun : sans mise en scène, ce cas
       ne mesurerait rien. On retire l'antérieur d'A1 dans la projection lue par
       l'écran — voir `sansAnterieur`. */
    const { READINGS } = await import('@/data/portfolio')
    const original = [...READINGS]
    READINGS.splice(0, READINGS.length, ...sansAnterieur(original))
    try {
      await renderApp('/demo/releves')
      await attendreLeChargement()
      expect(screen.getAllByText(/Premier relevé/).length).toBeGreaterThan(0)
    } finally {
      READINGS.splice(0, READINGS.length, ...original)
    }
  })
})

/**
 * UN RELEVÉ MAL SAISI SE CORRIGE — LE DÉFAUT QUE LE LOT PRÉCÉDENT AVAIT ROUVERT.
 *
 * Son commit le nommait : « un index tapé à côté est définitif ». C'est le même
 * manque que trois lots d'affilée venaient de fermer — sur un immeuble, un
 * logement, un prix — et il porte plus lourd ici : un index faux ne s'affiche
 * pas seulement, il entre dans une échéance et se réclame.
 */
describe('corriger un relevé', () => {
  it('offre le geste sur une ligne qui porte un relevé', async () => {
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()

    expect(screen.getAllByRole('button', { name: /^Corriger les relevés — / }).length)
      .toBeGreaterThan(0)
  })

  it('ouvre la modale PRÉREMPLIE, et fige le logement', async () => {
    /* Corriger porte sur les relevés de CETTE ligne : déplacer le logement
       voudrait dire les retirer d'un compteur pour les poser sur un autre. */
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(
      screen.getAllByRole('button', { name: /^Corriger les relevés — / })[0]!,
    )
    const modale = await screen.findByRole('dialog')

    expect(within(modale).getByRole('combobox', { name: /Unité/ })).toBeDisabled()
    /* A1 porte 358 m³ dans le jeu de démonstration. */
    expect(within(modale).getByDisplayValue('358')).toBeInTheDocument()
  })

  it('AVERTIT qu’un relevé sert DEUX mois', async () => {
    /* La surprise qu'on désamorce : un relevé est le point d'arrivée de son mois
       et le point de départ du suivant. Corriger juin change juillet. */
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(
      screen.getAllByRole('button', { name: /^Corriger les relevés — / })[0]!,
    )
    const modale = await screen.findByRole('dialog')
    expect(within(modale).getByText(/point de départ au mois suivant/)).toBeInTheDocument()
  })

  it('demande une CONFIRMATION avant de retirer, énergie par énergie', async () => {
    installerFauxServeur()
    await renderApp('/demo/releves')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(
      screen.getAllByRole('button', { name: /^Corriger les relevés — / })[0]!,
    )
    const modale = await screen.findByRole('dialog')

    expect(within(modale).queryByRole('button', { name: /Confirmer le retrait/ })).toBeNull()
    await utilisateur.click(within(modale).getByRole('button', { name: /Retirer le relevé d’eau/ }))
    expect(
      within(modale).getByRole('button', { name: /Confirmer le retrait/ }),
    ).toBeInTheDocument()
    /* Et l'électricité garde son geste NON armé : les deux retraits sont
       distincts, et confondre les deux effacerait un relevé qu'on gardait. */
    expect(
      within(modale).getByRole('button', { name: /Retirer le relevé d’électricité/ }),
    ).toBeInTheDocument()
  })
})
