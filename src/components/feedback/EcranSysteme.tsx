import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from '@/components/primitives/Icon'

/**
 * LES ÉCRANS QUE PERSONNE NE MESURE, ÉCRITS UNE FOIS.
 *
 * ═══ QUATRE COPIES DE LA MÊME CHOSE ═══
 *
 * Le repli de la frontière d'erreur, l'échec terminal de session, le serveur
 * injoignable et l'échec de chargement du parc rendaient tous les quatre la même
 * forme — un cercle de 48 px, un `<h1>` en `title-l`, une phrase en `text-muted`,
 * une rangée d'actions — recopiée à quatre endroits. C'est déjà une invitation à
 * la dérive ; ce qui la rend coûteuse, c'est qu'AUCUNE PORTE NE LES REND. Le
 * balayage visite des adresses, et aucune adresse ne plante. Un défaut posé ici
 * se corrige en quatre endroits ou en aucun, et rien ne dit lequel.
 *
 * ═══ LE FOCUS PART SUR LE TITRE, ET C'EST MESURÉ ═══
 *
 * En atteignant le repli au navigateur — par une exception injectée dans la
 * route 404 —, `document.activeElement` valait `body`. La page entière venait
 * d'être remplacée, l'élément qui portait le focus avait été démonté, et rien
 * n'annonçait quoi que ce soit : la seule région vivante de la page était le
 * conteneur de toasts, VIDE.
 *
 * `CadreDuParc` avait traité le même cas par `aria-live="polite"`, en écrivant
 * la bonne raison : « la bascule est silencieuse sans cela ». Le remède, lui,
 * n'est pas le bon ici. Une région vivante annonce les CHANGEMENTS d'une région
 * DÉJÀ PRÉSENTE ; insérée avec son texte déjà dedans — ce qui est exactement le
 * cas de ces quatre écrans — le comportement dépend du lecteur d'écran.
 *
 * Déplacer le focus sur le titre est uniforme, et répare la seconde moitié du
 * défaut par la même occasion : le clavier repart du haut du nouvel écran au
 * lieu de repartir de `body`.
 *
 * `tabIndex={-1}` : un titre n'est pas un arrêt de tabulation, mais il doit
 * pouvoir RECEVOIR le focus par programme. Le tabulateur ne le rencontrera
 * jamais ; seul cet effet l'y pose.
 */
export function EcranSysteme({
  ton,
  titre,
  corps,
  actions,
  children,
  dansLaCoquille = false,
}: {
  ton: 'danger' | 'warn'
  titre: string
  corps: ReactNode
  actions: ReactNode
  /** Contenu additionnel sous les actions — le dépliant de la pile, par exemple. */
  children?: ReactNode
  /**
   * `true` quand la coquille applicative reste montée autour : on ne prend alors
   * ni la hauteur de la fenêtre ni son fond. Voir `CadreDuParc`, qui porte le
   * raisonnement — l'erreur y est CELLE DES DONNÉES, et retirer la navigation
   * priverait l'utilisateur des commandes qui lui permettent de s'en sortir.
   */
  dansLaCoquille?: boolean
}) {
  const titreRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titreRef.current?.focus()
  }, [])

  const contenu = (
    <div className={cn('text-center', dansLaCoquille ? 'mx-auto max-w-md py-10' : 'max-w-md')}>
      <span
        className={cn(
          'inline-flex size-12 items-center justify-center rounded-full',
          ton === 'warn' ? 'bg-warn-tint text-warn' : 'bg-danger-tint text-danger',
        )}
      >
        <Icon name="alert" size={22} />
      </span>

      {/* `<h1>` ET NON `<h2>` : quand cet écran paraît, son texte EST le titre
          principal de la page — celui qu'il remplace est parti avec elle. Le
          laisser en `<h2>` retirerait son `<h1>` au document, et le dépôt en
          comptait zéro avant ce choix (mesuré sur les 23 routes).

          Cette phrase avait perdu ses balises dans `CadreDuParc` : elle s'y
          lisait « `` et non `` : … Le laisser en `` retirait son `` à l'écran »,
          c'est-à-dire plus rien. Elle est rétablie ici, une fois. */}
      <h1 ref={titreRef} tabIndex={-1} className="mt-4 title-l">
        {titre}
      </h1>
      <p className="mt-2 text-body text-muted">{corps}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>

      {children}
    </div>
  )

  if (dansLaCoquille) return <section>{contenu}</section>
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">{contenu}</div>
  )
}
