import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN GRAPHE DE DOUZE MOIS QUI N'EN PORTE QUE DEUX.
 *
 * ═══ L'ANGLE MORT, ET IL EST STRUCTUREL ═══
 *
 * Les portes de ce dépôt mesurent deux jeux de données, et seulement deux :
 *
 *     `/demo`      douze mois, quinze logements   — le PLEIN
 *     parc vide    zéro                           — le VIDE, avec `EmptyState`
 *
 * Aucune ne rend jamais UN, DEUX OU TROIS points. C'est pourtant l'état de tout
 * parc dans ses premiers mois — donc de tout nouveau client, sur son tout
 * premier écran.
 *
 * ═══ CE QUE ÇA DONNAIT, RELEVÉ SUR LA PRODUCTION ═══
 *
 * Un parc ouvert en août, capturé le 5 septembre : DEUX points. Les colonnes se
 * découpent en `flex-1` — juste à douze, absurde à deux : chaque barre prenait
 * la moitié de la largeur. Une forme de 600 px de large sur 30 de haut ne se lit
 * pas comme une série mensuelle, elle se lit comme une BARRE DE PROGRESSION.
 *
 * Et le titre annonçait « Encaissements sur 12 mois » au-dessus de deux
 * colonnes. Le serveur ne renvoie que les périodes qui PORTENT une échéance : le
 * libellé promettait ce que la donnée n'a pas.
 *
 * ═══ CE QUE CES CAS TIENNENT, ET CE QU'ILS NE PEUVENT PAS ═══
 *
 * jsdom ne met rien en page : la LARGEUR RENDUE lui échappe, et aucun cas d'ici
 * ne peut dire qu'une barre fait 600 px. Ils tiennent donc ce que le DOM porte —
 * le titre, et la borne de largeur posée sur le conteneur partagé.
 *
 * La borne vit sur le CONTENEUR et non sur chaque colonne, et ce n'est pas du
 * style : les trois rangées — tracé du haut, tracé du bas, rangée des mois — se
 * découpent dans ce même conteneur, et c'est ce qui les aligne. Les borner une à
 * une décalerait les mois de leurs barres, « le défaut le plus grave qu'un
 * graphe puisse porter, et l'un des plus discrets » — l'en-tête de `Charts.tsx`
 * le dit déjà.
 */

const PARC = '77777777-3333-4444-8888-999999999999'

function sessionProprietaire(): EtatSession {
  return {
    statut: 'connecte',
    compte: COMPTE_FICTIF,
    adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
  }
}

/** Un parc ouvert il y a deux mois : deux périodes, pas douze. */
const UNITE = {
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
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [
    { id: 'imm-1', name: 'Residence Djoumessi', district: 'Bastos', units: [UNITE] },
  ],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
  leaseCharges: [],
}

const mois = (n: number) => ({ year: 2026, month: n, rent: n === 8 ? 32798 : 0, water: 0, power: 0 })

async function ouvrirLeTableauDeBord() {
  const faux = installerFauxServeur({ authentifie: true })
  faux.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: { ...PORTEFEUILLE, collections: [mois(8), mois(9)] },
  })
  await renderApp('/app', { session: sessionProprietaire() })
  await attendreLeChargement()
}

describe('le graphe des encaissements sur un parc jeune', () => {
  it('n’annonce pas douze mois quand il en porte deux', async () => {
    await ouvrirLeTableauDeBord()

    const titre = await screen.findByText(/encaissements sur/i)
    expect(
      titre.textContent,
      'le titre promet une profondeur que la donnée n’a pas',
    ).not.toMatch(/12\s*mois/i)
    expect(titre.textContent, 'et il doit dire ce qu’il montre').toMatch(/2\s*mois/i)
  })

  it('borne la largeur du tracé quand les points sont rares', async () => {
    /* CE QUE jsdom PEUT DIRE, et rien de plus : la borne EXISTE sur le conteneur
       partagé. Qu'elle produise la bonne image relève de la porte au navigateur,
       qui ne rend aujourd'hui que douze points ou zéro — voir l'en-tête. */
    await ouvrirLeTableauDeBord()

    const rangee = document.querySelector('[data-rangee-de-colonnes]')
    expect(rangee, 'aucune rangée de colonnes').not.toBeNull()
    const conteneur = rangee!.parentElement!
    expect(
      conteneur.style.maxWidth,
      'sans borne, deux colonnes en `flex-1` prennent chacune la moitié de la largeur',
    ).not.toBe('')
  })

  it('ne borne RIEN quand les douze mois sont là', async () => {
    /* L'AUTRE SENS. Une borne qui s'appliquerait toujours rétrécirait le graphe
       plein, c'est-à-dire celui que toutes les portes mesurent — et le défaut
       partirait dans l'angle mort inverse. */
    const faux = installerFauxServeur({ authentifie: true })
    faux.quand('GET', `/parks/${PARC}/portfolio`, {
      status: 200,
      body: {
        ...PORTEFEUILLE,
        collections: Array.from({ length: 12 }, (_, i) => mois(i + 1)),
      },
    })
    await renderApp('/app', { session: sessionProprietaire() })
    await attendreLeChargement()

    const rangee = document.querySelector('[data-rangee-de-colonnes]')
    expect(rangee!.parentElement!.style.maxWidth).toBe('')
  })
})
