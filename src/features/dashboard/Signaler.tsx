import { useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Button } from '@/components/primitives/Button'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { ReportModal } from './ReportModal'
import type { WorkOrder } from '@/data/portfolio'

/**
 * « Signaler » — l'écran que la maquette du portail décrit, et qui manquait.
 *
 * Le formulaire existait, en MODALE posée sur l'écran des travaux. La maquette
 * en fait un écran à part entière, et pour une raison qui n'est pas cosmétique :
 * elle y adosse « Mes signalements ». Un locataire qui déclare un problème veut
 * d'abord savoir si le précédent a été traité — sans cette liste, il redéclare
 * ce qui est déjà en cours.
 *
 * Les signalements SONT les interventions de son logement : le produit n'a pas
 * deux objets pour un seul fait, et la chaîne « signale → chiffré → validé →
 * clos » est celle que le bailleur voit de son côté.
 */

const TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'warn',
  quoted: 'info',
  approved: 'info',
  done: 'ok',
}

export function Signaler() {
  const t = useT()
  const { role } = useRole()
  const { works, units, isMine, loading } = usePortfolio()
  const [ouvert, setOuvert] = useState(false)

  const mesUnites = units.filter((u) => isMine(u.id))
  const miens = works.filter((w) => isMine(w.unitId))

  return (
    <>
      <PageHeader
        title={t('app.report.title')}
        description={t('app.report.body')}
        actions={
          /* Le geste appartient au locataire : le bailleur ne signale pas un
             problème chez quelqu'un d'autre, il le reçoit. */
          role === 'tenant' && mesUnites[0] ? (
            <Button icon="bell" onClick={() => setOuvert(true)}>
              {t('app.report.cta')}
            </Button>
          ) : undefined
        }
      />

      <h2 className="mt-6 mb-3 title-m font-semibold">{t('app.report.mine')}</h2>

      {/*
        L'état vide n'est PAS servi pendant l'attente.

        Première version : un en-tête nu était rendu tant que `loading`. Il ne
        portait aucune région `aria-busy`, donc rien n'annonçait l'attente — ni
        aux technologies d'assistance, ni au test qui l'écoute. Et une fois
        l'attente passée sous silence, « Aucun signalement » s'affiche sur des
        données qui ne sont pas encore arrivées : le locataire redéclare ce
        qu'il croit perdu.
      */}
      {loading ? (
        <div role="status" aria-busy="true" className="text-body-s text-muted">
          {t('common.loading')}
        </div>
      ) : miens.length === 0 ? (
        <EmptyState
          icon="bell"
          title={t('app.report.emptyTitle')}
          body={t('app.report.emptyBody')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {miens.map((work) => (
            <Card key={work.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="title-m font-medium">{workTitle(work, t)}</h3>
                {work.reference ? (
                  <p className="numeric mt-0.5 text-caps text-muted">{work.reference}</p>
                ) : null}
              </div>
              {/*
                Le STATUT, sans le montant.

                Le devis et le coût regardent le bailleur : « le coût des travaux
                n'est jamais exposé au locataire », dit la maquette en pied de
                page. Ce qui l'intéresse est où en est SA demande.
              */}
              <StatusPill tone={TONE[work.status]} size="sm">
                {t(`app.works.${work.status}` as 'app.works.reported')}
              </StatusPill>
            </Card>
          ))}
        </div>
      )}

      {role === 'tenant' && mesUnites[0] && (
        <ReportModal open={ouvert} onClose={() => setOuvert(false)} unitId={mesUnites[0].id} />
      )}
    </>
  )
}
