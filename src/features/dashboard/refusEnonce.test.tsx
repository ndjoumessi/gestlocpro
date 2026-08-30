import { describe, expect, it } from 'vitest'
import {
  renderApp,
  screen,
  attendreLeChargement,
  switchRole,
  userEvent,
  within,
} from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'

/**
 * DEUX BOUTONS ÉTEINTS ET MUETS.
 *
 * Un relevé de tous les `disabled` du produit en a rendu huit. Six sont
 * ACCEPTABLES : l'écran énonce ailleurs ce qui manque — aucune unité vacante,
 * aucun immeuble, la limite de photos atteinte, un tableau vide, une pièce en
 * cours de composition. Le contrôle est éteint ET la raison est écrite.
 *
 * Les deux qui suivent n'écrivent rien. C'est le défaut corrigé sur
 * l'inscription au lot précédent, et son commentaire vaut ici : « un bouton
 * principal qui paraît inerte est la pire des pannes : il n'y a rien à lire,
 * donc rien à corriger ».
 */

/**
 * ═══ « DEMANDER UNE PIÈCE », ÉTEINT DÈS L'ARRIVÉE ═══
 *
 * Le locataire arrive sur ses documents : le bouton est déjà mort, avant tout
 * geste. Et le groupe de choix au-dessus porte `hideLegend`, donc même son
 * intitulé est masqué — rien à l'écran ne relie l'extinction au fait qu'il
 * faut d'abord désigner une pièce.
 */
describe('la demande de pièce', () => {
  async function ouvrir() {
    installerFauxServeur()
    const utilisateur = userEvent.setup()
    await renderApp('/demo/documents')
    await attendreLeChargement()
    /* L'écran est celui du LOCATAIRE : le bailleur n'y demande rien. */
    await switchRole('tenant')
    await attendreLeChargement()
    /* Le formulaire, et non la page : la barre latérale porte trois radios de
       PROFIL, qui répondraient les premiers à une recherche par rôle. */
    return { utilisateur, formulaire: screen.getByRole('main') }
  }

  it('reste cliquable et dit ce qui manque', async () => {
    const { utilisateur, formulaire } = await ouvrir()

    const envoyer = within(formulaire).getByRole('button', { name: /Envoyer la demande/ })
    expect(envoyer, 'le bouton est encore éteint').toBeEnabled()

    await utilisateur.click(envoyer)

    const alertes = await screen.findAllByRole('alert')
    expect(
      alertes.some((a) => /pièce/i.test(a.textContent ?? '')),
      'le refus ne s’écrit nulle part',
    ).toBe(true)
  })

  /**
   * LE CONTREPOIDS. Une pièce choisie, la demande part.
   *
   * Un refus qui ne se lève jamais serait pire que le bouton éteint.
   */
  it('laisse partir la demande dès qu’une pièce est choisie', async () => {
    const { utilisateur, formulaire } = await ouvrir()

    /* PAS LE PREMIER VENU : une pièce déjà demandée et sans réponse est
       DÉSACTIVÉE — le serveur la refuse, et le choix le dit avant le clic. La
       démonstration en porte une. */
    const libre = within(formulaire)
      .getAllByRole('radio')
      .find((r) => !(r as HTMLInputElement).disabled)
    expect(libre, 'aucune pièce demandable dans la démonstration').toBeDefined()
    await utilisateur.click(libre!)
    await utilisateur.click(within(formulaire).getByRole('button', { name: /Envoyer la demande/ }))

    expect(await screen.findByText(/Demande envoyée/i)).toBeInTheDocument()
  })
})

/**
 * ═══ « REJOINDRE UN PARC », ÉTEINT PAR UNE BORNE MUETTE ═══
 *
 * Le bouton mourait tant que le code d'invitation n'avait pas la forme exacte.
 * La borne est juste — `validateInviteCode` connaît le gabarit, préfixe
 * compris — mais elle ne parlait pas : l'erreur du champ n'était posée
 * qu'APRÈS un refus SERVEUR. On tapait un code incomplet, le bouton mourait, et
 * rien ne disait pourquoi. Le `placeholder` suggérait bien un gabarit, et il
 * disparaît à la première frappe : au moment précis où l'on en aurait besoin.
 */
describe('l’adhésion par code', () => {
  /**
   * UN COMPTE SANS PARC, et il le faut : `RejoindreUnParc` rend `null` dès
   * qu'on appartient à un parc, donc la démonstration ne l'affiche jamais. Le
   * cas est CONSTRUIT, comme celui de la caution unique.
   */
  async function ouvrir() {
    installerFauxServeur()
    const utilisateur = userEvent.setup()
    await renderApp('/app/prise-en-main', {
      session: { statut: 'connecte', compte: COMPTE_FICTIF, adhesions: [] },
    })
    await attendreLeChargement()
    return utilisateur
  }

  it('dit ce qui cloche dans le code au lieu d’éteindre le bouton', async () => {
    const utilisateur = await ouvrir()

    const champ = screen.getByRole('textbox', { name: /Code d’invitation/i })
    await utilisateur.type(champ, 'LOC-4A7B')

    const rejoindre = screen.getByRole('button', { name: /Rejoindre/ })
    expect(rejoindre, 'le bouton est encore éteint').toBeEnabled()

    await utilisateur.click(rejoindre)

    const alertes = await screen.findAllByRole('alert')
    expect(
      alertes.some((a) => /code/i.test(a.textContent ?? '')),
      'la borne locale ne dit toujours rien',
    ).toBe(true)
  })

  /**
   * LE CONTREPOIDS. Un code vide ne part pas non plus.
   *
   * Rendre le bouton vivant sans garder la borne enverrait au serveur des
   * codes qu'on sait mauvais — un aller-retour dont la réponse est connue,
   * exactement ce que le commentaire d'origine refusait.
   */
  it('ne part pas sur un champ vide', async () => {
    const utilisateur = await ouvrir()

    await utilisateur.click(screen.getByRole('button', { name: /Rejoindre/ }))

    const alertes = await screen.findAllByRole('alert')
    expect(alertes.length, 'un code vide est parti sans un mot').toBeGreaterThan(0)
  })
})
