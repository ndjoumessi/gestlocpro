import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { AU_DELA_LG, useAuDela } from '@/lib/useAuDela'
import { Icon } from './Icon'

/**
 * LE RÔLE D'UNE COLONNE DANS LA FICHE, sous `sm`.
 *
 * Un tableau et une fiche ne rangent pas la même chose au même endroit : le
 * tableau aligne des colonnes pour qu'on COMPARE des lignes, la fiche empile
 * des faits pour qu'on LISE un enregistrement. Passer de l'un à l'autre demande
 * de savoir ce que chaque colonne EST — pas seulement où elle se trouve.
 *
 *   `identite`  ce qui NOMME la ligne. En tête de fiche, en gras. Une seule.
 *   `valeur`    le chiffre qui compte. À droite de l'identité, SOUS SON NOM.
 *
 *               Le nom a failli sauter : « A1 · 145 000 FCFA » se lit très bien
 *               d'un bloc, et sur l'écran du parc il n'y a qu'un montant, donc
 *               aucune ambiguïté. La garde des fiches l'a refusé, et elle avait
 *               raison — l'écran des CAUTIONS porte trois montants (consigné,
 *               retenu, solde), et « A1 · 176 000 FCFA » n'y désigne rien. Une
 *               règle qui ne tient que sur l'écran d'où on l'a tirée n'est pas
 *               une règle.
 *   `etat`      le verdict. Il descend sous les deux précédents, et il est le
 *               seul à ne pas porter son en-tête : une pastille « Payé » n'a
 *               pas besoin qu'on lui écrive « Statut » au-dessus.
 *   `geste`     ce qu'on peut FAIRE sur la ligne — une quittance à ouvrir. Au
 *               pied de la fiche, avec l'état : ce sont les deux seules choses
 *               dont l'en-tête de colonne est vide ou muet dans le tableau, et
 *               ce n'est pas un hasard. Une colonne d'action n'a pas de nom
 *               parce que son bouton porte le sien.
 *   `serie`     des colonnes qui forment une SUITE — les six mois de la grille
 *               des paiements. Elles gardent leur axe : en-têtes sur une ligne,
 *               valeurs sous elles, comme un petit tableau dans la fiche.
 *
 *               C'est la seule exception à « une fiche empile des faits », et
 *               elle est mesurée : rendues en `contexte`, les six périodes
 *               faisaient six lignes de « MAR ●●● » et portaient la fiche à
 *               310 px. Une suite chronologique lue verticalement cesse d'être
 *               une suite — c'est précisément ce qu'on regarde d'un coup d'œil
 *               pour voir OÙ le paiement a lâché.
 *
 *   `contexte`  tout le reste. Une ligne par colonne, en gris, PRÉCÉDÉE de son
 *               en-tête — sans lui, « Bonamoussadi » et « 2-pièces · 78 m² »
 *               s'empilent sans qu'on sache lequel répond à quoi.
 *
 * Le défaut est `contexte` : une colonne qui ne déclare rien s'affiche, avec
 * son nom. C'est le comportement sûr — on ne perd jamais une donnée par
 * omission, on la range seulement moins bien.
 */
export type RoleDeColonne = 'identite' | 'valeur' | 'etat' | 'geste' | 'serie' | 'contexte'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Aligne à droite et passe en chiffres tabulaires. */
  numeric?: boolean
  /**
   * Masque la colonne sous `sm` — DANS LE TABLEAU, qui n'y est plus rendu.
   *
   * Conservé parce que deux tableaux du produit vivent DANS une carte étroite
   * et gardent leur forme tabulaire à toute largeur. Sur les écrans passés en
   * fiches, l'attribut n'a plus d'effet : c'est le point du lot, une donnée ne
   * disparaît plus parce que l'écran est étroit.
   */
  hideOnMobile?: boolean
  width?: string
  /** Où la colonne va dans la FICHE — voir `RoleDeColonne`. */
  role?: RoleDeColonne
}

export interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: ReactNode
  /**
   * DEUX FORMES POUR UNE DONNÉE, et il faut demander la seconde.
   *
   * `fiches` fait rendre, sous `sm`, une liste d'enregistrements au lieu d'un
   * tableau qui défile. Ce n'est pas le défaut, et ce n'est pas de la
   * prudence : deux tableaux du produit — la matrice des droits, l'aperçu d'un
   * état des lieux — sont des GRILLES DE COMPARAISON dont chaque cellule n'a de
   * sens que par sa ligne ET sa colonne. Les empiler en fiches détruirait ce
   * qu'ils montrent.
   *
   * Le demander écran par écran oblige à se poser la question, une fois, pour
   * chacun : « cette table sert-elle à comparer des lignes, ou à lire des
   * enregistrements ». C'est une question de conception, elle n'a pas de
   * réponse par défaut.
   */
  fiches?: boolean
}

/**
 * Tableau de données.
 *
 * Le conteneur porte `overflow-x-auto` : un tableau large défile dans sa
 * propre boîte au lieu de faire déborder la page entière — c'est la règle qui
 * évite le défilement horizontal du document sur mobile.
 *
 * Il porte AUSSI `relative`, et cette moitié-là de la règle est la moins
 * intuitive : une boîte de défilement ne rogne que les éléments absolus dont
 * elle est le bloc conteneur. Restée statique, elle laisse s'échapper tout
 * `sr-only` posé dans une cellule — `position: absolute` — qui va alors
 * étendre le défilement du document à la largeur intrinsèque du tableau. La
 * matrice des droits de `Onboarding.tsx` a fait fuir 268px de cette façon.
 * Le `relative` ne se voit pas ; c'est lui qui tient la promesse ci-dessus.
 *
 * PAS de ligne cliquable. Il en existait une — un `onClick` sur le `<tr>`, sans
 * `tabIndex` ni gestionnaire clavier : la ligne s'ouvrait à la souris et restait
 * hors d'atteinte autrement. Aucun écran ne s'en servait, et rien dans le
 * produit n'annonçait de vouloir s'en servir ; la rendre accessible aurait donc
 * consisté à câbler un rôle, un ordre de tabulation et Entrée/Espace au service
 * d'un appelant imaginaire. Le jour où une ligne devra mener quelque part, la
 * réponse juste sera un vrai lien dans une cellule — focalisable, ouvrable dans
 * un nouvel onglet, annoncé par sa destination — et non une rangée piégée.
 */
/**
 * LA COLONNE DES GESTES RESTE SOUS LES YEUX, QUOI QUE FASSE LE DÉFILEMENT.
 *
 * ═══ CE QU'ELLE RÉPARE ═══
 *
 * La grille des paiements porte une dernière colonne sans en-tête : « Quittance »
 * et, sur un bail en retard, « Mise en demeure ». Mesuré au navigateur : la
 * table fait 1063 px dans un conteneur de 958 à 1280 px de fenêtre — la largeur
 * d'écran la plus courante —, de 702 à 1024, et de 636 à 700. Quatre cent
 * vingt-huit pixels de gestes hors champ au pire.
 *
 * RIEN NE LE DISAIT. `overflow-x-auto` ne peint aucune barre tant qu'on ne
 * défile pas ; la colonne n'a pas d'intitulé qui dépasserait pour trahir sa
 * présence — et pour une bonne raison, écrite plus haut dans ce fichier : « une
 * colonne d'action n'a pas de nom parce que son bouton porte le sien ». Sauf que
 * le bouton, lui, était dehors. L'écran avait donc l'air complet, et on ne
 * cherche pas ce dont on ignore l'existence.
 *
 * ═══ POURQUOI COLLANTE PLUTÔT QUE PLUS ÉTROITE ═══
 *
 * Rétrécir la table aurait voulu dire retirer des périodes : à 1024, les
 * colonnes fixes en réclament 643 sur 702 disponibles, il ne reste pas de quoi
 * en afficher UNE. Le remède aurait donc consisté à choisir entre l'histoire et
 * l'action, alors que l'écran a besoin des deux.
 *
 * La colonne collante ne choisit pas : les périodes défilent SOUS elle, le geste
 * reste au bord droit. C'est aussi ce qui rend le défilement visible pour la
 * première fois — on voit les mois passer derrière une colonne fixe, ce qu'aucune
 * barre absente n'annonçait.
 *
 * ═══ TROIS DÉTAILS QUI NE SONT PAS DES DÉTAILS ═══
 *
 * LE FOND EST OBLIGATOIRE. Une cellule collante transparente laisse défiler le
 * contenu SOUS elle en restant lisible au travers : deux textes superposés. Le
 * fond suit celui de sa rangée — creusé pour l'en-tête, surface pour le corps.
 *
 * AUCUN `z-index` ÉCRIT À LA MAIN, et ce n'est pas un oubli : la colonne des
 * gestes est la DERNIÈRE du tableau, donc la dernière du DOM, donc déjà peinte
 * par-dessus ses voisines à altitude égale. `altitudes.test.ts` refuse de toute
 * façon tout niveau écrit à la main, et le barreau qu'il aurait fallu nommer
 * n'existe pas — ce n'est pas un objet flottant, c'est une cellule.
 *
 * LE FILET DE GAUCHE reste quand rien ne défile. Il ne signale pas le
 * défilement — il sépare ce qu'on LIT de ce qu'on FAIT, et cette frontière-là
 * vaut à toutes les largeurs.
 */
const COLONNE_COLLANTE = 'sticky right-0 border-l border-divider'

/**
 * ET L'IDENTITÉ RESTE À GAUCHE, pour la raison symétrique.
 *
 * Une fois le geste épinglé à droite, ce sont les périodes qui défilent — et
 * c'est bien ce qu'on veut d'une suite de mois. Sauf qu'au repos le tableau
 * montre les plus ANCIENS : pour atteindre août, il faut défiler, et le nom du
 * locataire s'en va avec le reste. On se retrouve à lire une ligne de pastilles
 * sans savoir de qui elle parle.
 *
 * La colonne d'identité est donc tenue, elle aussi. C'est la forme classique
 * d'un tableau plus large que sa boîte : ce qui NOMME et ce qui AGIT restent,
 * ce qui se PARCOURT défile entre les deux.
 *
 * Le verdict et le solde, eux, défilent. Ils sont visibles au repos — c'est
 * l'ordre des colonnes qui s'en charge — et les épingler aussi aurait laissé
 * moins de 315 px aux six mois, soit une fenêtre plus étroite que ce qu'elle
 * fait défiler.
 */
/**
 * L'IDENTITÉ N'EST PAS TENUE À GAUCHE, ET L'ESSAI VAUT D'ÊTRE GARDÉ.
 *
 * L'idée se tenait : une fois le geste épinglé à droite, ce sont les périodes
 * qui défilent, et pour atteindre août il faut pousser la table — emportant le
 * nom du locataire. La forme classique d'un tableau plus large que sa boîte
 * épingle donc les deux bords.
 *
 * MESURÉ À L'ÉCRAN, ÇA NE MARCHE PAS ICI, et pour une raison de MODÈLE et non
 * de mise en page : sur cet écran, l'identité d'une ligne tient dans DEUX
 * colonnes — « A1 » et « Charles Ngassa ». Seule la première porte le rôle
 * `identite`. Épinglée, elle couvre 72 px, la seconde glisse dessous, et les
 * 28 px qui dépassent laissent voir « …sa », « …a », « …ba » à droite de la
 * case. Une identité coupée en deux dont on n'épingle que la moitié est pire
 * que rien.
 *
 * Le remède serait de faire de l'unité ET du locataire UNE seule colonne
 * d'identité — ce qu'ils sont, en vérité. Cela change aussi la forme en fiches,
 * où le titre et sa ligne de locataire vivent séparés. C'est un lot, pas un
 * détail de style.
 *
 * L'altitude, elle, reste posée : c'est elle qui a rendu le défaut VISIBLE au
 * lieu de le laisser se superposer, et le geste de droite s'en sert.
 */

/**
 * L'ALTITUDE D'UNE COLONNE TENUE.
 *
 * `position: sticky` crée un contexte d'empilement, mais À ALTITUDE ÉGALE c'est
 * l'ORDRE DU DOCUMENT qui tranche. La colonne de geste est la dernière du
 * tableau, donc déjà peinte par-dessus ce qui défile sous elle — l'altitude ne
 * lui est pas indispensable aujourd'hui. Elle la porte quand même, et nommée :
 * l'ordre des colonnes est le choix d'un appelant, pas une propriété du
 * composant, et le jour où un écran posera un geste ailleurs qu'en dernier, la
 * cellule ne doit pas se mettre à disparaître sous sa voisine.
 *
 * `--z-sticky` ET NON UN NOMBRE : le dépôt tient une échelle d'altitudes
 * déclarée, `altitudes.test.ts` refuse tout niveau écrit à la main, et ce
 * barreau-ci porte exactement ce nom — une colonne collante est très exactement
 * ce qu'il nomme.
 */
const ALTITUDE_TENUE = { zIndex: 'var(--z-sticky)' } as const

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  fiches,
}: DataTableProps<T>) {
  /*
    LE CHOIX SE FAIT AU RENDU, PAS DANS LA FEUILLE DE STYLE.

    La première rédaction rendait les DEUX formes et en cachait une par
    `hidden sm:block`. Mesuré immédiatement : trente-quatre cas ont rougi, et
    ils avaient raison — un utilitaire responsif CACHE, il ne retire pas. La
    donnée restait deux fois dans le document. Ce n'est pas un ennui de
    harnais : c'est deux fois le même tableau dans les octets envoyés, deux
    fois dans ce que lit un outil sans CSS, et deux fois pour toute mesure qui
    parcourt le DOM plutôt que la peinture.

    `useAuDela` porte déjà cet argument dans son en-tête, pour le panneau de la
    vitrine — « les utilitaires responsifs cachent, ils ne retirent pas ». On
    l'emploie ici pour la même raison.

    IL EST APPELÉ AVANT LE GARDE D'ÉTAT VIDE, et le linter l'a exigé — à juste
    titre. Placé après, il ne s'exécutait pas sur un tableau sans ligne : l'ordre
    des crochets changeait au moment précis où la première donnée arrive, ce qui
    est le seul moment où l'écran passe de vide à plein. React n'aurait pas
    pardonné, et aucun de nos cas ne montait un tableau vide PUIS rempli.
  */
  /*
    LE SEUIL EST PASSÉ DE `sm` À `lg`, ET C'EST UNE MESURE QUI L'A DÉPLACÉ.

    Il valait 640 px — la largeur à partir de laquelle un tableau CESSE d'être
    absurde. Ce n'est pas celle à partir de laquelle il TIENT. Mesuré au
    navigateur, à 700 px de fenêtre :

      /demo/cautions     table 832 px dans 636   →  197 px hors champ
      /demo/locataires   table 841 px dans 636   →  174 px hors champ
      /demo/parc         table 686 px dans 636   →   51 px hors champ

    Et ce qui tombait hors champ, à chaque fois, était la COLONNE D'ÉTAT — la
    dernière du tableau, donc la première à sortir. « Consignée », « À jour »,
    « En retard » : le verdict de chaque ligne, invisible, derrière un
    défilement qu'aucune barre n'annonçait.

    La bande 640–1023 px n'est pas une curiosité : c'est une tablette en
    portrait, une fenêtre à moitié d'écran, un portable en écran partagé. Elle
    recevait la forme la plus dense du produit dans la largeur qui la supporte
    le moins.

    LES FICHES, ELLES, N'ONT PAS DE LARGEUR MINIMALE : elles empilent, et leur
    seule suite horizontale — l'axe des périodes — défile dans sa propre boîte.
    À 700 px elles montrent TOUT ce que le tableau cachait.

    `fiches` reste demandé écran par écran, et cet arbitrage-là n'a pas changé :
    deux grilles du produit sont des matrices de comparaison qu'on ne peut pas
    empiler. Elles n'appellent pas `fiches`, et gardent leur tableau à toute
    largeur — c'est leur défilement qui les sert, et il porte sur des colonnes
    équivalentes, pas sur un verdict.
  */
  const enTableau = useAuDela(AU_DELA_LG)

  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }


  if (fiches && !enTableau) {
    return <ListeDeFiches caption={caption} columns={columns} rows={rows} rowKey={rowKey} />
  }

  /**
   * LES COLONNES DE GESTE QUI NE RENDENT RIEN DU TOUT.
   *
   * Une colonne d'action n'offre pas toujours son geste : le registre des
   * locataires ne propose le retrait d'une fiche qu'au propriétaire, et
   * seulement sur une ligne occupée. Sur une démonstration vue en gestionnaire,
   * les dix lignes rendent `null`.
   *
   * Tant que la colonne était ordinaire, cela ne se voyait pas : une colonne
   * vide est du blanc parmi du blanc. Elle est devenue COLLANTE et BORDÉE au
   * lot précédent, et le vide s'est mis à se voir — un filet vertical sur toute
   * la hauteur du tableau, épinglé au bord droit, ne contenant rien. Un
   * séparateur qui ne sépare rien de rien.
   *
   * On regarde donc si la colonne rend quelque chose SUR AU MOINS UNE LIGNE. Si
   * elle ne rend rien, elle cesse d'être tenue : il n'y a rien à garder sous les
   * yeux, et rien dont il faille séparer le reste. `render` est rappelé une fois
   * par ligne pour le savoir — dix appels d'une fonction pure, contre un défaut
   * visible sur toute la hauteur de l'écran.
   */
  const colonnesSansGeste = new Set(
    columns
      .filter((c) => c.role === 'geste' && rows.every((row) => !c.render(row)))
      .map((c) => c.key),
  )
  const estTenue = (c: Column<T>) => c.role === 'geste' && !colonnesSansGeste.has(c.key)

  return (
      <div
        /* `data-defilant` : la garde `mesure-ui` mesure les gestes contre le
           bord VISIBLE de cette boîte. Elle ne peut pas la reconnaître par sa
           classe — `scripts/` est balayé par le générateur d'utilitaires
           Tailwind, et y écrire un nom de classe en fabriquerait un. Même
           raison que `data-intitule` sur `StatCard`. */
        data-defilant=""
        className={cn(
          'relative overflow-x-auto rounded-lg border border-divider bg-surface shadow-e1',
        )}
      >
      <table className="w-full border-collapse text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-divider bg-surface-sunken">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-colonne-tenue={estTenue(column) ? column.role : undefined}
                style={{ width: column.width, ...(estTenue(column) ? ALTITUDE_TENUE : {}) }}
                className={cn(
                  'eyebrow px-4 py-3 text-left font-normal whitespace-nowrap text-muted',
                  column.numeric && 'text-right',
                  column.hideOnMobile && 'hidden sm:table-cell',
                  estTenue(column) && COLONNE_COLLANTE,
                  estTenue(column) && 'bg-surface-sunken',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-divider transition-colors duration-150 last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-colonne-tenue={estTenue(column) ? column.role : undefined}
                  style={estTenue(column) ? ALTITUDE_TENUE : undefined}
                  className={cn(
                    /*
                      `relative` : la cellule est le bloc conteneur de ce qu'elle
                      contient. Une cellule qui MÈNE quelque part peut alors
                      offrir toute sa surface au doigt, par un `::after` étendu
                      sur ses bords, sans qu'un seul pixel ne se déplace — c'est
                      ce que fait la colonne « Logement » du parc.

                      La note du haut de ce fichier annonçait la manœuvre : « le
                      jour où une ligne devra mener quelque part, la réponse
                      juste sera un vrai lien dans une cellule ». Le lien reste
                      un lien — focalisable, ouvrable dans un nouvel onglet,
                      annoncé par son nom — et c'est sa zone tapable, non sa
                      nature, qui grandit.
                    */
                    'relative px-4 py-3 align-middle',
                    column.numeric && 'numeric text-right whitespace-nowrap',
                    column.hideOnMobile && 'hidden sm:table-cell',
                    estTenue(column) && COLONNE_COLLANTE,
                    estTenue(column) && 'bg-surface',
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
  )
}

/**
 * LE MÊME TABLEAU, EN FICHES — c'est la refonte des écrans-tableaux.
 *
 * ═══ CE QU'UN TÉLÉPHONE FAISAIT DE CES ÉCRANS, MESURÉ ═══
 *
 * À 360 px, la boîte offre 318 px. Les quatre écrans-tableaux du produit y
 * rendaient :
 *
 *   parc            6 colonnes, 2 masquées,  74 px à défiler
 *   encaissements  11 colonnes, 6 masquées, 327 px à défiler
 *   relevés         6 colonnes, 2 masquées, 259 px à défiler
 *   cautions        6 colonnes, 1 masquée,  339 px à défiler
 *
 * Deux d'entre eux demandaient de faire glisser le tableau de PLUS D'UNE
 * LARGEUR D'ÉCRAN pour en voir la fin. Et le défilement n'est que la moitié du
 * défaut : `hideOnMobile` RETIRAIT jusqu'à six colonnes sur onze — l'immeuble
 * d'un logement, sa surface, la date d'un relevé — non pas repliées, non pas
 * accessibles autrement, simplement absentes. Sur le marché que ce produit
 * vise, où le téléphone est l'appareil principal, la moitié de la donnée
 * n'existait pas.
 *
 * ═══ POURQUOI UNE FICHE, ET NON UN TABLEAU PLUS MALIN ═══
 *
 * On peut faire beaucoup pour un tableau étroit — colonnes prioritaires,
 * en-têtes collants, repli en accordéon. Tout cela reste un tableau, c'est-à-dire
 * une forme faite pour COMPARER des lignes entre elles. Or personne ne compare
 * douze logements sur un écran de 6 pouces : on en cherche UN, on lit son
 * loyer, on voit s'il a payé. C'est la lecture d'un enregistrement, et la forme
 * d'un enregistrement est une fiche.
 *
 * ═══ CE QUE LA FICHE GARDE DU TABLEAU ═══
 *
 * TOUT. Aucune colonne n'est perdue : `hideOnMobile` ne s'applique plus, et les
 * six colonnes masquées des encaissements reviennent. C'est le gain principal,
 * et il est invisible dans une capture — il faut compter.
 *
 * L'EN-TÊTE SUIT SA DONNÉE au lieu de la surplomber. Dans un tableau, « Loyer »
 * est écrit une fois en haut d'une colonne ; dans une fiche, il doit accompagner
 * chaque valeur, sans quoi trois nombres empilés ne se distinguent plus. Les
 * rôles `identite`, `valeur` et `etat` en sont dispensés : ils se reconnaissent
 * à leur place et à leur forme.
 *
 * ═══ CE QU'ELLE N'EST PAS ═══
 *
 * Une `<table>` déguisée. Le balisage est une vraie liste — `<ul>`/`<li>` — et
 * non un tableau dont on aurait changé le `display`, ce qui aurait laissé les
 * rôles ARIA de tableau sur une forme qui n'en est plus un. Un lecteur d'écran
 * y entend une liste de N éléments, ce qui est la vérité.
 *
 * La légende du tableau devient le nom accessible de la liste : elle dit déjà
 * ce que la collection contient, et l'écrire deux fois serait la lire deux fois.
 */
function ListeDeFiches<T>({
  caption,
  columns,
  rows,
  rowKey,
}: Omit<DataTableProps<T>, 'empty' | 'fiches'>) {
  const identite = columns.find((c) => c.role === 'identite')
  const valeur = columns.find((c) => c.role === 'valeur')
  const etat = columns.filter((c) => c.role === 'etat')
  const gestes = columns.filter((c) => c.role === 'geste')
  const serie = columns.filter((c) => c.role === 'serie')
  const contexte = columns.filter((c) => c.role === undefined || c.role === 'contexte')

  return (
    <ul aria-label={caption} className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={rowKey(row)}
          data-fiche=""
          className="rounded-lg border border-divider bg-surface p-4 shadow-e1"
        >
          {/* L'IDENTITÉ ET LA VALEUR SUR UNE MÊME LIGNE : « A1 · 145 000 FCFA »
              est ce qu'on cherche d'abord, et le lire d'un bloc épargne un
              aller-retour de l'œil. `items-baseline` les aligne sur leur trait
              de base et non sur leurs boîtes, dont les hauteurs diffèrent. */}
          {(identite || valeur) && (
            /*
              LA RANGÉE DE TÊTE PORTE LA ZONE TAPABLE, ET ELLE FAIT 44 px.

              `relative` posé sur la seule identité donnait une cible de 19 × 23 :
              le pseudo-élément couvrait le texte du lien, pas davantage. Dans le
              tableau, c'est la CELLULE qui le porte, avec ses `px-4 py-3` — d'où
              une cible confortable sans que personne ait eu à y penser.

              Ici la rangée joue ce rôle : `min-h-11` lui donne le plancher de 44
              px du produit, et la zone couvre l'identité ET sa valeur. Ce
              recouvrement est voulu — la ligne de tête EST l'enregistrement, et
              rien d'autre n'y est interactif.
            */
            <div className="relative flex min-h-11 items-start justify-between gap-3">
              {identite && (
                /*
                  `items-start` depuis que la valeur porte son nom : alignés sur
                  la ligne de base, l'identité se retrouverait à hauteur du
                  surtitre et non du montant.
                */
                /*
                  `self-stretch` ET CENTRÉ DEDANS : la rangée fait bien 44 px,
                  mais avec `items-start` l'identité se colle en haut, et la zone
                  tapable — qui s'étend depuis le CENTRE du lien — butait sur le
                  bord au bout de 17 px. Mesuré : 32 × 34 pour 44 exigés.

                  Étirée sur la hauteur de la rangée et centrée dedans, le centre
                  du lien tombe au milieu des 44 px et la zone les couvre.

                  `min-w-11` PLUTÔT QUE `min-w-0`, pour la même raison sur l'autre
                  axe : « A1 » mesure 18 px de large, et un plancher de 44 px vaut
                  dans LES DEUX dimensions — c'est un doigt, pas un curseur.

                  ET `relative` REVIENT ICI, sur la boîte désormais dimensionnée.

                  `-ml-4 pl-4` EST LA DERNIÈRE PIÈCE, et elle a demandé quatre
                  mesures. La boîte faisait bien 44 × 44, mais elle s'étendait
                  vers la DROITE : « A1 » commence au bord gauche de la fiche,
                  donc le centre du lien n'est qu'à neuf pixels de ce bord, et la
                  zone tapable butait là — relevé 32 px, bloqueur identifié comme
                  le `<li>` lui-même, c'est-à-dire le rembourrage de la carte.

                  La boîte déborde donc dans ce rembourrage et se le redonne en
                  `pl-4` : le TEXTE ne bouge pas d'un pixel, la zone gagne seize
                  pixels à gauche. C'est ce qu'un doigt attend — le bord de la
                  fiche est le bord de la cible.

                  `flex-1` AVEC LE PLANCHER, ET IL FALLAIT LES DEUX. Sans lui, la
                  boîte se dimensionnait à son CONTENU : sur les locataires, où
                  l'identité est une pastille d'initiales suivie d'un nom
                  complet, elle débordait de 7 px à 320 px — quatre fois, trouvé
                  par la sonde du débordement local. `flex-1` lui donne la place
                  restante, le nom s'y replie, et le plancher continue de tenir
                  la cible quand l'identité est courte comme « A1 ».

                  `min-w-12` ET NON `min-w-11`, ET C'EST UN COUSSIN ASSUMÉ. À 44
                  la mesure rendait exactement 44 dans le serveur de
                  développement et 41 dans le paquet construit, aux mêmes 320 px
                  et dans la même langue. Je n'ai pas trouvé la cause de ces
                  trois pixels, et je préfère l'écrire que d'inventer une
                  explication : quatre pixels de marge coûtent quatre pixels sur
                  une carte qui en fait 280, et couvrent un écart que je ne sais
                  pas encore borner.
                */
                <div className="relative -ml-4 flex min-w-12 flex-1 items-center self-stretch pl-4 text-body font-medium">
                  {/*
                    UN BLOC `min-w-0` AUTOUR DU RENDU, et il fallait ce troisième
                    étage.

                    L'identité d'un locataire est une pastille d'initiales et un
                    nom, dans un `flex` qui n'a pas de `min-w-0` — un élément
                    flexible refuse par défaut de descendre sous la largeur
                    intrinsèque de son contenu. La boîte avait beau prendre la
                    place restante, ce qu'elle contenait débordait quand même :
                    7 px à 320 px, quatre fois.

                    En l'enveloppant d'un BLOC qui, lui, peut se réduire, la
                    chaîne se rétablit — le bloc prend la largeur offerte, le
                    `flex` intérieur la remplit, et le `truncate` du nom
                    s'applique enfin. Le rendu de la colonne n'a rien à savoir de
                    tout ça : c'est la fiche qui lui fait de la place.
                  */}
                  <div className="min-w-0 flex-1">{identite.render(row)}</div>
                </div>
              )}
              {valeur && (
                /* Le nom AU-DESSUS et non à côté : à côté, il pousserait le
                   montant vers la gauche et le ferait cogner l'identité sur un
                   écran de 320 px. Au-dessus, il tient dans la largeur du
                   nombre, qui est toujours le plus large des deux. */
                <div className="shrink-0 text-right">
                  <div className="eyebrow text-muted">{valeur.header}</div>
                  <div className="numeric mt-0.5 text-body font-medium whitespace-nowrap">
                    {valeur.render(row)}
                  </div>
                </div>
              )}
            </div>
          )}

          {contexte.length > 0 && (
            /*
              `<dl>` ET NON DES PARAGRAPHES. Chaque ligne est un COUPLE
              nom/valeur — « Immeuble : Bonamoussadi » — et c'est exactement ce
              qu'une liste de définitions décrit. Un lecteur d'écran y annonce le
              terme avant sa définition ; deux `<p>` empilés le laisseraient
              deviner par la mise en page, c'est-à-dire pas du tout.
            */
            <dl className="mt-3 flex flex-col gap-1.5">
              {contexte.map((column) => (
                <div key={column.key} className="flex items-baseline justify-between gap-3">
                  <dt className="eyebrow shrink-0 text-muted">{column.header}</dt>
                  <dd
                    /*
                      `numeric` SANS `whitespace-nowrap`, et la porte l'a exigé.
                      Dans un tableau, l'interdiction de couper garde un montant
                      sur une ligne au milieu d'une cellule large. Dans une
                      fiche, la colonne de droite est étroite et la valeur est
                      parfois COMPOSÉE — « 178 · 4 120 → 4 298 » pour un relevé.
                      Mesuré à 320 px sur les relevés : 19 px hors de la boîte,
                      seize fois.

                      Retirer l'interdiction ne casse aucun nombre : `Intl` pose
                      des espaces INSÉCABLES à l'intérieur d'un montant, qui
                      reste donc entier. Ce qui se coupe est l'espace ENTRE les
                      parties du composé, c'est-à-dire là où il faut couper.
                    */
                    className={cn('min-w-0 text-right text-body', column.numeric && 'numeric')}
                  >
                    {column.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {serie.length > 0 && (
            /*
              LA SUITE GARDE SON AXE, en grille plutôt qu'en liste.
              `grid-flow-col` répartit les colonnes également : les six périodes
              y occupent la même largeur, ce qui est la condition pour qu'on
              compare leurs marques d'un coup d'œil.

              LE PLANCHER EST EN `rem`, ET IL REMPLACE UNE TRONCATURE. `auto-cols-fr`
              laissait les colonnes se resserrer jusqu'à 42 px à 320, et
              l'en-tête portait `truncate` pour absorber le reste. Mesuré à 22 px
              de police racine : « mars » manque 19 px, « août » 18, et six mois
              sur douze s'affichaient rabotés — un axe dont on ne lit plus les
              graduations. `minmax(2.75rem,1fr)` grandit AVEC la police, puisqu'il
              est exprimé dans la même unité qu'elle ; c'est la seule façon pour
              qu'un axe reste lisible quand son lecteur agrandit son texte.

              Et la rangée DÉFILE plutôt que de couper — `overflow-x-auto`, comme
              le graphe empilé le fait déjà pour ses douze colonnes, et pour la
              même raison : au-delà d'un certain nombre de graduations, la
              largeur qui manque se rend en défilement, jamais en points de
              suspension.

              Pas de `<dl>` ici : ce n'est pas une suite de couples nom/valeur,
              c'est une SÉRIE dont l'en-tête est un axe. Un `<dl>` annoncerait
              six définitions indépendantes.
            */
            <div className="mt-3 grid auto-cols-[minmax(2.75rem,1fr)] grid-flow-col gap-1 overflow-x-auto border-t border-divider pt-3">
              {serie.map((column) => (
                <div key={column.key} className="min-w-0 text-center">
                  <div className="eyebrow text-muted">{column.header}</div>
                  <div className="mt-1 flex justify-center">{column.render(row)}</div>
                </div>
              ))}
            </div>
          )}

          {(etat.length > 0 || gestes.length > 0) && (
            /* L'ÉTAT EN BAS, ET SANS SON EN-TÊTE. Une pastille « En retard »
               dit ce qu'elle est ; lui écrire « Statut » au-dessus ajouterait un
               mot par fiche sans ajouter un fait. `flex-wrap` parce que deux
               états peuvent cohabiter — la grille des paiements en porte un de
               règlement et un d'ancienneté. */
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {etat.map((column) => (
                <div key={column.key}>{column.render(row)}</div>
              ))}
              {/* Le geste EN DERNIER, et poussé à droite : l'œil descend la
                  fiche par les faits et finit sur ce qu'il peut en faire. */}
              {gestes.map((column) => (
                <div key={column.key} className="ml-auto">
                  {column.render(row)}
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Ce qu'un écran dit quand il n'a rien à montrer.
 *
 * Le NIVEAU du titre est un argument, et son défaut vaut pour l'usage
 * majoritaire : servi dans une carte, sous un `CardHeader level={2}`, le `h3`
 * est la marche suivante et il est juste. C'est de l'avoir FIGÉ qui coûtait.
 * Quatorze appels rendent cet état vide EN PLEINE PAGE, sous le seul `<h1>` de
 * `PageHeader` — le tableau de bord d'un parc neuf, le dossier d'un logement
 * introuvable, l'accès refusé au locataire — et la structure y sautait de 1 à
 * 3. Qui parcourt une page par ses titres compte les marches : un niveau
 * manquant lui fait chercher la section qu'il n'a pas entendue, et sur le
 * premier écran d'un compte neuf c'est la toute première chose que le produit
 * lui dit.
 *
 * Le remède ne se voit pas, et c'est voulu : `title-m` habille le titre par sa
 * classe, et la règle de base groupe `h1, h2, h3` sous la même famille et la
 * même graisse — la balise, à elle seule, ne porte aucune apparence.
 */
export function EmptyState({
  title,
  body,
  action,
  icon = 'search',
  level = 3,
}: {
  title: string
  body?: string
  action?: ReactNode
  icon?: Parameters<typeof Icon>[0]['name']
  /** Niveau du titre — préserve la hiérarchie h1→h6 de la page. */
  level?: 2 | 3 | 4
}) {
  const Titre = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-sunken text-muted">
        <Icon name={icon} size={22} />
      </span>
      <Titre className="mt-4 title-m">{title}</Titre>
      {body && <p className="mt-2 max-w-sm text-body text-pretty text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
