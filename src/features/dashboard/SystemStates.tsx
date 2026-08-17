import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import {
  SkeletonRegion,
  SkeletonStatCard,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'

/**
 * Les quatre états que toute vue de données doit savoir rendre.
 * Cet écran sert de référence : on y vérifie qu'aucun d'eux ne se réduit à un
 * écran blanc ou à un cadre d'axes vide.
 */
export function SystemStates() {
  const t = useT()
  const { notify } = useToast()
  const { reset, hasChanges } = usePortfolio()

  return (
    <>
      <PageHeader title={t('app.system.title')} description={t('app.system.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('app.system.loading')} level={2} />
          {/* Squelette plutôt que spinner : la mise en page ne saute pas
              quand les données arrivent.

              Cette carte portait sa propre copie du squelette — quatre lignes
              écrites à la main, avec leur dégradé et leur animation. Elle
              montrait donc un état que le produit ne savait pas rendre : les
              écrans réels servaient le jeu de démonstration pendant que le parc
              du serveur arrivait. La vitrine et le produit rendent désormais le
              MÊME composant, ce qui est la seule façon qu'elle reste honnête.

              Quatre barres restaient pourtant une abstraction : aucun écran du
              produit n'attend sous cette forme. Ils attendent en rangée
              d'indicateurs au-dessus d'un tableau — c'est la composition de
              `PortfolioSkeleton`, de `PaymentsSkeleton` et des six autres. La
              vitrine la reprend donc telle quelle, avec les mêmes primitives :
              ce qu'on y voit est littéralement ce que le produit affiche.

              Deux indicateurs et non quatre, trois lignes de tableau et non
              huit : la carte occupe une demi-colonne, pas un écran. Le nombre
              est le seul écart, et il ne change ni les composants ni leur
              agencement. */}
          <SkeletonRegion>
            {/* Empilés sous `sm`, comme sur les écrans réels. Deux colonnes à
                375 px laissent 130 px par carte, où la ligne d'indicateur —
                `w-32`, soit 128 px — déborde du cadre une fois le rembourrage
                retiré. La grille du produit dit déjà `sm:grid-cols-2` ; s'en
                écarter ici reproduisait le défaut que la vitrine est censée
                exclure. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <SkeletonStatCard />
              <SkeletonStatCard />
            </div>
            <div className="mt-3">
              <SkeletonTable rows={3} />
            </div>
          </SkeletonRegion>
        </Card>

        <Card>
          <CardHeader title={t('app.system.empty')} level={2} />
          <EmptyState
            icon="card"
            title={t('app.system.emptyTitle')}
            body={t('app.system.emptyBody')}
          />
        </Card>

        <Card>
          <CardHeader title={t('app.system.error')} level={2} />
          {/* Une erreur dit ce qui a échoué, ce qui est préservé, et propose
              une sortie — pas seulement « une erreur est survenue ». */}
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-tint px-4 py-3.5"
          >
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0">
              <p className="text-body font-medium text-danger">{t('app.system.errorTitle')}</p>
              <p className="mt-1 text-body-s text-danger">{t('app.system.errorBody')}</p>
              <Button
                variant="secondary"
                size="sm"
                icon="arrowRight"
                className="mt-3"
                onClick={() => notify(t('app.system.retried'), { tone: 'ok' })}
              >
                {t('app.system.retry')}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('app.system.offline')} level={2} />
          <div className="flex items-start gap-3 rounded-lg border border-warn-border bg-warn-tint px-4 py-3.5">
            <Icon name="globe" size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0">
              <p className="text-body font-medium text-warn">{t('app.system.offlineTitle')}</p>
              <p className="mt-1 text-body-s text-warn">{t('app.system.offlineBody')}</p>
            </div>
          </div>

          {/* Les trois autres cartes décrivent des états que l'interface sait
              rendre. Celle-ci décrit en plus un comportement — la
              synchronisation différée — qui n'existe pas encore. On le dit,
              plutôt que de laisser la carte passer pour une fonctionnalité
              livrée. */}
          <p className="mt-3 flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            {t('app.system.offlineNotice')}
          </p>
        </Card>
      </div>

      {/* La persistance est un comportement que l'utilisateur doit pouvoir
          défaire. Sans ce bouton, une démonstration polluée par quelques clics
          d'essai le resterait, et il faudrait vider le stockage à la main. */}
      <Card className="mt-4">
        <CardHeader
          title={t('app.system.persistence')}
          description={hasChanges ? t('app.system.persistenceDirty') : t('app.system.persistenceIdle')}
          level={2}
          action={
            hasChanges ? (
              <Button
                variant="secondary"
                icon="arrowRight"
                onClick={() => {
                  reset()
                  notify(t('app.system.resetDone'), { tone: 'ok' })
                }}
              >
                {t('app.system.reset')}
              </Button>
            ) : undefined
          }
        />
        <p className="flex items-start gap-2 text-body-s text-muted">
          <Icon name="shield" size={15} className="mt-0.5 shrink-0 text-ok" />
          {t('app.system.persistenceScope')}
        </p>
      </Card>
    </>
  )
}
