import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  hint?: string
  error?: string
}

export function Checkbox({ label, hint, error, className, ...props }: CheckboxProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  /*
    L'ERREUR EST RATTACHÉE, et elle ne l'était pas.

    Le paragraphe de refus portait `role="alert"` mais AUCUN identifiant, et
    `aria-describedby` ne citait que l'aide. Le motif du refus n'était donc
    lié à rien : quiconque revient sur la case après coup — au clavier, ou
    en la relisant — n'entend que son libellé, jamais pourquoi elle bloque.
    C'est le refus de la case de confidentialité, à l'inscription, qui en
    dépend.

    L'aide persiste ici pour la même raison que dans `Field`, et les deux
    identifiants sont cités ensemble.
  */
  const decritPar = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* La zone cliquable couvre le label entier, pas seulement la case,
          et fait au moins 44px de haut. */}
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
        <span className="relative flex size-5 shrink-0 items-center justify-center">
          <input
            id={id}
            type="checkbox"
            aria-describedby={decritPar}
            aria-invalid={error ? true : undefined}
            className={cn(
              'peer size-5 cursor-pointer appearance-none rounded-sm border bg-surface',
              'transition-colors duration-150',
              'checked:border-ink checked:bg-ink',
              // Le liseré de contrôle, à 3:1 : sans lui la case est un carré
              // blanc sur du blanc — `-strong` ne tenait que 1,85:1.
              error ? 'border-danger' : 'border-border-control',
            )}
            {...props}
          />
          <Icon
            name="check"
            size={13}
            strokeWidth={2.6}
            className="pointer-events-none absolute text-on-dark opacity-0 peer-checked:opacity-100"
          />
        </span>
        <span className="text-body text-ink">{label}</span>
      </label>

      {hint && (
        <p id={hintId} className="pl-8 text-body text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 pl-8 text-body font-medium text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5" />
          {error}
        </p>
      )}
    </div>
  )
}

export interface RadioCardOption<T extends string> {
  value: T
  title: string
  description: string
  icon?: IconName
  /** Ligne d'appui affichée en bas de la carte, en mono. */
  footnote?: string
  /**
   * L'OPTION EXISTE MAIS NE PEUT PAS ÊTRE CHOISIE.
   *
   * Le cas réel : une pièce déjà demandée et sans réponse. Le serveur la refuse
   * — 409 `already_pending` — et l'écran doit dire la même chose AVANT le clic.
   *
   * C'EST UN VRAI `disabled`, ET C'EST TOUT L'INTÉRÊT. Un `input[type=radio]`
   * désactivé est sauté par les flèches, refusé au clic et annoncé comme
   * indisponible, sans qu'une ligne soit écrite. La copie manuelle que ce
   * variant remplace y avait perdu deux fois : sa navigation aux flèches
   * SÉLECTIONNAIT quand même l'entrée désactivée — le bouton d'envoi s'activait
   * alors et partait chercher le 409 qu'on voulait éviter —, et le groupe
   * entier devenait inatteignable à la tabulation quand c'était la PREMIÈRE
   * entrée qui était désactivée, puisque c'est elle qui portait le seul arrêt.
   */
  disabled?: boolean
}

export interface RadioCardsProps<T extends string> {
  /** Libellé du groupe — rendu en `<legend>`. */
  legend: string
  /** Masque visuellement la légende sans la retirer de l'arbre a11y. */
  hideLegend?: boolean
  name: string
  value: T | null
  onChange: (value: T) => void
  options: RadioCardOption<T>[]
  columns?: 1 | 2 | 3
  /**
   * `cartes` — une tuile par option : icône, titre, description, marque de
   * sélection. C'est la forme du choix de rôle à l'inscription, où chaque
   * option porte réellement une icône distincte et deux lignes d'explication.
   *
   * `puces` — une rangée de pastilles qui se replie, un mot par pastille.
   *
   * QUAND EMPLOYER `puces`, ET POURQUOI CE VARIANT EXISTE. Mesuré sur « Ouvrir
   * un chantier » : six corps de métier et trois urgences, tous avec
   * `description: ''` et sans icône, rendus en tuiles pleine largeur. Le corps
   * de la modale mesurait 1517 px pour une fenêtre de 484 — soit 1033 px de
   * défilement pour neuf mots. Et comme aucune option ne fournissait d'icône,
   * les six tuiles affichaient la MÊME icône de repli : une distinction promise
   * à l'œil, et démentie.
   *
   * La règle qui en sort : une option sans description ET sans icône n'a rien à
   * mettre dans une tuile. `puces` est alors la forme juste, et `cartes` est un
   * mensonge de mise en page.
   */
  variant?: 'cartes' | 'puces'
  /**
   * LE REFUS DU GROUPE, quand rien n'est choisi et qu'il fallait choisir.
   *
   * Un groupe de choix n'avait pas où l'écrire, alors que `Field` et `Checkbox`
   * le portent depuis toujours. L'écran d'inscription s'en passait en
   * ÉTEIGNANT son bouton — une porte fermée sans écriteau, qui ne prend pas le
   * focus et n'énonce rien.
   *
   * `role="alert"` et un identifiant cité par le `fieldset` : le refus est
   * annoncé quand il paraît, et rattaché au groupe pour qui y revient ensuite.
   */
  error?: string
  className?: string
}

/**
 * Cartes radio — utilisées pour le choix de rôle à l'inscription.
 * Sémantique `fieldset`/`legend` + vrais `input[type=radio]` : la navigation
 * clavier par flèches et l'annonce « 1 sur 3 » sont natives.
 */
export function RadioCards<T extends string>({
  legend,
  hideLegend,
  name,
  value,
  onChange,
  options,
  columns = 3,
  variant = 'cartes',
  error,
  className,
}: RadioCardsProps<T>) {
  if (variant === 'puces') {
    return (
      <RadioPuces
        legend={legend}
        hideLegend={hideLegend}
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        error={error}
        className={className}
      />
    )
  }
  const gridClass =
    columns === 1 ? 'grid-cols-1' : columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <fieldset
      data-champ={name}
      aria-describedby={error ? `${name}-refus` : undefined}
      aria-invalid={error ? true : undefined}
      className={cn('min-w-0 border-0 p-0', className)}
    >
      <legend className={cn('mb-3 text-label font-semibold text-ink', hideLegend && 'sr-only')}>
        {legend}
      </legend>

      {/* AVANT les cartes, et non après : le refus dit ce qu'il faut faire de
          ce qui suit. Placé dessous, il se lirait après le geste qu'il
          commande — et sous trois cartes, il tomberait hors du champ de vision
          sur un téléphone. */}
      {error && (
        <p
          id={`${name}-refus`}
          role="alert"
          className="mb-3 flex items-start gap-1.5 text-body font-medium text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {/* `data-rangee-de-pairs` : ces cellules SONT le même composant rendu N
          fois, et le blanc qu'une description plus longue impose aux autres est
          le prix de l'alignement, pas du gâchis — un choix dont les cartes ne
          finiraient pas ensemble ne se lit plus comme un choix.

          La sonde du blanc imposé ne peut pas l'établir seule : elle compare les
          classes, et une carte SÉLECTIONNÉE n'en partage que 67 % avec sa
          voisine — bordure, fond et ombre changent avec l'état. L'attribut dit
          ce que les classes taisent. Voir `MESURER_BLANC_IMPOSE`. */}
      <div data-rangee-de-pairs="" className={cn('grid gap-3', gridClass)}>
        {options.map((option) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={cn(
                'group relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4',
                'transition-[border-color,background-color,box-shadow] duration-150 ease-out',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                'has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
                checked
                  ? 'border-ink bg-surface shadow-e1'
                  : 'border-border bg-surface/60 hover:border-border-strong hover:bg-surface',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />

              {/*
                `justify-end` QUAND IL N'Y A PAS D'ICÔNE : sans tuile, la marque
                de sélection resterait collée à gauche, seule sur sa ligne.
              */}
              <div
                className={cn(
                  'flex items-start gap-3',
                  option.icon ? 'justify-between' : 'justify-end',
                )}
              >
                {/*
                  PAS D'ICÔNE DE REPLI, ET C'EST UN DÉFAUT QUI EXISTAIT.

                  La tuile rendait `option.icon ?? 'users'` : un appelant qui
                  n'en fournit aucune obtenait la MÊME silhouette sur toutes ses
                  cartes. Le variant `puces` a été écrit contre ce défaut et son
                  commentaire le nomme — « les six tuiles affichaient la même
                  icône de repli : une distinction promise inexistante » — mais
                  le correctif n'avait pas traversé jusqu'au variant en tuiles,
                  où les trois urgences de la modale de signalement portaient
                  trois fois le même glyphe.

                  Sans icône, pas de tuile : une carte sans repère est plus
                  honnête qu'une carte qui en promet un faux.
                */}
                {option.icon && (
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
                    // `accent-on-ink` et non l'accent de marque : sur
                    // `--color-ink`, qui s'inverse avec le thème, un accent figé
                    // ne peut pas tenir des deux côtés à la fois. L'or d'alors
                    // tombait à 2,33:1 en sombre, et l'icône de la tuile
                    // SÉLECTIONNÉE devenait l'élément le moins lisible de la
                    // carte. Le bleu qui a remplacé l'or ne change rien à la
                    // règle — il ne bascule pas davantage avec le thème — et seul
                    // `accent-on-ink`, qui porte une valeur par thème, suit
                    // l'encre sur laquelle il est posé.
                    checked ? 'bg-ink text-accent-on-ink' : 'bg-surface-sunken text-muted',
                  )}
                >
                  <Icon name={option.icon} size={18} />
                </span>
                )}

                {/* Marque de sélection : forme + couleur, jamais la couleur seule. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150',
                    checked ? 'border-ink bg-ink text-on-dark' : 'border-border-control',
                  )}
                >
                  {checked && <Icon name="check" size={11} strokeWidth={3} />}
                </span>
              </div>

              <span className="title-m text-ink">{option.title}</span>
              <span className="text-body text-muted">{option.description}</span>

              {option.footnote && (
                <span className="eyebrow mt-1 border-t border-divider pt-2.5 text-muted">
                  {option.footnote}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * PASTILLES RADIO — un mot par option, sur une rangée qui se replie.
 *
 * MÊME SÉMANTIQUE QUE LES TUILES, et c'est la condition pour que ce soit un
 * variant et non un autre composant : `fieldset`/`legend`, de vrais
 * `input[type=radio]` d'un même `name`. La navigation aux flèches, l'annonce
 * « 2 sur 6 » et le groupement sont donc natifs, exactement comme avant. Rien
 * de ce que le clavier ou le lecteur d'écran obtenait n'est perdu ; c'est la
 * PLACE qui change.
 *
 * LA SÉLECTION N'EST PAS PORTÉE PAR LA COULEUR SEULE. La pastille retenue prend
 * l'encre ET une coche : c'est la règle du dépôt, et elle vaut ici comme sur la
 * grille des paiements — sous deutéranopie, deux teintes de statut sont à 3,4
 * de ΔE00, c'est-à-dire le même aplat. La coche est `aria-hidden` : l'état
 * coché est déjà annoncé par le radio lui-même, et le redire en ferait deux.
 *
 * `min-h-11` : une pastille est une cible, pas une étiquette. 44 px, comme tout
 * ce qu'on touche dans ce produit.
 *
 * L'ICÔNE, SI ELLE EXISTE, EST RENDUE. Une option qui en fournit une distincte
 * mérite qu'on la montre ; ce que ce variant refuse, c'est l'icône de REPLI —
 * la même pour toutes, qui promet une distinction inexistante.
 */
function RadioPuces<T extends string>({
  legend,
  hideLegend,
  name,
  value,
  onChange,
  options,
  error,
  className,
}: Omit<RadioCardsProps<T>, 'columns' | 'variant'>) {
  return (
    <fieldset
      data-champ={name}
      aria-describedby={error ? `${name}-refus` : undefined}
      aria-invalid={error ? true : undefined}
      className={cn('min-w-0 border-0 p-0', className)}
    >
      <legend className={cn('mb-2 text-label font-semibold text-ink', hideLegend && 'sr-only')}>
        {legend}
      </legend>

      {/* LE REFUS VAUT POUR LES DEUX VARIANTES. Ne le poser que sur les tuiles
          aurait laissé muettes les rangées de pastilles — dont la demande de
          pièce du locataire, qui est justement l'un des deux boutons éteints
          que ce lot corrige. */}
      {error && (
        <p
          id={`${name}-refus`}
          role="alert"
          className="mb-2 flex items-start gap-1.5 text-body font-medium text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-md border px-3',
                'text-label transition-colors duration-150',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                'has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
                /* L'ÉTAT INDISPONIBLE SE VOIT, et il ne se voit pas comme un
                   choix pâle : le curseur le dit aussi. Même écriture que la
                   copie qu'il remplace, pour que rien ne change à l'œil. */
                option.disabled
                  ? 'cursor-not-allowed opacity-55'
                  : 'cursor-pointer',
                checked
                  ? 'border-ink bg-ink text-on-dark'
                  : 'border-border bg-surface text-ink hover:border-border-strong',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {/* Forme ET couleur : la coche dit le choix à qui ne distingue pas
                  l'encre du fond. `aria-hidden`, l'état est déjà annoncé. */}
              {checked && <Icon name="check" size={13} strokeWidth={3} aria-hidden="true" />}
              {option.icon && !checked && <Icon name={option.icon} size={14} />}
              {option.title}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Bascule segmentée à deux états — mensuel/annuel, solo/délégué.
 *
 * ═══ LA PASTILLE SE DÉPLACE, ELLE NE CLIGNOTE PLUS ═══
 *
 * Le fond `bg-ink` vivait SUR le bouton actif, et changeait donc d'élément à
 * chaque bascule : l'ancienne pastille s'effaçait pendant que la nouvelle
 * apparaissait, en `transition-colors`. Deux objets se croisaient dans un
 * fondu là où l'utilisateur en attend UN qui se déplace — c'est précisément le
 * cas où un fondu se lit comme un défaut, parce que l'œil voit les deux états
 * en même temps au lieu d'une seule chose qui bouge.
 *
 * C'est aussi le seul mouvement de la page de tarifs, à l'endroit où le
 * prospect compare deux prix : la bascule doit dire « je suis passé LÀ », pas
 * « quelque chose a changé de couleur ».
 *
 * ═══ POURQUOI UNE GRILLE, ET NON UNE MESURE ═══
 *
 * Un indicateur glissant se pose d'ordinaire en `absolute`, sa position lue au
 * `offsetLeft` du bouton actif. Cette écriture-là ne peut pas vivre ici : jsdom
 * ne fait aucune mise en page — `offsetWidth` y vaut zéro — et l'indicateur
 * serait donc invisible et INVÉRIFIABLE dans toute la suite de tests, sur un
 * dépôt dont les gardes sont la doctrine.
 *
 * Les segments sont donc ÉGAUX (`flex-1 basis-0 min-w-0`), l'indicateur vaut
 * `(100 % − rembourrage) / N` de la boîte de rembourrage, et il se déplace de
 * `n × 100 %` de SA PROPRE largeur — c'est-à-dire exactement d'un segment.
 * Aucune mesure, aucune dépendance à la mise en page, un calcul juste par
 * construction. Les trois appels du dépôt portent deux options aux libellés
 * courts (entrée/sortie, mineure/majeure, mensuel/annuel) : l'égalité des
 * segments y rend la bascule symétrique, ce qu'un sélecteur à deux états doit
 * être.
 *
 * ═══ POURQUOI `flex` ET NON `grid`, QUI DISAIT LA MÊME CHOSE ═══
 *
 * La première écriture posait une grille — `inline-grid auto-cols-fr`, les
 * boutons et l'indicateur placés en colonnes explicites. Elle rendait le même
 * pixel, et elle SORTAIT DU CHAMP DE `ecarts.test.ts` : ce contrôle-ci y était
 * inscrit comme tolérance motivée, et la garde ne reconnaît une rangée qu'à un
 * `flex`. Passer en grille faisait donc disparaître le contrôle de la garde
 * sans que rien ne rougisse — on ne quitte pas une garde par un changement de
 * mise en page, surtout quand c'est la garde elle-même qui signale que la
 * tolérance ne couvre plus rien.
 *
 * `gap-0` EST ÉCRIT, et ce n'est pas un vide décoratif : un écart absent n'est
 * pas lu par la garde — elle cherche un `gap-N` — alors qu'un zéro EXPLICITE
 * la fait rougir, et c'est la tolérance qui répond. Le contrôle reste donc
 * examiné, avec son motif, au lieu d'être invisible.
 *
 * RÉSERVE ÉCRITE : la garde ignore les rangées en `grid`. Deux sites du dépôt
 * y échappent pour de bon — les deux grilles de mois de `DatePicker` (`grid
 * grid-cols-4 gap-1`), quatre pixels entre des boutons voisins, c'est-à-dire
 * le défaut que cette garde nomme. Mesuré le 2026-09-25 en élargissant le
 * motif à `flex|grid` : deux sites révélés, ceux-là. Élargir la garde et
 * reprendre la géométrie du calendrier est un lot à soi — il touche des
 * plafonds de hauteur qui se mesurent au navigateur.
 *
 * `ease-in-out` ET NON `ease-out` : la pastille ne fait ni entrée ni sortie,
 * elle TRAVERSE. Le jeton du dépôt est l'easeInOutQuint, écrit pour ce cas —
 * voir son commentaire dans `tokens.css`. `duration-200` reste sous le plafond
 * que `durees.test.ts` défend, et la règle globale de `prefers-reduced-motion`
 * la ramène à l'instantané sans qu'on ait à la redire ici.
 *
 * `relative` SUR LES BOUTONS, ET RIEN DE PLUS : un `transform` peint dans la
 * couche des descendants positionnés, si bien que l'indicateur passerait
 * par-dessus le texte qu'il est censé porter. `relative` y fait monter les
 * boutons à leur tour, et DANS cette couche c'est l'ordre du document qui
 * tranche — ils viennent après. Un `z-10` y a été écrit puis retiré :
 * `altitudes.test.ts` l'a refusé à raison, une altitude en clair ne dit pas
 * contre quoi elle se compare, et il ne servait à rien que l'ordre du document
 * ne fasse déjà.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; badge?: string }[]
  className?: string
}) {
  const indice = options.findIndex((option) => option.value === value)
  const part = 100 / options.length

  /*
    LE DÉCOUPAGE, EN POURCENTAGES DE LA PISTE.

    `inset()` mange depuis chaque bord : on garde la tranche du segment actif en
    rognant `indice` parts à gauche et tout le reste à droite. Les segments
    étant égaux, ces deux nombres sont de l'arithmétique pure — aucune mesure,
    donc rien qui dépende d'une mise en page que jsdom ne fait pas.

    `round` : sans lui, le découpage rendrait des angles droits là où il coupe,
    et la pastille perdrait ses coins sur ses bords intérieurs.
  */
  const decoupe =
    indice < 0
      ? undefined
      : `inset(0 ${((options.length - 1 - indice) * part).toFixed(4)}% 0 ${(indice * part).toFixed(4)}% round 0.25rem)`

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'relative inline-flex items-stretch gap-0 rounded-md border border-border bg-surface p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            /* `flex-1 basis-0 min-w-0` : les segments se partagent la largeur à
               ÉGALITÉ, ce dont dépend l'arithmétique du découpage ci-dessus.
               Sans `min-w-0`, le plancher de contenu d'un segment plus long —
               la remise « −20 % » — l'emporterait et les rendrait inégaux. */
            'flex-1 basis-0 min-w-0',
            /* `min-h-11` EST ÉCRIT ICI, et non rangé dans `SEGMENT` avec le
               reste : `cibles.test.ts` exige que le plancher de 44 px se lise
               sur la balise même, et refuse `cn()` comme délégation — à
               raison, puisque `cn` ne délègue rien, il fusionne des classes
               que le lecteur de la balise est censé voir. La constante l'avait
               caché, et la garde l'a dit. Il n'appartient de toute façon qu'au
               bouton : les libellés de la couche active s'étirent sur la
               hauteur que ces boutons dictent. */
            'min-h-11 cursor-pointer',
            SEGMENT,
            /* Tous les segments sont peints INACTIFS ici, l'actif compris : ce
               qu'on voit de lui est la couche du dessus. D'où l'absence de
               branche `active` — elle vivait ici et c'est précisément ce qui a
               rougi. */
            'text-muted transition-colors duration-150 ease-out hover:text-ink',
          )}
        >
          {option.label}
          {option.badge && <Remise ton="pale">{option.badge}</Remise>}
        </button>
      ))}

      {/*
        ═══ LA COUCHE ACTIVE EST UNE COPIE DÉCOUPÉE, ET NON UNE PASTILLE NUE ═══

        Première écriture : un `<span>` d'encre en `absolute`, glissé en
        `translateX` sous des libellés qui, eux, changeaient de couleur sur
        place. Elle rendait le bon pixel et `mesure-ui` l'a refusée — dix
        formes sous le seuil, « blanc sur blanc », à 360 px dans les deux
        langues et sur trois surfaces du modal d'état des lieux.

        LE REFUS ÉTAIT JUSTE, ET CE N'ÉTAIT PAS UN ARTEFACT DE SONDE. Le fond
        qui rend le libellé actif lisible n'était plus son ANCÊTRE mais un
        frère posé derrière : la couleur du texte et celle de son support
        avaient cessé d'être solidaires. Tout ce qui empêche le frère de
        peindre — couleurs forcées, impression, une règle de plus dans la
        cascade — laissait alors du blanc sur du blanc. Une garde qui lit
        l'ascendance lisait donc la vraie fragilité, pas une approximation.

        La copie la referme. La couche porte `bg-ink` ET ses libellés en
        `text-on-dark` : le contraste est de nouveau une propriété d'un seul
        objet, vérifiable là où il est écrit. Le découpage la réduit au segment
        actif, et l'animer déplace le fond AVEC son texte — un seul objet qui
        se déplace, ce que la pastille nue ne pouvait pas faire puisque ses
        libellés, restés en bas, ne pouvaient que se teinter en fondu.

        ELLE EST APRÈS LES BOUTONS DANS LE DOCUMENT, et c'est ce qui la fait
        peindre au-dessus : positionnée, donc dans la couche des descendants
        positionnés, où l'ordre du document tranche. Aucune altitude écrite —
        `altitudes.test.ts` l'a déjà refusée une fois ici.

        `aria-hidden` ET `pointer-events-none` : les vrais boutons sont
        dessous, avec leur `aria-pressed`. Cette couche ne se lit ni ne se
        clique — elle se regarde.
      */}
      {decoupe && (
        <div
          aria-hidden="true"
          data-pastille-segmentee=""
          style={{ clipPath: decoupe }}
          className={cn(
            'pointer-events-none absolute inset-0.5 flex items-stretch gap-0',
            'rounded-sm bg-ink',
            'transition-[clip-path] duration-200 ease-in-out',
          )}
        >
          {options.map((option) => (
            <span
              key={option.value}
              className={cn('flex-1 basis-0 min-w-0', SEGMENT, 'text-on-dark')}
            >
              {option.label}
              {option.badge && <Remise ton="plein">{option.badge}</Remise>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * La géométrie d'un segment, partagée par les DEUX couches.
 *
 * Elles doivent s'aligner au pixel : le moindre écart de rembourrage entre la
 * copie et l'original décalerait le libellé actif au moment où le découpage le
 * révèle. Une constante plutôt que deux listes de classes jumelles, parce que
 * deux listes jumelles finissent par diverger.
 */
const SEGMENT = 'inline-flex items-center justify-center gap-1.5 px-3.5 text-label font-semibold'

/**
 * La pastille de remise, dans ses deux tons.
 *
 * Elle suit l'accent unique — elle était en vert de succès, seule tache de
 * couleur restante sur la landing une fois les autres neutralisées. Le ton
 * plein est celui de la couche active, où elle se détache de l'encre ; le ton
 * pâle celui des boutons du dessous.
 */
function Remise({ ton, children }: { ton: 'plein' | 'pale'; children: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 numeric text-label',
        ton === 'plein' ? 'bg-accent text-on-accent' : 'bg-accent-tint text-accent-ink',
      )}
    >
      {children}
    </span>
  )
}
