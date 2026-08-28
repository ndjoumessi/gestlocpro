import { Children, createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { usePiegeDeFocus } from './piegeDeFocus'

/**
 * LE MENU DE DÉBORDEMENT — trois points, un panneau, et rien d'autre.
 *
 * ═══ POURQUOI IL N'EXISTAIT PAS, ET POURQUOI IL FALLAIT L'ÉCRIRE ═══
 *
 * Le dépôt porte quatre panneaux ancrés — le menu de compte, le panneau des
 * réglages, le sélecteur de date, la liste cherchable — et pas une primitive
 * commune. Chacun refait le même ancrage, la même altitude, le même piège de
 * focus. Le cinquième aurait été le cinquième doublon.
 *
 * Ce qui est PARTAGÉ vient donc de `usePiegeDeFocus`, écrit une fois pour les
 * deux panneaux de la coquille : Échap, clic extérieur, retour du focus au
 * déclencheur, et la boucle de tabulation. Ce fichier n'ajoute que la géométrie
 * et le rôle.
 *
 * ═══ IL NE S'OUVRE QUE S'IL A QUELQUE CHOSE À DIRE ═══
 *
 * `enfants` vide rend `null`. C'est la règle que la coquille énonce à propos de
 * sa cloche de notifications absente — « un bouton qui n'ouvre rien est le
 * défaut » — et elle vaut d'autant plus ici : trois points sont une PROMESSE
 * qu'il y a autre chose. Un déclencheur qui ouvre le vide est pire qu'un espace
 * blanc, parce qu'on l'a cliqué pour le savoir.
 *
 * ═══ `role="menu"`, ET CE QUE ÇA ENGAGE ═══
 *
 * Un `menu` n'admet que des `menuitem` parmi ses descendants signifiants, et il
 * annonce « 2 sur 3 ». C'est ce que `MenuElement`, plus bas, garantit : les
 * appelants passent des éléments de menu, pas des boutons quelconques. Un
 * `<Button>` posé là porterait `role="button"` et casserait le décompte — le
 * dépôt s'est déjà fait avoir une fois avec un `listbox` dont les options
 * vivaient dans des `div`.
 *
 * ═══ CE QU'IL NE FAIT PAS ═══
 *
 * Pas de navigation aux flèches. `usePiegeDeFocus` boucle déjà la TABULATION
 * dans le panneau, ce qui rend chaque entrée atteignable au clavier ; les
 * flèches seraient un second système à tenir, et `ongletsAuClavier` existe déjà
 * pour les rangées d'onglets, qui ont, elles, un point d'entrée unique. Le jour
 * où un menu portera dix entrées, la question se posera pour de bon.
 *
 * Pas de repositionnement automatique non plus : le panneau s'ancre à droite de
 * son déclencheur, qui vit au bout d'une rangée alignée à droite. Un menu qui
 * s'ouvrirait vers la droite sortirait de la fenêtre — c'est le même
 * raisonnement, et la même valeur, que le panneau des réglages.
 */
/**
 * LA FERMETURE, PASSÉE PAR CONTEXTE PLUTÔT QUE PAR PROPRIÉTÉ.
 *
 * Une entrée de menu doit refermer le panneau en même temps qu'elle agit : un
 * menu resté ouvert au-dessus de l'écran qu'on vient de changer laisse croire
 * que rien n'a eu lieu. L'appelant, lui, ne connaît que son action — lui faire
 * porter `onClose` en plus reviendrait à lui confier une mécanique qui n'est pas
 * la sienne, et le premier oubli passerait sans bruit.
 */
const FermerLeMenu = createContext<() => void>(() => {})

export function MenuDeDebordement({
  libelle,
  children,
  className,
}: {
  /** Nom accessible du déclencheur — trois points ne se prononcent pas. */
  libelle: string
  children?: ReactNode
  className?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  /* `focusInitial: 'premier'` : le panneau ne contient QUE des commandes, la
     première est donc la bonne première étape. C'est le même réglage que le
     menu de compte, pour la même raison. */
  usePiegeDeFocus(ouvert, boite, () => setOuvert(false), {
    fermerAuClicExterieur: true,
    focusInitial: 'premier',
  })

  /*
    RIEN À REPLIER, RIEN À PROMETTRE — ET `!children` NE SUFFISAIT PAS.

    Un appelant qui compose ses entrées par conditions passe un TABLEAU, et un
    tableau de trois `null` est truthy. Les cartes d'intervention font
    exactement cela : trois gestes optionnels selon l'état, dont aucun sur une
    intervention devisée que le bailleur s'est ouverte à lui-même. Le menu se
    serait affiché, vide, sur cette carte-là — le défaut même que ce composant
    dit refuser deux paragraphes plus haut.

    `Children.toArray` écarte `null`, `undefined` et les booléens : ce qui reste
    est ce qui sera peint.
  */
  if (Children.toArray(children).length === 0) return null

  return (
    <div ref={boite} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-label={libelle}
        onClick={() => setOuvert((o) => !o)}
        className={cn(
          // 44 px, comme toute cible du dépôt. `rounded-full` et la bordure de
          // la variante secondaire : c'est un bouton d'en-tête, il se lit comme
          // ses voisins plutôt que comme un ornement.
          'inline-flex size-11 cursor-pointer items-center justify-center rounded-full',
          'border border-border bg-surface text-ink transition-colors duration-150',
          'hover:border-ink',
        )}
      >
        <Icon name="more" size={18} />
      </button>

      {ouvert && (
        <div
          role="menu"
          aria-label={libelle}
          /* `--z-popover` : le menu s'ouvre au-dessus d'un en-tête qui est
             lui-même collant. Le barreau est celui des panneaux ancrés du
             dépôt, et `altitudes.test.ts` refuse tout niveau écrit à la main. */
          style={{ zIndex: 'var(--z-popover)' }}
          className={cn(
            'animate-pop absolute right-0 mt-2 flex w-64 max-w-[calc(100vw-2.5rem)] flex-col gap-1',
            'rounded-md border border-border bg-paper p-2 shadow-lg',
          )}
        >
          <FermerLeMenu.Provider value={() => setOuvert(false)}>{children}</FermerLeMenu.Provider>
        </div>
      )}
    </div>
  )
}

/** Une entrée de menu. Elle referme le panneau en même temps qu'elle agit. */
export function MenuElement({
  icone,
  onClick,
  children,
}: {
  icone?: Parameters<typeof Icon>[0]['name']
  onClick: () => void
  children: ReactNode
}) {
  const fermer = useContext(FermerLeMenu)
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        fermer()
        onClick()
      }}
      className={cn(
        'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5',
        'text-left text-body text-ink transition-colors duration-150',
        'hover:bg-surface-sunken',
      )}
    >
      {icone && <Icon name={icone} size={16} className="shrink-0 text-muted" />}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}
