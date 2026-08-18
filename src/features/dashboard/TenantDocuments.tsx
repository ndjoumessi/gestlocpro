import { PageHeader } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { TENANT_RECEIPTS, inspectionsForUnit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useReceiptExport } from './receiptExport'

/**
 * Documents du locataire — ses pièces contractuelles et ses quittances.
 *
 * L'écran tient une ligne de conduite que le portail avait déjà payée une
 * fois : **on n'affiche pas un bouton qui ne peut rien produire**. Le bail
 * signé, l'état des lieux et le reçu de caution sont annoncés « PDF » par les
 * maquettes ; ce produit ne sait ni recevoir un fichier déposé, ni fabriquer un
 * PDF opposable — `receiptExport` le dit dans son propre commentaire. Chaque
 * ligne dit donc ce qu'elle sait faire : consulter la pièce à l'écran quand la
 * donnée existe, et annoncer la case vide quand elle n'existe pas.
 *
 * Les deux renvois — état des lieux, caution — pointent vers des adresses que
 * le locataire ne trouve plus dans sa navigation depuis qu'elle est passée à
 * trois entrées. Elles n'ont pas été fermées pour autant : c'est ici qu'elles
 * se rattrapent, et c'est la raison pour laquelle elles restent ouvertes.
 */
export function TenantDocuments() {
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const downloadReceipt = useReceiptExport()
  const { unitById, tenantUnitIds, depositForUnit, loading } = usePortfolio()

  /** Mono-unité, comme l'espace locataire — et pour la même raison. */
  const monUnite = tenantUnitIds[0] ?? ''
  const unit = unitById(monUnite)
  const deposit = depositForUnit(monUnite)
  const entree = inspectionsForUnit(monUnite).find((i) => i.kind === 'entry')

  // L'attente AVANT le garde `!unit` : pendant le chargement, le jeu de
  // démonstration fournit toujours une unité, et l'écran montrerait le dossier
  // d'un autre. Même ordre, même raison que l'espace locataire.
  if (loading) return <TenantDocumentsSkeleton />

  if (!unit)
    return (
      <>
        <PageHeader title={t('app.documents.title')} description={t('app.documents.subtitle')} />
        <EmptyState
          icon="info"
          title={t('app.tenant.noUnitTitle')}
          body={t('app.tenant.noUnitBody')}
        />
      </>
    )

  return (
    <>
      <PageHeader title={t('app.documents.title')} description={t('app.documents.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card flush>
          <CardHeader
            eyebrow={t('app.documents.contractual')}
            title={t('app.documents.contractualTitle')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
          />
          <ul className="divide-y divide-divider border-t border-divider">
            {/* Aucun dépôt de fichier n'existe dans le produit : la ligne dit
                la case vide plutôt que d'offrir un téléchargement qui
                fabriquerait le document qu'il prétend restituer. */}
            <LignePiece label={t('app.documents.lease')} />

            <LignePiece
              label={t('app.documents.entryInspection')}
              detail={entree ? d.fullDate(entree.date) : undefined}
              to={entree ? lien(base, 'etats-des-lieux') : undefined}
              action={t('app.documents.view')}
            />

            <LignePiece
              label={t('app.documents.depositReceipt')}
              detail={deposit ? money(deposit.held, { round: true }) : undefined}
              to={deposit ? lien(base, 'cautions') : undefined}
              action={t('app.documents.view')}
            />
          </ul>
        </Card>

        <Card flush>
          <CardHeader
            eyebrow={`${t('app.documents.receipts')} · ${TENANT_RECEIPTS.length}`}
            title={t('app.documents.receiptsTitle')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
          />
          <ul className="divide-y divide-divider border-t border-divider">
            {TENANT_RECEIPTS.map((receipt) => (
              <li
                key={`${receipt.year}-${receipt.month}`}
                className="flex items-center gap-3 px-4 py-3 sm:px-5"
              >
                <Icon name="file" size={17} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 text-body">{d.monthYear(receipt)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="download"
                  onClick={() => downloadReceipt(unit, receipt)}
                >
                  {t('app.documents.download')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

/**
 * Une pièce du dossier.
 *
 * Sans `to`, elle n'offre rien : c'est l'état d'une case que le produit ne sait
 * pas encore remplir, et le dire vaut mieux qu'un bouton mort.
 */
function LignePiece({
  label,
  detail,
  to,
  action,
}: {
  label: string
  detail?: string
  to?: string
  action?: string
}) {
  const t = useT()
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <Icon name="file" size={17} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body">{label}</span>
        {detail && <span className="numeric block text-caps text-muted">{detail}</span>}
      </span>
      {to ? (
        <Button to={to} variant="ghost" size="sm">
          {action}
        </Button>
      ) : (
        <span className="shrink-0 text-caps text-muted">{t('app.documents.none')}</span>
      )}
    </li>
  )
}

function TenantDocumentsSkeleton() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('app.documents.title')} description={t('app.documents.subtitle')} />
      <SkeletonRegion label={t('app.documents.title')}>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-32" />
              <div className="mt-4 flex flex-col gap-3">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-5 w-full" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </SkeletonRegion>
    </>
  )
}
