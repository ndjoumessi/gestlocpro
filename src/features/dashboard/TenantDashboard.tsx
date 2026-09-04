import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { lien, useBase } from '@/lib/base'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Notice } from '@/components/primitives/Notice'
import { ProgressBar, StatCard } from '@/components/primitives/Charts'
import { MiniBarChart } from '@/components/primitives/MiniBarChart'
import { PAYMENT_TONES } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { RejoindreUnParc } from './Onboarding'
import { Skeleton, SkeletonRegion, SkeletonStatRow } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { useNumbers } from '@/lib/numbers'
import { cn } from '@/lib/cn'
import { AU_DELA_SM, useAuDela } from '@/lib/useAuDela'
import {
  PAYMENT_METHOD_LABELS,
  dernierVersement,
  imputation,
  type ConsumptionPoint,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { ReceiptModal } from './ReceiptModal'
import { workTitle } from '@/data/workTitle'

/**
 * LA GRILLE DES TROIS CARTES DU MOIS, et pourquoi elle ne rejoint pas
 * `grillesDIndicateurs`.
 *
 * Elle est PROPRE à cet écran : la première carte porte le loyer — la seule
 * somme due d'office, et la plus longue à écrire — les deux autres des
 * consommations refacturées. `1.4fr` n'est pas un réglage esthétique, c'est
 * cette asymétrie-là. La ranger avec les deux grilles partagées ferait une
 * constante à trois cas, c'est-à-dire trois littéraux sous un seul nom.
 *
 * Nommée quand même, et c'est le point du lot : la rangée CHARGÉE et son
 * SQUELETTE la lisent tous deux ici, donc ils ne peuvent plus diverger.
 */
/*
  ═══ LE SEUIL EST CELUI DU CONTENEUR, PAS CELUI DE LA FENÊTRE ═══

  `lg:` regardait la fenêtre. Or cette rangée se rend dans DEUX contenants qui
  n'ont pas la même largeur pour une même fenêtre :

    /demo/mon-espace   l'écran réel du locataire   — grille 689 px à 1024
    /demo/portail      la prévisualisation, dans un cadre de navigateur
                       destiné au propriétaire     — grille 632 px à 1024

  À 1024 le seuil `lg` déclenchait donc trois colonnes dans les deux cas, et
  « 17 622 FCFA » — que `Intl` compose avec des espaces insécables, donc un seul
  jeton de onze caractères — sortait de sa carte : de 2 px sur l'écran réel, de
  19 px dans la prévisualisation. Aucun débordement de page : le montant sortait
  DANS la carte. Relevé par `MESURER_DEBORDEMENT_DE_MOT`.

  AUCUN SEUIL DE FENÊTRE NE POUVAIT LE DIRE, et c'est ce qui a décidé de l'outil.
  Le rapport cadre/fenêtre vaut 0,62 dans la prévisualisation et 1 sur l'écran
  réel : monter le seuil à `xl` réparait les deux à 1280 mais retardait sans
  raison la mise en trois colonnes de l'écran réel ; le descendre à `sm` rendait
  deux colonnes de 162 px dans la prévisualisation à 640, soit le même défaut
  trente pixels plus bas. Un seuil unique ne peut pas décrire deux contenants.

  `@container` mesure le PARENT — et il faut le poser SUR le parent, jamais sur
  la grille elle-même : un élément n'est pas son propre conteneur, et les deux
  classes sur la même boîte font chercher un ancêtre qui n'existe pas. D'où
  `ENVELOPPE_LOCATAIRE`, qui n'a pas d'autre raison d'être. Les seuils ci-dessous
  sont donc des largeurs d'enveloppe, vraies dans les deux contextes :

    @xl   (36rem = 576)  deux colonnes  — chacune ≥ 280 px, soit 240 px utiles
    @3xl  (48rem = 768)  trois colonnes — la plus étroite ≥ 216 px, soit 176 utiles

  Le montant en réclame 153. Les seuils sont posés sur le MESURÉ et non sur le
  premier palier disponible : une première rédaction avait pris `@2xl` et `@4xl`,
  et `@4xl` (896) ratait de HUIT PIXELS l'enveloppe de 888 px que la
  prévisualisation offre à 1280 — la rangée retombait à deux colonnes là où trois
  tenaient depuis toujours. Le palier au-dessus n'est pas gratuit ; il faut le
  choisir contre une largeur réelle.

  `1.4fr` reste ce qu'il était : la première carte porte le loyer, la seule somme
  due d'office et la plus longue à écrire ; les deux autres des consommations
  refacturées. Ce n'est pas un réglage esthétique, c'est cette asymétrie-là.

  ═══ POURQUOI ELLE NE REJOINT PAS `grillesDIndicateurs` ═══

  Elle est PROPRE à cet écran, pour la raison qui précède. La ranger avec les
  deux grilles partagées ferait une constante à trois cas, c'est-à-dire trois
  littéraux sous un seul nom.

  Nommée quand même : la rangée CHARGÉE et son SQUELETTE la lisent tous deux
  ici, donc ils ne peuvent plus diverger.
*/
/* L'enveloppe n'existe que pour porter `@container` : un élément n'est pas son
   propre conteneur. Nommée, et non écrite deux fois, pour la même raison que la
   grille — la rangée chargée et son squelette doivent la lire au même endroit. */
const ENVELOPPE_LOCATAIRE = '@container'
const GRILLE_LOCATAIRE = 'grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-[1.4fr_1fr_1fr]'

/**
 * Les quittances et les signalements, côte à côte. Nommée pour la même
 * raison que `GRILLE_LOCATAIRE` : la rangée chargée et son squelette la
 * lisaient chacun dans sa propre chaîne.
 */
const GRILLE_QUITTANCES_ET_SIGNALEMENTS = 'mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]'

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
  /* Le tableau des quittances cède la place à des fiches sous `sm` — voir le
     commentaire au point de bascule. Lu au RENDU et non par la feuille de
     style : rendre les deux formes laisserait la donnée deux fois dans le
     document, ce que la famille précédente a payé en trente-quatre cas rouges. */
  const enTableau = useAuDela(AU_DELA_SM)
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
    consumptionForUnit,
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
  /* Douze périodes au plus, les plus RÉCENTES : la série arrive du plus ancien
     au plus récent, et un parc qui en porte davantage ne doit pas écraser la
     carte. */
  const historique = consumptionForUnit(monUnite).slice(-12)

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
          level={2}
          title={t('app.tenant.noUnitTitle')}
          body={t('app.tenant.noUnitBody')}
        />
        {/* ET DE QUOI AGIR, au lieu d'attendre que quelqu'un agisse pour lui.

            L'état ci-dessus renvoie le locataire vers son bailleur, ce qui est
            juste quand il n'a rien en main. Mais le bailleur, lui, fait ce que
            le produit lui montre : il émet un code portant le logement et le
            transmet — et ce code n'avait NULLE PART où être saisi. La carte
            « rejoindre un parc » se retire dès qu'on appartient à un parc,
            c'est-à-dire exactement ici. Capturé en production, avec le code
            correspondant en attente dans le registre des accès.

            LE MÊME COMPOSANT que sur « prise en main », dans sa variante
            « logement » : un second champ de code aurait divergé du premier au
            premier changement du serveur. */}
        <RejoindreUnParc variante="logement" />
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

  /**
   * Le montant refacturé, et le TIRET quand il n'y a pas de prix.
   *
   * Deux constantes du client servaient ici : le locataire lisait « eau —
   * 8 320 FCFA » calculé à 520 le mètre cube, un prix que personne ne lui avait
   * accordé et que son bailleur n'avait jamais saisi. C'est l'endroit du
   * produit où un chiffre inventé coûte le plus cher, puisque c'est celui qui
   * le paie qui le lit.
   *
   * Sans prix, la consommation reste affichée — 16 m³ est un fait relevé — et
   * seul le montant disparaît. Le tiret est le même que celui d'un relevé
   * manquant, et c'est voulu : dans les deux cas, la somme n'est pas connue.
   */
  const refacture = (conso: number | null, prix: number | null | undefined) =>
    conso === null || prix === null || prix === undefined
      ? '—'
      : money(conso * prix, { compact: true })

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
      {/* L'ENVELOPPE N'EXISTE QUE POUR PORTER `@container` — voir GRILLE_LOCATAIRE. */}
      <div className={ENVELOPPE_LOCATAIRE}>
        <div className={GRILLE_LOCATAIRE}>
          {/*
            LA CARTE DU LOYER PASSE PAR LA PRIMITIVE, comme ses deux voisines.

            Elle recopiait `StatCard` à la main — surtitre, `text-kpi`, note
            grise — et se retrouvait donc SANS `data-indicateur`, invisible à
            toutes les gardes qui interrogent ce marqueur. C'était le seul écran
            que le LOCATAIRE voit, et le seul que rien ne mesurait de ce côté-là.

            Elle est la seule carte du produit qui continue SOUS son nombre : une
            piste de progression, la date et le moyen du dernier règlement, le
            bouton de quittance. `StatCard` a reçu pour cela un emplacement
            nommé, `bas`, et non un `children` — voir sa prop, qui dit pourquoi.

            L'ÉTAT REMPLACE LA PASTILLE POSÉE À LA MAIN : `etat` porte le ton ET
            son libellé, et il peint en plus la bordure et la tuile. Le statut du
            paiement est le même, il est simplement dit une fois au lieu de
            deux.
          */}
          <StatCard
            icone="card"
            label={`${t('app.tenant.rentFor')} · ${d.monthYear(periodeCourante)}`}
            value={money(unit.rent, { compact: true })}
            etat={{ ton: PAYMENT_TONES[unit.status], libelle: t(`status.${unit.status}` as 'status.paid') }}
            bas={
              <>
            {/* La valeur est un POURCENTAGE, pas un montant : passer le montant
                rendait une piste large de 145 000 % et un libellé « 145000 % ».
                Le libellé est masqué — le montant juste au-dessus le dit déjà —
                mais reste annoncé aux lecteurs d'écran. */}
            <div className="mt-3">
              {/* Le TON suit le STATUT de la pastille juste au-dessus, et non un
                  vert fixe. Un logement EN RETARD affichait une pastille rouge
                  ET une piste verte pour le même fait — deux couleurs
                  contraires sur la même carte, à un public qui lit d'abord la
                  couleur. `ProgressBar` n'expose que trois tons (`accent`, `ok`,
                  `danger`) : `danger` est le seul qui rejoigne la pastille sans
                  en inventer un quatrième dans un composant partagé. */}
              <ProgressBar
                value={unit.rent === 0 ? 0 : Math.round((unit.paid / unit.rent) * 100)}
                label={t('app.tenant.rentFor')}
                tone={unit.status === 'overdue' ? 'danger' : 'ok'}
                hideLabel
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {/* Le jour et le moyen du règlement sont les deux seules choses que
                  la quittance sait et que le portefeuille ignore. Sans quittance
                  pour la période, la ligne disparaît plutôt que d'en inventer
                  une : le statut au-dessus dit déjà où en est le loyer. */}
              {versementCourant ? (
                <span className="text-body text-muted">
                  {t('app.tenant.paidOnBy', {
                    date: d.dayMonth(versementCourant.paidOn),
                    method: t(
                      PAYMENT_METHOD_LABELS[versementCourant.method] as 'app.payments.methodCash',
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
              </>
            }
          />

          <CarteCharge
            icone="droplet"
            label={t('app.tenant.water')}
            amount={refacture(eauConso, releve?.waterPrice)}
            note={
              eauConso === null
                ? t('app.meters.missing')
                : t('app.tenant.consumedWater', { n: n.integer(eauConso) })
            }
          />
          <CarteCharge
            icone="bolt"
            label={t('app.tenant.power')}
            amount={refacture(elecConso, releve?.powerPrice)}
            note={
              elecConso === null
                ? t('app.meters.missing')
                : t('app.tenant.consumedPower', { n: n.integer(elecConso) })
            }
          />
        </div>
      </div>

      <div className={GRILLE_QUITTANCES_ET_SIGNALEMENTS}>
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
          enTableau ? (
          <div className="overflow-x-auto border-t border-divider">
            <table className="w-full border-collapse">
              {/* Le titre vit dans le `CardHeader`, DEHORS de la table : un
                  lecteur d'écran n'entendait donc que « tableau, sept
                  colonnes ». La légende le lui donne, sans rien changer à
                  l'œil. */}
              <caption className="sr-only">{t('app.tenant.byPeriod')}</caption>
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
          ) : (
            /*
              ═══ LES QUITTANCES EN FICHES, SUR UN TÉLÉPHONE ═══

              C'est l'écran que le LOCATAIRE ouvre, et le locataire est celui du
              produit qui a le moins de chances d'avoir autre chose qu'un
              téléphone. Mesuré à 360 px : cinq colonnes, 62 px à faire glisser
              pour atteindre le bouton de quittance — c'est-à-dire pour atteindre
              la seule action de la carte.

              Même forme que les écrans-tableaux de la famille précédente : la
              période nomme la fiche, les trois composantes du loyer deviennent
              des couples nom/valeur, et la quittance descend au pied. Rien n'est
              masqué, rien ne défile latéralement.

              PAS `DataTable` POUR AUTANT. Ce tableau vit DANS une carte, et
              `DataTable` pose la sienne — bordure, ombre, rayon. On aurait rendu
              une carte dans une carte pour économiser trente lignes. Ce qui est
              partagé est le RAISONNEMENT, écrit dans `ListeDeFiches` ; la forme
              locale suit son support.

              `<dl>` pour la même raison que là-bas : « Loyer : 145 000 » est un
              couple terme/définition, et un lecteur d'écran doit l'entendre
              comme tel.
            */
            <ul className="flex flex-col gap-2 p-4 pt-0">
              {tenantReceipts.map((receipt) => {
                const regle = imputation(receipt)
                return (
                  <li
                    key={`${receipt.year}-${receipt.month}`}
                    data-quittance=""
                    className="rounded-md border border-divider bg-surface-sunken p-3"
                  >
                    <p className="text-body font-medium">{d.monthYear(receipt)}</p>
                    <dl className="mt-2 flex flex-col gap-1">
                      {(
                        [
                          [t('app.tenant.colRent'), receipt.rentMinor, regle.rent],
                          [t('app.tenant.colWater'), receipt.waterMinor, regle.water],
                          [t('app.tenant.colPower'), receipt.powerMinor, regle.power],
                        ] as const
                      ).map(([terme, du, paye]) => (
                        <div key={terme} className="flex items-baseline justify-between gap-3">
                          <dt className="eyebrow shrink-0 text-muted">{terme}</dt>
                          <dd
                            className={cn(
                              'numeric min-w-0 text-right text-body',
                              paye >= du ? 'text-ok' : 'text-warn',
                            )}
                          >
                            <MontantRegle du={du} regle={paye} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {/* PAS DE `-mr-3.5` ICI, à rebours de la cellule du tableau.

                        Dans le tableau, la marge négative rattrape le rembourrage
                        du bouton fantôme pour que son libellé s'aligne sur le bord
                        de la cellule. La fiche n'a pas ce rembourrage à rattraper :
                        la marge y tirait le bouton HORS de sa boîte, 14 px à 320 px
                        sur quarante-huit occurrences — trouvé par la sonde du
                        débordement local, pas par l'œil. */}
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${t('app.tenant.receipt')} — ${d.monthYear(receipt)}`}
                        onClick={() => setQuittanceDe(periodeIso(receipt))}
                      >
                        {t('app.tenant.receipt')}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
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
                valeur={money(unit.rent, { compact: true })}
              />
              {/* UN TIRET NE DIT PAS SI C'EST UN OUBLI DE SAISIE OU L'ABSENCE
                  DE CAUTION, et `leaseDepositNone` — « Aucune caution
                  enregistrée à votre nom » — existait dans les deux
                  dictionnaires sans être appelée nulle part. Une phrase écrite,
                  traduite, relue, et jamais rendue. */}
              <LigneBail
                terme={t('app.tenant.leaseDeposit')}
                valeur={deposit ? money(deposit.held, { compact: true }) : undefined}
                absence={deposit ? undefined : t('app.tenant.leaseDepositNone')}
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
              <p className="text-body text-muted">{t('app.tenant.worksEmpty')}</p>
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
                        {t(`app.works.status.${work.status}` as 'app.works.status.reported')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/*
        LA SÉRIE DES DOUZE MOIS.

        « 16 m³ » seul ne répond à rien. La question du locataire dont la
        facture double est toujours la même — est-ce moi, une fuite, ou le mois
        d'août ? — et elle ne se tranche qu'en voyant les onze mois d'avant.

        Deux graphes CÔTE À CÔTE, jamais une pile : 16 m³ et 178 kWh ne
        s'additionnent pas, et empiler ferait paraître haute la barre d'un
        locataire économe en eau au seul motif qu'il a chaud.

        Rendue à partir de DEUX points : une barre isolée n'est pas une série,
        elle répète ce que la carte du mois dit déjà.
      */}
      {historique.length > 1 && (
        <Card className="mt-4">
          <CardHeader title={t('app.tenant.consumptionTrend')} level={2} />
          <div className="grid gap-6 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
            <SerieFluide
              points={historique}
              fluide="water"
              libelle={t('app.tenant.water')}
              unite={t('app.tenant.unitWater')}
            />
            <SerieFluide
              points={historique}
              fluide="power"
              libelle={t('app.tenant.power')}
              unite={t('app.tenant.unitPower')}
            />
          </div>
        </Card>
      )}

      {quittanceDe && (
        <ReceiptModal
          unitId={monUnite}
          periodStart={quittanceDe}
          open
          onClose={() => setQuittanceDe(null)}
        />
      )}

      <TenantScopeNote className="mt-4" />
      <FinDAccesNote className="mt-4" />
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

/**
 * Une charge du mois : son montant, et le volume qu'elle facture.
 *
 * ELLE RECOPIAIT `StatCard` — surtitre en `eyebrow`, grand nombre en `text-kpi`,
 * note grise dessous — au lieu de l'appeler. Elle se voyait pareil et n'était
 * pas pareil : pas de `data-indicateur`, donc invisible à toutes les gardes qui
 * interrogent ce marqueur ; pas de `data-intitule`, donc son libellé n'était pas
 * mesuré au rognage ; ni tuile d'icône, ni bordure d'état, ni pastille de
 * variation à sa disposition.
 *
 * La fonction survit parce qu'elle NOMME quelque chose que la primitive ignore :
 * une charge refacturée, avec son glyphe de fluide. C'est la seule chose qu'elle
 * ajoute désormais.
 */
function CarteCharge({
  label,
  amount,
  note,
  icone,
}: {
  label: string
  amount: string
  note: string
  icone: 'droplet' | 'bolt'
}) {
  return <StatCard icone={icone} label={label} value={amount} note={note} />
}

/**
 * Une série de consommation, pour UN fluide.
 *
 * La moyenne ignore les mois inconnus — `filter(v => v !== null)` et non
 * `?? 0`. Diviser par douze quand trois relevés manquent tire la moyenne vers
 * le bas, et fait alors paraître anormal un mois qui ne l'est pas : le
 * locataire lirait une hausse là où il n'y a qu'un trou de saisie.
 */
function SerieFluide({
  points,
  fluide,
  libelle,
  unite,
}: {
  points: ConsumptionPoint[]
  fluide: 'water' | 'power'
  libelle: string
  unite: string
}) {
  const t = useT()
  const d = useDates()
  const n = useNumbers()

  const releves = points.map((p) => p[fluide]).filter((v): v is number => v !== null)
  const moyenne = releves.length > 0 ? Math.round(releves.reduce((s, v) => s + v, 0) / releves.length) : null
  const lire = (v: number) => `${n.integer(v)} ${unite}`

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-caps text-muted">{libelle}</span>
        {moyenne !== null && (
          <span className="numeric text-body text-muted">
            {t('app.tenant.average', { value: lire(moyenne) })}
          </span>
        )}
      </div>
      <MiniBarChart
        caption={`${libelle} — ${t('app.tenant.consumptionTrend')}`}
        format={lire}
        emptyLabel={t('app.tenant.noReading')}
        bars={points.map((point) => ({
          // La clé porte la PÉRIODE, pas le libellé : douze relevés peuvent
          // s'étaler sur quatorze mois, et « août » reviendrait deux fois.
          key: `${point.year}-${point.month}`,
          label: d.monthShort(point),
          value: point[fluide],
        }))}
      />
    </div>
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
  const solde = regle >= du
  return (
    <td className={cn('numeric px-3 py-3 text-right text-body', solde ? 'text-ok' : 'text-warn')}>
      <MontantRegle du={du} regle={regle} />
    </td>
  )
}

/**
 * Le montant et ce qu'il en reste, SANS sa cellule.
 *
 * Extrait de `CelluleMontant` parce que la fiche du téléphone le rend hors d'un
 * `<td>` — voir `QuittancesEnFiches`. Le rendu est identique au caractère près :
 * ce lot déplace une forme, il ne change aucun chiffre.
 */
function MontantRegle({ du, regle }: { du: number; regle: number }) {
  const t = useT()
  const { money } = useCurrency()
  const solde = regle >= du
  /*
    DE L'ARGENT SE LIT PAR LE FORMATEUR DE DEVISE, jamais par celui des nombres.

    `n.integer` suit la locale de la LANGUE ; `money` suit celle de la DEVISE.
    Sur un compte en anglais réglé en francs CFA, la même somme s'écrivait donc
    « 145,000 » ici et « 145 000 » trois cents pixels plus haut, dans l'en-tête
    de la même carte. Deux graphies pour un seul montant sur un seul écran, et
    c'est le locataire qui doit décider laquelle croire.

    `omitSymbol` : la devise est nommée UNE fois, dans l'en-tête de la carte.
    L'écrire dans chaque cellule d'un tableau de trois colonnes la répéterait
    trente-six fois et rendrait la colonne illisible — c'est déjà le choix que
    fait l'export du même tableau.

    ELLE RESTE OMISE DANS LA FICHE, et c'est le seul point où le déplacement a
    demandé une décision : la fiche ne porte que trois montants au lieu de
    trente-six, donc l'argument du volume n'y vaut plus. Mais l'en-tête de la
    carte nomme toujours la devise une fois, et faire diverger les deux formes
    créerait deux graphies pour la même colonne selon la largeur de l'écran.
  */
  const lireMontant = (v: number) => money(v, { compact: true, omitSymbol: true })
  return (
    <>
      {lireMontant(solde ? du : regle)}
      {!solde && (
        <span className="text-caps">
          {' · '}
          {t('app.tenant.remaining', { amount: lireMontant(du - regle) })}
        </span>
      )}
    </>
  )
}


/** Un terme du bail : un intitulé, et soit une valeur, soit un renvoi. */
function LigneBail({
  terme,
  valeur,
  href,
  action,
  absence,
}: {
  terme: string
  valeur?: string
  href?: string
  action?: string
  /**
   * CE QUE L'ABSENCE EST, en toutes lettres.
   *
   * Elle se rendait « — », et un tiret ne distingue pas un oubli de saisie
   * d'une caution qui n'existe pas. Le locataire n'a aucun moyen de trancher :
   * c'est le seul écran du produit où il ne connaît que son bail.
   *
   * NI `numeric` NI GRAS, contrairement à la valeur : ce n'est pas un montant,
   * et lui donner la graisse d'un chiffre ferait lire une phrase comme une
   * donnée. Le texte se replie — `text-pretty` — là où un montant ne le
   * pourrait pas.
   */
  absence?: string
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-divider py-2 last:border-b-0">
      <dt className="text-body text-muted">{terme}</dt>
      <dd
        className={
          absence !== undefined && !href
            ? 'text-pretty text-right text-caps text-muted'
            : 'numeric text-body font-medium'
        }
      >
        {href ? (
          <Button variant="ghost" size="sm" to={href} className="-mr-3.5">
            {action}
          </Button>
        ) : (
          (absence ?? valeur)
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
          <>
            {/*
              LE SQUELETTE POINTE OÙ L'ÉCRAN POINTE.

              Il offrait « Signaler un incident » vers `signalements` — la boîte
              du BAILLEUR — quand l'écran réel offre `signaler`, le formulaire du
              locataire, et `documents` à côté. Un squelette qui promet autre
              chose que ce qu'il remplace apprend un geste faux : le locataire
              qui clique pendant l'attente arrive ailleurs, et refait le chemin
              une fois la page chargée.

              Le libellé suit la même correction : `reportIssue` est celui de
              l'écran, `contactManager` n'était employé que par ce squelette.
            */}
            <Button variant="secondary" icon="download" to={lien(base, 'documents')}>
              {t('app.tenant.downloadReceipts')}
            </Button>
            <Button icon="bell" to={lien(base, 'signaler')}>
              {t('app.tenant.reportIssue')}
            </Button>
          </>
        }
      />

      <SkeletonRegion>
        {/* MÊME GRILLE, MÊME COMPTE que la rangée chargée — et c'est un
            correctif. Ce squelette attendait sous QUATRE cartes égales en
            `sm:grid-cols-2 xl:grid-cols-4` là où l'écran en charge TROIS,
            inégales, sans point de rupture avant `lg`. Sur une tablette il
            montrait deux colonnes pour une, sur un grand écran quatre cartes
            pour trois : la page se réorganisait entièrement au moment précis où
            elle cesse d'attendre, et le doigt qui visait la première carte
            tombait ailleurs.

            Le défaut a survécu à toute la refonte parce qu'AUCUNE porte ne
            rendait alors un état de chargement — ni la vitrine, ni la mesure au
            navigateur, ni les tests. C'est le refactoring qui l'a montré, en
            mettant les deux littéraux côte à côte.

            « NI LES TESTS » A CESSÉ D'ÊTRE VRAI LE LENDEMAIN.
            `attenteFidele.test.tsx` (2026-08-28) rend le squelette et compte ce
            qu'il annonce contre ce que la page chargée porte. La vitrine et la
            mesure au navigateur, elles, ne rendent toujours aucun chargement :
            la démonstration n'attend pas. */}
        {/* L'ENVELOPPE AUSSI, et pas seulement la grille : `@2xl:` et `@4xl:`
            cherchent un ancêtre déclaré conteneur. Sans elle, le squelette
            rendrait UNE colonne à toutes les largeurs pendant que la rangée
            chargée en rend trois — exactement la divergence que ce nom partagé
            existe pour empêcher, et que rien ne rendrait visible puisqu'aucune
            porte ne rend jamais un état de chargement. */}
        <div className={ENVELOPPE_LOCATAIRE}>
          <SkeletonStatRow count={3} className={GRILLE_LOCATAIRE} />
        </div>

        <div className={GRILLE_QUITTANCES_ET_SIGNALEMENTS}>
          {/* Les quittances. Six lignes : c'est ce que rend `TENANT_RECEIPTS`,
              et leur nombre ne dépend pas du serveur — seuls les montants en
              dépendent. */}
          <Card flush>
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
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
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
            </Card>

            {/* La carte du gestionnaire ne porte aucune donnée de parc, mais
                elle est prise dans le même bloc : la reproduire évite que la
                colonne de droite ne s'allonge d'un coup à l'arrivée du bail.

                ELLE AVAIT DÉRIVÉ, et c'est la seule des six recopies qui l'ait
                fait : elle portait `border-divider` et `shadow-e1` là où
                `Card tone="dark"` pose une bordure TRANSPARENTE et aucune
                ombre. Un filet clair et un relief autour d'un aplat d'encre, à
                la place d'une carte qui n'en a ni l'un ni l'autre — puis les
                deux disparaissaient à l'arrivée des données.

                Les pavés restent visibles dessus : `.on-dark` ne remappe pas
                `--color-surface-sunken`, vérifié dans `tokens.css`. */}
            <Card tone="dark">
              <Skeleton line="title" className="mb-4 w-36" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-10" />
                <div className="min-w-0 flex-1">
                  <Skeleton line="body" className="w-28" />
                  <Skeleton line="eyebrow" className="mt-0.5 w-20" />
                </div>
              </div>
              <Skeleton radius="md" className="mt-4 h-11 w-full" />
            </Card>
          </div>
        </div>
      </SkeletonRegion>

      <TenantScopeNote className="mt-4" />
      <FinDAccesNote className="mt-4" />
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
        level={2}
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

/**
 * LE PÉRIMÈTRE DU LOCATAIRE, dit une fois pour les six écrans qui le rappellent.
 *
 * CE QU'IL REMPLACE, ET LE DÉTOUR QU'IL A FALLU. Deux bandeaux disaient la même
 * phrase — `app.tenant.privacyNote`, mot pour mot — sous deux écritures : celui-ci,
 * à la main, avec la liste des unités ; et une copie interne au tableau de bord,
 * sans elle, écrite deux fois de plus dans le même fichier. Trois rédactions pour
 * une phrase.
 *
 * IL AVAIT ÉTÉ REFUSÉ À LA MIGRATION, avec un motif juste et une conclusion
 * fausse. Le motif : sa pastille portait déjà un bouclier, et `Notice` en aurait
 * posé un second à trois millimètres. La conclusion tirée — « il reste à la
 * main » — prenait la pastille pour une donnée du problème.
 *
 * Elle n'en était pas une. Une `StatusPill` rend un VERDICT ; celle-ci était en
 * ton `ok`, c'est-à-dire qu'elle peignait en vert de succès une simple liste de
 * logements. Le bandeau entier l'était avec elle. Or nommer son périmètre n'est
 * ni une réussite ni une alerte : c'est une borne, et une borne est neutre.
 *
 * Le bouclier remonte donc au bandeau, où il dit ce qu'il a toujours voulu dire
 * — « ceci parle de ce que vous voyez et de ce que vous ne voyez pas » — et les
 * unités redeviennent ce qu'elles sont, des noms, en gras dans la phrase. Pas de
 * seconde icône, pas de vert emprunté, pas de pastille sur un lavis.
 *
 * PAS DE MARGE PAR DÉFAUT : chaque appelant pose la sienne. `cn` CONCATÈNE — il
 * n'est pas `tailwind-merge` — donc un `mb-4` de série plus un `mt-4` d'appelant
 * laisseraient les deux classes dans le balisage, et le jour où quelqu'un voudra
 * `mb-0` c'est l'ordre d'émission de la feuille qui trancherait. Six appelants,
 * six marges écrites : le prix est visible, le piège n'existe pas.
 */
/**
 * LA FIN D'ACCÈS S'ANNONCE, ELLE NE TOMBE PAS.
 *
 * La fenêtre après le bail coupait l'accès du locataire parti SANS PRÉVENIR :
 * « un jour ses quittances sont là, le lendemain son espace dit “aucun
 * logement rattaché” ». La date vient du serveur — lui seul connaît la
 * fenêtre du parc — et ne se pose JAMAIS tant qu'un bail court.
 *
 * Le ton est `warn` et non `danger` : rien n'est cassé, une échéance approche.
 * Et la phrase dit QUOI FAIRE — télécharger ses quittances — parce qu'une
 * date sans geste laisse le lecteur compter les jours au lieu d'agir.
 */
function FinDAccesNote({ className }: { className?: string }) {
  const t = useT()
  const d = useDates()
  const { accessUntil } = usePortfolio()
  if (!accessUntil) return null
  /* `partiesDeDateISO` et non un découpage à la main : la conversion ISO ne
     s'écrit qu'une fois dans ce dépôt, et une garde le compte. */
  return (
    <Notice tone="warn" icon="clock" className={className}>
      {t('app.tenant.accessEnds', { date: d.fullDate(partiesDeDateISO(accessUntil)) })}
    </Notice>
  )
}

export function TenantScopeNote({ className }: { className?: string }) {
  const t = useT()
  // Le périmètre vient du provider, qui le tient du serveur. Les identifiants
  // sont techniques : ils servent à retrouver les unités, jamais à être lus —
  // d'où le passage par le libellé.
  const { unitById, tenantUnitIds } = usePortfolio()
  const n = useNumbers()
  const libelles = tenantUnitIds.map((id) => unitById(id)?.label).filter(Boolean) as string[]
  return (
    <Notice tone="neutral" icon="shield" className={className}>
      {/* La liste ne paraît que si le provider a rendu des libellés : sur un
          compte dont le bail n'est pas encore relié, elle serait vide, et un gras
          suivi d'une espace annoncerait un périmètre qu'on ne sait pas nommer. */}
      {libelles.length > 0 && <span className="font-semibold">{n.list(libelles)} · </span>}
      {t('app.tenant.privacyNote')}
    </Notice>
  )
}
