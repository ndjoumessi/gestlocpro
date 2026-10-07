import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import {
  DEPOSITS as DEPOSITS_DEMO,
  READINGS as READINGS_DEMO,
  UNITS as UNITS_DEMO,
  WORKS as WORKS_DEMO,
} from '@/data/portfolio'
import { VERSION_STOCKAGE, loadState } from './persistence'

/**
 * LA TROISIÈME VOIE VERS DES RELEVÉS ORPHELINS : LA DÉRIVE DE LA FIXTURE.
 *
 * Deux voies vers « Logement inconnu » sur `/demo/releves` sont déjà fermées, et
 * toutes deux parlaient d'un parc RÉEL qui s'invitait dans la démonstration : la
 * PROVENANCE de l'enregistrement, puis son ANCRAGE dans les immeubles du jeu.
 * Celle-ci n'a pas besoin du moindre parc réel, et c'est ce qui la rend
 * différente — elle s'ouvre toute seule, avec le TEMPS.
 *
 * `EtatPersiste` enregistre `units`, `works` et `deposits`. Il n'enregistre PAS
 * `readings` : le fournisseur sème ses relevés depuis `READINGS_DEMO` en dur, à
 * chaque chargement, et aucun chemin ne les repose jamais depuis la clé. Deux
 * collections qui se référencent par `unitId`, dont une seule est enregistrée.
 *
 * TOUTE DÉRIVE ENTRE LES DEUX ORPHELINE DES RELEVÉS. Le jour où `UNITS_DEMO`
 * gagne un logement et `READINGS_DEMO` son relevé, le visiteur qui revient relit
 * ses ANCIENNES unités sous les NOUVEAUX relevés, et l'écran nomme ce qu'il ne
 * sait pas rattacher. Rien ne l'arrête en chemin :
 *
 *   - la provenance est bonne — l'enregistrement a été écrit par la
 *     démonstration elle-même, jamais par un serveur ;
 *   - l'ancrage tient — ces unités sont celles du jeu, avec leurs `buildingId`
 *     de démonstration ;
 *   - `formeValide` passe — la FORME n'a pas changé, seul le CONTENU ;
 *   - `VERSION` n'a aucune raison de bouger, pour la même raison, et
 *     `persistenceVersion.test.ts` le dit en propres termes : il garde « que la
 *     forme ne change jamais EN SILENCE », pas le contenu.
 *
 * ET LES GESTES ORDINAIRES ÉCRIVENT BIEN CETTE CLÉ : sondé au volet navigateur
 * le 2026-10-07, un clic sur « Valider le devis » depuis `/demo/travaux` fait
 * passer `gestlocpro.portfolio` d'absente à présente. Il suffit donc d'avoir
 * touché à la démonstration un jour, puis d'y revenir après un remaniement du
 * jeu — ce qui est le parcours NORMAL d'un visiteur qui repasse.
 *
 * ═══ LE TÉMOIN : CE QUE CES DEUX CAS RENDENT SANS LA SERRURE ═══
 *
 * Le premier cas est né ROUGE sur le code d'avant le remède, et le relevé est
 * reproduit ci-dessous : on retire de `loadState` le bloc
 * `if (!coherentAvecLesReleves(…))` et on relance les deux.
 *
 *   SANS la serrure — sortie 1
 *     × ne laisse aucun relevé sans son logement sur `/demo/releves`
 *       AssertionError: expected […] to have a length of +0 but got 2
 *       à la ligne du `queryAllByText('Logement inconnu')`
 *     ✓ garde un parcours dont les unités portent bien tous les relevés
 *
 *   AVEC la serrure — sortie 0 : les deux cas passent.
 *
 * DEUX CHOSES À LIRE DANS CE RELEVÉ, et la seconde est la plus importante.
 *
 * D'abord, le rouge tombe sur la NÉGATION et non sur le compte de rangées : les
 * dix relevés étaient bien rendus au moment où deux d'entre eux ne trouvaient
 * personne. Le cas ne rougit donc pas par vacuité, il rougit sur le défaut.
 *
 * Ensuite, le second cas est VERT DES DEUX CÔTÉS, et c'est exactement sa
 * fonction : il ne garde pas contre le défaut, il garde contre le REMÈDE. Un
 * refus trop large passerait le premier cas en jetant tout, et c'est lui qui
 * l'attraperait. On ne peut donc pas le mesurer en retirant la serrure — il faut
 * la rendre FAUSSEMENT SÉVÈRE. Mesuré : `ancreDansLaDemonstration` forcée à
 * `return false` le fait rougir (« expected 'quoted' to be 'approved' ») tandis
 * que le premier cas reste vert. Les deux ensemble bornent le remède des deux
 * côtés — l'un interdit d'en faire trop peu, l'autre d'en faire trop.
 */

/**
 * L'ENREGISTREMENT D'HIER : le même jeu, moins les deux dernières unités que les
 * relevés référencent.
 *
 * Il est DÉRIVÉ des modules et non recopié. Recopier douze unités à la main
 * donnerait un enregistrement qui vieillit à part du jeu, et ce cas éprouve
 * précisément ce que la divergence coûte — l'écrire en divergeant déjà le
 * rendrait illisible le jour où il rougit.
 *
 * Les deux unités retirées sont prises dans `READINGS_DEMO`, et c'est le point :
 * une unité que personne ne relève (`B4`, `C3`, vacantes) pourrait disparaître de
 * l'enregistrement sans orpheliner quoi que ce soit. La dérive ne se mesure que
 * sur l'intersection des deux collections.
 */
const RETIREES = READINGS_DEMO.slice(-2).map((releve) => releve.unitId)
const UNITES_DHIER = UNITS_DEMO.filter((unite) => !RETIREES.includes(unite.id))

/**
 * Écrit la clé comme la démonstration l'écrit : même enveloppe, même version.
 *
 * Passer par `saveState` serait plus court, mais ce cas doit pouvoir enregistrer
 * un état que le code de production REFUSERAIT d'enregistrer un jour — c'est son
 * objet. On écrit donc l'enveloppe à la main, à l'identique.
 */
function enregistrerLeParcoursDHier(etat: {
  units: typeof UNITS_DEMO
  works: typeof WORKS_DEMO
  deposits: typeof DEPOSITS_DEMO
}) {
  window.localStorage.setItem(
    'gestlocpro.portfolio',
    JSON.stringify({ version: VERSION_STOCKAGE, etat }),
  )
}

describe('un enregistrement en retard sur le jeu de relevés', () => {
  it('ne laisse aucun relevé sans son logement sur `/demo/releves`', async () => {
    /* Les deux unités manquent, le reste est intact : ni parc réel, ni immeuble
       étranger, ni champ absent. Seul le CONTENU a pris du retard. */
    enregistrerLeParcoursDHier({
      units: UNITES_DHIER,
      works: WORKS_DEMO,
      deposits: DEPOSITS_DEMO,
    })

    await renderApp('/demo/releves')
    await attendreLeChargement()

    /*
      L'AFFIRMATION POSITIVE D'ABORD, et elle n'est pas une formalité : deux
      gardes de ce dossier ont déjà été vraies par VACUITÉ, parce qu'un conteneur
      vide rend vraie toute négation sur son contenu. « Aucun logement inconnu »
      serait donc satisfait par un écran qui ne rendrait AUCUN relevé — y compris
      par un remède qui les filtrerait à l'affichage, ce qu'on ne veut pas.

      On exige le compte, et on le tient de `READINGS_DEMO` : c'est ce module qui
      décide combien de relevés la période porte, et le lire ici évite d'inscrire
      un dix qui vieillirait en silence.
    */
    const lignes = screen.getByRole('main').querySelectorAll('tbody tr')
    expect(lignes, 'tous les relevés de la période doivent être rendus').toHaveLength(
      READINGS_DEMO.length,
    )

    /* « Logement inconnu » est le NOM que le lot du symptôme a donné au manque.
       Deux unités retirées de l'enregistrement, donc deux relevés qui ne
       trouvent plus personne — et sur la démonstration, où les deux collections
       sortent du même module, ce nom ne doit jamais paraître. */
    expect(screen.queryAllByText('Logement inconnu')).toHaveLength(0)
  })

  /**
   * LE PENDANT, et il garde le remède contre lui-même.
   *
   * Refuser un enregistrement incohérent coûte un parcours : la clé est
   * supprimée, et le devis validé la minute d'avant disparaît. Ce cas exige donc
   * qu'un enregistrement COHÉRENT, lui, survive — sans quoi le remède aurait le
   * droit de tout jeter, ce qui le rendrait trivialement vert.
   *
   * Il naît VERT, et le dit : seule une mutation le fait rougir. Rendre
   * `coherentAvecLesReleves` faussement sévère — `return false` — le fait
   * basculer, là où le cas ci-dessus reste vert. Les deux ensemble bornent le
   * remède des deux côtés.
   */
  it('garde un parcours dont les unités portent bien tous les relevés', () => {
    /* Le parcours d'un visiteur ordinaire : le jeu complet, un devis validé. */
    const parcours = {
      units: UNITS_DEMO,
      works: WORKS_DEMO.map((travail, index) =>
        index === 0 ? { ...travail, status: 'approved' as const } : travail,
      ),
      deposits: DEPOSITS_DEMO,
    }
    enregistrerLeParcoursDHier(parcours)

    const relu = loadState()

    expect(relu.units).toHaveLength(UNITS_DEMO.length)
    expect(
      relu.works[0]?.status,
      'un enregistrement cohérent doit garder le parcours, devis validé compris',
    ).toBe('approved')
    expect(
      window.localStorage.getItem('gestlocpro.portfolio'),
      'un enregistrement cohérent ne doit pas être supprimé',
    ).not.toBeNull()
  })
})
