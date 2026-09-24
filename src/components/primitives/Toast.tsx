import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
   * Le décalage qu'il occupait À L'INSTANT DU RENVOI, en pixels.
   *
   * GELÉ, ET NON RECALCULÉ — c'est tout le piège de ce champ. Un toast qui sort
   * cesse de compter dans l'empilement pour que ses voisins descendent aussitôt ;
   * s'il se recalculait avec eux, il descendrait aussi, et son fondu se ferait en
   * glissant au lieu de se faire sur place. Il doit rester exactement là où on
   * l'a vu pour la dernière fois.
   */
  decalageGele?: number
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

/**
 * L'écart entre deux toasts empilés, en pixels — miroir du `gap-2` d'avant.
 *
 * Il est passé d'une classe à un nombre parce que l'empilement n'est plus une
 * colonne flexible : chaque toast est posé à un décalage CALCULÉ, et l'écart est
 * un terme de ce calcul. Rien en CSS ne le porte plus, donc rien ne peut le
 * contredire.
 */
const ECART = 8

/**
 * Le tempo du REPLACEMENT des voisins, selon ce qui l'a provoqué.
 *
 * Les voisins ne bougent jamais pour eux-mêmes : ils bougent parce qu'un toast
 * est arrivé ou parce qu'un toast est parti. Leur glissement appartient donc à
 * cet événement-là et en prend la durée — sans quoi un seul geste se lirait en
 * deux temps. L'arrivée dure `--duration-slow` comme `animate-rise` ; le départ
 * `--duration-fast` comme `animate-rise-out`, et le fondu du partant se termine
 * alors exactement quand ses voisins ont fini de descendre.
 */
const TEMPO_MS = { arrivee: 300, depart: 150 } as const

type Tempo = keyof typeof TEMPO_MS

/**
 * OÙ CHAQUE TOAST SE POSE, mesuré depuis le bas de la pile.
 *
 * La pile est ancrée EN BAS : le dernier toast du tableau — le plus récent — est
 * à zéro, et chacun de ses aînés monte de la hauteur de ce qui le sépare du bord.
 * D'où le parcours à rebours.
 *
 * UN TOAST SORTANT NE COMPTE PAS dans le cumul, et c'est le cœur du mécanisme :
 * il libère sa place à l'instant où il commence à partir, donc ses voisins
 * descendent PENDANT son fondu et non après. Lui reprend le décalage gelé à son
 * renvoi.
 *
 * Fonction PURE, et elle a besoin de l'être : `dismiss` l'appelle pour geler,
 * depuis l'intérieur d'un calculateur d'état que React peut rejouer.
 */
function calculerDecalages(toasts: Toast[], hauteurs: Map<number, number>) {
  const decalages = new Map<number, number>()
  let cumul = 0
  for (let i = toasts.length - 1; i >= 0; i--) {
    const toast = toasts[i]
    if (toast.sortant) {
      decalages.set(toast.id, toast.decalageGele ?? cumul)
      continue
    }
    decalages.set(toast.id, cumul)
    cumul += (hauteurs.get(toast.id) ?? 0) + ECART
  }
  return decalages
}

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
  const [tempo, setTempo] = useState<Tempo>('arrivee')

  /*
    LES HAUTEURS SONT MESURÉES, PAS DEVINÉES — et c'est ce que le CSS statique ne
    savait pas faire.

    Un toast fait la hauteur de son message : une ligne, deux, trois s'il porte
    une action longue. Aucune règle ne peut donc dire « monte de 54 px » ; il faut
    LIRE la boîte. D'où ce relevé, et d'où le fait que l'empilement ne soit plus
    une colonne flexible mais des positions absolues calculées.

    EN `ref` ET NON EN ÉTAT, avec un compteur de version à côté. `dismiss` doit
    pouvoir lire les hauteurs pour geler le décalage du partant, et doit rester
    STABLE d'un rendu à l'autre : c'est lui qui arme la minuterie de 4,5 s, et une
    identité neuve la relancerait à chaque rendu du fournisseur. Les mettre en
    état l'aurait fait dépendre d'elles.

    `useLayoutEffect` ET NON `useEffect` : le premier rendu ne connaît aucune
    hauteur, donc pose tout le monde à zéro. La mesure corrige au rendu suivant,
    et il faut que ce second rendu soit peint EN MÊME TEMPS que le premier — un
    effet de disposition est vidé, et son `setState` traité, avant que le
    navigateur ne peigne. Avec `useEffect`, la pile clignoterait empilée à plat.
  */
  const hauteurs = useRef(new Map<number, number>())
  const noeuds = useRef(new Map<number, HTMLElement>())
  const [versionDesHauteurs, setVersionDesHauteurs] = useState(0)

  const mesurer = useCallback((id: number, noeud: HTMLElement | null) => {
    if (noeud) noeuds.current.set(id, noeud)
    else noeuds.current.delete(id)
  }, [])

  useLayoutEffect(() => {
    const releve = new Map<number, number>()
    for (const [id, noeud] of noeuds.current) releve.set(id, noeud.offsetHeight)

    let change = releve.size !== hauteurs.current.size
    if (!change) {
      for (const [id, hauteur] of releve) {
        if (hauteurs.current.get(id) !== hauteur) {
          change = true
          break
        }
      }
    }
    // LA GARDE D'ÉGALITÉ EST CE QUI FERME LA BOUCLE, et il en faut une : cet
    // effet dépend de la version qu'il incrémente. Un relevé identique ne
    // réveille personne, donc la chaîne s'arrête au deuxième tour.
    if (!change) return
    hauteurs.current = releve
    setVersionDesHauteurs((version) => version + 1)
    // `versionDesHauteurs` EST DANS LA LISTE, et ce n'est pas pour faire plaisir
    // au linter : le redimensionnement n'a pas d'autre moyen de demander un
    // nouveau relevé. Il incrémente la version sans toucher aux toasts ; sans
    // elle ici, une rotation d'écran laisserait la pile sur les hauteurs d'avant.
  }, [toasts, versionDesHauteurs])

  useEffect(() => {
    // Une rotation d'écran rechange les retours à la ligne, donc les hauteurs, et
    // ne provoque aucun rendu à elle seule.
    const surRedimensionnement = () => setVersionDesHauteurs((version) => version + 1)
    window.addEventListener('resize', surRedimensionnement)
    return () => window.removeEventListener('resize', surRedimensionnement)
  }, [])

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

    ET UNE SECONDE RAISON, PLUS FORTE : « où ce toast se pose-t-il ? » se répond
    avec la hauteur de TOUS SES VOISINS. Seul le fournisseur les a, et c'est lui
    qui les mesure. Voir `sortieDeToast.test.tsx`, qui pose de vraies hauteurs
    sous jsdom pour tenir les décalages au pixel.

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

    setTempo('depart')
    setToasts((current) => {
      const decalages = calculerDecalages(current, hauteurs.current)
      return current.map((toast) =>
        toast.id === id ? { ...toast, sortant: true, decalageGele: decalages.get(id) ?? 0 } : toast,
      )
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
    setTempo('arrivee')
    setToasts((current) => [
      ...current.slice(-2),
      { id, message, tone: options?.tone ?? 'neutral', action: options?.action },
    ])
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  /*
    LES DÉCALAGES SE CALCULENT AU RENDU, en lisant une `ref`.

    Lecture de `ref` pendant le rendu, donc, et elle est délibérée : le relevé est
    un CACHE de ce que le DOM vient de dire, et `versionDesHauteurs` — cité ici
    pour que la dépendance soit VISIBLE et non seulement vraie — garantit qu'un
    rendu suit toute valeur nouvelle. Sous double rendu de `StrictMode`, les deux
    lectures rendent la même chose : rien ici ne dépend de l'ordre.
  */
  void versionDesHauteurs
  const decalages = calculerDecalages(toasts, hauteurs.current)

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
          //
          // PLUS DE `gap-2` NI DE `justify-end`, ET PLUS DE COLONNE DU TOUT : les
          // toasts sont posés en absolu à un décalage calculé. L'écart vit dans
          // `ECART`, et `justify-end` ne servait qu'à placer le toast qui quittait
          // le flux — mécanisme dont il ne reste rien. `items-center` et
          // `sm:items-end` RESTENT : ils placent la colonne, désormais enfant
          // unique.
          'pointer-events-none fixed inset-x-0 bottom-[var(--h-barre-basse,0px)] flex flex-col items-center',
          'pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]',
          'sm:items-end sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          'sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]',
        )}
        style={{ zIndex: 'var(--z-toast)' }}
      >
        {/*
          LA COLONNE EST UNE BOÎTE DE HAUTEUR NULLE, et c'est ce qui garde juste le
          rembourrage du conteneur.

          Un enfant absolu se place sur la boîte de REMBOURRAGE de son ancêtre
          positionné : posé directement dans le conteneur, `bottom-0` l'aurait collé
          au bord extérieur du `pb`, donc par-dessus la zone sûre que ce rembourrage
          réserve. Cette boîte-ci vit DANS le rembourrage — elle n'a que des enfants
          absolus, donc aucune hauteur propre — et les décalages se comptent depuis
          son bord bas, qui est le bord bas du contenu.

          Elle porte aussi la largeur : `max-w-sm` a quitté le toast pour venir ici,
          puisque c'est elle que `items-center` et `sm:items-end` placent.
        */}
        <div className="relative w-full max-w-sm">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              decalage={decalages.get(toast.id) ?? 0}
              tempo={tempo}
              mesurer={mesurer}
              onDismiss={dismiss}
            />
          ))}
        </div>
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
function ToastItem({
  toast,
  decalage,
  tempo,
  mesurer,
  onDismiss,
}: {
  toast: Toast
  decalage: number
  tempo: Tempo
  mesurer: (id: number, noeud: HTMLElement | null) => void
  onDismiss: (id: number) => void
}) {
  const t = useT()
  const [suspendu, setSuspendu] = useState(false)
  const sortant = toast.sortant === true
  const id = toast.id

  /*
    LA MINUTERIE EST CELLE DU RENVOI, JAMAIS CELLE DE LA PEINTURE. Elle compte
    4 500 ms pleines, la sortie s'ajoute après, et elle s'arrête une fois le
    renvoi prononcé — un toast qui s'efface n'a plus rien à demander. `dismiss`
    est de toute façon idempotent ; ce `sortant` évite simplement d'armer une
    minuterie de 4,5 s pour un nœud qui vit 150 ms.

    ELLE REÇOIT `dismiss` LUI-MÊME, ET NON UNE FERMETURE SUR L'IDENTIFIANT — c'est
    une correction, pas un détail de style. L'appelant écrivait
    `onDismiss={() => dismiss(toast.id)}` : une flèche NEUVE à chaque rendu du
    fournisseur, donc une dépendance neuve, donc cet effet rejoué et les 4 500 ms
    REPARTIES DE ZÉRO. Un toast voyait son compte à rebours relancé par l'arrivée
    de son voisin. Le relevé des hauteurs ajoute des rendus au fournisseur : sans
    cette correction, la réécriture de l'empilement aurait aggravé le défaut
    qu'elle croise. `dismiss` est stable, `id` est un nombre.
  */
  useEffect(() => {
    if (suspendu || sortant) return
    const timer = window.setTimeout(() => onDismiss(id), DURATION)
    return () => window.clearTimeout(timer)
  }, [onDismiss, id, suspendu, sortant])

  return (
    /*
      LA COQUILLE QUI PLACE, ET LE TOAST QUI PARAÎT — deux nœuds, et il en faut
      deux.

      Les deux mouvements portent sur `transform` et ne peuvent donc pas vivre sur
      le même élément : l'entrée est une ANIMATION (`gl-rise`, qui écrase la
      transformation en ligne pendant toute sa durée), le replacement est une
      TRANSITION vers un décalage calculé. Superposés, l'animation gagne, et le
      toast se replacerait d'un bond à la fin de son entrée. Séparés, la coquille
      glisse pendant que le contenu monte.

      C'est aussi le bon partage selon la règle : une entrée et une sortie jouent
      UNE fois et n'ont pas à être interrompues, un replacement peut l'être à tout
      instant — un troisième toast peut arriver pendant que le deuxième descend —
      et une transition se re-cible depuis sa position courante là où une animation
      repartirait de zéro.

      `translate3d` plutôt que `translateY` : un seul axe suffirait, mais la forme
      à trois composantes est celle qui promet la couche composée sur les moteurs
      anciens, et ce marché tourne sur de l'Android bas de gamme.

      LA DURÉE EST EN LIGNE, et `prefers-reduced-motion` la bat quand même : la
      règle globale de `tokens.css` pose `transition-duration: 0.001ms !important`,
      et une déclaration importante l'emporte sur une déclaration en ligne normale.
    */
    <div
      ref={(noeud) => mesurer(id, noeud)}
      data-toast-place
      className="pointer-events-none absolute inset-x-0 bottom-0 transition-transform ease-out"
      style={{
        transform: `translate3d(0, ${-decalage}px, 0)`,
        transitionDuration: `${TEMPO_MS[tempo]}ms`,
      }}
    >
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
          'on-dark flex w-full items-start gap-3',
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
              onDismiss(id)
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
          onClick={() => onDismiss(id)}
          className="-my-1.5 -mr-2 shrink-0"
        />
      </div>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé dans un <ToastProvider>')
  return context
}
