import { useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { JaugeDePoste, StatusPill, type EtatDePoste, type StatusTone } from './StatusPill'
import { Icon, type IconName } from './Icon'

/**
 * Graphes maison, en DOM et en SVG.
 *
 * Trois exigences les gouvernent, dans cet ordre.
 *
 * 1. **Lisibles sans interaction.** Chaque graphe est doublé d'une alternative
 *    textuelle — un `<table>` en `sr-only` pour l'histogramme, une légende
 *    chiffrée pour l'anneau. Un lecteur d'écran obtient les valeurs exactes,
 *    pas « graphique ».
 * 2. **Interrogeables sans souris.** Les barres et les parts sont des boutons :
 *    on les atteint à la tabulation, et l'infobulle s'ouvre au focus comme au
 *    survol. Une infobulle qui ne répond qu'au survol n'existe ni au clavier
 *    ni au doigt.
 * 3. **Réductibles.** Douze étiquettes de mois ne tiennent pas sur 375px : une
 *    sur deux est retirée sous le premier point de rupture, plutôt que toutes
 *    tronquées à « SE… ».
 */

/**
 * Teintes de séries, prises dans l'échelle de données et non dans les couleurs
 * de marque : l'or `--color-gold` ne tient que 2,87:1 sur blanc, sous le seuil
 * de 3:1 exigé d'une donnée. Les trois retenues sont espacées en clarté
 * (28 %, 18 %, 13 %) pour rester distinctes en niveaux de gris.
 *
 * LA PLUS GRANDE SURFACE PORTE LE MOINS DE POIDS, et c'est l'inverse qui était
 * fait. Le loyer représente environ 90 % de chaque colonne ; il prenait
 * `--color-data-1`, la teinte la plus sombre de l'échelle — 1 % de clarté, soit
 * un quasi-noir. Douze colonnes remplies à 90 % de quasi-noir font un mur : on
 * ne compare plus les mois entre eux, la ligne d'objectif se perd dessus, et
 * l'eau comme l'électricité se réduisent à des filets de deux ou trois pixels
 * qu'aucune couleur ne sauve.
 *
 * Le poids visuel se multiplie par la surface. Une série qui occupe presque
 * toute la colonne doit donc être la plus DISCRÈTE des trois — elle est déjà
 * lue par sa taille — et les teintes franches vont aux petites, qu'il faut
 * pouvoir trouver. D'où l'ordre inversé : le loyer prend la plus claire de
 * l'échelle, l'eau et l'électricité les deux plus tranchées.
 *
 * Les trois tiennent le seuil sur le fond de carte, dans les deux thèmes :
 * 3,16 / 4,50 / 5,82 en clair, 7,84 / 7,94 / 6,34 en sombre.
 *
 * La règle vaut au-delà des séries, et ce fichier l'a longtemps contredite :
 * une colonne mise en avant, une ligne d'objectif et un remplissage de
 * progression portent de l'information tout autant qu'une série. Là où la
 * couleur de marque doit rester lisible, c'est `--color-gold-ink` qui sert —
 * même famille, 4,80:1 au pire des fonds. `orDonnee.test.ts` relit ce fichier
 * et refuse le retour de l'or nu.
 */
const SERIES_COLORS: Record<string, string> = {
  rent: 'var(--color-data-6)',
  water: 'var(--color-data-4)',
  power: 'var(--color-data-3)',
}

/**
 * Les mêmes séries, pour l'INFOBULLE — dont le fond reste SOMBRE dans les deux
 * thèmes.
 *
 * La pastille « Loyer » avait disparu, et pour la pire des raisons : en thème
 * clair, `--color-data-1` vaut `#14201e`, soit exactement la valeur de
 * `--color-ink` dont l'infobulle fait son fond. La pastille était peinte, à la
 * bonne taille, à la bonne place — de la couleur du fond. « Eau » et
 * « Électricité », teintes moyennes, s'en tiraient ; seule la série la plus
 * sombre s'effaçait, et une ligne sur trois perdait son repère sans que rien ne
 * signale l'absence.
 *
 * La bascule `.on-dark` ne pouvait pas rattraper le coup : elle redirige des
 * CLASSES utilitaires — `.text-muted`, `.text-ink` — et la pastille reçoit sa
 * couleur par un `style` en ligne, hors de portée de toute règle CSS.
 *
 * Le piège est de croire que ce fond bascule. `--color-ink` s'inverse bien avec
 * le thème — mais la classe `.on-dark`, que l'infobulle porte, la REFIXE à sa
 * valeur sombre pour tout ce qui vit dessous. L'infobulle est donc de celles
 * « qui restent sombres », et c'est précisément le public des jetons
 * `-on-dark`, identiques dans les trois blocs de palette.
 *
 * L'erreur a été commise puis corrigée : des jetons `-on-ink` inversants ont
 * d'abord remplacé ceux-ci, ce qui réparait le thème clair et rendait la
 * pastille invisible en sombre — le même défaut, déplacé. La leçon tient en une
 * ligne : le fond d'un composant se lit là où il est PEINT, pas dans la palette
 * dont il tire son nom.
 */
const SERIES_COLORS_ON_DARK: Record<string, string> = {
  rent: 'var(--color-data-6-on-dark)',
  water: 'var(--color-data-4-on-dark)',
  power: 'var(--color-data-3-on-dark)',
}

/**
 * La HACHURE d'une période encore OUVERTE.
 *
 * Cette distinction se portait par l'ALPHA : la dernière colonne était peinte à
 * 0,55 AU REPOS, sans qu'aucune interaction ne soit en cours. Une opacité n'est
 * pas un signe, c'est un affaiblissement — elle rapproche la marque de son fond
 * au lieu de lui ajouter du sens. Mesuré sur la carte claire, les trois séries y
 * tombaient à 1,78:1, 2,09:1 et 2,35:1, sous le seuil de 3:1 qu'un élément non
 * textuel porteur de sens doit tenir ; en sombre l'électricité restait à 2,91:1.
 * Le mois le plus récent — celui qu'on vient regarder — était donc le moins
 * lisible des douze.
 *
 * La hachure dit la même chose sans rien retirer : chaque bande garde la teinte
 * à PLEINE FORCE, donc son ratio, et c'est l'alternance qui porte le sens. Elle
 * survit au niveau de gris et à l'impression, ce qu'une opacité ne fait pas.
 *
 * Les creux prennent la couleur de la carte plutôt que d'être transparents : la
 * colonne croise la ligne d'objectif, et un vrai trou y laisserait passer le
 * trait doré au milieu de la donnée.
 */
function hachureOuverte(couleur: string): string {
  return `repeating-linear-gradient(-45deg, ${couleur} 0 5px, var(--color-surface) 5px 7px)`
}

function formatMax(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k`
  return String(value)
}

export interface StackedBar {
  label: string
  segments: { key: string; value: number }[]
}

export function StackedBarChart({
  bars,
  seriesLabels,
  secondaires = [],
  caption,
  /** Ligne de repère horizontale, p. ex. l'objectif attendu. */
  target,
  targetLabel,
  /** Note affichée dans l'infobulle pour la dernière colonne. */
  openPeriodNote,
}: {
  bars: StackedBar[]
  seriesLabels: Record<string, string>
  /**
   * LES SÉRIES QUI VONT DANS LE SECOND TRACÉ, ET POURQUOI IL EN FAUT UN.
   *
   * LE DÉFAUT MESURÉ. Loyer, eau et électricité étaient EMPILÉS sur une seule
   * échelle. Relevé sur les onze largeurs : le loyer rendait 140 à 171 px, l'eau
   * 8,7 à 10,5, l'électricité 7,4 à 9,2 — et le plus fin segment de la série,
   * sur le mois encore ouvert, faisait 0,1 px. Deux séries sur trois valaient
   * 5 à 6 % de la troisième. Un empilement dont deux tiers sont invisibles
   * n'encode rien : il décore.
   *
   * POURQUOI PAS UN PLANCHER DE HAUTEUR. `cibles.test.ts` l'interdit, et il a
   * raison : « la hauteur est la donnée, lui imposer un plancher mentirait sur
   * la mesure ». Un plancher rendrait 62 000 et 48 000 de la même taille.
   *
   * POURQUOI DEUX TRACÉS PLUTÔT QU'UNE PILE. Ce ne sont pas deux sommes de même
   * nature. Le loyer est un REVENU ; l'eau et l'électricité sont des avances
   * RÉCUPÉRÉES, que le bailleur a payées puis refacturées. Les additionner
   * gonfle l'encaissement d'un montant qui ne lui appartient pas — et la ligne
   * d'objectif le disait déjà sans qu'on l'entende : `expected` est la somme des
   * LOYERS des logements occupés, jamais des charges. La pile se comparait donc
   * à un objectif qui n'en couvrait qu'un tiers de séries.
   *
   * LA HAUTEUR TOTALE NE BOUGE PAS. Le second tracé n'est pas ajouté sous le
   * premier, il est PRIS DESSUS : 198 px de zone deviennent 126 pour le loyer,
   * 8 de gouttière et 64 pour les charges. Le loyer passe de 171 à 126 px — il
   * reste parfaitement lisible —, l'eau et l'électricité de 9 à une trentaine.
   * Le tableau de bord ne grandit pas d'un pixel.
   */
  secondaires?: string[]
  caption: string
  target?: number
  targetLabel?: string
  openPeriodNote?: string
}) {
  const { money } = useCurrency()
  const t = useT()
  const titleId = useId()

  /** Séries masquées depuis la légende. */
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  /** Colonne survolée ou focalisée ; `null` quand rien n'est visé. */
  const [active, setActive] = useState<number | null>(null)

  /**
   * La colonne que la lecture affiche : celle qu'on vise, à défaut la dernière.
   *
   * Sans ce repli, la lecture serait vide tant que personne ne survole — et
   * n'apprendrait donc rien à qui regarde simplement l'écran. La plus récente
   * est la seule réponse juste à « et alors, ce mois-ci ? », qui est la
   * question qu'on se pose devant un graphe d'encaissements.
   */
  const lu = active ?? bars.length - 1

  const seriesKeys = bars[0]?.segments.map((s) => s.key) ?? []
  const visible = (key: string) => !hidden.has(key)

  /* DEUX GROUPES, DEUX ÉCHELLES. `secondaires` nomme les séries qui descendent
     dans le tracé du bas ; tout le reste monte dans celui du haut. La légende,
     la lecture fixe et la table restent entières : c'est la seule ÉCHELLE qui
     se dédouble, pas le vocabulaire. */
  const clesPrimaires = seriesKeys.filter((k) => !secondaires.includes(k))
  const clesSecondaires = seriesKeys.filter((k) => secondaires.includes(k))
  const aDeuxTraces = clesSecondaires.length > 0

  const sommeDe = (bar: StackedBar, cles: string[]) =>
    bar.segments.reduce(
      (sum, s) => (hidden.has(s.key) || !cles.includes(s.key) ? sum : sum + s.value),
      0,
    )

  const totalsPrimaires = useMemo(
    () => bars.map((bar) => sommeDe(bar, clesPrimaires)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bars, hidden, clesPrimaires.join()],
  )
  const totalsSecondaires = useMemo(
    () => bars.map((bar) => sommeDe(bar, clesSecondaires)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bars, hidden, clesSecondaires.join()],
  )
  /** Le total de TOUTES les séries visibles — ce que lit la bande de lecture. */
  const totals = useMemo(
    () =>
      bars.map((bar) =>
        bar.segments.reduce((sum, s) => (hidden.has(s.key) ? sum : sum + s.value), 0),
      ),
    [bars, hidden],
  )

  /**
   * La ligne d'objectif compare un total encaissé à un total attendu. Dès
   * qu'une série est masquée, elle ne se rapporte plus à ce qui est tracé : on
   * la retire, et surtout on la retire du calcul de l'échelle.
   *
   * Sans cette seconde partie, masquer « Loyer » laissait le maximum calé sur
   * l'objectif — 1 415 000 — et les deux séries restantes s'écrasaient à 7 %
   * de la hauteur. La légende donnait donc l'illusion d'un bug d'affichage
   * alors qu'elle venait de faire exactement ce qu'on lui demandait.
   */
  const showTarget = target !== undefined && hidden.size === 0

  /**
   * L'échelle ne se cale que sur ce qui est effectivement tracé — et il y en a
   * DEUX quand le second tracé existe.
   *
   * L'objectif ne pèse que sur l'échelle du HAUT, et c'est ce qui remet une
   * incohérence d'aplomb : `expected` est la somme des LOYERS des logements
   * occupés, jamais des charges. La pile se comparait donc à un objectif qui
   * ne couvrait qu'une de ses trois séries.
   */
  const max = Math.max(...totalsPrimaires, showTarget ? target : 0, 1) * 1.08
  const maxSecondaire = Math.max(...totalsSecondaires, 1) * 1.08

  const toggleSeries = (key: string) =>
    setHidden((current) => {
      const next = new Set(current)
      // La dernière série visible ne se masque pas : un graphe vide n'apprend
      // rien et laisse l'utilisateur devant un cadre d'axes sans données.
      if (next.has(key)) next.delete(key)
      else if (seriesKeys.filter(visible).length > 1) next.add(key)
      return next
    })

  return (
    <figure className="m-0" aria-labelledby={titleId}>
      {/*
        LA NOTE DE PÉRIODE OUVERTE VIT ICI, EN PERMANENCE, ET C'EST UN CORRECTIF.

        Elle était portée par `LectureFixe` et n'existait QUE pour la dernière
        colonne : survoler décembre après novembre ajoutait une ligne à la bande,
        et tout ce qui suit dans la page descendait de 17 px sur téléphone, de
        26 px au-delà. Mesuré : 0,126 à 0,310 de décalage cumulé à l'interaction
        selon la largeur, quand le seuil est 0,1 — la page bougeait sous le
        pointeur.

        Deux gestes en un. La hauteur de la bande cesse de dépendre de la colonne
        visée, donc plus rien ne se déplace. Et la note devient LISIBLE SANS
        SURVOL : ce qu'elle explique — la trame de la dernière colonne — est une
        propriété du graphique, vraie qu'on le survole ou non, et sur un
        téléphone il n'y a pas de survol. Une explication qu'il faut viser pour
        obtenir n'explique rien à qui tient l'appareil du marché visé.
      */}
      {openPeriodNote && (
        <p className="mb-2 text-body text-muted">{openPeriodNote}</p>
      )}

      {/* Légende interrogeable : chaque entrée masque ou rétablit sa série. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {seriesKeys.map((key) => {
          const shown = visible(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleSeries(key)}
              aria-pressed={shown}
              className={cn(
                // 44px : les entrées de légende SONT des commandes — elles
                // masquent et rétablissent une série. À 36px elles restaient
                // sous le minimum tactile, sur un produit dont la cible est un
                // Android d'entrée de gamme tenu à une main.
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 -mx-0.5',
                // `text-muted` dans les deux états : `-soft` (4,33 sur
                // --surface en sombre) est réservé au texte >=18px ou au
                // non-textuel, jamais à ce libellé de 14px — voir tokens.css.
                'text-body text-muted transition-colors duration-150 hover:bg-surface-sunken',
              )}
            >
              {/* Une série masquée passe en CONTOUR, jamais en transparence.
                  À 0,25 d'opacité la pastille retombait sous 1,3:1 sur la carte :
                  « masquée » se lisait « absente », et rien ne rappelait plus de
                  quelle couleur on rétablirait la série. Le contour garde la
                  teinte à pleine force — donc son ratio — et dit le retrait par
                  la forme, en écho au libellé barré qui l'accompagne. */}
              <span
                aria-hidden="true"
                className={cn('size-2.5 rounded-[2px] transition-shadow duration-150')}
                style={
                  shown
                    ? { background: SERIES_COLORS[key] }
                    : { boxShadow: `inset 0 0 0 2px ${SERIES_COLORS[key]}` }
                }
              />
              <span className={cn(!shown && 'line-through')}>{seriesLabels[key]}</span>
            </button>
          )
        })}
      </div>

      {/* Échelles des tracés — affichées quand il y a deux tracés. */}
      {aDeuxTraces && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-body text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[2px]"
              style={{ background: SERIES_COLORS.rent }}
            />
            <span>{t('app.dashboard.scalePrimary')}</span>
            {/* Hérite de `text-muted` du conteneur — voir le commentaire sur
                `--color-muted-soft` dans tokens.css : ce jeton est réservé au
                texte >=18px ou au non-textuel, jamais à ces 14px. */}
            <span>{formatMax(max)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[2px]"
              style={{ background: SERIES_COLORS.water }}
            />
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[2px] ml-1"
              style={{ background: SERIES_COLORS.power }}
            />
            <span>{t('app.dashboard.scaleSecondary')}</span>
            <span>{formatMax(maxSecondaire)}</span>
          </span>
        </div>
      )}

      {/* Zone de tracé et rangée d'étiquettes sont deux blocs distincts.
          C'est ce qui rend le calage exact : la ligne d'objectif se positionne
          en pourcentage de la seule zone de tracé, sans avoir à compenser à la
          main la hauteur des étiquettes. Les colonnes portent `h-full` car une
          hauteur en pourcentage ne se résout que contre un parent de hauteur
          définie — sans cela les barres ne s'affichaient pas du tout. */}
      {/*
        LE DÉFILEMENT ENVELOPPE LE TRACÉ *ET* LES ÉTIQUETTES.

        Le graphe des consommations a reçu son plancher de pas ; celui-ci ne
        pouvait pas recevoir le même remède, et c'est pourquoi il a attendu son
        propre lot. Deux raisons, toutes deux vérifiées avant d'y toucher.

        La ligne d'objectif est posée en `absolute inset-x-0` DANS la zone de
        tracé : un `overflow` sur cette zone l'aurait figée pendant que les
        barres défileraient dessous, et le repère aurait désigné le mauvais
        mois. Elle doit donc défiler avec elles — d'où la boîte de défilement un
        cran plus haut, autour du tracé et de la rangée d'étiquettes, que
        `min-w-max` fait aussi larges que leur contenu. Le repère garde alors sa
        largeur réelle et suit le tracé.

        Et l'étiquette du montant déborde de dix pixels VERS LE HAUT
        (`-top-2.5`). Or `overflow-x` ne se règle pas seul : le navigateur
        contraint aussi l'axe vertical, et l'étiquette se serait fait raboter
        quand l'objectif approche du sommet. Le `pt-2.5` lui rend exactement ces
        dix pixels — et la hauteur totale les compense au même montant, pour que
        la BOÎTE DE CONTENU garde ses 224 px : `h-56` avec `pt-2.5` n'en
        laisserait que 214, et toutes les barres auraient raccourci d'autant.

        Deux boîtes, deux nombres, et il vaut mieux les nommer séparément : la
        boîte de contenu porte le tracé ET la rangée d'étiquettes, la rangée de
        tracé seule vaut 26 px de moins — 198 px ici, 230 px sous `sm`. Mesuré
        avant et après ce lot : 230 des deux côtés, les barres n'ont pas bougé.
      */}
      <div className="flex h-[14.625rem] flex-col overflow-x-auto pt-2.5 sm:h-[16.625rem]">
        <div className="flex min-w-max flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 items-stretch gap-1 sm:gap-2.5">
          {showTarget && (
            <div
              aria-hidden="true"
              // `gold-ink` et non l'or de marque. Une ligne de repère est une
              // donnée : elle dit où passe l'objectif, et l'or n'y tient que
              // 2,87:1 sur la carte. `--color-gold-ink` reste dans la famille
              // et monte à 5,47:1 en clair, 7,32:1 en sombre — et c'est déjà
              // la couleur du libellé qui la nomme, deux lignes plus bas : le
              // trait et son étiquette cessent d'être de deux ors différents.
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-gold-ink"
              style={{ bottom: `${(target / max) * 100}%` }}
            >
              {/* Le montant EXACT, et non sa forme compacte.
                  « 1,4 M » côtoyait « 1 397 000 FCFA » sur la même vue : les
                  deux disent le même chiffre, mais leur voisinage invite à les
                  comparer — et l'arrondi fait douter de celui qui ne l'est
                  pas. */}
              {/* Fond opaque et léger retrait : le libellé porte maintenant le
                  montant exact, donc il occupe 41 % de la largeur du graphique
                  au lieu des 15 % de sa forme compacte — et il court sur les
                  barres, en doré sur fond sombre. Le fond le rend lisible quelle
                  que soit la hauteur des barres, ce qu'un simple déplacement ne
                  garantirait pas : elles changent avec les données. */}
              <span className="absolute -top-2.5 left-0 rounded-sm bg-surface px-1.5 py-0.5 numeric text-caps text-gold-ink uppercase">
                {targetLabel} · {money(target, { round: true })}
              </span>
            </div>
          )}

          {bars.map((bar, index) => {
            const total = totals[index]
            const isLast = index === bars.length - 1
            const isActive = active === index

            const detail = bar.segments
              .filter((s) => visible(s.key))
              .map((s) => `${seriesLabels[s.key]} ${money(s.value)}`)
              .join(', ')

            return (
              /* Le bouton occupe toute la colonne, pas la seule barre : la
                 cible reste confortable même quand un mois est bas. */
              <button
                key={bar.label}
                type="button"
                /*
                  LARGEUR PORTÉE PAR LA DONNÉE, et c'est pour cela qu'elle est
                  exemptée du plancher de 44 px.

                  Douze mois côte à côte dans 360 px de fenêtre laissent 24 px
                  par colonne ; les porter à 44 en demanderait 528. Ce n'est pas
                  un choix de mise en page qu'on pourrait refaire autrement,
                  c'est l'exception « essentiel » de WCAG 2.5.8.

                  Ce qu'une frappe à côté coûte, et c'est ce qui rend
                  l'exception tenable : rien. La colonne n'a pas d'`onClick` —
                  elle ne fait qu'appeler une infobulle au survol et au focus.
                  Se tromper de mois affiche le mois d'à côté ; au clavier, la
                  tabulation les prend un par un sans viser.

                  La HAUTEUR, elle, est déjà traitée juste au-dessus.
                */
                data-cible="donnee"
                className="group relative flex h-full min-w-6 flex-1 shrink-0 cursor-pointer flex-col justify-end rounded-sm"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive((c) => (c === index ? null : c))}
                onFocus={() => setActive(index)}
                onBlur={() => setActive((c) => (c === index ? null : c))}
                aria-label={`${bar.label} — ${money(total)}. ${detail}`}
              >
                <span
                  className={cn(
                    'animate-grow-y flex w-full flex-col-reverse',
                    'rounded-t-[3px] transition-shadow duration-150',
                  )}
                  style={{
                    height: `${(totalsPrimaires[index] / max) * 100}%`,
                    animationDelay: `${index * 35}ms`,
                    // L'EMPHASE AJOUTE DE L'ENCRE À LA COLONNE VISÉE au lieu
                    // d'en retirer aux onze autres. Effacer les voisines à 0,40
                    // les faisait tomber entre 1,50:1 et 2,44:1 selon la série
                    // et le thème : désigner un mois rendait tous les autres
                    // illisibles. Et l'état est STABLE AU CLAVIER — le focus le
                    // déclenche autant que le survol — donc onze colonnes sous
                    // le seuil tant qu'on ne quitte pas la douzième.
                    // Le liseré ne coûte rien aux voisines et ne déplace rien :
                    // `box-shadow` ne participe pas à la mise en page, et il
                    // tient dans la gouttière sans la combler.
                    boxShadow: isActive ? '0 0 0 2px var(--color-ink)' : undefined,
                  }}
                >
                  {bar.segments
                    .filter((segment) => visible(segment.key) && clesPrimaires.includes(segment.key))
                    .map((segment, segmentIndex, shownSegments) => (
                      <span
                        key={segment.key}
                        className={cn(
                          'w-full',
                          segmentIndex === shownSegments.length - 1 && 'rounded-t-[3px]',
                        )}
                        style={{
                          height: `${totalsPrimaires[index] ? (segment.value / totalsPrimaires[index]) * 100 : 0}%`,
                          // Le mois en cours est encore ouvert : sa colonne est
                          // HACHURÉE et non atténuée — voir `hachureOuverte`,
                          // qui porte le pourquoi et les ratios.
                          background: isLast
                            ? hachureOuverte(SERIES_COLORS[segment.key])
                            : SERIES_COLORS[segment.key],
                          /**
                           * Un filet de la couleur de la carte entre deux
                           * segments.
                           *
                           * L'eau et l'électricité pèsent 5 % et 4,5 % : sur
                           * une colonne de 200px, deux bandes de 9 et 10px qui
                           * se touchent se lisent comme une seule. Le filet
                           * n'ajoute pas de couleur — il retire un pixel, et
                           * c'est ce qui rend les trois séries dénombrables.
                           */
                          boxShadow:
                            segmentIndex > 0 ? 'inset 0 1px 0 var(--color-surface)' : undefined,
                        }}
                      />
                    ))}
                </span>
              </button>
            )
          })}

        </div>

        {/*
          LE SECOND TRACÉ — les charges refacturées, à leur propre échelle.

          Il est PRIS sur la hauteur du premier, jamais ajouté dessous : le
          conteneur garde ses 234 px sous `sm` et ses 266 au-delà, le tracé du
          haut passe en `flex-1` et celui-ci prend 64 px fixes. Mesuré, l'eau
          passe de 9 px à une trentaine et l'électricité de 8 à environ 27 ; le
          loyer descend de 171 à environ 120, ce qui ne lui coûte aucune
          lisibilité. Le tableau de bord ne grandit pas d'un pixel.

          PAS DE LIGNE D'OBJECTIF ICI, et c'est le fond de l'affaire : `expected`
          est la somme des LOYERS des logements occupés. Une avance récupérée
          n'a pas d'objectif d'encaissement.

          LES COLONNES SONT LES MÊMES BOUTONS EN HAUT : ce tracé est
          `aria-hidden` et ne porte aucune cible. Le doubler en boutons ferait
          vingt-quatre commandes pour douze mois, et deux annonces par colonne
          au lecteur d'écran. La lecture se fait par la colonne du haut, qui
          nomme déjà les trois séries, et par la table.
        */}
        {aDeuxTraces && (
          <div
            aria-hidden="true"
            className="mt-2 flex h-16 items-stretch gap-1 border-t border-divider pt-2 sm:gap-2.5"
          >
            {bars.map((bar, index) => {
              const totalBas = totalsSecondaires[index]
              const isLast = index === bars.length - 1
              return (
                <span key={bar.label} className="flex min-w-0 flex-1 items-end justify-center">
                  <span
                    className="animate-grow-y flex w-full flex-col-reverse rounded-t-[3px] transition-shadow duration-150"
                    style={{
                      height: `${(totalBas / maxSecondaire) * 100}%`,
                      animationDelay: `${index * 35}ms`,
                      boxShadow: active === index ? '0 0 0 2px var(--color-ink)' : undefined,
                    }}
                  >
                    {bar.segments
                      .filter((seg) => visible(seg.key) && clesSecondaires.includes(seg.key))
                      .map((seg, i, montres) => (
                        <span
                          key={seg.key}
                          className={cn('w-full', i === montres.length - 1 && 'rounded-t-[3px]')}
                          style={{
                            height: `${totalBas ? (seg.value / totalBas) * 100 : 0}%`,
                            background: isLast
                              ? hachureOuverte(SERIES_COLORS[seg.key])
                              : SERIES_COLORS[seg.key],
                            boxShadow: i > 0 ? 'inset 0 1px 0 var(--color-surface)' : undefined,
                          }}
                        />
                      ))}
                  </span>
                </span>
              )
            })}
          </div>
        )}

        <div className="mt-2.5 flex gap-1 sm:gap-2.5" aria-hidden="true">
          {bars.map((bar, index) => (
            <span
              key={bar.label}
              className={cn(
                // PAS de plancher ici, et c'est mesuré. Les deux rangées vivent
                // dans le même conteneur `min-w-max` : elles ont donc la même
                // largeur, et `flex-1` y découpe les mêmes colonnes. Leur poser
                // un `min-w-6` ne déplaçait rien — vérifié au pixel, alignement
                // identique — et un réglage qui ne fait rien ment sur ce qu'il
                // tient.
                // `tracking-wide` RESTE ici, et c'est la seule surcharge du
                // fichier à survivre : le commentaire ci-dessous en donne la
                // mesure — « sept » et « janv » perdaient trois pixels sur
                // trente et s'affichaient rabotés. Ailleurs, six surcharges
                // écrasaient l'interlettrage de `text-caps` sans raison écrite,
                // et une valeur défendue au centième dans la feuille de jetons
                // ne se corrige pas en passant.
                'min-w-0 flex-1 text-center text-caps tracking-wide uppercase',
                // Chaque étiquette garde sa colonne — c'est ce qui la tient
                // centrée sous SA barre — mais sur téléphone elle a le droit
                // de déborder sur la voisine. La voisine est `invisible` : elle
                // occupe sa place sans rien peindre, donc ce débordement se
                // pose sur du vide. Sans cela, « sept » et « janv » perdaient
                // 3px sur 30 et s'affichaient rabotés d'un point de suspension
                // — c'était déjà vrai à 11px, et le plancher à 12px le rendait
                // seulement plus visible. Les deux règles de débordement sont
                // séparées par une requête média, jamais par l'ordre du
                // fichier : une seule des deux s'applique à la fois.
                'max-sm:overflow-visible sm:overflow-hidden text-ellipsis whitespace-nowrap',
                'transition-colors duration-150',
                active === index ? 'text-ink' : 'text-muted',
                // Douze étiquettes ne tiennent pas sur un téléphone : on en
                // retire une sur deux. `invisible` et non `hidden` — la
                // colonne retirée doit continuer à réserver sa place, sinon
                // les six restantes s'étalent et ne désignent plus rien.
                index % 2 === 1 && 'max-sm:invisible',
              )}
            >
              {bar.label}
            </span>
          ))}
        </div>
        </div>
      </div>

      {/*
        LECTURE FIXE, et non plus une infobulle qui flotte.

        Elle flottait en `absolute bottom-full` DANS la zone de tracé — laquelle
        est passée à `overflow-x-auto` pour porter le plancher de pas de 24 px,
        et `overflow-x` non visible contraint aussi l'axe vertical. Mesuré au
        navigateur : sur 158 px de haut, 154 étaient rognés. Il en restait
        quatre. L'infobulle existait, se peignait, et ne se voyait pas.

        Le fichier avait déjà tranché ce point pour son voisin, et l'argument
        vaut ici mot pour mot : « la valeur s'inscrit toujours au même endroit,
        sous le graphe : rien ne bouge, rien ne se recouvre, et cela fonctionne
        au doigt comme au clavier. »

        LA PLACE EST RÉSERVÉE EN PERMANENCE, et la colonne la plus récente s'y
        lit par défaut. Un bandeau qui n'apparaît qu'au survol déplacerait tout
        ce qui le suit à chaque passage de souris ; et vide au premier regard,
        il n'apprendrait rien à qui ne survole pas — c'est le reproche que la
        lecture du graphe voisin s'était déjà fait.

        Le fond encre reste celui de l'infobulle : les jetons de série y sont
        mesurés pour ce fond, et les porter sur la carte claire demanderait
        l'autre palette — un sujet à soi, que ce lot n'ouvre pas.
      */}
      <LectureFixe
        title={bars[lu].label}
        total={money(totals[lu])}
        rows={bars[lu].segments
          .filter((s) => visible(s.key))
          .map((s) => ({
            key: s.key,
            label: seriesLabels[s.key],
            value: money(s.value),
            color: SERIES_COLORS_ON_DARK[s.key],
          }))}
      />

      {/* Alternative textuelle : mêmes données, lisibles au lecteur d'écran.
          `sr-only` doit porter sur le DIV, pas sur le TABLE : sous
          `display: table`, la largeur de 1px d'un `sr-only` est traitée comme
          un minimum et non comme un maximum, donc la table conservait sa
          largeur intrinsèque. Invisible mais toujours dans le flux, elle
          poussait le défilement horizontal du document sur mobile. */}
      <div className="sr-only">
        <table>
          <caption id={titleId}>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{t('common.period')}</th>
              {seriesKeys.map((key) => (
                <th key={key} scope="col">
                  {seriesLabels[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.label}>
                <th scope="row">{bar.label}</th>
                {bar.segments.map((segment) => (
                  <td key={segment.key}>{money(segment.value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

/**
 * La lecture d'une colonne, à place fixe sous le graphe.
 *
 * `aria-hidden` : son contenu est déjà porté par l'`aria-label` du bouton de
 * chaque colonne, et l'annoncer deux fois ferait répéter les mêmes chiffres au
 * lecteur d'écran. Elle est purement visuelle — la table `sr-only` en bas de la
 * figure porte la version lisible.
 *
 * Ni `absolute` ni calage : c'est tout l'objet du changement. Flottante, elle
 * devait deviner où se placer sans mesurer, et se faisait rogner par la boîte
 * de défilement du tracé. Posée dans le flux, elle n'a plus rien à deviner.
 *
 * LE DÉTAIL EST EN LIGNE ET NON EMPILÉ. Trois rangées sous un total faisaient
 * 158 px : réservée en permanence, cette hauteur aurait coûté à chaque carte du
 * tableau de bord ce que l'infobulle ne coûtait qu'au survol. En ligne, la même
 * information tient sur une bande qui se replie d'elle-même quand la carte est
 * étroite.
 */
function LectureFixe({
  title,
  total,
  rows,
}: {
  title: string
  total: string
  rows: { key: string; label: string; value: string; color: string }[]
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'on-dark mt-3 rounded-lg bg-ink px-3.5 py-2.5 text-on-dark',
        // La hauteur est PRÉVISIBLE, ce qui est plus fort que réservée. Un
        // simple plancher n'aurait tenu que le cas court : mesuré, la bande
        // passait de 68 px à 640 de large à 92 puis 115 quand la carte se
        // resserre, parce que le détail se repliait au gré de la LONGUEUR des
        // montants. Survoler une colonne à 980 000 après une à 1 040 000
        // aurait donc fait remonter la bande d'une rangée — le saut même qu'on
        // vient de fuir, revenu par la porte de derrière.
        //
        // Le détail est donc empilé sous `sm` et en ligne au-delà : le nombre
        // de rangées ne dépend plus que du nombre de séries, qui ne change pas
        // d'une colonne à l'autre. La hauteur suit le point de rupture, jamais
        // la donnée.
        //
        // LES DEUX VALEURS SONT LA HAUTEUR MESURÉE, et non un plancher choisi
        // au jugé : 133 px sous `sm`, 86 px au-delà, relevés sur les quinze
        // colonnes dans les deux langues après que la note de période ouverte
        // a quitté ce bloc. Un plancher inférieur à la hauteur réelle ne réserve
        // rien — c'était le cas des deux précédents, 124 et 68, qui laissaient
        // la note dépasser de 17 et 26 px.
        'min-h-[8.3125rem] sm:min-h-[5.375rem]',
      )}
    >
      {/*
        EMPILÉS, ET NON CÔTE À CÔTE — le dernier pixel de décalage à l'interaction.

        En ligne, la période précédait le montant : « mars » fait 37,4 px et
        « mai » 24,3, donc le montant se déplaçait latéralement de 3 à 12 px à
        chaque colonne visée. Mesuré : quatorze événements de décalage pour
        0,0017 cumulé — petit, mais c'est un nombre qui bouge sous l'œil qui le
        lit, et la règle ne dit pas « peu ».

        Empilés, les deux commencent à la même abscisse quelle que soit la
        longueur du libellé. Aucune largeur réservée n'est écrite : un plancher
        en pixels serait juste pour « mars » et faux pour la première étiquette
        plus longue qu'un appelant lui passerait. La structure tient là où un
        nombre magique aurait tenu jusqu'au prochain jeu de données.
      */}
      <p className="flex flex-col gap-y-0.5">
        <span className="text-caps text-on-dark-faint uppercase">{title}</span>
        <span className="numeric title-m text-on-dark">{total}</span>
      </p>

      {/* Le détail disparaît quand la série est unique : un filet et un
          espacement sous un total, sans rien en dessous, se lisent comme un
          contenu qui a échoué à s'afficher. */}
      {rows.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-1.5 text-body">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: row.color }}
              />
              <span className="text-on-dark-muted">{row.label}</span>
              <span className="numeric text-on-dark">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Histogramme compact à série unique, pour l'aperçu du hero.
 *
 * Il remplace une rangée de barres purement décoratives, marquées
 * `aria-hidden`. Une décoration qui a la forme exacte d'un graphique n'est pas
 * une décoration : le visiteur essaie de la lire, et le lecteur d'écran n'y
 * trouve rien. Ces barres portent donc de vraies valeurs, suivent la devise
 * choisie, s'interrogent au survol comme au clavier, et sont doublées d'une
 * table.
 */
export function MiniBarChart({
  bars,
  caption,
  openPeriodNote,
  format,
  emptyLabel = '—',
}: {
  /**
   * `value: null` — la barre est ABSENTE, non nulle.
   *
   * Une barre au sol et une barre manquante racontent deux choses
   * différentes : « il n'a rien consommé » et « on ne sait pas ». Sur une série
   * de relevés la seconde est la règle — un mois non relevé, un compteur
   * remplacé — et l'afficher à zéro se lirait comme une absence à domicile.
   *
   * `key` sépare l'identité React du libellé affiché : douze relevés peuvent
   * s'étaler sur quatorze mois si des périodes manquent, « août » revient alors
   * deux fois, et React fige une barre à la mauvaise hauteur sans rien casser
   * ni prévenir.
   */
  bars: { key?: string; label: string; value: number | null }[]
  caption: string
  openPeriodNote?: string
  /**
   * Comment lire une valeur. Par défaut de la monnaie — ce que cette carte
   * montrait à l'origine —, mais un compteur se lit en m³ ou en kWh, et `money`
   * y inscrivait des francs sur des mètres cubes.
   */
  format?: (value: number) => string
  /** Ce qu'annonce une période sans valeur dérivable. */
  emptyLabel?: string
}) {
  const { money } = useCurrency()
  const titleId = useId()
  const [active, setActive] = useState<number | null>(null)

  const lire = format ?? ((v: number) => money(v, { round: true }))
  // Les périodes inconnues ne pèsent pas sur l'échelle : une barre absente ne
  // doit ni écraser ni gonfler les autres.
  const max = Math.max(...bars.map((b) => b.value ?? 0), 1) * 1.04

  return (
    <figure className="m-0" aria-labelledby={titleId}>
      {/*
        LE GRAPHE DÉFILE PLUTÔT QUE DE RENDRE UN MOIS INATTEIGNABLE.

        Mesuré : à 320 px les douze colonnes tombaient à 14 px de large pour un
        pas de 18. WCAG 2.5.8 tolère une cible sous 24 px si un cercle de 24 px
        centré dessus ne rencontre pas celui de sa voisine — à 18 px de pas, ils
        se chevauchent. Vingt-quatre cibles échouaient sur cet écran.

        Et l'enjeu n'est pas l'ergonomie : taper entre deux colonnes affiche la
        valeur de la VOISINE, sans rien qui le signale. Le locataire lit alors
        « 19 m³ » pour un mois qui en faisait 14, et croit lire son relevé.

        `min-w-6` pose le plancher de 24 px, `overflow-x-auto` laisse la
        conséquence défiler DANS SA PROPRE BOÎTE — jamais le document, c'est la
        règle que `DataTable` applique déjà. La dernière colonne coupée signale
        qu'il en reste. Le clavier atteint tout : chaque colonne est un bouton,
        et tabuler fait défiler.

        Rien n'est recouvert au passage : la lecture de cette carte est fixe
        SOUS le graphe — voir plus bas — et non une infobulle flottante qu'un
        `overflow` aurait rognée.
      */}
      <div className="relative flex h-24 items-end gap-1 overflow-x-auto sm:h-28 sm:gap-1.5">
        {bars.map((bar, index) => {
          const isLast = index === bars.length - 1
          const isActive = active === index

          return (
            <button
              key={bar.key ?? bar.label}
              type="button"
              /* Même exemption que le graphe empilé plus haut, pour la même
                 raison : la largeur d'une colonne est celle que la donnée et la
                 fenêtre lui laissent, et la colonne n'agit pas — elle informe. */
              data-cible="donnee"
              className="group flex h-full min-w-6 flex-1 shrink-0 cursor-pointer items-end rounded-sm"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive((c) => (c === index ? null : c))}
              onFocus={() => setActive(index)}
              onBlur={() => setActive((c) => (c === index ? null : c))}
              aria-label={`${bar.label} — ${bar.value === null ? emptyLabel : lire(bar.value)}`}
            >
              <span
                className="animate-grow-y w-full rounded-t-[3px] transition-shadow duration-150"
                style={{
                  // Une période inconnue garde un filet de 2 px : la colonne
                  // reste visible et cliquable — sans quoi le trou se lirait
                  // comme un mois qui n'existe pas — mais aucune hauteur ne
                  // suggère une quantité.
                  height: bar.value === null ? '2px' : `${(bar.value / max) * 100}%`,
                  // La colonne du mois courant se distingue des onze autres :
                  // c'est une DONNÉE mise en avant, pas un ornement. L'or de
                  // marque tombait à 2,87:1 sur la carte, sous le seuil de 3:1
                  // — et le commentaire d'en-tête de ce fichier l'interdisait
                  // déjà. `--color-gold-ink` tient 5,47:1 en clair et 7,32:1
                  // en sombre, en gardant l'écart de clarté avec `data-1` qui
                  // rend les deux distinguables en niveaux de gris. La hachure
                  // s'y ajoute pour dire la même chose que chez la voisine
                  // empilée : la période n'est pas close.
                  //
                  // LA PÉRIODE SANS RELEVÉ CHANGE DE JETON. `--color-divider`
                  // vaut 1,29:1 sur la carte claire et 1,13:1 en sombre : le
                  // raisonnement au-dessus était juste — « la colonne reste
                  // visible » — mais la valeur du jeton le démentait, et le
                  // filet de deux pixels était invisible, donc le trou se
                  // lisait bien comme un mois qui n'existe pas. Un jeton de
                  // SÉPARATEUR n'est pas fait pour porter du sens ;
                  // `--color-muted-soft` l'est, et tient 4,75:1 en clair,
                  // 4,33:1 en sombre.
                  background:
                    bar.value === null
                      ? 'var(--color-muted-soft)'
                      : isLast
                        ? hachureOuverte('var(--color-gold-ink)')
                        : 'var(--color-data-1)',
                  animationDelay: `${index * 40}ms`,
                  // Même arbitrage que chez la voisine empilée : la colonne
                  // visée reçoit un liseré, les autres ne perdent rien. À 0,40
                  // elles retombaient à 2,47:1 en clair pour `data-1` et 1,79:1
                  // pour l'or, sous le seuil, au survol comme au focus.
                  boxShadow: isActive ? '0 0 0 2px var(--color-ink)' : undefined,
                }}
              />
            </button>
          )
        })}

      </div>

      {/* Lecture fixe plutôt qu'infobulle flottante.
          Sur une carte de cette taille, une infobulle ancrée au-dessus des
          barres recouvrait le montant principal — elle cachait l'information
          qu'elle venait préciser. Ici la valeur s'inscrit toujours au même
          endroit, sous le graphe : rien ne bouge, rien ne se recouvre, et cela
          fonctionne au doigt comme au clavier.

          Les repères de début et de fin restent affichés en permanence. Sans
          eux, la seule façon de savoir de quel mois on parlait était de
          survoler — donc rien au premier regard. */}
      {/*
        HAUTEUR FIXE ET CENTRAGE, ET NON UN PLANCHER ALIGNÉ SUR LA LIGNE DE BASE.

        La case du milieu est vide tant qu'aucune colonne n'est visée : elle
        n'a donc pas de ligne de base, et `items-baseline` calait les deux
        repères de début et de fin sur autre chose. Dès qu'elle se remplissait —
        14 px de corps contre 12 px de surtitre — la ligne de base commune se
        déplaçait et les deux repères sautaient de 4 px, verticalement, à chaque
        colonne survolée. Mesuré : deux sources de décalage, dy = ±4, sur la
        page d'accueil.

        `h-6` couvre la plus haute des deux graisses (14 px × 1,5 = 21 px) et
        `items-center` ne dépend d'aucune ligne de base : la case peut se
        remplir et se vider, la rangée garde sa hauteur et ses voisines leur
        place.
      */}
      <div className="mt-3 flex h-6 items-center justify-between gap-3">
        <span
          aria-hidden="true"
          className="text-caps text-muted uppercase"
        >
          {bars[0]?.label}
        </span>

        <span
          aria-live="polite"
          className="min-w-0 truncate text-center text-body font-medium text-ink"
        >
          {active !== null && (
            <>
              <span className="text-caps text-muted uppercase">
                {bars[active].label}
              </span>{' '}
              <span className="numeric">
                {bars[active].value === null ? emptyLabel : lire(bars[active].value)}
              </span>
            </>
          )}
        </span>

        <span
          aria-hidden="true"
          className="text-caps text-muted uppercase"
        >
          {bars[bars.length - 1]?.label}
        </span>
      </div>

      {/* Le mois en cours est encore ouvert : sa colonne est plus basse sans
          que rien ne l'explique.

          PERMANENTE, et non révélée au survol de la dernière colonne. Sous sa
          forme conditionnelle, elle apparaissait et disparaissait au passage du
          pointeur : une ligne de texte qui pousse tout ce qui suit, sur la page
          d'accueil, sous le curseur de qui lit. Même défaut que celui de
          `LectureFixe`, même correctif — et pour la même seconde raison : un
          téléphone n'a pas de survol, donc la note n'y existait jamais. */}
      {openPeriodNote && (
        <p className="mt-1.5 text-center text-body text-muted">{openPeriodNote}</p>
      )}

      <div className="sr-only">
        <table>
          <caption id={titleId}>{caption}</caption>
          <tbody>
            {bars.map((bar) => (
              // Même clé que les colonnes : deux « août » dans une série ne
              // doivent pas se confondre ici non plus.
              <tr key={bar.key ?? bar.label}>
                <th scope="row">{bar.label}</th>
                <td>{bar.value === null ? emptyLabel : lire(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

/**
 * LE PROFIL RADIAL D'UNE PART — la seconde dimension de l'anneau.
 *
 * Trois parts, trois teintes, et rien d'autre : mesuré sous simulation, l'écart
 * CIEDE2000 entre « partiel » et « en retard » tombe à 3,4 en deutéranopie
 * (30,3 et 22,7 en vision normale). Sous cette distance, deux aplats sont le
 * même aplat. L'épaississement au survol ne rattrape rien — un téléphone n'a
 * ni survol ni focus.
 *
 * CE QUI EST AJOUTÉ EST UN PROFIL, ET NON UNE COULEUR. La largeur ANGULAIRE
 * d'une part est la donnée : elle vaut 9° sur cet écran, soit 8 px d'arc, et
 * rien ne peut s'y inscrire. Sa largeur RADIALE, elle, est constante — 11
 * unités, 14,1 px CSS — et indépendante des montants. C'est donc là, et
 * seulement là, que la forme peut porter l'état.
 *
 * TROIS FORMES, ET CE SONT CELLES DE `.jauge` : pleine, demie, creuse. La
 * grille des paiements pose déjà ce vocabulaire sur un disque de 10 px ; le
 * reprendre sur la bande de l'anneau évite d'en inventer un second pour la
 * même chose. Le bord creux fait 1,5 unité, comme la bordure de `.jauge`.
 *
 * Familles écartées, mesurées et non supposées — voir le rapport du lot :
 *   · glyphe posé sur l'arc — 10,0 % d'écart de silhouette aux angles réels,
 *     soit 10,8 px² : sous le plancher de 12 px². Même échec qu'au lot
 *     précédent, pour une autre raison : 8 px d'arc, pas 10 px de disque ;
 *   · trame le long de l'arc — passe la mesure (34,5 %) mais coûte 12 nœuds
 *     SVG contre 4 et 1,2 ms de peinture contre 0,8 : un masque et deux motifs
 *     pour ce qu'un rayon fait sans rien ajouter ;
 *   · étagement radial — passe (42,6 %), et défait l'anneau : trois arcs à
 *     trois rayons ne se lisent plus comme les parts d'un même tout ;
 *   · épaisseur seule — passe (24,1 %), et l'épaisseur veut déjà dire « part
 *     visée » dans ce composant. Deux sens pour une dimension n'en font aucun.
 */
export type FormeDePart = 'pleine' | 'demie' | 'creuse'

/**
 * BANDE RADIALE DE CHAQUE FORME, en unités de la boîte de vue.
 *
 * La bande pleine est celle d'avant — 36,5 à 47,5 — donc l'anneau ne change
 * ni de rayon ni d'encombrement. Les deux autres vivent DEDANS : le contour
 * extérieur de l'anneau reste le même cercle pour les trois parts, et c'est ce
 * qui le laisse se lire comme un seul objet.
 */
const R_INT = 36.5
const R_EXT = 47.5
/** Épaisseur du bord creux. 1,5 unité, comme la bordure de `.jauge`. */
const BORD = 1.5

/** Les segments radiaux `[intérieur, extérieur]` que pose une forme. */
function bandes(forme: FormeDePart, croissance: number): [number, number][] {
  const int = R_INT - croissance
  const ext = R_EXT + croissance
  if (forme === 'pleine') return [[int, ext]]
  if (forme === 'demie') return [[(int + ext) / 2, ext]]
  return [
    [int, int + BORD],
    [ext - BORD, ext],
  ]
}

export interface DonutSlice {
  label: string
  value: number
  /**
   * L'ÉTAT DE RÈGLEMENT, ET NON UNE COULEUR.
   *
   * La teinte ET la forme en découlent toutes deux, par la même table. Une
   * part ne peut donc pas être ambre et pleine : il n'y a pas deux réglages à
   * accorder, il y en a un. C'est la même raison qui fait que la grille des
   * paiements et sa légende appellent le même composant — une clé qui n'ouvre
   * pas la serrure est pire que pas de clé.
   */
  etat: EtatDePoste
}

/** Teinte et forme d'un état, au même endroit et une seule fois. */
const PARTS: Record<EtatDePoste, { couleur: string; forme: FormeDePart }> = {
  paid: { couleur: 'var(--color-ok)', forme: 'pleine' },
  partial: { couleur: 'var(--color-warn)', forme: 'demie' },
  /* `--color-warn` et non `--color-gold` pour « partiel » : l'or de marque ne
     tient que 2,87:1 sur blanc, sous le seuil d'une donnée. */
  overdue: { couleur: 'var(--color-danger)', forme: 'creuse' },
}

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  caption,
  reconciliation = [],
}: {
  slices: DonutSlice[]
  centerValue: string
  centerLabel: string
  caption: string
  /**
   * Lignes de RÉCONCILIATION, sous la légende et sous un filet.
   *
   * Une part d'anneau ne dit pas à quoi elle s'ajoute. Sur le tableau de bord,
   * les trois parts sommaient exactement au premier indicateur de la page et
   * deux d'entre elles au troisième — sans que rien ne le montre : quatre
   * nombres justes, sur deux panneaux éloignés, que l'utilisateur devait
   * rapprocher de tête pour savoir s'ils parlaient de la même chose.
   *
   * Ces lignes portent les MÊMES intitulés que les indicateurs qu'elles
   * rejoignent : c'est le nom, plus encore que le montant, qui referme la
   * boucle. Sans pastille de couleur — elles ne désignent aucun arc, elles
   * totalisent.
   */
  reconciliation?: { key: string; label: string; value: number; fort?: boolean }[]
}) {
  const { money } = useCurrency()
  const [active, setActive] = useState<string | null>(null)

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)

  /* Fractions et non longueurs : chaque forme pose ses segments à des rayons
     DIFFÉRENTS, et une longueur d'arc calculée sur un rayon en décrirait un
     autre. La part et son départ sont donc gardés sans dimension, et convertis
     par la circonférence de CHAQUE segment. */
  let depart = 0
  const arcs = slices.map((slice) => {
    const fraction = total ? slice.value / total : 0
    const arc = { slice, fraction, depart }
    depart += fraction
    return arc
  })

  const shown = arcs.find((a) => a.slice.etat === active)

  return (
    <figure className="m-0 flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg width="128" height="128" viewBox="0 0 100 100" aria-hidden="true">
          {arcs.flatMap(({ slice, fraction, depart: debut }) => {
            const { couleur, forme } = PARTS[slice.etat]
            /* La part visée épaissit VERS L'EXTÉRIEUR ET VERS L'INTÉRIEUR :
               l'anneau ne change pas de rayon médian, donc rien ne se déplace
               autour. La bande pleine passe de 11 à 14, exactement comme avant
               ce lot ; les deux autres croissent de la même unité et demie de
               chaque côté, donc le geste est le même pour les trois.

               L'ÉPAISSISSEMENT NE DISTINGUE RIEN. Il n'existe qu'au survol et
               au focus, et un téléphone n'a ni l'un ni l'autre : ce qui sépare
               les trois parts est leur profil radial, présent au repos. */
            const croissance = active === slice.etat ? 1.5 : 0
            return bandes(forme, croissance).map(([interieur, exterieur], i) => {
              const r = (interieur + exterieur) / 2
              const c = 2 * Math.PI * r
              return (
                <circle
                  key={`${slice.etat}-${i}`}
                  /* Ce n'est pas décoratif : `couleur-non-seule` retrouve les
                     parts par cet attribut et COMPTE ce qu'elle a regardé. Le
                     retirer d'une part fait chuter le compte et arrête la
                     porte — voir l'en-tête du script. */
                  data-jauge={slice.etat}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  /* Opaques, et non éclaircies hors visée. À 0,35 d'opacité,
                     composées sur la carte, les trois teintes retombaient entre
                     1,65:1 et 1,77:1 en clair et entre 1,94:1 et 2,26:1 en
                     sombre — quand un élément non textuel porteur de sens doit
                     tenir 3:1, et qu'opaques elles vont de 5,47:1 à 8,51:1. */
                  stroke={couleur}
                  strokeWidth={exterieur - interieur}
                  strokeDasharray={`${fraction * c} ${(1 - fraction) * c}`}
                  strokeDashoffset={-debut * c}
                  className="transition-all duration-150"
                  // -90° pour démarrer à midi plutôt qu'à 3 h.
                  transform="rotate(-90 50 50)"
                />
              )
            })
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {/* Le centre affiche la part visée, et retombe sur la valeur
              d'ensemble dès qu'on relâche — sans quoi il faudrait lire la
              légende et le centre en même temps pour comprendre. */}
          <span className="numeric text-title-l font-medium">
            {shown ? `${Math.round(shown.fraction * 100)} %` : centerValue}
          </span>
          <span className="max-w-[6rem] text-caps text-muted uppercase">
            {shown ? shown.slice.label : centerLabel}
          </span>
        </div>
      </div>

      {/* La légende porte les valeurs : elle est aussi l'alternative textuelle,
          et le moyen d'interroger l'anneau au clavier.
          `min-w-52` donne son effet au `flex-wrap` du parent. Sans plancher, la
          liste se comprimait indéfiniment au lieu de passer sous le donut, et
          l'étiquette — seule à pouvoir rétrécir, le montant étant `shrink-0` —
          était rabotée jusqu'à « P… » pour « Payé » sur écran étroit. Le seuil
          couvre l'étiquette la plus longue et le montant le plus large ; au-delà,
          la légende reste à côté du donut comme sur grand écran. */}
      <ul className="flex min-w-52 flex-1 flex-col">
        {arcs.map(({ slice, fraction }) => (
          <li key={slice.etat}>
            <button
              type="button"
              onMouseEnter={() => setActive(slice.etat)}
              onMouseLeave={() => setActive((c) => (c === slice.etat ? null : c))}
              onFocus={() => setActive(slice.etat)}
              onBlur={() => setActive((c) => (c === slice.etat ? null : c))}
              className={cn(
                'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 -mx-2',
                'text-left text-body transition-colors duration-150',
                active === slice.etat ? 'bg-surface-sunken' : 'hover:bg-surface-sunken',
              )}
              aria-label={`${slice.label} — ${money(slice.value, { round: true })}, ${Math.round(fraction * 100)} %`}
            >
              {/* LA MÊME JAUGE QUE LA GRILLE DES PAIEMENTS, et c'est le point.
                  Une légende qui porterait une forme absente de l'anneau
                  donnerait une clé qui n'ouvre rien : pastille pleine, demie et
                  creuse répondent ici aux bandes pleine, demie et creuse. La
                  pastille nue qu'elle remplace ne portait que la teinte — 3,4
                  de ΔE00 entre « partiel » et « en retard » sous deutéranopie,
                  sur un disque de 10 px. */}
              <JaugeDePoste etat={slice.etat} />
              <span className="min-w-0 flex-1 truncate text-muted">{slice.label}</span>
              <span className="numeric shrink-0 font-medium">
                {money(slice.value, { round: true })}
              </span>
            </button>
          </li>
        ))}

        {reconciliation.length > 0 && (
          <li className="mt-1 border-t border-divider pt-2">
            <dl className="flex flex-col gap-1.5">
              {reconciliation.map((ligne) => (
                <div key={ligne.key} className="flex items-baseline gap-2.5 px-2">
                  {/* Décalage de la largeur d'une pastille et de sa gouttière :
                      les montants restent dans la même colonne que ceux de la
                      légende, ce qui est la seule façon de les lire comme une
                      addition. */}
                  <dt
                    className={cn(
                      'ml-[1.25rem] min-w-0 flex-1 truncate',
                      ligne.fort ? 'text-body text-ink' : 'text-body text-muted',
                    )}
                  >
                    {ligne.label}
                  </dt>
                  <dd
                    className={cn(
                      'numeric shrink-0',
                      ligne.fort ? 'text-body font-medium' : 'text-body text-muted',
                    )}
                  >
                    {money(ligne.value, { round: true })}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        )}
      </ul>

      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  )
}

/** Barre de progression avec sa valeur affichée. */
export function ProgressBar({
  value,
  label,
  tone = 'gold',
  hideLabel,
}: {
  value: number
  label: string
  tone?: 'gold' | 'ok' | 'danger'
  /**
   * Masque le libellé VISIBLE sans le retirer de l'arbre d'accessibilité.
   *
   * Le libellé occupe une colonne de 20 unités à gauche de la piste. C'est
   * juste quand la barre vit dans une liste de barres comparables, où la
   * colonne aligne les intitulés ; ce l'est moins quand elle est seule sous un
   * montant qui la nomme déjà — la carte du loyer du mois — et la piste s'y
   * trouvait amputée du tiers de sa largeur pour répéter ce qui est écrit
   * au-dessus. `aria-label` reste posé : ce qui disparaît est le doublon
   * visuel, pas l'annonce.
   */
  hideLabel?: boolean
}) {
  // Le remplissage EST la valeur : c'est lui, et lui seul, qui dit 62 % contre
  // 38 %. L'or de marque ne tenait que 2,52:1 sur la piste `surface-sunken`,
  // le pire des quatre emplois recensés — et le ton par défaut, donc celui de
  // tous les appels. `gold-ink` monte à 4,80:1 en clair et 8,71:1 en sombre.
  // Le ton garde son nom : c'est un rôle — « la couleur de marque » — pas une
  // teinte, exactement comme `ok` ne nomme pas un vert.
  const colors = { gold: 'bg-gold-ink', ok: 'bg-ok', danger: 'bg-danger' }

  return (
    <div className="flex items-center gap-3">
      {!hideLabel && <span className="w-20 shrink-0 text-body text-muted">{label}</span>}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken"
      >
        <span
          className={cn('animate-grow-x block h-full rounded-full', colors[tone])}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="numeric w-10 shrink-0 text-right text-body text-muted">{value} %</span>
    </div>
  )
}

/** Tuile de KPI : libellé, valeur, delta et note. */
/**
 * La bordure d'une carte d'indicateur en état, par ton.
 *
 * Écrite en classes LITTÉRALES et non composées : Tailwind v4 balaie ce fichier
 * à la recherche de noms complets, et `border-${ton}-border` ne produirait
 * aucune règle — la bordure resterait grise sans que rien ne le signale.
 */
/**
 * LA TUILE D'ICÔNE, et pourquoi elle est OR par défaut plutôt que grise.
 *
 * Quatre rectangles nus, alignés, sans un seul repère : la rangée
 * d'indicateurs se lisait de gauche à droite comme un tableur, et rien n'y
 * accrochait l'œil qui revient sur la page pour la dixième fois de la journée.
 * Une icône dans une tuile teintée donne à chaque carte un point d'ancrage
 * qu'on retrouve sans lire — c'est le rôle que joue déjà le même gabarit dans
 * « ce qui demande une décision », deux rangées plus bas : `size-8`,
 * `rounded-md`, un lavis et un glyphe de 15 px. Ce n'est donc pas une invention
 * mais la reprise d'un idiome que le produit avait déjà.
 *
 * OR PAR DÉFAUT parce que c'est l'accent de la marque et qu'un lavis neutre
 * n'aurait rien apporté qu'un gris de plus sur un fond déjà gris. `--gold-ink`
 * et non `--gold` : l'or nu ne tient que 2,87:1, l'encre du même bleu de
 * famille en tient 4,80 au pire des fonds — c'est la règle que `Charts` énonce
 * en tête de fichier pour les séries, et elle ne s'arrête pas aux séries.
 *
 * TEINTE DE L'ÉTAT QUAND IL Y EN A UN, plutôt qu'une seconde grammaire de
 * couleur posée par-dessus la première. Une carte en alerte a déjà une bordure
 * rouge et une pastille rouge ; une tuile restée or au milieu se lirait comme
 * une contradiction. Et l'icône ne porte JAMAIS l'information seule : elle est
 * `aria-hidden`, l'intitulé la dit, la pastille dit l'état.
 */
const TUILES_D_ETAT: Record<StatusTone, string> = {
  ok: 'bg-ok-tint text-ok',
  warn: 'bg-warn-tint text-warn',
  danger: 'bg-danger-tint text-danger',
  neutral: 'bg-neutral-tint text-neutral',
  info: 'bg-gold-tint text-gold-ink',
}

const BORDURES_D_ETAT: Record<StatusTone, string> = {
  ok: 'border-ok-border',
  warn: 'border-warn-border',
  danger: 'border-danger-border',
  neutral: 'border-neutral-border',
  info: 'border-gold-border',
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  note,
  action,
  etat,
  icone,
}: {
  label: string
  value: string
  unit?: string
  delta?: ReactNode
  note?: string
  /**
   * Commande propre à cette carte, posée en regard de son intitulé.
   *
   * Distincte de `delta`, qui dit une VARIATION : une action n'est pas une
   * donnée, et les loger au même endroit ferait lire l'une pour l'autre.
   */
  action?: ReactNode
  /**
   * L'ÉTAT DE CE QUE LE CHIFFRE MESURE — et le fait qu'il soit FACULTATIF est
   * la moitié de la règle.
   *
   * Quatre cartes rigoureusement identiques — même fond, même bordure, même
   * graisse, note en gris muet — rendaient « 4 locataires · jusqu'à 24 jours
   * de retard » exactement comme « 2 unités vacantes ». Mesuré sur le tableau
   * de bord avant ce lot : ZÉRO pastille sur les quatre. La hiérarchie était
   * écrite en commentaire au-dessus de la rangée, pas en pixels.
   *
   * Posé, `etat` fait DEUX choses : une pastille se pose devant la note — donc
   * une teinte, une icône et un LIBELLÉ, jamais la couleur seule — et la
   * bordure de la carte prend le même ton. La bordure ne porte rien à elle
   * seule : elle attire, la pastille dit.
   *
   * LA PASTILLE PORTE UN MOT, LA NOTE RESTE DE LA PROSE, et la porte a tranché
   * cela à ma place. Premier essai : la note ENTIÈRE devenait la pastille.
   * `StatusPill` est en `whitespace-nowrap` — un statut qui se coupe en deux
   * lignes n'est plus un statut — et « 4 locataires · jusqu'à 24 jours de
   * retard » sortait de sa carte de 80 px, plus 20 px de débordement de page à
   * 320. Une pastille est un MOT ; la phrase qui l'explique n'en est pas une.
   * C'est aussi pourquoi la rangée porte `flex-wrap` : les deux se rangent
   * l'une sous l'autre quand la carte se resserre.
   *
   * UN SEUL OBJET POUR LE TON ET LE MOT, plutôt que deux `props`. Séparés, rien
   * n'empêcherait une bordure rouge au-dessus d'un libellé « À jour » — la
   * désynchronisation serait à un oubli de distance. Ensemble, elle est
   * impossible à écrire.
   *
   * ABSENT, RIEN NE CHANGE, et c'est la raison d'être du `?`. Une carte
   * d'alerte toujours allumée est une carte qu'on cesse de lire au bout d'une
   * semaine ; l'appelant ne pose `etat` que lorsque la DONNÉE l'exige — sur un
   * parc où tout le monde a payé, la carte redevient l'une des quatre. C'est
   * aussi ce qui laisse les quinze autres appels du produit inchangés.
   */
  etat?: { ton: StatusTone; libelle: string }
  /**
   * Le repère visuel de la carte — DÉCORATIF, et il faut que ça le reste.
   *
   * Il est `aria-hidden` par construction (voir `Icon`) : ce que la carte
   * mesure est dit par son intitulé, et un lecteur d'écran n'a que faire
   * d'entendre « horloge » avant « reste à percevoir ». Une icône qui porterait
   * un sens que le texte ne porte pas serait un défaut, pas un ornement.
   *
   * Facultatif, comme `etat` : une carte sans icône reste une carte valide, et
   * le jour où un écran en pose une rangée sans repère naturel, il n'aura pas à
   * en inventer.
   */
  icone?: IconName
}) {
  return (
    <div
      /* `data-etat` n'est pas décoratif, et c'est la même raison que
         `data-jauge` sur la grille des paiements : un état doit être
         INTERROGEABLE autrement que par sa peinture. Les cas le lisent ici
         plutôt que d'inspecter une classe Tailwind — une assertion sur
         `border-danger-border` passerait au vert le jour où la carte porte le
         bon état sous une autre teinte, et rougirait sur un simple renommage
         d'utilitaire. Ce sont les deux erreurs inverses, et l'attribut les
         évite toutes les deux. */
      /* `data-indicateur` dit CE QUE CETTE BOÎTE EST ; `data-etat`, plus bas,
         ne dit que ce qui lui arrive et n'existe donc pas toujours. Il faut les
         deux, et le premier manquait : un cas des tarifs remontait jusqu'à la
         carte en comptant DEUX sauts de parent, et la tuile d'icône de ce lot en
         a ajouté un — le cas s'est mis à mesurer l'intitulé au lieu de la carte.
         Un chemin qui compte les sauts casse au premier niveau intermédiaire ;
         `closest('[data-indicateur]')` survit à tous. */
      data-indicateur=""
      data-etat={etat?.ton}
      className={cn(
        'rounded-lg border bg-surface p-4 shadow-e1 sm:p-5',
        etat ? BORDURES_D_ETAT[etat.ton] : 'border-divider',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* La tuile et l'intitulé forment UN groupe, centré sur la tuile ;
            `action` reste aligné en haut. Sans ce niveau intermédiaire, un
            intitulé de 11 px se collait au sommet d'une tuile de 32 et la
            rangée paraissait décrochée — et donner `items-center` à la rangée
            entière aurait fait descendre le bouton de suppression du parc, qui
            est une cible de 44 px et doit rester dans l'angle. */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {icone && (
            <span
              /* Même raison que `data-etat` sur la racine : la tuile doit être
                 INTERROGEABLE sans passer par sa peinture. C'est par lui qu'un
                 cas vérifie qu'une rangée d'indicateurs n'a pas gagné une
                 cinquième carte sans repère, et que la tuile suit bien l'état
                 au lieu de rester or au milieu d'une carte en alerte. */
              data-tuile={etat?.ton ?? 'neutre'}
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md',
                etat ? TUILES_D_ETAT[etat.ton] : 'bg-gold-tint text-gold-ink',
              )}
            >
              <Icon name={icone} size={15} />
            </span>
          )}
          <p className="eyebrow min-w-0 flex-1 truncate text-muted">{label}</p>
        </div>
        {action}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="numeric text-kpi font-medium whitespace-nowrap">{value}</span>
        {unit && <span className="text-body text-muted">{unit}</span>}
      </p>
      {(delta || note) && (
        <p className="mt-2 flex flex-wrap items-center gap-2">
          {delta}
          {etat && (
            <StatusPill tone={etat.ton} size="sm">
              {etat.libelle}
            </StatusPill>
          )}
          {note && <span className="text-body text-muted">{note}</span>}
        </p>
      )}
    </div>
  )
}
