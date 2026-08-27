import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from './gouttiere'
import { Logo } from '@/components/primitives/Logo'
import { Icon } from '@/components/primitives/Icon'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { useT } from '@/i18n/I18nProvider'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export interface AuthLayoutProps {
  title: string
  /**
   * Titre de l'onglet, quand celui de la page ne suffit pas à situer.
   * L'assistant d'inscription s'en sert : son `title` est celui de l'étape
   * courante — « Vos informations » seul ne dit pas qu'on crée un compte.
   */
  documentTitle?: string
  subtitle?: string
  children: ReactNode
  /** Pied de carte : lien vers l'autre parcours. */
  footer?: ReactNode
  /** Élargit la colonne pour l'assistant d'inscription. */
  wide?: boolean
  /** Contenu au-dessus du titre : fil d'étapes, retour. */
  above?: ReactNode
}

/**
 * Gabarit des pages d'authentification : deux colonnes sur grand écran,
 * une seule sur mobile où le panneau de marque passe en simple bandeau.
 */
export function AuthLayout({
  title,
  documentTitle,
  subtitle,
  children,
  footer,
  wide,
  above,
}: AuthLayoutProps) {
  const t = useT()
  useDocumentTitle(documentTitle ?? title)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <BrandPanel />

      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        {/* `flex-wrap` : la rangée porte le retour à l'accueil ET trois
            sélecteurs — langue, devise, thème. Le troisième, ajouté avec le
            mode sombre, a fait passer la somme au-delà de 375 px et la page
            entière débordait de 79 px en largeur, sur les écrans les plus
            étroits du marché visé. Le retour à la ligne coûte une rangée sur
            un téléphone et rien du tout ailleurs ; réduire les sélecteurs
            aurait rogné des cibles tactiles déjà calées sur 44 px. */}
        <header className={cn('flex flex-wrap items-center gap-3 py-4', GOUTTIERE_LATERALE)}>
          {/* Ce lien portait `lg:hidden` : sur ordinateur, il n'existait pas.
              Et le logo du panneau de marque n'était pas cliquable. Les pages
              d'authentification étaient donc un cul-de-sac — on y entrait
              depuis la landing sans pouvoir y revenir autrement que par le
              bouton du navigateur.

              Il est maintenant visible partout. Le logo renvoie lui aussi à
              l'accueil, par convention, mais il vit dans le panneau sombre à
              l'autre bout de l'écran : l'issue doit être dans la colonne où se
              trouve le formulaire, pas à côté.

              `backToHome` et non `back` : dans l'inscription, « Retour » ramène
              à l'étape précédente. Deux destinations, deux libellés. */}
          <Link
            to="/"
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-muted no-underline transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
          >
            <Icon name="chevronLeft" size={16} />
            {t('common.backToHome')}
          </Link>

          {/* `flex-wrap justify-end`, et ce n'est pas une invention : c'est mot
              pour mot la rangée d'`AppShell`, qui la porte deux fois — dont la
              barre haute, avec les MÊMES trois sélecteurs, et qui ne déborde pas
              à 320 px. L'en-tête au-dessus savait déjà se replier ; cette
              rangée-ci, non, et c'est elle qui débordait.

              Ses trois sélecteurs portent chacun `shrink-0` : 96 px pour la
              langue et 142 px pour le thème — deux segmentés de boutons à 44 px,
              bordure et rembourrage compris —, 84 px pour la devise, plus deux
              écarts de 8. Soit 338 px de min-content que rien ne pouvait
              entamer. Le repli de l'en-tête descendait donc la rangée à la
              ligne, où elle réclamait 20 + 338 = 358 px dans une fenêtre de 320.
              Mesuré `scrollX=38` sur les quatre écrans d'authentification et
              dans les DEUX langues — pas une affaire de longueur de libellé,
              une rangée qui ne savait pas se couper.

              Replier plutôt que rétrécir : le plancher de 44 px est gardé par
              `cibles.test.ts`, et les trois sélecteurs y sont calés au plus
              juste. Plutôt que masquer, aussi — `AppShell` retire bien la devise
              et le thème sous `sm`, mais il alignait QUATRE commandes et près de
              500 px ; ici trois tiennent dès que la rangée se coupe, et un
              contrôle absent de 320 à 639 px coûterait plus que la ligne qu'il
              économise.

              CE QU'IL EN COÛTE, écrit plutôt que tu : une rangée de plus, 58 px,
              à 320, 360 et 375 px. À 360 la rangée finissait 2 px avant le bord
              physique au lieu des 20 px de gouttière — le repli lui rend aussi
              cette marge-là. À partir de 414 px elle tient sur une ligne et rien
              ne bouge.

              `justify-end` va avec `ml-auto` : sans lui, les lignes repliées
              s'alignent à GAUCHE d'un bloc devenu large de toute la colonne, et
              la rangée saute d'un bord à l'autre en se coupant. */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher />
            <ThemeSwitcher />
          </div>
        </header>

        {/*
          LE FORMULAIRE SE CENTRE, au lieu d'être épinglé en haut.

          Mesuré avant ce lot, à 2000 × 1090 sur `/connexion` : la carte allait
          de 98 à 576 px et laissait 514 px de crème vide en dessous, épinglée
          en haut par `items-start` pendant que la colonne de marque, elle,
          collait son argumentaire tout en bas de ses 1090 px. Les deux colonnes
          étaient déséquilibrées, chacune dans le sens opposé de l'autre, et
          elles se tournaient le dos. Après : leurs milieux tombent à 5 px l'un
          de l'autre — 562 contre 567 à 1920 × 1090.

          `my-auto` PLUTÔT QU'`items-center`, ET IL FAUT DIRE POURQUOI, parce
          que le pourquoi habituel est faux ici. On lit partout que le centrage
          par `align-items` rogne le haut d'un enfant trop grand, hors
          d'atteinte du défilement. C'est vrai d'un conteneur de hauteur FIXE ;
          ce n'en est pas un. Vérifié au navigateur à 1440 × 620 sur
          `/inscription`, la plus haute des cartes : avec `items-center`, et
          même après avoir remplacé `min-h-dvh` par `h-dvh`, le formulaire
          commence toujours à 98 px. Un élément flexible garde `min-height:
          auto` — il ne descend jamais sous son contenu, la place libre n'est
          donc jamais négative, et les deux écritures rendent le même pixel.

          Le choix se fait donc sur autre chose, et c'est un argument plus
          faible qu'on ne l'écrit d'ordinaire : la marge automatique porte
          l'intention SUR L'ENFANT qui se centre, et reste juste le jour où
          l'une des trois conditions ci-dessus tombe. Elle ne nous sauve de rien
          aujourd'hui. C'est la garde de `mesure-ui` qui tient l'axe, et elle le
          tient en le mesurant plutôt qu'en faisant confiance à une classe.
        */}
        <main
          data-mesure="auth-cadre"
          className={cn('flex flex-1 justify-center pt-4 pb-16', GOUTTIERE_LATERALE)}
        >
          <div
            data-mesure="auth-formulaire"
            className={cn('my-auto w-full', wide ? 'max-w-3xl' : 'max-w-md')}
          >
            {above}

            {/* `display-app` et non `display-m` : un formulaire est une tâche,
                pas une déclaration. À 52px, « Content de vous revoir »
                disputait l'attention aux champs qu'il surplombe. Le panneau de
                marque à gauche garde le grand corps — c'est lui qui parle. */}
            <h1 className="display-app text-balance">{title}</h1>
            {subtitle && <p className="mt-3 text-body-l text-pretty text-muted">{subtitle}</p>}

            <div className="mt-8">{children}</div>

            {footer && (
              <div className="mt-8 border-t border-border pt-6 text-body text-muted">{footer}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

/**
 * Colonne de marque : bandeau sur mobile, panneau plein sur grand écran.
 *
 * Ramenée de 42 % à 34 % de la largeur. L'argumentaire a fait son travail avant
 * qu'on commence à saisir : à la deuxième étape, il occupait presque la moitié
 * de l'écran pendant que le formulaire tenait dans une colonne étroite entourée
 * de vide. Ce qui persuade au premier regard encombre au troisième champ.
 */
function BrandPanel() {
  const t = useT()

  /**
   * Quatre promesses, et chacune doit être TENUE aujourd'hui.
   *
   * Cette colonne annonçait « Relances automatiques » sur la page où l'on crée
   * son compte. Le produit n'a aucune relance — ni automatique, ni manuelle.
   * C'est le pire endroit pour une promesse fausse : elle est lue au moment
   * précis où quelqu'un décide de s'engager, et sa déception arrive quelques
   * minutes plus tard, dans un espace vide.
   *
   * Les quatre retenues correspondent à ce que le produit sait faire de bout en
   * bout : suivi des loyers avec quittances, relevés d'eau et d'électricité,
   * cautions arbitrées, états des lieux. Les relances y reviendront le jour où
   * elles existeront.
   */
  const points = [
    'marketing.features.rent.title',
    'marketing.features.utilities.title',
    'marketing.features.deposits.title',
    'marketing.features.inspections.title',
  ] as const

  return (
    <div
      // Ce panneau est le PREMIER élément du document : sur mobile il coiffe la
      // colonne, sur grand écran il tient la gauche. Dans les deux cas il
      // touche le haut, et depuis `viewport-fit=cover` ce haut est le bord
      // physique — le logo passait sous la barre d'état. Rien ici n'est collant
      // ni fixe, mais l'encoche ne fait pas cette différence.
      //
      // `calc()` en haut : l'encre pleine doit remonter jusqu'au bord. `max()`
      // sur les côtés : en paysage cette bande occupe toute la largeur, et
      // l'encoche mord d'un côté ou de l'autre.
      className={cn(
        'on-dark relative flex shrink-0 flex-col overflow-hidden bg-ink text-on-dark',
        'pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6',
        'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
        'sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]',
        // La largeur ne bouge pas : `lg:w-[34%] lg:max-w-md` porte son propre
        // argumentaire, mesuré, un peu plus bas dans ce fichier.
        //
        // `lg:justify-between` en revanche est parti. Il poussait
        // l'argumentaire tout en bas du panneau : mesuré à 2000 × 1090, les
        // huit cents premiers pixels de cette bande sombre étaient vides et le
        // titre commençait là où le formulaire d'en face avait déjà fini. Deux
        // colonnes qui se tournent le dos. La répartition se fait maintenant
        // par les marges de l'argumentaire lui-même, qui savent, elles, ce
        // qu'il faut faire quand la place manque.
        'lg:w-[34%] lg:max-w-md',
        'lg:pt-[calc(2.5rem+env(safe-area-inset-top))] lg:pb-10',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 size-[30rem] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
      />

      <div className="relative">
        {/* Le logo ramène à l'accueil : c'est la convention, et elle vaut à
            toutes les tailles — sur mobile, ce bandeau est la seule partie du
            panneau de marque qui reste visible. */}
        <Logo tone="dark" size="md" to="/" />
      </div>

      {/* Argumentaire réservé au grand écran : sur mobile il repousserait le
          formulaire sous la ligne de flottaison.

          `lg:my-auto` — les mêmes marges automatiques que le formulaire d'en
          face, et pour la même raison : sur une fenêtre haute elles répartissent
          la place et l'argumentaire vient à hauteur de lecture ; sur une fenêtre
          courte elles s'effondrent et il se range sous le logo, sans jamais
          pousser quoi que ce soit hors du cadre. `mt-auto` seul ne savait faire
          que la moitié du travail : coller en bas, quelle que soit la hauteur.

          Un écart minimal sous le logo, sinon la marge automatique pourrait le
          laisser toucher l'argumentaire au pixel près sur la fenêtre exacte où
          elle s'annule. */}
      <div data-mesure="marque-argument" className="relative mt-12 hidden lg:my-auto lg:block">
        <p className="display-m max-w-sm text-balance text-on-dark">{t('brand.tagline')}.</p>

        <ul className="mt-8 flex flex-col gap-3">
          {points.map((key) => (
            <li key={key} className="flex items-center gap-3 text-body text-on-dark-muted">
              <Icon name="check" size={16} strokeWidth={2.2} className="shrink-0 text-accent-on-dark" />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
