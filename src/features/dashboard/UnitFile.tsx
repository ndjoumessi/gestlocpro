import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { Button } from '@/components/primitives/Button'
import { Card, CardHeader } from '@/components/primitives/Card'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import {
  dernierVersement,
  imputation,
  montantEngage,
  receiptDue,
  type Occupation,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'

/**
 * Le dossier d'un logement.
 *
 * La question « que s'est-il passé dans ce logement ? » n'avait aucune réponse
 * dans le produit. Ce qu'on en sait était réparti sur cinq écrans — le parc
 * pour son identité, les paiements pour ses échéances, les travaux, les
 * relevés, les cautions — et chacun de ces écrans le range parmi les autres
 * logements, jamais avec sa propre histoire. L'occupation passée, elle,
 * n'apparaissait nulle part : le modèle porte pourtant des baux datés depuis
 * l'origine.
 *
 * Cet écran ne calcule rien de neuf. Il rassemble, autour d'une seule unité, ce
 * que le portefeuille rend déjà — et l'occupation, que le serveur rend depuis
 * ce chantier.
 */
export function UnitFile() {
  const { unitId = '' } = useParams()
  const t = useT()
  const d = useDates()
  const base = useBase()
  const { money } = useCurrency()
  const {
    unitById,
    buildingById,
    leasesForUnit,
    receiptsForUnit,
    worksForUnit,
    depositForUnit,
    inspectionForUnit,
    readingForUnit,
    loading,
  } = usePortfolio()

  if (loading) return <DossierSkeleton />

  const unit = unitById(unitId)
  if (!unit) {
    /**
     * Une adresse forgée, ou un logement retiré depuis que la page était
     * ouverte. On le DIT, avec le retour vers le parc : le repli silencieux
     * vers la liste laisserait croire à un clic manqué.
     */
    return (
      <>
        {/* Le titre dit l'ÉCRAN, l'état vide dit le problème. Les deux
            portaient la même phrase : un lecteur d'écran l'annonçait deux
            fois, et le niveau 1 d'une page ne doit pas être son message
            d'erreur. */}
        <PageHeader title={t('app.unitFile.loadingTitle')} />
        <EmptyState
          icon="building"
          level={2}
          title={t('app.unitFile.notFoundTitle')}
          body={t('app.unitFile.notFoundBody')}
          action={
            <Button variant="secondary" to={lien(base, 'parc')}>
              {t('app.unitFile.back')}
            </Button>
          }
        />
      </>
    )
  }

  const immeuble = buildingById(unit.buildingId)
  const occupations = leasesForUnit(unitId)
  const periodes = receiptsForUnit(unitId)
  const travaux = worksForUnit(unitId)
  const caution = depositForUnit(unitId)
  const entree = inspectionForUnit(unitId, 'entry')
  const sortie = inspectionForUnit(unitId, 'exit')
  const releve = readingForUnit(unitId)

  return (
    <>
      <PageHeader
        title={immeuble ? `${immeuble.name} — ${unit.label}` : unit.label}
        description={`${t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} · ${unit.surface} m² · ${money(unit.rent, { round: true })}`}
        actions={
          <Button variant="secondary" icon="chevronLeft" to={lien(base, 'parc')}>
            {t('app.unitFile.back')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('app.unitFile.occupancy')}
            description={t('app.unitFile.occupancyHint')}
            level={2}
          />
          {occupations.length === 0 ? (
            /* Le jeu de démonstration ne porte qu'un bail par unité, et un
               serveur antérieur à ce chantier n'en rend aucun. On annonce la
               case vide plutôt que d'inventer des occupants passés qu'aucun
               autre écran ne connaîtrait. */
            <EmptyState
              icon="users"
              title={t('app.unitFile.occupancyEmpty')}
              body={t('app.unitFile.occupancyEmptyBody')}
            />
          ) : (
            <ul
              aria-label={t('app.unitFile.occupancy')}
              className="flex flex-col divide-y divide-divider"
            >
              {occupations.map((bail) => (
                <LigneOccupation key={bail.id} bail={bail} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('app.unitFile.billing')}
            description={t('app.unitFile.billingHint')}
            level={2}
          />
          {periodes.length === 0 ? (
            <EmptyState
              icon="card"
              title={t('app.tenant.noReceiptsTitle')}
              body={t('app.unitFile.billingEmptyBody')}
            />
          ) : (
            <ul
              aria-label={t('app.unitFile.billing')}
              className="flex flex-col divide-y divide-divider"
            >
              {periodes.slice(0, 6).map((periode) => {
                const du = receiptDue(periode)
                const regle = imputation(periode)
                const reste = du - (regle.rent + regle.water + regle.power)
                /**
                 * LE DERNIER VERSEMENT, ET CE QU'IL PORTE.
                 *
                 * La référence était saisie à l'encaissement, écrite en base et
                 * rendue à personne : le bailleur tapait « MM-4471 » et ne le
                 * revoyait jamais. La note n'avait même pas de champ. Le dossier
                 * du logement est l'endroit où l'on vient précisément demander
                 * « ce mois-là, il a payé comment, et qu'avais-je noté ? ».
                 */
                const versement = dernierVersement(periode)
                return (
                  <li
                    key={`${periode.year}-${periode.month}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 text-body">
                      {d.monthYear(periode)}
                      {/* Rien ne s'affiche sur un versement sans référence :
                          les espèces n'en produisent pas, et « réf. — » ferait
                          chercher une donnée manquante là où il n'y a rien à
                          trouver. */}
                      {versement?.reference && (
                        <span className="ml-2 text-caps text-muted">
                          {t('app.payments.referenceShort', { reference: versement.reference })}
                        </span>
                      )}
                      {/* `note` est ABSENTE chez le locataire — le serveur ne
                          l'envoie pas —, `null` quand personne n'a rien écrit.
                          Le test de vérité couvre les deux d'un coup. */}
                      {versement?.note && (
                        <span className="mt-0.5 block text-body-s text-muted">
                          {versement.note}
                        </span>
                      )}
                    </span>
                    <span className="numeric text-body-s">
                      {money(du, { round: true })}
                      {/* Le reste dû, et lui seul, appelle un geste : une
                          période soldée n'a pas à porter un « reste 0 ». */}
                      {reste > 0 && (
                        <span className="text-warn">
                          {' · '}
                          {t('app.tenant.remaining', { amount: money(reste, { round: true }) })}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('app.unitFile.works')}
            description={t('app.unitFile.worksHint')}
            level={2}
          />
          {travaux.length === 0 ? (
            <EmptyState
              icon="wrench"
              title={t('app.unitFile.worksEmpty')}
              body={t('app.unitFile.worksEmptyBody')}
            />
          ) : (
            <ul
              aria-label={t('app.unitFile.works')}
              className="flex flex-col divide-y divide-divider"
            >
              {travaux.map((work) => (
                <li
                  key={work.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                >
                  {/* Deux natures d'intitulé cohabitent — une clé pour la
                      démonstration, un texte libre dès que le locataire
                      l'écrit. `workTitle` est le point de passage. */}
                  <span className="min-w-0 text-body">{workTitle(work, t)}</span>
                  <span className="text-caps text-muted">
                    {/* Les statuts vivent à plat dans `app.works` —
                        `reported`, `quoted`, `approved`, `done` — et non sous
                        un sous-objet `status`. */}
                    {t(`app.works.${work.status}` as 'app.works.reported')}
                    {montantEngage(work).montant !== null &&
                      ` · ${money(montantEngage(work).montant!, { round: true })}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('app.unitFile.file')}
            description={t('app.unitFile.fileHint')}
            level={2}
          />
          {/*
            CHAQUE absence dit la SIENNE.

            Toutes portaient « Aucun document déposé » — la formule de l'écran
            des documents du locataire, qui parle de fichiers. Un état des lieux
            de sortie qui n'a pas eu lieu n'est pas un document manquant : c'est
            une visite qui n'a pas été faite, et le geste qu'elle appelle n'est
            pas le même. Une caution non versée non plus.
          */}
          <ul
            aria-label={t('app.unitFile.file')}
            className="flex flex-col divide-y divide-divider"
          >
            <LignePiece
              label={t('app.deposits.title')}
              valeur={caution ? money(caution.held, { round: true }) : null}
              absence={t('app.unitFile.noDeposit')}
            />
            <LignePiece
              label={t('app.documents.entryInspection')}
              valeur={entree ? d.fullDate(entree.date) : null}
              absence={t('app.unitFile.noInspection')}
            />
            <LignePiece
              label={t('app.inspections.exit')}
              valeur={sortie ? d.fullDate(sortie.date) : null}
              absence={t('app.unitFile.noInspection')}
            />
            <LignePiece
              /* La CONSOMMATION, et non « le relevé » : le chiffre affiché est
                 la différence de deux index, pas l'index lui-même. La ligne
                 s'appelait « Relevés » et montrait 16 m³, ce qui se lit comme un
                 compteur à 16. */
              label={t('app.unitFile.waterUse')}
              valeur={
                releve && releve.waterCurrent !== null
                  ? `${releve.waterCurrent - releve.waterPrevious} m³`
                  : null
              }
              absence={t('app.unitFile.noReading')}
            />
          </ul>
        </Card>
      </div>
    </>
  )
}

/**
 * Une occupation dans la liste.
 *
 * « depuis le … » pour un bail qui court, « du … au … » pour un bail terminé :
 * la même ligne dirait sinon « du 01/08/2023 au — », ce qui se lit comme une
 * date manquante plutôt que comme un bail en cours.
 */
function LigneOccupation({ bail }: { bail: Occupation }) {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-body font-medium">
          {bail.tenant ?? <span className="text-muted italic">{t('app.portfolio.noTenant')}</span>}
        </p>
        <p className="mt-0.5 text-caps text-muted">
          {bail.endsOn
            ? t('app.unitFile.between', {
                start: d.fullDate(bail.startsOn),
                end: d.fullDate(bail.endsOn),
              })
            : t('app.unitFile.since', { date: d.fullDate(bail.startsOn) })}
        </p>
      </div>
      <span className="numeric text-body-s text-muted">{money(bail.rentMinor, { round: true })}</span>
    </li>
  )
}

/** Une pièce du dossier — ou la case vide, dite dans les termes qui la concernent. */
function LignePiece({
  label,
  valeur,
  absence,
}: {
  label: string
  valeur: string | null
  absence: string
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
      <span className="text-body">{label}</span>
      {valeur ? (
        <span className="numeric text-body-s">{valeur}</span>
      ) : (
        <span className="text-body-s text-muted">{absence}</span>
      )}
    </li>
  )
}

/** Le dossier, le temps qu'il arrive. */
function DossierSkeleton() {
  const t = useT()
  return (
    <>
      <PageHeader
        title={t('app.unitFile.loadingTitle')}
        description={<Skeleton line="body" className="w-full max-w-xs" />}
      />
      <SkeletonRegion>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} radius="lg" className="h-48" />
          ))}
        </div>
      </SkeletonRegion>
    </>
  )
}
