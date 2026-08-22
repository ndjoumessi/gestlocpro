import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { usePiegeDeFocus } from './piegeDeFocus'
import { IconButton } from './Button'
import { useT } from '@/i18n/I18nProvider'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Barre d'actions collée en bas. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** `alertdialog` pour les confirmations destructives. */
  role?: 'dialog' | 'alertdialog'
  /**
   * Le voile et Échap ferment-ils ? Oui par défaut.
   *
   * `false` pour une modale qui porte quelque chose d'IRRÉCUPÉRABLE — un code
   * d'invitation qui ne se relit pas. Le voile est un bouton qui couvre toute
   * la fenêtre, et sous `sm` la feuille est collée en bas : un pouce qui rate
   * emporte alors ce qu'on venait chercher. La modale reste quittable par son
   * pied ; ce qu'on retire, c'est le renvoi ACCIDENTEL.
   */
  dismissible?: boolean
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

/**
 * Modale avec piège de focus, restauration du focus à la fermeture,
 * fermeture par Échap et par clic sur le voile.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  dismissible = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const t = useT()

  /*
    LE PIÈGE DE FOCUS VIT DÉSORMAIS DANS `piegeDeFocus`, ET C'EST LE POINT.

    Il était écrit ici, correct et complet, pendant que les deux panneaux de la
    barre — réglages et compte — portaient le même motif de surface sans rien en
    dessous : ni piège, ni retour du focus. Mesuré avant ce lot, quatre
    tabulations sur dix sortaient du panneau des réglages ouvert.

    Le comportement de cette modale ne change pas d'un pouce : verrou de
    défilement, focus sur le premier NON-BOUTON — donc jamais sur la croix, ce
    qui poserait le doigt du clavier sur le geste d'abandon dans toute modale
    sans champ —, Échap arrêtée même quand elle ne ferme pas, et retour du focus
    à l'ouvreur. Ce sont les options passées ci-dessous, une par comportement.

    `dismissible` : Échap ne ferme que si la modale se laisse renvoyer. La
    touche reste arrêtée dans les deux cas — sinon elle remonterait à ce qui
    entoure et fermerait l'écran d'à côté.
  */
  const renvoyableRef = useRef(dismissible)
  renvoyableRef.current = dismissible
  usePiegeDeFocus(
    open,
    dialogRef,
    () => {
      if (renvoyableRef.current) onClose()
    },
    { verrouillerLeDefilement: true, focusInitial: 'premier-non-bouton' },
  )

  if (!open) return null

  /*
    LA MODALE EST PORTÉE DANS `document.body`, ET C'EST UN CORRECTIF MESURÉ.

    LE DÉFAUT. Le conteneur est `fixed inset-0` — il devrait donc couvrir la
    FENÊTRE. Il ne le faisait pas : `<main>` porte `animate-rise`, et une
    animation de `transform` laisse au repos une matrice IDENTITÉ, qui est une
    transformation quand même. Un ancêtre transformé devient le bloc conteneur
    de tous ses descendants `position: fixed` : le conteneur de la modale
    mesurait donc 1251 px de haut à partir de y = 122, au lieu de 900 px à
    partir de 0.

    CE QUE ÇA COÛTAIT. Relevé sur « Ajouter un immeuble », fenêtre de 900 px :
    la boîte de dialogue se posait à y = 554 et finissait à 941 — quarante et un
    pixels SOUS le bord de l'écran. Le pied, qui porte l'action principale,
    était coupé. Le défaut grandit avec la page : plus le contenu est long, plus
    le faux bloc conteneur est haut, plus la modale descend. C'est le « l'action
    principale à 700 px du regard » du sujet, et il ne venait pas du contenu de
    la modale.

    POURQUOI UN PORTAIL PLUTÔT QUE RETIRER LA TRANSFORMATION. Neutraliser
    `animate-rise` corrigerait ce cas-ci et laisserait le suivant : n'importe
    quel `transform`, `filter`, `backdrop-filter`, `contain` ou `will-change`
    posé un jour sur un ancêtre reproduirait exactement le même effet, sans que
    rien ne le relie à la modale. Le portail rend la modale insensible à ce que
    ses ancêtres de rendu décident — elle sort de l'arbre de mise en page, pas
    de l'arbre React : le contexte, les gestionnaires et la propagation des
    événements la suivent.
  */
  const titleId = 'modal-title'
  const descId = 'modal-desc'

  return createPortal(
    <div
      // Sous `sm`, la modale est une feuille collée en bas, pleine largeur : en
      // portrait les insets latéraux valent 0, il n'y a donc rien à écarter, et
      // le bas est traité plus loin, sur les sections de la feuille elle-même.
      //
      // Dès `sm` elle se recentre — et c'est là que le paysage frappe : un
      // iPhone tourné mesure moins de `lg` mais bien plus que `sm`, donc il
      // prend cette branche, avec ses 24 px de marge contre 59 px d'encoche. La
      // boîte de dialogue passait sous l'encoche. `max()` : 24 px suffisent
      // partout ailleurs, l'inset ne prend le relais que quand il est plus
      // grand.
      className={cn(
        'fixed inset-0 flex items-end justify-center p-0 sm:items-center',
        'sm:pt-6 sm:pb-6',
        'sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]',
      )}
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Le voile signale que l'arrière-plan est écarté, pas décoratif. */}
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={dismissible ? onClose : undefined}
        // Le voile reste PEINT quand il ne ferme plus : il dit que
        // l'arrière-plan est écarté, ce qui est vrai dans les deux cas. Seul son
        // geste disparaît.
        disabled={!dismissible}
        className="absolute inset-0 cursor-default bg-scrim backdrop-blur-[3px]"
      />

      <div
        ref={dialogRef}
        // Focalisable par programme, jamais à la tabulation : c'est ce que
        // `-1` veut dire, et c'est ce qui permet au repli ci-dessus de poser le
        // focus ici plutôt que sur le bouton d'abandon.
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'animate-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
          'rounded-t-xl border border-divider bg-surface shadow-e3 sm:rounded-xl',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-divider p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="title-l">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-body text-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </div>

        {/*
          La zone sûre du bas se pose sur la SECTION du bas, pas sur la feuille.
          Sur la feuille, le rembourrage aurait laissé apparaître une bande de
          `bg-surface` sous une barre d'actions qui, elle, est peinte en
          `bg-surface-sunken` : deux tons, un liseré parasite.

          Elle est donc portée par le pied quand il existe, et par le corps
          défilant sinon — sans quoi une modale sans actions laisserait sa
          dernière ligne sous la barre de gestes. `calc()` dans les deux cas :
          la section est peinte jusqu'au bord physique, son contenu s'en écarte.

          `sm:pb-*` remet la valeur nue : dès `sm` la boîte est recentrée et le
          conteneur l'a déjà écartée du bord. Sans ce retour, un dialogue de
          bureau traînerait un pied de 34 px de trop.
        */}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-5 pt-5',
            footer ? 'pb-5' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5',
          )}
        >
          {children}
        </div>

        {footer && (
          <div
            className={cn(
              'flex flex-wrap justify-end gap-2 border-t border-divider bg-surface-sunken',
              'px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
