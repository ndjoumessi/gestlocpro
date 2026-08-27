import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from '@/components/layout/gouttiere'
import { Button } from '@/components/primitives/Button'
import { StatusPill } from '@/components/primitives/StatusPill'
import { MiniBarChart } from '@/components/primitives/Charts'
import { COLLECTIONS, READINGS, UNITS } from '@/data/portfolio'
import { computeKpis } from '@/data/kpis'
import { useDates } from '@/lib/useDates'
import { Icon } from '@/components/primitives/Icon'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'

export function Hero() {
  const t = useT()
  const { money } = useCurrency()

  return (
    // Un halo doré flou occupait le coin haut droit. « No decorations » : il
    // ne portait rien et adoucissait précisément le contraste que ce style
    // cherche. Le fond est nu.
    <section
      className={cn(
        'relative bg-canvas pt-12 pb-24 sm:pt-20 sm:pb-32 lg:pt-28 lg:pb-40',
        GOUTTIERE_LATERALE,
      )}
    >
      {/* Le titre prend toute la largeur, et le reste se range dessous : en
          deux colonnes, il n'avait que la moitié de l'écran et venait buter
          contre la carte d'aperçu. */}
      <div className="relative mx-auto max-w-7xl">
        <p className="eyebrow flex items-center gap-2 text-accent-ink">
          <Icon name="globe" size={14} />
          {t('marketing.hero.eyebrow')}
        </p>

        {/* Les trois marqueurs qui suivent existent pour la mesure, et ils ne
            peuvent pas s'en déduire : « la colonne qui porte la lecture » et
            « celle qui illustre » sont un fait de CONCEPTION, pas de DOM — rien
            dans une grille ne distingue son premier enfant de son second. Une
            règle qui devinerait par la position se tromperait le jour où les
            colonnes s'inversent, et se tairait en se trompant. */}
        <h1 data-mesure="accroche-titre" className="display-xl mt-6 max-w-[18ch] text-balance">
          {t('marketing.hero.title')}
        </h1>

        {/*
          LES DEUX COLONNES PARTENT DU MÊME HAUT, et c'est la troisième et
          dernière position essayée ici. `items-end` épinglait le texte au BAS
          de la carte ; `items-center` l'a remonté de moitié et a laissé le
          défaut intact sous une forme plus discrète.

          Mesuré, avant ce lot : la rangée fait 427 px (c'est la carte qui la
          dicte, 396 plus sa mention), la colonne de gauche 204. `items-center`
          la décalait donc de (427 − 204) / 2 ≈ 111 px vers le bas, et le trou
          entre le bas du titre et la première ligne de texte valait 159 px à
          1440, 1920 et 2000 px — contre 48 px à 375 et 768, où la grille est à
          une colonne et où l'alignement ne s'applique pas. Le même bloc se
          lisait donc autrement selon la largeur, sans que rien ne le décide.

          Ce n'est pas une question de goût mais d'AXE : la colonne de gauche
          porte la lecture — titre, texte, actions, mention — et la carte
          illustre. Un axe se donne au porteur ; centrer revenait à donner
          l'axe à l'illustration et à faire flotter le texte autour d'elle.
          `items-start` rend les 111 px et aligne le haut de la carte sur la
          première ligne du paragraphe : deux colonnes qui commencent ensemble.

          Le trou vaut désormais 48 px — la marge `mt-12` de la grille — à
          TOUTES les largeurs, ce qui est aussi ce que la version à une colonne
          faisait déjà.
        */}
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div data-mesure="accroche-lecture" className="min-w-0">
            <p className="max-w-[46ch] text-body-l text-pretty text-muted">
              {t('marketing.hero.subtitle')}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" to="/inscription" iconAfter="arrowRight">
                {t('marketing.hero.ctaPrimary')}
              </Button>
              <Button size="lg" variant="secondary" to="/demo" icon="grid">
                {t('marketing.hero.ctaSecondary')}
              </Button>
            </div>

            <p className="mt-5 flex items-center gap-2 text-body text-muted">
              <Icon name="checkCircle" size={15} className="text-accent-ink" />
              {t('marketing.hero.trust')}
            </p>

            {/* Les sélecteurs de langue et de devise vivaient aussi ici. Ils
                étaient les deuxièmes de quatre copies sur la même page —
                en-tête, hero, section internationale, pied de page. L'en-tête
                est collant : ils restent atteignables à tout moment, y compris
                avant le moindre défilement, ce qui était l'argument d'origine. */}
          </div>

          <HeroPreview money={money} t={t} />
        </div>
      </div>
    </section>
  )
}

/** Aperçu du tableau de bord : suit la devise choisie en temps réel. */
function HeroPreview({
  money,
  t,
}: {
  money: (amount: number, options?: { round?: boolean }) => string
  t: ReturnType<typeof useT>
}) {
  const d = useDates()

  // Les mêmes encaissements que le tableau de bord, et non des hauteurs
  // inventées : ce que le visiteur survole ici est ce qu'il retrouvera après
  // inscription.
  const bars = COLLECTIONS.map((month) => ({
    label: d.monthShort(month),
    value: month.rent + month.water + month.power,
  }))

  // La promesse ci-dessus ne valait que pour les barres. Les quatre chiffres de
  // la carte étaient écrits à la main et démentaient le jeu servi à `/demo`, à
  // un clic de là : 1 040 000 encaissés contre 950 000, 375 000 d'impayé contre
  // 447 000, trois locataires débiteurs contre quatre. Le dernier écart est
  // celui que le tableau de bord dit avoir corrigé chez lui — la vitrine le
  // rejouait intact, et c'est elle que le visiteur lit en premier.
  const kpis = computeKpis(UNITS, READINGS)
  const partEncaissee =
    kpis.expected === 0 ? 0 : Math.round((kpis.collected / kpis.expected) * 100)
  // Retards ET partiels, comme le tableau de bord : la légende doit porter sur
  // la même population que le montant qu'elle explique, sans quoi elle le
  // dément.
  const doivent = UNITS.filter((u) => u.status === 'overdue' || u.status === 'partial')

  return (
    <div data-mesure="accroche-illustration" className="relative min-w-0">
      <div className="animate-rise rounded-2xl border border-divider bg-surface p-5 shadow-e3 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-muted">{t('marketing.metrics.collected')}</p>
            {/* Le montant descend d'un cran sous `sm` : à 32px, un montant de
                cette taille suivi de sa devise ne se coupe pas et ne tient pas
                dans 375px. */}
            {/* Même jeton de montant que les prix et que les indicateurs :
                `text-2xl` valait 24 px pour UN nombre, et `sm:text-[2rem]` 32
                pour le même. Deux tailles de plus dans la page, aucune ailleurs. */}
            <p className="numeric mt-2 text-kpi leading-none font-medium">
              {money(kpis.collected, { round: true })}
            </p>
          </div>
          {/* Couleurs de statut rétablies. Le motif retenu pour ce produit —
              une landing d'exploitation — les prescrit explicitement : « data-
              dense but scannable », vert / ambre / rouge. Sans elles, la carte
              perdait ce qu'elle est censée démontrer : qu'un coup d'œil suffit
              à situer un parc. La règle de l'accent unique valait pour le
              discours de la page, pas pour l'échantillon de produit qu'elle
              montre. */}
          <StatusPill tone="ok" size="sm">
            {t('marketing.metrics.percent', { value: partEncaissee })}
          </StatusPill>
        </div>

        <div className="mt-6">
          <MiniBarChart
            bars={bars}
            caption={t('app.dashboard.chartTitle')}
            openPeriodNote={t('app.dashboard.openMonth')}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-divider pt-5">
          <MiniStat
            label={t('marketing.metrics.occupancy')}
            value={t('marketing.metrics.percent', { value: kpis.occupancy })}
            note={t('marketing.metrics.occupancyNote', {
              occupied: kpis.occupied,
              total: UNITS.length,
            })}
          />
          <MiniStat
            label={t('marketing.metrics.overdue')}
            value={money(kpis.outstanding, { round: true })}
            note={t('marketing.metrics.overdueNote', { count: doivent.length })}
          />
        </div>
      </div>

      {/* La mention existait au dictionnaire, traduite, et n'était rendue nulle
          part : la carte donnait donc des chiffres de parc sans dire de quel
          parc. Elle est ce qui autorise la carte à être précise — un chiffre
          exact sur un parc nommé fictif n'induit personne en erreur, un chiffre
          exact sans provenance se lit comme une moyenne de marché. */}
      <p className="mt-3 text-body text-muted">{t('marketing.metrics.note')}</p>

      {/* Une vignette « Relances envoyées » flottait au-dessus de la carte.
          Elle a changé de place trois fois : sur les chiffres d'occupation,
          puis sur le graphe une fois celui-ci devenu interrogeable, puis sur la
          rangée de KPI. Un élément qui n'a de place nulle part n'a pas de
          place : les relances sont déjà nommées dans la grille des
          fonctionnalités, où elles ont leur propre entrée. « Elements
          minimal ». */}
    </div>
  )
}

function MiniStat({
  label,
  value,
  note,
  delta,
}: {
  label: string
  value: string
  note: string
  /**
   * Variation, quand le produit sait en calculer une.
   *
   * Les deux qui vivaient ici — « −8 pts » et « +95 000 » — étaient les
   * dernières survivantes de la constante écrite à la main : rien dans les
   * indicateurs ne porte d'écart mois à mois, faute d'un historique, si bien
   * qu'aucun calcul n'aurait pu les retrouver. Un indicateur qui ne peut pas
   * varier ment plus sûrement qu'un indicateur absent.
   */
  delta?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-muted">{label}</p>
      <p className="numeric mt-2 text-title-l font-medium">{value}</p>
      {/* Variation et effectif sur une seule ligne : empilés, ils faisaient
          quatre niveaux de lecture pour un chiffre. La ligne tient sans
          variation, qui est le cas de toutes les cartes aujourd'hui. */}
      <p className="mt-2 flex flex-wrap items-center gap-2">
        {delta}
        <span className="text-body text-muted">{note}</span>
      </p>
    </div>
  )
}
