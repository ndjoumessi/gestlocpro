import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

const PARC = '00000000-0000-4000-8000-0000000000aa'
const UNITE = '00000000-0000-4000-8000-0000000000bb'

/** Un vrai parc, avec une adhésion : c'est ce qui donne un `parkId`. */
const sessionReelle: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bonamoussadi', currency: 'XAF' }],
}

/** Le portefeuille du parc réel, réduit au logement qu'on quittance. */
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
 * LA MODALE DE QUITTANCE N'ATTEND PAS UNE RÉPONSE QUI NE VIENDRA PAS.
 *
 * ═══ CE QU'ELLE FAISAIT ═══
 *
 * « Chargement… », indéfiniment, avec ses deux boutons éteints. Et AUCUNE
 * requête réseau — mesuré au navigateur sur `/demo/paiements`. L'effet qui
 * demande le document sortait à sa première ligne :
 *
 *     if (!open || !parkId) return
 *
 * En démonstration il n'y a pas d'adhésion, donc pas de `parkId`. La modale
 * s'ouvrait, ne demandait rien, et ne disait rien non plus : ni document, ni
 * échec, donc l'état « en cours » pour toujours. Une porte sans pièce derrière.
 *
 * ═══ POURQUOI ON NE SE CONTENTE PAS DE DIRE « INDISPONIBLE » ═══
 *
 * La démonstration existe pour montrer le produit sans compte. Une quittance
 * est ce que ce produit remet ; la refuser sur l'écran qui sert à convaincre
 * reviendrait à démontrer un cahier de charges. Le client détient déjà les
 * faits — c'est avec eux que l'espace LOCATAIRE compose ses quittances depuis
 * plusieurs lots, par la même fonction.
 *
 * ═══ ET LE CHEMIN SERVEUR NE BOUGE PAS ═══
 *
 * Sur un vrai parc, le document reste ARRÊTÉ par le serveur : c'est lui qui
 * connaît l'échéance, tranche entre quittance et reçu, et pose la devise de la
 * pièce. Le troisième cas le tient — sans lui, ce lot pourrait « réparer » la
 * démonstration en faisant calculer au client ce qu'il n'a pas le droit de
 * décider.
 */

/** Ouvre la première quittance du tableau des paiements. */
async function ouvrirLaQuittance() {
  const boutons = screen.getAllByRole('button', { name: /Quittance|Receipt|Issue/ })
  await userEvent.setup().click(boutons[0])
  return await screen.findByRole('dialog')
}

describe('la quittance en démonstration', () => {
  it('montre un document au lieu de charger sans fin', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()

    expect(
      within(modale).queryByText(/Chargement|Loading/),
      'la modale attend une réponse qui ne viendra jamais',
    ).toBeNull()
    /* Le locataire et le logement : de quoi vérifier que c'est bien LA pièce de
       la ligne cliquée, et non une coquille remplie de tirets. */
    expect(within(modale).getByText(/Locataire|Tenant/)).toBeInTheDocument()
  })

  /**
   * LE MOIS DE L'ÉCRAN EST CELUI DU DOCUMENT.
   *
   * Trouvé en regardant la modale enfin rendue : elle titrait « Septembre 2026 »
   * au-dessus d'un versement du 3 août. La ligne du mois écrivait
   * `d.monthYear({ year, month: mois })` là où le mois d'une chaîne ISO est
   * compté à partir de UN et `monthYear` à partir de ZÉRO — le décalage d'un
   * cran, sur un document qui atteste d'une période.
   *
   * LE PDF, LUI, ÉTAIT JUSTE : quinze lignes plus haut, la même valeur passe par
   * `mois - 1`. L'écran et la pièce téléchargée du MÊME document ne nommaient
   * donc pas le même mois, ce qui est pire que si les deux s'étaient trompés.
   *
   * Le mois est calculé, jamais écrit : la modale quittance le mois COURANT, et
   * un attendu en dur se périmerait au premier jour du suivant.
   */
  it('nomme le mois du document, et non le suivant', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()

    const maintenant = new Date()
    const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
      .format(new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1)))
    const suivant = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
      .format(new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 1)))

    const texte = (modale.textContent ?? '').toLowerCase()
    expect(texte, `le document devrait porter ${mois}`).toContain(mois.toLowerCase())
    expect(texte, `il porte ${suivant}, un mois trop loin`).not.toContain(suivant.toLowerCase())
  })

  /**
   * L'APERÇU MONTRE CE QUE LA FEUILLE MONTRE.
   *
   * Le fichier le promet en toutes lettres — « ce qu'on voit ici est ce qui
   * sortira […] un aperçu qui ne ressemble pas à la feuille est un aperçu qui
   * ment » — et la promesse n'était pas tenue. Mises côte à côte, les deux
   * pièces du MÊME mois disaient :
   *
   *   feuille : logement, date d'émission, période, locataire, loyer, eau,
   *             électricité, dû, réglé, statut, versements
   *   aperçu  : période, locataire, logement, dû, réglé, solde, versements
   *
   * L'aperçu perdait le DÉTAIL — quelle part est du loyer, quelle part de
   * l'eau — qui est justement ce qu'un locataire conteste, et le STATUT, qui
   * est ce qu'un gestionnaire vérifie avant de remettre la pièce.
   *
   * Ce n'était pas une omission de mise en page : les deux composaient leur
   * contenu SÉPARÉMENT. C'est ainsi que le mois avait divergé d'un cran entre
   * l'écran et la feuille. Les deux passent désormais par
   * `composerLaQuittance`, et ce cas tient le raccord.
   */
  it('montre le détail poste par poste, comme la feuille', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()
    const texte = (modale.textContent ?? '').replace(/[\s ]/g, ' ')

    /* Les trois postes de la période, et non le seul total : c'est la
       ventilation qui permet de contester une refacturation. */
    for (const poste of [/Loyer/, /Eau/, /Élec/])
      expect(texte, `le poste manque à l’aperçu`).toMatch(poste)

    /* Le statut de la pièce — « À jour », « Partiel », « En attente ». La
       feuille le porte ; l'écran l'ignorait. */
    expect(texte).toMatch(/À jour|Partiel|En attente|Paid|Partial|Pending/)
  })

  it('laisse télécharger et imprimer', async () => {
    installerFauxServeur()
    await renderApp('/demo/paiements')
    await attendreLeChargement()

    const modale = await ouvrirLaQuittance()

    /* Les deux boutons s'éteignent tant qu'il n'y a pas de document — c'est
       écrit dans la modale, et c'était donc l'autre moitié de la panne : une
       pièce impossible à emporter. */
    for (const nom of [/Télécharger|Download/, /Imprimer|Print/])
      expect(within(modale).getByRole('button', { name: nom })).toBeEnabled()
  })
})

/**
 * LE CONTREPOIDS, et il porte le vrai risque de ce lot.
 *
 * Faire composer la pièce par le client est juste en démonstration, où les
 * données SONT celles du client. Sur un parc réel, ce serait laisser l'écran
 * décider s'il faut écrire « quittance » — c'est-à-dire attester d'un paiement
 * — à partir de montants qu'il n'a pas arrêtés.
 */
describe('la quittance sur un parc réel', () => {
  it('vient du serveur, et de nulle part ailleurs', async () => {
    const faux = serveurReel()
    await renderApp('/app/paiements', { session: sessionReelle })
    await attendreLeChargement()

    await ouvrirLaQuittance()

    const emissions = faux.appels.filter((a) => /receipt/i.test(a.chemin))
    expect(emissions.length, 'le document a été composé sans demander au serveur').toBeGreaterThan(
      0,
    )
  })
})
