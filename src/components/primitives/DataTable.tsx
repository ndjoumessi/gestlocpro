import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Aligne à droite et passe en chiffres tabulaires. */
  numeric?: boolean
  /** Masque la colonne sous `sm` — pour l'information secondaire. */
  hideOnMobile?: boolean
  width?: string
}

export interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: ReactNode
  onRowClick?: (row: T) => void
}

/**
 * Tableau de données.
 *
 * Le conteneur porte `overflow-x-auto` : un tableau large défile dans sa
 * propre boîte au lieu de faire déborder la page entière — c'est la règle qui
 * évite le défilement horizontal du document sur mobile.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-divider bg-surface shadow-e1">
      <table className="w-full border-collapse text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-divider bg-surface-sunken">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ width: column.width }}
                className={cn(
                  'eyebrow px-4 py-3 text-left font-normal whitespace-nowrap text-muted',
                  column.numeric && 'text-right',
                  column.hideOnMobile && 'hidden sm:table-cell',
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
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-divider last:border-0 transition-colors duration-150',
                onRowClick && 'cursor-pointer hover:bg-surface-raised',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 py-3 align-middle',
                    column.numeric && 'numeric text-right whitespace-nowrap',
                    column.hideOnMobile && 'hidden sm:table-cell',
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

export function EmptyState({
  title,
  body,
  action,
  icon = 'search',
}: {
  title: string
  body?: string
  action?: ReactNode
  icon?: Parameters<typeof Icon>[0]['name']
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-sunken text-muted">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="mt-4 font-sans text-title-m font-semibold">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-body text-pretty text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
