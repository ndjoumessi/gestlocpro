import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'

/**
 * Graphes maison, en SVG.
 *
 * Chaque graphe est doublé d'une alternative textuelle : un `<table>` en
 * `sr-only` pour l'histogramme, une liste chiffrée pour l'anneau. Un lecteur
 * d'écran obtient les valeurs exactes, pas « graphique ».
 */

export interface StackedBar {
  label: string
  segments: { key: string; value: number }[]
}

const SERIES_COLORS: Record<string, string> = {
  rent: 'var(--color-ink)',
  water: 'var(--color-gold)',
  power: 'var(--color-border-strong)',
}

export function StackedBarChart({
  bars,
  seriesLabels,
  caption,
  /** Ligne de repère horizontale, p. ex. l'objectif attendu. */
  target,
  targetLabel,
}: {
  bars: StackedBar[]
  seriesLabels: Record<string, string>
  caption: string
  target?: number
  targetLabel?: string
}) {
  const { money, moneyCompact } = useCurrency()
  const titleId = useId()

  const totals = bars.map((bar) => bar.segments.reduce((sum, s) => sum + s.value, 0))
  const max = Math.max(...totals, target ?? 0) * 1.08
  const seriesKeys = bars[0]?.segments.map((s) => s.key) ?? []

  return (
    <figure className="m-0">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {seriesKeys.map((key) => (
          <span key={key} className="flex items-center gap-2 text-body-s text-muted">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[2px]"
              style={{ background: SERIES_COLORS[key] }}
            />
            {seriesLabels[key]}
          </span>
        ))}
      </div>

      {/* Zone de tracé et rangée d'étiquettes sont deux blocs distincts.
          C'est ce qui rend le calage exact : la ligne d'objectif se positionne
          en pourcentage de la seule zone de tracé, sans avoir à compenser à la
          main la hauteur des étiquettes. Les colonnes portent `h-full` car une
          hauteur en pourcentage ne se résout que contre un parent de hauteur
          définie — sans cela les barres ne s'affichaient pas du tout. */}
      <div className="flex h-56 flex-col" aria-hidden="true">
        <div className="relative flex min-h-0 flex-1 items-stretch gap-1.5 sm:gap-2.5">
          {target !== undefined && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-gold"
              style={{ bottom: `${(target / max) * 100}%` }}
            >
              <span className="absolute -top-4 left-0 font-mono text-[9px] tracking-wider text-gold-ink uppercase">
                {targetLabel} · {moneyCompact(target)}
              </span>
            </div>
          )}

          {bars.map((bar, index) => {
            const total = totals[index]
            const isLast = index === bars.length - 1
            return (
              <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  className="animate-grow-y flex w-full flex-col-reverse"
                  style={{ height: `${(total / max) * 100}%`, animationDelay: `${index * 35}ms` }}
                >
                  {bar.segments.map((segment, segmentIndex) => (
                    <span
                      key={segment.key}
                      className={cn(
                        'w-full',
                        segmentIndex === bar.segments.length - 1 && 'rounded-t-[3px]',
                      )}
                      style={{
                        height: `${(segment.value / total) * 100}%`,
                        background: SERIES_COLORS[segment.key],
                        // Le mois en cours est encore ouvert : on le distingue.
                        opacity: isLast ? 0.55 : 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex gap-1.5 sm:gap-2.5">
          {bars.map((bar) => (
            <span
              key={bar.label}
              className="min-w-0 flex-1 truncate text-center font-mono text-[9px] tracking-wide text-muted uppercase"
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
              <th scope="col">Période</th>
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
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius

  let offset = 0

  return (
    <figure className="m-0 flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg width="128" height="128" viewBox="0 0 100 100" aria-hidden="true">
          {slices.map((slice) => {
            const fraction = total ? slice.value / total : 0
            const dash = fraction * circumference
            const element = (
              <circle
                key={slice.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="11"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                // -90° pour démarrer à midi plutôt qu'à 3 h.
                transform="rotate(-90 50 50)"
              />
            )
            offset += dash
            return element
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="numeric text-title-l font-medium">{centerValue}</span>
          <span className="font-mono text-[9px] tracking-wide text-muted uppercase">
            {centerLabel}
          </span>
        </div>
      </div>

      {/* La légende porte les valeurs : elle est aussi l'alternative textuelle.
          `min-w-52` donne son effet au `flex-wrap` du parent. Sans plancher, la
          liste se comprimait indéfiniment au lieu de passer sous le donut, et
          l'étiquette — seule à pouvoir rétrécir, le montant étant `shrink-0` —
          était rabotée jusqu'à « P… » pour « Payé » sur écran étroit. Le seuil
          couvre l'étiquette la plus longue et le montant le plus large ; au-delà,
          la légende reste à côté du donut comme sur grand écran. */}
      <ul className="flex min-w-52 flex-1 flex-col gap-2.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2.5 text-body">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{slice.label}</span>
            <span className="numeric shrink-0 font-medium">{money(slice.value, { round: true })}</span>
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
