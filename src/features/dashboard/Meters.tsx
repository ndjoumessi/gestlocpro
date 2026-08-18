import { PageHeader, useRole } from '@/components/layout/AppShell'
import { DataTable } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatCard,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import { useNumbers } from '@/lib/numbers'
import { UTILITY_RATES, type MeterReading } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

/**
 * Relevé des compteurs.
 *
 * Écran à part entière, et non une section de « Paiements » où il était
 * d'abord logé : c'est le geste de terrain le plus fréquent du gestionnaire,
 * et un relevé manquant bloque la facturation du mois — ce qui mérite d'être
 * visible sans avoir à faire défiler un autre écran.
 */
export function Meters() {
  const t = useT()
  const d = useDates()
  const n = useNumbers()
  const { money } = useCurrency()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const { role } = useRole()
  const { unitById, readings: TOUS, isMine, loading } = usePortfolio()

  /* Le locataire ne voit que SES relevés : l'écran vient de s'ouvrir à lui,
     puisque l'eau et l'électricité lui sont refacturées. */
  const READINGS = TOUS.filter((r) => role !== 'tenant' || isMine(r.unitId))

  /**
   * Libellé affichable d'une unité.
   *
   * Un relevé ne porte que l'identifiant technique de l'unité. Celui-ci vaut
   * « A1 » dans le jeu de démonstration, mais deviendra un `uuid` dès que les
   * données viendront du serveur : tout ce qui va sous les yeux — colonne,
   * export, alerte — passe donc par le `label`.
   *
   * Aucun repli sur l'identifiant : une unité introuvable laisse la cellule
   * vide, et le manque se voit. Se replier dessus réintroduirait exactement
   * l'uuid que ce détour supprime, au seul endroit où personne ne le
   * chercherait.
   */
  const unitLabel = (unitId: string) => unitById(unitId)?.label ?? ''

  const consumption = (reading: MeterReading) => ({
    water: reading.waterCurrent === null ? null : reading.waterCurrent - reading.waterPrevious,
    power: reading.powerCurrent === null ? null : reading.powerCurrent - reading.powerPrevious,
  })

  const rebilled = (reading: MeterReading) => {
    const c = consumption(reading)
    if (c.water === null || c.power === null) return null
    return c.water * UTILITY_RATES.water + c.power * UTILITY_RATES.power
  }

  const missing = READINGS.filter((r) => r.waterCurrent === null || r.powerCurrent === null)
  const total = READINGS.reduce((sum, r) => sum + (rebilled(r) ?? 0), 0)

  /**
   * L'écran affirmait « 2 relevés manquants — A3, B1 » sur des unités
   * inconnues du gestionnaire, et le nommait en jaune, ton d'une consigne. Un
   * relevé manquant déclenche une tournée : envoyer quelqu'un sur le terrain
   * pour des logements qui ne sont pas les siens est le coût le plus concret de
   * tout ce chantier.
   */
  if (loading) return <MetersSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.meters.title')}
        description={t('app.meters.subtitle')}
        actions={
          <Button
            variant="secondary"
            icon="download"
            onClick={() =>
              exportCsv({
                name: t('app.files.meters'),
                headers: [
                  t('app.portfolio.unit'),
                  t('app.portfolio.tenant'),
                  `${t('app.meters.water')} · ${t('app.meters.previous')}`,
                  `${t('app.meters.water')} · ${t('app.meters.current')}`,
                  `${t('app.meters.water')} · ${t('app.meters.consumption')} (m³)`,
                  `${t('app.meters.power')} · ${t('app.meters.previous')}`,
                  `${t('app.meters.power')} · ${t('app.meters.current')}`,
                  `${t('app.meters.power')} · ${t('app.meters.consumption')} (kWh)`,
                  csvMoney.header(t('app.meters.rebilled')),
                  t('app.meters.readAt'),
                ],
                rows: READINGS.map((r) => {
                  const c = consumption(r)
                  const amount = rebilled(r)
                  // Un relevé manquant laisse la cellule VIDE plutôt que le
                  // tiret de l'écran : « — » se compte comme une valeur dans un
                  // tableur, le vide se filtre.
                  // Index et consommations sortent en nombres bruts et non par
                  // `n.integer` : le groupement des milliers est fait pour
                  // l'œil, et il coupe « 4 120 » en deux colonnes à l'import.
                  return [
                    unitLabel(r.unitId),
                    unitById(r.unitId)?.tenant ?? t('app.portfolio.noTenant'),
                    r.waterPrevious,
                    r.waterCurrent,
                    c.water,
                    r.powerPrevious,
                    r.powerCurrent,
                    c.power,
                    amount === null ? null : csvMoney.amount(amount),
                    r.readAt ? d.fullDate(r.readAt) : null,
                  ]
                }),
              })
            }
          >
            {t('app.exportStatement')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('app.meters.totalRebilled')}
          value={money(total, { round: true })}
          note={t('app.meters.capturedCount', {
            done: READINGS.length - missing.length,
            total: READINGS.length,
          })}
        />
        {/* Ces tarifs sont des montants : ils passaient par une interpolation
            directe, donc sans devise ni groupement — « 520 » à côté d'un
            « 185 000 FCFA » formaté, sur la même ligne, et insensibles au
            changement de devise. */}
        <StatCard
          label={t('app.meters.water')}
          value={money(UTILITY_RATES.water, { round: true })}
          unit="/ m³"
        />
        <StatCard
          label={t('app.meters.power')}
          value={money(UTILITY_RATES.power, { round: true })}
          unit="/ kWh"
        />
      </div>

      {/* Un relevé manquant a une conséquence concrète : on la nomme, plutôt
          que d'afficher un simple compteur. */}
      <div
        className={`mt-6 mb-4 flex items-start gap-3 rounded-lg border px-4 py-3.5 ${
          missing.length
            ? 'border-warn-border bg-warn-tint text-warn'
            : 'border-ok-border bg-ok-tint text-ok'
        }`}
      >
        <Icon name={missing.length ? 'alert' : 'checkCircle'} size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-body font-medium">
            {missing.length
              ? t('app.meters.missingCount', { count: missing.length })
              : t('app.meters.complete')}
          </p>
          {missing.length > 0 && (
            <p className="mt-0.5 text-body-s">
              {t('app.meters.missingHint')} — {n.list(missing.map((r) => unitLabel(r.unitId)))}
            </p>
          )}
        </div>
      </div>

      <DataTable<MeterReading>
        caption={t('app.meters.title')}
        rows={READINGS}
        rowKey={(reading) => reading.unitId}
        columns={[
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            render: (r) => (
              <div>
                <span className="numeric font-medium">{unitLabel(r.unitId)}</span>
                <span className="block truncate text-body-s text-muted sm:hidden">
                  {unitById(r.unitId)?.tenant}
                </span>
              </div>
            ),
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            hideOnMobile: true,
            render: (r) => <span className="text-muted">{unitById(r.unitId)?.tenant}</span>,
          },
          {
            key: 'water',
            header: `${t('app.meters.water')} (m³)`,
            numeric: true,
            // Le garde porte sur `r.waterCurrent` et non sur la consommation
            // dérivée : les deux sont nuls ensemble, mais seul celui-ci permet
            // à TypeScript de conclure, sans assertion de non-nullité.
            render: (r) =>
              r.waterCurrent === null ? (
                <span className="text-muted">—</span>
              ) : (
                <span>
                  {n.integer(r.waterCurrent - r.waterPrevious)}
                  <span className="ml-1.5 text-caps text-muted">
                    {n.integer(r.waterPrevious)}→{n.integer(r.waterCurrent)}
                  </span>
                </span>
              ),
          },
          {
            key: 'power',
            header: `${t('app.meters.power')} (kWh)`,
            numeric: true,
            render: (r) =>
              r.powerCurrent === null ? (
                <span className="text-muted">—</span>
              ) : (
                <span>
                  {n.integer(r.powerCurrent - r.powerPrevious)}
                  {/* Les index d'électricité sont à cinq chiffres : sans
                      groupement ils rendaient « 7640 » dans les deux langues,
                      là où le français écrit « 7 640 » et l'anglais « 7,640 ». */}
                  <span className="ml-1.5 text-caps text-muted">
                    {n.integer(r.powerPrevious)}→{n.integer(r.powerCurrent)}
                  </span>
                </span>
              ),
          },
          {
            key: 'rebilled',
            header: t('app.meters.rebilled'),
            numeric: true,
            render: (r) => {
              const value = rebilled(r)
              return value === null ? (
                <StatusPill tone="warn" size="sm">
                  {t('app.meters.missing')}
                </StatusPill>
              ) : (
                <span className="font-medium">{money(value, { round: true })}</span>
              )
            },
          },
          {
            key: 'readAt',
            header: t('app.meters.readAt'),
            hideOnMobile: true,
            render: (r) => (
              <span className="numeric text-muted">
                {r.readAt ? d.dayMonth(r.readAt) : '—'}
              </span>
            ),
          },
        ]}
      />
    </>
  )
}

/**
 * Les relevés, le temps qu'ils arrivent.
 *
 * L'export est retenu : il sortirait les index de compteurs d'un autre parc
 * dans un fichier qui, une fois enregistré, ne porte plus aucune trace de son
 * origine.
 *
 * Le bandeau de complétude est remplacé par un pavé de MÊME hauteur — une boîte
 * `py-3.5` à deux lignes de texte. Ne pas le reproduire ferait remonter le
 * tableau d'une soixantaine de pixels à l'arrivée des données, juste sous le
 * doigt qui vise la première ligne.
 */
function MetersSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.meters.title')}
        description={t('app.meters.subtitle')}
        actions={<Skeleton radius="md" className="h-11 w-44" />}
      />

      <SkeletonRegion>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((carte) => (
            <SkeletonStatCard key={carte} />
          ))}
        </div>

        <div className="mt-6 mb-4 rounded-lg border border-divider px-4 py-3.5">
          <Skeleton line="body" className="w-56" />
          <Skeleton line="bodyS" className="mt-0.5 w-72 max-w-full" />
        </div>

        <SkeletonTable />
      </SkeletonRegion>
    </>
  )
}
