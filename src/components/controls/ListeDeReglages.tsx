import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCY_DEFS } from '@/currency/currencies'
import { LanguageSwitcher } from './LanguageSwitcher'
import { CurrencySwitcher } from './CurrencySwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'

/**
 * LANGUE, DEVISE, THÈME — UNE SEULE FOIS, POUR LES QUATRE SURFACES.
 *
 * ═══ CE QU'IL Y AVAIT ═══
 *
 * Le trio était assemblé à la main à quatre endroits, et les quatre ne se
 * ressemblaient pas :
 *
 *   vitrine           `flex-wrap` en rangée, aucun intitulé
 *   authentification  colonne alignée à gauche, aucun intitulé
 *   coquille          colonne, intitulés en capitales, avis de conversion
 *   barre locataire   rangée en ligne, devise et thème masqués sous `sm`
 *
 * Rien ne les tenait ensemble : quatre `className` distinctes autour des mêmes
 * trois composants. Le même utilisateur rencontrait la même décision sous
 * quatre apparences, et deux d'entre elles ne disaient pas ce qu'on y règle —
 * trois commandes nues, dont un segment « FR | EN » qu'il faut reconnaître.
 *
 * L'intitulé, là où il existait, était écrit DEUX FOIS : le sélecteur de devise
 * portait « Devise » dans son propre bouton, sous une section déjà nommée
 * « DEVISE ». L'écran se lisait « DEVISE / DEVISE Euro (€) ».
 *
 * ═══ LA FORME RETENUE : UNE LISTE, PAS UNE RANGÉE ═══
 *
 * Intitulé à gauche, commande à droite, une ligne par réglage, séparées par un
 * filet. Trois raisons, dans l'ordre où elles ont pesé.
 *
 * L'ALIGNEMENT À DROITE donne aux trois commandes un bord commun. Elles n'ont
 * pas la même largeur — 96 px pour deux langues, 142 pour trois thèmes, et la
 * devise varie avec son libellé — et alignées à gauche elles composaient un
 * escalier. Un bord partagé fait lire trois lignes d'une même liste plutôt que
 * trois objets empilés.
 *
 * L'INTITULÉ À GAUCHE, et non au-dessus : au-dessus, trois réglages occupent
 * six lignes et le panneau double de hauteur pour ne rien dire de plus. Il
 * tient à gauche parce que « Langue », « Devise » et « Thème » sont courts dans
 * les deux langues — c'est vérifié, pas supposé : `mesure-ui` refuse tout
 * débordement latéral aux onze largeurs, en français comme en anglais.
 *
 * LE FILET SÉPARE TROIS COMMANDES QUI N'ONT PAS LA MÊME GRAMMAIRE. Deux
 * segmentés et une liste déroulante ne se ressemblent pas, et c'est justifié :
 * deux langues et trois thèmes tiennent à l'œil, quatre devises aux noms longs
 * non. Ce qu'on uniformise n'est donc pas la commande — ce serait appauvrir
 * l'une pour imiter l'autre — mais son CADRE.
 *
 * ═══ CE QUE CE COMPOSANT NE FAIT PAS ═══
 *
 * Il n'ouvre ni ne ferme rien. Le piège de focus, Échap et le clic extérieur
 * restent à `usePiegeDeFocus`, et l'ancrage à chaque panneau : la vitrine ouvre
 * une feuille, la coquille une liste sous son bouton. On partage le contenu,
 * pas la mise en scène.
 */

/**
 * Une ligne de la liste : ce qu'on règle, et ce avec quoi.
 *
 * `data-reglage-intitule` plutôt qu'un `<label>` : aucune de ces trois
 * commandes n'est un champ de formulaire — deux sont des groupes de boutons,
 * la troisième ouvre une liste. Un `<label for>` n'aurait rien à désigner, et
 * le nom accessible de chacune vient déjà de son propre `aria-label`. Cet
 * attribut sert la garde, qui compare les intitulés d'une surface à l'autre.
 */
function Reglage({
  intitule,
  note,
  children,
}: {
  intitule: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <span data-reglage-intitule="" className="eyebrow shrink-0 text-muted">
          {intitule}
        </span>
        {/* `min-w-0` : sans lui, le libellé d'une devise longue pousse la ligne
            au-delà du panneau au lieu de se contenter de la place restante. */}
        <div className="flex min-w-0 justify-end">{children}</div>
      </div>
      {/* L'avis suit sa commande et se cale sous elle : posé à gauche, il
          passerait pour un second intitulé. */}
      {note && <div className="flex justify-end text-right">{note}</div>}
    </div>
  )
}

/**
 * CE QUE LA CONVERSION REPOSE, DIT SOUS LA COMMANDE QUI LA DÉCIDE.
 *
 * Trois états, et ils ne se confondent pas :
 *
 *   — une devise demandée qu'aucun cours n'atteint : on le DIT, en nommant
 *     celle qu'on affiche à la place. Sans cela le sélecteur enregistrait le
 *     choix, l'écran n'en tenait pas compte, et rien ne l'expliquait ;
 *   — une conversion sans date : c'est la parité légale du franc CFA, fixée par
 *     traité. Annoncer un jour qu'on n'a pas serait le seul mensonge possible
 *     ici, se taire laisserait des euros sans provenance sur un parc en francs.
 *     Le test est sûr : les cours flottants n'arrivent JAMAIS sans leur date,
 *     `taux.ts` fait tomber la réponse qui n'en porte pas ;
 *   — une conversion datée : on donne la date.
 *
 * Rien du tout quand on lit le parc dans sa propre monnaie, qui est le cas
 * ordinaire et n'a rien à justifier.
 */
function MentionDeConversion() {
  const t = useT()
  const d = useDates()
  const { converti, coursIndisponibles, dateDesCours, deviseSource } = useCurrency()

  if (coursIndisponibles)
    return (
      <span className="text-caps text-warn">
        {t('common.currencyUnavailable', { currency: CURRENCY_DEFS[deviseSource].label })}
      </span>
    )

  if (!converti) return null

  if (!dateDesCours)
    return <span className="text-caps text-muted">{t('common.currencyPegged')}</span>

  return (
    <span className="text-caps text-muted">
      {t('common.currencyConverted', { date: d.fullDate(partiesDeDateISO(dateDesCours)) })}
    </span>
  )
}

export interface ListeDeReglagesProps {
  /**
   * Nom du témoin de mesure, quand la surface en a un.
   *
   * `mesure-ui` recense deux blocs par leur `data-mesure` — celui de la vitrine
   * et celui des écrans d'authentification — pour vérifier au navigateur qu'ils
   * sont atteignables au clavier une fois le panneau ouvert. Les noms restent
   * distincts parce que les deux surfaces le sont ; c'est le CONTENU qui est
   * partagé, pas le point de mesure.
   */
  mesure?: string
  className?: string
}

export function ListeDeReglages({ mesure, className }: ListeDeReglagesProps) {
  const t = useT()

  return (
    <div
      data-reglages=""
      data-mesure={mesure}
      className={cn('flex w-full flex-col divide-y divide-divider', className)}
    >
      <Reglage intitule={t('common.language')}>
        <LanguageSwitcher />
      </Reglage>
      <Reglage intitule={t('common.currency')} note={<MentionDeConversion />}>
        <CurrencySwitcher />
      </Reglage>
      <Reglage intitule={t('common.theme')}>
        <ThemeSwitcher />
      </Reglage>
    </div>
  )
}
