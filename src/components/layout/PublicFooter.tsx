import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/primitives/Logo'
import { GOUTTIERE_LATERALE } from './gouttiere'
import { useT } from '@/i18n/I18nProvider'

/*
  LES ANCRES S'ÉCRIVENT `#id`, PAS `/#id`.

  `BrowserRouter` (voir `main.tsx`) n'est pas un routeur « data » : il n'a pas
  de `ScrollRestoration`, et `grep -rn hash src/` ne rend toujours aucune ligne
  — même diagnostic que celui qui a délogé le bouton « Nous contacter » de
  `PricingSection`. Un `<Link to="/#features">` change l'URL par
  `history.pushState` et NE FAIT DÉFILER NULLE PART : cette API ne déclenche
  jamais le comportement natif d'ancrage, réservé à une vraie navigation ou à
  `location.hash =`. Le pied de page n'existe que sur `Landing.tsx` (voir son
  seul import), donc chaque lien pointe déjà vers la page où il est rendu : un
  `<a href="#id">` ordinaire — non intercepté par React Router — suffit et
  défile réellement, exactement comme le fait déjà la navigation de l'en-tête.
*/
/*
  DEUX COLONNES SUR TROIS PROMETTAIENT DES PAGES QUI N'EXISTENT PAS.

  Relevé lien par lien, avant ce lot :

    « À propos »            → #roles   la section « Trois rôles ». Elle dit à
                                       QUI le produit s'adresse, pas qui le
                                       fait. Le prospect cherchait une société
                                       et trouvait une grille de personas.
    « Contact »             → #faq     la FAQ, qui ne porte AUCUN canal de
                                       contact : ni adresse, ni formulaire, ni
                                       numéro, et le dépôt entier n'en porte
                                       aucun. Déjà relevé quand le même défaut
                                       a délogé « Nous contacter » de la carte
                                       de tarifs.
    « Conditions générales »→ #faq     idem.
    « Confidentialité »     → #faq     idem.
    « Cookies »             → #faq     idem.

  Les cinq ancres RÉSOLVENT — `#faq` existe, la page défile bel et bien — ce
  qui est précisément ce qui rendait le défaut invisible à une vérification
  mécanique. Ce n'est pas la destination qui manquait, c'est la promesse
  qu'elle tienne le libellé qui y menait.

  ELLES DISPARAISSENT PLUTÔT QUE D'ÊTRE RÉÉCRITES. Trois d'entre elles sont des
  documents juridiques ; les inventer serait un mensonge d'une autre gravité
  que celui qu'on corrige. Un pied de page qui liste des pages absentes est la
  première chose qu'un prospect méfiant vérifie, et il n'en vérifie qu'une.

  CE QUE LEUR RETRAIT NE RÈGLE PAS, écrit ici pour que personne ne s'y trompe :
  des conditions générales, une politique de confidentialité et un moyen de
  contact restent à écrire, et leur absence reste un manque du produit. Retirer
  le lien retire le mensonge, pas le devoir.

  CE QUI RESTE porte des libellés que leur destination tient : cinq entrées de
  la page où le pied est rendu, plus la démonstration. Le pied redit la barre,
  et c'est sa fonction — on y arrive par le bas, sans vouloir remonter.
*/
const COLUMNS = [
  {
    heading: 'marketing.footer.product',
    links: [
      { label: 'marketing.nav.features', to: '#features' },
      { label: 'marketing.nav.roles', to: '#roles' },
      { label: 'marketing.nav.pricing', to: '#pricing' },
      { label: 'marketing.nav.faq', to: '#faq' },
      { label: 'marketing.footer.demo', to: '/demo' },
    ],
  },
] as const

export function PublicFooter() {
  const t = useT()

  return (
    <footer className="on-dark bg-ink text-on-dark">
      <div className={cn('mx-auto max-w-7xl py-14', GOUTTIERE_LATERALE)}>
        {/* Une colonne de liens et non plus trois : la grille suit ce qui
            reste, au lieu de garder quatre pistes dont deux seraient vides.
            `sm:grid-cols-2` place la marque et les liens côte à côte dès
            qu'il y a la place, et le bloc de marque garde sa mesure de
            lecture — c'est lui, désormais, qui porte la largeur du pied. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr]">
          <div className="max-w-sm">
            <Logo tone="dark" />
            <p className="mt-4 text-body text-on-dark-muted">{t('brand.tagline')}.</p>
            {/* Les sélecteurs de langue et de devise étaient ici aussi —
                quatrième copie sur la page. L'en-tête est collant : il reste
                atteignable depuis le pied de page sans remonter. */}
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading as 'marketing.footer.product')}>
              <h2 className="eyebrow font-sans text-accent-on-dark">
                {t(column.heading as 'marketing.footer.product')}
              </h2>
              {/*
                ═══ DEUX COLONNES DE LIENS, ET C'EST UNE MESURE ═══

                La liste était une pile unique. Chaque lien porte à juste titre
                une cible de 44 px ; cinq d'entre eux, espacés de 52 px, faisaient
                donc 260 px de haut à eux seuls. Le pied entier mesurait 484 px
                pour un logo, une phrase et cinq liens — et sa colonne de gauche,
                qui n'en contient que deux lignes, se retrouvait avec deux cents
                pixels de vide sous elle. Le déséquilibre ne venait pas d'un
                rembourrage mal réglé : il venait de la FORME de la liste.

                `sm:grid-cols-2` la replie en deux colonnes dès qu'il y a la
                place. Cinq liens y tiennent en trois rangs — la moitié de la
                hauteur — et les deux moitiés du pied se répondent enfin.

                Sous `sm`, la pile revient : deux colonnes de 44 px dans une
                fenêtre de 360 rapprocheraient deux cibles tactiles à quelques
                pixels l'une de l'autre, ce qui est exactement ce que le plancher
                de 44 existe pour éviter.
              */}
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {column.links.map((link) => {
                  const cible = link.to
                  /*
                    `min-w-11` EN PLUS de `min-h-11`, et c'est le défaut que
                    ce lot corrige.

                    `min-h-11` garantissait la hauteur et rien d'autre : la
                    largeur restait celle du libellé. Mesuré au navigateur,
                    « Tarifs » faisait 35 px de large, « Demo » 38, « About »
                    39 — des cibles de 35 × 44 sous un plancher de 44.
                    `cibles.test.ts` ne pouvait pas le voir : il lit les
                    sources, y trouve `min-h-11`, et un plancher de hauteur
                    ne dit rien d'une largeur portée par la traduction.

                    Le pied est sombre et sans fond au survol : les 9 px
                    gagnés ne se voient pas, ils se touchent seulement.
                  */
                  const classesLien =
                    'inline-flex min-h-11 min-w-11 items-center text-body text-on-dark-muted no-underline transition-colors duration-150 hover:text-on-dark'

                  return (
                    <li key={link.label}>
                      {cible.startsWith('#') ? (
                        // Ancre de la même page : un `<a>` natif, pour la
                        // raison détaillée au-dessus de `COLUMNS` — `Link`
                        // change l'URL sans jamais faire défiler.
                        <a href={cible} className={classesLien}>
                          {t(link.label as 'marketing.nav.features')}
                        </a>
                      ) : (
                        <Link to={cible} className={classesLien}>
                          {t(link.label as 'marketing.nav.features')}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-on-dark-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caps text-on-dark-faint">
            {t('marketing.footer.rights', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  )
}
