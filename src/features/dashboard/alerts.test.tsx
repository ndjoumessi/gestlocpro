import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within, attendreLeChargement } from '@/test/render'
import { ALERTS } from '@/data/portfolio'

/**
 * LE CONTRAT D'ACCESSIBILITÉ, AFFIRMÉ ET NON SUBI.
 *
 * Les autres cas s'adossent à la liste sans la nommer : ils tomberaient si le
 * rôle disparaissait, mais pour une raison de plomberie — la portée ne trouve
 * plus rien. Une plomberie se réécrit ; le contrat, lui, doit avoir son propre
 * garde. C'est ici que la barre latérale trouve sa contrepartie : elle annonce
 * « n non lues », et l'écran doit pouvoir dire combien il en montre autrement
 * qu'en faisant compter des titres à l'oreille.
 */
describe('les notifications s’annoncent comme une liste', () => {
  it('se comptent et se nomment', async () => {
    await renderApp('/demo/signalements')
    await attendreLeChargement()

    const liste = screen.getByRole('list', { name: 'Signalements et notifications' })
    const directs = within(liste)
      .getAllByRole('listitem')
      .filter((el) => el.parentElement === liste)
    /*
      ANCRÉ SUR LA DONNÉE, et non sur le rendu.

      La première rédaction comparait les éléments aux TITRES qu'ils
      contiennent. C'était vrai par construction — une carte porte un titre,
      donc les deux nombres bougent ensemble — et l'assertion ne gardait rien :
      escamoter une notification la laissait verte. Le compte n'a de sens que
      rapporté à ce que le parc contient.

      Vu du propriétaire, aucune notification n'est filtrée : l'écran les montre
      toutes, et c'est précisément ce qu'on vérifie ici.
    */
    expect(directs).toHaveLength(ALERTS.length)
  })
})

/**
 * Composition des messages d'alerte.
 *
 * `title` et `detail` étaient des phrases françaises complètes stockées dans la
 * donnée — « Devis plomberie à arbitrer », « Serge Mbarga · relance J+15 partie
 * le 04/08 ». Elles s'affichaient telles quelles dans l'interface anglaise.
 *
 * Chacune figeait trois choses à la fois, et c'est ce que ces tests gardent :
 * la **langue** du message, le **format de date** — « 04/08 » est le 4 août
 * ici et le 8 avril ailleurs —, et le **formatage monétaire**, qui doit suivre
 * la devise choisie.
 */
describe('messages d’alerte', () => {
  it('rend les titres dans la langue de l’interface', async () => {
    await renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getByText(/Quote awaiting your decision/)).toBeInTheDocument()
    expect(screen.getByText(/Partial payment recorded on A5/)).toBeInTheDocument()
  })

  it('accorde en nombre plutôt que de concaténer', async () => {
    // « 2 relevés manquants » était écrit à la main, donc au pluriel même à un.
    await renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getByText(/2 readings missing/)).toBeInTheDocument()
  })

  it('nomme le mois d’une période au lieu de le figer', async () => {
    await renderApp('/app/signalements', { locale: 'en' })
    // « août » était écrit dans la chaîne ; il se calcule désormais.
    expect(screen.getByText(/August 2026 receipt available/)).toBeInTheDocument()
  })

  it('rend une date de relance non ambiguë', async () => {
    await renderApp('/app/signalements', { locale: 'en', region: 'US' })
    // « 04/08 » se lisait 4 août ici et 8 avril là. Le mois est nommé, et
    // l'ordre reste celui du pays.
    expect(screen.getByText(/reminder sent on Aug 4/)).toBeInTheDocument()
  })

  it('porte l’année sur une échéance de bail', async () => {
    await renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getByText(/expires on 30\/09\/2026/)).toBeInTheDocument()
  })

  it('formate les montants dans la devise choisie', async () => {
    await renderApp('/app/signalements', { locale: 'en', currency: 'USD' })
    // Le montant était « 45 000 » en clair dans la chaîne : ni symbole, ni
    // groupement anglais, et insensible au changement de devise.
    expect(screen.getByText(/\$\s?45,000 proposed by the manager/)).toBeInTheDocument()
  })

  it('énumère les unités avec la conjonction de la langue', async () => {
    await renderApp('/app/signalements', { locale: 'en' })
    // « A5 et C2 » était figé dans le détail de l'alerte.
    expect(screen.getByText(/A5 and C2/)).toBeInTheDocument()
  })

  it('nomme la catégorie pour les lecteurs d’écran', async () => {
    // Elle n'existait qu'en icône, et `Icon` est `aria-hidden` : la catégorie
    // était invisible à qui n'a pas l'image.
    await renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getAllByText('Meter reading').length).toBeGreaterThan(0)
  })

  /**
   * La pastille de navigation comptait « 2 » — un littéral, jamais recalculé.
   * L'état « lu » vivait dans l'écran, hors de portée de la barre latérale :
   * tout marquer comme lu laissait le compteur annoncer un travail qui n'existe
   * plus. Il est remonté dans le provider.
   */
  it('éteint la pastille de navigation quand tout est lu', async () => {
    await renderApp('/app/signalements', { locale: 'en' })
    const nav = screen.getAllByRole('navigation')[0]

    /* TROIS et non deux : le jeu porte désormais un rappel de loyer non lu, en
       plus de l'impayé et du devis en attente. C'est un compte de JEU et non un
       invariant — il doit bouger avec lui, ce que le lot des relances n'avait
       pas prévu.
       On vise l'entrée « Reports » et non le texte « 3 » dans toute la barre :
       « Paiements » porte lui aussi une pastille à 3, et l'ancienne assertion ne
       tenait que parce que les deux nombres différaient. */
    const entree = () => within(nav).getByRole('link', { name: /Reports/ })
    expect(entree()).toHaveTextContent('3')

    await userEvent.click(screen.getByRole('button', { name: /Mark all as read/i }))

    expect(entree()).not.toHaveTextContent('3')
    expect(screen.getByText('All notifications are read.')).toBeInTheDocument()
  })

  it('ne laisse aucun message porter du français en anglais', () => {
    // Garde de fond : la donnée ne doit plus contenir de phrase du tout.
    for (const alert of ALERTS) {
      expect(alert).not.toHaveProperty('title')
      expect(alert).not.toHaveProperty('detail')
    }
  })

  /**
   * L'ÉTAT « NON LUE » SE DIT, au lieu de n'être qu'une couleur.
   *
   * Il n'existait que dans un liseré — et un liseré qui, du temps où l'accent
   * de marque était l'or, ne tenait que 2,87:1, ce que la feuille de jetons
   * condamnait elle-même pour cet usage. Le bleu qui a remplacé l'or a relevé
   * ce liseré sans rien changer à ce cas-ci : une couleur, si franche
   * soit-elle, ne se prononce pas. Un lecteur d'écran parcourait donc douze
   * notifications rigoureusement identiques, sans jamais savoir lesquelles
   * restaient à traiter : la seule question qu'on se pose sur cet écran, et
   * celle dont la barre latérale annonce le compte juste à côté.
   */
  it('dit lesquelles restent à lire, et pas seulement en couleur', async () => {
    await renderApp('/demo/signalements')
    await attendreLeChargement()

    const liste = screen.getByRole('list', { name: 'Signalements et notifications' })
    const nonLues = ALERTS.filter((a) => !a.read).length
    expect(nonLues).toBeGreaterThan(0)

    // Autant de mentions que de notifications non lues dans la donnée : ni une
    // par carte — ce qui ne distinguerait rien — ni une seule pour tout l'écran.
    expect(within(liste).getAllByText('Non lue')).toHaveLength(nonLues)
  })
})