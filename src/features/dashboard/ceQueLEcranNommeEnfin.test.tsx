import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, switchRole, within } from '@/test/render'

/**
 * QUATRE ÉCRANS QUI SAVAIENT SANS DIRE.
 *
 * Ce fichier tient un seul défaut, pris sur quatre surfaces : une donnée
 * présente dans le composant, décisive pour qui lit l'écran, et jamais rendue.
 * Aucune n'a demandé un appel serveur — les quatre étaient déjà là.
 *
 *  1. ÉTATS DES LIEUX : « Aucun dossier · 7 » comptait sans permettre d'aller
 *     voir. La liste dessous ne rend que les logements qui ONT un dossier ; les
 *     sept manquants n'apparaissaient nulle part sur la page qui les compte.
 *  2. QUITTANCES : six lignes portaient un mois et un montant DÛ, jamais l'état
 *     de la période. Le locataire téléchargeait une quittance partiellement
 *     réglée sans que rien ne l'en avertisse.
 *  3. SIGNALER : le formulaire fait choisir « bloquant » ; la liste de ses
 *     propres signalements ne le lui rendait pas, alors que le bailleur voit
 *     cette même urgence en pastille rouge sur le même parc.
 *  4. NOTIFICATIONS : douze boutons « Ouvrir » au nom accessible identique — à
 *     la lecture d'écran, douze fois « Ouvrir, lien », sans destination.
 */

describe('ce que les écrans nomment enfin', () => {
  it('nomme les logements sans état des lieux, au lieu de seulement les compter', async () => {
    await renderApp('/demo/etats-des-lieux')
    await attendreLeChargement()

    const carte = within(screen.getByRole('main'))
      .getAllByText(/^Sans état des lieux$/)
      .map((noeud) => noeud.closest('[data-indicateur]'))
      .find((boite): boite is HTMLElement => boite !== null)
    expect(carte, 'la carte des logements sans dossier a disparu').toBeTruthy()

    const texte = carte!.textContent ?? ''
    const compte = Number(/(\d+)/.exec(texte)?.[1])
    expect(compte, 'le jeu de démonstration n’a aucun logement sans dossier').toBeGreaterThan(0)

    /* AUTANT DE LIBELLÉS QUE LE COMPTE L'ANNONCE. Un « A2, A4 » sous un « 7 »
       serait un demi-remède, et c'est le genre d'écart qu'une énumération
       tronquée introduit sans bruit. */
    const libelles = (texte.match(/[A-C]\d/g) ?? []).length
    expect(libelles, 'la note ne nomme pas tous les logements qu’elle compte').toBe(compte)
  })

  it('dit sur chaque quittance si la période est soldée', async () => {
    await renderApp('/demo/documents')
    await attendreLeChargement()

    /* LA LISTE PAR SON TITRE DE CARTE : le `<ul>` des quittances n'a pas de
       nom accessible propre — la carte le porte —, et forcer une requête par
       rôle ici mesurerait autre chose que ce lot. */
    const texte = screen.getByRole('main').textContent ?? ''

    /* LE JEU PORTE UNE PÉRIODE PARTIELLE — juin, dont l'électricité n'est
       réglée qu'à moitié. C'est le cas que la ligne taisait, et le seul qui
       prouve que l'état n'est pas une décoration toujours verte. */
    expect(texte, 'aucune quittance ne dit son état de règlement').toMatch(/Réglé|Partiel/)
    expect(texte, 'la période partiellement réglée se lit comme les autres').toContain('Partiel')

    /* LE MONTANT RESTE LE DÛ : l'état s'ajoute, il ne remplace rien. */
    expect(texte).toMatch(/\d/)
  })

  it('dit au locataire chez quel métier sa demande est partie', async () => {
    /**
     * ═══ CE QUE CE CAS MESURE, ET CE QU'IL NE PEUT PAS MESURER ═══
     *
     * Le même lot rend aussi l'URGENCE déclarée — le formulaire fait choisir
     * « bloquant », et la liste de ses propres signalements n'en montrait rien,
     * pendant que le bailleur la voit en pastille rouge sur le même parc.
     *
     * Elle n'est PAS mesurée ici, et il faut le dire plutôt que l'oublier :
     * aucun des deux signalements du locataire de démonstration n'est urgent —
     * les deux urgents appartiennent à A3 et B2, d'autres locataires. Le cas
     * serait donc vert sur une liste où la pastille ne peut pas paraître, ce
     * qui est pire qu'un cas absent. Rendre la démonstration urgente pour
     * satisfaire un test changerait l'écran du bailleur et le tableau de bord
     * pour une raison qui n'est pas la leur.
     *
     * LE MÉTIER, lui, est sur chaque ligne, et c'est l'autre moitié du même
     * geste : sur une déclaration libre — « ça coince depuis mardi » — rien ne
     * confirmait au locataire que sa demande est partie chez le serrurier
     * plutôt que chez le plombier.
     */
    await renderApp('/demo/signaler')
    await switchRole('tenant')
    await attendreLeChargement()

    const main = screen.getByRole('main')
    const ligne = within(main).getByText(/Groupe de sécurité/i).closest('li')!
    expect(
      ligne.textContent,
      'le locataire ne sait pas chez quel métier sa demande est partie',
    ).toMatch(/Plomberie/i)
  })

  it('donne à chaque bouton « Ouvrir » une destination dans son nom accessible', async () => {
    await renderApp('/demo/signalements')
    await attendreLeChargement()

    const ouvrir = within(screen.getByRole('main'))
      .getAllByRole('link')
      .filter((lien) => /^Ouvrir/.test(lien.getAttribute('aria-label') ?? ''))
    expect(ouvrir.length, 'aucun bouton d’ouverture sur la file').toBeGreaterThan(1)

    const noms = new Set(ouvrir.map((lien) => lien.getAttribute('aria-label')))
    expect(
      noms.size,
      'tous les boutons portent encore le même nom accessible',
    ).toBeGreaterThan(1)
  })
})
