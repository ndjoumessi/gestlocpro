/**
 * LES TAUX DE CHANGE, ET CE QU'ILS PERMETTENT DE DIRE.
 *
 * ═══ POURQUOI ILS EXISTENT ═══
 *
 * Le produit affichait le MÊME nombre dans les quatre devises : 447 000 FCFA,
 * 4 470 €, 4 470 $CA, 4 470 $US. Trois de ces quatre lignes étaient fausses, et
 * la dernière rendue plausible par sa mise en forme — ce qui est pire qu'un
 * ré-étiquetage visible.
 *
 * ═══ DEUX NATURES DE TAUX, ET ELLES NE SE MÉLANGENT PAS ═══
 *
 * Le franc CFA est ARRIMÉ à l'euro par la loi : 1 EUR = 655,957 XAF, et autant
 * de XOF. Ce n'est pas un cours, c'est une constante — elle ne se demande à
 * personne, ne périme pas, et n'a pas de date. La donner par un flux extérieur
 * serait ajouter une panne possible à un nombre qui ne peut pas changer.
 *
 * Le dollar canadien et le dollar américain FLOTTENT. Leur cours vient de la
 * Banque centrale européenne, publiée une fois par jour ouvré, servie ici par
 * Frankfurter — sans clé, sans compte, sans paquet npm : une requête HTTP et
 * trois champs, comme l'envoi de courriel.
 *
 * ═══ CE QUI SE PASSE QUAND LE FLUX TOMBE ═══
 *
 * On ne sert PAS un taux périmé sous couvert de continuité : un montant converti
 * à un cours d'il y a trois semaines porte un symbole qui ment. La réponse porte
 * donc toujours sa DATE, et l'absence de cours flottants se dit — le client
 * retombe alors sur la devise du parc, sans conversion, plutôt que d'afficher un
 * chiffre qu'il ne peut plus justifier.
 *
 * La parité légale, elle, survit à la panne : elle ne dépend d'aucun flux.
 */

/** Les devises que le produit sait tenir. */
export const DEVISES = ['XAF', 'XOF', 'EUR', 'CAD', 'USD'] as const
export type Devise = (typeof DEVISES)[number]

/**
 * LA PARITÉ LÉGALE DU FRANC CFA, fixée par le traité de coopération monétaire.
 *
 * 1 EUR = 655,957 XAF, et la même valeur pour le XOF : deux monnaies distinctes,
 * même parité. Le nombre est exact — il ne s'arrondit pas, ne se rafraîchit pas,
 * et sa dernière révision date du passage à l'euro en 1999.
 */
export const PARITE_FRANC_CFA = 655.957

/** Les cours servis, tous exprimés pour UN euro. */
export interface Taux {
  /** Jour de publication des cours flottants, en ISO. `null` s'ils manquent. */
  date: string | null
  /** Combien d'unités de chaque devise vaut un euro. */
  parEuro: Partial<Record<Devise, number>>
}

/** La source des cours flottants — remplaçable, pour que les cas n'appellent rien. */
export interface SourceDeTaux {
  lire(): Promise<{ date: string; parEuro: Partial<Record<Devise, number>> }>
}

/**
 * La Banque centrale européenne, par Frankfurter.
 *
 * Aucune clé, aucun compte : la BCE publie ses cours de référence chaque jour
 * ouvré, et ce service les redistribue tels quels. Les cours sont déjà exprimés
 * pour un euro, ce qui évite toute inversion — l'endroit où l'on se trompe.
 */
export class SourceBCE implements SourceDeTaux {
  constructor(private readonly adresse = 'https://api.frankfurter.dev/v1/latest') {}

  async lire() {
    const reponse = await fetch(`${this.adresse}?base=EUR&symbols=CAD,USD`, {
      // Un écran ne doit pas attendre un tiers : au-delà, on rend la parité
      // légale seule, ce qui est déjà la moitié utile de la réponse.
      signal: AbortSignal.timeout(4000),
    })
    if (!reponse.ok) throw new Error(`taux indisponibles : ${reponse.status}`)

    const corps = (await reponse.json()) as { date?: unknown; rates?: Record<string, unknown> }
    const date = typeof corps.date === 'string' ? corps.date : null
    if (!date) throw new Error('réponse de taux sans date')

    const parEuro: Partial<Record<Devise, number>> = {}
    for (const devise of ['CAD', 'USD'] as const) {
      const cours = corps.rates?.[devise]
      /* UN COURS EST UN NOMBRE FINI ET POSITIF. Sans ce filtre, un `null` du
         fournisseur deviendrait une division par zéro trois couches plus loin,
         et le montant afficherait « Infinity ». */
      if (typeof cours === 'number' && Number.isFinite(cours) && cours > 0) parEuro[devise] = cours
    }
    if (Object.keys(parEuro).length === 0) throw new Error('réponse de taux sans cours exploitable')

    return { date, parEuro }
  }
}

/**
 * LE CACHE, ET SA DURÉE.
 *
 * La BCE publie une fois par jour ouvré : redemander plus souvent ne rend rien
 * de neuf et fait dépendre chaque chargement d'écran d'un tiers. Une heure est
 * un compromis — assez court pour prendre la publication du jour dans l'heure,
 * assez long pour qu'un parc actif n'interroge la source que vingt fois par
 * jour.
 *
 * UNE PANNE NE VIDE PAS LE CACHE mais ne le prolonge pas non plus : le cours
 * garde sa date, et c'est au client de décider ce qu'il fait d'un cours daté
 * d'hier. Servir un cours en le faisant passer pour celui du jour serait le
 * seul vrai mensonge possible ici.
 */
const DUREE_DU_CACHE_MS = 60 * 60 * 1000

export function creerServiceDeTaux(source: SourceDeTaux, maintenant: () => number = Date.now) {
  let cache: { taux: Taux; expire: number } | null = null

  return {
    async lire(): Promise<Taux> {
      if (cache && cache.expire > maintenant()) return cache.taux

      /* LA PARITÉ LÉGALE EST POSÉE D'ABORD, et elle ne dépend de rien. Même
         flux tombé, un parc de la zone franc voit ses montants en euros. */
      const parEuro: Partial<Record<Devise, number>> = {
        EUR: 1,
        XAF: PARITE_FRANC_CFA,
        XOF: PARITE_FRANC_CFA,
      }

      let date: string | null = null
      try {
        const flottants = await source.lire()
        date = flottants.date
        Object.assign(parEuro, flottants.parEuro)
      } catch {
        /* On ne relance pas et on ne journalise pas ici : l'absence de cours est
           un état NORMAL du service, que la réponse exprime par `date: null` et
           par les devises manquantes. La traiter comme une erreur ferait tomber
           l'écran entier pour un dollar qu'il n'affiche peut-être même pas. */
      }

      const taux: Taux = { date, parEuro }
      /* Un cache court quand les cours manquent : réessayer dans une minute
         plutôt que de priver l'heure entière d'une conversion qui marcherait. */
      cache = { taux, expire: maintenant() + (date ? DUREE_DU_CACHE_MS : 60 * 1000) }
      return taux
    },
  }
}
