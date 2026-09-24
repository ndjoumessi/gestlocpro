import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { Icon, type IconName } from './Icon'
import { IconButton } from './Button'

export type ToastTone = 'neutral' | 'ok' | 'danger'

interface Toast {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
  /** Renvoyé : le nœud ne reste que pour l'œil, le temps de sa sortie. */
  sortant?: boolean
  /**
   * Gelé AU RENVOI : ce toast était-il le dernier en flux à cet instant ?
   *
   * Gelé, et non recalculé à chaque rendu — c'est le piège de ce champ. Un toast
   * déjà sorti du flux qu'un rendu ultérieur jugerait « plus le dernier »
   * (parce qu'un voisin vient de sortir à son tour) retomberait DANS la colonne
   * au milieu de son propre fondu.
   */
  horsFlux?: boolean
}

interface ToastContextValue {
  notify: (message: string, options?: { tone?: ToastTone; action?: Toast['action'] }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION = 4500

/**
 * Miroir de `animate-rise-out` (`--duration-fast`), en millisecondes.
 *
 * Elle NE SE PAIE PAS sur les 4 500 ms de lecture : le message reste lisible et
 * intact tout ce temps, la sortie s'ajoute après. `sortieDeToast.test.tsx` mesure
 * l'état à 4 499 ms pour cette seule raison.
 */
const SORTIE_MS = 150

const TONE_ICON: Record<ToastTone, IconName> = {
  neutral: 'info',
  ok: 'checkCircle',
  danger: 'alert',
}

const TONE_ACCENT: Record<ToastTone, string> = {
  neutral: 'text-accent-on-dark',
  ok: 'text-ok',
  danger: 'text-danger',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  /*
    LA SORTIE DIFFÉRÉE VIT ICI, DANS LE FOURNISSEUR, ET PAS DANS L'ÉLÉMENT.

    `useSortieDifferee` ne pouvait pas servir, et ce n'est pas un détail de
    plomberie. Le crochet retient un nœud que SON APPELANT continue de rendre :
    il prend un `ouvert` booléen, garde `monte` vrai un moment de plus et laisse
    l'appelant décider de la présence. Un toast n'a pas d'`ouvert` — son
    EXISTENCE DANS LE TABLEAU est son ouverture. Placé dans `ToastItem`, le
    crochet ne pourrait rien retenir : c'est le fournisseur qui démonte
    l'élément, et un enfant ne se maintient pas monté contre son parent. Le motif
    est donc le même, à deux temps — marquer, puis retirer — mais écrit là où vit
    l'état.

    ET UNE SECONDE RAISON, PLUS FORTE : la décision « ce toast peut-il quitter le
    flux ? » demande de connaître SES VOISINS. Seul le fournisseur les a. Voir
    `sortieDeToast.test.tsx` pour la géométrie mesurée qui fixe cette règle.

    LA MINUTERIE EST ARMÉE ICI, PAS DANS UN EFFET, et c'est ce qui garde vertes
    les trois gardes de `etatsAccessibles.test.tsx`. Elles avancent l'horloge
    d'un bond (`vi.advanceTimersByTime(5_000)`) et affirment l'absence juste
    après. Une minuterie de sortie créée dans un effet naîtrait APRÈS le bond —
    les effets sont vidés en fin d'`act` — donc resterait pendante, et le toast
    serait encore là. Armée dans le corps du renvoi, elle naît DANS le bond, à
    4 500, et s'achève à 4 650 : avant les 5 000 du saut.
  */
  const sorties = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    // Déjà en train de sortir : ni double marquage, ni seconde minuterie. La
    // croix, la minuterie de 4,5 s et le bouton d'action peuvent viser le même
    // toast dans la même image.
    if (sorties.current.has(id)) return

    setToasts((current) => {
      const dernierEnFlux = [...current].reverse().find((toast) => !toast.sortant)
      const horsFlux = dernierEnFlux?.id === id
      return current.map((toast) => (toast.id === id ? { ...toast, sortant: true, horsFlux } : toast))
    })

    sorties.current.set(
      id,
      window.setTimeout(() => {
        sorties.current.delete(id)
        setToasts((current) => current.filter((toast) => toast.id !== id))
      }, SORTIE_MS),
    )
  }, [])

  useEffect(() => {
    const minuteries = sorties.current
    return () => {
      for (const minuterie of minuteries.values()) window.clearTimeout(minuterie)
      minuteries.clear()
    }
  }, [])

  const notify = useCallback<ToastContextValue['notify']>((message, options) => {
    const id = nextId.current++
    setToasts((current) => [
      ...current.slice(-2),
      { id, message, tone: options?.tone ?? 'neutral', action: options?.action },
    ])
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* `polite` : annoncé sans voler le focus de l'utilisateur. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        // `max(base, env(…))` et non `calc(base + env(…))` : le toast FLOTTE,
        // rien n'est peint jusqu'au bord. L'inset porte déjà la garde qu'il
        // faut contre la barre de gestes ; l'additionner propulserait une
        // notification passagère 50 px au-dessus du contenu, sur des écrans qui
        // n'en ont pas à donner. Le bandeau de version, lui, est peint et prend
        // l'addition — voir `BandeauVersion.tsx`.
        //
        // Le rembourrage de base est ÉCRIT DANS le `max()` plutôt que laissé à
        // un `p-4` qu'on surchargerait : c'est la seule forme qui ne dépende
        // pas de l'ordre de tri des utilitaires Tailwind, et la seule où l'on
        // voit d'un coup d'œil que l'appareil sans encoche garde ses 16 px.
        //
        // Les deux côtés latéraux sont traités, pas seulement le bas : en
        // paysage l'encoche mord à gauche OU à droite selon le sens de
        // rotation, et le toast passe à droite dès `sm`.
        className={cn(
          // `bottom-[var(--h-barre-basse)]` et non `bottom-0` : sous 64 rem, la
          // coquille de gestion monte une barre de 4 rem et élève cette variable ;
          // un toast à `bottom-0` la recouvrait 4,5 s, juste quand on veut changer
          // d'écran. Même décalage que `BandeauVersion`, pour la même raison.
          // `justify-end` NE CHANGE RIEN AUX TOASTS EN FLUX — le conteneur est
          // haut de son contenu, il n'y a aucun espace libre à distribuer
          // (mesuré : positions identiques avec et sans). Il commande la
          // POSITION STATIQUE du toast qui SORT du flux, laquelle suit
          // `justify-content` : sans lui, le toast sortant se reposerait au HAUT
          // de la colonne, 54 px plus bas que sa place quand il y en a deux,
          // 108 avec trois. La classe et le `absolute` de `ToastItem` sont un
          // seul mécanisme en deux morceaux ; `sortieDeToast.test.tsx` les tient
          // ensemble.
          'pointer-events-none fixed inset-x-0 bottom-[var(--h-barre-basse,0px)] flex flex-col items-center justify-end gap-2',
          'pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]',
          'sm:items-end sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          'sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]',
        )}
        style={{ zIndex: 'var(--z-toast)' }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Un message qui s'efface tout seul a besoin d'une échappatoire.
 *
 * Trois manques, et trois réponses distinctes :
 *
 *  - PAS de bouton de fermeture — corrigé. C'est le minimum : sans lui, un
 *    message reste 4,5 s quoi qu'il arrive, et l'action qu'il propose disparaît
 *    sous les doigts de qui la vise. Le bouton NE PREND PAS le focus à
 *    l'apparition : la région reste `polite`, une notification s'annonce, elle
 *    n'interrompt pas. Un focus volé arracherait le curseur du champ en cours
 *    de saisie — plus grave que le message manqué.
 *
 *  - PAS de pause au survol ni au focus — corrigé aussi, et pour une raison
 *    plus dure que le confort de lecture : la minuterie DÉMONTE l'élément qui
 *    porte le focus. Qui tabule jusqu'au bouton « Annuler » d'un toast le voit
 *    s'évaporer et retombe au `body`, donc en tête de document. Le survol suit
 *    la même règle par symétrie, et parce que le geste « je pose le pointeur
 *    dessus pour finir de lire » est universel. Le marché est tactile et le
 *    survol y est rare, mais il ne coûte rien de plus que le focus, qui, lui,
 *    est indispensable.
 *
 *  - PAS d'Échap — DÉLIBÉRÉMENT laissé de côté. Échap appartient à ce qui
 *    retient : une fenêtre modale, la liste ouverte d'un `Combobox`. Un toast
 *    ne retient rien, ne prend pas le focus et se superpose justement à ces
 *    éléments-là. Y accrocher un écouteur global de touches ferait fermer le
 *    toast au lieu de la fenêtre modale que l'utilisateur visait — on
 *    échangerait un message perdu contre un geste détourné.
 */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const t = useT()
  const [suspendu, setSuspendu] = useState(false)
  const sortant = toast.sortant === true

  /*
    LA MINUTERIE EST CELLE DU RENVOI, JAMAIS CELLE DE LA PEINTURE. Elle compte
    4 500 ms pleines, la sortie s'ajoute après, et elle s'arrête une fois le
    renvoi prononcé — un toast qui s'efface n'a plus rien à demander. `dismiss`
    est de toute façon idempotent ; ce `sortant` évite simplement d'armer une
    minuterie de 4,5 s pour un nœud qui vit 150 ms.
  */
  useEffect(() => {
    if (suspendu || sortant) return
    const timer = window.setTimeout(onDismiss, DURATION)
    return () => window.clearTimeout(timer)
  }, [onDismiss, suspendu, sortant])

  return (
    <div
      data-toast
      /* La pause au survol et au focus reste branchée pendant la sortie sans y
         rien changer : le nœud ne prend plus le pointeur et a quitté l'arbre
         d'accessibilité, aucun de ces deux événements ne peut donc plus
         l'atteindre. Rien à débrancher, rien à cas particulier. */
      onMouseEnter={() => setSuspendu(true)}
      onMouseLeave={() => setSuspendu(false)}
      // `onFocus`/`onBlur` et non `onFocusIn`/`onFocusOut` : en React, ces deux
      // événements-là remontent déjà depuis les boutons enfants.
      onFocus={() => setSuspendu(true)}
      onBlur={() => setSuspendu(false)}
      /*
        PENDANT LA SORTIE, LE TOAST N'EXISTE PLUS QUE POUR L'ŒIL — même règle
        qu'au conteneur de la modale, et pour les mêmes gardes : un nœud qui
        s'attarde 150 ms resterait sinon lisible, cliquable et tabulable.

        PAS D'`inert`, ET C'EST DÉLIBÉRÉ. `inert` retirerait en plus la
        FOCALISABILITÉ des deux boutons — ce qu'`aria-hidden` ne fait pas. Le
        gain se chiffre à 150 ms pendant lesquelles une tabulation pourrait
        encore atteindre une croix devenue invisible ; or qui a le focus DANS le
        toast suspend l'effacement (voir la minuterie ci-dessus), donc ce cas
        suppose de tabuler VERS un toast qu'on ne voit plus, dans la fenêtre de
        son fondu. Le risque en face porte sur la seule chose que le toast sache
        faire : annoncer. Cette région est `aria-live="polite"`, et les
        techniques d'assistance y suivent les mutations du sous-arbre ; poser
        `inert` — qui implique la sémantique d'`aria-hidden` sur toute la
        descendance — sur un nœud d'une région vivante est un geste dont l'effet
        sur une annonce EN COURS n'a pas été mesuré ici. Entre 150 ms de
        focalisabilité résiduelle et le risque d'étouffer l'annonce, on garde
        l'annonce. `aria-hidden` seul ne le menace pas : `aria-relevant` vaut par
        défaut `additions text`, une disparition ne s'annonce pas.
      */
      aria-hidden={sortant || undefined}
      className={cn(
        sortant ? 'animate-rise-out' : 'animate-rise',
        // Conditionnel, jamais deux classes de la même propriété côte à côte :
        // `pointer-events-none` et `-auto` ne se départagent que par l'ordre de
        // la feuille produite par Tailwind, que rien ici ne contrôle.
        sortant ? 'pointer-events-none' : 'pointer-events-auto',
        /*
          IL QUITTE LE FLUX À L'INSTANT OÙ IL COMMENCE À PARTIR, pas à la fin.

          C'est tout l'objet de la manœuvre. Le retirer du flux SEULEMENT au
          démontage donnerait deux événements là où il y en avait un : 150 ms de
          fondu, puis le même replacement sec de la colonne — et la pause
          désigne le saut à l'œil. Hors flux dès le départ, la colonne se replace
          UNE fois, aussitôt, pendant que le toast glisse par-dessus elle.

          SEULEMENT S'IL ÉTAIT LE DERNIER EN FLUX, et cette borne est mesurée,
          pas prudentielle : la position statique d'un enfant absolu d'une boîte
          flexible se calcule comme s'il était le seul élément, donc au bord que
          `justify-content` désigne — et ce conteneur, ancré par le bas et haut
          de son contenu, rétrécit à l'instant même où l'enfant le quitte. Pour
          le dernier en flux, ce bord EST sa place : boîte inchangée au pixel
          (relevé dans Chrome). Pour les autres, c'est un saut de 54 px vers le
          bas, 108 pour le premier de trois. Ceux-là s'effacent donc sur place :
          leur voisin du dessus attend la fin du fondu pour descendre, ce qui est
          le défaut qu'on vient de décrire — mais une pause vaut mieux qu'un
          saut, et rien en CSS statique ne sait dire « la place que j'occupais ».
        */
        sortant && toast.horsFlux && 'absolute',
        'on-dark flex w-full max-w-sm items-start gap-3',
        'rounded-lg border border-on-dark-border bg-ink px-4 py-3 text-on-dark shadow-e3',
      )}
    >
      <Icon name={TONE_ICON[toast.tone]} size={17} className={cn('mt-0.5', TONE_ACCENT[toast.tone])} />
      <p className="min-w-0 flex-1 text-body">{toast.message}</p>

      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          /*
            `-my-3` avec `min-h-11` : la cible fait 44 px, et le toast ne grandit
            pas d'un pixel. Le rembourrage vertical du toast vaut douze de chaque
            côté ; la marge négative y loge la hauteur excédentaire du bouton, dont
            la boîte de marge retombe alors sous celle du message. Un doigt vise
            44 px, l'œil voit la ligne de texte qu'il voyait.
          */
          className="-my-3 inline-flex min-h-11 cursor-pointer items-center rounded-sm px-1 text-label font-semibold text-accent-on-dark underline underline-offset-2 hover:text-on-dark"
        >
          {toast.action.label}
        </button>
      )}

      {/* `IconButton` plutôt qu'un bouton sur mesure : il porte déjà la cible
          tactile de 44 px, que ce marché ne peut pas se permettre de rater sur
          la seule sortie du message. Les marges négatives la reprennent sur le
          rembourrage du toast pour ne pas le faire enfler.

          `onDark` et non la variante fantôme par défaut : celle-ci peint
          `bg-transparent`, et la bascule `.on-dark` de `tokens.css` s'arrête
          délibérément à la première surface rencontrée — `:not([class*='bg-'])`
          — pour ne jamais repeindre le libellé d'un élément qui porte SON PROPRE
          fond. Du temps de l'or, c'était le bouton d'accent que cette exclusion
          protégeait : son libellé restait encre sombre, et le blanc l'aurait
          détruit. L'aplat d'accent porte aujourd'hui `--color-on-accent`, donc
          du blanc, et cet argument-là est tombé ; celui qui le remplace tient
          au même mécanisme et vaut pour toutes les autres surfaces — une
          surface CLAIRE posée dans un panneau sombre garde son encre sombre, et
          la bascule n'a d'autre moyen de la reconnaître que la classe `bg-*`
          que Tailwind lui donne. Le bouton fantôme, lui, n'a justement aucun
          fond : son `text-ink` serait donc resté encre sombre sur l'encre du
          toast, une croix invisible. La variante sombre porte sa propre
          couleur. */}
      <IconButton
        icon="close"
        variant="onDark"
        label={t('common.closeNotification')}
        onClick={onDismiss}
        className="-my-1.5 -mr-2 shrink-0"
      />
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé dans un <ToastProvider>')
  return context
}
