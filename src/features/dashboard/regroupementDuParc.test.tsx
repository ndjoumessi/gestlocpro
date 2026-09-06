import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * SUR UN TÉLÉPHONE, LE PARC SE GROUPE PAR IMMEUBLE.
 *
 * ═══ CE QUE L'ÉCRAN COÛTE, MESURÉ AU NAVIGATEUR ═══
 *
 * `/demo/parc` fait 4 313 px de haut à 375 px — SIX ÉCRANS ET DEMI de
 * défilement — contre 1 757 px à 1280, soit deux. Le défaut est un défaut de
 * téléphone, et c'est le marché de ce produit.
 *
 * Où passent ces pixels, relevé le 2026-09-05 :
 *
 *     193 px   en-tête, titre, deux boutons
 *     641 px   quatre cartes d'indicateur          15 %
 *     156 px   recherche et filtres
 *   3 025 px   douze fiches de logement, 245 px pièce   70 %
 *
 * ═══ L'IMMEUBLE EST ÉCRIT TROIS FOIS ═══
 *
 * « Bonamoussadi » paraît DOUZE fois sur cet écran : en grande carte, en bouton
 * de filtre, et sur chacune des douze fiches — sur deux lignes, pour trois
 * immeubles distincts. Chaque fiche paie 43 px pour redire ce que la carte du
 * haut vient de dire.
 *
 * Grouper hisse le nom dans un EN-TÊTE DE GROUPE : trois occurrences au lieu de
 * douze, et la ligne quitte les fiches.
 *
 * ═══ ET LES CARTES NE COMPARENT RIEN SUR UN TÉLÉPHONE ═══
 *
 * Le lot qui a posé les barres d'occupation dit pourquoi elles valent : « la
 * grille aligne les cartes, donc les barres partagent origine et longueur : le
 * classement se lit en travers ». C'est vrai — au-dessus de `sm`, où la grille
 * a deux ou quatre colonnes.
 *
 * Sous `sm` elle n'en a qu'UNE : les barres s'empilent, ne partagent plus
 * d'origine, et le classement ne se lit plus en travers de rien. Elles coûtent
 * 641 px pour une comparaison que la mise en page rend impossible. Elles
 * deviennent donc les EN-TÊTES DE GROUPE, où la même barre situe l'immeuble
 * qu'on est en train de lire.
 *
 * LE BUREAU NE BOUGE PAS. À 1280 la comparaison fonctionne, le tableau tient en
 * deux écrans, et l'immeuble est une colonne : rien de ce lot ne s'y applique.
 */
describe('le parc sur un téléphone', () => {
  const ouvrir = async () => {
    installerFauxServeur()
    await renderApp('/demo/parc', { largeur: 360 })
    await attendreLeChargement()
  }

  it('nomme chaque immeuble UNE fois, et non une fois par logement', async () => {
    await ouvrir()

    /* Trois immeubles, douze logements : le nom paraissait DOUZE fois dans la
       liste, une par fiche.

       LE COMPTE PORTE SUR LA LISTE, PAS SUR L'ÉCRAN. Le bouton de FILTRE le
       nomme aussi, et c'est légitime — un filtre est de la navigation, pas la
       répétition d'un contenu. Compter l'écran entier ferait rougir ce cas pour
       une occurrence qu'on veut garder, et une garde qui refuse ce qu'elle
       devrait accepter finit désactivée. */
    const entetes = Array.from(document.querySelectorAll<HTMLElement>('[data-groupe]'))
    expect(entetes.length, 'trois immeubles, trois en-têtes').toBe(3)
    expect(
      entetes.filter((e) => /Résidence Bonamoussadi/.test(e.textContent ?? '')).length,
    ).toBe(1)

    const fiches = Array.from(document.querySelectorAll<HTMLElement>('[data-fiche]'))
    expect(fiches.length, 'les douze logements sont toujours là').toBe(12)
    expect(
      fiches.filter((f) => /Résidence Bonamoussadi/.test(f.textContent ?? '')).length,
      'le nom de l’immeuble ne doit plus paraître sur AUCUNE fiche',
    ).toBe(0)
  })

  it('porte le rapport d’occupation ET sa barre dans l’en-tête de groupe', async () => {
    /* Le lot des barres n'est pas défait, il est DÉPLACÉ : la barre suit le nom
       là où le nom va. La perdre en chemin retirerait au téléphone la seule
       lecture de tension qui lui reste. */
    await ouvrir()

    /* `data-groupe` ET NON `role="group"` : deux groupes portent déjà ce rôle
       sur cet écran — le sélecteur de profil de la démonstration et le FILTRE
       par immeuble, littéralement nommé « Immeuble ». Compter les rôles
       compterait ceux-là. Le dépôt marque ce qu'il veut interroger par un
       attribut de données : `data-indicateur`, `data-intitule`, `data-defilant`
       le font déjà. */
    const entetes = Array.from(document.querySelectorAll<HTMLElement>('[data-groupe]'))
    expect(entetes.length).toBe(3)
    const bonamoussadi = entetes.find((e) => /Bonamoussadi/.test(e.textContent ?? ''))
    expect(bonamoussadi, 'aucun en-tête de groupe pour Bonamoussadi').toBeDefined()
    expect(within(bonamoussadi!).getByText('5/5')).toBeInTheDocument()
    expect(within(bonamoussadi!).getByRole('progressbar')).toBeInTheDocument()
  })

  it('retire la ligne « Immeuble » des fiches', async () => {
    /* 43 px par fiche, douze fois, pour redire ce que l'en-tête du groupe dit
       déjà trois lignes plus haut. */
    await ouvrir()

    const fiches = screen.getAllByRole('listitem')
    const avecImmeuble = fiches.filter((f) => /Immeuble/.test(f.textContent ?? ''))
    expect(avecImmeuble.length).toBe(0)
  })

  /**
   * UN IMMEUBLE SANS LOGEMENT GARDE SON EN-TÊTE, ET SES DEUX GESTES.
   *
   * Le premier jet de ce lot déduisait les groupes des LIGNES : un immeuble sans
   * logement n'en produisait aucune, donc aucun groupe, donc aucun en-tête — et
   * plus aucun moyen de le voir, de le corriger ni de le retirer sur un
   * téléphone, les cartes étant parties.
   *
   * `modales` l'a refusé en une phrase : « DeleteBuilding@360 : le bouton qui
   * l'ouvre est introuvable ». Le dépôt avait DÉJÀ payé ce défaut une fois du
   * côté des cartes — « un parc d'un immeuble SANS logement perdait alors sa
   * carte, et avec elle le seul bouton qui permette de retirer un immeuble créé
   * par faute de frappe ».
   *
   * Le cas suit le chemin RÉEL, comme `modales` : déclarer un immeuble, puis se
   * raviser. C'est exactement ce que cette issue existe pour servir.
   */
  it('garde son en-tête et ses gestes sur un immeuble SANS logement', async () => {
    await ouvrir()
    const utilisateur = userEvent.setup()

    await utilisateur.click(screen.getByRole('button', { name: /^Ajouter un immeuble$/ }))
    const modale = await screen.findByRole('dialog')
    /* Les libellés portent leur mention d'obligation — « Quartier* (obligatoire) » —
       et le motif doit en tenir compte : `/^Quartier$/` ne trouve rien. */
    await utilisateur.type(within(modale).getByLabelText(/Nom de l’immeuble/), 'Villa Ravisée')
    await utilisateur.type(within(modale).getByLabelText(/^Quartier/), 'Bastos')
    await utilisateur.click(within(modale).getByRole('button', { name: /Enregistrer|Ajouter/ }))

    const entetes = Array.from(document.querySelectorAll<HTMLElement>('[data-groupe]'))
    const vide = entetes.find((e) => /Villa Ravisée/.test(e.textContent ?? ''))
    expect(vide, 'l’immeuble sans logement a perdu son en-tête').toBeDefined()
    expect(within(vide!).getByText('0/0')).toBeInTheDocument()
    expect(
      within(vide!).getByRole('button', { name: /Supprimer l’immeuble Villa Ravisée/ }),
      'le seul chemin pour défaire une faute de frappe',
    ).toBeInTheDocument()
  })

  it('N’EMPILE PLUS les quatre cartes d’indicateur', async () => {
    /* 641 px, et une comparaison que la colonne unique rend impossible. */
    await ouvrir()

    /* `data-indicateur` est le marqueur que `StatCard` pose déjà — voir son
       commentaire : « la tuile doit être INTERROGEABLE sans passer par sa
       peinture ». */
    expect(document.querySelectorAll('[data-indicateur]').length).toBe(0)
  })
})

/**
 * LE BUREAU A BOUGÉ À SON TOUR — ET CES CAS DISENT VERS QUOI.
 *
 * ═══ CE QU'ILS DISAIENT AVANT, ET POURQUOI ILS LE DISAIENT ═══
 *
 * Ils tenaient l'INVARIANCE du bureau : quatre cartes, un seul tableau, la
 * colonne « Immeuble », aucun groupe. C'était une CLÔTURE DE NON-RÉGRESSION,
 * posée pour prouver que le lot des fiches ne fuyait pas hors du téléphone —
 * pas un engagement à garder cette forme.
 *
 * La clôture a fait son travail. Le bureau change maintenant DÉLIBÉRÉMENT, et
 * ces cas décrivent la forme neuve au lieu de défendre l'ancienne.
 *
 * ═══ CE QUE LE BUREAU EST DEVENU ═══
 *
 * Le parc énumérait ses immeubles TROIS fois sur le même écran : en cartes, en
 * pastilles de filtre, et dans une colonne redite à chaque ligne. Il ne les
 * énumère plus qu'une : en en-têtes de groupe, qui portent le nom, le rapport,
 * la barre et les gestes.
 *
 * Le groupement d'un tableau était refusé par `DataTable` en ces termes —
 * « grouper y ajouterait des rangées d'en-tête pour redire ce qu'une colonne dit
 * sans place ». L'argument tenait tant que la colonne RESTAIT ; la primitive
 * l'ôte désormais, des deux côtés, et c'est ce que le troisième cas vérifie.
 *
 * ET LE TAUX DU PARC EST SORTI DE LA GRILLE : un agrégat rangé parmi ses parties
 * se lit comme une partie de plus. Il reste UN indicateur au-dessus de la liste.
 */
describe('le parc sur un écran large', () => {
  const ouvrir = async () => {
    installerFauxServeur()
    await renderApp('/demo/parc', { largeur: 1280 })
    await attendreLeChargement()
  }

  it('ne garde qu’UN indicateur : l’agrégat, au-dessus de la liste', async () => {
    await ouvrir()
    const indicateurs = document.querySelectorAll('[data-indicateur]')
    expect(indicateurs.length, 'le taux du parc, et lui seul').toBe(1)
    expect(indicateurs[0]!.textContent).toContain('83')
  })

  it('groupe son tableau par immeuble, un en-tête par immeuble', async () => {
    await ouvrir()
    expect(screen.getAllByRole('table').length).toBe(1)

    /* TROIS EN-TÊTES POUR TROIS IMMEUBLES — le compte vient du jeu de
       démonstration, et c'est lui qui rougit si un immeuble perd son bloc. */
    const enTetes = document.querySelectorAll('[data-groupe]')
    expect(enTetes.length).toBe(3)
    expect(Array.from(enTetes).map((e) => e.querySelector('h3')?.textContent)).toEqual([
      'Résidence Bonamoussadi',
      'Immeuble Akwa Nord',
      'Villa Deïdo',
    ])
  })

  it('retire la colonne « Immeuble », que l’en-tête porte désormais', async () => {
    await ouvrir()
    /*
      LA MOITIÉ QUI REND LE GROUPEMENT HONNÊTE. Un tableau groupé QUI GARDE sa
      colonne redit la catégorie à chaque ligne ET en tête de chaque bloc — une
      répétition de plus, pas une de moins. C'est l'objection que `DataTable`
      opposait au groupement, et le seul cas qui vérifie qu'elle est levée.
    */
    expect(screen.queryByRole('columnheader', { name: /Immeuble/ })).not.toBeInTheDocument()

    // Le nom n'est plus écrit qu'une fois par immeuble, en en-tête — et non
    // plus une fois par logement.
    const dansLaTable = screen.getAllByText('Résidence Bonamoussadi')
    expect(dansLaTable, 'le nom une seule fois, en tête de son bloc').toHaveLength(1)
  })

  it('n’énumère plus les immeubles en pastilles de filtre', async () => {
    await ouvrir()
    /* La troisième énumération. Elle faisait double emploi avec les en-têtes,
       et le filtre était devenu FAUX : `ordre` déclarant tous les immeubles, un
       filtre actif ne les retirait pas, il les vidait — deux en-têtes suivis de
       rien au milieu de la liste. */
    expect(screen.queryByRole('group', { name: /Immeuble/i })).not.toBeInTheDocument()
  })
})
