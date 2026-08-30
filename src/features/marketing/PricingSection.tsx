import { forwardRef, useId, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { Section } from '@/components/layout/Section'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Badge } from '@/components/primitives/Badge'
import { SegmentedControl } from '@/components/primitives/Choice'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useCurrency } from '@/currency/CurrencyProvider'
import { formatMoney } from '@/currency/currencies'
import { useT } from '@/i18n/I18nProvider'
import { useNumbers } from '@/lib/numbers'
import { useAuDela, AU_DELA_LG } from '@/lib/useAuDela'
import { useOngletsAuClavier } from '@/components/primitives/ongletsAuClavier'
import {
  FEATURE_MATRIX,
  PLANS,
  UNITS_DEFAULT,
  UNITS_MAX,
  UNITS_MIN,
  exactPlanPrice,
  planPrice,
  priceIsRounded,
  type FeatureValue,
} from './pricing'

export function PricingSection() {
  const t = useT()
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [units, setUnits] = useState(UNITS_DEFAULT)

  /*
    ═══ TROIS PRIX QU'ON NE POUVAIT PAS COMPARER ═══

    Mesuré à 360 × 900 : les trois cartes empilées font 1 992 px, soit 18 % de
    toute la page d'accueil et plus de deux fenêtres pleines. Le premier prix et
    le troisième sont séparés de plus de 1 300 px — sur un téléphone, ON NE PEUT
    JAMAIS EN VOIR DEUX À LA FOIS. Une grille de tarifs a une seule fonction,
    comparer, et sous `lg` elle ne la remplissait pas : elle donnait trois
    brochures lues à une minute d'intervalle, ce qui demande au visiteur de
    retenir un montant pendant qu'il fait défiler le suivant.

    Le coût redoublait : `FEATURE_MATRIX` est imprimée UNE FOIS PAR PALIER. Les
    mêmes cinq libellés, à l'identique, trois fois — seul le signe change. En
    trois colonnes c'est une grille qui se lit par lignes ; en une colonne c'est
    une répétition.

    ═══ CE QUE LA RANGÉE D'ONGLETS CHANGE ═══

    Les trois paliers deviennent trois onglets portant CHACUN SON PRIX, côte à
    côte sur une seule ligne : la comparaison la plus décisive — combien —
    redevient possible d'un seul regard, ce qu'aucune version précédente ne
    permettait sous 1024 px. Le détail du palier choisi s'ouvre dessous.

    RIEN N'EST RETIRÉ. Les trois paliers restent à un geste, et le geste est
    celui du visiteur, pas un point de rupture qui décide pour lui. C'est la
    distinction que ce dépôt tient depuis `useAuDela` : un utilitaire responsif
    CACHE sans qu'on l'ait demandé ; un onglet REPLIE ce qu'on peut rouvrir.

    ═══ POURQUOI `useAuDela` ET NON `lg:hidden` ═══

    Parce que « caché » n'est pas « absent ». Monter les trois panneaux et n'en
    peindre qu'un laisserait la matrice trois fois dans le document — donc trois
    fois pour un lecteur d'écran, qui ne voit pas `display:none` comme une
    simplification mais lit ce qu'on lui donne. Le seuil est `lg` et non `sm`
    parce que c'est là que la grille passe à trois colonnes : entre les deux, un
    seul panneau reste la bonne réponse.

    L'onglet ouvert par défaut est le palier MIS EN AVANT, pas le premier. C'est
    déjà celui que la grille lève de douze pixels et coiffe d'un `Badge` ; ouvrir
    autre chose ici ferait dire deux choses différentes à la même page.
  */
  const enGrille = useAuDela(AU_DELA_LG)
  const [palier, setPalier] = useState(() => PLANS.find((p) => p.popular)?.id ?? PLANS[0]!.id)
  const idOnglets = useId()
  const { auClavier, referencer } = useOngletsAuClavier(
    PLANS.map((p) => p.id),
    setPalier,
  )

  return (
    <Section
      id="pricing"
      // `ample`, et c'est la SEULE de la page. Tout ce qui précède amène ici :
      // c'est le seul endroit où le visiteur manipule quelque chose — le
      // curseur d'unités, la bascule mensuel/annuel — et le seul où il décide.
      // Lui donner le même temps qu'aux six autres sections revenait à dire
      // qu'on peut la parcourir comme le reste.
      rythme="ample"
      eyebrow={t('marketing.pricing.eyebrow')}
      title={t('marketing.pricing.title')}
      description={t('marketing.pricing.subtitle')}
      centered
    >
      <UnitSlider units={units} onChange={setUnits} />

      <div className="mt-8 mb-10 flex flex-wrap items-center justify-center gap-3">
        <SegmentedControl
          label={t('marketing.pricing.monthly')}
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'monthly', label: t('marketing.pricing.monthly') },
            {
              value: 'yearly',
              label: t('marketing.pricing.yearly'),
              badge: t('marketing.pricing.yearlySave'),
            },
          ]}
        />
        <CurrencySwitcher />
      </div>

      {enGrille ? (
        /*
          LES TROIS CARTES FONT UNE GRILLE, pas trois hauteurs libres.

          `items-start` laissait chacune à sa hauteur naturelle. Mesuré à
          1440 px, la carte « Cabinet » finissait une centaine de pixels
          au-dessus de ses voisines : elle est la seule sans prix — « Sur
          devis » tient sur une ligne là où les deux autres empilent le montant,
          la mention mensuelle, la formule par unité et l'essai. Le palier le
          plus engageant se détachait donc du trio, et son bouton flottait seul
          en l'air.

          Sans `items-start`, les trois s'étirent à la hauteur de la rangée.
          Rien d'autre n'est à faire : la liste des fonctions porte déjà
          `flex-1`, c'est donc elle qui absorbe la place rendue, et les trois
          « Commencer » se retrouvent sur la même ligne. Un tableau comparatif
          se compare par ses lignes ; celle des boutons est la dernière et la
          plus décisive.

          Le décalage voulu de la carte mise en avant survit — `lg:-mt-3` la
          lève toujours de douze pixels au-dessus des deux autres, qu'elle
          dépasse désormais en haut sans les dépasser en bas.
        */
        /*
          LES SIX BANDES SONT DES RANGÉES PARTAGÉES, et c'est ce qui rend la
          grille comparable.

          Une grille de prix existe pour qu'on lise EN TRAVERS : « Relances »
          chez l'un, en face de « Relances » chez les deux autres. Mesuré avant
          ce lot : les cinq lignes de caractéristiques étaient décalées de
          103 px d'une carte à l'autre, dans les deux langues. Le bloc de prix
          n'a pas la même hauteur partout — la mention d'arrondi n'existe que
          sur un palier, l'essai n'existe pas sur celui qui est sur devis — et
          tout ce qui suit glissait d'autant. L'œil devait faire lui-même le
          rapprochement que la page promet.

          `grid-rows-subgrid` est exactement l'outil de ce problème : chaque
          carte reprend les rangées de la grille au lieu d'empiler les siennes,
          donc la hauteur d'une bande est celle de la plus haute des trois, pour
          les trois. Six bandes : titre, accroche, prix, socle commun,
          caractéristiques, action.

          `1fr` SUR LA CINQUIÈME : c'est la liste qui absorbe le reste, pour que
          les trois actions finissent à la même hauteur — elles le faisaient
          déjà par `flex-1`, et ce serait le premier alignement perdu.

          EMPILÉES, RIEN DE TOUT CELA : sous `lg` il n'y a pas de rangées
          communes, la question ne se pose pas, et les cartes restent en
          colonne flexible.
        */
        <div
          data-mesure="tarifs-grille"
          className="grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto_1fr_auto]"
        >
          {PLANS.map((plan) => (
            <CartePalier key={plan.id} plan={plan} period={period} units={units} />
          ))}
        </div>
      ) : (
        <div data-mesure="tarifs-onglets">
          {/*
            LA RANGÉE PORTE LES PRIX, ET C'EST TOUT L'INTÉRÊT.

            Un onglet nommé « Pro » seul n'aurait fait qu'économiser du
            défilement. Le montant sous le nom est ce qui rend la comparaison
            possible : les trois tiennent sur une ligne de 360 px, et l'écart
            entre deux paliers se lit sans rien ouvrir.

            `grid-cols-3` et non une rangée qui défile : trois éléments qu'il
            faudrait faire glisser pour voir le dernier ramèneraient exactement
            le défaut qu'on corrige.
          */}
          <div
            role="tablist"
            aria-label={t('marketing.pricing.title')}
            className="grid grid-cols-3 gap-1.5"
          >
            {PLANS.map((plan, index) => (
              <BoutonDePalier
                key={plan.id}
                plan={plan}
                period={period}
                units={units}
                actif={plan.id === palier}
                id={`${idOnglets}-onglet-${plan.id}`}
                aria-controls={`${idOnglets}-panneau-${plan.id}`}
                ref={(n) => referencer(index, n)}
                onClick={() => setPalier(plan.id)}
                onKeyDown={(e) => auClavier(e, index)}
              />
            ))}
          </div>

          <div className="mt-4">
            {PLANS.filter((plan) => plan.id === palier).map((plan) => (
              <CartePalier
                key={plan.id}
                plan={plan}
                period={period}
                units={units}
                idPanneau={`${idOnglets}-panneau-${plan.id}`}
                idOnglet={`${idOnglets}-onglet-${plan.id}`}
              />
            ))}
          </div>
        </div>
      )}

      <p className="mx-auto mt-8 flex max-w-xl items-start justify-center gap-2 text-body text-muted">
        <Icon name="info" size={15} className="mt-0.5 shrink-0 text-accent-ink" />
        {t('marketing.pricing.currencyNote')}
      </p>
    </Section>
  )
}

/**
 * UN ONGLET DE PALIER : son nom, son prix, et rien d'autre.
 *
 * Le prix est recalculé ici plutôt que passé en argument : c'est le MÊME appel
 * que celui de la carte, sur les mêmes entrées, et le dupliquer créerait deux
 * chemins vers un nombre qui doit être un seul. `planPrice` est pur.
 */
const BoutonDePalier = forwardRef<
  HTMLButtonElement,
  {
    plan: (typeof PLANS)[number]
    period: 'monthly' | 'yearly'
    units: number
    actif: boolean
    id: string
    'aria-controls': string
    onClick: () => void
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
  }
>(function BoutonDePalier({ plan, period, units, actif, ...reste }, ref) {
  const t = useT()
  const { currency } = useCurrency()
  const price = planPrice(plan, currency, period, units)

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={actif}
      /* Un seul arrêt de tabulation pour tout le groupe : voir
         `useOngletsAuClavier`, qui porte le raisonnement. */
      tabIndex={actif ? 0 : -1}
      className={cn(
        'flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-2.5',
        'transition-colors duration-150',
        actif
          ? /* L'onglet courant se distingue par sa SURFACE et sa bordure, pas
               par une couleur d'accent seule : l'état sélectionné doit rester
               lisible en monochrome comme pour un daltonien. */
            'border-ink bg-surface shadow-e2'
          : 'border-divider bg-surface-sunken text-muted hover:border-border-strong',
      )}
      {...reste}
    >
      <span className={cn('text-label font-semibold', actif && 'text-ink')}>
        {t(`marketing.pricing.${plan.id}.name` as 'marketing.pricing.pro.name')}
      </span>
      {/* PAS DE `whitespace-nowrap`, ET C'EST DÉLIBÉRÉ.

          Mesuré au pire cas — 60 unités, en FCFA, le seul symbole à quatre
          lettres du dépôt : « 11 500 FCFA » occupe 85 px dans les 89 que laisse
          un tiers de 360. Quatre pixels. Une marge pareille n'est pas une
          marge : elle tient tant que la police, le chiffre ou le symbole ne
          bougent pas d'un cran, et le dépôt a déjà vu trois pixels d'écart
          entre le serveur de développement et le paquet construit.

          Sans `nowrap`, le cas extrême passe sur deux lignes — les trois onglets
          grandissant ensemble, puisqu'ils sont les cellules d'une même rangée de
          grille. On échange une garantie contre vingt pixels dans le seul cas
          où l'on paierait autrement un débordement. */}
      <span
        className={cn('numeric text-body font-medium', actif ? 'text-ink' : 'text-muted')}
      >
        {price === null
          ? t('marketing.pricing.quote')
          : formatMoney(price, currency, { compact: true })}
      </span>
    </button>
  )
})

/**
 * LA CARTE D'UN PALIER, une seule rédaction pour les deux dispositions.
 *
 * Elle était écrite en ligne dans la grille. Sortie telle quelle — aucun de ses
 * choix n'a bougé — pour que la rangée d'onglets et la grille de trois colonnes
 * montrent LA MÊME carte : deux rédactions divergeraient au premier ajout, et le
 * palier ne se lirait plus pareil selon la largeur de l'écran.
 *
 * `idPanneau` absent vaut « je suis dans la grille » : la carte n'est alors le
 * panneau de personne, et ne prend ni `role` ni arrêt de tabulation.
 */
function CartePalier({
  plan,
  period,
  units,
  idPanneau,
  idOnglet,
}: {
  plan: (typeof PLANS)[number]
  period: 'monthly' | 'yearly'
  units: number
  idPanneau?: string
  idOnglet?: string
}) {
  const t = useT()
  const { currency } = useCurrency()
  const price = planPrice(plan, currency, period, units)
  const exact = exactPlanPrice(plan, currency, period, units)
  const popular = plan.popular

  return (
    <article
      id={idPanneau}
      role={idPanneau ? 'tabpanel' : undefined}
      aria-labelledby={idOnglet}
      /* `tabIndex={0}` sur un panneau d'onglets DÉFILANT : sans lui, un
         panneau plus haut que la fenêtre ne peut pas être défilé au clavier
         seul, la tabulation sautant directement à ses liens. La condition est
         le mode onglets — hors de lui, l'article n'est qu'une carte parmi
         trois, et un arrêt de tabulation de plus serait du bruit. */
      tabIndex={idPanneau ? 0 : undefined}
      className={cn(
        /* `lg:grid` prend le pas sur `flex` : voir le commentaire de la grille.
           En colonne — sous `lg` — la carte reste une pile flexible, où
           `flex-1` sur la liste tient l'action en bas. */
        'relative flex flex-col rounded-lg border p-6',
        'lg:grid lg:grid-rows-subgrid lg:row-span-6',
        popular
          ? 'border-ink bg-surface shadow-e2 lg:-mt-3 lg:pb-8'
          : 'border-divider bg-surface shadow-e1',
      )}
    >
      {popular && (
        <span className="absolute -top-3 left-6">
          <Badge tone="dark">{t('marketing.pricing.popular')}</Badge>
        </span>
      )}

      <h3 className="title-l">
        {t(`marketing.pricing.${plan.id}.name` as 'marketing.pricing.pro.name')}
      </h3>
      {/* `min-h-10` EST PARTI : il réservait deux lignes pour que les accroches
          finissent à la même hauteur d'une carte à l'autre. C'est exactement ce
          que la rangée partagée fait maintenant, et mieux — elle prend la
          hauteur de la plus haute au lieu d'un minimum posé à la main, qui
          gaspillait seize pixels quand les trois tenaient sur une ligne. */}
      <p className="mt-1.5 text-body text-muted">
        {t(`marketing.pricing.${plan.id}.pitch` as 'marketing.pricing.pro.pitch')}
      </p>

      <div className="mt-5 border-y border-divider py-5">
        {price === null || !plan.pricing ? (
          <p className="title-l">
            {t('marketing.pricing.quote')}
          </p>
        ) : (
          <>
            {/* Un prix rond s'affiche sans décimales : « 13 $ » plutôt
                que « 13,00 $ ». */}
            {/* `text-kpi` et non un littéral de 2,25rem : c'est le
                jeton des MONTANTS — celui des indicateurs du tableau de
                bord —, et le prix en est un. Le littéral apportait une
                taille de plus (36 px) qui n'existait nulle part
                ailleurs, pour deux nombres. */}
            <p className="numeric text-kpi leading-none font-medium">
              {formatMoney(price, currency, { compact: true })}
            </p>
            <p className="mt-2 text-body text-muted">
              {t('common.perMonth')}
              {period === 'yearly' && ` · ${t('marketing.pricing.yearly').toLowerCase()}`}
            </p>

            {/* La formule est affichée : le prix doit être vérifiable
                par le prospect, pas seulement constaté. */}
            <p className="mt-3 flex items-center gap-1.5 text-caps text-accent-ink">
              <Icon name="building" size={13} />
              {t('marketing.pricing.perUnitNote', {
                /* `round: Number.isInteger(...)` visait « 4 € » plutôt que
                   « 4,00 € ». Sur une grille en unités MINEURES le test est
                   toujours vrai, donc l'option était toujours posée : c'est la
                   forme compacte, et elle porte désormais cette règle. */
                base: formatMoney(plan.pricing.base[currency], currency, { compact: true }),
                perUnit: formatMoney(plan.pricing.perUnit[currency], currency),
              })}
            </p>

            {/* Signalé seulement quand l'écart existe : l'afficher sur
                chaque carte en ferait un bruit qu'on cesse de lire, et
                la mention perdrait justement sa valeur là où elle
                compte. */}
            {priceIsRounded(plan, currency, period, units) && (
              <p className="mt-1.5 text-body text-muted">
                {t('marketing.pricing.roundingNote', {
                  exact: formatMoney(exact ?? 0, currency, { compact: true }),
                })}
              </p>
            )}
          </>
        )}

        {price !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-body text-muted">
            <Icon name="checkCircle" size={14} />
            {t('marketing.pricing.trial')}
          </p>
        )}
      </div>

      {/* Le socle commun est énoncé une fois, en prose, plutôt que
          répété en quatre coches identiques sur chaque carte. */}
      <p className="mt-5 flex items-start gap-2 text-body text-pretty text-muted">
        <Icon
          name="check"
          size={14}
          strokeWidth={2.2}
          className="mt-0.5 shrink-0 text-accent-ink"
        />
        {t('marketing.pricing.allIncluded')}
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-divider pt-5">
        {FEATURE_MATRIX.map((row) => (
          <FeatureLine key={row.key} featureKey={row.key} value={row.values[plan.id]} />
        ))}
      </ul>

      {/*
        « NOUS CONTACTER » NE MENAIT NULLE PART.

        Le palier sur devis — le plus cher, et le seul sans prix — offrait
        ce bouton vers `/#faq`. Deux défauts empilés. L'ancre d'abord :
        rien dans le dépôt ne recale la page sur le fragment d'une adresse,
        `grep -rn hash src/` ne rend pas une ligne, et le prospect
        atterrissait donc en haut de la page qu'il venait de quitter. Le
        fond ensuite : la FAQ ne porte aucun canal de contact — ni adresse,
        ni formulaire, ni numéro, et le dépôt entier n'en porte aucun. Le
        seul geste du palier le plus engageant promettait une conversation
        qui n'existe pas.

        Il mène désormais là où mènent les deux autres, et le dit avec le
        même mot. C'est aussi vrai pour Cabinet que pour Pro : aucun palier
        n'est facturé aujourd'hui, l'inscription ouvre le même espace, et
        « Sur devis » reste écrit juste au-dessus — le prospect n'apprend
        pas son prix en cliquant, il ne l'apprenait pas davantage avant.
        Fabriquer une adresse de contact aurait été le mensonge suivant.
      */}
      <Button
        className="mt-6"
        size="lg"
        fullWidth
        variant={popular ? 'primary' : 'secondary'}
        to="/inscription"
      >
        {t('marketing.pricing.cta')}
      </Button>
    </article>
  )
}

/**
 * Sélecteur du nombre d'unités.
 *
 * Le prix se calcule à l'unité près : le prospect doit pouvoir lire SON prix,
 * pas celui d'un palier dans lequel il devine se ranger. Un `input[type=range]`
 * natif donne la navigation clavier par flèches et l'annonce de la valeur sans
 * code supplémentaire ; `aria-valuetext` remplace le nombre nu par « 12 unités »
 * à la lecture d'écran.
 */
function UnitSlider({ units, onChange }: { units: number; onChange: (n: number) => void }) {
  const t = useT()
  const id = useId()
  const atMax = units >= UNITS_MAX
  const progress = ((units - UNITS_MIN) / (UNITS_MAX - UNITS_MIN)) * 100

  return (
    <div className="mx-auto max-w-xl">
      <label htmlFor={id} className="block text-label font-semibold text-ink">
        {t('marketing.pricing.unitsSelector')}
      </label>

      <div className="mt-3 flex items-center gap-4">
        <input
          id={id}
          type="range"
          min={UNITS_MIN}
          max={UNITS_MAX}
          value={units}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={
            atMax
              ? t('marketing.pricing.unitsValueMax', { count: units })
              : t('marketing.pricing.unitsValue', { count: units })
          }
          className={cn(
            'h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent',
            // La piste est peinte en dégradé dur : la portion parcourue en
            // `--color-accent`, le bleu de l'action, le reste en bordure. Deux
            // préfixes, faute d'API commune.
            '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full',
            '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full',
            '[&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:size-5',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface',
            '[&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-e1',
            '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface',
            '[&::-moz-range-thumb]:bg-ink',
          )}
          style={{
            // Variable consommée par les deux pseudo-éléments de piste.
            backgroundImage: `linear-gradient(to right, var(--color-accent) ${progress}%, var(--color-border) ${progress}%)`,
            backgroundSize: '100% 6px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        <output
          htmlFor={id}
          className="numeric w-24 shrink-0 text-right title-m"
        >
          {atMax
            ? t('marketing.pricing.unitsValueMax', { count: units })
            : t('marketing.pricing.unitsValue', { count: units })}
        </output>
      </div>

      <p className="mt-1 text-body text-muted">{t('marketing.pricing.unitsHint')}</p>
    </div>
  )
}

function FeatureLine({ featureKey, value }: { featureKey: string; value: FeatureValue }) {
  const t = useT()
  const n = useNumbers()
  const label = t(`marketing.pricing.features.${featureKey}` as 'marketing.pricing.features.rent')

  const included = value !== false
  let detail: string | null = null

  /*
    CHAQUE VALEUR PASSE PAR LE DICTIONNAIRE OU PAR LE FORMATEUR DE NOMBRES.

    La chaîne finissait par `else if (typeof value === 'string') detail = value`
    — la donnée rendue telle quelle. Une seule valeur en profitait, et elle
    suffit : `'illimité'` s'affichait en français dans la grille anglaise.

    L'union de `FeatureValue` est close depuis, donc l'exhaustivité de cette
    chaîne est vérifiée par le compilateur : ajouter une valeur sans lui donner
    sa clé ne compile plus.

    Le NOMBRE est le seul cas qui ne se traduit pas — il se FORMATE, et par le
    formateur de la langue : « 1 000 » et « 1,000 » ne s'écrivent pas pareil, et
    un palier à mille gestionnaires n'est pas absurde.
  */
  if (value === 'manual') detail = t('marketing.pricing.features.remindersManual')
  else if (value === 'auto') detail = t('marketing.pricing.features.remindersAuto')
  else if (value === 'email') detail = t('marketing.pricing.features.supportEmail')
  else if (value === 'priority') detail = t('marketing.pricing.features.supportPriority')
  else if (value === 'dedicated') detail = t('marketing.pricing.features.supportDedicated')
  else if (value === 'unlimited') detail = t('marketing.pricing.features.managersUnlimited')
  else if (typeof value === 'number') detail = n.integer(value)

  return (
    <li
      // Marqué pour la mesure : la règle « un seul signe pour l'exclusion » ne
      // veut rien dire s'il n'y a aucune exclusion à l'écran. C'est le marqueur
      // qui permet à la garde de vérifier qu'elle a bien quelque chose à
      // regarder avant de conclure qu'elle n'a rien vu.
      data-inclus={included ? 'oui' : 'non'}
      className={cn('flex items-start gap-2.5 text-body', !included && 'text-muted')}
    >
      {/* Inclus / non inclus repose sur la forme de l'icône, pas sur sa
          couleur — ce qui rend le passage au monochrome sans conséquence pour
          la compréhension. Le vert a laissé place à l'encre : le style retenu
          n'admet qu'un seul accent, et cet accent est le bleu de
          `--color-accent`, qui a succédé à l'or de marque sans que la règle
          change — c'est le NOMBRE d'accents qui la fonde, jamais la teinte. */}
      <Icon
        name={included ? 'check' : 'close'}
        size={16}
        strokeWidth={included ? 2.2 : 1.7}
        className={cn('mt-0.5 shrink-0', included ? 'text-ink' : 'text-muted-soft')}
      />
      {/*
        UN SEUL SIGNE POUR L'EXCLUSION, et la rature n'est pas le bon.

        Les lignes non incluses portaient une croix ET une barre de texte. Deux
        signes pour un message, dont un qui en dit un autre : une croix dit
        « non inclus dans ce palier », une rature dit « supprimé », « obsolète »,
        « annulé ». Sur une grille de tarifs, la seconde lecture est active — le
        prospect peut comprendre que la fonction a été RETIRÉE du produit, pas
        qu'elle vit un cran plus haut. C'est précisément le contraire de ce que
        cette grille doit lui faire comprendre, puisqu'elle vend la montée.

        La croix reste, et elle suffit : elle repose sur la FORME et non sur la
        couleur, ce qui la garde lisible en monochrome comme pour un daltonien.
        Le `text-muted` de la ligne l'appuie sans porter le sens à lui seul.
      */}
      <span>
        {label}
        {detail && <span className="ml-1.5 text-caps text-muted">{detail}</span>}
      </span>
    </li>
  )
}
