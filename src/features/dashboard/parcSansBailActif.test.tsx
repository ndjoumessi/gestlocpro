import { describe, expect, it } from 'vitest'
import { renderApp, screen, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * UN PARC SANS AUCUN BAIL ACTIF — et trois phrases du tableau de bord y mentent.
 *
 * ═══ L'ÉTAT, ET IL N'A RIEN D'EXOTIQUE ═══
 *
 * Des immeubles, des logements, aucun locataire encore installé. C'est l'état
 * EXACT d'un compte qui vient de déclarer son parc : on saisit les immeubles,
 * puis les logements, et les baux arrivent après. Il dure des jours, et c'est le
 * premier écran que ce compte voit chaque matin.
 *
 * `computeKpis` somme sur les logements OCCUPÉS : `expected` vaut donc zéro, et
 * `collected` aussi. Les quatre nombres sont exacts. Ce sont leurs LÉGENDES qui
 * ne le sont pas.
 *
 * ═══ CE QUE L'ÉCRAN DISAIT ═══
 *
 * 1. « Reste à percevoir · 0 FCFA » avec la note « 100 % du loyer attendu ».
 *    Cent pour cent de rien. Le calcul est `100 - collectedShare`, et
 *    `collectedShare` est écrasé à zéro quand `expected` vaut zéro — précisément
 *    pour éviter une division par zéro. La garde produisait donc la phrase la
 *    plus fausse de l'écran : elle annonce un arriéré total là où personne ne
 *    doit rien.
 *
 * 2. « Encaissé · 0 FCFA » avec la note « 0 % du dû ». Zéro pour cent d'un dû
 *    qui n'existe pas. La même garde, à l'autre bout de la même division.
 *
 * 3. « Répartition du parc », tuile d'un immeuble sans logement : « 0/0 », et
 *    rien d'autre. Ce n'est pas faux, c'est MUET — et l'écran Parc a déjà tranché
 *    ce cas, dans ces termes : « le rapport est exact et muet : il faut savoir le
 *    lire pour comprendre qu'il n'y a pas encore de logement, là où la phrase le
 *    dit ». Il écrit « aucun logement ». Le tableau de bord, non.
 *
 * ═══ CE QUE CE FICHIER NE TIENT PAS ═══
 *
 * L'anneau de recouvrement. Avec trois parts à zéro, `DonutChart` rend un cercle
 * VIDE portant « 0 % · encaissé » au centre — exact, et sans un mot pour dire
 * qu'il n'y a rien à recouvrer. Le corriger demande de choisir ce qui remplace
 * un anneau, donc deux libellés de plus et une mesure de hauteur ; c'est un lot,
 * pas une ligne, et il est écrit ici plutôt que tu.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/**
 * Deux immeubles : l'un porte deux logements VACANTS, l'autre aucun.
 *
 * Les deux moitiés du défaut tiennent dans le même parc, et c'est fidèle : un
 * compte qui saisit son parc crée ses immeubles l'un après l'autre, donc il en
 * a toujours un qui n'a pas encore ses logements.
 */
function parcSansBail() {
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
              tenant: null,
              status: 'vacant',
              paidMinor: 0,
              overdueDays: null,
            },
            {
              id: 'cccccccc-2222-4333-8444-555555555555',
              label: 'A2',
              type: 'T2',
              surfaceSqm: 55,
              rentMinor: 110000,
              tenant: null,
              status: 'vacant',
              paidMinor: 0,
              overdueDays: null,
            },
          ],
        },
        {
          /* L'IMMEUBLE QUI N'A PAS ENCORE SES LOGEMENTS — celui dont la tuile
             rendait « 0/0 » sans un mot. */
          id: 'dddddddd-2222-4333-8444-555555555555',
          name: 'Immeuble Akwa',
          district: 'Akwa',
          units: [],
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
 * La carte d'indicateur qui porte cet intitulé, cherchée par son MARQUEUR.
 *
 * `[data-indicateur]` et non une classe : c'est l'attribut que `StatCard` pose
 * pour être interrogeable, et son commentaire dit pourquoi — `closest` survit à
 * tous les remaniements de mise en page.
 */
async function carte(intitule: RegExp) {
  await screen.findAllByText(intitule)
  const cartes = Array.from(document.querySelectorAll('[data-indicateur]'))
  const trouvee = cartes.find((c) => intitule.test(c.textContent ?? ''))
  if (!trouvee) throw new Error(`aucune carte d’indicateur pour ${intitule}`)
  return trouvee as HTMLElement
}

describe('le tableau de bord d’un parc sans bail actif', () => {
  it('ne prétend pas qu’il reste cent pour cent à percevoir', async () => {
    parcSansBail()
    await renderApp('/app', { session: SESSION })

    const reste = await carte(/reste à percevoir/i)

    /* CENT POUR CENT DE RIEN. La note se calcule `100 - collectedShare`, et
       `collectedShare` est écrasé à zéro quand rien n'est attendu — la garde
       contre la division par zéro fabriquait la phrase. */
    expect(
      reste.textContent,
      'la carte annonce un arriéré total là où personne ne doit rien',
    ).not.toMatch(/100\s*%/)
  })

  it('dit ce qui est vrai à sa place : rien n’est attendu', async () => {
    parcSansBail()
    await renderApp('/app', { session: SESSION })

    const reste = await carte(/reste à percevoir/i)

    /* UNE NOTE ABSENTE SERAIT DÉJÀ MIEUX QU'UNE NOTE FAUSSE, mais elle laisserait
       le zéro s'expliquer tout seul — et un zéro peut aussi bien vouloir dire
       « tout est réglé ». La phrase dit laquelle des deux. */
    expect(reste.textContent, 'rien ne dit pourquoi ce zéro est un zéro').toMatch(
      /aucun loyer attendu/i,
    )
  })

  it('ne rapporte pas l’encaissé à un dû qui n’existe pas', async () => {
    parcSansBail()
    await renderApp('/app', { session: SESSION })

    const encaisse = await carte(/encaissé/i)

    /* « 0 % du dû » — la même division, à l'autre bout. Il n'y a pas de dû. */
    expect(encaisse.textContent, 'l’encaissé se rapporte à un dû inexistant').not.toMatch(
      /%\s*du dû|du dû/i,
    )
  })

  it('dit d’un immeuble sans logement qu’il n’en a aucun', async () => {
    parcSansBail()
    await renderApp('/app', { session: SESSION })

    const lien = await screen.findByRole('link', { name: /Immeuble Akwa/i })

    /* LA RÈGLE VIENT DE L'ÉCRAN PARC, mot pour mot : « le rapport est exact et
       muet ». Le même parc, le même immeuble, deux écrans — et un seul le disait. */
    expect(lien.textContent, 'la tuile laisse « 0/0 » se déchiffrer').toMatch(/aucun logement/i)
    /* LE RAPPORT RESTE : il est exact, et c'est la phrase qui s'ajoute, pas qui
       remplace — exactement comme sur l'écran Parc. */
    expect(within(lien).getByText('0/0')).toBeInTheDocument()
  })
})
