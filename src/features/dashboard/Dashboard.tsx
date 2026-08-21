import { useState } from 'react'
import { lien, useBase } from '@/lib/base'
import { Link, Navigate } from 'react-router-dom'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { PaymentStatusPill, StatusPill } from '@/components/primitives/StatusPill'
import { Icon } from '@/components/primitives/Icon'
import { DonutChart, ProgressBar, StackedBarChart, StatCard } from '@/components/primitives/Charts'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion, SkeletonStatCard } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import { computeKpis } from '@/data/kpis'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { RecordPaymentModal } from './RecordPaymentModal'

export function Dashboard() {
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { money, definition } = useCurrency()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const {
    units,
    works,
    deposits,
    unitById,
    buildings: BUILDINGS,
    readings,
    collections: COLLECTIONS,
    loading,
  } = usePortfolio()
  const [payOpen, setPayOpen] = useState(false)

  // Le locataire n'a pas une version filtrée de cet écran : il en a un autre.
  // Les indicateurs de parc — encaissé consolidé, taux d'occupation, impayés de
  // tous les baux — n'ont aucun sens pour lui, et les afficher revenait à lui
  // montrer la situation de ses voisins.
  //
  // Cet écran vivait ICI, rendu sous l'adresse de l'index. Il a désormais la
  // sienne — `mon-espace`, celle que porte sa navigation —, et l'index ne fait
  // plus que l'y conduire. `replace` : l'index n'est pas une étape de son
  // parcours, et le bouton « Précédent » ne doit pas y ramener en boucle.
  if (role === 'tenant') return <Navigate to="mon-espace" replace />

  const title =
    role === 'owner'
      ? t('app.dashboard.titleOwner')
      : role === 'manager'
        ? t('app.dashboard.titleManager')
        : t('app.dashboard.titleTenant')

  /**
   * L'attente passe AVANT le calcul des indicateurs, et après le rôle.
   *
   * Avant le calcul, parce que les calculer sur le jeu de démonstration puis les
   * afficher est précisément le défaut : quatre chiffres justes portant sur le
   * parc de quelqu'un d'autre.
   *
   * Après le rôle, parce que le locataire n'a pas cet écran : lui montrer le
   * squelette d'un tableau de bord de bailleur annoncerait une page qui ne
   * viendra jamais, et il faudrait ensuite la remplacer par une autre — deux
   * mises en page pour une seule attente.
   */
  if (loading) return <DashboardSkeleton title={title} />

  // Les indicateurs se calculent sur le parc servi, quel qu'il soit. Ils
  // étaient une constante qui ne se recoupait avec rien.
  const kpis = computeKpis(units, readings)
  const { expected, collected, outstanding, occupied, vacant, occupancy, maxOverdueDays } = kpis
  const collectedShare = expected === 0 ? 0 : Math.round((collected / expected) * 100)
  /**
   * Ceux qui doivent encore quelque chose — retards ET partiels.
   *
   * La note de la carte comptait les seuls retards, sous un montant qui totalise
   * les deux : quatre locataires devaient, la note en annonçait trois. Le
   * nombre et sa légende doivent porter sur la même population, sans quoi la
   * légende dément le nombre qu'elle explique.
   */
  const doivent = units.filter((u) => u.status === 'overdue' || u.status === 'partial')

  /**
   * Ce qui demande une décision — les DEUX natures, pas une seule.
   *
   * La carte ne listait que les devis de travaux. Elle taisait donc les
   * cautions à arbitrer, alors que c'est la prérogative qui DÉFINIT le
   * propriétaire dans ce produit : sa fiche de rôle, en barre latérale, dit
   * « lecture et édition globale · arbitrage des cautions ». Une carte intitulée
   * « ce qui demande une décision » qui omet la décision la plus caractéristique
   * du rôle ne se contente pas d'être incomplète — elle laisse croire qu'il n'y
   * a rien à trancher, ce qui est exactement l'inverse de sa fonction.
   *
   * Deux cautions attendaient dans le jeu de démonstration, invisibles ici et
   * visibles à deux clics, sur l'écran Cautions. C'est aussi ce qui laissait la
   * carte aux deux tiers vide à côté de ses voisines.
   *
   * Les cautions ne s'ajoutent que pour qui peut les arbitrer : un gestionnaire
   * propose et ne décide pas, lui montrer une décision qu'il ne peut pas prendre
   * ne ferait que déplacer l'attente.
   */
  const devis = works.filter((work) => work.status === 'quoted')
  const cautionsAArbitrer = role === 'owner' ? deposits.filter((d) => d.status === 'settling') : []
  const rienATrancher = devis.length === 0 && cautionsAArbitrer.length === 0

  /**
   * Un parc sans aucun logement.
   *
   * C'est l'état EXACT d'un compte qui vient d'être créé, et il durait :
   * l'écran offrait « Exporter le relevé » et « Enregistrer un paiement »,
   * deux gestes impossibles — il n'y a ni relevé à sortir, ni bail sur lequel
   * imputer quoi que ce soit. Un écran vide qui propose deux actions
   * impraticables décourage plus qu'un écran vide qui n'en propose aucune.
   */
  const parcVide = units.length === 0

  return (
    <>
      <PageHeader
        title={title}
        description={t('app.dashboard.subtitle', {
          buildings: t('common.buildingCount', { count: BUILDINGS.length }),
          units: t('common.unitCount', { count: units.length }),
          currency: definition.label,
        })}
        actions={
          parcVide ? null : (
          <>
            {/* Le tableau de bord exporte ce que porte son graphique : les
                douze mois d'encaissements, ventilés comme la légende. */}
            <Button
              variant="secondary"
              icon="download"
              onClick={() =>
                exportCsv({
                  name: t('app.files.collections'),
                  // Les montants sortent en nombres, la devise est nommée une
                  // fois par en-tête : un tableur doit pouvoir sommer la
                  // colonne, ce que « 1 010 000 FCFA » interdit.
                  headers: [
                    t('app.period'),
                    csvMoney.header(t('app.dashboard.legendRent')),
                    csvMoney.header(t('app.dashboard.legendWater')),
                    csvMoney.header(t('app.dashboard.legendPower')),
                    csvMoney.header(t('app.total')),
                  ],
                  rows: COLLECTIONS.map((month) => [
                    d.monthYear(month),
                    csvMoney.amount(month.rent),
                    csvMoney.amount(month.water),
                    csvMoney.amount(month.power),
                    csvMoney.amount(month.rent + month.water + month.power),
                  ]),
                })
              }
            >
              {t('app.exportStatement')}
            </Button>
            <Button icon="plus" onClick={() => setPayOpen(true)}>
              {t('app.recordPayment')}
            </Button>
          </>
          )
        }
      />

      {/*
        L'état vide REMPLACE les indicateurs, il ne s'y ajoute pas.
        Quatre cartes à zéro, un graphique plat et un échéancier vide donnent
        l'impression d'un produit en panne. Rien n'est en panne : le parc est
        neuf, et il faut le dire avec des mots plutôt qu'avec douze zéros.

        Le texte ne promet pas de bouton « ajouter un immeuble » : la saisie des
        immeubles n'existe pas encore dans le produit. Annoncer ici un geste
        qu'aucun écran ne permet serait exactement le mensonge que nous avons
        passé la journée à retirer.
      */}
      {parcVide ? (
        <EmptyState
          icon="building"
          level={2}
          title={t('common.emptyParkTitle')}
          body={t('common.emptyParkBody')}
          action={
            // Le geste existe désormais : on y renvoie, au lieu de reconnaître
            // un manque. Ce bouton aurait menti hier ; il dit vrai aujourd'hui.
            <Button to={lien(base, 'parc')} icon="plus">
              {t('app.portfolio.addBuildingTitle')}
            </Button>
          }
        />
      ) : (
      <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('app.dashboard.expected')}
          value={money(expected, { round: true })}
          note={t('app.dashboard.activeLeases', { count: occupied })}
        />
        <StatCard
          label={t('app.dashboard.collected')}
          value={money(collected, { round: true })}
          note={t('app.dashboard.collectedShare', { percent: collectedShare })}
        />
        <StatCard
          label={t('app.dashboard.outstanding')}
          value={money(outstanding, { round: true })}
          note={t('app.dashboard.overdueTenants', {
            count: doivent.length,
            days: maxOverdueDays,
          })}
        />
        <StatCard
          label={t('app.dashboard.occupancy')}
          value={`${occupancy}`}
          unit="%"
          note={t('app.dashboard.vacantUnits', { count: vacant })}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title={t('app.dashboard.chartTitle')} level={2} />
          {/* La légende répétait le titre visible : un lecteur d'écran
              entendait « Collections over 12 months » deux fois de suite. Elle
              porte maintenant ce que le titre ne dit pas — la nature du
              tableau, qui est l'équivalent textuel du graphique. */}
          {/* Un cadre d'axes sans barre n'est pas un graphique : c'est un
              graphique qui a l'air cassé. Un compte neuf n'a aucun encaissement
              — il n'en aura qu'après son premier paiement enregistré — et
              l'écran lui montrait une ligne d'objectif à 0 € au-dessus d'une
              zone vide, sans un mot. La règle est celle que la vitrine des
              états énonce pour tout le produit : aucun état ne se réduit à un
              écran blanc. */}
          {COLLECTIONS.length === 0 ? (
            <EmptyState
              icon="gauge"
              title={t('app.dashboard.chartEmptyTitle')}
              body={t('app.dashboard.chartEmptyBody')}
            />
          ) : (
          <StackedBarChart
            caption={t('app.dashboard.chartTableCaption')}
            target={expected}
            targetLabel={t('app.dashboard.expected')}
            /* La dernière colonne est HACHURÉE parce que sa période court
               encore ; une trame que rien ne nomme n'apprend rien. La note
               existait déjà dans les deux dictionnaires, et l'aperçu du hero la
               posait sur les mêmes mois — ce graphe-ci hachurait sans dire. */
            openPeriodNote={t('app.dashboard.openMonth')}
            seriesLabels={{
              rent: t('app.dashboard.legendRent'),
              water: t('app.dashboard.legendWater'),
              power: t('app.dashboard.legendPower'),
            }}
            bars={COLLECTIONS.map((month) => ({
              label: d.monthShort(month),
              segments: [
                { key: 'rent', value: month.rent },
                { key: 'water', value: month.water },
                { key: 'power', value: month.power },
              ],
            }))}
          />
          )}
          <p className="mt-4 border-t border-divider pt-4 text-body-s text-muted">
            {t('app.dashboard.chartNote')}
          </p>
        </Card>

        <Card>
          <CardHeader title={t('app.dashboard.recoveryTitle')} level={2} />
          <DonutChart
            caption={t('app.dashboard.recoveryTableCaption')}
            centerValue={`${collectedShare} %`}
            centerLabel={t('app.dashboard.recoveryCollected')}
            slices={[
              {
                key: 'paid',
                label: t('app.dashboard.recoveryCollected'),
                value: collected,
                color: 'var(--color-ok)',
              },
              {
                key: 'partial',
                label: t('app.dashboard.recoveryPartial'),
                // `--color-warn` et non `--color-gold` : l'or de marque ne
                // tient que 2,87:1 sur blanc, sous le seuil d'une donnée.
                value: kpis.partial,
                color: 'var(--color-warn)',
              },
              {
                key: 'late',
                label: t('app.dashboard.recoveryLate'),
                value: kpis.late,
                color: 'var(--color-danger)',
              },
            ]}
            /**
             * Ce que l'anneau ne disait pas : à quoi ses parts s'ajoutent.
             *
             * Les trois somment exactement à « Loyers attendus », premier
             * indicateur de la page, et les deux dernières à « Impayés
             * cumulés », le troisième. Ce sont donc les mêmes nombres, à deux
             * panneaux d'écart, sans que rien ne l'indique — l'utilisateur
             * devait poser l'addition pour savoir s'ils parlaient de la même
             * chose. L'invariant est pourtant écrit dans `kpis.ts` : l'impayé
             * se ventile en partiel et en retard, et les deux parts somment au
             * total.
             *
             * Les intitulés sont repris À L'IDENTIQUE des indicateurs : c'est
             * le nom qui referme la boucle, le montant seul se serait encore lu
             * comme une coïncidence.
             */
            reconciliation={[
              {
                key: 'outstanding',
                label: t('app.dashboard.outstanding'),
                value: outstanding,
              },
              {
                key: 'expected',
                label: t('app.dashboard.expected'),
                value: expected,
                fort: true,
              },
            ]}
          />

          <div className="mt-6 flex flex-col gap-3 border-t border-divider pt-5">
            <p className="eyebrow text-muted">{t('app.dashboard.rebilled')}</p>
            <ProgressBar label={t('app.dashboard.legendWater')} value={kpis.waterRebilled} />
            <ProgressBar label={t('app.dashboard.legendPower')} value={kpis.powerRebilled} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('app.dashboard.decisionsTitle')} level={2} />
          {rienATrancher ? (
            <p className="text-body-s text-muted">{t('app.dashboard.decisionsEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {cautionsAArbitrer.map((caution) => (
                <li key={`caution-${caution.unitId}`} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold-ink">
                    <Icon name="shield" size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-body font-medium">
                      {t('app.dashboard.decisionDeposit', {
                        tenant: caution.tenant ?? t('app.deposits.formerTenant'),
                      })}
                    </p>
                    <p className="mt-0.5 text-caps text-muted">
                      {unitById(caution.unitId)?.label ?? caution.unitId} ·{' '}
                      {money(caution.held, { round: true })}
                    </p>
                  </div>
                </li>
              ))}
              {devis.map((work) => (
                <li key={work.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold-ink">
                    <Icon name="wrench" size={15} />
                  </span>
                  <div className="min-w-0">
                    {/* Deux natures d'intitulé cohabitent : une clé pour le jeu
                        de démonstration, un texte libre dès que le locataire
                        l'écrit. Sans ce point de passage, l'écran rendrait
                        `app.works.samples.undefined` — un défaut qui compile. */}
                    <p className="text-body font-medium">{workTitle(work, t)}</p>
                    <p className="mt-0.5 text-caps text-muted">
                      {/* Un signalement ne porte que l'identifiant technique de
                          l'unité : le libellé se relit depuis le parc. Afficher
                          `work.unitId` montrerait un uuid le jour où les données
                          viendront du serveur. */}
                      {unitById(work.unitId)?.label} · {work.reference ?? work.id} ·{' '}
                      {/* Le DEVIS, et non le montant qui fait foi : cette carte
                          ne liste que `status === 'quoted'`, c'est-à-dire ce qui
                          attend une décision. L'engagé y serait toujours nul. */}
                      {work.quotedAmount
                        ? money(work.quotedAmount, { round: true })
                        : t('app.works.noQuote')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {/* Deux natures dans la carte, donc deux sorties : renvoyer aux seuls
              travaux laisserait les cautions listées sans moyen d'agir dessus,
              ce qui est la même omission que celle qu'on vient de corriger. */}
          <div className="mt-4 -ml-3.5 flex flex-wrap items-center gap-2">
            <Button variant="ghost" to={lien(base, 'travaux')} iconAfter="chevronRight">
              {t('nav.works')}
            </Button>
            {cautionsAArbitrer.length > 0 && (
              <Button variant="ghost" to={lien(base, 'cautions')} iconAfter="chevronRight">
                {t('nav.deposits')}
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('app.dashboard.scheduleTitle')} level={2} />
          <ul className="flex flex-col gap-3">
            {units.filter((unit) => unit.status !== 'paid' && unit.status !== 'vacant')
              .slice(0, 4)
              .map((unit) => (
                <li key={unit.id} className="flex items-center gap-3">
                  <span className="numeric w-9 shrink-0 text-body-s font-medium">{unit.label}</span>
                  <span className="min-w-0 flex-1 truncate text-body-s text-muted">
                    {unit.tenant}
                  </span>
                  <PaymentStatusPill status={unit.status} size="sm" />
                </li>
              ))}
          </ul>
          <Button
            variant="ghost"
            to={lien(base, 'paiements')}
            iconAfter="chevronRight"
            className="mt-4 -ml-3.5"
          >
            {t('nav.payments')}
          </Button>
        </Card>

        <Card tone="dark">
          <CardHeader title={t('app.dashboard.breakdownTitle')} level={2} />
          <ul className="flex flex-col gap-3">
            {BUILDINGS.map((building) => {
              // Compté sur l'état vivant, comme l'écran Parc. Cette carte
              // divisait encore `building.occupied / building.units`, deux
              // compteurs figés dans la constante : rattacher un locataire
              // faisait bouger le parc et pas cette liste. Un compteur se
              // compte, il ne se stocke pas.
              const inBuilding = units.filter((u) => u.buildingId === building.id)
              const occupees = inBuilding.filter((u) => u.status !== 'vacant').length
              const rate = inBuilding.length
                ? Math.round((occupees / inBuilding.length) * 100)
                : 0
              return (
                <li key={building.id}>
                  <Link
                    to={lien(base, 'parc')}
                    /* `min-h-11` : les deux lignes de texte frôlaient déjà le
                       plancher sans que rien ne le garantisse — un immeuble au nom
                       court et sans quartier serait passé dessous. */
                    className="flex min-h-11 items-center gap-3 rounded-md py-1 no-underline"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-on-dark">
                        {building.name}
                      </span>
                      <span className="text-caps text-on-dark-faint">
                        {building.district}
                      </span>
                    </span>
                    <StatusPill
                      tone={rate === 100 ? 'ok' : 'warn'}
                      size="sm"
                      icon={rate === 100 ? 'checkCircle' : 'info'}
                    >
                      {occupees}/{inBuilding.length}
                    </StatusPill>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
      </>
      )}

      {/* La modale reste montée : elle n'est atteignable que par un bouton qui
          disparaît sur un parc vide, et la démonter ici la ferait ressusciter
          au premier logement ajouté sans que rien ne le justifie. */}
      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  )
}

/**
 * Le tableau de bord, le temps que le parc arrive.
 *
 * Le titre est le seul élément qui n'est PAS un squelette : il ne dépend
 * d'aucune donnée, et l'effacer priverait l'utilisateur de la seule
 * confirmation qu'il a atterri où il voulait.
 *
 * Le sous-titre, lui, compte les immeubles et les logements : deux nombres
 * qu'on ignore encore. On tient sa place plutôt que de l'omettre — sinon toute
 * la page remonterait d'une ligne à l'arrivée des données, et le premier
 * indicateur passerait sous le doigt qui le visait.
 *
 * Les deux actions sont retenues pour la même raison, en plus forte : exporter
 * le relevé sortirait les encaissements de la démonstration, et enregistrer un
 * paiement l'imputerait sur un logement qui n'appartient pas à ce parc.
 *
 * La troisième rangée de cartes n'est pas reproduite. Elle vit sous la ligne de
 * flottaison : son apparition allonge la page sans déplacer ce qu'on regarde,
 * ce qui ne coûte rien — contrairement à quatre cartes fantômes de plus à
 * peindre sur un appareil qui rame déjà.
 */
function DashboardSkeleton({ title }: { title: string }) {
  return (
    <>
      <PageHeader
        title={title}
        description={<Skeleton line="body" className="w-full max-w-md" />}
        actions={
          <>
            <Skeleton radius="md" className="h-11 w-44" />
            <Skeleton radius="md" className="h-11 w-52" />
          </>
        }
      />

      <SkeletonRegion>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((carte) => (
            <SkeletonStatCard key={carte} />
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card>
            <Skeleton line="title" className="mb-4 w-56" />
            {/* Légende interrogeable : trois boutons de 36px. */}
            <div className="mb-5 flex flex-wrap gap-2">
              {[0, 1, 2].map((serie) => (
                <Skeleton key={serie} radius="md" className="h-9 w-24" />
              ))}
            </div>
            {/* Même hauteur que la zone de tracé de `StackedBarChart`. */}
            <Skeleton radius="lg" className="h-56 sm:h-64" />
            <div className="mt-4 border-t border-divider pt-4">
              <Skeleton line="bodyS" className="w-3/4" />
            </div>
          </Card>

          <Card>
            <Skeleton line="title" className="mb-4 w-40" />
            <div className="flex flex-wrap items-center gap-6">
              {/* L'anneau : 128px, comme le `<svg>` de `DonutChart`. */}
              <Skeleton className="size-32" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {[0, 1, 2].map((part) => (
                  <Skeleton key={part} line="bodyS" className="w-36" />
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-divider pt-5">
              <Skeleton line="eyebrow" className="w-28" />
              {[0, 1].map((barre) => (
                <div key={barre} className="flex items-center gap-3">
                  <Skeleton line="bodyS" className="w-20" />
                  <Skeleton className="h-1.5 min-w-0 flex-1" />
                  <Skeleton line="bodyS" className="w-10" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </SkeletonRegion>
    </>
  )
}
