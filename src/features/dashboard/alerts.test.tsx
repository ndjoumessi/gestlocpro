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

      Vu du propriétaire, aucune notification n'est FILTRÉE — mais les relances
      d'un même bail sont désormais REPLIÉES en une carte. Les deux mots ne
      disent pas la même chose, et la différence est tout l'objet du repli :
      filtrer retire, replier range. Ce que le compte doit tenir est donc « rien
      n'a disparu », et la formule le dit maintenant explicitement plutôt que de
      compter des lignes qui se trouvaient coïncider avec la donnée.

      Mesuré avant le repli : cinq entrées visibles, dont QUATRE portaient la
      même dette — la détection plus trois relances. Le devis qui attend une
      décision arrivait cinquième, enterré sous 80 % de répétition.
    */
    const relances = ALERTS.filter((a) => a.message === 'rentReminder')
    const bauxRelances = new Set(relances.map((a) => a.unitId))
    const attendu = ALERTS.length - relances.length + bauxRelances.size
    expect(directs).toHaveLength(attendu)

    /* GARDE DE LA GARDE : si le repli cessait d'opérer, `attendu` vaudrait
       `ALERTS.length` et le cas passerait au vert sur l'écran d'avant. On exige
       donc qu'il y ait bien quelque chose à replier dans le jeu. */
    expect(relances.length).toBeGreaterThan(bauxRelances.size)
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
    /*
      Le montant était « 45 000 » en clair dans la chaîne : ni symbole, ni
      groupement anglais, et insensible au changement de devise.

      LES CHIFFRES SUIVENT LA CONVERSION, pas le message. Le jeu de
      démonstration compte en francs CFA ; 45 000 francs valent 68,60 € au taux
      légal, soit 82,32 $ au cours figé du faux serveur. Ce que le cas garde —
      le symbole, sa position, la ponctuation décimale de l'anglais — est
      intact ; le groupement des milliers, lui, est tenu par `currencies.test`.

      LES CENTS SONT RÉ-ANCRÉS. Le cas assertait « $ 82 » : la forme compacte
      tronquait, et un devis de 82,32 $ s'annonçait 82 $ à celui qui doit
      l'accepter. Trente-deux cents sur un devis, c'est peu ; la même règle
      s'appliquait au solde d'une caution posé à côté de ses deux termes.
    */
    expect(screen.getByText(/\$\s?82\.32 proposed by the manager/)).toBeInTheDocument()
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

    /* LE COMPTE SE DÉRIVE DU JEU, il ne s'écrit plus à la main.
       Il a été « deux », puis « trois », puis faux : ajouter un signalement de
       locataire au jeu l'a fait passer à quatre et rougir ce cas, qui ne parle
       pourtant pas du contenu du jeu mais de l'EXTINCTION de la pastille. Le
       fichier prêche lui-même, vingt lignes plus haut, d'ancrer « sur la
       DONNÉE, et non sur le rendu » — ce cas-ci ne le faisait pas.
       On vise l'entrée « Reports » et non le nombre dans toute la barre :
       « Paiements » porte lui aussi une pastille, et l'ancienne assertion ne
       tenait que parce que les deux nombres différaient. */
    const nonLues = String(ALERTS.filter((a) => !a.read).length)
    /* LE TRAIT D'UNION CONDITIONNEL ENTRE DANS LE NOM ACCESSIBLE, et ce cas
       l'a decouvert en cassant : « Reports » porte desormais un `\u00AD` entre
       « Re » et « ports », pose pour que la barre basse coupe au bon endroit
       sous une police large. `getByRole` compare le texte calcule, ou le
       caractere est present — invisible a l'oeil, decisif pour une regex.

       On le rend donc FACULTATIF plutot que de l'ecrire en dur : ce cas parle
       d'une pastille de compteur, pas d'un point de cesure, et il ne doit pas
       redevenir rouge le jour ou le mot se coupe ailleurs. */
    const entree = () => within(nav).getByRole('link', { name: /Re\u00AD?ports/ })
    expect(entree()).toHaveTextContent(nonLues)

    await userEvent.click(screen.getByRole('button', { name: /Mark all as read/i }))

    expect(entree()).not.toHaveTextContent(nonLues)
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