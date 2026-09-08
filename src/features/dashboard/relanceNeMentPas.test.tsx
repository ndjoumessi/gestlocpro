import { describe, expect, it } from 'vitest'
import {
  attendreLeChargement,
  cliquerAction,
  renderApp,
  screen,
  userEvent,
  within,
} from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { PARK, SESSION_AVEC_PARC, portefeuille } from '@/api/noTechnicalIds.test'

/**
 * « TOUS ONT DÉJÀ ÉTÉ RELANCÉS AUJOURD'HUI » EST UNE RAISON INVENTÉE.
 *
 * Trouvé par INVENTAIRE, et c'est la différence avec `callRent` : celui-là, on
 * l'a vu mentir en production. Celui-ci, on est allé le chercher — le lot
 * précédent s'est fermé sur « les autres gestes qui rendent un nombre n'ont pas
 * été relus », et cette relecture a rendu exactement une prise.
 *
 * ═══ CE QUE L'INVENTAIRE A CLASSÉ ═══
 *
 * Les gestes de `PortfolioProvider` se répartissent en trois familles, et deux
 * sont saines :
 *
 *   — LA DÉMONSTRATION FAIT LE GESTE, localement : ajouter un immeuble, chiffrer
 *     un devis, retirer un logement. Elle rend `true` et c'est vrai.
 *   — ELLE NE PEUT PAS, ET LE DIT : `recordReading` rend une erreur avec son
 *     motif écrit — « la démonstration n'écrit rien, et le dire vaut mieux
 *     qu'un bouton qui s'enfonce sans effet ».
 *   — ELLE NE PEUT PAS, ET REND UN NOMBRE NEUTRE : c'est ici que le mensonge
 *     naît. `callRent` en était ; `remindRent` en est.
 *
 * ═══ PIRE QUE `callRent`, ET IL FAUT LE DIRE ═══
 *
 * `callRent` disait « déjà appelés » — faux, mais laconique. Celui-ci va plus
 * loin : « Aucune relance : tous ont déjà été relancés AUJOURD'HUI ». Il
 * n'annonce pas seulement un état, il en donne la RAISON — une raison qu'aucun
 * serveur n'a fournie, et qui est fabriquée par l'écran.
 *
 * Et l'enjeu est du courrier réel. Une relance part vers le locataire ; un
 * bailleur informé que « tous ont déjà été relancés » ne recliquera pas, et
 * personne ne saura que rien n'est parti.
 *
 * Le fournisseur avait pourtant vu la moitié du problème — il rend zéro plutôt
 * que le nombre demandé, avec ce motif : « annoncer un envoi après un échec
 * réseau est précisément le mensonge qu'on retire du produit ». Il a protégé
 * le COMPTE ; l'appelant a inventé la CAUSE.
 */

/**
 * Ouvre la modale de relance et confirme.
 *
 * `cliquerAction` et non un clic direct : l'en-tête replie ses commandes selon
 * la largeur, et le harnais sait où la trouver dans les deux formes — c'est le
 * geste que tous les cas de modale de ce dépôt emploient.
 */
async function relancer() {
  await cliquerAction(/Relancer les retards/)
  /* `alertdialog` ET NON `dialog` : cette modale engage un ENVOI réel vers des
     locataires, et le produit lui donne le rôle qui le dit. Chercher `dialog`
     ne la trouve pas — et c'est la modale qui a raison. */
  const modale = await screen.findByRole('alertdialog')
  const user = userEvent.setup()
  const confirmer = within(modale)
    .getAllByRole('button')
    /* La commande s'appelle « Confirmer », pas « Relancer » : le titre porte
       déjà la question — « Relancer 3 locataires en retard ? » — et le bouton
       n'a qu'à y répondre. */
    .find((b) => /Confirmer|Confirm/i.test(b.textContent ?? ''))
  expect(confirmer, 'la modale doit porter sa commande de confirmation').toBeDefined()
  await user.click(confirmer!)
}

describe('la relance ne ment pas sur ce qu’elle a fait', () => {
  it('n’invente pas « déjà relancés aujourd’hui » en démonstration', async () => {
    await renderApp('/demo/paiements')
    await attendreLeChargement()
    await relancer()

    expect(
      screen.queryByText(/déjà été relancés|already been chased/i),
      'la démonstration n’a relancé personne : elle ne peut pas dire qu’ils l’ont déjà été',
    ).toBeNull()
  })

  it('n’invente pas « déjà relancés aujourd’hui » quand la requête échoue', async () => {
    /*
      LE CAS QUI VAUT LE FICHIER, et il porte du courrier réel : un bailleur
      qui lit « tous ont déjà été relancés » après un échec réseau ne
      recliquera pas, et ses locataires en retard n'entendront rien.
    */
    const serveur = installerFauxServeur()
    serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: portefeuille() })
    serveur.quand('POST', `/parks/${PARK}/reminders`, {
      status: 500,
      body: { error: 'server_error' },
    })

    await renderApp('/app/paiements', { session: SESSION_AVEC_PARC })
    await attendreLeChargement()
    await relancer()

    expect(
      screen.queryByText(/déjà été relancés|already been chased/i),
      'un échec présenté comme « déjà fait » fait taire les relances du mois',
    ).toBeNull()
  })
})
