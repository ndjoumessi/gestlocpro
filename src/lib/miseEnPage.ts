import { PAGE, couper, largeurDuTexte, type Commande } from './pdf'

/**
 * LA MISE EN PAGE D'UN DOCUMENT, séparée du format qui l'écrit.
 *
 * `pdf.ts` sait poser du texte à une coordonnée ; il ne sait pas ce qu'est un
 * titre, une paire libellé/montant, ni quand passer à la page suivante. Les
 * mélanger aurait donné un module où l'on ne peut plus corriger une chasse sans
 * relire une facture — et l'inverse.
 *
 * Ce module tient un CURSEUR qui descend, et rien d'autre. Il ne connaît ni les
 * quittances, ni les cautions : ce sont trois documents qui l'appellent, et ils
 * vivent auprès des données qu'ils décrivent.
 */

/** Les tailles du document, en points. Une échelle courte, comme à l'écran. */
export const CORPS = 10
const TITRE = 18
const SOUS_TITRE = 12
const PETIT = 8

/** L'interligne : la taille et un peu moins de la moitié, comme le texte de l'écran. */
const INTERLIGNE = 1.45

/** Là où le contenu s'arrête, en laissant la place du pied de page. */
const BAS = PAGE.hauteur - PAGE.marge - 24

/** La largeur utile entre les deux marges. */
export const COLONNE = PAGE.largeur - 2 * PAGE.marge

/** Le bord droit, où finissent les montants. */
const DROITE = PAGE.largeur - PAGE.marge

/** L'écart minimal entre un intitulé et sa valeur avant que la paire se replie. */
const GOUTTIERE = 16

export interface MiseEnPage {
  /** Le titre du document, une seule fois, en tête de la première page. */
  titre(contenu: string, surtitre?: string): void
  /** Un intertitre de section. */
  section(contenu: string): void
  /** Une ligne de texte simple. */
  ligne(contenu: string, options?: { gras?: boolean; petit?: boolean }): void
  /** Un libellé à gauche, une valeur alignée à droite. */
  paire(libelle: string, valeur: string, options?: { gras?: boolean }): void
  /** Un paragraphe, coupé à la largeur de la colonne. */
  paragraphe(contenu: string, options?: { petit?: boolean; retrait?: number }): void
  /** Un filet horizontal sur toute la colonne. */
  filet(): void
  /** Un blanc vertical. */
  saut(hauteur?: number): void
  /** Ouvre une page neuve, quoi qu'il reste de place. */
  pageNeuve(): void
  /**
   * Rend les pages, en posant le pied de page sur chacune.
   *
   * Le pied est posé À LA FIN et non au fil de l'eau : on ne sait combien de
   * pages il y aura qu'une fois le contenu écrit, et « page 1 sur 3 » est
   * précisément ce qui distingue un document complet d'un document dont il
   * manque la suite.
   */
  pages(pied: (page: number, total: number) => string): Commande[][]
}

export function nouvelleMiseEnPage(): MiseEnPage {
  const pages: Commande[][] = [[]]
  let y = PAGE.marge

  const courante = () => pages[pages.length - 1]

  /** Réserve la hauteur demandée, en changeant de page si elle ne tient pas. */
  const placer = (hauteur: number): number => {
    if (y + hauteur > BAS && courante().length > 0) {
      pages.push([])
      y = PAGE.marge
    }
    const depart = y
    y += hauteur
    return depart
  }

  const poser = (
    contenu: string,
    taille: number,
    gras: boolean,
    options: { x?: number; aDroite?: boolean; hauteur?: number } = {},
  ) => {
    const hauteur = options.hauteur ?? taille * INTERLIGNE
    const depart = placer(hauteur)
    courante().push({
      sorte: 'texte',
      x: options.x ?? PAGE.marge,
      // La ligne de base est au bas de la boîte de ligne, moins la descendante.
      y: depart + taille,
      taille,
      gras,
      contenu,
      aDroite: options.aDroite,
    })
    return depart
  }

  return {
    titre(contenu, surtitre) {
      if (surtitre) poser(surtitre, PETIT, false)
      poser(contenu, TITRE, true)
      this.saut(6)
    },

    section(contenu) {
      this.saut(10)
      poser(contenu, SOUS_TITRE, true)
      this.saut(2)
    },

    ligne(contenu, options = {}) {
      poser(contenu, options.petit ? PETIT : CORPS, options.gras ?? false)
    },

    paire(libelle, valeur, options = {}) {
      const gras = options.gras ?? false
      const largeurLibelle = largeurDuTexte(libelle, CORPS, gras)
      const largeurValeur = largeurDuTexte(valeur, CORPS, gras)

      /*
        ═══ LA PAIRE SE REPLIE, ET LA PORTE A EXIGÉ QU'ELLE LE SACHE ═══

        Les deux moitiés partagent une ligne tant qu'elles y tiennent, gouttière
        comprise. C'est pour cela qu'elles sont posées ENSEMBLE : écrites l'une
        après l'autre, le curseur descendrait entre les deux et la valeur
        tomberait sous son libellé.

        Au-delà, la valeur passe à la ligne suivante, toujours calée à droite.
        Sans ce repli, une valeur trop longue — alignée à droite, donc composée
        de la droite vers la gauche — partait sous son propre intitulé puis
        SORTAIT de la feuille par la gauche. Le fichier restait valide, le texte
        restait présent, et le document devenait illisible.

        Ce n'est pas une hypothèse : rien ne borne le nom d'un locataire, ni au
        serveur ni à la fiche, et `documentDansLaPage` mesure le débordement sur
        un nom d'usage composé. C'est aussi la raison pour laquelle la valeur
        seule est COUPÉE si elle dépasse encore : à ce point, il n'y a plus de
        repli possible, seulement une césure ou un débordement.
      */
      const surUneLigne = largeurLibelle + GOUTTIERE + largeurValeur <= COLONNE
      if (surUneLigne) {
        const depart = placer(CORPS * INTERLIGNE)
        courante().push(
          { sorte: 'texte', x: PAGE.marge, y: depart + CORPS, taille: CORPS, gras, contenu: libelle },
          {
            sorte: 'texte',
            x: DROITE,
            y: depart + CORPS,
            taille: CORPS,
            gras,
            contenu: valeur,
            aDroite: true,
          },
        )
        return
      }

      poser(libelle, CORPS, gras)
      for (const ligne of couper(valeur, COLONNE, CORPS, gras))
        poser(ligne, CORPS, gras, { x: DROITE, aDroite: true })
    },

    paragraphe(contenu, options = {}) {
      const taille = options.petit ? PETIT : CORPS
      const retrait = options.retrait ?? 0
      for (const ligne of couper(contenu, COLONNE - retrait, taille))
        poser(ligne, taille, false, { x: PAGE.marge + retrait })
    },

    filet() {
      const depart = placer(6)
      courante().push({
        sorte: 'filet',
        x: PAGE.marge,
        y: depart + 3,
        largeur: COLONNE,
        epaisseur: 0.6,
        gris: 0.75,
      })
    },

    saut(hauteur = CORPS) {
      y += hauteur
    },

    pageNeuve() {
      if (courante().length === 0) return
      pages.push([])
      y = PAGE.marge
    },

    pages(pied) {
      return pages.map((commandes, index) => {
        const texte = pied(index + 1, pages.length)
        return [
          ...commandes,
          {
            sorte: 'filet',
            x: PAGE.marge,
            y: PAGE.hauteur - PAGE.marge - 14,
            largeur: COLONNE,
            epaisseur: 0.6,
            gris: 0.85,
          },
          {
            sorte: 'texte',
            x: PAGE.marge,
            y: PAGE.hauteur - PAGE.marge,
            taille: PETIT,
            gras: false,
            contenu: texte,
          },
        ] satisfies Commande[]
      })
    },
  }
}

/** La largeur d'un texte à la taille du corps — pour caler une colonne. */
export function largeurAuCorps(contenu: string, gras = false): number {
  return largeurDuTexte(contenu, CORPS, gras)
}
