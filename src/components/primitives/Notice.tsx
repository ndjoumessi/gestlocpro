import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'

/**
 * LE BANDEAU D'INFORMATION, écrit UNE fois.
 *
 * CE QU'IL REMPLACE : vingt-neuf copies, dans dix-sept fichiers. Même forme à
 * chaque fois — un lavis, une bordure de la même famille, une icône alignée sur
 * la première ligne, un texte — et jamais tout à fait la même écriture. Trois
 * rembourrages verticaux cohabitaient (`py-3`, `py-2.5`, `py-3.5`), trois
 * écarts (`gap-2`, `gap-2.5`, `gap-3`), trois tailles de glyphe (15, 16, 18) et
 * trois marges externes (`mb-4`, `mb-6`, `mt-6`) pour un objet unique. Aucune de
 * ces divergences n'était une décision : ce sont des copies qui ont dérivé.
 *
 * LE COÛT N'ÉTAIT PAS L'ESPACE, C'ÉTAIT LA CORRECTION. Au lot où l'or est
 * devenu bleu, il a fallu éditer vingt-neuf chaînes de classes séparément pour
 * un seul changement de teinte — et il a suffi d'en manquer une pour qu'un
 * bandeau reste dans l'ancienne palette sans que rien ne le dise. Un objet
 * recopié n'est pas un objet cher : c'est un objet qu'on ne peut plus corriger
 * d'un seul geste.
 *
 * DEUX FORMES. UN TITRE IMPOSE LA FORTE ; SANS TITRE, ON PEUT LA DEMANDER.
 *
 * La première règle est structurelle : un titre veut dire deux niveaux de
 * lecture, donc plus de rembourrage, plus d'écart, un glyphe plus grand et le
 * rayon des conteneurs. Elle n'est PAS négociable — `forte={false}` sous un
 * titre est ignoré, sans quoi on pourrait poser deux paragraphes dans une boîte
 * dessinée pour un.
 *
 * La seconde est une correction, et elle vient d'un cas réel. La première
 * version faisait dépendre la forme du SEUL titre, et quatre écrans
 * d'authentification y ont rétréci : leur bandeau est le CONTENU PRINCIPAL de
 * la page — « lien envoyé », « mot de passe changé » — mais il ne porte pas de
 * titre, puisque `AuthLayout` en pose déjà un au-dessus. Réduits à la forme
 * compacte, ils se lisaient comme une note de bas de page là où ils sont le
 * message. `forte` sert exactement ce cas : un bandeau sans titre qui est
 * néanmoins ce que la page a à dire.
 *
 * L'ICÔNE A UN DÉFAUT PAR TON, et il se surcharge. Un bandeau d'alerte prend
 * l'alerte, un bandeau de succès la coche : recopier ce choix à chaque appel
 * était la moitié de la dérive. Elle est `aria-hidden` par construction — le
 * TEXTE porte le message, le glyphe le répète pour l'œil.
 */

export type NoticeTone = 'accent' | 'ok' | 'warn' | 'danger'

/**
 * Le lavis, la bordure et l'encre vont ENSEMBLE, dans un seul littéral par ton.
 *
 * Séparés, rien n'empêcherait une bordure d'alerte autour d'un lavis de succès.
 * C'est la leçon de `StatCard.etat`, prise au même endroit du raisonnement :
 * quand deux valeurs doivent s'accorder, on ne les expose pas séparément.
 */
const TONS: Record<NoticeTone, { classes: string; icone: IconName }> = {
  accent: { classes: 'border-accent-border bg-accent-tint text-accent-ink', icone: 'info' },
  ok: { classes: 'border-ok-border bg-ok-tint text-ok', icone: 'checkCircle' },
  warn: { classes: 'border-warn-border bg-warn-tint text-warn', icone: 'alert' },
  danger: { classes: 'border-danger-border bg-danger-tint text-danger', icone: 'alert' },
}

export interface NoticeProps {
  tone?: NoticeTone
  /** Remplace le glyphe par défaut du ton. */
  icon?: IconName
  /** Présent, il impose la forme FORTE — voir l'en-tête. */
  titre?: ReactNode
  /**
   * Demande la forme FORTE sans titre : le bandeau est le contenu principal de
   * sa région. Sous un titre, la valeur est ignorée — la forme est déjà forte.
   */
  forte?: boolean
  children: ReactNode
  className?: string
  /** `status` pour une annonce vivante, `alert` pour un échec — sinon rien. */
  role?: 'status' | 'alert'
  'aria-live'?: 'polite' | 'assertive'
  id?: string
}

export function Notice({
  tone = 'accent',
  icon,
  titre,
  forte,
  children,
  className,
  role,
  id,
  'aria-live': ariaLive,
}: NoticeProps) {
  const ton = TONS[tone]
  const fort = titre !== undefined || forte === true

  return (
    <div
      id={id}
      role={role}
      aria-live={ariaLive}
      className={cn(
        'flex items-start border',
        fort ? 'gap-3 rounded-lg px-4 py-3.5' : 'gap-2 rounded-md px-3.5 py-3',
        'text-body',
        ton.classes,
        className,
      )}
    >
      {/* `mt-0.5` : le glyphe s'aligne sur la PREMIÈRE ligne du texte et non sur
          le centre du bloc — un bandeau de trois lignes verrait sinon son icône
          flotter au milieu, loin du mot qu'elle annonce. */}
      <Icon name={icon ?? ton.icone} size={fort ? 18 : 15} className="mt-0.5 shrink-0" />
      {fort ? (
        <div className="min-w-0">
          <p className="font-medium">{titre}</p>
          {/* LE CORPS NE SE REND QUE S'IL EXISTE, et c'est un correctif : la
              première version posait toujours son paragraphe, si bien qu'un
              appelant dont le corps est CONDITIONNEL — le bandeau des relevés,
              vide quand la série est complète — gagnait une ligne vide de deux
              pixels sous son titre. Invisible à l'œil, mais présent dans le DOM,
              donc annoncé par un lecteur d'écran comme un paragraphe de plus. */}
          {children ? <p className="mt-0.5">{children}</p> : null}
        </div>
      ) : (
        <p className="min-w-0">{children}</p>
      )}
    </div>
  )
}
