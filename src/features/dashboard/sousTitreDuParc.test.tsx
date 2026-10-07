import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * LE SOUS-TITRE DU PARC COMPTAIT UNE AUTRE POPULATION QUE CELLE QU'IL MONTRE.
 *
 * ═══ LES DEUX COLLECTIONS, ET L'ENDROIT EXACT OÙ ELLES DIVERGENT ═══
 *
 * `Portfolio.tsx` tient DEUX collections de logements et n'en nomme qu'une :
 *
 *   `units`             le parc tel que le fournisseur l'a lu, aujourd'hui ;
 *   `unitesAffichees`   `unitesDuMois ?? units`, borné au MOIS AFFICHÉ.
 *
 * Tout l'écran rend la seconde — les groupes, l'occupation, les totaux, et
 * jusqu'à `lignesEnTout` dont le commentaire dit déjà pourquoi : « prendre
 * `units` ferait annoncer un dénominateur que cet écran ne montre pas ». Le
 * sous-titre, lui, comptait la PREMIÈRE.
 *
 * `??` NE SE REPLIE QUE SUR `null` ET `undefined`. Un mois dont la réponse ne
 * porte aucun logement rend un TABLEAU VIDE, pris tel quel : chaque en-tête
 * d'immeuble passe alors à « · aucun logement », son rapport à `0/0`, le pied
 * de totaux à zéro ligne — et le sous-titre annonce trois unités deux
 * centimètres plus haut.
 *
 * ═══ CE QUE CES CAS TIENNENT, ET POURQUOI IL EN FAUT TROIS ═══
 *
 * 1. MOIS VIDE : le compte annoncé dit que le mois n'en porte aucune. C'est le
 *    cas fautif, et il naît rouge.
 * 2. MOIS PLEIN : le compte s'annonce SANS réserve. Sans cette moitié, le
 *    premier serait satisfait par un sous-titre qui dirait « aucune sur ce
 *    mois » en toutes circonstances, ce qui est un autre mensonge.
 * 3. MOIS PARTIEL : la part se NOMME. Sans ce cas, la branche qui chiffre le
 *    sous-ensemble ne serait jamais exécutée — du code livré, jamais regardé.
 *
 * ═══ CE QUE CES CAS NE PROUVENT PAS, ET IL FAUT LE DIRE ═══
 *
 * La route du portefeuille, telle qu'elle est écrite aujourd'hui, ne borne au
 * mois QUE l'échéance retenue — elle le dit en toutes lettres : « le serveur ne
 * borne que l'échéance retenue, jamais l'existence du bail ». Elle rend donc le
 * même jeu d'unités pour tous les mois, et la divergence n'est pas joignable PAR
 * CE CHEMIN sur le déploiement du jour. Ce que ces cas gardent est le CONTRAT du client : il reçoit un tableau
 * dont rien ne lui garantit la taille, et il doit compter ce qu'il montre.
 *
 * LA CAPTURE DE PRODUCTION DU 2026-10-07 PORTE BIEN CETTE FORME — « 3 unités »
 * au-dessus de trois en-têtes disant « aucun logement » — ET VIENT D'AILLEURS.
 * Vérifié au volet navigateur : `/api/auth/me` y rend 401, donc `parkId` vaut
 * `null` et `unitesDuMois` ne part jamais. Ce sont des unités d'un parc RÉEL,
 * restaurées depuis `localStorage` par-dessus les immeubles de la démonstration,
 * dont aucun `buildingId` ne résout. Autre sujet, autre fichier
 * (`src/data/persistence.ts`), et son propre lot.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Le mois précédent, calculé comme l'écran le calcule. */
function moisPrecedent() {
  const d = new Date()
  const p = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1))
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`
}

const unite = (label: string) => ({
  id: `u-${label}`,
  label,
  type: 'T2',
  surfaceSqm: 45,
  rentMinor: 185000,
  paidMinor: 185000,
  status: 'paid',
  overdueDays: null,
  leaseId: `bail-${label}`,
  leaseStartsOn: '2026-01-01',
  tenant: { id: `t-${label}`, fullName: `Locataire ${label}`, phoneE164: '+237677214408' },
})

const corps = (labels: string[]) => ({
  collections: [],
  buildings: [
    { id: 'b-1', name: 'Résidence Pleine', district: 'Bastos', units: labels.map(unite) },
  ],
  works: [],
  deposits: [],
  readings: [],
  inspections: [],
  notifications: [],
})

/**
 * UN PARC DE TROIS LOGEMENTS CE MOIS-CI, et ce que le mois d'avant en porte.
 *
 * Trois et non un : « aucune sur ce mois » se distingue d'un compte qui aurait
 * seulement changé de valeur, et le cas partiel a de quoi retirer une part sans
 * tout vider.
 */
function parcDontLeMoisPrecedentPorte(labelsDuMoisPrecedent: string[]) {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: corps(['A1', 'A2', 'A3']),
  })
  serveur.quand('GET', `/parks/${PARC}/portfolio?mois=${moisPrecedent()}`, {
    status: 200,
    body: corps(labelsDuMoisPrecedent),
  })
  return serveur
}

/**
 * LE SOUS-TITRE, LU PAR SA PHRASE PROPRE.
 *
 * « Le statut porte sur le mois affiché » n'est écrit nulle part ailleurs sur
 * cet écran, et c'est le sous-titre lui-même qui la porte : la viser par là
 * évite d'interroger la structure de `PageHeader`, qui n'est pas le sujet.
 *
 * `getByText` LÈVE SI ELLE MANQUE, et c'est ce qui sauve les assertions
 * négatives plus bas : un conteneur introuvable rendrait vraie toute négation
 * sur son contenu — la faute que ce dépôt a déjà payée sous le nom « cas
 * négatif, vert à vide ».
 */
const sousTitre = () =>
  screen.getByText(/Le statut porte sur le mois affiché/).textContent ?? ''

const reculerDUnMois = () =>
  userEvent.setup().click(screen.getByRole('button', { name: 'Mois précédent' }))

describe('le sous-titre du parc compte ce que l’écran montre', () => {
  it('dit que le mois affiché n’en porte AUCUNE quand il est vide', async () => {
    parcDontLeMoisPrecedentPorte([])
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    await reculerDUnMois()

    /* L'ÉCRAN A RENDU SON VERDICT, et on l'attend avant de lire le sous-titre :
       sans ce point d'ancrage, l'assertion porterait sur le mois qu'on vient de
       quitter — la relecture est asynchrone, et `aria-busy` laisse l'ancienne
       table en place le temps qu'elle revienne.

       `· aucun logement` ET NON L'ÉTAT VIDE. Un premier jet attendait « Aucun
       logement pour l'instant » et a rendu rouge pour la mauvaise raison : à
       zéro ligne, `groupePar.ordre` fait quand même paraître l'en-tête de chaque
       immeuble — décision écrite du lot des modales, « c'est le seul endroit d'où
       l'on peut encore les corriger » — si bien que le `empty` du `DataTable`
       n'est jamais atteint tant qu'un immeuble existe. C'est l'en-tête qui porte
       le verdict, et c'est LUI que le sous-titre contredit. */
    expect(
      await screen.findByText(/· aucun logement/),
      'l’en-tête de l’immeuble doit dire que le mois affiché n’en porte aucun',
    ).toBeInTheDocument()

    expect(sousTitre()).toMatch(/aucune sur ce mois/)

    /* LA NÉGATION PORTE SUR LA FORME EXACTE DU MENSONGE, et non sur « 3 unités ».
       La taille du parc RESTE annoncée — c'est l'énoncé voulu, « 3 unités, aucune
       sur ce mois » : un parc de trois logements dont ce mois n'en appelait aucun
       n'est pas un parc vide, et ce sous-titre est le seul endroit de l'écran qui
       porte sa taille. Ce qui est refusé est le compte annoncé SANS RÉSERVE, qui
       est littéralement « … unités. Le statut porte … » — la chaîne que le code
       fautif rendait. Un premier jet refusait « 3 unités » tout court et aurait
       condamné le remède en même temps que le défaut. */
    expect(
      sousTitre(),
      'le compte ne doit plus s’annoncer sans réserve sur un mois qu’il ne décrit pas',
    ).not.toMatch(/unités\. Le statut/)
  })

  it('annonce les trois unités SANS réserve quand le mois les porte toutes', async () => {
    /* GARDE DU GARDE. Sans ce cas, le précédent serait satisfait par un
       sous-titre qui dirait « aucune sur ce mois » même au mois plein. */
    parcDontLeMoisPrecedentPorte([])
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()

    expect(sousTitre()).toMatch(/3 unités/)
    expect(sousTitre(), 'rien à réserver : le mois affiché porte tout le parc').not.toMatch(
      /sur ce mois/,
    )
  })

  it('nomme la PART du parc que le mois affiché porte', async () => {
    parcDontLeMoisPrecedentPorte(['A1'])
    await renderApp('/app/parc', { session: SESSION, largeur: 1280 })
    await attendreLeChargement()
    await reculerDUnMois()

    /* Une seule fiche rendue, et c'est elle qu'on attend : le compte du
       sous-titre doit la décrire, pas décrire les trois du mois courant. */
    expect(await screen.findByText('Locataire A1')).toBeInTheDocument()
    expect(screen.queryByText('Locataire A3')).not.toBeInTheDocument()

    expect(sousTitre()).toMatch(/3 unités/)
    expect(sousTitre(), 'la part rendue doit être nommée').toMatch(/1 sur ce mois/)
  })
})
