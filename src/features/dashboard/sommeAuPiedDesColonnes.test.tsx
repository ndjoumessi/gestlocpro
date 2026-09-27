import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, switchRole, userEvent, within } from '@/test/render'

/**
 * CINQ TABLEAUX D'ARGENT DONT AUCUN NE SOMMAIT SA COLONNE.
 *
 * ═══ CE QUI MANQUAIT, ET POURQUOI ÇA NE SE VOYAIT PAS ═══
 *
 * Les cinq écrans offraient bien leurs totaux — en cartes d'indicateur, tout en
 * haut de la page. Tant qu'un tableau montre TOUTES ses lignes, les deux nombres
 * coïncident et il n'y a rien à redire.
 *
 * Les cinq tableaux FILTRENT, et les cartes du haut, non :
 *
 *   /demo/cautions     filtre par état          cartes sur le parc entier
 *   /demo/paiements    filtre par état          cartes sur le parc entier
 *   /demo/locataires   filtre par état + nom    cartes sur le parc entier
 *   /demo/parc         RECHERCHE LIBRE          cartes sur le parc entier
 *   /demo/releves      tri par relevé manquant  cartes sur le parc entier
 *
 * Dès qu'on filtre, plus aucun nombre de l'écran ne décrit ce qu'on regarde : la
 * carte parle d'un ensemble qu'on ne voit plus, et la colonne qu'on voit n'a pas
 * de somme. Le cas des cautions filtrées sur « en cours d'arbitrage » est le plus
 * net — c'est la population qu'on vient traiter, l'écran le dit dans le
 * commentaire de son propre filtre, et c'est le seul état où l'argent en jeu
 * n'est écrit nulle part.
 *
 * ═══ CE QUE CES CAS VÉRIFIENT, ET COMMENT ═══
 *
 * PAS DE MONTANT ÉCRIT EN DUR. Le pied est comparé à la SOMME DES CELLULES lues
 * dans le document : c'est le contrat — « le pied somme ce que la table
 * montre » — et un cas qui inscrirait 1 226 000 rougirait au premier changement
 * des données de démonstration sans rien avoir gardé.
 *
 * Deux exceptions, écrites là où elles se produisent : le parc, dont le pied
 * somme MOINS que ses cellules parce qu'un lot vacant n'appelle pas de loyer, et
 * les relevés, dont le pied somme les montants qui EXISTENT.
 */

/** Les chiffres d'un montant rendu — insécables, signes et devise retirés. */
function chiffres(texte: string): number {
  const nombre = Number(texte.replace(/[^\d]/g, ''))
  return Number.isNaN(nombre) ? 0 : nombre
}

/**
 * Un bouton de `GroupeDeFiltres`, par son libellé.
 *
 * PAS `getByRole('radio')` : le groupe est bâti en `<button>` dans un
 * `role="group"`, et son nom accessible porte le COMPTE collé au libellé —
 * « En cours d'arbitrage2 ». Le motif est donc partiel par nécessité, et c'est
 * aussi ce qui garde le cas des variations de ce compte.
 */
function filtre(libelle: RegExp) {
  return within(screen.getByRole('main')).getByRole('button', { name: libelle })
}

/** Le tableau de l'écran, par son marqueur de boîte défilante. */
function tableau() {
  const table = document.querySelector('table')
  if (!table) throw new Error('aucun tableau à l’écran')
  return table as HTMLTableElement
}

/** Le rang d'une colonne, trouvé par son en-tête — jamais compté à la main. */
function rangDeLaColonne(table: HTMLTableElement, entete: RegExp): number {
  const entetes = Array.from(table.querySelectorAll('thead th'))
  const rang = entetes.findIndex((th) => entete.test(th.textContent ?? ''))
  if (rang < 0) throw new Error(`aucune colonne d’en-tête ${entete}`)
  return rang
}

/** Les valeurs du corps, dans cette colonne. */
function cellulesDuCorps(table: HTMLTableElement, rang: number): string[] {
  return Array.from(table.querySelectorAll('tbody tr'))
    /* LES RANGÉES D'EN-TÊTE DE GROUPE SONT ÉCARTÉES : le parc groupe par
       immeuble, et son en-tête occupe une rangée d'une seule cellule à
       `colSpan`. La prendre pour une ligne de données ferait lire le nom d'un
       immeuble comme un montant. */
    .filter((tr) => tr.children.length > 1)
    .map((tr) => tr.children[rang]?.textContent ?? '')
}

/**
 * La cellule du pied qui est à l'aplomb de cette colonne.
 *
 * LE DÉCALAGE EST LU, PAS SUPPOSÉ : l'intitulé du pied COIFFE les colonnes de
 * tête qui n'ont rien à additionner — sans quoi « Total · 3 lignes sur 5 »
 * élargirait une colonne d'identité bornée à 5,5rem, et la table avec elle. Le
 * rang d'une colonne ne donne donc plus l'indice de sa cellule de pied. On lit
 * `colSpan` et l'on compte à partir de là, plutôt que d'inscrire un décalage qui
 * diffère d'un écran à l'autre.
 */
function celluleDuPied(table: HTMLTableElement, rang: number): string {
  const pied = table.querySelector('tfoot [data-total]')
  if (!pied) throw new Error('le tableau n’a pas de pied de totaux')
  const portee = Number(pied.children[0]?.getAttribute('colspan') ?? 1)
  if (rang < portee) throw new Error(`la colonne ${rang} est coiffée par l’intitulé`)
  return pied.children[rang - portee + 1]?.textContent ?? ''
}

describe('le pied qui somme la colonne qu’il somme', () => {
  it('donne aux cautions le total de ce qui est affiché', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const table = tableau()

    /* LES TROIS COLONNES D'ARGENT DE L'ÉCRAN, et les trois sont sommées : elles
       répondent aux trois cartes du haut, qui portent sur le parc entier. */
    for (const entete of [/^Consigné$/, /^À restituer$/]) {
      const rang = rangDeLaColonne(table, entete)
      const cellules = cellulesDuCorps(table, rang)
      expect(cellules.length, `la colonne ${entete} n’a aucune ligne`).toBeGreaterThan(1)
      expect(
        chiffres(celluleDuPied(table, rang)),
        `le pied de ${entete} ne fait pas la somme de ses cellules`,
      ).toBe(cellules.reduce((somme, c) => somme + chiffres(c), 0))
    }
  })

  it('suit le filtre : le pied change, la carte du haut non', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const rang = rangDeLaColonne(tableau(), /^Consigné$/)
    const avant = chiffres(celluleDuPied(tableau(), rang))

    /* LE FILTRE LE PLUS ACTIONNABLE DE L'ÉCRAN — « c'est la population "en
       arbitrage" qu'on vient traiter », dit son propre commentaire — et celui où
       aucun total ne décrivait plus ce qu'on voyait. */
    await userEvent.click(filtre(/en cours d’arbitrage/i))

    const apres = chiffres(celluleDuPied(tableau(), rang))
    expect(apres, 'le pied ignore le filtre').not.toBe(avant)
    expect(
      apres,
      'le pied d’un sous-ensemble dépasse celui de l’ensemble',
    ).toBeLessThan(avant)

    /* ET IL REFAIT LA SOMME DES LIGNES RESTANTES — sans quoi il aurait
       simplement changé de nombre. */
    const cellules = cellulesDuCorps(tableau(), rang)
    expect(apres).toBe(cellules.reduce((somme, c) => somme + chiffres(c), 0))
  })

  it('dit sur combien de lignes il somme, et sur combien en tout', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    /* SANS FILTRE, PAS DE DÉNOMINATEUR : « 5 lignes sur 5 » ferait chercher ce
       qui manque. */
    const table = tableau()
    const intitule = () => table.querySelector('tfoot [data-total] th')?.textContent ?? ''
    expect(intitule()).toMatch(/^Total · \d+ lignes?$/)

    await userEvent.click(filtre(/en cours d’arbitrage/i))

    /*
      LE DÉNOMINATEUR EST CE QUI EMPÊCHE DE LIRE UNE CONTRADICTION. Le pied
      annonce moins que la carte « Total consigné » du haut, qui porte sur le parc
      entier : deux totaux d'argent qui ne s'accordent pas, sur le même écran,
      c'est ce qu'on appelle une erreur. « sur 5 » dit en une lecture que l'un est
      un sous-ensemble de l'autre.
    */
    expect(
      tableau().querySelector('tfoot [data-total] th')?.textContent ?? '',
      'le pied filtré ne dit pas de combien de lignes il est extrait',
    ).toMatch(/^Total · \d+ lignes? sur \d+$/)
  })

  it('n’est pas une ligne de plus dans le corps du tableau', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const table = tableau()

    /* UNE SOMME N'EST PAS UN ENREGISTREMENT. Dans un `<tbody>`, elle
       compterait comme une ligne de plus — un lecteur d'écran annoncerait
       « 6 lignes » là où il y a cinq cautions et un total, et toute mesure qui
       parcourt les rangées la prendrait pour une donnée. */
    expect(
      table.querySelectorAll('tbody [data-total]').length,
      'le total est rendu dans le corps du tableau',
    ).toBe(0)
    expect(table.querySelectorAll('tfoot [data-total]').length).toBe(1)

    /* ET IL NOMME SA RANGÉE : sans en-tête de ligne, la lecture du pied donne
       un montant nu — exactement ce que la colonne d'identité a corrigé pour le
       corps. */
    const enTete = table.querySelector('tfoot [data-total] th')
    expect(enTete?.getAttribute('scope'), 'l’intitulé du pied n’est pas un en-tête de ligne').toBe(
      'row',
    )
  })

  it('ne recopie pas une ligne unique sous elle-même', async () => {
    /*
      L'ÉCRAN DES PAIEMENTS VU PAR UN LOCATAIRE : un seul bail, le sien. Une somme
      d'un terme est ce terme — le pied aurait rendu une rangée pour redire le
      montant juste au-dessus. Le cas n'est pas théorique : le cloisonnement du
      locataire a relevé trois rangées là où l'écran n'a qu'un bail.

      C'EST LA MÊME RÈGLE QUE ZÉRO LIGNE, d'un cran : il faut deux termes pour
      qu'il y ait une somme.
    */
    await renderApp('/demo/paiements')
    await switchRole('tenant')
    await attendreLeChargement()

    const table = tableau()
    expect(
      Array.from(table.querySelectorAll('tbody tr')).length,
      'la démonstration ne cloisonne plus le locataire à un seul bail',
    ).toBe(1)
    expect(
      table.querySelector('tfoot'),
      'le pied recopie l’unique ligne de l’écran',
    ).toBeNull()
  })

  it('ne fait pas grandir la table qu’il résume', async () => {
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const table = tableau()

    /*
      LA COLONNE D'IDENTITÉ EST BORNÉE À 5,5rem sur cet écran — 88 px, où
      « Total · 5 lignes » ne tient pas. Une cellule de pied posée là aurait
      élargi la colonne, donc la table, sur un écran dont la table défile déjà :
      le pied aurait fait grandir ce qu'il résume.

      L'intitulé COIFFE donc les colonnes de tête qui n'ont rien à additionner,
      et c'est mesurable : sa portée vaut le rang de la première colonne sommée.
    */
    const pied = table.querySelector('tfoot [data-total]')!
    const portee = Number(pied.children[0].getAttribute('colspan') ?? 1)
    expect(portee, 'l’intitulé ne coiffe rien : il est dans la colonne bornée').toBeGreaterThan(1)
    expect(portee).toBe(rangDeLaColonne(table, /^Consigné$/))

    /* ET LE PIED A AUTANT DE CELLULES QUE LE CORPS A DE COLONNES, portée
       comprise. Un compte faux décalerait les sommes sous les mauvaises
       colonnes — c'est le seul défaut que ce `colSpan` peut introduire. */
    const colonnes = table.querySelectorAll('thead th').length
    const cellulesDuPied = pied.children.length - 1 + portee
    expect(cellulesDuPied, 'le pied ne couvre pas exactement les colonnes').toBe(colonnes)
  })

  it('écarte du total les lots que le parc ne facture pas', async () => {
    /*
      À 375 px, ET CE N'EST PAS UN CHOIX DE COMMODITÉ.

      Le parc ne rend son `DataTable` QU'EN DESSOUS DE 1024 px : au large, il
      montre une grille de cartes par immeuble, bâtie à la main. Le pied de
      colonne n'existe donc sur cet écran que dans la forme en fiches — et c'est
      la seule forme où le poser était possible sans redessiner la grille de
      cartes, qui est un autre lot. Le cas le dit plutôt que de faire croire que
      l'écran entier est couvert.
    */
    await renderApp('/demo/parc', { largeur: 375 })
    await attendreLeChargement()

    /* L'ÉCRAN A DÉJÀ TRANCHÉ, DEUX FOIS, dans ces termes : « un lot vide
       n'appelle rien, et l'additionner ferait lire un revenu qui n'existe pas ».
       `loyersAttendus` et `loyerDe` appliquent la règle ; le pied aussi.

       C'EST DONC LE SEUL PIED QUI SOMME MOINS QUE SES CELLULES, et l'écart est
       celui que la fiche ANNONCE : sur un lot vide, elle écrit le montant suivi
       de « attendu ». */
    /* LE LOYER SE TROUVE PAR SON INTITULÉ, et non par la première classe
       `numeric` de la carte : le libellé du logement — « A1 » — en porte une
       aussi, et c'est lui que le document offre d'abord. Une fiche range sa
       valeur SOUS son nom, donc l'intitulé est le seul repère stable. */
    const loyers = Array.from(document.querySelectorAll('[data-fiche]')).map((f) => {
      const intitule = Array.from(f.querySelectorAll('.eyebrow')).find(
        (e) => e.textContent?.trim() === 'Loyer',
      )
      return intitule?.nextElementSibling?.textContent ?? ''
    })
    expect(loyers.length, 'aucune fiche de logement').toBeGreaterThan(1)
    expect(loyers.every((l) => /\d/.test(l)), 'une fiche ne montre pas son loyer').toBe(true)

    const vacants = loyers.filter((c) => /attendu/i.test(c))
    expect(vacants.length, 'la démonstration n’a aucun lot vacant à écarter').toBeGreaterThan(0)

    const toutes = loyers.reduce((somme, c) => somme + chiffres(c), 0)
    const facturees = loyers
      .filter((c) => !/attendu/i.test(c))
      .reduce((somme, c) => somme + chiffres(c), 0)
    expect(facturees, 'les deux sommes sont égales : le cas ne garde rien').toBeLessThan(toutes)

    const pied = document.querySelector('[data-total]')
    expect(pied, 'le parc en fiches n’a pas de pied de totaux').not.toBeNull()
    expect(
      chiffres(within(pied as HTMLElement).getByRole('definition').textContent ?? ''),
      'le pied additionne des loyers que personne ne verse',
    ).toBe(facturees)
  })

  it('ne chiffre pas une refacturation sur des relevés qui n’existent pas', async () => {
    await renderApp('/demo/releves')
    await attendreLeChargement()

    const rang = rangDeLaColonne(tableau(), /refactur/i)
    expect(chiffres(celluleDuPied(tableau(), rang))).toBeGreaterThan(0)

    /* FILTRÉ SUR « RELEVÉ MANQUANT », aucune ligne ne porte de montant. « 0 FCFA »
       se lirait « rien à refacturer » là où la vérité est « rien n'a encore été
       relevé » — la distinction que le tableau de bord vient de trancher pour ses
       deux barres de refacturation. */
    await userEvent.click(filtre(/relevé manquant/i))

    const pied = celluleDuPied(tableau(), rangDeLaColonne(tableau(), /refactur/i))
    expect(pied, 'le pied chiffre une refacturation sans aucun relevé').not.toMatch(/\d/)
    expect(pied).toMatch(/—/)
  })

  it('donne le même total au téléphone, en carte plutôt qu’en rangée', async () => {
    /* QUATRE DES CINQ ÉCRANS BASCULENT EN FICHES sous 1024 px. N'écrire le total
       que dans le `<tfoot>` l'aurait donné au bureau et retiré au téléphone,
       c'est-à-dire à l'appareil principal du marché visé — la faute que ce dépôt
       a déjà payée avec `hideOnMobile`, sur le nombre qui résume tous les
       autres. */
    await renderApp('/demo/cautions', { largeur: 375 })
    await attendreLeChargement()

    expect(document.querySelector('table'), 'la forme en fiches rend encore un tableau').toBeNull()

    const pied = document.querySelector('[data-total]')
    expect(pied, 'aucun total dans la forme en fiches').not.toBeNull()
    expect(pied!.textContent).toMatch(/^Total · \d+ lignes?/)

    /* HORS DE LA LISTE, pour la même raison que `<tfoot>` : en `<li>`, le total
       porterait le compte de la liste à N+1 et un lecteur d'écran annoncerait
       « liste, 6 éléments » pour cinq cautions et une somme. */
    expect(pied!.closest('ul'), 'le total est un élément de la liste des fiches').toBeNull()

    /* ET IL PORTE LES MÊMES SOMMES, nommées : au tableau la colonne les
       intitule en haut, ici il n'y a pas de colonne. */
    const termes = within(pied as HTMLElement).getAllByRole('term').map((dt) => dt.textContent)
    expect(termes, 'les sommes du pied ne sont pas nommées').toContain('À restituer')
  })
})
