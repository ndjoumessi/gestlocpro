import { cn } from '@/lib/cn'
import { Section } from '@/components/layout/Section'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const QUESTIONS = ['one', 'two', 'three', 'four', 'five'] as const

/**
 * FAQ en `<details>` natifs : ouverture au clavier, indexables par les moteurs
 * de recherche et lisibles sans JavaScript. Aucun état React n'est nécessaire.
 *
 * ═══ ACCORDÉON EXCLUSIF : UNE RÉPONSE OUVERTE À LA FOIS ═══
 *
 * Les cinq replis s'ouvraient et restaient ouverts. Deux réponses dépliées
 * poussent déjà la question suivante hors de l'écran ; cinq font de la liste un
 * mur de prose qu'on parcourt à la molette pour retrouver l'intitulé qu'on
 * cherchait. C'est la LISTE qu'on lit dans une FAQ, pas une réponse.
 *
 * `name` PARTAGÉ SUR `<details>` est l'accordéon exclusif du standard : le
 * navigateur referme les autres, sans une ligne de JavaScript et sans que rien
 * ne soit perdu — ni le clavier, ni l'indexation, ni la lecture sans script.
 * Un état React aurait fait, ici, exactement ce que le navigateur fait mieux.
 *
 * LE REPLI EST GRACIEUX. Sur un navigateur qui ignore `name` — avant fin 2023 —
 * les replis restent indépendants, c'est-à-dire le comportement d'hier : on
 * perd l'exclusivité, jamais l'accès aux réponses.
 */
export function Faq() {
  const t = useT()

  return (
    <Section
      id="faq"
      tone="paper"
      // `serre` : on lève des objections, on ne construit plus l'argument — la
      // décision s'est prise juste au-dessus. Cinq lignes repliées ne réclament
      // pas le temps qu'on accorde à une grille de six cartes, et l'aération
      // d'origine séparait la FAQ du tarif dont elle est le prolongement.
      rythme="serre"
      eyebrow={t('marketing.faq.eyebrow')}
      title={t('marketing.faq.title')}
      centered
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {QUESTIONS.map((key) => (
          <details
            key={key}
            name="faq"
            /* `gl-repli` : la réponse s'ouvre et se referme en 200 ms au lieu
               de surgir. Le mécanisme, et la raison de le tenir en CSS brut
               plutôt qu'en classe utilitaire, sont dans `tokens.css`.

               `hover:border-border-strong` : la rangée entière est cliquable
               sur 56 px et ne le disait NULLE PART — ni fond, ni bordure, ni
               changement d'encre. Seul le curseur en souris l'indiquait, ce
               qui ne s'est jamais vu au doigt. La bordure qui se renforce est
               le geste des cartes de fonctionnalités, trois sections plus
               haut : la page garde un vocabulaire. */
            className={cn(
              'gl-repli group rounded-lg border border-divider bg-surface px-5',
              'shadow-e1 open:shadow-e2',
              'transition-colors duration-150 ease-out hover:border-border-strong',
            )}
          >
            <summary
              className={cn(
                'flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4',
                'title-m text-ink',
                'marker:content-none [&::-webkit-details-marker]:hidden',
              )}
            >
              {t(`marketing.faq.${key}.q` as 'marketing.faq.one.q')}
              {/*
                ═══ UNE COMMANDE, ET NON UNE FLÈCHE GRISE ═══

                C'était un chevron de 18 px en `text-muted` — la couleur qu'on
                donne aux textes SECONDAIRES. Sur une rangée de cinq questions,
                le seul signe disant « ceci s'ouvre » était donc peint de la
                teinte réservée à ce qui compte le moins, et rien ne le
                distinguait d'une décoration.

                Il devient un rond d'accent plein, comme les pastilles des
                fonctionnalités : la page n'a plus qu'un seul vocabulaire pour
                « voici une chose sur laquelle agir ».

                LE SIGNE EST UN PLUS, ET C'EST UN CHOIX CONTRE LE CHEVRON. Un
                chevron dit une DIRECTION — vers le bas, vers le haut — et il
                faut connaître la convention pour lire « déplier ». Un plus dit
                une QUANTITÉ : il y a autre chose ici. Sa rotation de 45° le
                change en croix, c'est-à-dire en « refermer », sans qu'aucun
                pixel ne soit remplacé : la même forme porte les deux états, et
                le mouvement les relie.

                `shrink-0` ET `size-9` : le rond ne se comprime pas quand une
                question est longue. C'est ce qui l'avait laissé passer sous les
                44 px ailleurs dans ce dépôt — voir le dépliant de la frontière
                d'erreur. Ici la cible est le `<summary>` ENTIER, haut de 56 px ;
                le rond n'est qu'un décor à l'intérieur, d'où `aria-hidden`.
              */}
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  'bg-accent text-on-accent',
                  /* Le rond suit la rangée : il fonce au survol et s'enfonce à
                     l'appui, comme la pastille des fonctionnalités et comme
                     celle de la barre d'onglets. `accent-hover` porte 6,70:1
                     sous du blanc contre 5,17 au repos — le survol AMÉLIORE le
                     contraste, il ne le dégrade pas. `group-active:scale-95`
                     est le seul retour tactile de la rangée : au doigt, le
                     survol n'existe pas, et l'appui doit se voir. */
                  'group-hover:bg-accent-hover group-active:scale-95',
                  // `ease-in-out` : le rond ne fait ni entrée ni sortie, il
                  // PIVOTE sur place. Sans courbe nommée, Tailwind applique la
                  // sienne — `cubic-bezier(0.4, 0, 0.2, 1)`, mesurée dans le
                  // paquet servi — qu'aucun jeton de ce dépôt ne nomme.
                  'transition-transform duration-200 ease-in-out group-open:rotate-45',
                )}
              >
                <Icon name="plus" size={18} />
              </span>
            </summary>
            {/*
              `text-body-l` ET NON `text-body`.

              Le jeton de 16 px porte son usage dans son commentaire — « landing »
              — et celui de 14 s'appelle « corps application ». La réponse d'une
              FAQ est du texte PRINCIPAL sur une page de vitrine : elle se lit
              d'affilée, souvent sur un téléphone, par quelqu'un qui hésite
              encore. Quatorze pixels y sont la taille d'une interface qu'on
              parcourt, pas d'une prose qu'on lit.

              `max-w-[65ch]` : c'est la plus longue mesure de la page, environ
              cent quatre caractères. La section de la vitrine a déjà tranché ce
              point à 60ch après mesure ; on borne le PARAGRAPHE et non le
              `<details>`, dont la question et la flèche doivent rester alignées
              sur la largeur de la carte.
            */}
            <p className="max-w-[65ch] border-t border-divider py-4 text-body-l text-pretty text-muted">
              {t(`marketing.faq.${key}.a` as 'marketing.faq.one.a')}
            </p>
          </details>
        ))}
      </div>
    </Section>
  )
}
