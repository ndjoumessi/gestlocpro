import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { controlClasses } from './Field'
import { Select } from './Input'
import { Icon } from './Icon'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'

/**
 * Sélecteur de date.
 *
 * Remplace `<input type="date">`, qu'aucune feuille de style n'atteint : le
 * calendrier est dessiné par le navigateur, dans SES couleurs et SA police. Sur
 * l'écran de création de fiche locataire, une pastille bleue système et deux
 * liens bleus s'ouvraient au milieu d'une interface qui n'a pas une seule autre
 * surface bleue. Ce n'est pas un détail de goût : c'est le seul endroit du
 * produit où l'utilisateur voit qu'il est dans un navigateur.
 *
 * Le contrat de valeur ne change PAS — `AAAA-MM-JJ`, la forme que le champ natif
 * rendait et que les deux appelants transmettent au serveur. Un composant qui
 * changerait de format obligerait à toucher aux deux modales et au contrat
 * d'API pour un problème d'apparence.
 *
 * **La saisie au clavier n'est pas la frappe libre, et c'est délibéré.** Un
 * champ texte accepterait « 17/08/2026 » en français et « 08/17/2026 » en
 * anglais, avec les séparateurs, les années à deux chiffres et les mois hors
 * bornes à arbitrer — de l'analyse de date sensible au pays, pour un produit qui
 * sert déjà quatre étiquettes BCP-47. Le calendrier se parcourt donc
 * entièrement au clavier (flèches, page précédente/suivante, début et fin de
 * semaine, entrée, échappement) et deux raccourcis couvrent les cas courants :
 * aujourd'hui, et effacer. Personne n'est enfermé ; c'est la frappe libre, et
 * elle seule, qui est écartée.
 */

export interface DatePickerProps {
  id?: string
  name?: string
  /** `AAAA-MM-JJ`, ou chaîne vide quand aucune date n'est choisie. */
  value: string
  onChange: (valeur: string) => void
  'aria-describedby'?: string
  invalid?: boolean
  required?: boolean
  /** Décrit le champ quand aucune étiquette visible ne le fait. */
  'aria-label'?: string
}

interface Jour {
  annee: number
  mois: number
  jour: number
}

/** `AAAA-MM-JJ` → parties, ou `null` si la chaîne n'est pas une date complète. */
function enJour(valeur: string): Jour | null {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur)
  if (!t) return null
  const annee = Number(t[1])
  const mois = Number(t[2]) - 1
  const jour = Number(t[3])
  // `2026-02-31` passe la forme mais n'existe pas : on ne l'accepte que si le
  // calendrier le confirme, sinon le curseur s'ouvrirait sur un jour fantôme.
  const d = new Date(annee, mois, jour)
  if (d.getFullYear() !== annee || d.getMonth() !== mois || d.getDate() !== jour) return null
  return { annee, mois, jour }
}

function enValeur({ annee, mois, jour }: Jour): string {
  return `${annee}-${String(mois + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

/**
 * Vers la forme qu'attendent les formateurs partagés.
 *
 * Ce fichier nomme ses champs en français comme le reste du code ; `useDates`
 * parle `DateParts`, dont les noms viennent du modèle de données. On traduit
 * ici, en un seul endroit, plutôt que d'aligner l'un des deux sur l'autre — le
 * modèle ne se renomme pas pour un composant, et un composant ne bascule pas en
 * anglais pour un formateur.
 */
function enParts({ annee, mois, jour }: Jour) {
  return { year: annee, month: mois, day: jour }
}

function memeJour(a: Jour | null, b: Jour | null): boolean {
  return !!a && !!b && a.annee === b.annee && a.mois === b.mois && a.jour === b.jour
}

function decaler(j: Jour, jours: number): Jour {
  const d = new Date(j.annee, j.mois, j.jour + jours)
  return { annee: d.getFullYear(), mois: d.getMonth(), jour: d.getDate() }
}

/** Même quantième au mois voisin, ramené au dernier jour quand il n'existe pas. */
function decalerMois(j: Jour, mois: number): Jour {
  const cible = new Date(j.annee, j.mois + mois, 1)
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate()
  return {
    annee: cible.getFullYear(),
    mois: cible.getMonth(),
    jour: Math.min(j.jour, dernier),
  }
}

/**
 * Premier jour de la semaine, selon le PAYS et non selon la langue.
 *
 * Lundi au Cameroun comme en France, dimanche aux États-Unis. `weekInfo` le dit
 * quand le moteur l'expose ; ailleurs on retombe sur lundi, qui est l'usage du
 * marché servi — se tromper de repli du bon côté vaut mieux que de figer une
 * grille américaine pour des utilisateurs qui commencent la semaine le lundi.
 */
function premierJourSemaine(tag: string): number {
  try {
    const info = (new Intl.Locale(tag) as unknown as { weekInfo?: { firstDay?: number } }).weekInfo
    // `weekInfo.firstDay` compte de 1 (lundi) à 7 (dimanche) ; `Date.getDay()`
    // de 0 (dimanche) à 6. Le 7 doit donc revenir à 0, sans quoi la grille
    // décale d'une colonne une semaine sur deux.
    if (info?.firstDay) return info.firstDay % 7
  } catch {
    // Étiquette refusée par le moteur : le repli suffit.
  }
  return 1
}

export function DatePicker({
  id,
  name,
  value,
  onChange,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  invalid,
  required,
}: DatePickerProps) {
  const t = useT()
  const d = useDates()

  const choisi = enJour(value)
  const aujourdHui = useMemo(() => {
    const n = new Date()
    return { annee: n.getFullYear(), mois: n.getMonth(), jour: n.getDate() }
  }, [])

  const [ouvert, setOuvert] = useState(false)
  /**
   * Le jour qui porte le focus dans la grille, distinct du jour CHOISI.
   *
   * Les deux se confondent tant qu'on ne se déplace pas ; les séparer est ce
   * qui permet de parcourir le calendrier aux flèches sans rien sélectionner,
   * comme un menu qu'on survole avant de cliquer. Une grille qui choisirait à
   * chaque flèche enverrait dix valeurs au formulaire pour un seul geste.
   */
  const [curseur, setCurseur] = useState<Jour>(choisi ?? aujourdHui)
  /**
   * Coin haut-gauche du panneau, en coordonnées de FENÊTRE.
   *
   * Il mesure environ 410px et sortait par le bas dès qu'il s'ouvrait sur le
   * dernier champ d'une modale, ou sur un téléphone dont la fenêtre utile est
   * réduite par le clavier : les six semaines passaient, la rangée
   * « aujourd'hui » et « effacer » était coupée. Un panneau qui déborde ne se
   * remarque pas — on conclut que l'action n'existe pas.
   */
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const racine = useRef<HTMLDivElement>(null)
  const declencheur = useRef<HTMLButtonElement>(null)
  const grille = useRef<HTMLDivElement>(null)
  /** Le panneau vit sur `document.body` : il faut le désigner à part. */
  const panneau = useRef<HTMLDivElement>(null)

  const debutSemaine = premierJourSemaine(d.tag)

  /** Les sept en-têtes, dans l'ordre du pays. */
  const nomsJours = useMemo(() => {
    const f = new Intl.DateTimeFormat(d.tag, { weekday: 'short' })
    // Une semaine de référence dont on connaît les jours : le 4 janvier 1970
    // est un dimanche, ce qui donne un point de départ sûr pour tourner.
    return Array.from({ length: 7 }, (_, i) =>
      f.format(new Date(1970, 0, 4 + ((debutSemaine + i) % 7))),
    )
  }, [d.tag, debutSemaine])

  /**
   * Le libellé d'une CELLULE, en toutes lettres.
   *
   * `useDates().fullDate` rend « 01/04/2023 », qui convient au champ replié —
   * compact, et c'est la forme que le produit affiche partout ailleurs. Dans la
   * grille, elle donne « zéro un slash zéro quatre slash deux mille vingt-trois »
   * à la synthèse vocale, quarante-deux fois par mois. Un jour se nomme
   * « 1 avril 2023 ».
   */
  const libelleJour = useMemo(() => {
    const f = new Intl.DateTimeFormat(d.tag, { day: 'numeric', month: 'long', year: 'numeric' })
    return (j: Jour) => f.format(new Date(j.annee, j.mois, j.jour))
  }, [d.tag])

  const nomsMois = useMemo(() => {
    const f = new Intl.DateTimeFormat(d.tag, { month: 'long' })
    return Array.from({ length: 12 }, (_, m) => f.format(new Date(2026, m, 1)))
  }, [d.tag])

  /**
   * Trente ans en arrière, dix en avant.
   *
   * Les deux champs servis sont un début de bail et une date de versement : le
   * passé porte l'essentiel, l'avenir n'a besoin que de la marge d'un bail qui
   * commence plus tard. Une liste centrée sur l'année courante, et non figée
   * sur une borne écrite en dur, pour qu'elle ne se périme pas.
   */
  const annees = useMemo(() => {
    const courante = aujourdHui.annee
    return Array.from({ length: 41 }, (_, i) => courante - 30 + i)
  }, [aujourdHui.annee])

  /** Les six semaines affichées, jours voisins compris. */
  const semaines = useMemo(() => {
    const premier = new Date(curseur.annee, curseur.mois, 1)
    const decalage = (premier.getDay() - debutSemaine + 7) % 7
    const depart = new Date(curseur.annee, curseur.mois, 1 - decalage)
    return Array.from({ length: 6 }, (_, s) =>
      Array.from({ length: 7 }, (_, j) => {
        const date = new Date(depart.getFullYear(), depart.getMonth(), depart.getDate() + s * 7 + j)
        return {
          annee: date.getFullYear(),
          mois: date.getMonth(),
          jour: date.getDate(),
        }
      }),
    )
  }, [curseur.annee, curseur.mois, debutSemaine])

  /**
   * Place le panneau dans la FENÊTRE, hors du flux de ses ancêtres.
   *
   * Posé en absolu, il était rogné deux fois : par le bas de la fenêtre, puis —
   * une fois basculé vers le haut — par le corps de la modale, qui défile et
   * découpe ce qui en sort. Un panneau ancré à un champ ne peut pas vivre dans
   * un conteneur qui coupe ; il est donc porté sur `document.body` en position
   * fixe, et calé à la main sur le champ.
   *
   * Six semaines, un en-tête et une rangée d'actions font une hauteur stable :
   * on décide du côté AVANT de rendre. Mesurer après coup ferait sauter le
   * panneau sous l'œil, ce qui est pire qu'un débordement — le contenu bouge
   * pendant qu'on vise.
   */
  const placer = () => {
    const cadre = declencheur.current?.getBoundingClientRect()
    if (!cadre) return
    const HAUTEUR = 430
    const LARGEUR = 360
    const MARGE = 8
    const dessous = window.innerHeight - cadre.bottom
    // On ne bascule que si le haut offre RÉELLEMENT mieux : sur un écran plus
    // court que le panneau, remonter ne ferait que déborder par l'autre bord.
    const enHaut = dessous < HAUTEUR && cadre.top > dessous
    const souhaite = enHaut ? cadre.top - HAUTEUR - 4 : cadre.bottom + 4

    /**
     * Basculer ne suffit pas, et c'est ce que le 375px a montré : un panneau de
     * 430px ne tient ni au-dessus ni au-dessous d'un champ placé au milieu d'un
     * téléphone. On borne donc, en plus de choisir le côté — le panneau se cale
     * aussi haut que nécessaire plutôt que de sortir par un bord. Sur les
     * fenêtres plus courtes que lui, la borne basse l'emporte et il commence à
     * la marge : mieux vaut voir le début du calendrier que sa fin.
     */
    setPosition({
      top: Math.max(MARGE, Math.min(souhaite, window.innerHeight - HAUTEUR - MARGE)),
      // Calé à gauche du champ, ramené dans la fenêtre quand le champ est
      // lui-même contre le bord droit — le cas des colonnes étroites.
      left: Math.max(MARGE, Math.min(cadre.left, window.innerWidth - LARGEUR - MARGE)),
    })
  }

  const fermer = (rendreLeFocus = true) => {
    setOuvert(false)
    if (rendreLeFocus) declencheur.current?.focus()
  }

  const choisir = (j: Jour) => {
    onChange(enValeur(j))
    setCurseur(j)
    fermer()
  }

  // Le focus suit le curseur tant que la grille est ouverte : sans cela les
  // flèches déplaceraient une surbrillance que le lecteur d'écran n'annonce
  // pas, et le clavier avancerait à l'aveugle.
  useEffect(() => {
    if (!ouvert) return
    const cellule = grille.current?.querySelector<HTMLElement>('[data-curseur="true"]')
    cellule?.focus()
  }, [ouvert, curseur])

  // Un clic au-dehors referme, sans rendre le focus : l'utilisateur est déjà
  // parti ailleurs, le lui reprendre le ramènerait en arrière.
  useEffect(() => {
    if (!ouvert) return
    const auClic = (e: MouseEvent) => {
      const cible = e.target as Node
      // Les DEUX arbres, depuis que le panneau est porté ailleurs : sans le
      // second, cliquer une flèche de mois refermait le calendrier, puisque le
      // clic tombait « au-dehors » du champ.
      if (racine.current?.contains(cible) || panneau.current?.contains(cible)) return
      setOuvert(false)
    }
    // Repositionné plutôt que refermé : la modale défile sous le panneau, et
    // un calendrier qui se ferme au moindre glissement est inutilisable au
    // doigt. `true` pour capter aussi les conteneurs qui défilent en interne,
    // dont le corps de la modale.
    const auDefilement = () => placer()
    document.addEventListener('mousedown', auClic)
    window.addEventListener('scroll', auDefilement, true)
    window.addEventListener('resize', auDefilement)
    return () => {
      document.removeEventListener('mousedown', auClic)
      window.removeEventListener('scroll', auDefilement, true)
      window.removeEventListener('resize', auDefilement)
    }
  }, [ouvert])

  const auClavier = (e: React.KeyboardEvent) => {
    const touches: Record<string, () => Jour> = {
      ArrowLeft: () => decaler(curseur, -1),
      ArrowRight: () => decaler(curseur, 1),
      ArrowUp: () => decaler(curseur, -7),
      ArrowDown: () => decaler(curseur, 7),
      Home: () => decaler(curseur, -(((new Date(curseur.annee, curseur.mois, curseur.jour).getDay() - debutSemaine + 7) % 7))),
      End: () => decaler(curseur, 6 - (((new Date(curseur.annee, curseur.mois, curseur.jour).getDay() - debutSemaine + 7) % 7))),
      PageUp: () => decalerMois(curseur, -1),
      PageDown: () => decalerMois(curseur, 1),
    }

    const suivant = touches[e.key]
    if (suivant) {
      e.preventDefault()
      setCurseur(suivant())
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choisir(curseur)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      fermer()
    }
  }

  return (
    <div ref={racine} className="relative">
      {/* L'entrée cachée porte la valeur machine : le composant reste un champ
          de formulaire pour tout ce qui lit le DOM, comme le faisait le champ
          natif qu'il remplace. */}
      <input type="hidden" name={name} value={value} />

      <button
        ref={declencheur}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        onClick={() => {
          setCurseur(choisi ?? aujourdHui)
          placer()
          setOuvert((o) => !o)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !ouvert) {
            e.preventDefault()
            setCurseur(choisi ?? aujourdHui)
            setOuvert(true)
          }
        }}
        className={controlClasses(invalid, 'flex cursor-pointer items-center justify-between text-left')}
      >
        {/* Le gris du gabarit et non l'encre : une date absente ne doit pas se
            lire avec le poids d'une date choisie. */}
        <span className={cn(!choisi && 'text-muted')}>
          {choisi ? d.fullDate(enParts(choisi)) : t('common.datePlaceholder')}
        </span>
        <Icon name="calendar" size={16} className="shrink-0 text-muted" />
      </button>

      {ouvert &&
        position &&
        createPortal(
          <div
            role="dialog"
            aria-label={t('common.dateCalendar')}
            ref={panneau}
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 w-max max-w-[calc(100vw-1rem)] rounded-lg border border-divider bg-surface p-3 shadow-e3"
          >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={t('common.datePrevMonth')}
              onClick={() => setCurseur(decalerMois(curseur, -1))}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-ink"
            >
              <Icon name="chevronLeft" size={16} />
            </button>

            {/* Mois et année se CHOISISSENT, ils ne se feuillettent pas.
                « Début du bail » se compte souvent en années : atteindre avril
                2023 depuis aujourd'hui demanderait une quarantaine de clics sur
                la flèche, ce qui revient à ne pas offrir le champ. Les flèches
                restent pour le voisinage immédiat, où elles sont plus rapides
                qu'un menu. */}
            <div className="flex items-center gap-1.5">
              <Select
                aria-label={t('common.dateMonth')}
                value={curseur.mois}
                onChange={(e) => setCurseur({ ...curseur, mois: Number(e.target.value) })}
                className="h-11 w-auto py-0 pr-8 pl-2 text-body"
              >
                {nomsMois.map((nom, index) => (
                  <option key={nom} value={index}>
                    {nom}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t('common.dateYear')}
                value={curseur.annee}
                onChange={(e) => setCurseur({ ...curseur, annee: Number(e.target.value) })}
                className="numeric h-11 w-auto py-0 pr-8 pl-2 text-body"
              >
                {annees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>

            <button
              type="button"
              aria-label={t('common.dateNextMonth')}
              onClick={() => setCurseur(decalerMois(curseur, 1))}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-ink"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>

          <div ref={grille} role="grid" onKeyDown={auClavier}>
            <div role="row" className="grid grid-cols-7">
              {nomsJours.map((nom) => (
                <div
                  key={nom}
                  role="columnheader"
                  aria-label={nom}
                  className="pb-1 text-center text-body-s text-muted"
                >
                  {nom}
                </div>
              ))}
            </div>

            {semaines.map((semaine, s) => (
              <div role="row" key={s} className="grid grid-cols-7">
                {semaine.map((j) => {
                  const horsMois = j.mois !== curseur.mois
                  const estChoisi = memeJour(j, choisi)
                  const estAujourdHui = memeJour(j, aujourdHui)
                  const porteLeCurseur = memeJour(j, curseur)
                  return (
                    <div role="gridcell" key={enValeur(j)} aria-selected={estChoisi}>
                      <button
                        type="button"
                        // Un seul jour est atteignable à la tabulation : on
                        // entre dans la grille, on s'y déplace aux flèches, et
                        // la tabulation suivante en sort. Sans cela il faudrait
                        // quarante-deux tabulations pour traverser un mois.
                        tabIndex={porteLeCurseur ? 0 : -1}
                        data-curseur={porteLeCurseur}
                        aria-current={estAujourdHui ? 'date' : undefined}
                        aria-label={libelleJour(j)}
                        onClick={() => choisir(j)}
                        className={cn(
                          'flex size-11 cursor-pointer items-center justify-center rounded-md text-body',
                          'transition-colors duration-150',
                          horsMois && !estChoisi && 'text-muted-soft',
                          !estChoisi && 'hover:bg-surface-sunken',
                          estChoisi && 'bg-ink text-on-dark font-medium',
                          // Aujourd'hui se marque par un cerne, jamais par la
                          // seule couleur : le jour choisi porte déjà un fond
                          // plein, et deux aplats voisins ne se distingueraient
                          // pas en niveaux de gris.
                          estAujourdHui && !estChoisi && 'ring-1 ring-gold-border',
                        )}
                      >
                        {j.jour}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-divider pt-2">
            <button
              type="button"
              onClick={() => choisir(aujourdHui)}
              className="min-h-11 cursor-pointer rounded-md px-2 text-label font-semibold text-gold-ink hover:text-gold-ink-hover"
            >
              {t('common.dateToday')}
            </button>
            {/* N'apparaît que s'il y a quelque chose à effacer : un bouton
                inerte sur un champ vide occupe une cible tactile pour rien. */}
            {choisi && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  fermer()
                }}
                className="min-h-11 cursor-pointer rounded-md px-2 text-label font-semibold text-muted hover:text-ink"
              >
                {t('common.dateClear')}
              </button>
            )}
          </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
