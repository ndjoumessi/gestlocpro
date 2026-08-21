import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { Icon } from './Icon'
import { controlClasses } from './Field'

export interface OptionCombobox {
  value: string
  label: string
  /** Intitulé de groupe, affiché au-dessus de la première option du groupe. */
  groupe?: string
}

/**
 * Plafond d'options RENDUES, quel que soit le nombre d'options connues.
 *
 * Deux cent quatre indicatifs montés d'un coup, à l'ouverture, sur le
 * formulaire d'INSCRIPTION : c'est le tout premier geste d'un bailleur de
 * Douala avec le produit, et il le paie sur un Android d'entrée de gamme —
 * autant de nœuds créés, mis en page et peints pour une liste qu'il va réduire
 * à deux entrées en trois frappes.
 *
 * Cinquante, et non dix : la liste haute de `max-h-72` en montre sept d'un
 * coup, donc cinquante laissent sept écrans à parcourir — bien au-delà de ce
 * qu'on parcourt avant de se mettre à taper. Descendre plus bas économiserait
 * des nœuds déjà négligeables et transformerait le bornage en obstacle.
 *
 * Pas de bibliothèque de virtualisation : elle pèserait plus que le problème
 * sur une liste qu'on filtre en trois frappes, et elle démonterait les options
 * hors champ — donc `aria-activedescendant` désignerait un id absent du DOM,
 * exactement la panne que ce fichier prend soin d'éviter.
 */
const MAX_OPTIONS_RENDUES = 50

/**
 * Liste de choix CHERCHABLE, pour les listes trop longues à parcourir.
 *
 * Un `<select>` natif suffit tant que la liste tient sous les yeux. À deux cent
 * cinquante indicatifs, il ne suffit plus : le clavier y saute à la frappe,
 * mais la souris et le tactile obligent à faire défiler. Taper « cam » doit
 * mener au Cameroun.
 *
 * Ce composant refait donc à la main ce que le natif donnait gratuitement —
 * navigation aux flèches, annonce de l'option active, fermeture au clavier. Un
 * combobox à moitié fait sur un champ obligatoire bloquerait la création de
 * compte au clavier ; c'est pourquoi tout est ici, et non « à ajouter plus
 * tard ».
 */
export function Combobox({
  options,
  value,
  onChange,
  id,
  placeholder,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  invalid,
  name,
  autoComplete,
}: {
  options: OptionCombobox[]
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  'aria-label'?: string
  'aria-describedby'?: string
  invalid?: boolean
  name?: string
  /**
   * Jeton de remplissage automatique.
   *
   * Un combobox reste un `<input>` : le navigateur le remplit s'il sait ce
   * qu'il porte. Le perdre en passant du `<select>` au champ cherchable était
   * une régression silencieuse — attrapée par le garde du remplissage, qui a
   * fait exactement son travail.
   */
  autoComplete?: string
}) {
  const t = useT()
  const genere = useId()
  const idChamp = id ?? genere
  const idListe = `${idChamp}-liste`
  const idTroncature = `${idChamp}-troncature`

  const [ouvert, setOuvert] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [actif, setActif] = useState(0)
  const conteneur = useRef<HTMLDivElement>(null)
  const listeRef = useRef<HTMLUListElement>(null)

  const selectionne = options.find((o) => o.value === value)

  const filtrees = useMemo(() => {
    const aiguille = saisie.trim().toLowerCase()
    if (!aiguille) return options
    // Recherche sur le libellé entier : il porte le nom du pays ET l'indicatif,
    // donc « cam » comme « 237 » mènent au Cameroun. Chercher sur le seul nom
    // obligerait à connaître l'orthographe exacte.
    return options.filter((o) => o.label.toLowerCase().includes(aiguille))
  }, [options, saisie])

  /**
   * Les options réellement montées. TOUT le reste du composant s'y réfère.
   *
   * Le filtre s'applique d'abord, le plafond ensuite — jamais l'inverse.
   * Borner les options AVANT de filtrer ferait disparaître de la recherche tout
   * pays classé au-delà du cinquantième : le champ répondrait « rien » à un
   * pays qui existe, ce qui est la panne la plus coûteuse de toutes.
   *
   * L'option CHOISIE remonte en tête quand elle tombe hors de la fenêtre.
   * Ouvrir une liste où son propre choix n'apparaît pas — le champ affiche
   * « Zimbabwe », la liste ne le montre nulle part — laisse croire à une perte
   * du réglage. Deux réponses étaient possibles ; on écarte la fenêtre
   * glissante centrée sur le choix, parce que la tête de liste n'est pas
   * neutre : `dialOptions` y place délibérément la zone franc, le marché servi.
   * Glisser la fenêtre vers le Zimbabwe cacherait le Cameroun, et le bailleur
   * qui change d'indicatif se retrouverait au milieu de l'alphabet sans savoir
   * pourquoi. La remontée, elle, ne coûte qu'une ligne de la fenêtre et place
   * le choix courant là où l'œil est déjà — juste sous le champ qui l'affiche.
   *
   * Le choix ne remonte QUE s'il satisfait le filtre : afficher le Zimbabwe
   * parmi les réponses à « cam » ferait douter du filtre entier. `findIndex`
   * rend -1 quand il ne le trouve pas, ce que le seuil couvre déjà.
   */
  const visibles = useMemo(() => {
    if (filtrees.length <= MAX_OPTIONS_RENDUES) return filtrees
    const fenetre = filtrees.slice(0, MAX_OPTIONS_RENDUES)
    const rang = filtrees.findIndex((o) => o.value === value)
    if (rang < MAX_OPTIONS_RENDUES) return fenetre
    return [filtrees[rang]!, ...fenetre.slice(0, MAX_OPTIONS_RENDUES - 1)]
  }, [filtrees, value])

  const tronquee = visibles.length < filtrees.length

  // L'option active ne doit jamais pointer hors de la liste filtrée : sinon
  // « Entrée » valide un choix qui n'est plus affiché.
  useEffect(() => setActif(0), [saisie])

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [ouvert])

  // L'option active est amenée dans le champ visible : la navigation aux
  // flèches est inutilisable si l'on ne voit pas où l'on est.
  useEffect(() => {
    if (!ouvert) return
    // Appel FACULTATIF : `scrollIntoView` n'existe pas sous jsdom, et une
    // exception ici emporterait tout le rendu du composant. Le défilement est
    // un confort ; le champ doit fonctionner sans lui.
    const actifDom = listeRef.current?.querySelector('[data-actif="true"]')
    ;(actifDom as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' })
  }, [ouvert, actif])

  const choisir = (option: OptionCombobox) => {
    onChange(option.value)
    setSaisie('')
    setOuvert(false)
  }

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!ouvert) {
        setOuvert(true)
        return
      }
      const pas = e.key === 'ArrowDown' ? 1 : -1
      // Bornage plutôt que bouclage : arriver au bout d'une liste de deux cent
      // cinquante entrées et se retrouver au début désoriente plus que cela
      // n'aide.
      //
      // Et bornage sur ce qui est RENDU, pas sur ce qui est filtré : les deux
      // bornes doivent être la même. Parcourir 204 entrées quand 50 sont
      // montées ferait pointer `aria-activedescendant` sur un id absent du DOM
      // — le lecteur d'écran cesserait d'annoncer quoi que ce soit, et le
      // clavier heurterait un mur invisible. Le gain de nœuds ne vaut pas cette
      // panne-là.
      setActif((i) => Math.min(Math.max(i + pas, 0), visibles.length - 1))
      return
    }
    if (e.key === 'Home' || e.key === 'End') {
      if (!ouvert) return
      e.preventDefault()
      setActif(e.key === 'Home' ? 0 : visibles.length - 1)
      return
    }
    if (e.key === 'Enter' && ouvert) {
      const option = visibles[actif]
      if (option) {
        e.preventDefault()
        choisir(option)
      }
      return
    }
    if (e.key === 'Escape' && ouvert) {
      e.preventDefault()
      // Échap appartient à ce qui retient, et la liste ouverte retient — c'est
      // la règle que `Toast` écrit pour justifier de ne PAS l'écouter. Encore
      // faut-il que la touche s'arrête là : `Modal` l'écoute sur `document`,
      // donc un renoncement à la liste des indicatifs refermait aussi le
      // formulaire qui la contient, avec ce qui y était déjà saisi.
      e.stopPropagation()
      setOuvert(false)
      setSaisie('')
    }
  }

  let groupePrecedent: string | undefined

  return (
    <div ref={conteneur} className="relative">
      {/* Le choix voyage aussi dans un champ caché : un formulaire soumis
          nativement, ou un gestionnaire de mots de passe, ne lit pas l'état
          React. */}
      {name && <input type="hidden" name={name} value={value} />}

      <div className="relative">
        <input
          id={idChamp}
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={idListe}
          aria-autocomplete="list"
          aria-activedescendant={ouvert && visibles[actif] ? `${idChamp}-${actif}` : undefined}
          aria-label={ariaLabel}
          // La mention de troncature s'ajoute à la description du champ, sans
          // remplacer celle du consommateur : une liste qui s'arrête au
          // cinquantième élément ne dit rien d'elle-même à qui ne la voit pas.
          aria-describedby={
            [ariaDescribedBy, ouvert && tronquee ? idTroncature : null].filter(Boolean).join(' ') ||
            undefined
          }
          aria-invalid={invalid ? true : undefined}
          autoComplete={autoComplete}
          className={controlClasses(invalid, 'pr-9')}
          // Le libellé du choix courant s'affiche tant qu'on ne cherche pas :
          // un champ vide ferait croire qu'aucun choix n'est fait.
          value={ouvert ? saisie : (selectionne?.label ?? '')}
          placeholder={placeholder}
          onChange={(e) => {
            setSaisie(e.target.value)
            setOuvert(true)
          }}
          onFocus={() => setOuvert(true)}
          onClick={() => setOuvert(true)}
          // Le focus ne suffit pas : après un choix, la liste se referme mais
          // le champ garde le focus. Un second clic ne déclenchait alors aucun
          // `focus` et ne rouvrait rien — le champ paraissait mort dès qu'on
          // voulait corriger son choix, et il fallait taper pour le réveiller.
          onKeyDown={auClavier}
        />
        <Icon
          name="chevronDown"
          size={16}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        />
      </div>

      {ouvert && (
        <ul
          ref={listeRef}
          id={idListe}
          role="listbox"
          // Le `relative` du conteneur ne crée aucun contexte d'empilement : la
          // liste concourt donc à la racine, et son altitude est une affaire de
          // produit, pas de composant. `--z-dropdown` est déjà celle du menu de
          // devise, qui est la même chose sous un autre nom.
          style={{ zIndex: 'var(--z-dropdown)' }}
          className="absolute mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {visibles.length === 0 && (
            // Une liste vide sans un mot laisse croire à une panne.
            <li role="presentation" className="px-3 py-2 text-body-s text-muted">
              —
            </li>
          )}
          {/*
            L'option EST le `<li>`, et tout le reste est décor déclaré comme tel.
            Un `listbox` ne reconnaît que des `option` parmi ses descendants ;
            l'option vivait ici dans un `<div>` enveloppé d'un `<li>` nu, laissé
            signifiant. Le lecteur d'écran comptait donc des éléments de liste
            là où il attendait des options et cessait d'annoncer « 2 sur 4 ».
            Le fragment porte la clé pour que l'intitulé de groupe reste un
            frère de l'option plutôt qu'un enfant — un `option` ne contient que
            son propre libellé.
          */}
          {visibles.map((option, index) => {
            const nouveauGroupe = option.groupe && option.groupe !== groupePrecedent
            groupePrecedent = option.groupe
            return (
              <Fragment key={option.value}>
                {nouveauGroupe && (
                  <li
                    role="presentation"
                    className="eyebrow px-3 pt-2 pb-1 text-muted"
                    aria-hidden="true"
                  >
                    {option.groupe}
                  </li>
                )}
                <li
                  id={`${idChamp}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-actif={index === actif}
                  // `onMouseDown` et non `onClick` : le clic ferait d'abord
                  // perdre le focus au champ, ce qui referme la liste avant que
                  // la sélection n'ait lieu.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choisir(option)
                  }}
                  onMouseEnter={() => setActif(index)}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-body',
                    index === actif ? 'bg-surface-sunken text-ink' : 'text-ink',
                  )}
                >
                  {option.label}
                </li>
              </Fragment>
            )
          })}
          {tronquee && (
            /* En PIED de liste, et non en tête : la question « pourquoi ça
               s'arrête ? » se pose au moment où l'on arrive au bout sans avoir
               trouvé son pays, et c'est là que la réponse doit se trouver. En
               tête, elle repousserait les options sans répondre à personne.
               Une liste coupée en silence, elle, laisse conclure que le pays
               n'existe pas. */
            <li
              id={idTroncature}
              // Décor, pas option : la mention n'est pas un choix possible, et
              // la laisser signifiante fausserait le décompte annoncé.
              // Le texte reste lisible par `aria-describedby`, qui compose la
              // description à partir du contenu et non du rôle.
              role="presentation"
              className="border-t border-border px-3 py-2 text-body-s text-muted"
            >
              {t('common.listTruncated')}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
