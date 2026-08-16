import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { controlClasses } from './Field'

export interface OptionCombobox {
  value: string
  label: string
  /** Intitulé de groupe, affiché au-dessus de la première option du groupe. */
  groupe?: string
}

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
  const genere = useId()
  const idChamp = id ?? genere
  const idListe = `${idChamp}-liste`

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
      setActif((i) => Math.min(Math.max(i + pas, 0), filtrees.length - 1))
      return
    }
    if (e.key === 'Home' || e.key === 'End') {
      if (!ouvert) return
      e.preventDefault()
      setActif(e.key === 'Home' ? 0 : filtrees.length - 1)
      return
    }
    if (e.key === 'Enter' && ouvert) {
      const option = filtrees[actif]
      if (option) {
        e.preventDefault()
        choisir(option)
      }
      return
    }
    if (e.key === 'Escape' && ouvert) {
      e.preventDefault()
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
          aria-activedescendant={ouvert && filtrees[actif] ? `${idChamp}-${actif}` : undefined}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
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
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {filtrees.length === 0 && (
            // Une liste vide sans un mot laisse croire à une panne.
            <li className="px-3 py-2 text-body-s text-muted">—</li>
          )}
          {filtrees.map((option, index) => {
            const nouveauGroupe = option.groupe && option.groupe !== groupePrecedent
            groupePrecedent = option.groupe
            return (
              <li key={option.value}>
                {nouveauGroupe && (
                  <p className="eyebrow px-3 pt-2 pb-1 text-muted" aria-hidden="true">
                    {option.groupe}
                  </p>
                )}
                <div
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
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
