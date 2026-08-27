import { useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
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
import { type MeterReading } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { TariffsModal } from './TariffsModal'

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
  const { adhesionActive } = useSession()
  const [tarifsOuverts, setTarifsOuverts] = useState(false)

  /**
   * Poser un prix est un acte de PROPRIÉTAIRE, et il exige un vrai parc.
   *
   * Le rôle d'abord — fixer un prix engage l'argent du locataire, même partage
   * que la validation d'un devis. Et l'adhésion ensuite : la démonstration n'a
   * pas de parc à qui écrire, et lui offrir le bouton mènerait à un appel sans
   * destinataire.
   */
  const peutPoserUnPrix = role === 'owner' && adhesionActive !== null

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

  /**
   * Le montant refacturé, ou `null` — relevé incomplet OU prix absent.
   *
   * Deux constantes tenaient ce rôle, servies à tous les parcs : le total
   * s'affichait donc toujours, y compris pour un propriétaire qui n'avait
   * jamais posé de prix. Le `null` du prix se propage maintenant jusqu'ici, et
   * l'écran montre la quantité seule — c'est la règle du produit, aucun chiffre
   * sans donnée derrière, appliquée à celui sur lequel quelqu'un paie.
   */
  /*
    DEUX CAUSES DE `null`, ET ELLES N'APPELLENT PAS LE MÊME GESTE.

    La fonction rendait `null` dans les deux cas, et la colonne affichait
    « Relevé manquant » pour l'un comme pour l'autre. Or un relevé manquant
    déclenche une TOURNÉE — ce fichier chiffre lui-même ce coût quelques lignes
    plus haut — tandis qu'un tarif non fixé se règle en trente secondes depuis
    l'écran des tarifs, sans que personne se déplace.

    Envoyer quelqu'un sur le terrain parce qu'un prix n'a pas été saisi est le
    genre de méprise qu'un libellé approximatif finance.
  */
  const rebilled = (
    reading: MeterReading,
  ): { montant: number } | { manque: 'reading' | 'price' } => {
    const c = consumption(reading)
    if (c.water === null || c.power === null) return { manque: 'reading' }
    if (reading.waterPrice === null || reading.powerPrice === null) return { manque: 'price' }
    return { montant: c.water * reading.waterPrice + c.power * reading.powerPrice }
  }

  /** Le montant seul, pour les sommes — `null` quelle que soit la cause. */
  const montantRefacture = (reading: MeterReading) => {
    const r = rebilled(reading)
    return 'montant' in r ? r.montant : null
  }

  /**
   * Le prix en vigueur, lu sur les relevés plutôt que sur une constante.
   *
   * Tous les relevés d'un parc portent le même prix pour une énergie donnée à
   * une période donnée — c'est le serveur qui le choisit —, donc le premier
   * suffit. `null` quand aucun n'a été posé, et la vignette disparaît alors :
   * afficher « — / m³ » nommerait un prix qui n'existe pas.
   */
  const prixCourant = (energie: 'waterPrice' | 'powerPrice') =>
    READINGS.find((r) => r[energie] !== null)?.[energie] ?? null

  const aUnPrix = prixCourant('waterPrice') !== null && prixCourant('powerPrice') !== null
  const missing = READINGS.filter((r) => r.waterCurrent === null || r.powerCurrent === null)
  const total = READINGS.reduce((sum, r) => sum + (montantRefacture(r) ?? 0), 0)

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
                  const amount = montantRefacture(r)
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

      {peutPoserUnPrix && (
        <div className="mb-6">
          <Button variant="secondary" icon="card" onClick={() => setTarifsOuverts(true)}>
            {t('app.tariffs.open')}
          </Button>
        </div>
      )}

      {tarifsOuverts && <TariffsModal open onClose={() => setTarifsOuverts(false)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/*
          TROIS COLONNES SEULEMENT QUAND LA CARTE PEUT PORTER UN MONTANT.
      
          `sm:grid-cols-3` les posait dès 640 px. Mesuré à 700 px : la carte
          offre 159 px de contenu, « 1 397 000 FCFA » en demande 189, et le
          montant FRANCHIT la bordure de 9 px — les cautions le font deux fois
          sur le même écran. Rien ne pouvait le couper : `Intl.NumberFormat`
          pose une espace INSÉCABLE avant la devise, donc un montant est
          insécable de bout en bout et `whitespace-nowrap` n'y est pour rien.
          Le seul levier est la largeur de colonne.
      
          Deux colonnes jusqu'à `lg`, trois ensuite : `md` (768 px) ne suffit
          pas — il en faudrait environ 790 pour que trois cartes portent ce
          montant. C'est l'arbitrage du tableau de bord et du parc, qui
          attendent `xl` pour passer à quatre.
        */}
        {/*
          Le total n'est un total QUE s'il y a un prix.
          `rebilled` rend `null` sans tarif, et la somme retombait alors à zéro :
          l'écran annonçait « 0 FCFA refacturés » là où la vérité est qu'on ne
          sait pas encore combien. Un zéro affirmé est le même défaut que 520
          affirmé, en plus discret — il a l'air d'un fait mesuré.

          Le compte des relevés saisis, lui, reste : il ne dépend d'aucun prix,
          et c'est l'information dont le gestionnaire a besoin pour sa tournée.
        */}
        <StatCard
          icone="gauge"
          /**
           * LA CARTE S'ACCORDE À LA BANNIÈRE QUI LA SUIT, à quinze pixels.
           *
           * « 8 sur 10 saisis » était en gris muet, et la bannière juste
           * dessous disait le même fait en ambre : « 2 relevés manquants pour
           * la période ». Deux traitements pour une seule information — l'œil
           * apprend que la carte est tranquille et que l'alerte est ailleurs,
           * alors que c'est le TOTAL de la carte qui est faux tant qu'il manque
           * un relevé.
           *
           * `warn` et non `danger` : rien n'est en retard, il manque une
           * saisie — c'est le ton que la bannière emploie déjà, et il n'y a pas
           * de raison d'en avoir deux pour un fait.
           *
           * SANS PASTILLE : la note de la carte dit « 8 sur 10 saisis », ce qui
           * nomme le fait en toutes lettres. Une pastille « Relevé manquant »
           * ferait la TROISIÈME formulation du même manque sur le même écran.
           */
          etat={missing.length > 0 ? { ton: 'warn' } : undefined}
          label={t('app.meters.totalRebilled')}
          value={aUnPrix ? money(total, { round: true }) : '—'}
          note={t('app.meters.capturedCount', {
            done: READINGS.length - missing.length,
            total: READINGS.length,
          })}
        />
        {/* Ces tarifs sont des montants : ils passaient par une interpolation
            directe, donc sans devise ni groupement — « 520 » à côté d'un
            « 185 000 FCFA » formaté, sur la même ligne, et insensibles au
            changement de devise. */}
        {prixCourant('waterPrice') !== null && (
          <StatCard
            icone="droplet"
            label={t('app.meters.water')}
            value={money(prixCourant('waterPrice')!, { round: true })}
            unit="/ m³"
          />
        )}
        {prixCourant('powerPrice') !== null && (
          <StatCard
            icone="bolt"
            label={t('app.meters.power')}
            value={money(prixCourant('powerPrice')!, { round: true })}
            unit="/ kWh"
          />
        )}
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
            <p className="mt-0.5 text-body">
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
                <span className="block truncate text-body text-muted sm:hidden">
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
              const r2 = rebilled(r)
              if ('montant' in r2) {
                return <span className="font-medium">{money(r2.montant, { round: true })}</span>
              }
              // Le libellé DIT la cause : une tournée d'un côté, une saisie de
              // tarif de l'autre.
              return (
                <StatusPill tone="warn" size="sm">
                  {r2.manque === 'reading' ? t('app.meters.missing') : t('app.meters.noPrice')}
                </StatusPill>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
