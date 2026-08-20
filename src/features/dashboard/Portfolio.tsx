import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { PaymentStatusPill } from '@/components/primitives/StatusPill'
import { StatCard } from '@/components/primitives/Charts'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatCard,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import type { Immeuble } from '@/data/apiPortfolio'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { AddBuildingModal } from './AddBuildingModal'
import { AddUnitModal } from './AddUnitModal'

export function Portfolio() {
  const base = useBase()
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [logementOuvert, setLogementOuvert] = useState(false)
  const t = useT()
  const { money } = useCurrency()
  const { units, buildings: BUILDINGS, buildingById, loading, removeBuilding } = usePortfolio()
  const { notify } = useToast()
  /** L'immeuble dont la suppression attend confirmation. */
  const [aSupprimer, setASupprimer] = useState<Immeuble | null>(null)
  const [query, setQuery] = useState('')
  const [building, setBuilding] = useState<string | 'all'>('all')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return units.filter((unit) => {
      if (building !== 'all' && unit.buildingId !== building) return false
      if (!needle) return true
      const haystack = [
        // Le libellé et non l'identifiant : c'est « A1 » que l'utilisateur voit
        // dans la colonne et retape ici, pas l'uuid que servira l'API.
        unit.label,
        // La typologie est cherchée sur son libellé traduit et non sur la clé :
        // un anglophone qui voit « 2-bed » à l'écran tape « bed », pas « T3 ».
        t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1'),
        unit.tenant ?? '',
        buildingById(unit.buildingId)?.name ?? '',
        buildingById(unit.buildingId)?.district ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, building, units, t])

  const occupied = units.filter((u) => u.status !== 'vacant').length

  /**
   * L'occupation par immeuble se dérive de l'état vivant.
   *
   * Elle lisait `BUILDINGS`, une constante figée, tandis que la carte globale
   * juste à côté comptait les unités du provider. Rattacher un locataire fait
   * passer une unité de `vacant` à `pending` : le total bougeait, les quatre
   * cartes d'immeuble non. Deux chiffres contradictoires sur la même ligne.
   */
  const occupancyOf = (buildingId: string) => {
    const inBuilding = units.filter((u) => u.buildingId === buildingId)
    return { occupied: inBuilding.filter((u) => u.status !== 'vacant').length, total: inBuilding.length }
  }

  /**
   * Placé après les crochets — ils doivent tourner à chaque rendu — et avant le
   * moindre affichage de `units`.
   *
   * C'est l'écran où le mensonge se voyait le plus : douze lignes de logements,
   * avec leurs locataires et leurs loyers, dans un tableau qui invite à
   * chercher, filtrer et cliquer. Un gestionnaire qui tape le nom d'un de ses
   * locataires pendant l'attente obtient « Aucun résultat » sur un parc qui
   * n'est pas le sien.
   */
  if (loading) return <PortfolioSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.portfolio.title')}
        description={t('app.portfolio.subtitle', {
          buildings: t('common.buildingCount', { count: BUILDINGS.length }),
          units: t('common.unitCount', { count: units.length }),
        })}
        // Le seul endroit du produit où l'on constitue son parc. Il n'existait
        // pas : tous les écrans opéraient sur des immeubles qu'aucun geste ne
        // pouvait créer.
        actions={
          <>
            <Button variant="secondary" icon="plus" onClick={() => setAjoutOuvert(true)}>
              {t('app.portfolio.addBuildingTitle')}
            </Button>
            <Button icon="plus" onClick={() => setLogementOuvert(true)}>
              {t('app.portfolio.addUnitTitle')}
            </Button>
          </>
        }
      />

      {ajoutOuvert && <AddBuildingModal open onClose={() => setAjoutOuvert(false)} />}

      {/* Une confirmation AVANT une suppression définitive : c'est le seul
          geste de cet écran qu'on ne peut pas défaire. */}
      {aSupprimer && (
        <Modal
          open
          onClose={() => setASupprimer(null)}
          title={t('app.portfolio.deleteBuildingTitle', { name: aSupprimer.name })}
          description={t('app.portfolio.deleteBuildingBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setASupprimer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  removeBuilding(aSupprimer.id)
                  setASupprimer(null)
                  notify(t('app.portfolio.deleteBuildingDone'), { tone: 'ok' })
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-body-s text-muted">{aSupprimer.district}</p>
        </Modal>
      )}
      {logementOuvert && <AddUnitModal open onClose={() => setLogementOuvert(false)} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BUILDINGS.map((b) => {
          const { occupied: occ, total } = occupancyOf(b.id)
          return (
            <StatCard
              key={b.id}
              /* Le NOM et non le quartier : la carte parle d'un immeuble, et
                 deux immeubles d'un même quartier donnaient deux cartes
                 intitulées « BASTOS ». Le quartier passe en note, où il situe
                 sans prétendre nommer. */
              label={b.name}
              value={`${occ}/${total}`}
              note={`${b.district} · ${t('app.portfolio.occupancy', { occupied: occ, total })}`}
              action={
                /* L'issue n'apparaît que sur un immeuble VIDE — le serveur
                   refuse les autres, et offrir un geste qu'il refusera revient
                   à promettre ce qu'on ne tient pas. */
                total === 0 ? (
                  <button
                    type="button"
                    aria-label={t('app.portfolio.deleteBuilding', { name: b.name })}
                    onClick={() => setASupprimer(b)}
                    className="-my-1.5 -mr-1.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-danger-tint hover:text-danger"
                  >
                    <Icon name="close" size={15} />
                  </button>
                ) : undefined
              }
            />
          )
        })}
        <StatCard
          label={t('app.dashboard.occupancy')}
          /* `computeKpis` borne déjà cette division — « un parc vide donne 0 %
             et non NaN » — et ce second calcul, écrit à la main ici, ne le
             faisait pas. Un compte neuf lisait « NaN % » dès l'ouverture de cet
             écran, sur le seul indicateur de la page. */
          value={`${units.length === 0 ? 0 : Math.round((occupied / units.length) * 100)}`}
          unit="%"
          note={t('app.portfolio.occupancy', { occupied, total: units.length })}
        />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            icon="search"
            type="search"
            aria-label={t('nav.searchPlaceholder')}
            placeholder={t('nav.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div role="group" aria-label={t('app.portfolio.building')} className="flex flex-wrap gap-1.5">
          {/*
            Le bouton porte le NOM de l'immeuble, qui est ce sur quoi il filtre.
            Il portait le quartier : deux résidences à Bastos auraient donné deux
            boutons identiques, dont l'un aurait été injoignable — l'utilisateur
            aurait cliqué le premier en croyant atteindre le second.
          */}
          {[{ id: 'all', name: t('app.portfolio.filterAll') }, ...BUILDINGS].map((b) => {
            const active = building === b.id
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => setBuilding(b.id)}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3.5',
                  'text-label font-semibold transition-colors duration-150',
                  active
                    ? 'border-ink bg-ink text-on-dark'
                    : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ink',
                )}
              >
                {b.name}
              </button>
            )
          })}
        </div>
      </div>

      <DataTable<Unit>
        caption={t('app.portfolio.title')}
        rows={rows}
        rowKey={(unit) => unit.id}
        empty={
          /* Deux absences, deux messages. Un parc sans aucun logement n'a pas
             « échoué à trouver » : il n'a rien à trouver. L'écran annonçait
             pourtant « Aucune unité ne correspond à «  » » — la requête vide
             entre ses guillemets — et proposait de réinitialiser des filtres
             qu'on n'avait pas posés. C'est le premier écran d'un compte neuf. */
          units.length === 0 ? (
            /* Sans bouton : « Ajouter un immeuble » est déjà dans l'en-tête,
               à trois centimètres au-dessus. Le répéter donnait deux actions
               principales identiques sur le même écran — un doublon que la
               synthèse vocale annonce deux fois, et qui fait hésiter sur
               laquelle est la bonne. Le texte dit le geste, l'en-tête le
               porte. */
            <EmptyState
              icon="building"
              title={t('app.portfolio.emptyTitle')}
              body={t('app.portfolio.emptyBody')}
            />
          ) : (
          <EmptyState
            title={t('app.portfolio.searchEmpty', { query })}
            body={t('app.portfolio.searchEmptyHint')}
            // Ce bouton réutilisait la clé du filtre, donc il s'appelait
            // « Tous » / « All » : le libellé d'un filtre, pas d'une action.
            // Il réinitialise la recherche ET l'immeuble — il le dit.
            action={
              <Button variant="secondary" onClick={() => { setQuery(''); setBuilding('all') }}>
                {t('app.portfolio.resetFilters')}
              </Button>
            }
          />
          )
        }
        columns={[
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            /**
             * UN LIEN DANS LA CELLULE, et non une ligne cliquable.
             *
             * C'est la voie que `DataTable` avait laissée ouverte, en toutes
             * lettres : « le jour où une ligne devra mener quelque part, la
             * réponse juste sera un vrai lien dans une cellule — focalisable,
             * ouvrable dans un nouvel onglet, annoncé par sa destination — et
             * non une rangée piégée ». Ce jour est arrivé avec le dossier du
             * logement.
             *
             * Le nom accessible porte le libellé de l'unité : « A1 » seul, dans
             * une liste de dix liens, ne dit pas où l'on va.
             */
            render: (unit) => (
              <Link
                to={lien(base, `parc/${unit.id}`)}
                aria-label={t('app.unitFile.open', { unit: unit.label })}
                className="numeric font-medium text-ink underline-offset-4 hover:underline"
              >
                {unit.label}
              </Link>
            ),
          },
          {
            key: 'building',
            /**
             * LE NOM DE L'IMMEUBLE, sous un en-tête qui dit « Immeuble ».
             *
             * La cellule rendait le QUARTIER. La vignette du haut, elle, rend le
             * nom : « Résidence Djoumessi » en carte et « Bastos » en ligne
             * désignaient le même bâtiment sans que rien ne le dise, et deux
             * résidences d'un même quartier étaient indiscernables dans le
             * tableau. Le quartier reste, en second, parce qu'il situe — mais
             * il ne tient plus la place du nom.
             */
            header: t('app.portfolio.building'),
            hideOnMobile: true,
            render: (unit) => {
              const immeuble = buildingById(unit.buildingId)
              return (
                <div className="flex flex-col">
                  <span>{immeuble?.name}</span>
                  <span className="text-body-s text-muted">{immeuble?.district}</span>
                </div>
              )
            },
          },
          {
            key: 'type',
            // La colonne s'intitulait « Type » mais ses cellules portent la
            // typologie ET la surface : un lecteur d'écran annonçait « Type »
            // sur « T3 · 78 m² ». La clé `surface` existait, inutilisée.
            header: `${t('app.portfolio.type')} · ${t('app.portfolio.surface')}`,
            hideOnMobile: true,
            render: (unit) => (
              <span className="text-muted">
                {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} · {unit.surface} m²
              </span>
            ),
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            render: (unit) =>
              unit.tenant ?? <span className="text-muted italic">{t('app.portfolio.noTenant')}</span>,
          },
          {
            key: 'rent',
            header: t('app.portfolio.rent'),
            numeric: true,
            render: (unit) => money(unit.rent, { round: true }),
          },
          {
            key: 'status',
            header: t('app.portfolio.status'),
            render: (unit) => <PaymentStatusPill status={unit.status} size="sm" />,
          },
        ]}
      />
    </>
  )
}

/**
 * Le parc, le temps qu'il arrive.
 *
 * Titre et sous-titre restent : ils sont écrits en dur, aucune donnée ne les
 * décide. Les deux actions, elles, sont retenues — « ajouter un logement »
 * ouvre une modale qui fait choisir un immeuble, et les seuls immeubles connus
 * à cet instant sont ceux de la démonstration. Le geste partirait au serveur
 * avec l'identifiant d'un immeuble qui n'existe pas chez lui.
 *
 * La recherche et les filtres sont retenus pour la même raison : filtrer un
 * parc qu'on n'a pas encore n'a pas de sens, et un champ de recherche actif
 * pendant l'attente invite à taper pour ne rien trouver.
 */
function PortfolioSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.portfolio.title')}
        /* Le sous-titre porte désormais les comptes réels : pendant l'attente
           on ne les connaît pas, et en inventer — ne serait-ce que zéro —
           annoncerait un parc vide à qui en a un. Un pavé tient la place. */
        description={<Skeleton line="body" className="w-full max-w-md" />}
        actions={
          <>
            <Skeleton radius="md" className="h-11 w-48" />
            <Skeleton radius="md" className="h-11 w-44" />
          </>
        }
      />

      <SkeletonRegion>
        {/* Quatre cartes : le nombre réel vaut « un par immeuble, plus le
            total », donc il dépend du parc qu'on attend. Quatre remplit
            exactement une rangée de la grille sur grand écran. */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((carte) => (
            <SkeletonStatCard key={carte} />
          ))}
        </div>

        <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
          <Skeleton radius="md" className="h-11 w-full max-w-xs" />
          {[0, 1, 2].map((filtre) => (
            <Skeleton key={filtre} radius="md" className="h-11 w-24" />
          ))}
        </div>

        <SkeletonTable />
      </SkeletonRegion>
    </>
  )
}
