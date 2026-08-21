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
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }

  return (
    <div className="relative overflow-x-auto rounded-lg border border-divider bg-surface shadow-e1">
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
              className="border-b border-divider transition-colors duration-150 last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
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
