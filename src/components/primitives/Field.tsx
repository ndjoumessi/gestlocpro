import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { useT } from '@/i18n/I18nProvider'

export interface FieldProps {
  label: string
  /** Rendu avec l'`id`, `aria-describedby` et `aria-invalid` déjà câblés. */
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
  }) => ReactNode
  /** Texte d'aide persistant — pas un placeholder. */
  hint?: string
  error?: string
  /**
   * COMMANDE ATTACHÉE AU CHAMP, posée en regard de son libellé.
   *
   * Le cas réel : « Mot de passe oublié ? » sur l'écran de connexion. Il
   * flottait seul sur une ligne, aligné à droite, ENTRE le champ et le bouton
   * d'envoi — donc à mi-chemin des deux, n'appartenant visiblement ni à l'un ni
   * à l'autre, et séparant le dernier champ de l'action qui le suit, la seule
   * paire que l'œil doit lire d'un trait.
   *
   * Sur la ligne d'étiquette, il désigne sans ambiguïté le champ dont il parle,
   * et il ne coupe plus rien.
   */
  action?: ReactNode
  required?: boolean
  optional?: boolean
  className?: string
}

/**
 * Enveloppe de champ.
 *
 * Applique quatre règles d'un coup : label visible associé (jamais un
 * placeholder seul), aide persistante, erreur sous le champ et non en haut du
 * formulaire, et annonce de l'erreur via `role="alert"`.
 */
export function Field({
  label,
  children,
  hint,
  error,
  action,
  required,
  optional,
  className,
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const t = useT()

  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  /* Le CONTENU de l'étiquette, écrit une fois : la rangée et l'étiquette nue le
     rendent toutes deux, et deux copies auraient divergé au premier ajout. */
  const etiquette = (
    <>
      {label}
      {required && (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      )}
      {required && <span className="sr-only"> ({t('common.required')})</span>}
      {optional && (
        <span className="ml-1.5 font-normal text-muted">({t('common.optional')})</span>
      )}
    </>
  )

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/*
        LA RANGÉE N'EXISTE QUE S'IL Y A UNE COMMANDE, et ce n'est pas une
        économie de balisage.

        Une première rédaction enveloppait TOUJOURS l'étiquette, la classe de
        rangée n'étant posée que sous condition. Mesuré : treize à
        quatre-vingt-quatre pixels de défilement en plus sur six modales.
        L'étiquette était un élément de la pile flexible, donc blockifiée ;
        enveloppée dans un bloc, elle redevient en ligne et fabrique une boîte
        de ligne plus haute. Un conteneur « neutre » ne l'est pas.

        `items-center` ET NON `items-baseline` : mesuré aussi, l'alignement sur
        la ligne de base laissait la commande — 44 px de cible — dépasser de
        8 px sa rangée, en haut comme en bas. Une boîte alignée par sa base peut
        sortir de la sienne ; centrée, la rangée prend la hauteur de la plus
        haute.
      */}
      {action ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <label htmlFor={id} className="text-label font-semibold text-ink">
            {etiquette}
          </label>
          {action}
        </div>
      ) : (
        <label htmlFor={id} className="text-label font-semibold text-ink">
          {etiquette}
        </label>
      )}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {/*
        L'AIDE RESTE QUAND L'ERREUR ARRIVE, et le contrat de ce fichier le
        promettait déjà en toutes lettres : « aide PERSISTANTE ».

        Elle disparaissait au moment précis où elle sert — celui où l'on vient
        de se tromper. Pire, `aria-describedby` continuait de la citer : le
        champ désignait un identifiant ABSENT du DOM, et un lecteur d'écran
        n'annonçait donc ni l'aide, ni parfois l'erreur, selon qu'il abandonne
        ou poursuit la liste. Un appelant passe bien les deux au même champ —
        « Montant » de l'encaissement porte le montant dû en aide.

        L'ordre compte : l'aide d'abord, l'erreur ensuite et au plus près du
        champ. C'est celle qu'on vient de déclencher qui doit se lire en dernier.
      */}
      {hint && (
        <p id={hintId} className="text-body text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-body font-medium text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5" />
          {error}
        </p>
      )}
    </div>
  )
}

/** Styles partagés par input, select et textarea. */
export const controlClasses = (invalid?: boolean, className?: string) =>
  cn(
    'w-full rounded-md border bg-surface px-3 text-ink',
    // 16px en dessous de sm : évite le zoom automatique de Safari iOS au focus.
    'min-h-11 py-2.5 text-body-l sm:text-body',
    'placeholder:text-muted-soft',
    'transition-colors duration-150 ease-out',
    // PAS de `focus:outline-none` ici. Il y était, et il annulait l'anneau de
    // focus de TOUS les champs du produit — y compris ceux de l'inscription.
    // Ce n'est pas une affaire de spécificité mais de COUCHES : `*:focus-visible`
    // est déclaré dans `@layer base`, l'utilitaire atterrit dans `@layer
    // utilities`, et une couche déclarée plus tard l'emporte quoi qu'il arrive.
    // Il ne restait qu'un changement de bordure de 1px, à 1,33:1 sur le fond du
    // champ. Le même piège est documenté vingt lignes plus bas dans `tokens.css`
    // pour la bascule `.on-dark` — la leçon y avait été tirée, pas ici.
    'hover:border-border-strong focus:border-ink',
    invalid ? 'border-danger bg-danger-tint/40' : 'border-border',
    'disabled:cursor-not-allowed disabled:opacity-45',
    'read-only:bg-surface-sunken read-only:text-muted',
    className,
  )

/**
 * DEUX COLONNES DÈS QUE LA LARGEUR LE PERMET, une seule sur téléphone.
 *
 * Ce qu'elle appaire, ce sont des `Field` ENTIERS — libellé, aide, contrôle et
 * message d'erreur ensemble. C'est la seule façon d'appairer sans risque : le
 * geste interdit serait de mettre les libellés dans une colonne et les contrôles
 * dans l'autre, ce qui séparerait chaque libellé de son champ et chaque erreur
 * de sa cause. Ici la grille ne coupe rien : elle pose côte à côte deux blocs
 * déjà complets.
 *
 * `sm:` et non `md:` : mesuré, une modale `md` fait 576 px de large à partir de
 * 640 px de fenêtre, ce qui laisse deux colonnes de 264 px — assez pour un
 * champ de date ou un montant, qui sont précisément les champs qu'on appaire.
 * Sous 640 px la grille rend une seule colonne et le `gap` vertical reprend
 * exactement l'écart d'origine, donc rien ne bouge sur téléphone.
 *
 * Elle ne devine RIEN : c'est l'appelant qui décide quels champs vont ensemble,
 * parce que « période » et « versé le » se lisent comme une paire alors que
 * « logement » et « montant » n'ont rien à faire sur la même ligne.
 */
export function ChampsApparies({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('grid gap-5 sm:grid-cols-2', className)}>{children}</div>
}
