import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'

/**
 * CE QU'IL FAUT FAIRE, ET C'EST LA PREMIÈRE CHOSE QUE L'ÉCRAN DIT.
 *
 * ═══ LE DÉFAUT N'ÉTAIT PAS DANS LES COULEURS ═══
 *
 * Le tableau de bord ouvrait sur quatre indicateurs et un graphe de douze mois.
 * Il répondait donc à « où en est le parc » — une question d'inventaire — alors
 * que celui qui l'ouvre le matin en pose une autre : « qu'est-ce que je dois
 * traiter aujourd'hui ». Les deux réponses existaient déjà dans la page, mais
 * la seconde vivait en QUATRIÈME position, sous les chiffres et sous le graphe,
 * répartie entre deux cartes qui ne se savaient pas parentes — « ce qui demande
 * une décision » et « échéances du mois ».
 *
 * Une refonte de palette ne pouvait pas voir ce défaut, et sept lots ne l'ont
 * pas vu : un écran dont l'ordre est faux reste faux dans toutes les couleurs.
 *
 * ═══ CE QUE CETTE FILE EST, ET CE QU'ELLE N'EST PAS ═══
 *
 * Elle N'EST PAS un cinquième indicateur. Un indicateur se lit ; une entrée de
 * file se TRAITE, et disparaît quand elle l'est. C'est le critère d'admission,
 * et il est strict : une ligne n'entre ici que si elle nomme un travail qu'une
 * personne peut finir. « Taux d'occupation 83 % » n'est pas un travail. « Deux
 * cautions attendent votre arbitrage » en est un.
 *
 * Elle N'EST PAS une liste d'alertes non plus. Une alerte prévient d'un risque ;
 * ces lignes désignent une DÉCISION EN ATTENTE, c'est-à-dire quelqu'un — un
 * locataire, un artisan — que l'inaction laisse en suspens. D'où l'ordre :
 *
 *   1. l'argent dû, qui vieillit ;
 *   2. les arbitrages, qui BLOQUENT quelqu'un d'autre ;
 *   3. la saisie manquante, qui bloque la facturation du mois.
 *
 * ═══ LA FILE VIDE EST UN ÉTAT NORMAL, PAS UN ÉCRAN RATÉ ═══
 *
 * Un parc bien tenu n'a rien dans cette file, et c'est le seul écran du produit
 * où l'état vide est une BONNE nouvelle. Il faut donc qu'il se lise comme telle
 * — pas comme un chargement qui n'a pas abouti. Le corps dit ce que le vide
 * signifie, ce qu'aucune zone blanche ne saurait dire.
 */

/** Le ton d'une entrée : ce qu'elle coûte à laisser en attente. */
export type UrgenceDeFile = 'danger' | 'accent' | 'warn'

export interface EntreeDeFile {
  /** Sert de clé et de marqueur de mesure — voir `data-file`. */
  cle: string
  urgence: UrgenceDeFile
  icone: IconName
  /** Le TRAVAIL, en une phrase. Jamais un nombre seul. */
  titre: string
  /** Ce qui le situe : montants, ancienneté, unités concernées. */
  detail: string
  /** Le libellé du geste, et où il mène. */
  action: { libelle: string; to: string }
}

/**
 * Les trois tons, et pourquoi ce ne sont pas ceux des pastilles d'état.
 *
 * Une pastille peint un ÉTAT constaté — payé, en retard. Ici la couleur dit une
 * URGENCE, c'est-à-dire ce que l'attente coûte. Les deux se recoupent souvent et
 * ne sont pas la même chose : un devis à valider n'est ni un succès ni un échec,
 * c'est une porte fermée devant un artisan.
 *
 * Le trait vertical porte la couleur, pas le fond. Un lavis par ligne ferait de
 * la file une pile de bandeaux — et `Notice` existe déjà pour ça, une fois, pas
 * quatre de suite.
 */
const URGENCES: Record<UrgenceDeFile, { trait: string; pastille: string }> = {
  danger: { trait: 'bg-danger', pastille: 'bg-danger-tint text-danger' },
  accent: { trait: 'bg-accent', pastille: 'bg-accent-tint text-accent-ink' },
  warn: { trait: 'bg-warn', pastille: 'bg-warn-tint text-warn' },
}

export function FileDuJour({ entrees }: { entrees: EntreeDeFile[] }) {
  const t = useT()

  return (
    <Card
      /* `data-file` : la file doit être interrogeable autrement que par ses
         classes — même idiome que `data-indicateur` et `data-jauge`. Un cas qui
         vérifie « cet écran ouvre sur un travail » ne doit pas rougir au premier
         ajustement de mise en page. */
      data-file=""
      as="section"
      aria-labelledby="file-du-jour"
      flush
      elevation="e2"
      className="p-4 sm:p-5"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="file-du-jour" className="title-l">
          {t('app.dashboard.queueTitle')}
        </h2>
        {entrees.length > 0 && (
          /* Le compte est à DROITE et en gris : il situe la file, il ne la
             titre pas. Mis en avant, il redeviendrait l'indicateur que cette
             file remplace. */
          <p className="numeric shrink-0 text-body text-muted">
            {t('app.dashboard.queueCount', { count: entrees.length })}
          </p>
        )}
      </div>

      {entrees.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title={t('app.dashboard.queueEmptyTitle')}
          body={t('app.dashboard.queueEmptyBody')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {entrees.map((entree) => {
            const urgence = URGENCES[entree.urgence]
            return (
              <li
                key={entree.cle}
                data-file-entree={entree.cle}
                /*
                  `items-start`, ET LE BOUTON PASSE DESSOUS QUAND IL LE FAUT.

                  La première rédaction posait `items-center` et comptait sur
                  `flex-wrap` pour faire descendre le geste à l'étroit. Mesuré à
                  360 px : il ne descendait jamais. `flex-wrap` ne replie un
                  élément que s'il ne tient pas à sa taille MINIMALE — et la
                  colonne de texte portait `min-w-0`, donc elle acceptait de se
                  réduire indéfiniment. Le titre se lisait sur trois lignes de
                  dix caractères à côté d'un bouton intact.

                  `min-w-48` remplace `min-w-0` : la colonne de texte refuse de
                  descendre sous 192 px, ce qui force le repli au lieu de
                  l'écrasement. La carte offre 256 px de contenu à 320 px, la
                  borne y tient donc encore.

                  `items-start` suit du repli : une fois le geste passé dessous,
                  centrer alignerait la pastille sur le milieu d'un bloc de
                  quatre lignes, loin du mot qu'elle annonce. C'est l'idiome de
                  `Notice`, pour la même raison.
                */
                className={cn(
                  'relative flex flex-wrap items-start gap-x-3 gap-y-2',
                  'rounded-md border border-divider bg-surface-sunken py-3 pl-4 pr-3',
                )}
              >
                {/* Le trait de couleur, à gauche, sur toute la hauteur. Il donne
                    l'urgence sans peindre la ligne — et il est `aria-hidden` :
                    le TEXTE porte déjà ce qu'il faut faire, la couleur ne dit
                    rien de plus, ce qu'exige `couleur-non-seule`. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-y-2 left-0 w-1 rounded-full',
                    urgence.trait,
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md',
                    urgence.pastille,
                  )}
                >
                  <Icon name={entree.icone} size={17} />
                </span>

                <div className="min-w-48 flex-1">
                  {/* `hyphens-auto` sans `break-words` : le titre est une phrase
                      traduite, elle se coupe entre les mots. */}
                  <p className="text-body font-medium hyphens-auto">{entree.titre}</p>
                  {/*
                    NI `break-words` NI CÉSURE SUR LE DÉTAIL, et c'est mesuré.

                    Il portait les deux, et à 360 px il rendait « 466 000 FCF /
                    A retenus » — le montant coupé À L'INTÉRIEUR de sa devise.
                    `Intl.NumberFormat` pose une espace INSÉCABLE avant le
                    symbole, précisément pour que cela n'arrive pas ; `break-words`
                    passe outre et coupe n'importe où dès que la ligne est
                    serrée. Le dépôt connaît la règle et la répète ailleurs : un
                    montant est insécable de bout en bout, et le seul levier est
                    la largeur de la colonne. C'est ce que `min-w-48` règle
                    au-dessus.
                  */}
                  <p className="mt-0.5 text-body text-muted">{entree.detail}</p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  to={entree.action.to}
                  iconAfter="chevronRight"
                  className="shrink-0"
                >
                  {entree.action.libelle}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
