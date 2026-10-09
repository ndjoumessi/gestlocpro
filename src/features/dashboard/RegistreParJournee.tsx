import type { ReactNode } from 'react'

/**
 * LE REGISTRE SE LIT PAR JOURNÉE — la date cesse d'être répétée à chaque ligne.
 *
 * ═══ LE DÉFAUT, RELEVÉ SUR LA PRODUCTION ═══
 *
 * `/app/decisions`, capture du 2026-10-09 : sur dix-huit lignes visibles,
 * « 05/09/2026 » est écrit SEPT fois d'affilée, « 02/09/2026 » trois fois,
 * « 31/08/2026 » trois fois. Une colonne entière répète ce que la précédente
 * vient de dire, et la structure du temps — ce qui s'est passé le même jour —
 * n'apparaît nulle part alors que c'est la seule structure qu'un registre ait.
 *
 * La forme vient du catalogue de 21st.dev — « a vertical activity feed grouped
 * by day » (`@kuratlielia/timeline`). SON CODE N'A PAS ÉTÉ LU : la quota de
 * récupération était épuisée. On en reprend donc l'idée, décrite publiquement,
 * et rien d'autre — pas une ligne n'en est copiée, parce qu'il n'y avait rien à
 * copier.
 *
 * ═══ UNE SEULE FORME À TOUTES LES LARGEURS, ET C'EST UN GAIN ═══
 *
 * `DataTable` en rend DEUX : un tableau au-delà de `lg`, une grille de fiches
 * en deçà. C'est juste pour des données à colonnes comparables — des montants
 * qu'on aligne, des états qu'on balaie. Un registre ne se compare pas : il se
 * parcourt à rebours. Une journée suivie de ses actes se lit pareil sur un
 * téléphone et sur un écran large, et ce composant n'a donc qu'un rendu.
 *
 * ═══ CE QUE LA SÉMANTIQUE DOIT RENDRE, ET POURQUOI PAS UN TABLEAU ═══
 *
 * Une liste ordonnée de journées, chacune portant une liste ordonnée d'actes.
 * `aria-labelledby` rattache les actes à leur date : un lecteur d'écran annonce
 * « 5 septembre 2026, liste de 7 éléments », ce qu'aucune colonne répétée ne
 * disait. Le tableau, lui, annonçait dix-huit rangées sans jamais dire qu'elles
 * se groupaient.
 *
 * LE RAIL EST DÉCORATIF. Il est peint par une bordure sur la liste et une
 * pastille par acte — pas un caractère de texte, rien que l'AT puisse lire. Un
 * rail qui s'annoncerait serait dix-huit « puce » de plus à écouter.
 */

/** Une journée et ce que le parc y a écrit. */
export type Journee<T> = {
  /** La clé du jour — l'ISO court, stable et triable. */
  readonly cle: string
  /** La date telle qu'elle se lit, déjà mise en forme par l'appelant. */
  readonly libelle: string
  /** Les actes du jour, dans l'ordre où l'appelant les a rangés. */
  readonly actes: readonly T[]
}

export function RegistreParJournee<T>({
  journees,
  cleDeLActe,
  rendreLActe,
}: {
  readonly journees: readonly Journee<T>[]
  /** L'identité d'un acte, pour React — jamais son rang. */
  readonly cleDeLActe: (acte: T) => string
  readonly rendreLActe: (acte: T) => ReactNode
}) {
  return (
    <ol className="flex flex-col gap-6">
      {journees.map((journee, rang) => {
        /*
          LE RANG ENTRE DANS L'IDENTITÉ, et ce n'est pas de la prudence vague :
          `parJournee` ne regroupe que les actes CONSÉCUTIFS, donc une liste qui
          cesserait d'être chronologique rendrait deux groupes portant la même
          date. Avec la seule date pour clé, React en perdrait un et les deux
          titres partageraient un `id` — un `aria-labelledby` qui désigne alors
          le premier venu. Le rang rend l'identité unique sans rien masquer du
          désordre, qui reste visible à l'écran.
        */
        const id = `journee-${journee.cle}-${rang}`
        return (
          <li key={id}>
            {/*
              LA DATE EST UN TITRE, PAS UNE CELLULE. C'est ce qui permet à un
              lecteur d'écran de sauter de journée en journée — le geste exact
              qu'on fait de l'œil en parcourant un registre, et que la colonne
              répétée rendait impossible.
            */}
            <h3 id={id} className="text-label font-semibold text-ink">
              {journee.libelle}
            </h3>
            {/*
              `border-s` SUR LA LISTE, pastilles sur les actes : le rail naît de
              la bordure du conteneur, donc il s'arrête exactement au dernier
              acte. Un trait posé en absolu devrait connaître sa hauteur, et la
              recalculerait à chaque ouverture.
            */}
            <ol aria-labelledby={id} className="mt-2 flex flex-col border-s border-divider">
              {journee.actes.map((acte) => (
                <li key={cleDeLActe(acte)} className="relative py-2.5 ps-4">
                  {/*
                    ═══ LA PASTILLE DU RAIL, RENDUE — LA DETTE EST PAYÉE ═══

                    Le premier jet en posait une par acte. Elle demandait des
                    utilitaires que la feuille PARTAGÉE ne portait pas, et le
                    premier chargement de la vitrine n'avait plus que QUINZE
                    OCTETS de marge : 159 985 pour 160 000. Trois règles de plus
                    l'ont fait passer à 160 039, et la porte a refusé — à juste
                    titre. Le commentaire qui la retirait finissait par « les
                    pastilles reviendront quand la marge existera ».

                    ELLE EXISTE. La scission du dictionnaire a sorti les mots des
                    écrans du paquet d'entrée : 133 364 octets pour un budget
                    ramené à 137 000. Ces règles-ci sont mesurées dans le lot, et
                    le relevé de poids porte leur prix.

                    DÉCORATIVE, ET IL FAUT QUE ÇA LE RESTE. `aria-hidden` : un
                    rail qui s'annoncerait serait dix-huit « puce » de plus à
                    écouter, sur un registre qu'on parcourt à rebours. Elle ne
                    porte aucun texte et ne dit rien que la date ne dise déjà.

                    AUCUNE TRANSFORMATION POUR LA CENTRER. Le décalage vertical
                    de moitié serait la façon courante, et ce dépôt l'a déjà
                    payée : une transformation, même d'un pixel, fait de son
                    élément le bloc conteneur de ses descendants `fixed` — et un
                    acte porte un menu qui s'échappe en `fixed`. Le décalage est
                    donc posé en dur.

                    ET IL EST MESURÉ, PAS CALCULÉ. Au navigateur, sur
                    `/demo/decisions` : centre du rail à 288,50, centre de la
                    pastille à 289,00 — un demi-pixel. Verticalement, centre de
                    la pastille à 298,49 contre 297,24 pour la première ligne de
                    l'acte : 1,25 px trop bas.

                    CES 1,25 PX RESTENT, ET C'EST UN ARBITRAGE. Les corriger
                    demanderait une graduation que la feuille PARTAGÉE ne porte
                    pas — donc une règle de plus, payée par la page d'accueil,
                    pour un écart sous le seuil où l'œil le voit. C'est
                    exactement l'échange que ce fichier a déjà refusé une fois.
                    DEUX règles neuves ont été nécessaires ici, et pas une de
                    plus ; leur prix est au relevé de poids du lot.

                    ET LE COMMENTAIRE COMPTE AUTANT QUE LE CODE : Tailwind v4
                    balaie les fichiers comme du TEXTE. Aucune classe n'est
                    nommée dans cette prose — l'y écrire la ferait entrer dans la
                    feuille, fût-ce pour expliquer qu'on ne l'emploie pas.
                  */}
                  <span
                    aria-hidden="true"
                    className="absolute -start-0.5 top-5 size-1 rounded-full bg-border-strong"
                  />
                  {rendreLActe(acte)}
                </li>
              ))}
            </ol>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * LES ACTES RANGÉS PAR JOURNÉE, SANS RIEN TRIER.
 *
 * L'ordre d'arrivée est conservé tel quel — l'appelant sert déjà le plus récent
 * d'abord, et un second tri ici pourrait le contredire en silence. On ne fait
 * que COUPER la suite là où la journée change.
 *
 * Deux actes du même jour SÉPARÉS par un autre jour formeraient donc deux
 * groupes portant la même date. C'est voulu : cela ne peut arriver que si la
 * liste n'est plus chronologique, et le dire à l'écran vaut mieux que de le
 * masquer en regroupant par date — ce qui réordonnerait l'histoire.
 */
export function parJournee<T>(
  actes: readonly T[],
  jourDe: (acte: T) => { readonly cle: string; readonly libelle: string },
): Journee<T>[] {
  const journees: Journee<T>[] = []
  for (const acte of actes) {
    const jour = jourDe(acte)
    const derniere = journees[journees.length - 1]
    if (derniere && derniere.cle === jour.cle) {
      ;(derniere.actes as T[]).push(acte)
    } else {
      journees.push({ cle: jour.cle, libelle: jour.libelle, actes: [acte] })
    }
  }
  return journees
}
