import { cn } from '@/lib/cn'
import { Card } from '@/components/primitives/Card'
import { Section } from '@/components/layout/Section'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

/*
  ═══ SIX CARTES IDENTIQUES NE SONT PAS UNE LISTE DE PRIORITÉS ═══

  La grille était `sm:grid-cols-2 lg:grid-cols-3` : six tuiles de même largeur,
  de même hauteur, de même poids typographique. Une telle grille dit « voici six
  choses » et rien de plus — or ces six chantiers ne valent pas la même chose
  pour un visiteur. Le suivi des loyers est la raison pour laquelle on ouvre le
  produit ; les cautions sont ce qu'on découvre au troisième mois.

  ═══ ET LA HAUTEUR N'EST PAS NÉGOCIABLE ═══

  La première version de ce lot posait un pas de SIX colonnes, en trois rangées
  de deux tuiles. Elle dessinait bien la hiérarchie et coûtait 230 px : trois
  rangées là où il y en avait deux. `plafond-vitrine` l'a refusée, et il a
  raison de le faire — la vitrine est le seul écran que voit un visiteur sans
  compte, et une page de vente qui s'allonge d'un dixième pour mieux se
  présenter s'est trompée de compromis.

  Le pas de DOUZE colonnes rend les deux à la fois. Trois tuiles par rangée dont
  les largeurs diffèrent — 5, 4 et 3 douzièmes —, donc DEUX rangées comme avant,
  et une asymétrie que six colonnes ne pouvaient pas produire : une rangée de
  trois tuiles sur six colonnes ne peut valoir que 2+2+2.

  Les largeurs suivent la LONGUEUR DU PROPOS, jamais l'inverse. Les deux tuiles
  de cinq douzièmes ouvrent chacune leur rangée et portent les deux chantiers
  qu'on vient chercher — les loyers, les états des lieux ; les tuiles de trois
  portent les deux textes les plus courts, qui seraient creux plus larges.

  `large` n'est pas « plus large » : c'est le fait de conception qui autorise la
  mise en page horizontale — pastille à gauche, texte à droite — sur les tuiles
  qui ont la place de la porter. Une règle qui le déduirait de `span` se
  tromperait le jour où une tuile de quatre douzièmes doit rester verticale.
*/
const FEATURES: { key: string; icon: IconName; span: string; large: boolean }[] = [
  { key: 'rent', icon: 'card', span: 'lg:col-span-5', large: true },
  { key: 'reminders', icon: 'bell', span: 'lg:col-span-4', large: false },
  { key: 'utilities', icon: 'droplet', span: 'lg:col-span-3', large: false },
  { key: 'inspections', icon: 'clipboard', span: 'lg:col-span-5', large: true },
  { key: 'works', icon: 'wrench', span: 'lg:col-span-4', large: false },
  { key: 'deposits', icon: 'shield', span: 'lg:col-span-3', large: false },
]

export function FeatureGrid() {
  const t = useT()

  return (
    <Section
      id="features"
      // `suite` : cette section RÉPOND à celle qui la précède — « Le problème »
      // pose quatre frictions, celle-ci nomme ce qui les traite. Les séparer de
      // 256 px comme deux étapes distinctes faisait perdre le lien ; on ne
      // resserre que le HAUT, pour lier sans déplacer le mouvement.
      rythme="suite"
      eyebrow={t('marketing.features.eyebrow')}
      title={t('marketing.features.title')}
      description={t('marketing.features.subtitle')}
    >
      {/* Les cartes reviennent, mais construites.
          Une passe précédente les avait réduites à un filet, au nom de
          « elements minimal ». Six blocs de texte flottants ne se comparent
          pas : sans surface, l'œil ne sait plus où commence et où finit une
          fonctionnalité, et la page se lit comme un document. La surface est
          ici une aide à la lecture, pas un ornement.
          Ce qui a changé par rapport à la version d'origine : le rembourrage
          passe de 24 à 32px, l'élévation est plus discrète au repos, et le
          survol soulève la carte au lieu de seulement changer sa bordure. */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12">
        {/* `Card` avec `as="article"` : ces six cartes portent chacune un titre
              et un corps, donc un rôle `article` qu'un `<div>` leur retirerait.
              `flush` plus un rembourrage explicite, et jamais `className="p-7"`
              seul : `cn` concatène sans fusionner, le `sm:p-5` de la primitive
              serait émis APRÈS et ferait tomber le rembourrage à 20 px au-delà
              de 640. Mesuré par l'audit, pas supposé. */}
        {FEATURES.map(({ key, icon, span, large }) => (
          <Card
            as="article"
            flush
            elevation="e1"
            key={key}
            className={cn(
              /* `p-6 sm:p-7`, COMME LES CARTES DE RÔLES. Les trois familles de
                 cartes de la page tenaient trois rembourrages différents —
                 28/32 ici, 28/32 aux rôles, 20 aux engagements — sans qu'aucun
                 ne dise pourquoi. Les rôles sont passés à 24/28 dans le même
                 lot, pour la hauteur ; garder 28/32 ici en aurait fait deux
                 densités de carte à trois sections d'écart. Six tuiles au
                 téléphone, cela vaut 96 px. */
              'group p-6 sm:p-7',
              span,
              'transition-[transform,box-shadow,border-color] duration-200 ease-out',
              'hover:-translate-y-1 hover:border-border-strong hover:shadow-e2',
            )}
          >
            {/*
              ═══ LA PASTILLE PORTE L'ACCENT, ELLE NE L'EFFLEURE PLUS ═══

              Elle était `bg-accent-tint text-accent-ink` : un bleu très pâle
              portant un glyphe bleu. Sur une carte blanche posée sur un gris
              clair, cela fait TROIS valeurs voisines empilées — la page, la
              carte, la pastille — et le signe le plus fort de la section, celui
              qui doit se repérer d'un coup d'œil dans une grille de six,
              disparaissait dans le fond au lieu d'y ancrer l'œil.

              La pastille est maintenant l'accent PLEIN, glyphe en `on-accent`.
              Six ronds bleus donnent à la grille sa trame : on compte les
              fonctionnalités avant de les lire, ce qui est exactement ce qu'une
              grille de six doit permettre.

              LE SURVOL S'INVERSE EN CONSÉQUENCE. `bg-ink` + `accent-on-ink`
              gardait son sens tant que la pastille était pâle ; venant du bleu
              plein, passer à l'encre est un changement de teinte de plus. On
              assombrit donc l'accent lui-même — `accent-hover`, le jeton qui
              existe précisément pour cela — et la carte continue de se soulever.
            */}
            {/*
                LA TUILE LARGE CENTRE SON CONTENU, ET C'EST UNE CORRECTION
                MESURÉE. La hauteur d'une rangée est dictée par sa tuile la plus
                HAUTE — donc par la plus étroite, dont le texte se replie sur
                trois lignes. Alignée en haut, la tuile large laissait alors
                jusqu'à 110 px de blanc sous son paragraphe (relevé à 1440 px
                sur la rangée « Suivi des loyers / Relances ») : pas
                une respiration, un trou, et le trou tombait sur la tuile que la
                grille désigne comme la plus importante.

                Centrer ne comble pas le vide, il le RÉPARTIT : la paire pastille
                + texte retrouve un axe, et le blanc devient une marge haute et
                basse au lieu d'un fond de carte.

                Rien de tout cela sous 640 px, où toutes les tuiles ont la même
                largeur : une pastille posée à gauche d'un titre de deux lignes y
                reprendrait la place que la rangée venait de rendre.
            */}
            <div className={cn(large && 'sm:flex sm:h-full sm:items-center sm:gap-6')}>
            <span
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-lg',
                'bg-accent text-on-accent transition-colors duration-200',
                /* CE QUI ÉTAIT ÉCRIT ICI RESTE VRAI, et vaut d'être gardé : le
                   survol basculait vers `bg-ink`, dont la teinte s'inverse avec
                   le thème, alors que l'accent de marque ne bouge pas. La paire
                   tenait 7,04:1 au repos et tombait à 2,33:1 au survol en sombre
                   — le survol DÉGRADAIT la lisibilité. `accent-on-ink` était le
                   seul jeton portant une valeur par thème, donc le seul à suivre
                   l'encre partout où elle va.

                   Le problème ne se pose plus dans ces termes : la pastille est
                   désormais l'accent plein, et son survol reste dans la même
                   famille. `accent-hover` est le jeton de l'accent enfoncé — il
                   porte 6,70:1 sous du blanc, contre 5,17 au repos, donc le
                   survol AMÉLIORE le contraste au lieu de l'abîmer. */
                'group-hover:bg-accent-hover',
              )}
            >
              <Icon name={icon} size={22} />
            </span>

            <div className={cn('min-w-0', large ? 'mt-6 sm:mt-0' : 'mt-6')}>
              <h3 className="title-l text-balance">
                {t(`marketing.features.${key}.title` as 'marketing.features.rent.title')}
              </h3>
              <p className="mt-3 max-w-[58ch] text-body text-pretty text-muted">
                {t(`marketing.features.${key}.body` as 'marketing.features.rent.body')}
              </p>
            </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  )
}
