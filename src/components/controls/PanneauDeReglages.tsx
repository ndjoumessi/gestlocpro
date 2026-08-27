import { useRef, useState } from 'react'
import { IconButton } from '@/components/primitives/Button'
import { usePiegeDeFocus } from '@/components/primitives/piegeDeFocus'
import { LanguageSwitcher } from './LanguageSwitcher'
import { CurrencySwitcher } from './CurrencySwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'
import { useT } from '@/i18n/I18nProvider'

/**
 * LES TROIS RÉGLAGES DERRIÈRE UN SEUL BOUTON.
 *
 * ═══ CE QUE LEUR RANGÉE COÛTAIT AUX ÉCRANS D'AUTHENTIFICATION ═══
 *
 * Mesuré à 360 × 900 sur l'écran de connexion : l'en-tête faisait 196 px, dont
 * 108 px pour la seule rangée de réglages — elle se replie sur DEUX lignes, ses
 * trois sélecteurs réclamant 338 px de min-content dans une colonne de 320. Le
 * `<h1>` commençait donc à 333 px, soit 37 % de la fenêtre AVANT que la page ne
 * dise ce qu'elle est. Quelqu'un qui revient se connecter rencontrait d'abord
 * un sélecteur de devise.
 *
 * ═══ POURQUOI CE COMPOSANT ET NON UN QUATRIÈME `flex-wrap` ═══
 *
 * Le commentaire d'`AuthLayout` pesait déjà deux options — replier la rangée,
 * ou MASQUER des contrôles sous un point de rupture — et refusait la seconde à
 * bon droit : un contrôle absent de 320 à 639 px coûte plus que la ligne qu'il
 * économise. Il manquait la troisième, que la vitrine emploie depuis un lot :
 * replier derrière un DÉCLENCHEUR. Rien n'est retiré, tout reste à un geste, et
 * l'en-tête retombe sur une ligne.
 *
 * ═══ CE N'EST PAS UNE SECONDE IMPLÉMENTATION ═══
 *
 * Le piège de focus, le retour du focus, Échap et le clic extérieur viennent de
 * `usePiegeDeFocus`, écrit une fois pour les deux panneaux de la coquille. Ce
 * fichier n'ajoute que la GÉOMÉTRIE d'une liste déroulante et le contenu.
 *
 * `verrouillerLeDefilement: false` est le point : une liste de trois réglages
 * ancrée à son bouton ne fige pas la page derrière elle. C'est exactement la
 * distinction que le crochet expose, et pour laquelle il l'expose.
 *
 * ═══ CE QU'IL NE REMPLACE PAS, ET POURQUOI ═══
 *
 * Le panneau de `PublicHeader` reste où il est. Il porte DEUX choses de plus
 * qu'une liste de réglages : les liens de section sous `lg`, et une feuille
 * pleine page qui neutralise l'arrière-plan par `inert`. Les écrans
 * d'authentification n'ont ni liens de section ni besoin d'une modale pour
 * changer de langue. Les unifier reviendrait à donner à l'un les devoirs de
 * l'autre — et c'est le sens de l'unification qui compte : on partage le
 * crochet, pas la mise en page.
 */
export function PanneauDeReglages({ className }: { className?: string }) {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const panneauRef = useRef<HTMLDivElement>(null)

  usePiegeDeFocus(ouvert, panneauRef, () => setOuvert(false), {
    /* Une liste déroulante n'est pas une modale : figer le document derrière un
       objet de 250 px arrêterait le défilement de la page pour trois réglages. */
    verrouillerLeDefilement: false,
    fermerAuClicExterieur: true,
  })

  return (
    <div className={className}>
      <div className="relative flex justify-end">
        {/* PAS DE RÉFÉRENCE SUR LE DÉCLENCHEUR, et ce n'est pas un oubli :
            `usePiegeDeFocus` retient lui-même l'élément qui avait le focus avant
            l'ouverture et le lui rend à la fermeture. Lui passer une référence
            reviendrait à tenir un second registre de la même chose, qui pourrait
            en diverger. `IconButton` ne relaie d'ailleurs pas les siennes. */}
        <IconButton
          icon={ouvert ? 'close' : 'sliders'}
          label={ouvert ? t('marketing.nav.closeSettings') : t('marketing.nav.openSettings')}
          variant="secondary"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-haspopup="dialog"
          /* Nommé plutôt que deviné : `mesure-ui` recense les déclencheurs à
             panneau par cet attribut, et a déjà pris le sélecteur de devise
             pour celui du menu de la vitrine — « un grief exact sur un fait
             faux ». */
          data-declencheur-reglages=""
        />

        {ouvert && (
          <div
            ref={panneauRef}
            role="dialog"
            aria-label={t('marketing.nav.openSettings')}
            /* `tabIndex={-1}` : sans lui le panneau ne peut pas recevoir le
               focus à l'ouverture, et la tabulation suivante repartirait du haut
               du document plutôt que du premier réglage. */
            tabIndex={-1}
            /*
              ANCRÉ SOUS SON BOUTON, ET DIMENSIONNÉ À SON CONTENU.

              `right-0` et non `left-0` : le bouton est au bout d'une rangée
              alignée à droite, et une liste qui s'ouvrirait vers la droite
              sortirait de la fenêtre. `w-max` prend la largeur que les trois
              réglages réclament — mesurée à 338 px — au lieu de s'étirer sur la
              colonne ; `max-w-[calc(100vw-2.5rem)]` est le filet, à 320 px où
              338 ne tient pas dans les 280 disponibles.

              L'ombre et le rayon sont ceux des listes déroulantes du dépôt : le
              panneau flotte au-dessus de la page, rien ne l'en détacherait
              sans elles.
            */
            /* `--z-dropdown` ET NON UN NOMBRE : le dépôt tient une échelle
               d'altitudes déclarée, et `altitudes.test.ts` refuse tout niveau
               écrit à la main — il a rougi sur le `z-10` de la première
               rédaction. Une liste déroulante est très exactement ce que ce
               barreau nomme. */
            style={{ zIndex: 'var(--z-dropdown)' }}
            className="absolute top-full right-0 mt-2 w-max max-w-[calc(100vw-2.5rem)] rounded-lg border border-divider bg-surface p-4 shadow-e3"
          >
            {/*
              EN COLONNE, ET NON EN RANGÉE REPLIÉE.

              La première rédaction reprenait la rangée de l'en-tête telle
              quelle — `flex-wrap justify-end`. Dans une liste déroulante de
              320 px, ses trois sélecteurs se replient sur deux lignes et se
              collent à droite : la langue et la devise en haut, le thème seul
              dessous, avec du vide à gauche. Un repli hérité d'une contrainte
              qui n'existe plus ici a l'air d'un accident.

              Une colonne est ce qu'est une liste de réglages. Elle rend aussi le
              panneau plus étroit : `w-max` vaut alors la largeur du plus large
              des trois — le thème, 142 px — au lieu de la somme de deux.
            */}
            <div
              data-mesure="reglages-authentification"
              className="flex flex-col items-start gap-2"
            >
              <LanguageSwitcher />
              <CurrencySwitcher />
              <ThemeSwitcher />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
