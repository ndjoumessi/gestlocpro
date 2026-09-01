import { useMemo, useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { JaugeDePoste, PaymentStatusPill, type PaymentStatus } from '@/components/primitives/StatusPill'
import { GroupeDeFiltres } from '@/components/controls/GroupeDeFiltres'
import { StatCard } from '@/components/primitives/Charts'
import { DeltaBadge } from '@/components/primitives/Badge'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import { variationDesEncaissements } from '@/data/kpis'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatRow,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { NoteDePerimetre } from './NoteDePerimetre'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Textarea } from '@/components/primitives/Input'
import { useToast } from '@/components/primitives/Toast'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import {
  imputation,
  receiptDue,
  type Receipt,
  type Unit,
} from '@/data/portfolio'
import { computeKpis } from '@/data/kpis'
import { usePortfolio } from '@/data/PortfolioProvider'
import { ReceiptModal } from './ReceiptModal'
import { RecordPaymentModal } from './RecordPaymentModal'
import { TenantScopeNote } from './TenantDashboard'

const FILTERS: (PaymentStatus | 'all')[] = ['all', 'paid', 'partial', 'overdue']

export function Payments() {
  const [quittanceDe, setQuittanceDe] = useState<string | null>(null)
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const { role } = useRole()
  const {
    units,
    isMine,
    readings,
    loading,
    remindRent,
    callRent,
    serveFormalNotice,
    receiptsForUnit,
    collections,
  } = usePortfolio()
  const { notify } = useToast()

  /**
   * LA PÉRIODE QU'ON PEUT VRAIMENT ATTESTER, pour ce logement.
   *
   * La plus RÉCENTE que porte son historique — donc le dernier mois facturé.
   * Repli sur le mois courant quand il n'en porte aucune : c'est alors au
   * serveur de refuser, ce qu'il fait en 404, et l'écran ne prétend pas savoir
   * mieux que lui.
   *
   * `receiptsForUnit` rend des mois indexés à zéro — la convention de
   * `lib/dates` —, et le contrat de la route veut « AAAA-MM-01 ». Le `+ 1` est
   * la frontière entre les deux, et il est ICI plutôt que dans la modale, qui
   * reçoit déjà une chaîne du serveur sur l'autre chemin.
   */
  const periodeAQuittancer = (unitId: string) => {
    const historique = receiptsForUnit(unitId)
    const derniere = historique.reduce<(typeof historique)[number] | null>(
      (plusRecente, r) =>
        !plusRecente || r.year > plusRecente.year || (r.year === plusRecente.year && r.month > plusRecente.month)
          ? r
          : plusRecente,
      null,
    )
    if (!derniere) return `${new Date().toISOString().slice(0, 7)}-01`
    return `${derniere.year}-${String(derniere.month + 1).padStart(2, '0')}-01`
  }

  const isTenant = role === 'tenant'
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all')
  const [payOpen, setPayOpen] = useState(false)
  const [relanceOuverte, setRelanceOuverte] = useState(false)
  const [enDemeure, setEnDemeure] = useState<Unit | null>(null)
  const [motif, setMotif] = useState('')
  const [motifErreur, setMotifErreur] = useState(false)
  const [enCours, setEnCours] = useState(false)

  // Le locataire ne voit que son bail. Le filtre est posé à la source du
  // tableau, pas sur l'affichage : ainsi les compteurs des onglets de statut et
  // les totaux se calculent eux aussi sur son seul périmètre.
  const leases = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.status !== 'vacant' && (role !== 'tenant' || isMine(unit.id)),
      ),
    [role, units, isMine],
  )
  const kpis = computeKpis(leases, readings)
  /**
   * AUCUN BAIL — donc rien à chiffrer, ni à filtrer.
   *
   * `Dashboard.tsx` énonce la règle depuis des lots : « l'état vide REMPLACE les
   * indicateurs, il ne s'y ajoute pas ; quatre cartes à zéro donnent
   * l'impression d'un produit cassé plutôt que d'un parc neuf ». Il l'applique
   * chez lui, et cet écran-ci ne l'appliquait pas.
   *
   * MESURÉ par `espace-connecte` sur son parc vide, à 320 px : « En retard
   * 0 FCFA · Payé 0 FCFA · Loyers attendus 0 FCFA » sur 300 px, puis quatre
   * onglets portant chacun un 0 sur 96, au-dessus d'une boîte annonçant « Aucun
   * paiement sur cette période ». Quatre cents pixels de zéros pour dire qu'il
   * n'y a rien — sur un téléphone, tout ce que voit un client le jour où il
   * ouvre son compte.
   *
   * C'est `leases` et non `units` : un parc de logements tous VACANTS n'a pas
   * davantage d'échéance à montrer qu'un parc sans logement, et les zéros y
   * seraient tout aussi muets.
   */
  const rienAEncaisser = leases.length === 0
  /* La variation du mois sur le mois précédent — la même règle que le tableau de
     bord, appelée au même endroit pour qu'elles ne puissent pas diverger. */
  const variation = variationDesEncaissements(kpis.collected, collections)

  /**
   * Les six dernières périodes CONNUES, toutes unités confondues.
   *
   * Six parce que c'est ce que la grille peut porter sans devenir illisible, et
   * les DERNIÈRES parce qu'un impayé de l'an dernier ne se règle plus par cet
   * écran. La liste est tirée des données et non de l'horloge : un parc dont
   * les échéances s'arrêtent en juin doit montrer juin, pas six colonnes vides
   * suivies d'un mois courant esseulé.
   */
  const periodes = useMemo(() => {
    const vues = new Map<string, { year: number; month: number }>()
    for (const unit of leases) {
      for (const r of receiptsForUnit(unit.id)) vues.set(`${r.year}-${r.month}`, r)
    }
    return [...vues.values()]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .slice(-6)
  }, [leases, receiptsForUnit])

  /**
   * Le solde CUMULÉ du bail : ce qui reste dû sur toutes ses périodes.
   *
   * La colonne montrait l'écart du mois courant. « Paul K. · 120 000 » ne
   * disait donc pas si la dette datait de ce mois-ci ou de deux ans, alors que
   * c'est la seule chose qui change la démarche à engager. Négatif quand le
   * locataire a payé d'avance — un cas que le mois seul ne pouvait pas exprimer.
   */
  const soldeCumule = (unit: Unit) =>
    receiptsForUnit(unit.id).reduce((somme, r) => somme + receiptDue(r) - r.paidMinor, 0)

  /**
   * Les baux à relancer, tels que L'ÉCRAN les voit.
   *
   * Le serveur revérifie chacun et reste l'autorité — il refusera un locataire
   * à jour, une échéance non exigible, un bail déjà relancé ce matin. Ce calcul
   * ne sert qu'à savoir s'il y a lieu de proposer le geste, et à en annoncer la
   * portée avant de le déclencher.
   *
   * Le retard, et non le statut : un bail « partiel » qui a réglé avant
   * l'échéance n'est pas en retard, et le proposer à la relance reviendrait à
   * offrir une accusation que le serveur refusera.
   */
  const retards = useMemo(
    () => leases.filter((unit) => (unit.overdueDays ?? 0) > 0),
    [leases],
  )

  const rows = useMemo(
    () => (filter === 'all' ? leases : leases.filter((unit) => unit.status === filter)),
    [leases, filter],
  )

  /**
   * Après les crochets, avant le premier affichage de `leases`.
   *
   * C'est l'écran des impayés : pendant l'attente, il additionnait les loyers
   * attendus, encaissés et en retard d'un parc de démonstration, puis nommait
   * dix locataires qui ne sont pas ceux du bailleur. Trois montants faux
   * énoncés comme des faits coûtent plus cher qu'ailleurs — c'est sur eux qu'on
   * décide d'appeler quelqu'un.
   */
  if (loading) return <PaymentsSkeleton isTenant={isTenant} />


  /*
    LES DEUX GESTES DE FIN DE MOIS, SORTIS DE LEUR BOUTON.

    Ils vivaient en `onClick` dans la rangée d'actions ; ils vivent maintenant
    derrière les trois points, et leur corps ne pouvait pas les suivre en ligne
    sans rendre le menu illisible. Les nommer ici les rend aussi lisibles depuis
    l'en-tête : « exporter le relevé », « appeler les loyers ».
  */
  const exporterLeReleve = () =>
    exportCsv({
        // Le filtre actif est dit par le nom du fichier : deux exports
        // successifs d'un même mois ne se recouvrent pas en silence.
        name:
          filter === 'all'
            ? t('app.files.payments')
            : [t('app.files.payments'), t(`status.${filter}` as 'status.paid')],
        headers: [
          t('app.portfolio.unit'),
          t('app.portfolio.tenant'),
          csvMoney.header(t('app.payments.due')),
          csvMoney.header(t('app.payments.paid')),
          csvMoney.header(t('app.payments.balanceTotal')),
          t('app.portfolio.status'),
          t('app.payments.lateDays'),
        ],
        rows: rows.map((unit) => [
          // Le libellé, pas l'identifiant technique : un fichier de
          // suivi qui listerait des uuid serait inexploitable.
          unit.label,
          unit.tenant ?? t('app.portfolio.noTenant'),
          csvMoney.amount(unit.rent),
          csvMoney.amount(unit.paid),
          /*
            LE MÊME SOLDE QUE LE TABLEAU, et non l'écart du mois.

            L'export écrivait `loyer − encaissé`, c'est-à-dire le mois
            COURANT, sous un en-tête qui disait « Solde » — pendant
            que la colonne à l'écran montre le solde CUMULÉ depuis le
            début du bail. Sur un locataire en retard de plusieurs
            mois, les deux chiffres divergent de tout l'arriéré, et
            c'est le fichier exporté qui sert à réclamer.

            Un export qui ne dit pas la même chose que l'écran dont il
            part est pire qu'une absence d'export : on l'a lu à
            l'écran, on le croit sur parole dans le tableur.
          */
          csvMoney.amount(
            periodes.length > 0 ? soldeCumule(unit) : unit.rent - unit.paid,
          ),
          t(`status.${unit.status}` as 'status.paid'),
          // Un nombre de jours n'est pas de l'argent, mais il se
          // calcule aussi : groupé, il deviendrait du texte.
          unit.overdueDays ?? null,
        ]),
      })

  const appelerLesLoyers = async () => {
    const maintenant = new Date()
    const mois = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-01`
    const emises = await callRent(mois)
    notify(
      emises > 0
        ? t('app.payments.rentCalled', { count: emises })
        : t('app.payments.rentAlreadyCalled'),
      { tone: emises > 0 ? 'ok' : 'neutral' },
    )
  }

  return (
    <>
      <PageHeader
        title={t('app.payments.title')}
        description={t('app.payments.subtitle')}
        actions={
          <>
            {/* DEUX COMMANDES SOUS LES YEUX, LE RESTE À UN GESTE.

                L'écran en portait quatre — mesuré par `PageHeader` lui-même :
                « 812 px de boutons dans 700 px de fenêtre ». À 360 px elles
                s'empilaient sur ~250 px, un tiers de la hauteur utile d'un
                téléphone avant le premier chiffre.

                Ce qui reste est ce qu'on fait tous les jours : relancer un
                retard, encaisser. L'export et l'appel des loyers sont des
                gestes de fin de mois — ils passent derrière les trois points,
                sans rien perdre. */}
            {!isTenant && retards.length > 0 && (
              <Button variant="secondary" icon="bell" onClick={() => setRelanceOuverte(true)}>
                {t('app.payments.remind')}
              </Button>
            )}
            {!isTenant && (
              <Button icon="plus" onClick={() => setPayOpen(true)}>
                {t('app.recordPayment')}
              </Button>
            )}
          </>
        }
        debordement={
          <MenuDeDebordement libelle={t('common.moreActions')}>
            <MenuElement icone="download" onClick={exporterLeReleve}>
              {t('app.exportStatement')}
            </MenuElement>
            {!isTenant && (
              <MenuElement icone="calendar" onClick={appelerLesLoyers}>
                {t('app.payments.callRent')}
              </MenuElement>
            )}
          </MenuDeDebordement>
        }
      />

      {/* LA NOTE DE PÉRIMÈTRE PRÉCÈDE LA RANGÉE : on lit le contexte avant les
          chiffres, jamais après. Hors du ternaire, parce qu'elle ne dépend ni du
          rôle ni de la présence de baux — un gestionnaire borné dont le
          périmètre est vide de loyers a d'autant plus besoin de savoir
          pourquoi. */}
      <NoteDePerimetre className="mb-4" />

      {isTenant ? (
        <TenantScopeNote className="mb-4" />
      ) : rienAEncaisser ? null : (
        <div className={GRILLE_TROIS_INDICATEURS}>
          {/*
            MÊME HIÉRARCHIE QUE LE TABLEAU DE BORD, et le décideur change parce
            que le geste change. Ici l'écran monte la relance et la mise en
            demeure : ce sur quoi on agit, c'est le RETARD. Le loyer attendu ne
            fait que le situer.

            `encaissé` garde son gabarit plein pour la même raison qu'ailleurs :
            retard et encaissé se lisent ensemble, replier l'un forcerait à
            chercher l'autre.
          */}
          <StatCard
            icone="clock"
            /**
             * LE MÊME ARGENT QUE SUR LE TABLEAU DE BORD, DONC LE MÊME POIDS.
             *
             * Cette carte était neutre et calme, quand la même somme est rouge et
             * pastillée deux écrans plus loin. L'état suivait l'ÉCRAN au lieu de
             * suivre le CONCEPT : un retard n'est pas moins un retard parce
             * qu'on le regarde depuis la page des paiements — c'est même la page
             * d'où l'on relance.
             *
             * SANS PASTILLE, et c'est la seule carte du produit où l'omission va
             * de soi : elle s'INTITULE « En retard ». La pastille du tableau de
             * bord existe parce que « Reste à percevoir » ne dit rien de
             * fâcheux ; ici l'intitulé EST le mot d'état, et le répéter à trois
             * centimètres n'apprendrait rien. La couleur n'est donc pas seule —
             * le texte qui la double est le titre lui-même.
             *
             * La condition est celle d'ailleurs : sur un parc sans retard, la
             * carte redevient l'une des trois.
             */
            etat={kpis.late > 0 ? { ton: 'danger' } : undefined}
            label={t('app.dashboard.recoveryLate')}
            value={money(kpis.late, { compact: true })}
          />
          {/* LA MÊME COMPARAISON QUE SUR LE TABLEAU DE BORD, et calculée au même
              endroit : les deux écrans affichent le MÊME nombre — `collected` —
              et une variation calculée deux fois pourrait diverger deux fois.
              Voir `variationDesEncaissements`. */}
          <StatCard
            icone="card"
            label={t('app.dashboard.recoveryCollected')}
            value={money(kpis.collected, { compact: true })}
            delta={variation ? <DeltaBadge value={variation.pourcentage} suffix="%" /> : undefined}
            note={
              variation
                ? t('app.dashboard.vsPrevious', { amount: money(variation.base, { compact: true }) })
                : undefined
            }
          />
          <StatCard
            icone="layers"
            label={t('app.dashboard.expected')}
            value={money(kpis.expected, { compact: true })}
          />
        </div>
      )}

      {/* LES ONGLETS PARTENT AVEC LES CHIFFRES, et pour la même raison :
          « Tous 0 · À jour 0 · Partiel 0 · En retard 0 » est une rangée de
          commandes dont aucune ne mène nulle part. Filtrer un vide en quatre
          façons n'est pas une fonction, c'est quatre-vingt-seize pixels. */}
      {rienAEncaisser ? null : (
      <GroupeDeFiltres
        libelle={t('app.portfolio.status')}
        valeur={filter}
        onChange={setFilter}
        className="mt-6 mb-4"
        options={FILTERS.map((value) => ({
          valeur: value,
          libelle:
            value === 'all' ? t('app.payments.filterAll') : t(`status.${value}` as 'status.paid'),
          compte:
            value === 'all' ? leases.length : leases.filter((u) => u.status === value).length,
        }))}
      />
      )}

      {/*
        LA LÉGENDE, et elle n'est pas décorative.

        Trois jauges dans une cellule ne disent rien à qui les voit pour la
        première fois — ni ce que chacune désigne, ni ce que son remplissage
        veut dire. Chaque cellule porte bien un nom accessible qui énonce les
        trois états en toutes lettres, mais un lecteur voyant n'y a pas accès :
        sans cette ligne, la grille se déchiffre au lieu de se lire.

        ELLE PORTE LA MÊME JAUGE QUE LES CELLULES, par le même composant. Une
        légende qui montrerait une autre forme que celle de la grille serait
        une clé qui n'ouvre pas — pire que pas de légende du tout, parce qu'on
        la croit.

        Elle ne s'affiche qu'avec la grille : sans période, il n'y a pas de
        pastille à expliquer.
      */}
      {periodes.length > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caps text-muted">
          <span>{t('app.payments.legendPosts')}</span>
          {(['paid', 'partial', 'overdue'] as const).map((etat) => (
            <span key={etat} className="flex items-center gap-1.5">
              <JaugeDePoste etat={etat} />
              {t(`app.payments.state.${etat}` as 'app.payments.state.paid')}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true">—</span>
            {t('app.payments.outOfLease')}
          </span>
        </p>
      )}

      <DataTable<Unit>
        caption={t('app.payments.title')}
        rows={rows}
        rowKey={(unit) => unit.id}
        fiches
        empty={
          <EmptyState
            icon="card"
            level={2}
            title={t('app.system.emptyTitle')}
            body={t('app.system.emptyBody')}
            action={
              <Button variant="secondary" onClick={() => setFilter('all')}>
                {t('app.payments.filterAll')}
              </Button>
            }
          />
        }
        columns={[
          {
            key: 'unit',
            role: 'identite',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            render: (unit) => <span className="numeric font-medium">{unit.label}</span>,
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            /**
             * Le LOYER sous le nom, et non dans sa propre colonne.
             *
             * Les colonnes de période ont pris la place de « dû » et « réglé ».
             * Le loyer mensuel reste pourtant la mesure à laquelle on rapporte
             * tout le reste : sans lui, « −258 000 » ne dit pas s'il s'agit de
             * deux mois ou de six. Il se lit donc là où il ne coûte pas de
             * colonne, exactement comme sur la maquette.
             */
            render: (unit) => (
              <div className="min-w-0">
                {/* `data-donnee` : un nom de locataire est saisi, sa longueur
                    n'est bornée par rien — la coupe est assumée, contrairement
                    au vocabulaire du produit. Voir `MESURER_TRONCATURES`. */}
                <p data-donnee className="truncate">
                  {unit.tenant}
                </p>
                <p className="numeric mt-0.5 text-caps text-muted">
                  {money(unit.rent, { compact: true })}
                </p>
              </div>
            ),
          },
          /**
           * UNE COLONNE PAR PÉRIODE, et trois postes dans chaque cellule.
           *
           * Le tableau ne montrait que le mois courant : « dû », « réglé »,
           * « solde ». On y lisait l'état d'un bail à un instant, jamais son
           * histoire — impossible de distinguer un retard de ce mois-ci d'une
           * dette qui court depuis six mois, ni de voir que l'eau est réglée
           * quand le loyer ne l'est pas.
           *
           * La donnée était déjà là : le serveur rend toutes les périodes de
           * tous les baux depuis que l'historique des quittances existe, et
           * l'espace du locataire affiche déjà cette grille pour son logement.
           * Seul l'écran du gestionnaire ne s'en servait pas.
           *
           * Les colonnes ne remplacent l'ancien trio QUE si des périodes
           * existent : sur un parc dont aucune échéance n'est enregistrée, une
           * grille de tirets se lirait comme une panne.
           */
          /*
            LE VERDICT ET LE SOLDE PASSENT DEVANT L'HISTOIRE, et c'est une
            décision de mise en page autant que de lecture.

            Ils vivaient à droite, après les six périodes — la place
            habituelle d'un statut dans un tableau. Mesuré : la table fait
            1063 px dans un conteneur de 958 à 1280 px de fenêtre. Tout ce qui
            est à droite des périodes tombe donc hors champ, et c'est
            précisément ce qu'on vient lire : combien, et où on en est.

            Rendre le geste COLLANT l'a ramené sous les yeux, mais il
            recouvrait alors la pastille — « À j… », « En… ». Le remède avait
            déplacé le défaut d'une colonne.

            Ce qui doit défiler, c'est L'HISTOIRE. Une suite de six mois est
            faite pour être parcourue ; un verdict et un solde sont faits pour
            être vus. L'ordre suit donc la question qu'on se pose : qui, où il
            en est, combien, puis depuis quand. Le geste reste au bord droit,
            collant, et ce sont les mois qui passent dessous.
          */
          {
            key: 'status',
            role: 'etat',
            /*
              LA COLONNE NOMME SA PORTÉE, et c'est le seul écran du produit où
              elle le doit. Ailleurs — le Parc, les locataires — « Statut » est
              sans ambiguïté : rien à côté ne parle d'une autre période. Ici la
              colonne voisine annonce le solde du BAIL ENTIER et la pastille
              celui du MOIS ; deux portées côte à côte, dont une seule était
              nommée, avec un rouge d'un côté et un vert de l'autre.

              Le Parc résout la même ambiguïté par une phrase de sous-titre —
              « Le statut porte sur le mois affiché ». L'en-tête vaut mieux : il
              reste sous les yeux quand on lit la vingtième ligne.
            */
            header: t('app.payments.statusMonth'),
            render: (unit) => (
              <div className="flex items-center gap-2">
                <PaymentStatusPill status={unit.status} size="sm" />
                {/* Le « j » d'abréviation restait français en anglais, et le
                    `&&` sur un nombre aurait affiché « 0 » plutôt que rien si
                    le retard tombait à zéro.
                    `whitespace-nowrap` : « +24 j » se coupait à l'espace et
                    s'empilait sur deux lignes à côté de la pastille, ce qui
                    décalait la hauteur de la ligne du tableau. Le retard est
                    une valeur unique, elle se lit d'un bloc. Le tableau défile
                    déjà dans sa propre boîte : la douzaine de pixels que cela
                    coûte ne se paie pas sur la page. */}
                {unit.overdueDays ? (
                  <span className="numeric text-caps whitespace-nowrap text-muted">
                    {t('app.payments.overdueDays', { days: unit.overdueDays })}
                  </span>
                ) : null}
                {/*
                  CE QUE LA PASTILLE VERTE NE DIT PAS.

                  Un bail dont le mois courant est réglé mais qui traîne un
                  reliquat d'une période antérieure affichait « −5 058 FCFA » en
                  rouge d'alerte et « À jour » en vert de succès, sur la même
                  ligne, sans un mot. Les deux sont exacts et ne répondent pas à
                  la même question ; le lecteur, lui, en conclut que l'un des
                  deux se trompe.

                  La mention va où va déjà « +24 j » — le qualificatif de la
                  pastille — et pour la même raison : la pastille rend un verdict
                  sur le mois, ce mot dit ce qu'il faut savoir de plus pour le
                  lire juste. Un seul mot, comme son voisin : le montant est dans
                  la colonne d'à côté, et le répéter ici ferait deux fois le même
                  chiffre sur la même ligne.

                  UNIQUEMENT SUR LE VERT. Une pastille « Partiel » ou « En
                  retard » annonce déjà qu'il reste dû : y ajouter « reliquat »
                  serait la mention permanente que ce dépôt refuse partout
                  ailleurs. La contradiction n'existe que quand l'état dit
                  « rien à faire » et que le solde dit le contraire.
                */}
                {unit.status === 'paid' && soldeCumule(unit) > 0 ? (
                  <span className="text-caps whitespace-nowrap text-muted">
                    {t('app.payments.carried')}
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            key: 'balance',
            role: 'valeur',
            header: t('app.payments.balanceTotal'),
            numeric: true,
            render: (unit) => {
              // Cumulé quand l'historique existe, sinon l'écart du mois — la
              // seule chose que l'on sache alors.
              const balance = periodes.length > 0 ? soldeCumule(unit) : unit.rent - unit.paid
              if (balance === 0) return <span className="text-muted">{money(0, { compact: true })}</span>
              // Une AVANCE n'est pas une dette : elle se lit en clair, avec son
              // signe, et jamais en rouge.
              return (
                <span className={cn(balance > 0 ? 'font-medium text-danger' : 'text-ok')}>
                  {balance > 0 ? '−' : '+'}
                  {money(Math.abs(balance), { compact: true })}
                </span>
              )
            },
          },
          ...(periodes.length > 0
            ? periodes.map((periode) => ({
                key: `p-${periode.year}-${periode.month}`,
                role: 'serie' as const,
                header: d.monthShort(periode),
                hideOnMobile: true,
                render: (unit: Unit) => (
                  <CellulePeriode
                    receipt={receiptsForUnit(unit.id).find(
                      (r) => r.year === periode.year && r.month === periode.month,
                    )}
                    periode={d.monthYear(periode)}
                  />
                ),
              }))
            : [
                {
                  key: 'due',
                  header: t('app.payments.due'),
                  numeric: true,
                  hideOnMobile: true,
                  render: (unit: Unit) => money(unit.rent, { compact: true }),
                },
                {
                  key: 'paid',
                  header: t('app.payments.paid'),
                  numeric: true,
                  render: (unit: Unit) => money(unit.paid, { compact: true }),
                },
              ]),
          {
            key: 'receipt',
            role: 'geste',
            header: '',
            render: (unit) =>
              // Offert seulement s'il y a quelque chose à attester : sur un
              // logement vacant, le bouton n'aurait aucun sens.
              unit.tenant ? (
                /* `flex-wrap` : deux gestes sur une ligne de fiche, et à 320 px
                   ils ne tiennent pas côte à côte — mesuré, 28 px de
                   débordement LOCAL, celui qui sort de la carte sans faire
                   défiler la page. Sans repli, le groupe impose sa largeur de
                   contenu à une carte qui, elle, ne peut pas s'élargir.

                   Le défaut préexistait en français et se cachait derrière un
                   libellé anglais plus long, qui le rendait plus visible : ce
                   lot n'a fait que le sortir en offrant le geste sur toutes les
                   lignes en retard. */
                <div className="flex flex-wrap justify-end gap-1">
                  {/* Droit du seul PROPRIÉTAIRE, comme la validation d'un devis
                      et l'arbitrage d'une caution : le gestionnaire propose, il
                      ne décide pas. Le serveur le refuse aussi — ce masquage
                      évite d'offrir un geste voué au refus, il ne le remplace
                      pas.

                      LE GESTE S'OFFRE AUSSI EN DÉMONSTRATION. `leaseId`
                      conditionnait l'affichage, et le motif tenait : sans parc
                      serveur la confirmation ne faisait rien. Le fournisseur
                      nomme désormais cette issue — voir `serveFormalNotice` —
                      donc la boîte peut s'ouvrir et RÉPONDRE. Le bail est
                      désigné comme dans la relance en masse, quelques lignes
                      plus bas : son identifiant serveur s'il existe, celui de
                      l'unité sinon. */}
                  {role === 'owner' && (unit.overdueDays ?? 0) > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="shield"
                      onClick={() => {
                        setEnDemeure(unit)
                        setMotif('')
                        setMotifErreur(false)
                      }}
                    >
                      {t('app.payments.notice')}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="download"
                    onClick={() => setQuittanceDe(unit.id)}
                  >
                    {t('app.receipts.issue')}
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />

      {/*
        ON NE QUITTANCE PAS UN MOIS QU'ON N'A PAS FACTURÉ.

        Cette ligne disait « la période est le mois courant : c'est celle qu'on
        quittance dans la quasi-totalité des cas », et prenait `new Date()`.
        C'était vrai le 20 du mois, faux le 1er : la période courante n'a pas
        encore d'échéance, et une quittance atteste d'un versement qui n'existe
        pas.

        LE SERVEUR LE DIT DÉJÀ, et bien : « Aucune échéance pour cette période :
        il n'y a rien à attester. On ne fabrique pas un document vide, qui
        laisserait croire à un mois traité. » Il rend 404. La démonstration, elle,
        n'a pas de serveur : la modale s'ouvrait sur un document VIDE.

        MESURÉ, et par accident : le 1er septembre 2026 à 00 h 00, quatorze cas
        de `check:rapide` sont devenus rouges sans qu'une ligne de code ait
        bougé. Les quittances du jeu de démonstration s'arrêtent en août, et
        l'écran demandait septembre. La donnée figée dans le temps a rencontré
        une horloge qui, elle, avance.

        LA PÉRIODE EST DONC LA PLUS RÉCENTE QUE CE LOGEMENT PORTE. C'est juste
        dans les deux mondes : sur un parc réel, c'est le dernier mois facturé —
        celui qu'on quittance en pratique —, et le repli sur le mois courant ne
        sert qu'au logement sans aucune échéance, où le serveur refusera comme
        il doit.
      */}
      {quittanceDe && (
        <ReceiptModal
          open
          unitId={quittanceDe}
          periodStart={periodeAQuittancer(quittanceDe)}
          onClose={() => setQuittanceDe(null)}
        />
      )}

      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} />

      {/*
        La confirmation dit COMBIEN, avant d'agir.
        Le geste part vers plusieurs personnes à la fois : « relancer » sans
        compte laisserait découvrir la portée après coup.
      */}
      <Modal
        open={relanceOuverte}
        onClose={() => setRelanceOuverte(false)}
        role="alertdialog"
        size="sm"
        title={t('app.payments.remindTitle', { count: retards.length })}
        description={t('app.payments.remindBody')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRelanceOuverte(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={enCours}
              onClick={async () => {
                setEnCours(true)
                const bilan = await remindRent(
                  // `leaseId` quand il existe, `id` en démonstration : c'est le
                  // fournisseur qui court-circuite là-bas, faute de parc serveur.
                  retards.map((unit) => unit.leaseId ?? unit.id),
                )
                setEnCours(false)
                setRelanceOuverte(false)
                /**
                 * Le message dit ce qui A EU LIEU, pas ce qui a été demandé.
                 *
                 * Le serveur écarte les baux déjà relancés le matin même, et
                 * annoncer « 3 relances » quand une seule est partie serait
                 * exactement le défaut que ce chantier corrige.
                 */
                if (bilan.sent === 0) {
                  notify(t('app.payments.remindNothing'), { tone: 'neutral' })
                  return
                }
                const parti = t('app.payments.remindDone', { count: bilan.sent })
                notify(
                  bilan.skipped > 0
                    ? `${parti} · ${t('app.payments.remindSkipped', { count: bilan.skipped })}`
                    : parti,
                  { tone: 'ok' },
                )
              }}
            >
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-body text-muted">
          {retards.map((unit) => unit.tenant).filter(Boolean).join(' · ')}
        </p>
      </Modal>

      {enDemeure && (
        <Modal
          open
          onClose={() => setEnDemeure(null)}
          role="alertdialog"
          size="sm"
          title={t('app.payments.noticeTitle', { tenant: enDemeure.tenant ?? '' })}
          description={t('app.payments.noticeBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEnDemeure(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={enCours}
                onClick={async () => {
                  // La même borne que le serveur, pour que le refus arrive avant
                  // l'aller-retour plutôt qu'après.
                  if (motif.trim().length < 10) {
                    setMotifErreur(true)
                    return
                  }
                  setEnCours(true)
                  const issue = await serveFormalNotice(
                    enDemeure.leaseId ?? enDemeure.id,
                    motif.trim(),
                  )
                  setEnCours(false)
                  if (issue === 'echec') return
                  setEnDemeure(null)
                  /* LA PHRASE SUIT CE QUI A EU LIEU. « Enregistrée au dossier
                     du bail » serait faux en démonstration, où aucun dossier
                     n'existe : on y dit ce qu'on ne fait pas, du ton neutre
                     réservé à ce qui n'est ni un succès ni un échec. */
                  notify(
                    t(
                      issue === 'demonstration'
                        ? 'app.payments.noticeDemo'
                        : 'app.payments.noticeDone',
                    ),
                    { tone: issue === 'demonstration' ? 'neutral' : 'ok' },
                  )
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          <Field
            label={t('app.payments.noticeReason')}
            hint={t('app.payments.noticeReasonHint')}
            required
            {...(motifErreur ? { error: t('app.payments.noticeReasonError') } : {})}
          >
            {(champ) => (
              <Textarea
                {...champ}
                value={motif}
                invalid={motifErreur}
                onChange={(e) => {
                  setMotif(e.target.value)
                  setMotifErreur(false)
                }}
              />
            )}
          </Field>
        </Modal>
      )}
    </>
  )
}

/**
 * Les paiements, le temps que le parc arrive.
 *
 * Titre et sous-titre sont écrits en dur : ils restent. Les deux actions sont
 * retenues, et pour des raisons différentes — l'export sortirait un fichier
 * d'impayés de démonstration que rien, dans le tableur, ne signalerait comme
 * faux ; l'enregistrement d'un paiement l'imputerait à un bail qui n'existe pas
 * chez ce bailleur.
 *
 * Le locataire n'a qu'un bouton et pas d'indicateurs : sa page est composée
 * autrement, et un squelette qui montrerait trois cartes lui promettrait une
 * mise en page qui ne viendra pas.
 */
function PaymentsSkeleton({ isTenant }: { isTenant: boolean }) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.payments.title')}
        description={t('app.payments.subtitle')}
        actions={
          <>
            <Skeleton radius="md" className="h-11 w-44" />
            {!isTenant && <Skeleton radius="md" className="h-11 w-52" />}
          </>
        }
      />

      <SkeletonRegion>
        {isTenant ? (
          // La hauteur du bandeau de périmètre : une pastille dans une boîte
          // `py-2.5`. Il nomme les unités du locataire, qu'on ne connaît pas
          // encore.
          <Skeleton radius="md" className="mb-4 h-11 w-full max-w-lg" />
        ) : (
          <SkeletonStatRow count={3} className={GRILLE_TROIS_INDICATEURS} />
        )}

        {/* Quatre filtres, exactement comme `FILTERS` : leur nombre ne dépend
            d'aucune donnée, seuls leurs compteurs en dépendent. */}
        <div className="mt-6 mb-4 flex flex-wrap gap-2">
          {FILTERS.map((valeur) => (
            <Skeleton key={valeur} radius="md" className="h-11 w-28" />
          ))}
        </div>

        <SkeletonTable />
      </SkeletonRegion>
    </>
  )
}

/**
 * L'état d'une période, poste par poste.
 *
 * Trois pastilles — loyer, eau, électricité — et non un seul statut : c'est
 * précisément la distinction que l'écran ne savait pas faire. Un locataire qui
 * règle son loyer et laisse courir l'électricité n'est pas « en retard » au même
 * titre que celui qui n'a rien versé, et la démarche à engager n'est pas la
 * même.
 *
 * La couleur ne porte pas l'information toute seule : chaque cellule a un nom
 * accessible qui énonce les trois états en toutes lettres. Une grille de
 * pastilles vertes et rouges est illisible pour qui ne distingue pas les deux,
 * et c'est la règle que le dépôt applique déjà à l'entrée de navigation
 * courante.
 *
 * Ce nom tient au `role="img"` porté par chacune des deux cellules, et non au
 * seul `aria-label`. ARIA 1.2 INTERDIT de nommer le rôle `generic` — celui
 * qu'une balise sans rôle, ici un `<span>`, porte implicitement : un navigateur
 * conforme jette l'étiquette, et la cellule se lit vide puisque ses pastilles
 * sont `aria-hidden`. L'intention était juste, le mécanisme ne délivrait rien
 * et toute l'information restait dans la couleur. `img` est le rôle qui
 * convient : il accepte d'être nommé, et il rend son contenu présentationnel —
 * ce que ces glyphes sont déjà.
 *
 * La garde interroge donc `getByRole`, jamais `getByLabelText` : celui-ci lit
 * l'attribut sans passer par le calcul du nom accessible, et réussissait sur
 * une cellule que le navigateur laissait muette.
 */
function CellulePeriode({ receipt, periode }: { receipt?: Receipt; periode: string }) {
  const t = useT()

  // Hors bail : la période est antérieure à l'entrée, ou postérieure à la
  // sortie. Un tiret le dit ; une pastille grise se lirait comme un impayé.
  if (!receipt) {
    return (
      <span
        role="img"
        className="text-muted"
        aria-label={`${periode} · ${t('app.payments.outOfLease')}`}
      >
        —
      </span>
    )
  }

  const regle = imputation(receipt)
  /**
   * Les postes nommés EN TOUTES LETTRES.
   *
   * Première rédaction : les intitulés de colonne du tableau du locataire, où
   * l'électricité s'abrège en « Élec. » faute de largeur. Ici il ne s'agit pas
   * d'une en-tête mais d'un nom accessible — la seule chose qu'un lecteur
   * d'écran prononce de cette cellule. Une abréviation y est un mot de moins,
   * pas une colonne de gagnée.
   */
  const postes = [
    { cle: 'app.tenant.colRent', du: receipt.rentMinor, paye: regle.rent },
    { cle: 'app.tenant.water', du: receipt.waterMinor, paye: regle.water },
    { cle: 'app.tenant.power', du: receipt.powerMinor, paye: regle.power },
  ] as const

  const etat = (du: number, paye: number) =>
    du === 0 || paye >= du ? 'paid' : paye > 0 ? 'partial' : 'overdue'


  return (
    <span
      role="img"
      className="flex items-center gap-1"
      aria-label={`${periode} · ${postes
        .map(
          (p) =>
            `${t(p.cle as 'app.tenant.colRent')} ${t(
              `app.payments.state.${etat(p.du, p.paye)}` as 'app.payments.state.paid',
            )}`,
        )
        .join(', ')}`}
    >
      {postes.map((p) => (
        <JaugeDePoste key={p.cle} etat={etat(p.du, p.paye)} />
      ))}
    </span>
  )
}
