import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { ProgressBar } from '@/components/primitives/Charts'
import { PaymentStatusPill, StatusPill } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion, SkeletonStatCard } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useNumbers } from '@/lib/numbers'
import { cn } from '@/lib/cn'
import {
  UTILITY_RATES,
  dernierVersement,
  imputation,
  type Receipt,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { ReceiptModal } from './ReceiptModal'
import { workTitle } from '@/data/workTitle'

/**
 * Espace locataire.
 *
 * Vue distincte du tableau de bord propriétaire, et non une variante filtrée :
 * un locataire ne cherche pas un taux d'occupation ni un encaissé consolidé, il
 * veut son échéance, ses quittances et l'état de ses signalements. Toutes les
 * données proviennent de sa seule unité — le parc n'est jamais interrogé.
 */
export function TenantDashboard() {
  const [quittanceDe, setQuittanceDe] = useState<string | null>(null)
  const base = useBase()
  const t = useT()
  const d = useDates()
  const n = useNumbers()
  const { money } = useCurrency()
  const {
    worksForUnit,
    depositForUnit,
    unitById,
    tenantUnitIds,
    receiptsForUnit,
    buildingById,
    readingForUnit,
    inspectionForUnit,
    loading,
  } = usePortfolio()

  /**
   * Cet écran est mono-unité par conception : un locataire y voit SON logement.
   * Il prend donc la première de ses unités, et c'est une limite assumée — le
   * modèle en autorise plusieurs, l'écran n'en montre qu'une.
   */
  const monUnite = tenantUnitIds[0] ?? ''

  const unit = unitById(monUnite)
  /* Les périodes de CE logement : le tableau en dessous est le sien. */
  const tenantReceipts = receiptsForUnit(monUnite)
  /* `buildingById` du PROVIDER, et non celui du module de démonstration : ce
     dernier ne connaît que « bon », « akw », « des », et sur un vrai parc — où
     les identifiants sont des `uuid` — il ne trouvait rien. Le titre retombait
     alors sur le seul numéro d'unité, « B7 », sans dire dans quel immeuble. */
  const building = unit ? buildingById(unit.buildingId) : undefined
  const deposit = depositForUnit(monUnite)
  const works = worksForUnit(monUnite)
  const entree = inspectionForUnit(monUnite, 'entry')
  const releve = readingForUnit(monUnite)

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

  /**
   * PAS DE LOGEMENT : on le dit, on ne rend pas une page blanche.
   *
   * `return null` laissait un écran entièrement vide — barre latérale, fil
   * d'Ariane, et rien. C'est l'état d'un compte rattaché au parc dont AUCUN bail
   * ne porte encore son nom : le propriétaire l'a invité, mais n'a pas relié sa
   * fiche locataire au compte.
   *
   * Une page blanche se lit comme une panne. Elle laisse chercher un défaut
   * là où il n'y a qu'une étape manquante, et personne ne sait laquelle.
   */
  if (!unit)
    return (
      <>
        <PageHeader title={t('app.tenant.title')} description={t('app.tenant.subtitle')} />
        <EmptyState
          icon="info"
          title={t('app.tenant.noUnitTitle')}
          body={t('app.tenant.noUnitBody')}
        />
      </>
    )


  /**
   * Le mois EN COURS, et non la première quittance de la liste.
   *
   * La carte lisait `TENANT_RECEIPTS[0]` : elle annonçait donc « Loyer · Août
   * 2026 » et « payé le 3 août par Mobile Money » à un locataire réel de
   * n'importe quel mois, à côté d'un loyer et d'un encaissé qui, eux, étaient
   * les siens. Deux vérités sur la même carte, dont une inventée.
   *
   * La période vient de l'horloge ; le montant, l'encaissé et le statut du
   * portefeuille. La quittance ne sert plus qu'à ce qu'elle seule sait —
   * le jour et le moyen du règlement — et seulement si elle existe.
   */
  const maintenant = new Date()
  const periodeCourante = { year: maintenant.getFullYear(), month: maintenant.getMonth() }
  const quittanceCourante = tenantReceipts.find(
    (r) => r.year === periodeCourante.year && r.month === periodeCourante.month,
  )
  /* Sans versement, pas de phrase : « payé le … » suppose qu'on ait payé. */
  const versementCourant = quittanceCourante ? dernierVersement(quittanceCourante) : undefined

  /* L'eau et l'électricité du mois viennent du RELEVÉ, la seule source que le
     serveur alimente. Elles se lisaient dans la quittance de démonstration. */
  const eauConso =
    releve && releve.waterCurrent !== null ? releve.waterCurrent - releve.waterPrevious : null
  const elecConso =
    releve && releve.powerCurrent !== null ? releve.powerCurrent - releve.powerPrevious : null

  return (
    <>
      <PageHeader
        title={building ? `${building.name} — ${unit.label}` : unit.label}
        /* Le gestionnaire ne figure PAS ici. La ligne annonçait « gestionnaire
           Diane F. » — une chaîne du dictionnaire, servie à tout locataire de
           tout parc. Rien dans le modèle ne relie un gestionnaire à une unité :
           la valeur ne pouvait être juste que par coïncidence, et l'en-tête est
           le dernier endroit où loger une coïncidence. Elle reviendra le jour
           où l'adhésion porte ce nom. */
        description={
          unit.leaseStart
            ? t('app.tenant.leaseSince', { date: d.fullDate(unit.leaseStart) })
            : t('app.tenant.subtitle')
        }
        actions={
          <>
            <Button variant="secondary" icon="download" to={lien(base, 'documents')}>
              {t('app.tenant.downloadReceipts')}
            </Button>
            <Button icon="bell" to={lien(base, 'signaler')}>
              {t('app.tenant.reportIssue')}
            </Button>
          </>
        }
      />

      {/* LE MOIS EN COURS — loyer, eau, électricité.
          Le loyer occupe la première carte parce qu'il est la seule somme due
          d'office ; l'eau et l'électricité sont REFACTURÉES, et leur montant se
          dérive de la quantité relevée et du tarif, jamais d'un chiffre saisi
          deux fois. */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Card className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow text-muted">
              {t('app.tenant.rentFor')} · {d.monthYear(periodeCourante)}
            </p>
            <PaymentStatusPill status={unit.status} size="sm" />
          </div>
          <p className="numeric mt-2 text-kpi font-medium">{money(unit.rent, { round: true })}</p>
          {/* La valeur est un POURCENTAGE, pas un montant : passer le montant
              rendait une piste large de 145 000 % et un libellé « 145000 % ».
              Le libellé est masqué — le montant juste au-dessus le dit déjà —
              mais reste annoncé aux lecteurs d'écran. */}
          <div className="mt-3">
            <ProgressBar
              value={unit.rent === 0 ? 0 : Math.round((unit.paid / unit.rent) * 100)}
              label={t('app.tenant.rentFor')}
              tone="ok"
              hideLabel
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {/* Le jour et le moyen du règlement sont les deux seules choses que
                la quittance sait et que le portefeuille ignore. Sans quittance
                pour la période, la ligne disparaît plutôt que d'en inventer
                une : le statut au-dessus dit déjà où en est le loyer. */}
            {versementCourant ? (
              <span className="text-body-s text-muted">
                {t('app.tenant.paidOnBy', {
                  date: d.dayMonth(versementCourant.paidOn),
                  method: t(
                    MOYENS_DE_PAIEMENT[versementCourant.method] as 'app.payments.methodCash',
                  ),
                })}
              </span>
            ) : (
              <span />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="-mr-3.5"
              onClick={() => setQuittanceDe(periodeIso(periodeCourante))}
            >
              {t('app.tenant.receipt')}
            </Button>
          </div>
        </Card>

        <CarteCharge
          label={t('app.tenant.water')}
          amount={eauConso === null ? '—' : money(eauConso * UTILITY_RATES.water, { round: true })}
          note={
            eauConso === null
              ? t('app.meters.missing')
              : t('app.tenant.consumedWater', { n: n.integer(eauConso) })
          }
        />
        <CarteCharge
          label={t('app.tenant.power')}
          amount={elecConso === null ? '—' : money(elecConso * UTILITY_RATES.power, { round: true })}
          note={
            elecConso === null
              ? t('app.meters.missing')
              : t('app.tenant.consumedPower', { n: n.integer(elecConso) })
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* MES PAIEMENTS PAR PÉRIODE.
            Trois colonnes de montants pour une même période : c'est un tableau,
            et non une liste. Les en-têtes portent `scope` — sans quoi un lecteur
            d'écran annonce une suite de nombres sans dire de quoi ils sont le
            montant, ni de quel mois. */}
        <Card flush>
          <CardHeader
            title={t('app.tenant.byPeriod')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
            action={
              <span className="flex items-center gap-3 text-caps text-muted">
                <Legende tone="bg-ok" label={t('app.tenant.legendSettled')} />
                <Legende tone="bg-warn" label={t('app.tenant.legendPartial')} />
              </span>
            }
          />
          {/* Aucune période enregistrée : on le DIT. Le serveur rend
              l'historique du bail, mais un parc peut n'avoir encore aucune
              échéance — un tableau d'en-têtes sans ligne se lit alors comme une
              panne, et les six périodes de la démonstration se lisaient comme
              les siennes. */}
          {tenantReceipts.length === 0 ? (
            <div className="border-t border-divider px-4 py-4 sm:px-5">
              <EmptyState
                icon="card"
                title={t('app.tenant.noReceiptsTitle')}
                body={t('app.tenant.noReceiptsBody')}
              />
            </div>
          ) : (
          <div className="overflow-x-auto border-t border-divider">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-divider">
                  <th scope="col" className="px-4 py-2.5 text-left text-caps text-muted sm:px-5">
                    {t('app.tenant.colPeriod')}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-caps text-muted">
                    {t('app.tenant.colRent')}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-caps text-muted">
                    {t('app.tenant.colWater')}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-caps text-muted">
                    {t('app.tenant.colPower')}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right text-caps text-muted sm:px-5">
                    {t('app.tenant.colReceipt')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {tenantReceipts.map((receipt) => {
                  /* Une imputation par ligne, et non une par cellule : les
                     trois colonnes lisent le même partage du même versement. */
                  const regle = imputation(receipt)
                  return (
                  <tr key={`${receipt.year}-${receipt.month}`}>
                    <th scope="row" className="px-4 py-3 text-left text-body font-medium sm:px-5">
                      {d.monthYear(receipt)}
                    </th>
                    {/* Le loyer DE LA PÉRIODE, et non celui du bail
                        d'aujourd'hui. La colonne affichait `unit.rent` sur
                        chaque ligne : une révision de loyer aurait réécrit tout
                        l'historique, du premier mois au dernier. */}
                    <CelluleMontant du={receipt.rentMinor} regle={regle.rent} />
                    <CelluleMontant du={receipt.waterMinor} regle={regle.water} />
                    <CelluleMontant du={receipt.powerMinor} regle={regle.power} />
                    <td className="px-4 py-3 text-right sm:px-5">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${t('app.tenant.receipt')} — ${d.monthYear(receipt)}`}
                        className="-mr-3.5"
                        onClick={() => setQuittanceDe(periodeIso(receipt))}
                      >
                        {t('app.tenant.receipt')}
                      </Button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {/* MON BAIL — les TERMES du contrat, que le locataire ne lisait nulle
              part. La caution est son argent : la lui cacher jusqu'à la
              restitution est ce que ce produit reproche aux pratiques qu'il
              remplace. Le montant vient de `depositForUnit`, la même source que
              l'écran des cautions — deux chiffres pour un seul fait
              divergeraient au premier arbitrage. */}
          <Card>
            <CardHeader title={t('app.tenant.myLease')} level={2} />
            <dl className="flex flex-col">
              <LigneBail
                terme={t('app.tenant.leaseRent')}
                valeur={money(unit.rent, { round: true })}
              />
              <LigneBail
                terme={t('app.tenant.leaseDeposit')}
                valeur={deposit ? money(deposit.held, { round: true }) : '—'}
              />
              {/* L'état des lieux EXISTE comme fiche, pas comme fichier : aucun
                  dépôt ne le crée, et ce produit ne fabrique pas de PDF
                  opposable. On renvoie donc vers ce qu'on sait montrer. */}
              <LigneBail
                terme={t('app.documents.entryInspection')}
                href={entree ? lien(base, 'etats-des-lieux') : undefined}
                action={t('app.documents.view')}
                valeur={entree ? undefined : t('app.documents.none')}
              />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title={t('app.tenant.myWorks')}
              description={
                unit.leaseStart
                  ? t('app.tenant.worksSince', { date: d.fullDate(unit.leaseStart) })
                  : undefined
              }
              level={2}
            />
            {works.length === 0 ? (
              <p className="text-body-s text-muted">{t('app.tenant.worksEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {works.map((work) => (
                  <li key={work.id} className="flex items-start gap-3">
                    <span className="numeric mt-0.5 shrink-0 text-caps text-muted">
                      {d.dayMonth(work.reportedAt)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-body font-medium">{workTitle(work, t)}</p>
                      <p className="mt-0.5 text-caps text-muted">
                        {t(`app.works.${work.status}` as 'app.works.reported')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {quittanceDe && (
        <ReceiptModal
          unitId={monUnite}
          periodStart={quittanceDe}
          open
          onClose={() => setQuittanceDe(null)}
        />
      )}

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
 * Premier jour de la période, au format que réclame la modale.
 *
 * Les quittances de cet écran passent TOUTES par `ReceiptModal`, et non par
 * l'export CSV. L'écran en offrait les deux — une carte « Mes quittances » qui
 * ouvrait la modale, une liste « Quittances » qui téléchargeait un CSV — pour
 * le même document et les mêmes périodes. Le CSV recompose les montants côté
 * client ; la modale rend ceux du REGISTRE, et c'est la modale qui a raison :
 * « les montants sont ceux du registre, pas ceux de l'écran », dit-elle
 * elle-même. Deux vérités pour un seul document, c'en était une de trop.
 */
function periodeIso(periode: { year: number; month: number }): string {
  return `${periode.year}-${String(periode.month + 1).padStart(2, '0')}-01`
}

/** Une charge du mois : son montant, et le volume qu'elle facture. */
function CarteCharge({ label, amount, note }: { label: string; amount: string; note: string }) {
  return (
    <Card>
      <p className="eyebrow text-muted">{label}</p>
      <p className="numeric mt-2 text-kpi font-medium">{amount}</p>
      <p className="mt-2 text-body-s text-muted">{note}</p>
    </Card>
  )
}

/**
 * Un poste dans le tableau — soldé, ou partiel avec son reste.
 *
 * Le reste est affiché parce qu'il est le seul chiffre qui appelle un geste :
 * une cellule qui ne montrerait que la part versée laisserait croire la période
 * close. La couleur ne porte pas seule cette différence — le reste est écrit.
 *
 * Le dû et la part réglée arrivent tous deux calculés : le montant vient du
 * serveur, figé à l'émission, et la part de l'imputation conventionnelle. La
 * cellule ne dérive plus rien d'un tarif courant.
 */
function CelluleMontant({ du, regle }: { du: number; regle: number }) {
  const t = useT()
  const n = useNumbers()
  const solde = regle >= du
  return (
    <td className={cn('numeric px-3 py-3 text-right text-body', solde ? 'text-ok' : 'text-warn')}>
      {n.integer(solde ? du : regle)}
      {!solde && (
        <span className="text-caps">
          {' · '}
          {t('app.tenant.remaining', { amount: n.integer(du - regle) })}
        </span>
      )}
    </td>
  )
}

/**
 * Le dictionnaire des moyens de paiement, aux valeurs du serveur.
 *
 * Une table plutôt qu'une clé construite : `app.payments.method${method}`
 * imposerait une majuscule à la volée, et `check-i18n` ne verrait plus quelles
 * clés sont employées.
 */
const MOYENS_DE_PAIEMENT: Record<Receipt['payments'][number]['method'], string> = {
  mobile: 'app.payments.methodMobile',
  cash: 'app.payments.methodCash',
  transfer: 'app.payments.methodTransfer',
  check: 'app.payments.methodCheck',
}

/** Un terme du bail : un intitulé, et soit une valeur, soit un renvoi. */
function LigneBail({
  terme,
  valeur,
  href,
  action,
}: {
  terme: string
  valeur?: string
  href?: string
  action?: string
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-divider py-2 last:border-b-0">
      <dt className="text-body text-muted">{terme}</dt>
      <dd className="numeric text-body font-medium">
        {href ? (
          <Button variant="ghost" size="sm" to={href} className="-mr-3.5">
            {action}
          </Button>
        ) : (
          valeur
        )}
      </dd>
    </div>
  )
}

/** Pastille de légende — la couleur seule ne dit rien, elle est toujours nommée. */
function Legende({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('size-2 rounded-xs', tone)} />
      {label}
    </span>
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
