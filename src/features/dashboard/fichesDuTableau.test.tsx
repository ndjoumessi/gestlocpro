import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * SUR UN TÉLÉPHONE, UN ÉCRAN-TABLEAU EST UNE LISTE DE FICHES.
 *
 * ═══ CE QU'UN TÉLÉPHONE FAISAIT DE CES ÉCRANS, MESURÉ AU NAVIGATEUR ═══
 *
 * À 360 px la boîte offre 318 px, et les quatre écrans-tableaux y rendaient :
 *
 *   parc            6 colonnes, 2 masquées,  74 px à défiler
 *   encaissements  11 colonnes, 6 masquées, 327 px à défiler
 *   relevés         6 colonnes, 2 masquées, 259 px à défiler
 *   cautions        6 colonnes, 1 masquée,  339 px à défiler
 *
 * Deux d'entre eux demandaient de faire glisser le tableau de PLUS D'UNE
 * LARGEUR D'ÉCRAN. Et le défilement n'était que la moitié du défaut :
 * `hideOnMobile` RETIRAIT jusqu'à six colonnes sur onze — l'immeuble d'un
 * logement, sa surface, la date d'un relevé. Non repliées, non accessibles
 * autrement : absentes. Sur le marché que ce produit vise, où le téléphone est
 * l'appareil principal, la moitié de la donnée n'existait pas.
 *
 * ═══ CE QUE CE FICHIER GARDE, ET POURQUOI CHACUN DES TROIS ═══
 *
 * 1. AUCUNE COLONNE N'EST PERDUE. C'est le gain, et il est invisible sur une
 *    capture — il faut compter. Une régression y ressemblerait à un écran plus
 *    propre : quelqu'un remet `hideOnMobile` en croyant alléger, et six faits
 *    disparaissent sans que rien ne rougisse.
 *
 * 2. LA DONNÉE N'EST PAS RENDUE DEUX FOIS. La première rédaction montait les
 *    deux formes et en cachait une par `hidden sm:block` : trente-quatre cas
 *    ont rougi, et ils avaient raison. Un utilitaire responsif cache, il ne
 *    retire pas — la donnée restait deux fois dans le document, donc deux fois
 *    dans les octets envoyés et deux fois pour un lecteur d'écran.
 *
 * 3. CHAQUE FAIT GARDE SON NOM. Dans un tableau, « Loyer » est écrit une fois
 *    en haut d'une colonne. Empilés sans leur en-tête, trois nombres ne se
 *    distinguent plus. C'est la régression la plus discrète des trois : elle ne
 *    retire aucune donnée, elle la rend seulement indéchiffrable.
 *
 * ═══ CE QU'IL NE GARDE PAS ═══
 *
 * La géométrie. jsdom ne calcule aucune boîte : « la fiche tient dans 318 px »
 * n'y veut rien dire. C'est `mesure-ui` qui la tient, au navigateur, sur onze
 * largeurs — et c'est elle qui a produit les chiffres du haut.
 */

const TELEPHONE = 360
const BUREAU = 1280

describe('les écrans-tableaux sur un téléphone', () => {
  it('rendent des fiches, et pas un tableau qui défile', async () => {
    await renderApp('/demo/parc', { largeur: TELEPHONE })
    await attendreLeChargement()

    expect(document.querySelectorAll('[data-fiche]').length).toBeGreaterThan(0)
    /* NI table, NI en-tête de colonne : la forme tabulaire n'est pas cachée,
       elle n'est pas montée. Voir la règle 2 de l'en-tête. */
    expect(document.querySelectorAll('table')).toHaveLength(0)
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
  })

  it('rendent un tableau au-delà du seuil, et pas de fiches', async () => {
    await renderApp('/demo/parc', { largeur: BUREAU })
    await attendreLeChargement()

    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-fiche]')).toHaveLength(0)
  })

  /**
   * LE CŒUR DU LOT, ÉCRAN PAR ÉCRAN.
   *
   * Les colonnes qui portaient `hideOnMobile` sont celles qui disparaissaient.
   * On les redemande NOMMÉMENT plutôt que de compter : un compte passerait au
   * vert le jour où six colonnes en remplacent six autres, ce qui n'est pas la
   * même chose que de n'en avoir perdu aucune.
   */
  const ATTENDUS: {
    nom: string
    adresse: string
    faits: RegExp[]
    hissesDansLEnTete?: RegExp[]
  }[] = [
    {
      nom: 'parc',
      adresse: '/demo/parc',
      // `building` et `type` étaient masqués sous `sm`.
      faits: [/Type/i, /Loyer/i, /Locataire/i],
      /* L'IMMEUBLE EST HISSÉ, PAS PERDU — et la nuance est tout l'objet de ce
         fichier. Sa règle n° 1 dit « aucune colonne n'est perdue » et redoute
         « quelqu'un qui remet `hideOnMobile` en croyant alléger ». Le
         groupement du parc retire bien la colonne des FICHES, mais il la met
         dans l'EN-TÊTE DE GROUPE, une fois pour cinq logements au lieu de cinq
         fois — mesuré : douze occurrences ramenées à trois.
         Ce champ dit donc ce que la fiche n'a plus à porter PARCE QUE l'en-tête
         le porte, et le cas VÉRIFIE l'en-tête. Sans lui, retirer le groupement
         sans rendre la colonne aux fiches ferait disparaître un fait en
         silence — exactement ce que ce fichier existe pour empêcher. */
      hissesDansLEnTete: [/Immeuble|Résidence|Villa/i],
    },
    {
      nom: 'relevés',
      adresse: '/demo/releves',
      faits: [/Locataire/i, /Refacturé/i, /Relevé le/i],
    },
    {
      nom: 'cautions',
      adresse: '/demo/cautions',
      faits: [/Locataire/i, /Retenu/i, /À restituer/i, /Consigné/i],
    },
  ]

  for (const { nom, adresse, faits, hissesDansLEnTete } of ATTENDUS) {
    it(`${nom} : chaque fiche porte tous ses faits, nommés`, async () => {
      await renderApp(adresse, { largeur: TELEPHONE })
      await attendreLeChargement()

      const fiches = Array.from(document.querySelectorAll<HTMLElement>('[data-fiche]'))
      expect(fiches.length, 'aucune fiche rendue').toBeGreaterThan(0)

      /* La PREMIÈRE fiche suffit : toutes se composent des mêmes colonnes, et
         les parcourir toutes ne ferait que multiplier le même constat. */
      const premiere = fiches[0]!
      for (const fait of faits) {
        expect(
          within(premiere).getAllByText(fait).length,
          `« ${fait.source} » ne figure pas dans la fiche`,
        ).toBeGreaterThan(0)
      }

      /* CE QUI A QUITTÉ LA FICHE DOIT ÊTRE DANS L'EN-TÊTE. La règle n'est pas
         relâchée, elle est déplacée : le fait reste à l'écran, une fois par
         groupe. */
      for (const hisse of hissesDansLEnTete ?? []) {
        const entetes = Array.from(document.querySelectorAll<HTMLElement>('[data-groupe]'))
        expect(entetes.length, 'un fait hissé sans en-tête de groupe pour le porter').toBeGreaterThan(0)
        expect(
          entetes.filter((e) => hisse.test(e.textContent ?? '')).length,
          `« ${hisse.source} » a quitté la fiche sans entrer dans l'en-tête`,
        ).toBeGreaterThan(0)
      }
    })
  }

  /**
   * L'ESPACE LOCATAIRE SUIT LA MÊME RÈGLE, avec sa propre forme.
   *
   * Son tableau de quittances est écrit à la main, dans une carte — il ne passe
   * pas par `DataTable`, qui poserait une seconde carte autour de la première.
   * Ce qui est partagé est le RAISONNEMENT, pas le composant, et c'est
   * exactement pourquoi ce cas existe : rien dans le code ne relie les deux
   * formes, donc rien ne rougirait si l'une repartait en tableau.
   *
   * L'écran compte double ici : c'est celui du LOCATAIRE, c'est-à-dire de celui
   * qui, dans ce produit, a le moins de chances d'avoir autre chose qu'un
   * téléphone. Mesuré avant : cinq colonnes, 62 px à faire glisser pour
   * atteindre le bouton de quittance — donc pour atteindre la seule action.
   */
  it('l’espace locataire rend ses quittances en fiches', async () => {
    await renderApp('/demo/mon-espace', { largeur: TELEPHONE })
    await attendreLeChargement()

    const fiches = document.querySelectorAll('[data-quittance]')
    expect(fiches.length, 'aucune quittance en fiche').toBeGreaterThan(0)

    /* Les trois composantes du loyer, nommées. Un montant seul ne se distingue
       pas d'un autre montant seul. */
    const premiere = fiches[0] as HTMLElement
    for (const terme of [/Loyer/i, /Eau/i, /Élec/i]) {
      expect(within(premiere).getAllByText(terme).length).toBeGreaterThan(0)
    }
    /* Et la quittance reste atteignable sans faire glisser quoi que ce soit. */
    expect(within(premiere).getByRole('button', { name: /quittance/i })).toBeInTheDocument()
  })

  it('l’espace locataire garde son tableau au-delà du seuil', async () => {
    await renderApp('/demo/mon-espace', { largeur: BUREAU })
    await attendreLeChargement()

    expect(document.querySelectorAll('[data-quittance]')).toHaveLength(0)
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
  })

  /**
   * L'EN-TÊTE EST UN `<dt>`, ET SA VALEUR UN `<dd>`.
   *
   * Le balisage n'est pas un détail de style : un lecteur d'écran annonce le
   * TERME avant sa DÉFINITION. Deux paragraphes empilés laisseraient deviner le
   * lien par la mise en page, c'est-à-dire pas du tout pour qui ne la voit pas.
   * C'est aussi ce qui distingue cette liste d'une `<table>` déguisée — voir
   * l'en-tête de `ListeDeFiches`.
   */
  it('apparie chaque nom à sa valeur, pour qui n’y voit rien', async () => {
    await renderApp('/demo/parc', { largeur: TELEPHONE })
    await attendreLeChargement()

    const premiere = document.querySelector<HTMLElement>('[data-fiche]')!
    const termes = premiere.querySelectorAll('dt')
    const definitions = premiere.querySelectorAll('dd')
    expect(termes.length, 'aucun couple nom/valeur').toBeGreaterThan(0)
    expect(definitions).toHaveLength(termes.length)
  })
})
