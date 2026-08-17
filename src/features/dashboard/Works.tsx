import { PageHeader, useRole } from '@/components/layout/AppShell'
import { useBase } from '@/lib/base'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { TenantScopeNote } from './TenantDashboard'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { type WorkOrder } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'

const STATUS_TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'neutral',
  quoted: 'warn',
  approved: 'info',
  done: 'ok',
}

export function Works() {
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { notify } = useToast()
  const { role } = useRole()

  // Seul le propriétaire arbitre : le gestionnaire propose. C'est la règle de
  // délégation, appliquée ici à l'affichage du bouton.
  const canApprove = role === 'owner'
  const isTenant = role === 'tenant'

  /**
   * Travaux et cautions vivent dans un état partagé : une décision prise ici
   * doit disparaître de la carte « Ce qui demande une décision » du tableau de
   * bord, qui la réclamait encore.
   */
  const { works, approveWork, completeWork, unitById, isMine, loading } = usePortfolio()

  // Le locataire suit les interventions sur SON logement, pas celles du parc.
  // Le périmètre vient du provider, qui le tient du serveur : le client ne
  // connaît plus « son » unité par une constante.
  const visible = isTenant ? works.filter((w) => isMine(w.unitId)) : works

  const approve = (id: string) => {
    approveWork(id)
    notify(t('app.works.approved_toast'), { tone: 'ok' })
  }

  const complete = (id: string) => {
    completeWork(id)
    notify(t('app.works.completed_toast'), { tone: 'ok' })
  }

  /**
   * Cet écran porte un bouton qui engage de l'argent — « Valider le devis ».
   * Pendant l'attente, il en offrait deux, chiffrés, sur des interventions de
   * démonstration : le propriétaire validait une dépense de 185 000 FCFA qui ne
   * correspondait à rien, et le refus du serveur arrivait après la décision.
   */
  if (loading) return <WorksSkeleton />

  return (
    <>
      <PageHeader title={t('app.works.title')} description={t('app.works.subtitle')} />

      {isTenant && <TenantScopeNote />}

      {/* Le bouton de validation disparaissait sans un mot pour le
          gestionnaire, alors qu'il voit les devis en attente : il lui restait à
          deviner si l'action manquait par droit ou par défaut. L'écran des
          cautions traite déjà le cas symétrique — les deux se répondent
          maintenant, puisque c'est la même règle de délégation. */}
      {role === 'manager' && works.some((work) => work.status === 'quoted') && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('app.works.managerNotice')}
        </p>
      )}

      {/*
        L'état vide portait un titre et rien d'autre — et ce titre était écrit
        pour le locataire (« sur votre logement »), servi tel quel au
        propriétaire qui regarde tout le parc. Deux corrections tiennent
        ensemble : le texte se dit au bon destinataire, et il explique ce qui
        apparaîtra là plutôt que de répéter qu'il n'y a rien.

        Aucune action pour le gestionnaire ni le propriétaire : une
        intervention NAÎT d'un signalement de locataire, aucun écran ne permet
        d'en ouvrir une, et un bouton « ajouter des travaux » serait le
        mensonge d'interface habituel. Le corps dit d'où elles viennent, ce qui
        est l'information utile.
      */}
      {visible.length === 0 ? (
        <EmptyState
          icon="wrench"
          title={isTenant ? t('app.tenant.worksEmpty') : t('app.works.emptyTitle')}
          body={isTenant ? t('app.tenant.worksEmptyBody') : t('app.works.emptyBody')}
          // Le locataire, lui, est sur une impasse : rien à faire ici, et ses
          // données sont ailleurs. On le ramène là où elles sont — c'est le
          // même geste que `TenantRestricted`, et il existe vraiment.
          action={
            isTenant ? (
              <Button to={base} icon="chevronLeft">
                {t('app.tenant.backToSpace')}
              </Button>
            ) : undefined
          }
        />
      ) : (
      <div className="flex flex-col gap-3">
        {visible.map((work) => {
          const unit = unitById(work.unitId)
          return (
            <Card key={work.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-md ${
                  work.urgent ? 'bg-danger-tint text-danger' : 'bg-surface-sunken text-muted'
                }`}
              >
                <Icon name="wrench" size={20} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="title-m">{workTitle(work, t)}</h2>
                  {work.urgent && <Badge tone="danger">{t('app.works.urgent')}</Badge>}
                </div>
                <p className="mt-1 text-caps text-muted">
                  {/* `work.id` est une référence de signalement, pas une unité :
                      il reste tel quel. `work.unitId`, lui, est l'identifiant
                      technique de l'unité — c'est son libellé qui se lit. */}
                  {work.reference ?? work.id} · {unit?.label} {unit?.tenant ? `· ${unit.tenant}` : ''} ·{' '}
                  {t(`app.trades.${work.trade}` as 'app.trades.plumbing')} ·{' '}
                  {d.dayMonth(work.reportedAt)}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="numeric text-title-m font-medium">
                  {work.amount ? (
                    money(work.amount, { round: true })
                  ) : (
                    <span className="text-body-s font-normal text-muted italic">
                      {t('app.works.noQuote')}
                    </span>
                  )}
                </span>

                <StatusPill tone={STATUS_TONE[work.status]} size="sm">
                  {t(`app.works.${work.status}` as 'app.works.reported')}
                </StatusPill>

                {work.status === 'quoted' && canApprove && (
                  <Button
                    size="sm"
                    onClick={() => approve(work.id)}
                  >
                    {t('app.works.approve')}
                  </Button>
                )}

                {/*
                  Clore : le geste qui manquait, et son absence se voyait.

                  `approved` était en pratique TERMINAL — un devis validé
                  engageait la dépense et restait « à faire » indéfiniment, donc
                  cette liste ne pouvait que grandir. Un logiciel de gestion dont
                  la liste de travaux ne se vide jamais cesse d'être lu.

                  Offert sur `reported` aussi : tout n'a pas de coût, et une
                  intervention jamais chiffrée n'a rien à faire arbitrer. Jamais
                  sur `quoted` — le serveur le refuse, parce que clore un devis
                  en attente le ferait disparaître de la carte du propriétaire
                  sans qu'il ait rien décidé.

                  Le locataire consulte : il ne constate pas l'achèvement des
                  travaux de son bailleur.
                */}
                {(work.status === 'approved' || work.status === 'reported') &&
                  role !== 'tenant' && (
                    <Button variant="secondary" size="sm" onClick={() => complete(work.id)}>
                      {t('app.works.complete')}
                    </Button>
                  )}
              </div>
            </Card>
          )
        })}
      </div>
      )}
    </>
  )
}

/**
 * Les travaux, le temps qu'ils arrivent.
 *
 * L'en-tête ne porte aucune action : rien à retenir de ce côté-là. Le bandeau
 * de périmètre du locataire et l'avis au gestionnaire ne sont pas reproduits —
 * tous deux se déclenchent sur les données (« a-t-il des devis en attente ? »),
 * donc les annoncer reviendrait à répondre à une question qu'on ne sait pas
 * encore trancher.
 *
 * Trois cartes, et non huit : ce sont des cartes hautes, trois remplissent déjà
 * l'écran d'un téléphone. Leur gabarit suit celui d'une intervention réelle —
 * la vignette de 44px, le titre, la ligne de références — pour que la liste ne
 * saute pas quand elle arrive.
 */
function WorksSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader title={t('app.works.title')} description={t('app.works.subtitle')} />

      <SkeletonRegion className="flex flex-col gap-3">
        {[0, 1, 2].map((carte) => (
          <div
            key={carte}
            className="flex min-w-0 items-center gap-4 rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5"
          >
            <Skeleton radius="md" className="size-11" />
            <div className="min-w-0 flex-1">
              <Skeleton line="title" className="w-64 max-w-full" />
              <Skeleton line="eyebrow" className="mt-1 w-48 max-w-full" />
            </div>
            <Skeleton line="title" radius="md" className="hidden w-28 sm:block" />
            <Skeleton radius="md" className="hidden h-7 w-24 sm:block" />
          </div>
        ))}
      </SkeletonRegion>
    </>
  )
}
