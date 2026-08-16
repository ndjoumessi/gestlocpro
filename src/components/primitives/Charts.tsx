import { useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'

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
 * (1 %, 18 %, 26 %) pour rester distinctes en niveaux de gris.
 */
const SERIES_COLORS: Record<string, string> = {
  rent: 'var(--color-data-1)',
  water: 'var(--color-data-4)',
  power: 'var(--color-data-5)',
}

export interface StackedBar {
  label: string
  segments: { key: string; value: number }[]
}

export function StackedBarChart({
  bars,
  seriesLabels,
  caption,
  /** Ligne de repère horizontale, p. ex. l'objectif attendu. */
  target,
  targetLabel,
  /** Note affichée dans l'infobulle pour la dernière colonne. */
  openPeriodNote,
}: {
  bars: StackedBar[]
  seriesLabels: Record<string, string>
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
  /** Colonne survolée ou focalisée ; `null` quand l'infobulle est fermée. */
  const [active, setActive] = useState<number | null>(null)

  const seriesKeys = bars[0]?.segments.map((s) => s.key) ?? []
  const visible = (key: string) => !hidden.has(key)

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

  /** L'échelle ne se cale que sur ce qui est effectivement tracé. */
  const max = Math.max(...totals, showTarget ? target : 0, 1) * 1.08

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
      {/* Légende interrogeable : chaque entrée masque ou rétablit sa série. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {seriesKeys.map((key) => {
          const shown = visible(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleSeries(key)}
              aria-pressed={shown}
              className={cn(
                'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 -mx-0.5',
                'text-body-s transition-colors duration-150 hover:bg-surface-sunken',
                shown ? 'text-muted' : 'text-muted-soft',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('size-2.5 rounded-[2px] transition-opacity duration-150')}
                style={{ background: SERIES_COLORS[key], opacity: shown ? 1 : 0.25 }}
              />
              <span className={cn(!shown && 'line-through')}>{seriesLabels[key]}</span>
            </button>
          )
        })}
      </div>

      {/* Zone de tracé et rangée d'étiquettes sont deux blocs distincts.
          C'est ce qui rend le calage exact : la ligne d'objectif se positionne
          en pourcentage de la seule zone de tracé, sans avoir à compenser à la
          main la hauteur des étiquettes. Les colonnes portent `h-full` car une
          hauteur en pourcentage ne se résout que contre un parent de hauteur
          définie — sans cela les barres ne s'affichaient pas du tout. */}
      <div className="flex h-56 flex-col sm:h-64">
        <div className="relative flex min-h-0 flex-1 items-stretch gap-1 sm:gap-2.5">
          {showTarget && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-gold"
              style={{ bottom: `${(target / max) * 100}%` }}
            >
              {/* Le montant EXACT, et non sa forme compacte.
                  « 1,4 M » côtoyait « 1 397 000 FCFA » sur la même vue : les
                  deux disent le même chiffre, mais leur voisinage invite à les
                  comparer — et l'arrondi fait douter de celui qui ne l'est
                  pas.

                  C'était le dernier appelant de `moneyCompact` : la forme
                  compacte n'a plus d'emploi dans le produit. Elle reste
                  exportée et testée, à décider. */}
              <span className="absolute -top-4 left-0 font-mono text-mono-label tracking-wider text-gold-ink uppercase">
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
                className="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-sm"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive((c) => (c === index ? null : c))}
                onFocus={() => setActive(index)}
                onBlur={() => setActive((c) => (c === index ? null : c))}
                aria-label={`${bar.label} — ${money(total)}. ${detail}`}
              >
                <span
                  className="animate-grow-y flex w-full flex-col-reverse"
                  style={{
                    height: `${(total / max) * 100}%`,
                    animationDelay: `${index * 35}ms`,
                  }}
                >
                  {bar.segments
                    .filter((segment) => visible(segment.key))
                    .map((segment, segmentIndex, shownSegments) => (
                      <span
                        key={segment.key}
                        className={cn(
                          'w-full transition-opacity duration-150',
                          segmentIndex === shownSegments.length - 1 && 'rounded-t-[3px]',
                        )}
                        style={{
                          height: `${total ? (segment.value / total) * 100 : 0}%`,
                          background: SERIES_COLORS[segment.key],
                          // Le mois en cours est encore ouvert : on le
                          // distingue. La colonne visée s'éclaire, celles qu'on
                          // ne vise pas s'effacent — l'attention suit le
                          // curseur sans que rien ne bouge de place.
                          opacity: isLast && !isActive ? 0.55 : active !== null && !isActive ? 0.4 : 1,
                        }}
                      />
                    ))}
                </span>
              </button>
            )
          })}

          {active !== null && (
            <Tooltip
              anchor={active}
              count={bars.length}
              title={bars[active].label}
              total={money(totals[active])}
              rows={bars[active].segments
                .filter((s) => visible(s.key))
                .map((s) => ({
                  key: s.key,
                  label: seriesLabels[s.key],
                  value: money(s.value),
                  color: SERIES_COLORS[s.key],
                }))}
              note={active === bars.length - 1 ? openPeriodNote : undefined}
            />
          )}
        </div>

        <div className="mt-2.5 flex gap-1 sm:gap-2.5" aria-hidden="true">
          {bars.map((bar, index) => (
            <span
              key={bar.label}
              className={cn(
                'min-w-0 flex-1 truncate text-center font-mono text-mono-label tracking-wide uppercase',
                'transition-colors duration-150',
                active === index ? 'text-ink' : 'text-muted',
                // Douze étiquettes ne tiennent pas sur un téléphone : on en
                // retire une sur deux plutôt que de toutes les tronquer.
                index % 2 === 1 && 'max-sm:invisible',
              )}
            >
              {bar.label}
            </span>
          ))}
        </div>
      </div>

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
 * Infobulle d'une colonne.
 *
 * `aria-hidden` : son contenu est déjà porté par l'`aria-label` du bouton
 * déclencheur, et l'annoncer deux fois ferait répéter les mêmes chiffres au
 * lecteur d'écran. Elle est purement visuelle.
 *
 * Le calage évite le débordement sans mesurer quoi que ce soit : les colonnes
 * extrêmes ancrent l'infobulle sur leur bord, les autres la centrent.
 */
function Tooltip({
  anchor,
  count,
  title,
  total,
  rows,
  note,
}: {
  anchor: number
  count: number
  title: string
  total: string
  rows: { key: string; label: string; value: string; color: string }[]
  note?: string
}) {
  const first = anchor === 0
  const last = anchor === count - 1

  return (
    <div
      aria-hidden="true"
      className={cn(
        'on-dark pointer-events-none absolute bottom-full z-20 mb-3 w-max max-w-[min(15rem,80vw)]',
        'animate-rise rounded-lg bg-ink px-3.5 py-3 text-on-dark shadow-e3',
        first && 'left-0',
        last && 'right-0',
      )}
      style={
        first || last
          ? undefined
          : { left: `${((anchor + 0.5) / count) * 100}%`, transform: 'translateX(-50%)' }
      }
    >
      <p className="font-mono text-mono-label tracking-wider text-on-dark-faint uppercase">
        {title}
      </p>
      <p className="numeric mt-1 text-title-m font-semibold text-on-dark">{total}</p>

      {/* Le bloc de détail disparaît quand la série est unique : un filet et
          un espacement sous un total, sans rien en dessous, se lisent comme un
          contenu qui a échoué à s'afficher. */}
      {rows.length > 0 && (
      <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-on-dark-border pt-2.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-body-s">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: row.color }}
            />
            <span className="min-w-0 flex-1 text-on-dark-muted">{row.label}</span>
            <span className="numeric shrink-0 text-on-dark">{row.value}</span>
          </li>
        ))}
      </ul>
      )}

      {note && <p className="mt-2.5 text-body-s text-on-dark-faint">{note}</p>}
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
}: {
  bars: { label: string; value: number }[]
  caption: string
  openPeriodNote?: string
}) {
  const { money } = useCurrency()
  const titleId = useId()
  const [active, setActive] = useState<number | null>(null)

  const max = Math.max(...bars.map((b) => b.value), 1) * 1.04

  return (
    <figure className="m-0" aria-labelledby={titleId}>
      <div className="relative flex h-24 items-end gap-1 sm:h-28 sm:gap-1.5">
        {bars.map((bar, index) => {
          const isLast = index === bars.length - 1
          const isActive = active === index

          return (
            <button
              key={bar.label}
              type="button"
              className="group flex h-full min-w-0 flex-1 cursor-pointer items-end rounded-sm"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive((c) => (c === index ? null : c))}
              onFocus={() => setActive(index)}
              onBlur={() => setActive((c) => (c === index ? null : c))}
              aria-label={`${bar.label} — ${money(bar.value, { round: true })}`}
            >
              <span
                className="animate-grow-y w-full rounded-t-[3px] transition-opacity duration-150"
                style={{
                  height: `${(bar.value / max) * 100}%`,
                  background: isLast ? 'var(--color-gold)' : 'var(--color-data-1)',
                  animationDelay: `${index * 40}ms`,
                  opacity: active !== null && !isActive ? 0.4 : isLast ? 1 : 0.85,
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
      <div className="mt-3 flex min-h-5 items-baseline justify-between gap-3">
        <span
          aria-hidden="true"
          className="font-mono text-mono-label tracking-wide text-muted uppercase"
        >
          {bars[0]?.label}
        </span>

        <span
          aria-live="polite"
          className="min-w-0 truncate text-center text-body-s font-medium text-ink"
        >
          {active !== null && (
            <>
              <span className="font-mono text-mono-label tracking-wide text-muted uppercase">
                {bars[active].label}
              </span>{' '}
              <span className="numeric">{money(bars[active].value, { round: true })}</span>
            </>
          )}
        </span>

        <span
          aria-hidden="true"
          className="font-mono text-mono-label tracking-wide text-muted uppercase"
        >
          {bars[bars.length - 1]?.label}
        </span>
      </div>

      {/* Le mois en cours est encore ouvert : sa colonne est plus basse sans
          que rien ne l'explique. La note ne s'affiche que lorsqu'on la vise. */}
      {openPeriodNote && active === bars.length - 1 && (
        <p className="mt-1.5 text-center text-body-s text-muted">{openPeriodNote}</p>
      )}

      <div className="sr-only">
        <table>
          <caption id={titleId}>{caption}</caption>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.label}>
                <th scope="row">{bar.label}</th>
                <td>{money(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  caption,
}: {
  slices: DonutSlice[]
  centerValue: string
  centerLabel: string
  caption: string
}) {
  const { money } = useCurrency()
  const [active, setActive] = useState<string | null>(null)

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius

  let offset = 0
  const arcs = slices.map((slice) => {
    const fraction = total ? slice.value / total : 0
    const arc = { slice, dash: fraction * circumference, offset, fraction }
    offset += arc.dash
    return arc
  })

  const shown = arcs.find((a) => a.slice.key === active)

  return (
    <figure className="m-0 flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg width="128" height="128" viewBox="0 0 100 100" aria-hidden="true">
          {arcs.map(({ slice, dash, offset: arcOffset }) => (
            <circle
              key={slice.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={slice.color}
              // La part visée épaissit vers l'extérieur : l'anneau ne change
              // pas de rayon, donc rien ne se déplace autour.
              strokeWidth={active === slice.key ? 14 : 11}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-arcOffset}
              opacity={active && active !== slice.key ? 0.35 : 1}
              className="transition-all duration-150"
              // -90° pour démarrer à midi plutôt qu'à 3 h.
              transform="rotate(-90 50 50)"
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {/* Le centre affiche la part visée, et retombe sur la valeur
              d'ensemble dès qu'on relâche — sans quoi il faudrait lire la
              légende et le centre en même temps pour comprendre. */}
          <span className="numeric text-title-l font-medium">
            {shown ? `${Math.round(shown.fraction * 100)} %` : centerValue}
          </span>
          <span className="max-w-[6rem] font-mono text-mono-label tracking-wide text-muted uppercase">
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
          <li key={slice.key}>
            <button
              type="button"
              onMouseEnter={() => setActive(slice.key)}
              onMouseLeave={() => setActive((c) => (c === slice.key ? null : c))}
              onFocus={() => setActive(slice.key)}
              onBlur={() => setActive((c) => (c === slice.key ? null : c))}
              className={cn(
                'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 -mx-2',
                'text-left text-body transition-colors duration-150',
                active === slice.key ? 'bg-surface-sunken' : 'hover:bg-surface-sunken',
              )}
              aria-label={`${slice.label} — ${money(slice.value, { round: true })}, ${Math.round(fraction * 100)} %`}
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate text-muted">{slice.label}</span>
              <span className="numeric shrink-0 font-medium">
                {money(slice.value, { round: true })}
              </span>
            </button>
          </li>
        ))}
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
}: {
  value: number
  label: string
  tone?: 'gold' | 'ok' | 'danger'
}) {
  const colors = { gold: 'bg-gold', ok: 'bg-ok', danger: 'bg-danger' }

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-body-s text-muted">{label}</span>
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
      <span className="numeric w-10 shrink-0 text-right text-body-s text-muted">{value} %</span>
    </div>
  )
}

/** Tuile de KPI : libellé, valeur, delta et note. */
export function StatCard({
  label,
  value,
  unit,
  delta,
  note,
}: {
  label: string
  value: string
  unit?: string
  delta?: ReactNode
  note?: string
}) {
  return (
    <div className="rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5">
      <p className="eyebrow text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="numeric text-mono-kpi font-medium whitespace-nowrap">{value}</span>
        {unit && <span className="text-body-s text-muted">{unit}</span>}
      </p>
      {(delta || note) && (
        <p className="mt-2 flex flex-wrap items-center gap-2">
          {delta}
          {note && <span className="text-body-s text-muted">{note}</span>}
        </p>
      )}
    </div>
  )
}
