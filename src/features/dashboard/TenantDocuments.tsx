import { useState } from 'react'
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
import { UTILITY_RATES, chargeDue } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useToast } from '@/components/primitives/Toast'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { cn } from '@/lib/cn'
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
/**
 * Les trois pièces qu'un locataire réclame réellement à son gestionnaire.
 *
 * Un champ libre aurait laissé écrire n'importe quoi, y compris ce que le
 * gestionnaire ne peut pas produire. Trois cases nommées disent le périmètre.
 */
const DEMANDES = [
  'app.documents.reqResidence',
  'app.documents.reqGoodStanding',
  'app.documents.reqLeaseCopy',
] as const

export function TenantDocuments() {
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const downloadReceipt = useReceiptExport()
  const { unitById, tenantUnitIds, depositForUnit, inspectionForUnit, tenantReceipts, addWork, loading } =
    usePortfolio()
  const { notify } = useToast()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const [choix, setChoix] = useState<(typeof DEMANDES)[number] | null>(null)

  /** Mono-unité, comme l'espace locataire — et pour la même raison. */
  const monUnite = tenantUnitIds[0] ?? ''
  const unit = unitById(monUnite)
  const deposit = depositForUnit(monUnite)
  const entree = inspectionForUnit(monUnite, 'entry')

  // L'attente AVANT le garde `!unit` : pendant le chargement, le jeu de
  // démonstration fournit toujours une unité, et l'écran montrerait le dossier
  // d'un autre. Même ordre, même raison que l'espace locataire.
  /**
   * Toutes les périodes en UN fichier, et non six téléchargements.
   *
   * « Tout télécharger » qui déclencherait six enregistrements successifs se
   * ferait arrêter par le navigateur dès le deuxième, et le locataire
   * repartirait avec une quittance sur six en croyant les avoir toutes.
   */
  function toutTelecharger() {
    if (!unit) return
    exportCsv({
      name: [t('app.documents.allReceipts'), unit.label],
      headers: [
        t('app.period'),
        csvMoney.header(t('app.tenant.colRent')),
        csvMoney.header(t('app.tenant.colWater')),
        csvMoney.header(t('app.tenant.colPower')),
        t('app.payments.date'),
      ],
      rows: tenantReceipts.map((receipt) => [
        d.monthYear(receipt),
        csvMoney.amount(unit.rent),
        csvMoney.amount(chargeDue(receipt.water, UTILITY_RATES.water)),
        csvMoney.amount(chargeDue(receipt.power, UTILITY_RATES.power)),
        d.fullDate({ year: receipt.year, month: receipt.month, day: receipt.paidDay }),
      ]),
      notice: 'app.receiptDownloaded',
    })
  }

  function envoyerLaDemande() {
    if (!choix || !unit) return
    addWork(unit.id, {
      title: t('app.documents.requestTitle', { document: t(choix) }),
      trade: 'other',
      // Une pièce administrative n'immobilise pas le logement : elle attend son
      // tour derrière ce qui empêche d'y vivre.
      urgency: 'low',
    })
    setChoix(null)
    notify(t('app.documents.requestSent'), { tone: 'ok' })
  }

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
            eyebrow={`${t('app.documents.receipts')} · ${tenantReceipts.length}`}
            title={t('app.documents.receiptsTitle')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
            action={
              tenantReceipts.length > 0 ? (
                <Button variant="ghost" size="sm" icon="download" onClick={toutTelecharger}>
                  {t('app.documents.downloadAll')}
                </Button>
              ) : undefined
            }
          />
          {/* La liste est vide hors démonstration : le serveur ne rend pas
              d'historique. On l'annonce plutôt que de servir les six périodes
              de la démonstration comme si elles étaient les siennes. */}
          {tenantReceipts.length === 0 ? (
            <div className="border-t border-divider px-4 py-4 sm:px-5">
              <EmptyState
                icon="file"
                title={t('app.tenant.noReceiptsTitle')}
                body={t('app.tenant.noDocumentsBody')}
              />
            </div>
          ) : (
          <ul className="divide-y divide-divider border-t border-divider">
            {tenantReceipts.map((receipt) => (
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
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/*
          DEMANDER UN DOCUMENT.

          La demande part par le canal des signalements — `addWork` —, le seul
          que le gestionnaire relève réellement. Elle lui arrive donc, il la voit
          et peut la clore, ce qu'un simple toast n'aurait jamais fait.

          DETTE DE MODÈLE, assumée et à solder : une demande de pièce n'est pas
          une intervention. Elle apparaîtra dans « Travaux dans mon logement »
          aux côtés d'une fuite d'évier, ce qui est faux. Le produit n'a pas
          d'objet « demande » ; en fabriquer un dépasse cet écran, et faire
          semblant d'envoyer aurait été pire que de mal ranger.
        */}
        <Card>
          <CardHeader
            title={t('app.documents.request')}
            description={t('app.documents.requestHint')}
            level={2}
          />
          <div className="flex flex-wrap gap-2">
            {DEMANDES.map((demande) => {
              const actif = demande === choix
              return (
                <button
                  key={demande}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setChoix(demande)}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3.5',
                    'text-label font-medium transition-colors duration-150',
                    actif
                      ? 'border-ink bg-ink text-on-dark'
                      : 'border-border bg-surface-sunken text-ink hover:border-border-strong',
                  )}
                >
                  {t(demande)}
                </button>
              )
            })}
          </div>
          <Button className="mt-4" onClick={envoyerLaDemande} disabled={!choix}>
            {t('app.documents.requestSend')}
          </Button>
        </Card>

        {/*
          CONFIDENTIALITÉ — la règle est dite, pas seulement appliquée.

          Les maquettes ajoutent « DERNIER ACCÈS · 12/08/2026 09:41 ». Rien ne
          journalise les consultations : cette ligne annoncerait une traçabilité
          qui n'existe pas, sur l'écran précisément où l'on promet la
          confidentialité. Une promesse de sécurité inventée est le pire endroit
          où en inventer une.
        */}
        <Card tone="dark">
          {/* Le titre porte le libellé : `CardHeader` rend son `<h2>` sans
              condition, et le laisser vide posait un en-tête anonyme qu'un
              lecteur d'écran annonce sans pouvoir le nommer. */}
          <CardHeader title={t('app.documents.privacy')} level={2} className="mb-2" />
          <p className="flex items-start gap-3 text-body-s text-on-dark-muted">
            <Icon name="shield" size={17} className="mt-0.5 shrink-0 text-gold" />
            {t('app.documents.privacyBody')}
          </p>
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
