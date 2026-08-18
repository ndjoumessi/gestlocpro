import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { StatCard } from '@/components/primitives/Charts'
import { PaymentStatusPill, StatusPill } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion, SkeletonStatCard } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useNumbers } from '@/lib/numbers'
import {
  TENANT_RECEIPTS,
  UTILITY_RATES,
  buildingById,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { ReceiptModal } from './ReceiptModal'
import { workTitle } from '@/data/workTitle'
import { useReceiptExport } from './receiptExport'

/**
 * Espace locataire.
 *
 * Vue distincte du tableau de bord propriétaire, et non une variante filtrée :
 * un locataire ne cherche pas un taux d'occupation ni un encaissé consolidé, il
 * veut son échéance, ses quittances et l'état de ses signalements. Toutes les
 * données proviennent de sa seule unité — le parc n'est jamais interrogé.
 */
/**
 * Les trois dernières périodes, mois courant compris.
 *
 * Calculées une fois au chargement du module : elles ne changent pas pendant
 * qu'on lit l'écran, et les recalculer à chaque rendu ferait dépendre le test
 * de l'instant où il tourne.
 */
const PERIODES_RECENTES = (() => {
  const maintenant = new Date()
  return [0, 1, 2].map((recul) => {
    const m = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - recul, 1))
    return { year: m.getUTCFullYear(), month: m.getUTCMonth() + 1 }
  })
})()

export function TenantDashboard() {
  const [quittanceDe, setQuittanceDe] = useState<string | null>(null)
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const downloadReceipt = useReceiptExport()
  const { worksForUnit, depositForUnit, unitById, tenantUnitIds, readingForUnit, loading } =
    usePortfolio()

  /**
   * Cet écran est mono-unité par conception : un locataire y voit SON logement.
   * Il prend donc la première de ses unités, et c'est une limite assumée — le
   * modèle en autorise plusieurs, l'écran n'en montre qu'une.
   */
  const monUnite = tenantUnitIds[0] ?? ''

  const unit = unitById(monUnite)
  const building = unit ? buildingById(unit.buildingId) : undefined
  const deposit = depositForUnit(monUnite)
  const reading = readingForUnit(monUnite)
  const works = worksForUnit(monUnite)
  const openWorks = works.filter((work) => work.status !== 'done')

  /**
   * L'attente passe AVANT le garde `!unit`, et c'est l'ordre qui importe.
   *
   * Le locataire lisait le logement A1 de la démonstration : son numéro, sa
   * surface, son loyer, sa caution et six quittances datées. Aucun de ces
   * éléments n'est marqué comme provisoire, et c'est le seul écran du produit
   * où l'utilisateur n'a AUCUN moyen de recouper — il ne connaît pas le parc,
   * il ne connaît que son bail. Lui montrer celui d'un autre est le pire cas de
   * tout ce chantier.
   *
   * Placé après le garde, il ne servirait à rien : pendant l'attente le jeu de
   * démonstration fournit toujours une unité, donc `!unit` est faux et la page
   * s'affichait entière.
   */
  if (loading) return <TenantDashboardSkeleton />

  if (!unit) return null

  const water = reading?.waterCurrent === null || !reading ? null : reading.waterCurrent - reading.waterPrevious
  const power = reading?.powerCurrent === null || !reading ? null : reading.powerCurrent - reading.powerPrevious
  const rebilled =
    water === null || power === null ? null : water * UTILITY_RATES.water + power * UTILITY_RATES.power

  return (
    <>
      <PageHeader
        title={t('app.tenant.title')}
        description={t('app.tenant.subtitle')}
        actions={
          <Button icon="bell" to={lien(base, 'signalements')}>
            {t('app.tenant.contactManager')}
          </Button>
        }
      />

      {/*
        MON BAIL — la carte que la maquette du portail met en évidence.

        Le locataire lisait son loyer et sa consommation, jamais les TERMES de
        son contrat : combien il paie chaque mois, et combien il a versé en
        caution. Cette dernière est son argent, et il ne pouvait le lire nulle
        part — c'est ce que ce produit reproche aux pratiques qu'il remplace.

        Le montant vient de `depositForUnit`, la même source que l'écran des
        cautions : deux chiffres pour un seul fait divergeraient au premier
        arbitrage.
      */}
      {/*
        MES QUITTANCES — la colonne « quittance » de la maquette du portail.

        Le locataire n'avait AUCUN accès à ses propres quittances : elles ne
        s'émettent que depuis l'écran des paiements, réservé à la gestion. Il
        devait donc les réclamer à son gestionnaire — précisément la démarche que
        ce produit existe pour supprimer.

        Les périodes sont calculées ici ; les MONTANTS ne le sont pas. Le
        document est émis par le serveur, qui rend les siens : « les montants
        sont ceux du registre, pas ceux de l'écran », dit déjà la modale. Un
        tableau qui les recomposerait côté client donnerait deux vérités pour un
        seul fait.
      */}
      <Card className="mb-4 flex flex-col gap-3">
        <h2 className="title-m font-semibold">{t('app.tenant.myReceipts')}</h2>
        <p className="text-body-s text-muted">{t('app.tenant.myReceiptsHint')}</p>
        <ul className="flex flex-col">
          {PERIODES_RECENTES.map((periode) => (
            <li
              key={`${periode.year}-${periode.month}`}
              className="flex min-h-11 items-center justify-between gap-3 border-b border-divider last:border-b-0"
            >
              <span className="text-label">{d.monthYear(periode)}</span>
              <Button
                variant="ghost"
                size="sm"
                icon="download"
                onClick={() =>
                  setQuittanceDe(
                    `${periode.year}-${String(periode.month).padStart(2, '0')}-01`,
                  )
                }
              >
                {t('app.receipts.issue')}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {quittanceDe && (
        <ReceiptModal
          unitId={monUnite}
          periodStart={quittanceDe}
          open
          onClose={() => setQuittanceDe(null)}
        />
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t('app.tenant.leaseRent')}
          value={money(unit.rent, { round: true })}
          note={t('app.tenant.leaseRentNote')}
        />
        <StatCard
          label={t('app.tenant.leaseDeposit')}
          value={deposit ? money(deposit.held, { round: true }) : '—'}
          note={
            deposit
              ? t('app.tenant.leaseDepositNote')
              : t('app.tenant.leaseDepositNone')
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('app.tenant.myUnit')}
          value={unit.label}
          unit={t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')}
          note={`${unit.surface} m² · ${building?.name ?? ''}`}
        />
        <StatCard
          label={t('app.tenant.nextDue')}
          value={money(unit.rent, { round: true })}
          note={t('app.dashboard.legendRent')}
        />
        <StatCard
          label={t('app.tenant.consumption')}
          value={rebilled === null ? '—' : money(rebilled, { round: true })}
          note={
            water === null || power === null
              ? t('app.meters.missing')
              : `${water} m³ · ${power} kWh`
          }
        />
        <StatCard
          label={t('app.tenant.deposit')}
          value={deposit ? money(deposit.held, { round: true }) : '—'}
          note={deposit ? t(`app.deposits.${deposit.status}` as 'app.deposits.held') : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card flush>
          <div className="p-4 sm:p-5">
            <CardHeader
              title={t('app.tenant.receipts')}
              level={2}
              className="mb-0"
              action={<PaymentStatusPill status={unit.status} size="sm" />}
            />
          </div>

          <ul className="divide-y divide-divider border-t border-divider">
            {TENANT_RECEIPTS.map((receipt) => (
              <li
                key={`${receipt.year}-${receipt.month}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0 flex-1 text-body font-medium">
                  {d.monthYear(receipt)}
                </span>
                <span className="numeric text-body">{money(unit.rent, { round: true })}</span>
                <span className="text-caps text-muted">
                  {t('app.tenant.paidOn', {
                    date: d.dayMonth({ year: receipt.year, month: receipt.month, day: receipt.paidDay }),
                  })}
                </span>
                {/* Six boutons sans `onClick` : le clic ne produisait rien,
                    pas même un toast, et le locataire pouvait s'y reprendre à
                    trois fois avant de conclure que son navigateur bloquait
                    quelque chose. */}
                <Button
                  variant="ghost"
                  size="sm"
                  icon="download"
                  onClick={() => downloadReceipt(unit, receipt)}
                >
                  {t('app.tenant.download')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={t('app.tenant.myWorks')} level={2} />
            {openWorks.length === 0 ? (
              <p className="text-body-s text-muted">{t('app.tenant.worksEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {openWorks.map((work) => (
                  <li key={work.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-muted">
                      <Icon name="wrench" size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-body font-medium">{workTitle(work, t)}</p>
                      <p className="mt-0.5 text-caps text-muted">
                        {work.reference ?? work.id} ·{' '}
                        {d.dayMonth(work.reportedAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" to={lien(base, 'travaux')} iconAfter="chevronRight" className="mt-4 -ml-3.5">
              {t('nav.works')}
            </Button>
          </Card>

          <Card tone="dark">
            <CardHeader title={t('app.tenant.manager')} level={2} />
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold text-label font-semibold text-ink"
              >
                DF
              </span>
              <div className="min-w-0">
                <p className="text-body font-medium text-on-dark">{t('app.tenant.managerName')}</p>
                <p className="text-caps text-on-dark-faint">
                  {t('roles.manager.name')}
                </p>
              </div>
            </div>
            <Button variant="gold" to={lien(base, 'signalements')} className="mt-4" fullWidth>
              {t('app.tenant.contactManager')}
            </Button>
          </Card>
        </div>
      </div>

      {/* La règle de confidentialité est dite à l'écran, pas seulement
          appliquée : le locataire doit savoir ce que son bailleur ne voit pas
          de lui, et inversement. */}
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-divider bg-surface px-4 py-3 text-body-s text-muted">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-ok" />
        {t('app.tenant.privacyNote')}
      </p>
    </>
  )
}

/**
 * L'espace locataire, le temps que son bail arrive.
 *
 * Le bouton « Signaler un incident » est CONSERVÉ, contrairement aux actions
 * des autres écrans, et la différence est de nature : il ne poste rien, il
 * navigue. Rien de ce qu'il emporte ne dépend du parc — ni identifiant, ni
 * montant — donc le retenir priverait le locataire du seul geste utile qu'il
 * puisse faire pendant l'attente, sans rien protéger en échange.
 *
 * La note de confidentialité est écrite en clair, et pour la même raison :
 * c'est une règle du produit, pas une donnée. Elle est placée APRÈS la région
 * d'attente, comme dans l'écran réel, ce qui la garde hors de l'annonce sans
 * changer l'ordre de lecture.
 */
function TenantDashboardSkeleton() {
  const base = useBase()
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.tenant.title')}
        description={t('app.tenant.subtitle')}
        actions={
          <Button icon="bell" to={lien(base, 'signalements')}>
            {t('app.tenant.contactManager')}
          </Button>
        }
      />

      <SkeletonRegion>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((carte) => (
            <SkeletonStatCard key={carte} />
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Les quittances. Six lignes : c'est ce que rend `TENANT_RECEIPTS`,
              et leur nombre ne dépend pas du serveur — seuls les montants en
              dépendent. */}
          <div className="min-w-0 rounded-lg border border-divider bg-surface shadow-e1">
            <div className="p-4 sm:p-5">
              <Skeleton line="title" className="w-40" />
            </div>
            <div className="divide-y divide-divider border-t border-divider">
              {[0, 1, 2, 3, 4, 5].map((ligne) => (
                <div key={ligne} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Skeleton line="body" className="min-w-0 flex-1" />
                  <Skeleton line="body" className="w-24" />
                  <Skeleton line="eyebrow" className="hidden w-24 sm:block" />
                  <Skeleton radius="md" className="h-9 w-28" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="min-w-0 rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5">
              <Skeleton line="title" className="mb-4 w-44" />
              <div className="flex flex-col gap-3">
                {[0, 1].map((travaux) => (
                  <div key={travaux} className="flex items-start gap-3">
                    <Skeleton radius="md" className="mt-0.5 size-8" />
                    <div className="min-w-0 flex-1">
                      <Skeleton line="body" className="w-48 max-w-full" />
                      <Skeleton line="eyebrow" className="mt-0.5 w-32" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton radius="md" className="mt-4 h-9 w-28" />
            </div>

            {/* La carte du gestionnaire ne porte aucune donnée de parc, mais
                elle est prise dans le même bloc : la reproduire évite que la
                colonne de droite ne s'allonge d'un coup à l'arrivée du bail. */}
            <div className="min-w-0 rounded-lg border border-divider bg-ink p-4 shadow-e1 sm:p-5">
              <Skeleton line="title" className="mb-4 w-36" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-10" />
                <div className="min-w-0 flex-1">
                  <Skeleton line="body" className="w-28" />
                  <Skeleton line="eyebrow" className="mt-0.5 w-20" />
                </div>
              </div>
              <Skeleton radius="md" className="mt-4 h-11 w-full" />
            </div>
          </div>
        </div>
      </SkeletonRegion>

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-divider bg-surface px-4 py-3 text-body-s text-muted">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-ok" />
        {t('app.tenant.privacyNote')}
      </p>
    </>
  )
}

/**
 * Écran refusé au locataire.
 *
 * Les entrées correspondantes sont retirées de sa navigation, mais les routes
 * restent atteignables à la main : sans ce garde, taper `/app/parc` affichait
 * tout le parc à un locataire. On explique le refus plutôt que de rediriger en
 * silence — une redirection muette passe pour un bug.
 */
export function TenantRestricted() {
  const base = useBase()
  const t = useT()

  return (
    <>
      {/* Titre court en en-tête, explication dans l'encart : répéter la même
          phrase aux deux endroits la faisait lire deux fois pour rien. */}
      <PageHeader title={t('app.tenant.restrictedTitle')} />
      <EmptyState
        icon="lock"
        title={t('app.tenant.restricted')}
        body={t('app.tenant.restrictedHint')}
        action={
          <Button to={base} icon="chevronLeft">
            {t('app.tenant.backToSpace')}
          </Button>
        }
      />
    </>
  )
}

/** Bandeau réutilisable rappelant le périmètre du locataire. */
export function TenantScopeNote() {
  const t = useT()
  // Le périmètre vient du provider, qui le tient du serveur. Les identifiants
  // sont techniques : ils servent à retrouver les unités, jamais à être lus —
  // d'où le passage par le libellé.
  const { unitById, tenantUnitIds } = usePortfolio()
  const n = useNumbers()
  const libelles = tenantUnitIds.map((id) => unitById(id)?.label).filter(Boolean) as string[]
  return (
    <p className="mb-4 flex items-start gap-2 rounded-md border border-ok-border bg-ok-tint px-3.5 py-2.5 text-body-s text-ok">
      <StatusPill tone="ok" size="sm" icon="shield">
        {n.list(libelles)}
      </StatusPill>
      {t('app.tenant.privacyNote')}
    </p>
  )
}
