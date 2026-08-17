import { useMemo, useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { PaymentStatusPill, type PaymentStatus } from '@/components/primitives/StatusPill'
import { StatCard } from '@/components/primitives/Charts'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatCard,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { Button } from '@/components/primitives/Button'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { type Unit } from '@/data/portfolio'
import { computeKpis } from '@/data/kpis'
import { usePortfolio } from '@/data/PortfolioProvider'
import { ReceiptModal } from './ReceiptModal'
import { RecordPaymentModal } from './RecordPaymentModal'
import { TenantScopeNote } from './TenantDashboard'

const FILTERS: (PaymentStatus | 'all')[] = ['all', 'paid', 'partial', 'overdue']

export function Payments() {
  const [quittanceDe, setQuittanceDe] = useState<string | null>(null)
  const t = useT()
  const { money } = useCurrency()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const { role } = useRole()
  const { units, isMine, readings, loading } = usePortfolio()
  const isTenant = role === 'tenant'
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all')
  const [payOpen, setPayOpen] = useState(false)

  // Le locataire ne voit que son bail. Le filtre est posé à la source du
  // tableau, pas sur l'affichage : ainsi les compteurs des onglets de statut et
  // les totaux se calculent eux aussi sur son seul périmètre.
  const leases = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.status !== 'vacant' && (role !== 'tenant' || isMine(unit.id)),
      ),
    [role, units, isMine],
  )
  const kpis = computeKpis(leases, readings)

  const rows = useMemo(
    () => (filter === 'all' ? leases : leases.filter((unit) => unit.status === filter)),
    [leases, filter],
  )

  /**
   * Après les crochets, avant le premier affichage de `leases`.
   *
   * C'est l'écran des impayés : pendant l'attente, il additionnait les loyers
   * attendus, encaissés et en retard d'un parc de démonstration, puis nommait
   * dix locataires qui ne sont pas ceux du bailleur. Trois montants faux
   * énoncés comme des faits coûtent plus cher qu'ailleurs — c'est sur eux qu'on
   * décide d'appeler quelqu'un.
   */
  if (loading) return <PaymentsSkeleton isTenant={isTenant} />

  return (
    <>
      <PageHeader
        title={t('app.payments.title')}
        description={t('app.payments.subtitle')}
        actions={
          <>
            {/* L'export part de `rows` et non de `units` : le filtre de statut
                et le périmètre du locataire sont déjà posés dessus. Exporter la
                source aurait sorti du fichier ce que l'écran refuse de montrer
                — y compris les baux des voisins, pour un locataire. */}
            <Button
              variant="secondary"
              icon="download"
              onClick={() =>
                exportCsv({
                  // Le filtre actif est dit par le nom du fichier : deux exports
                  // successifs d'un même mois ne se recouvrent pas en silence.
                  name:
                    filter === 'all'
                      ? t('app.files.payments')
                      : [t('app.files.payments'), t(`status.${filter}` as 'status.paid')],
                  headers: [
                    t('app.portfolio.unit'),
                    t('app.portfolio.tenant'),
                    csvMoney.header(t('app.payments.due')),
                    csvMoney.header(t('app.payments.paid')),
                    csvMoney.header(t('app.payments.balance')),
                    t('app.portfolio.status'),
                    t('app.payments.lateDays'),
                  ],
                  rows: rows.map((unit) => [
                    // Le libellé, pas l'identifiant technique : un fichier de
                    // suivi qui listerait des uuid serait inexploitable.
                    unit.label,
                    unit.tenant ?? t('app.portfolio.noTenant'),
                    csvMoney.amount(unit.rent),
                    csvMoney.amount(unit.paid),
                    csvMoney.amount(unit.rent - unit.paid),
                    t(`status.${unit.status}` as 'status.paid'),
                    // Un nombre de jours n'est pas de l'argent, mais il se
                    // calcule aussi : groupé, il deviendrait du texte.
                    unit.overdueDays ?? null,
                  ]),
                })
              }
            >
              {t('app.exportStatement')}
            </Button>
            {/* Enregistrer un encaissement est un geste de gestion : le
                locataire consulte, il ne saisit pas. */}
            {!isTenant && (
              <Button icon="plus" onClick={() => setPayOpen(true)}>
                {t('app.recordPayment')}
              </Button>
            )}
          </>
        }
      />

      {isTenant ? (
        <TenantScopeNote />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('app.dashboard.expected')} value={money(kpis.expected, { round: true })} />
          <StatCard
            label={t('app.dashboard.recoveryCollected')}
            value={money(kpis.collected, { round: true })}
          />
          <StatCard
            label={t('app.dashboard.recoveryLate')}
            value={money(kpis.late, { round: true })}
          />
        </div>
      )}

      <div role="group" aria-label={t('app.portfolio.status')} className="mt-6 mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((value) => {
          const active = filter === value
          const count =
            value === 'all' ? leases.length : leases.filter((u) => u.status === value).length
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(value)}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3.5',
                'text-label font-semibold transition-colors duration-150',
                active
                  ? 'border-ink bg-ink text-on-dark'
                  : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ink',
              )}
            >
              {value === 'all' ? t('app.payments.filterAll') : t(`status.${value}` as 'status.paid')}
              {/* `gold-on-ink` : le filtre actif peint son fond en `--color-ink`,
                  qui s'inverse avec le thème. À 12 px ce compteur est du texte,
                  donc il lui faut 4,5:1 — l'or de marque n'en donnait que 2,33
                  en sombre. */}
              <span className={cn('numeric text-caps', active ? 'text-gold-on-ink' : 'text-muted')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <DataTable<Unit>
        caption={t('app.payments.title')}
        rows={rows}
        rowKey={(unit) => unit.id}
        empty={
          <EmptyState
            icon="card"
            title={t('app.system.emptyTitle')}
            body={t('app.system.emptyBody')}
            action={
              <Button variant="secondary" onClick={() => setFilter('all')}>
                {t('app.payments.filterAll')}
              </Button>
            }
          />
        }
        columns={[
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            render: (unit) => <span className="numeric font-medium">{unit.label}</span>,
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            render: (unit) => unit.tenant,
          },
          {
            key: 'due',
            header: t('app.payments.due'),
            numeric: true,
            hideOnMobile: true,
            render: (unit) => money(unit.rent, { round: true }),
          },
          {
            key: 'paid',
            header: t('app.payments.paid'),
            numeric: true,
            render: (unit) => money(unit.paid, { round: true }),
          },
          {
            key: 'balance',
            header: t('app.payments.balance'),
            numeric: true,
            render: (unit) => {
              const balance = unit.rent - unit.paid
              // Un bail qui démarre affiche son loyer à venir, mais pas en
              // rouge : ce n'est pas un impayé, c'est une échéance future.
              const enRetard = unit.status === 'overdue' || unit.status === 'partial'
              return (
                <span
                  className={cn(
                    balance > 0 && enRetard ? 'font-medium text-danger' : 'text-muted',
                  )}
                >
                  {money(balance, { round: true })}
                </span>
              )
            },
          },
          {
            key: 'status',
            header: t('app.portfolio.status'),
            render: (unit) => (
              <div className="flex items-center gap-2">
                <PaymentStatusPill status={unit.status} size="sm" />
                {/* Le « j » d'abréviation restait français en anglais, et le
                    `&&` sur un nombre aurait affiché « 0 » plutôt que rien si
                    le retard tombait à zéro.
                    `whitespace-nowrap` : « +24 j » se coupait à l'espace et
                    s'empilait sur deux lignes à côté de la pastille, ce qui
                    décalait la hauteur de la ligne du tableau. Le retard est
                    une valeur unique, elle se lit d'un bloc. Le tableau défile
                    déjà dans sa propre boîte : la douzaine de pixels que cela
                    coûte ne se paie pas sur la page. */}
                {unit.overdueDays ? (
                  <span className="numeric text-caps whitespace-nowrap text-muted">
                    {t('app.payments.overdueDays', { days: unit.overdueDays })}
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            key: 'receipt',
            header: '',
            render: (unit) =>
              // Offert seulement s'il y a quelque chose à attester : sur un
              // logement vacant, le bouton n'aurait aucun sens.
              unit.tenant ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="download"
                  onClick={() => setQuittanceDe(unit.id)}
                >
                  {t('app.receipts.issue')}
                </Button>
              ) : null,
          },
        ]}
      />

      {/* La période est le mois courant : c'est celle qu'on quittance dans la
          quasi-totalité des cas. Le serveur en accepte d'autres, et l'écran
          saura les offrir le jour où le besoin se posera. */}
      {quittanceDe && (
        <ReceiptModal
          open
          unitId={quittanceDe}
          periodStart={`${new Date().toISOString().slice(0, 7)}-01`}
          onClose={() => setQuittanceDe(null)}
        />
      )}

      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  )
}

/**
 * Les paiements, le temps que le parc arrive.
 *
 * Titre et sous-titre sont écrits en dur : ils restent. Les deux actions sont
 * retenues, et pour des raisons différentes — l'export sortirait un fichier
 * d'impayés de démonstration que rien, dans le tableur, ne signalerait comme
 * faux ; l'enregistrement d'un paiement l'imputerait à un bail qui n'existe pas
 * chez ce bailleur.
 *
 * Le locataire n'a qu'un bouton et pas d'indicateurs : sa page est composée
 * autrement, et un squelette qui montrerait trois cartes lui promettrait une
 * mise en page qui ne viendra pas.
 */
function PaymentsSkeleton({ isTenant }: { isTenant: boolean }) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.payments.title')}
        description={t('app.payments.subtitle')}
        actions={
          <>
            <Skeleton radius="md" className="h-11 w-44" />
            {!isTenant && <Skeleton radius="md" className="h-11 w-52" />}
          </>
        }
      />

      <SkeletonRegion>
        {isTenant ? (
          // La hauteur du bandeau de périmètre : une pastille dans une boîte
          // `py-2.5`. Il nomme les unités du locataire, qu'on ne connaît pas
          // encore.
          <Skeleton radius="md" className="mb-4 h-11 w-full max-w-lg" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((carte) => (
              <SkeletonStatCard key={carte} />
            ))}
          </div>
        )}

        {/* Quatre filtres, exactement comme `FILTERS` : leur nombre ne dépend
            d'aucune donnée, seuls leurs compteurs en dépendent. */}
        <div className="mt-6 mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((valeur) => (
            <Skeleton key={valeur} radius="md" className="h-11 w-28" />
          ))}
        </div>

        <SkeletonTable />
      </SkeletonRegion>
    </>
  )
}
