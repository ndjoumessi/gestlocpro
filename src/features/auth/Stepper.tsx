import { cn } from '@/lib/cn'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

export interface StepperProps {
  steps: string[]
  /** Index de l'étape courante, à partir de 0. */
  current: number
}

/**
 * Fil d'étapes.
 *
 * L'état de chaque étape passe par trois canaux : la forme (coche pour une
 * étape faite, numéro sinon), la couleur, et `aria-current` pour les lecteurs
 * d'écran.
 *
 * ═══ CE QU'UN TÉLÉPHONE NE VOYAIT PAS, MESURÉ AUX QUATRE ÉTAPES ═══
 *
 * Les libellés portaient `hidden … sm:block`. Relevé à 360 sur chacune des
 * quatre étapes : les quatre étaient à `width: 0`, TOUJOURS. Un téléphone ne
 * voyait donc que « 1 2 3 4 » et, au-dessus, « ÉTAPE 1 SUR 4 » — deux façons
 * d'écrire la même chose, et rien d'autre. « Votre rôle », « Votre identité »,
 * « Votre contexte », « Récapitulatif » n'existaient pas sous 640 px.
 *
 * C'est la perte, pas la place : un fil d'étapes ne sert pas à dire OÙ L'ON EST
 * — le titre de la page le dit déjà, et mieux — mais CE QUI ATTEND. Quelqu'un
 * qui hésite à commencer un formulaire de quatre écrans veut savoir ce qu'on va
 * lui demander. Quatre pastilles numérotées ne le lui disent pas, et l'ancienne
 * ligne de résumé le lui disait encore moins.
 *
 * C'est le même défaut que les colonnes `hideOnMobile` des écrans-tableaux, et
 * la même règle : un utilitaire responsif CACHE, il ne retire pas. Ici il
 * retirait, puisque rien d'autre ne portait ces quatre mots.
 *
 * ═══ CE QUE LA COLONNE CHANGE, ET CE QU'ELLE COÛTE ═══
 *
 * Sous `sm`, chaque étape devient une COLONNE — pastille au-dessus, libellé
 * dessous — et les quatre se partagent la largeur. Le fil rendu passe de 56 à
 * 62 px : six pixels pour quatre mots qui n'existaient pas.
 *
 * La ligne de résumé disparaît en échange. Elle n'a jamais existé au-delà de
 * `sm`, où les pastilles et `aria-current` portaient seuls la position ; la
 * garder sous `sm` maintenant que les libellés y sont aussi ferait dire deux
 * fois la même chose, ce qui était précisément le défaut.
 *
 * LE TRAIT DE LIAISON, lui, ne suit pas sous `sm` : il est `aria-hidden`, donc
 * décoratif, et entre deux colonnes il passerait au milieu des mots. Le retirer
 * ne retire aucune information — c'est la distinction qui rend légitime de le
 * masquer là où on ne masque pas les libellés.
 */
export function Stepper({ steps, current }: StepperProps) {
  const t = useT()

  return (
    <nav aria-label={t('auth.signup.title')} className="mb-8">
      {/* `items-start` sous `sm` : les colonnes n'ont pas la même hauteur — un
          libellé sur deux lignes voisine un libellé sur une —, et les centrer
          verticalement décalerait les pastilles les unes par rapport aux autres.
          Ce sont elles qui doivent s'aligner : c'est la ligne que l'œil suit. */
      }
      <ol className="flex items-start gap-1.5 sm:items-center sm:gap-2">
        {steps.map((label, index) => {
          const done = index < current
          const active = index === current

          return (
            <li
              key={label}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:flex-row sm:items-center sm:gap-2"
            >
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  'numeric text-caps font-semibold transition-colors duration-200',
                  done && 'bg-ok text-on-dark',
                  active && 'bg-ink text-on-dark',
                  !done && !active && 'border border-border-strong bg-surface text-muted',
                )}
              >
                {done ? <Icon name="check" size={13} strokeWidth={2.6} /> : index + 1}
              </span>

              {/*
                PAS DE `truncate` SOUS `sm`, et c'est le point du lot : une
                troncature rendrait « Récapitul… » là où l'on vient justement de
                rétablir le mot. La colonne fait 76 px à 360 ; les libellés y
                passent sur une ou deux lignes, centrés. Au-delà de `sm` la
                troncature revient, parce que le libellé y partage sa ligne avec
                la pastille et le trait, et qu'un retour à la ligne y casserait
                l'alignement du fil.

                `tracking-normal` ANNULE L'INTERLETTRAGE DE `text-caps`, et il a
                fallu le mesurer pour le voir : « Récapitulatif » débordait sa
                colonne de 6 px. Treize lettres sans césure possible, et
                `--text-caps--letter-spacing` vaut 0,07 em — soit 11 px de chasse
                ajoutée sur ce seul mot. Ce jeton est fait pour des CAPITALES,
                où l'interlettrage aère ; ces libellés sont en bas de casse, où
                il ne fait qu'élargir. On garde la taille, on rend la chasse.

                Le débordement était invisible à la garde de page : le mot dépasse
                DANS sa boîte, `scrollWidth` le sait, `document.scrollWidth` non.
                Mesuré colonne par colonne, pas au niveau du document.
              */}
              <span
                className={cn(
                  'w-full hyphens-auto text-center text-caps tracking-normal leading-tight',
                  'sm:w-auto sm:truncate sm:text-left sm:text-label sm:tracking-normal',
                  active ? 'font-semibold text-ink' : 'text-muted',
                )}
              >
                {label}
              </span>

              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'hidden h-px min-w-3 flex-1 transition-colors duration-200 sm:block',
                    done ? 'bg-ok' : 'bg-border',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
