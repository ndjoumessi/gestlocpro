import { cn } from '@/lib/cn'
import { Button } from '@/components/primitives/Button'
import { GOUTTIERE_LATERALE } from '@/components/layout/gouttiere'
import { useT } from '@/i18n/I18nProvider'

export function FinalCta() {
  const t = useT()

  return (
    // Halo flou et pastille d'icône retirés : ni l'un ni l'autre ne portait
    // d'information, et le halo affaiblissait le contraste du fond sombre, qui
    // est ici le seul effet recherché. Le titre monte d'un cran : c'est la
    // dernière déclaration de la page, elle doit peser autant que la première.
    //
    // `py-24/28/32` et non `py-28/36/48`. La section ne porte qu'un titre, une
    // phrase et deux boutons : à 192 px de rembourrage de chaque côté, le bloc
    // sombre se lisait comme une bande vide bien plus que comme une conclusion,
    // et l'appel à l'action se retrouvait isolé au milieu de rien. Une
    // respiration généreuse reste voulue — c'est la dernière chose qu'on lit —
    // mais elle doit encadrer le propos, pas le noyer.
    <section
      data-rythme="cloture"
      className={cn('on-dark bg-ink py-20 text-on-dark sm:py-24 lg:py-28', GOUTTIERE_LATERALE)}
    >
      {/*
        LE BLOC SOMBRE REPREND LA BANDE DE LA PAGE, et cesse d'être une île.

        Mesuré avant ce lot, à 1440 px : 466 px de haut pour 210 px de contenu,
        et ce contenu tenu dans 768 px (`max-w-3xl`) au milieu d'une bande qui
        en fait 1216 — soit 224 px de sombre inerte de chaque côté, en plus des
        128 px au-dessus et au-dessous. Le vide n'y était pas dessiné : il
        restait de ce qu'on n'avait pas mis.

        Deux colonnes le rendent lisible. La déclaration prend la gauche, comme
        le titre de l'accroche et comme cinq des six sections qui précèdent ; les
        deux actions prennent la droite, là où le regard finit sa ligne. Le
        sombre n'entoure plus le propos, il le porte d'un bord à l'autre.

        C'EST AUSSI UN ARGUMENT DE RYTHME, et c'est ce qui a tranché entre
        « resserrer » et « élargir ». La page enchaînait TROIS blocs centrés à la
        suite — tarifs, questions, clôture. Le dernier reprend l'axe du premier
        écran : la page ouvre et ferme sur la même forme, et les deux blocs
        centrés du milieu se lisent enfin comme une parenthèse plutôt que comme
        la fin d'une série de trois.

        `items-center` ici et non `items-start` : ce bloc n'a pas de colonne de
        lecture et de colonne d'illustration — il a une phrase et sa
        conséquence. Aucune des deux ne porte l'axe de l'autre, et rien ne
        dépasse : la contrainte du bloc d'accroche ne s'applique pas.
      */}
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
        <div className="min-w-0">
          {/* `display-m` ET NON `display-l` : c'était la SEULE occurrence de
              `display-l` de la page, et elle rendait 36,8 px à 360 px — une
              neuvième taille pour un seul titre, à quatre dixièmes de pixel des
              36 px voisins. Le titre de cette section n'est pas d'un rang
              supérieur aux six autres ; il est le dernier, ce que sa place et
              son fond d'encre disent déjà. */}
          <h2 className="display-m text-balance text-on-dark">{t('marketing.finalCta.title')}</h2>
          <p className="mt-5 max-w-[52ch] text-body-l text-pretty text-on-dark-muted">
            {t('marketing.finalCta.subtitle')}
          </p>
        </div>

        {/* `lg:justify-end` seulement : en dessous les boutons s'empilent et
            prennent la largeur, ce qui reste juste sur un téléphone. */}
        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <Button size="lg" variant="primary" to="/inscription" iconAfter="arrowRight">
            {t('marketing.finalCta.cta')}
          </Button>
          <Button size="lg" variant="onDark" to="/demo">
            {t('marketing.finalCta.secondary')}
          </Button>
        </div>
      </div>
    </section>
  )
}
