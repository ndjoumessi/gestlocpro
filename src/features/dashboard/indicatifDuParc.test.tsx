import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

const PARC = '77777777-8888-4999-8aaa-bbbbbbbbbbbb'
const A3 = 'aaaaaaaa-1111-4000-8111-111111111111'

/** Un parc minimal : un immeuble, un logement VACANT — la fiche s'y rattache. */
function installer() {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [
        {
          id: 'imm-1',
          name: 'Résidence Abidjan',
          district: 'Cocody',
          units: [
            {
              id: A3,
              label: 'A3',
              type: 'T2',
              surfaceSqm: 52,
              rentMinor: 90000,
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
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
      leaseCharges: [],
    },
  })
  return faux
}

/**
 * L'INDICATIF PROPOSÉ EST CELUI DU PARC.
 *
 * `Tenants.tsx` ouvrait sur `useState('+237')` — le Cameroun, en dur. Un parc
 * ivoirien, sénégalais ou français proposait donc l'indicatif d'un autre pays,
 * et le numéro composé à partir de là n'appelle personne. C'est la moitié
 * visible du signalement « le format du numéro de téléphone n'est pas conforme
 * au pays ».
 *
 * Le pays du parc VOYAGE DÉJÀ : `AdhesionApi.countryCode` est servi sur chaque
 * adhésion depuis un lot antérieur, avec son propre cas. Rien n'était à
 * transporter — seulement à lire.
 *
 * IL RESTE MODIFIABLE. Un propriétaire camerounais peut avoir un locataire
 * joignable sur un numéro français ; le champ propose, il n'impose pas.
 */
function sessionAvecParc(countryCode: string | null): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [
      {
        parkId: PARC,
        role: 'owner',
        parkName: 'Parc Abidjan',
        currency: 'XOF',
        ...(countryCode ? { countryCode } : {}),
      },
    ],
  }
}

async function ouvrirLaFiche(session: EtatSession) {
  installer()
  const utilisateur = userEvent.setup()
  await renderApp('/app/locataires', { session })
  await utilisateur.click(await screen.findByRole('button', { name: /créer une fiche locataire/i }))
  return within(await screen.findByRole('dialog'))
}

describe('l’indicatif de la fiche locataire', () => {
  it('suit le pays du PARC, et non une valeur écrite en dur', async () => {
    const modale = await ouvrirLaFiche(sessionAvecParc('CI'))
    expect(
      modale.getByLabelText(/indicatif/i),
      'la fiche propose l’indicatif du Cameroun dans un parc ivoirien',
    ).toHaveValue('+225')
  })

  it('retombe sur le marché servi quand le parc ne dit pas son pays', async () => {
    /* `countryCode` est FACULTATIF sur l'adhésion — un serveur antérieur au
       champ ne le rend pas. Le repli garde le comportement d'avant ce lot
       plutôt que d'ouvrir sur un champ vide, qu'il faudrait alors remplir à
       chaque fiche dans le pays où le produit est effectivement utilisé. */
    const modale = await ouvrirLaFiche(sessionAvecParc(null))
    expect(modale.getByLabelText(/indicatif/i)).toHaveValue('+237')
  })
})
