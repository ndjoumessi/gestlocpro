import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Card } from '@/components/primitives/Card'
import { Section } from '@/components/layout/Section'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const ROLES: { key: 'owner' | 'manager' | 'tenant'; icon: IconName; signup: string }[] = [
  { key: 'owner', icon: 'building', signup: '/inscription/proprietaire' },
  { key: 'manager', icon: 'users', signup: '/inscription/gestionnaire' },
  { key: 'tenant', icon: 'key', signup: '/inscription/locataire' },
]

export function RolesSection() {
  const t = useT()

  return (
    <Section
      id="roles"
      tone="dark"
      eyebrow={t('marketing.roles.eyebrow')}
      title={t('marketing.roles.title')}
      description={t('marketing.roles.subtitle')}
    >
      {/* Trois rôles, trois cartes. Réduites un temps à un filet, elles se
          confondaient : les droits de l'un se lisaient comme la suite du pitch
          de l'autre. Un rôle est une frontière — la carte la matérialise.
          Le nom redescend du corps d'affichage au titre : trois « Gestionnaire
          délégué » en 52px se disputaient l'attention avec le titre de section,
          et la comparaison — l'objet même de cette section — en pâtissait. */}
      {/*
        ═══ QUATRE BANDES PARTAGÉES, COMME LA GRILLE DE PRIX ═══

        Les trois cartes s'étiraient déjà à la même hauteur, et leurs
        « Créer un compte » finissaient bien sur une ligne — c'est `flex-1` sur
        l'accroche qui le faisait. Mais TOUT CE QUI EST ENTRE LES DEUX glissait :
        mesuré à 1440 px, le trait de séparation de « Gestionnaire délégué »
        tombait 28 px au-dessus de celui de ses voisines, parce que ses droits
        se replient sur deux lignes et que l'accroche absorbait la différence.

        Or c'est précisément la ligne qu'on vient comparer : « ce que ce rôle
        peut faire » chez l'un, en face du même chez les deux autres. Un trio de
        cartes qui ne s'alignent que par leurs extrémités demande à l'œil de
        faire lui-même le rapprochement que la section promet.

        `grid-rows-subgrid` est l'outil exact de ce problème, et la grille de
        prix l'emploie déjà pour la même raison, six sections plus bas : chaque
        carte reprend les rangées de la grille au lieu d'empiler les siennes.
        Quatre bandes — l'en-tête, l'accroche, les droits, l'action — et la
        hauteur d'une bande est celle de la plus haute des trois.

        `1fr` SUR LA DEUXIÈME : c'est l'accroche qui absorbe le reste, comme
        `flex-1` le faisait. EMPILÉES, rien de tout cela : sous `lg` il n'y a
        pas de rangées communes, et les cartes restent une pile flexible.
      */}
      <div className="grid gap-5 lg:grid-cols-3 lg:grid-rows-[auto_1fr_auto_auto]">
        {/* `tone="darkRaised"` : une carte sombre POSÉE SUR une section sombre.
              Le ton `dark` peint `--color-ink`, qui est déjà le fond de la
              section — la carte y disparaîtrait dans son support. */}
        {ROLES.map(({ key, icon, signup }) => (
          <Card
            as="article"
            tone="darkRaised"
            flush
            key={key}
            className={cn(
              'group flex flex-col p-6 sm:p-7',
              'lg:grid lg:grid-rows-subgrid lg:row-span-4',
              'transition-[transform,border-color] duration-200 ease-out',
              'hover:-translate-y-1 hover:border-accent-on-dark/45',
            )}
          >
            {/*
              ═══ LE SIGNE PASSE À GAUCHE DU NOM, ET C'EST 72 px PAR CARTE ═══

              La pastille était posée AU-DESSUS du titre : 48 px de signe, plus
              les 24 qui l'en séparaient, sur trois cartes qui s'empilent au
              téléphone. Soit 216 px consacrés à trois ronds bleus, sur la
              section la plus haute de la page (1750 px mesurés à 360).

              Ce n'est pas qu'une économie. Ces trois cartes existent pour être
              COMPARÉES, et une comparaison se lit en travers : au téléphone,
              où elles s'empilent, tout ce qui allonge une carte éloigne le
              deuxième rôle du premier. Le signe posé dans la gouttière du nom
              ne coûte plus que sa largeur, qui était de toute façon perdue en
              marge — et il dit la même chose, au même endroit du regard.

              `size-11` et non `size-12` : la pastille s'aligne sur la hauteur
              des deux lignes qu'elle accompagne — le nom et sa mention — au
              lieu de dépasser la seconde.
            */}
            <div className="flex items-start gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent">
                <Icon name={icon} size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="title-l text-on-dark">
                  {t(`roles.${key}.name` as 'roles.owner.name')}
                </h3>
                <p className="mt-1 text-label text-accent-on-dark">
                  {t(`roles.${key}.short` as 'roles.owner.short')}
                </p>
              </div>
            </div>

            {/* Même raison que la réponse de FAQ : c'est le texte principal
                d'une carte de vitrine, celui qui décide, et le jeton de 16 px
                porte « landing » dans son propre commentaire. La glose de la
                grille de fonctionnalités, elle, reste en 14 : elle est
                SUBORDONNÉE à un titre, et l'échelle doit le dire. */}
            <p className="mt-4 flex-1 text-body-l text-pretty text-on-dark-muted">
              {t(`roles.${key}.pitch` as 'roles.owner.pitch')}
            </p>

            {/*
              ═══ CE QUE LE RÔLE PEUT FAIRE SE LIT, IL NE SE DÉCHIFFRE PAS ═══

              Le bloc des droits était un paragraphe gris sous un surtitre
              effacé : trois fois le même pavé, sur trois cartes qu'on est
              justement venu COMPARER. Un visiteur qui cherche « est-ce que mon
              gestionnaire pourra arbitrer les cautions ? » devait lire les trois
              en entier pour y répondre.

              La coche fait de ce pavé une ASSERTION plutôt qu'une glose, et
              l'aligne sur le vocabulaire de la matrice de tarifs, quatre
              sections plus bas, qui coche déjà ce qui est inclus. `shrink-0` et
              `mt-0.5` : le glyphe tient sa colonne et s'aligne sur la première
              ligne du texte, pas sur son centre optique.
            */}
            <div className="mt-5 border-t border-on-dark-border pt-4">
              <span className="eyebrow mb-2 block text-on-dark-faint">
                {t('marketing.roles.seeMore')}
              </span>
              <p className="flex gap-2.5 text-body text-on-dark-muted">
                <Icon
                  name="checkCircle"
                  size={16}
                  className="mt-0.5 shrink-0 text-accent-on-dark"
                />
                <span>{t(`roles.${key}.rights` as 'roles.owner.rights')}</span>
              </p>
            </div>

            <Link
              to={signup}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-body font-semibold text-accent-on-dark no-underline transition-colors duration-150 hover:text-on-dark"
            >
              {t('auth.signUp')}
              <Icon name="arrowRight" size={16} />
            </Link>
          </Card>
        ))}
      </div>
    </Section>
  )
}
