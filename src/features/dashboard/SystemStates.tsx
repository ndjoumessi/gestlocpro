import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Notice } from '@/components/primitives/Notice'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
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
/**
 * Durée de l'attente JOUÉE par la vitrine.
 *
 * Plus longue que les 900 ms de la démonstration, et c'est voulu : là-bas
 * l'attente est subie et doit se faire oublier, ici elle est l'objet même de la
 * carte et doit se laisser regarder. On la relance quand on veut.
 */
const ATTENTE_VITRINE_MS = 1600

export function SystemStates() {
  const t = useT()
  const { notify } = useToast()
  const { reset, hasChanges, units, buildings, buildingById } = usePortfolio()

  /**
   * La carte joue son propre chargement, sans toucher au parc.
   *
   * Un état local et non `loading` du fournisseur : celui-ci gouverne les huit
   * écrans réels, et le rejouer depuis une vitrine ferait clignoter toute
   * l'application pour montrer une carte.
   */
  const [enAttente, setEnAttente] = useState(true)
  useEffect(() => {
    if (!enAttente) return
    const minuteur = setTimeout(() => setEnAttente(false), ATTENTE_VITRINE_MS)
    return () => clearTimeout(minuteur)
  }, [enAttente])
  const rejouer = () => setEnAttente(true)

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
              agencement.

              Et elle ABOUTIT, ce qui a fini par être le vrai sujet. Le
              squelette était rendu sans condition : il ne se terminait jamais.
              Tant qu'il valait quatre barres grises, on lisait un échantillon ;
              du jour où il a pris l'allure exacte d'un écran réel, on a lu un
              écran BLOQUÉ — plus la vitrine est fidèle, plus un état figé passe
              pour une panne. Ses trois voisines montrent chacune un état abouti,
              et « Erreur » porte même un bouton. Celle-ci joue donc l'attente,
              la termine sur du vrai contenu, et se rejoue à la demande : c'est
              le seul état dont la vitrine ne montrait que la moitié, alors que
              la TRANSITION est précisément ce que vit l'utilisateur. */}
          {enAttente ? (
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
          ) : (
            <div className="flex flex-col gap-3">
              {/* Le contenu que le squelette annonçait, aux mêmes places : deux
                  indicateurs puis un tableau. C'est ce qui rend la transition
                  lisible — si l'un des deux états changeait de gabarit, on
                  verrait la page sauter, ce que le squelette existe justement
                  pour éviter. */}
              <div className="grid gap-3 sm:grid-cols-2">
                {buildings.slice(0, 2).map((immeuble) => {
                  const logements = units.filter((u) => u.buildingId === immeuble.id)
                  const occupes = logements.filter((u) => u.tenant).length
                  /*
                    PAS DE TUILE ICI, ET C'EST MESURÉ.

                    Ces deux cartes sont des MINIATURES : la vitrine les pose à
                    deux colonnes dans un panneau déjà étroit, ce qui laisse
                    103 px à leur intitulé contre 144 sur un vrai écran. Une
                    tuile en retire 42, et « Bonamoussadi » — 110 px, UN SEUL
                    MOT — n'entre alors plus, même coupé en deux lignes : la
                    garde des rognages le refuse d'abord en largeur, puis en
                    hauteur une fois la coupure autorisée.

                    Ailleurs le repère aide à retrouver une carte dans une
                    rangée ; ici il n'y a que deux cartes, et il coûterait le nom
                    du quartier qu'elles servent justement à montrer.
                  */
                  return (
                    <StatCard
                      key={immeuble.id}
                      label={immeuble.district}
                      /* Un nom de quartier est une donnée — voir `donnee` sur
                         `StatCard`, et son jumeau sur l'écran Parc. */
                      donnee
                      value={`${occupes}/${logements.length}`}
                      note={t('app.portfolio.occupancy', {
                        occupied: occupes,
                        total: logements.length,
                      })}
                    />
                  )
                })}
              </div>

              <DataTable
                /* La légende décrit le TABLEAU, pas la carte qui le porte.
                   « Chargement » y annonçait un tableau de logements sous le
                   nom d'un état d'interface — le titre est déjà donné par
                   `CardHeader`, et un lecteur d'écran n'y aurait entendu que
                   deux fois le même mot pour deux choses différentes. */
                caption={t('app.portfolio.title')}
                rows={units.slice(0, 3)}
                rowKey={(u) => u.id}
                columns={[
                  {
                    key: 'unit',
                    header: t('app.portfolio.unit'),
                    width: '5.5rem',
                    render: (u) => <span className="numeric font-medium">{u.label}</span>,
                  },
                  {
                    key: 'building',
                    header: t('app.portfolio.building'),
                    render: (u) => (
                      <span className="text-muted">{buildingById(u.buildingId)?.district}</span>
                    ),
                  },
                  {
                    key: 'surface',
                    header: t('app.portfolio.surface'),
                    numeric: true,
                    hideOnMobile: true,
                    render: (u) => <span className="numeric">{u.surface}</span>,
                  },
                ]}
              />
            </div>
          )}

          {/* Rejouer plutôt que « recharger » : le mot dit que c'est une
              démonstration d'état, non une requête. Même place et même forme
              que « Réessayer » sur la carte d'erreur, pour que les deux cartes
              se lisent pareil. */}
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              icon="arrowRight"
              onClick={rejouer}
              disabled={enAttente}
            >
              {t('app.system.replayLoading')}
            </Button>
          </div>
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
              <p className="mt-1 text-body text-danger">{t('app.system.errorBody')}</p>
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
          {/* Le glyphe déroge au défaut du ton : ce n'est pas une alerte
              générique mais une perte de RÉSEAU, et le globe le dit d'un coup
              d'œil là où le triangle laisserait chercher la cause. */}
          <Notice tone="warn" icon="globe" titre={t('app.system.offlineTitle')}>
            {t('app.system.offlineBody')}
          </Notice>

          {/* Les trois autres cartes décrivent des états que l'interface sait
              rendre. Celle-ci décrit en plus un comportement — la
              synchronisation différée — qui n'existe pas encore. On le dit,
              plutôt que de laisser la carte passer pour une fonctionnalité
              livrée. */}
          <Notice className="mt-3">{t('app.system.offlineNotice')}</Notice>
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
        <p className="flex items-start gap-2 text-body text-muted">
          <Icon name="shield" size={15} className="mt-0.5 shrink-0 text-ok" />
          {t('app.system.persistenceScope')}
        </p>
      </Card>
    </>
  )
}
