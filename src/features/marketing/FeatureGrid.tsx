import { cn } from '@/lib/cn'
import { Card } from '@/components/primitives/Card'
import { Section } from '@/components/layout/Section'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'rent', icon: 'card' },
  { key: 'utilities', icon: 'droplet' },
  { key: 'reminders', icon: 'bell' },
  { key: 'inspections', icon: 'clipboard' },
  { key: 'works', icon: 'wrench' },
  { key: 'deposits', icon: 'shield' },
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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* `Card` avec `as="article"` : ces six cartes portent chacune un titre
              et un corps, donc un rôle `article` qu'un `<div>` leur retirerait.
              `flush` plus un rembourrage explicite, et jamais `className="p-7"`
              seul : `cn` concatène sans fusionner, le `sm:p-5` de la primitive
              serait émis APRÈS et ferait tomber le rembourrage à 20 px au-delà
              de 640. Mesuré par l'audit, pas supposé. */}
        {FEATURES.map(({ key, icon }) => (
          <Card
            as="article"
            flush
            elevation="e1"
            key={key}
            className={cn(
              'group p-7 sm:p-8',
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
            <span
              className={cn(
                'flex size-12 items-center justify-center rounded-lg',
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

            <h3 className="mt-6 title-l text-balance">
              {t(`marketing.features.${key}.title` as 'marketing.features.rent.title')}
            </h3>
            <p className="mt-3 text-body text-pretty text-muted">
              {t(`marketing.features.${key}.body` as 'marketing.features.rent.body')}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  )
}
