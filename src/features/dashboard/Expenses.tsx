import { useCallback, useEffect, useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatRow,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { Notice } from '@/components/primitives/Notice'
import { Button } from '@/components/primitives/Button'
import { MonthPicker } from '@/components/primitives/DatePicker'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { NoteDePerimetre } from './NoteDePerimetre'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { api, ApiError } from '@/api/client'
import { DEPENSES_DEMO, MOIS_DEMO } from '@/data/portfolio'
import { RecordExpenseModal, type DepenseApi } from './RecordExpenseModal'

/**
 * CE QUI SORT DU PARC.
 *
 * ═══ POURQUOI CET ÉCRAN N'EST PAS UNE SECTION DES PAIEMENTS ═══
 *
 * Les paiements répondent à « qui m'a payé, et combien reste-t-il à
 * encaisser ». Une dépense répond à « qu'ai-je payé, et pour quoi ». Les deux
 * portent de l'argent et rien d'autre en commun : ni la même maille — un
 * paiement s'accroche à une échéance de bail, une dépense à un immeuble ou à
 * personne —, ni le même geste, ni le même lecteur. Les mêler aurait donné un
 * écran où « total » ne veut plus rien dire.
 *
 * ═══ LE TABLEAU NE SOMME PAS AU TOTAL, ET LA NOTE LE DIT ═══
 *
 * Le sortant a deux moitiés : les dépenses saisies ici, et les chantiers
 * achevés, qui portent déjà leur montant approuvé dans l'écran Travaux. Le
 * serveur les rend séparées ; l'écran les affiche séparées ; et la note qui
 * l'explique est INCONDITIONNELLE. Un mois sans chantier est précisément celui
 * où l'on croirait le tableau complet.
 *
 * ═══ CET ÉCRAN NE PASSE PAS PAR `PortfolioProvider` ═══
 *
 * Même arbitrage que les tarifs de refacturation : le fournisseur ne porte que
 * ce que PLUSIEURS écrans lisent. Une dépense n'est lue que d'ici, et sa lecture
 * est BORNÉE PAR UN INTERVALLE — la mettre dans l'état partagé y poserait une
 * collection dont le contenu dépend d'un mois choisi ailleurs, c'est-à-dire une
 * seconde vérité qui se périmerait sans le dire. Le jour où un second écran en
 * aura besoin, c'est ce jour-là qu'il faudra la déplacer.
 */
export function Expenses() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { role } = useRole()
  const { buildingById, unitById, works, loading: chargementDuParc } = usePortfolio()
  const { adhesionActive, estDemo } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [mois, setMois] = useState(MOIS_DEMO)
  const [depenses, setDepenses] = useState<DepenseApi[]>(DEPENSES_DEMO)
  /** Ce que le SERVEUR a rendu pour les chantiers. `null` hors session. */
  const [chantiersServis, setChantiersServis] = useState<number | null>(null)
  const [chargement, setChargement] = useState(false)
  const [saisieOuverte, setSaisieOuverte] = useState(false)
  const [ligneACorriger, setLigneACorriger] = useState<DepenseApi | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)

  /**
   * SAISIR EST OUVERT AUX DEUX RÔLES DE GESTION, et le serveur dit pourquoi :
   * saisir une dépense n'ENGAGE rien — le syndic a déjà été payé, et c'est très
   * souvent le mandataire qui a signé. La frontière de ce dépôt porte sur ce qui
   * engage l'argent du propriétaire : valider un devis, poser un prix.
   *
   * `adhesionActive !== null || estDemo` : sans cette moitié, l'écran offrirait
   * un geste qui n'écrit nulle part. C'est la distinction que `Meters` fait
   * aussi — « personne à qui écrire » n'est pas « rien ne s'écrit ».
   */
  const peutSaisir =
    (role === 'owner' || role === 'manager') && (adhesionActive !== null || estDemo)

  const bornesDuMois = useCallback((moisChoisi: string) => {
    const [an, m] = moisChoisi.split('-').map(Number) as [number, number]
    /* Le DERNIER jour du mois par le jour zéro du suivant : `new Date(an, m, 0)`
       rend le 31, le 30 ou le 28 sans table à tenir. En UTC, comme les colonnes
       de la base — construire en heure locale décalerait la borne d'un jour pour
       la moitié de la planète. */
    const dernier = new Date(Date.UTC(an, m, 0)).getUTCDate()
    return {
      from: `${moisChoisi}-01`,
      to: `${moisChoisi}-${String(dernier).padStart(2, '0')}`,
    }
  }, [])

  useEffect(() => {
    if (!parkId) return
    let annule = false
    const { from, to } = bornesDuMois(mois)
    setChargement(true)
    void api
      .expenses<{ expenses: DepenseApi[]; expensesMinor: number; worksMinor: number }>(
        parkId,
        from,
        to,
      )
      .then((lu) => {
        if (annule) return
        setDepenses(lu.expenses)
        setChantiersServis(lu.worksMinor)
      })
      .catch(() => {
        /* UNE LECTURE QUI ÉCHOUE REND LA LISTE VIDE, jamais la précédente : des
           dépenses d'un autre mois affichées sous l'étiquette de celui-ci
           seraient un chiffre faux présenté comme un fait. */
        if (annule) return
        setDepenses([])
        setChantiersServis(0)
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [parkId, mois, bornesDuMois])

  const recharger = useCallback(() => {
    if (!parkId) return
    const { from, to } = bornesDuMois(mois)
    void api
      .expenses<{ expenses: DepenseApi[]; expensesMinor: number; worksMinor: number }>(
        parkId,
        from,
        to,
      )
      .then((lu) => {
        setDepenses(lu.expenses)
        setChantiersServis(lu.worksMinor)
      })
      .catch(() => undefined)
  }, [parkId, mois, bornesDuMois])

  const retirer = useCallback(
    async (id: string) => {
      if (!parkId) {
        /* HORS SESSION — la démonstration n'écrit rien, et le geste se referme
           sans mentir sur ce qu'il a fait. */
        setARetirer(null)
        return
      }
      try {
        await api.deleteExpense(parkId, id)
        recharger()
      } catch (erreur) {
        if (!(erreur instanceof ApiError)) throw erreur
      } finally {
        setARetirer(null)
      }
    },
    [parkId, recharger],
  )

  const depensesMinor = depenses.reduce((somme, dep) => somme + dep.amountMinor, 0)

  /**
   * LES CHANTIERS, SERVIS PAR LE SERVEUR OU COMPTÉS SUR PLACE.
   *
   * ═══ POURQUOI LA DÉMONSTRATION LES COMPTE, AU LIEU D'AFFICHER ZÉRO ═══
   *
   * Un `0` figé était plus simple, et FAUX : la démonstration porte un chantier
   * achevé de 32 000. L'écran aurait donc affiché « Dont chantiers achevés : 0 »
   * sur le seul écran que les portes au navigateur mesurent — et rendu invisible
   * la chose même que ce lot construit : le total est PLUS GRAND que la somme de
   * la colonne. Un zéro affirmé se lit comme une absence, et c'est le défaut que
   * ce dépôt a déjà payé sur les montants de carte.
   *
   * ═══ SANS FILTRE DE DATE, ET ON L'AVOUE ═══
   *
   * Le modèle de démonstration du client ne porte pas de date d'achèvement :
   * `WorkOrder` n'a qu'un `reportedAt`. Le serveur, lui, compte par `completedOn`
   * dans l'intervalle demandé. Les deux chiffres ne se calculent donc pas de la
   * même façon, et c'est aussi la raison pour laquelle le sélecteur de mois ne
   * paraît PAS en démonstration — il ne pourrait pas déplacer ce nombre, et un
   * sélecteur qui ne change rien se lit comme une panne.
   */
  const chantiersMinor =
    chantiersServis ??
    works.reduce(
      (somme, chantier) =>
        chantier.status === 'done' && chantier.approvedAmount !== null
          ? somme + chantier.approvedAmount
          : somme,
      0,
    )
  const totalMinor = depensesMinor + chantiersMinor

  /** La portée d'une ligne, dite en mots : le parc, un immeuble, un logement. */
  const portee = (dep: DepenseApi): string => {
    if (dep.buildingId) return buildingById(dep.buildingId)?.name ?? dep.buildingId
    if (dep.unitId) return unitById(dep.unitId)?.label ?? dep.unitId
    return t('app.expenses.scopePark')
  }

  if (chargementDuParc) return <ExpensesSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.expenses.title')}
        description={t('app.expenses.subtitle')}
        actions={
          peutSaisir ? (
            <Button icon="plus" onClick={() => setSaisieOuverte(true)}>
              {t('app.expenses.add')}
            </Button>
          ) : undefined
        }
      />

      <NoteDePerimetre />

      <div className={GRILLE_TROIS_INDICATEURS}>
        <StatCard
          icone="card"
          label={t('app.expenses.totalOut')}
          value={money(totalMinor, { compact: true })}
        />
        <StatCard
          icone="file"
          label={t('app.expenses.fromExpenses')}
          value={money(depensesMinor, { compact: true })}
        />
        <StatCard
          icone="wrench"
          label={t('app.expenses.fromWorks')}
          value={money(chantiersMinor, { compact: true })}
        />
      </div>

      {/* INCONDITIONNELLE, et c'est le point : la règle vaut même un mois sans
          chantier, et c'est ce mois-là qu'on croirait le tableau complet. Le ton
          est `neutral` — rien n'est en défaut, on explique une comptabilité. */}
      <Notice tone="neutral" titre={t('app.expenses.worksApart')} className="mt-6 mb-4">
        {t('app.expenses.worksApartHint')}
      </Notice>

      {/* VERROUILLÉ EN DÉMONSTRATION, comme le sélecteur du parc l'est déjà : la
          démonstration ne peut pas relire le serveur, et son total de chantiers
          ne se filtre par aucune date. Un sélecteur qui ne déplacerait rien se
          lirait comme une panne. */}
      {parkId && (
        <div className="mb-4 flex items-center gap-2">
          <div className="min-w-0 flex-1 sm:min-w-36 sm:flex-none">
            <MonthPicker
              aria-label={t('app.expenses.periodShown')}
              name="mois"
              value={mois}
              onChange={setMois}
            />
          </div>
        </div>
      )}

      {chargement ? (
        <SkeletonTable fiches />
      ) : (
        <DataTable<DepenseApi>
          caption={t('app.expenses.title')}
          rows={depenses}
          rowKey={(dep) => dep.id}
          fiches
          empty={
            <div className="py-14 text-center">
              <p className="title-m">{t('app.expenses.empty')}</p>
              <p className="text-body text-muted mt-2">{t('app.expenses.emptyHint')}</p>
            </div>
          }
          columns={[
            {
              key: 'label',
              header: t('app.expenses.label'),
              role: 'identite',
              render: (dep) => (
                <div className="min-w-0">
                  <span className="block truncate font-semibold" data-donnee>
                    {dep.label}
                  </span>
                  <span className="text-body-s text-muted">
                    {t(`app.expenses.category.${dep.category}` as 'app.expenses.category.tax')}
                  </span>
                </div>
              ),
            },
            {
              key: 'scope',
              header: t('app.expenses.scope'),
              role: 'contexte',
              hideOnMobile: true,
              render: (dep) => <span className="text-muted">{portee(dep)}</span>,
            },
            {
              key: 'incurredOn',
              header: t('app.expenses.incurredOn'),
              role: 'contexte',
              render: (dep) => d.dayMonth(partiesDeDateISO(dep.incurredOn)),
            },
            {
              key: 'paidOn',
              header: t('app.expenses.paidOn'),
              role: 'etat',
              /* PAS DE COULEUR SEULE : « Non réglée » est un MOT, pas une
                 teinte. Un point orange aurait demandé une légende, et
                 `couleur-non-seule` l'aurait refusé. */
              render: (dep) =>
                dep.paidOn ? (
                  d.dayMonth(partiesDeDateISO(dep.paidOn))
                ) : (
                  <span className="text-muted">{t('app.expenses.unpaid')}</span>
                ),
            },
            {
              key: 'amount',
              header: t('app.expenses.amount'),
              role: 'valeur',
              numeric: true,
              render: (dep) => money(dep.amountMinor),
              total: (lignes) =>
                lignes.length > 0
                  ? money(lignes.reduce((somme, dep) => somme + dep.amountMinor, 0))
                  : '—',
            },
            {
              key: 'gestes',
              header: '',
              role: 'geste',
              render: (dep) =>
                peutSaisir ? (
                  aRetirer === dep.id ? (
                    /* RETRAIT EN DEUX TEMPS SUR LA RANGÉE, jamais une modale
                       imbriquée : `Modal` ne s'imbrique pas proprement, et
                       `clavierDesModales` exige d'ouvrir, tenir, fermer et
                       RENDRE le focus à chaque niveau. */
                    <span className="flex items-center gap-2">
                      <span className="text-body-s">{t('app.expenses.confirmRemove')}</span>
                      <Button variant="danger" onClick={() => void retirer(dep.id)}>
                        {t('app.expenses.remove')}
                      </Button>
                      <Button variant="secondary" onClick={() => setARetirer(null)}>
                        {t('common.cancel')}
                      </Button>
                    </span>
                  ) : (
                    <MenuDeDebordement
                      libelle={t('app.expenses.editLine', { label: dep.label })}
                    >
                      <MenuElement icone="pencil" onClick={() => setLigneACorriger(dep)}>
                        {t('common.edit')}
                      </MenuElement>
                      <MenuElement icone="close" onClick={() => setARetirer(dep.id)}>
                        {t('app.expenses.remove')}
                      </MenuElement>
                    </MenuDeDebordement>
                  )
                ) : null,
            },
          ]}
        />
      )}

      {saisieOuverte && (
        <RecordExpenseModal
          onClose={() => setSaisieOuverte(false)}
          onEcrit={recharger}
        />
      )}
      {ligneACorriger && (
        <RecordExpenseModal
          aCorriger={ligneACorriger}
          onClose={() => setLigneACorriger(null)}
          onEcrit={recharger}
        />
      )}
    </>
  )
}

/**
 * ISOSTRUCTUREL À L'ÉCRAN CHARGÉ, et pas seulement « à peu près » : même
 * `PageHeader`, même grille de trois cartes, même tableau en fiches. Un
 * squelette qui différerait ferait remonter ou descendre le tableau à l'arrivée
 * des données — le défaut que `SkeletonStatRow` porte déjà en commentaire.
 */
function ExpensesSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.expenses.title')}
        description={t('app.expenses.subtitle')}
        actions={<Skeleton radius="md" className="h-11 w-44" />}
      />

      <SkeletonRegion>
        <SkeletonStatRow count={3} className={GRILLE_TROIS_INDICATEURS} />

        <div className="mt-6 mb-4 rounded-lg border border-divider px-4 py-3.5">
          <Skeleton line="body" className="w-56" />
          <Skeleton line="body" className="mt-0.5 w-72 max-w-full" />
        </div>

        <SkeletonTable fiches />
      </SkeletonRegion>
    </>
  )
}
