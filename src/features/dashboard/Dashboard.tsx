import { useState } from 'react'
import { lien, useBase } from '@/lib/base'
import { cn } from '@/lib/cn'
import { Link, Navigate } from 'react-router-dom'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { StatusPill } from '@/components/primitives/StatusPill'
import { DeltaBadge } from '@/components/primitives/Badge'
import { DonutChart, ProgressBar, StackedBarChart, StatCard } from '@/components/primitives/Charts'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion, SkeletonStatRow } from '@/components/primitives/Skeleton'
import { GRILLE_QUATRE_INDICATEURS } from './grillesDIndicateurs'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import { computeKpis, variationDesEncaissements } from '@/data/kpis'
import { usePortfolio } from '@/data/PortfolioProvider'
import { RecordPaymentModal } from './RecordPaymentModal'
import { FileDuJour, type EntreeDeFile } from './FileDuJour'

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
  /* La variation du mois sur le mois précédent, quand il y en a un — voir
     `variationDesEncaissements`, qui rend `null` plutôt qu'un zéro trompeur. */
  const variation = variationDesEncaissements(collected, COLLECTIONS)
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

  /**
   * LA FILE DU JOUR, dérivée des mêmes données que les indicateurs.
   *
   * Rien n'est calculé ici qui ne l'était déjà : les retards, les cautions à
   * arbitrer et les devis vivaient dans la page, en quatrième position, sous
   * les chiffres. Ce qui change n'est pas la donnée, c'est ce que l'écran en
   * fait — et l'ordre dans lequel il le dit.
   *
   * LE CRITÈRE D'ADMISSION EST STRICT, sans quoi la file redevient une rangée
   * d'indicateurs sous un autre nom : une ligne n'entre que si elle nomme un
   * TRAVAIL qu'une personne peut finir, et disparaît quand il l'est. Le taux
   * d'occupation n'y a donc pas sa place ; les relevés manquants oui, parce
   * qu'ils bloquent la facturation du mois et qu'on peut aller les saisir.
   *
   * L'ORDRE EST CELUI DU COÛT DE L'ATTENTE, pas celui du calcul : l'argent dû
   * vieillit, un arbitrage laisse quelqu'un en suspens, une saisie manquante
   * bloque une facture. `filter(Boolean)` en fin : une entrée absente n'est pas
   * une ligne vide, elle n'existe pas.
   */
  const relevesManquants = readings.filter(
    (r) => r.waterCurrent === null || r.powerCurrent === null,
  )
  const cautionsEnAttente = cautionsAArbitrer.reduce((somme, c) => somme + c.held, 0)
  const devisEnAttente = devis.reduce((somme, w) => somme + (w.quotedAmount ?? 0), 0)

  const file: EntreeDeFile[] = [
    doivent.length > 0 && {
      cle: 'impayes',
      urgence: 'danger' as const,
      icone: 'clock' as const,
      titre: t('app.dashboard.queueOverdueTitle', { count: doivent.length }),
      detail: t('app.dashboard.queueOverdueDetail', {
        amount: money(outstanding, { compact: true }),
        days: maxOverdueDays,
      }),
      action: { libelle: t('app.dashboard.queueOverdueAction'), to: lien(base, 'paiements') },
    },
    cautionsAArbitrer.length > 0 && {
      cle: 'cautions',
      urgence: 'accent' as const,
      icone: 'shield' as const,
      titre: t('app.dashboard.queueDepositsTitle', { count: cautionsAArbitrer.length }),
      detail: t('app.dashboard.queueDepositsDetail', {
        amount: money(cautionsEnAttente, { compact: true }),
        units: cautionsAArbitrer
          .map((c) => unitById(c.unitId)?.label ?? c.unitId)
          .join(', '),
      }),
      action: { libelle: t('app.dashboard.queueDepositsAction'), to: lien(base, 'cautions') },
    },
    devis.length > 0 && {
      cle: 'devis',
      urgence: 'accent' as const,
      icone: 'wrench' as const,
      titre: t('app.dashboard.queueQuotesTitle', { count: devis.length }),
      detail: t('app.dashboard.queueQuotesDetail', {
        amount: money(devisEnAttente, { compact: true }),
        units: devis.map((w) => unitById(w.unitId)?.label ?? w.unitId).join(', '),
      }),
      action: { libelle: t('app.dashboard.queueQuotesAction'), to: lien(base, 'travaux') },
    },
    relevesManquants.length > 0 && {
      cle: 'releves',
      urgence: 'warn' as const,
      icone: 'gauge' as const,
      titre: t('app.dashboard.queueReadingsTitle', { count: relevesManquants.length }),
      detail: t('app.dashboard.queueReadingsDetail', {
        units: relevesManquants
          .map((r) => unitById(r.unitId)?.label ?? r.unitId)
          .join(', '),
      }),
      action: { libelle: t('app.dashboard.queueReadingsAction'), to: lien(base, 'releves') },
    },
  ].filter(Boolean) as EntreeDeFile[]

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
      {/*
        ═══ LA FILE D'ABORD, LES CHIFFRES ENSUITE ═══

        C'est l'inversion qui fait ce lot, et elle ne se mesure pas — aucune
        porte de ce dépôt ne sait dire qu'un écran répond à la bonne question.
        Elle s'argumente, donc, et voici l'argument.

        L'écran ouvrait sur quatre indicateurs et un graphe de douze mois : il
        répondait à « où en est le parc ». Celui qui l'ouvre le matin demande
        « qu'est-ce que je dois traiter ». Les deux réponses y étaient déjà, mais
        la seconde arrivait en QUATRIÈME position, sous les chiffres et sous le
        graphe, coupée en deux cartes qui ne se savaient pas parentes — « ce qui
        demande une décision » et « échéances du mois ».

        Ce que l'inversion COÛTE, et il faut le dire : sur un parc bien tenu la
        file est vide, et l'écran ouvre alors sur un état vide. C'est assumé —
        c'est le seul endroit du produit où le vide est une bonne nouvelle, et il
        est écrit comme telle plutôt que laissé en zone blanche.

        LES INDICATEURS NE DISPARAISSENT PAS et ne rétrécissent pas. Un reste à
        percevoir sans le loyer attendu ni le taux d'occupation ne se lit pas :
        ils SITUENT la file, et c'est très exactement leur place — après elle.
      */}
      <FileDuJour entrees={file} />

      {/*
        TROIS NIVEAUX DE LECTURE, ET L'ORDRE EN FAIT PARTIE.

        Les quatre cartes étaient égales — même taille, même graisse, même
        gabarit — et rangées dans l'ordre du calcul : attendu, encaissé, reste,
        occupation. Le rôle qui lit cet écran ARBITRE : ce sur quoi il agit,
        c'est le RESTE À PERCEVOIR, dont la note porte le nombre de locataires
        en retard et l'ancienneté du plus vieil impayé. C'est aussi la seule
        des quatre qui mène à la seule action de l'écran, `RecordPaymentModal`.
        Les trois autres la SITUENT : sans le loyer attendu et le taux
        d'occupation, un reste à percevoir ne se lit pas.

        VÉRIFIÉ AVANT DE RÉORDONNER : aucune des quatre n'est l'entrée d'un
        parcours. `StatCard` n'accepte ni `onClick` ni `to` ; leur seule
        commande possible est `action`, qu'aucune des quatre ne passe. Le
        risque « je déplace l'entrée principale sans le savoir » n'existe pas
        sur cet écran.

        `encaissé` reste en second et garde le gabarit plein : c'est le
        complément immédiat du reste à percevoir — les deux se lisent
        ensemble, et replier l'un des deux forcerait à chercher l'autre.
      */}
      <div className={cn(GRILLE_QUATRE_INDICATEURS, 'mt-4')}>
        <StatCard
          /* UN VOCABULAIRE D'ICÔNES, PAS QUATRE DÉCORATIONS. Ce qui est encore
             dû se marque d'une HORLOGE ici comme sur l'écran des paiements ;
             l'encaissé d'une CARTE, l'attendu d'un EMPILEMENT de baux, un taux
             d'un CADRAN. Le même concept prend le même glyphe d'un écran à
             l'autre — sans quoi l'icône n'aide plus à retrouver, elle décore. */
          icone="clock"
          label={t('app.dashboard.outstanding')}
          value={money(outstanding, { compact: true })}
          /**
           * L'ÉTAT A ÉTÉ RETIRÉ D'ICI, ET C'EST LA FILE QUI L'A REPRIS.
           *
           * Cette carte portait `etat={doivent.length > 0 ? danger : undefined}`
           * — une pastille rouge et une bordure rouge, conditionnées à ce qui
           * les justifie. C'était juste tant que rien d'autre ne portait
           * l'urgence sur cet écran.
           *
           * LA FILE LA PORTE DÉSORMAIS, sous la MÊME condition : sa première
           * entrée s'allume sur `doivent.length > 0`, exactement. Les deux ne
           * pouvaient donc pas diverger — elles s'allumaient et s'éteignaient
           * ensemble, à deux cents pixels d'écart, pour dire le même fait avec
           * le même chiffre. Deux rouges pour une chose, c'est précisément la
           * « seconde lecture du rouge » que le commentaire retiré interdisait
           * lui-même.
           *
           * CE QUI EST GARDÉ N'EST PAS PERDU : la conditionnalité — l'alerte qui
           * s'allume sur la donnée qui la justifie et s'éteint quand le travail
           * est fait — est la propriété qui comptait, et `indicateurEnEtat`
           * l'observe maintenant sur la file. La carte redevient ce qu'elle est
           * ici : un nombre qui SITUE la file, pas qui la double.
           */
          /**
           * LA NOTE SITUE, ELLE NE RÉPÈTE PLUS.
           *
           * Elle disait « 4 locataires · jusqu'à 24 jours de retard » —
           * c'est-à-dire, mot pour mot, le détail de la première entrée de la
           * file, deux cents pixels plus haut. Une rangée d'indicateurs qui
           * recopie la file ne la situe pas, elle la double.
           *
           * La part manquante, elle, dit quelque chose que la file ne dit pas
           * et RÉCONCILIE la carte avec sa voisine : « encaissé 68 % » et
           * « reste 32 % » se lisent ensemble et font le loyer attendu de la
           * troisième. C'est ce que les quatre nombres de cette rangée sont
           * censés faire, et ce que `screens.test.tsx` garde par ailleurs.
           */
          note={t('app.dashboard.outstandingShare', { percent: 100 - collectedShare })}
        />
        {/*
          LA SEULE CARTE DU PRODUIT QUI AIT UN PASSÉ, ET ELLE LE MONTRE.

          Trois pièces existaient sans s'être jamais rencontrées : `DeltaBadge`,
          une pastille de variation soignée qu'aucun écran n'appelait ;
          `StatCard.delta`, une propriété déclarée pour l'accueillir et passée
          nulle part dans le dépôt ; et douze mois d'encaissements, déjà en main
          de cet écran, qui ne servaient qu'au graphique et à l'export.

          Un nombre sans échelle ne se lit pas : 950 000 F encaissés, est-ce
          beaucoup ? La réponse était dans la page, trois cents pixels plus bas,
          dans le tracé — jamais à côté du chiffre qui la pose.

          `invert` N'EST PAS POSÉ ICI, et c'est un choix : une hausse de
          l'encaissé est une bonne nouvelle. Il le serait sur le retard, et c'est
          exactement pour ce cas que la pastille l'offre — une flèche vers le
          haut n'est pas verte par nature.

          LA PART DU DÛ CÈDE LA PLACE. Elle disait « 68 % du dû », que l'anneau
          de recouvrement de la même page annonce déjà en grand, au centre. La
          comparaison au mois précédent, elle, ne se lit nulle part ailleurs.
        */}
        <StatCard
          icone="card"
          label={t('app.dashboard.collected')}
          value={money(collected, { compact: true })}
          delta={variation ? <DeltaBadge value={variation.pourcentage} suffix="%" /> : undefined}
          note={
            variation
              ? t('app.dashboard.vsPrevious', {
                  amount: money(variation.base, { compact: true }),
                })
              : t('app.dashboard.collectedShare', { percent: collectedShare })
          }
        />
        <StatCard
          icone="layers"
          label={t('app.dashboard.expected')}
          value={money(expected, { compact: true })}
          note={t('app.dashboard.activeLeases', { count: occupied })}
        />
        <StatCard
          /* `gauge` et non `building` : ce qu'on lit ici est un TAUX, pas un
             immeuble. Le glyphe de l'immeuble reste à l'écran Parc, où chaque
             carte en désigne un vrai. */
          icone="gauge"
          label={t('app.dashboard.occupancy')}
          value={`${occupancy}`}
          unit="%"
          note={t('app.dashboard.vacantUnits', { count: vacant })}
        />
      </div>

      {/*
        `items-start` : CETTE RANGÉE-CI CESSE D'IMPOSER UNE HAUTEUR COMMUNE.

        Par défaut une cellule de grille s'étire à la hauteur de la plus haute de
        sa rangée. Entre cartes DE MÊME NATURE c'est ce qu'on veut — la rangée
        d'indicateurs juste au-dessus garde délibérément l'étirement, et ses
        31 px de blanc mesurés sur trois cartes sont le prix de leur ALIGNEMENT,
        pas du gâchis : quatre pairs dont les socles ne se rejoignent pas ne se
        lisent plus comme une rangée.

        Ici les deux cellules n'ont rien de commun : à gauche un graphe de douze
        mois, à droite une colonne de deux cartes. Rien ne relie leurs socles, et
        l'étirement se contentait de faire payer à la plus courte la hauteur de
        l'autre — 73 px de blanc imposé à la carte du graphe, une fois retiré son
        propre rembourrage de 21. Une carte finit où son contenu finit.

        MESURÉ, ET C'EST LE MÊME VIDE DEPUIS LE DÉBUT : il valait 246 px et
        vivait à droite ; le lot précédent l'a ramené à 94 en y logeant les
        décisions, celui-ci retire les 73 qui restaient imposés.
      */}
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
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
            /* L'eau et l'électricité descendent dans le second tracé : ce sont
               des avances RÉCUPÉRÉES, pas un revenu. Empilées sous le loyer,
               elles rendaient 9 px contre 171 — voir la prop dans `Charts`. */
            secondaires={['water', 'power']}
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
          <p className="mt-4 border-t border-divider pt-4 text-body text-muted">
            {t('app.dashboard.chartNote')}
          </p>
        </Card>

        {/*
          LA COLONNE DE DROITE PORTE DEUX CARTES, ET C’EST CE QUI FERME UN VIDE.

          MESURÉ avant de déplacer quoi que ce soit : la grille étire ses deux
          cellules à la hauteur de la plus haute, et le graphe des douze mois en
          fait 627 px. Le recouvrement en remplissait 381 — les 246 restants
          étaient du blanc que rien ne justifiait, 39 % de la carte, à 1512 comme
          à 1920 px. On ne comble pas un vide en inventant du contenu : on y met
          ce qui était mal placé ailleurs.

          ET C’EST « CE QUI DEMANDE UNE DÉCISION » QUI ÉTAIT MAL PLACÉ. C’est la
          seule carte de l’écran qui appelle un GESTE — arbitrer une caution,
          trancher un devis — et elle vivait en troisième rangée, sous la ligne
          de flottaison d’un écran de 900 px : il fallait faire défiler pour
          apprendre qu’on attendait quelque chose de vous. Les deux cartes qui la
          suivaient — l’échéancier et la répartition — ne demandent rien, elles
          renseignent ; elles peuvent rester sous le pli, pas elle.

          ELLE SUIT LE RECOUVREMENT, ET PAS L’INVERSE. Le recouvrement dit
          l’état du mois, les décisions disent ce qu’il reste à en faire :
          constater précède arbitrer. Sous `xl`, la grille repasse à une colonne
          et cet ordre devient l’ordre de lecture — graphe, recouvrement,
          décisions, échéancier, répartition — qui reste le bon.
        */}
        {/* `min-w-0` : ce conteneur est une CELLULE de grille, et une cellule
            hérite de `min-width: auto` — elle refuse donc de descendre sous la
            largeur intrinsèque de ce qu'elle porte. `Card` se protège déjà de
            cette façon, mais elle n'est plus la cellule : c'est cette colonne
            qui l'est. La porte l'a mesuré avant moi — 7 px de débordement local
            à /demo@320, exactement le défaut que le commentaire de `Card` décrit. */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title={t('app.dashboard.recoveryTitle')} level={2} />
            <DonutChart
              caption={t('app.dashboard.recoveryTableCaption')}
              centerValue={`${collectedShare} %`}
              centerLabel={t('app.dashboard.recoveryCollected')}
              /* L'ÉTAT, ET NON LA COULEUR. La teinte et la forme d'une part
                 découlent toutes deux de `etat`, par une seule table dans
                 `Charts`. Cet écran ne peut donc plus les désaccorder — c'est le
                 même geste que la grille des paiements et sa légende, qui
                 appellent le même composant plutôt que de s'accorder à vue.
                 « en retard » se dit `overdue` ici comme partout ailleurs dans le
                 produit : un second mot pour le même état rouvrait la porte à
                 deux vocabulaires. */
              slices={[
                { etat: 'paid', label: t('app.dashboard.recoveryCollected'), value: collected },
                { etat: 'partial', label: t('app.dashboard.recoveryPartial'), value: kpis.partial },
                { etat: 'overdue', label: t('app.dashboard.recoveryLate'), value: kpis.late },
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

        {/*
          ═══ DEUX CARTES ONT DISPARU ICI, ET C'EST LA FILE QUI LES A PRISES ═══

          « Ce qui demande une décision » listait les cautions à arbitrer et les
          devis à valider ; « Échéances du mois » listait les quatre premiers
          logements non soldés. Ce sont, mot pour mot, les lignes 1 à 3 de la
          file du jour — et elles arrivaient en quatrième position, sous les
          chiffres et sous le graphe.

          Elles n'étaient pas seulement redondantes : c'étaient des COPIES
          TRONQUÉES d'écrans qui existent. « Échéances » montrait `slice(0, 4)`
          d'une liste dont l'écran des encaissements porte l'intégralité, avec
          ses filtres et son export. Une carte de tableau de bord qui rejoue les
          quatre premières lignes d'un autre écran n'informe pas, elle diffère.

          La file, elle, ne recopie rien : elle NOMME le travail, en donne
          l'ampleur — montant, ancienneté, unités — et renvoie à l'écran qui le
          porte en entier. Le tableau de bord cesse d'être une vitrine de
          fragments pour devenir une porte d'entrée.

          CE QUE ÇA PERD, et il faut le dire : on ne voit plus d'un coup d'œil
          QUELS logements sont en retard. Le détail est à un clic, et la file en
          nomme déjà les unités quand elles sont peu nombreuses. Sur un parc de
          trois cents lots, aucune de ces deux cartes n'aidait de toute façon.

          Le découpage a été trouvé par une COLLISION DE PROSE, pas par l'œil :
          l'état vide de la file écrivait « cette liste se remplit d'elle-même »,
          une phrase que l'échéancier portait déjà. Deux textes qui se
          ressemblent à ce point disent la même chose.
        */}
        </div>
      </div>

      {/*
        LA RANGÉE À DEUX COLONNES N'EN AVAIT PLUS QU'UNE, ET LA PROSE DISAIT
        ENCORE « DEUX CARTES ».

        Elle en portait deux ; « Ce qui demande une décision » est partie dans la
        file du jour, le lot qui l'a retirée a laissé le `lg:grid-cols-2`. À
        1280 px, la répartition du parc occupait donc la moitié gauche et
        laissait un trou de 600 px à sa droite — sur la dernière rangée de
        l'écran, c'est-à-dire la dernière image qu'on en garde.

        Elle prend la largeur. Les immeubles y passent en GRILLE plutôt qu'en
        liste : une répartition se compare, et trois lignes de 1200 px de long
        pour un nom et un ratio n'étaient une liste que par défaut.
      */}
      <div className="mt-4">

        <Card>
          <CardHeader title={t('app.dashboard.breakdownTitle')} level={2} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BUILDINGS.map((building) => {
              // Compté sur l'état vivant, comme l'écran Parc. Cette carte
              // divisait encore `building.occupied / building.units`, deux
              // compteurs figés dans la constante : rattacher un locataire
              // faisait bouger le parc et pas cette liste. Un compteur se
              // compte, il ne se stocke pas.
              const inBuilding = units.filter((u) => u.buildingId === building.id)
              const occupees = inBuilding.filter((u) => u.status !== 'vacant').length
              /* Le TAUX a disparu avec le verdict qu'il servait à rendre : il
                 n'existait que pour décider `ok` ou `warn`. Le ratio brut,
                 lui, est ce que la carte montre — et il n'a jamais eu besoin
                 d'être converti en pourcentage pour se lire. */
              return (
                /* `min-w-0` : une cellule de grille hérite de
                   `min-width: auto` — elle refuse donc de descendre sous la
                   largeur intrinsèque de son contenu, et « Résidence
                   Bonamoussadi » faisait déborder la liste de 15 px à 320.
                   C'est le même défaut que `Card` documente, arrivé une
                   ligne plus bas parce que le `<li>` est devenu la cellule. */
                <li key={building.id} className="min-w-0">
                  <Link
                    to={lien(base, 'parc')}
                    /* `min-h-11` : les deux lignes de texte frôlaient déjà le
                       plancher sans que rien ne le garantisse — un immeuble au nom
                       court et sans quartier serait passé dessous. */
                    className={cn(
                      // La tuile REMPLACE la ligne : chaque immeuble occupe sa
                      // cellule entière, bordée, plutôt qu'une ligne de texte
                      // dans une colonne. C'est ce qui rend la rangée
                      // comparable d'un coup d'œil — trois objets de même
                      // forme, dont seuls le nom et le compte diffèrent.
                      'flex min-h-11 items-center gap-3 rounded-md border border-divider px-3 py-2.5',
                      'no-underline transition-colors duration-150 hover:bg-surface-sunken',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      {/* `data-donnee` : le nom d'un immeuble est saisi, sa
                          longueur n'est bornée par rien, et la tuile l'est.
                          Voir `MESURER_TRONCATURES` — le vocabulaire du produit
                          ne se coupe pas, une donnée si. */}
                      <span
                        data-donnee
                        className="block truncate text-body font-medium text-ink"
                      >
                        {building.name}
                      </span>
                      <span className="text-caps text-muted">{building.district}</span>
                    </span>
                    {/*
                      UN RATIO D'OCCUPATION N'EST PAS UN VERDICT.

                      Cette pastille rendait `ok` à 100 % et `warn` en dessous.
                      Donc, par construction, TOUJOURS un état : chaque immeuble
                      du parc, tous les jours, vert ou ambre à perpétuité. C'est
                      exactement l'alerte permanente que le reste du produit
                      s'interdit — celle qu'on cesse de lire au bout d'une
                      semaine, et qui n'est plus là le jour où elle a raison.

                      L'ÉCRAN SE CONTREDISAIT LUI-MÊME, à trois lignes d'écart.
                      L'indicateur « Taux d'occupation », en haut de cette même
                      page, écrit « 2 unités vacantes » en gris muet et ne porte
                      aucun état. Les mêmes vacances redevenaient ambre ici.

                      ET LE PRODUIT AVAIT DÉJÀ TRANCHÉ : `PAYMENT_TONES` associe
                      `vacant` à `neutral` — ni succès ni alerte. Les quatre
                      autres endroits où l'occupation s'affiche — les cartes du
                      Parc, son taux global, les deux miniatures de la vitrine —
                      la rendent sans état. Celle-ci était la seule des cinq à
                      juger, et c'est elle qui avait tort.

                      La pastille RESTE : elle sépare le ratio du nom. Elle ne
                      dit plus « bien » ou « mal », elle dit « voici le compte ».
                    */}
                    {/* `neutral` REVIENT, et c'est la carte qui a changé, pas la
                        règle. Le ton `onDark` avait été posé parce que la carte
                        était en ton sombre : son fond y était FIGÉ par
                        `.on-dark`, et un lavis neutre y basculait — 14:1 en
                        clair, 1,07:1 en sombre contre son propre fond,
                        c'est-à-dire invisible. La carte suit maintenant la
                        surface de la page, donc le lavis bascule AVEC elle et
                        `neutral` est de nouveau le ton juste. Le même pour les
                        trois immeubles : un ratio n'est pas un verdict. */}
                    <StatusPill tone="neutral" size="sm">
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
        <SkeletonStatRow count={4} className={GRILLE_QUATRE_INDICATEURS} />

        {/* `items-start`, comme la rangée qu'il remplace. Un squelette étiré
            au-dessus d'une rangée qui ne l'est plus ferait sauter la page au
            moment précis où les données arrivent — c'est-à-dire au moment où
            l'œil s'y pose. */}
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
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
              <Skeleton line="body" className="w-3/4" />
            </div>
          </Card>

          <Card>
            <Skeleton line="title" className="mb-4 w-40" />
            <div className="flex flex-wrap items-center gap-6">
              {/* L'anneau : 128px, comme le `<svg>` de `DonutChart`. */}
              <Skeleton className="size-32" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {[0, 1, 2].map((part) => (
                  <Skeleton key={part} line="body" className="w-36" />
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-divider pt-5">
              <Skeleton line="eyebrow" className="w-28" />
              {[0, 1].map((barre) => (
                <div key={barre} className="flex items-center gap-3">
                  <Skeleton line="body" className="w-20" />
                  <Skeleton className="h-1.5 min-w-0 flex-1" />
                  <Skeleton line="body" className="w-10" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </SkeletonRegion>
    </>
  )
}
