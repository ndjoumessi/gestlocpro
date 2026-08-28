import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import { captureDownloads } from '@/test/downloads'
import { PAGE, largeurDuTexte } from '@/lib/pdf'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * RIEN NE MESURAIT LA MISE EN PAGE DES DOCUMENTS, et c'était la réserve écrite
 * au lot qui les a introduits.
 *
 * ═══ CE QUE LES AUTRES GARDES NE VOIENT PAS ═══
 *
 * `pdf.test.ts` relit la table de références croisées : elle dit que le fichier
 * s'ouvre. `exports.test.tsx` cherche des chaînes : il dit que le contenu est
 * là. Aucun des deux ne dit OÙ le contenu se trouve — un nom de locataire de
 * cent caractères, aligné à droite, part vers la gauche, passe sous son propre
 * intitulé, puis sort de la feuille. Le fichier reste valide, le texte reste
 * présent, et le document est illisible.
 *
 * `mesure-ui` ne peut rien ici : elle mesure des pages web dans un navigateur.
 * Un PDF n'est pas rendu par le produit — il est rendu par le lecteur de qui le
 * reçoit, et on ne le verra jamais.
 *
 * ═══ COMMENT ON MESURE SANS LECTEUR ═══
 *
 * Le format range chaque texte comme une position et une chaîne :
 * `BT /F1 10 Tf 48 781 Td (Ao\xFBt 2026) Tj ET`. On relit ces triplets dans les
 * octets du fichier téléchargé, et l'on redemande à `largeurDuTexte` la place
 * que chacun occupe. Ce qui est mesuré est donc bien le FICHIER, et non une
 * fonction interne appelée à part.
 *
 * LA CIRCULARITÉ EST RÉELLE ET BORNÉE : la largeur employée ici est celle que
 * l'émetteur a employée pour composer. Cette règle ne peut donc pas dire qu'une
 * chasse est fausse — c'est le travail de `chassesHelvetica`. Elle dit qu'à
 * chasses données, la composition tient dans la page.
 */

const PARC = '11111111-2222-4333-8444-555555555555'
const UNITE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

/**
 * UN LOCATAIRE AU NOM LONG, ET CE N'EST PAS UNE CURIOSITÉ.
 *
 * Le marché visé compose des noms d'usage à rallonge, et rien dans le produit
 * ne borne `fullName` — ni le serveur, ni la fiche. Le jeu de démonstration,
 * lui, ne porte que « Charles Ngassa » : quatorze caractères, qui tiennent
 * partout et ne prouvent rien.
 *
 * CELUI-CI VA AU-DELÀ DU PLAUSIBLE, délibérément. À soixante-dix caractères la
 * paire tenait encore sur sa ligne, et la règle passait au vert sans avoir rien
 * éprouvé ; c'est à cent quarante qu'elle a rougi et fait écrire le repli. Un
 * jeu d'essai qui s'arrête au vraisemblable ne mesure que la marge qu'on a déjà.
 * Le cas court, lui, est couvert par tous les autres documents, qui tournent sur
 * la démonstration.
 */
const NOM_LONG = 'Marie-Joséphine Ngassa Mbarga Fotso Bonaventure Épouse Nkoulou Atangana Ndjoumessi Tchoumi Kamdem Ngo Bassong Etoundi Mvondo Onana Belinga'
const IMMEUBLE_LONG = 'Résidence des Palmiers de Bonamoussadi — Bloc C, Entrée Nord'

function sessionLocataire(): EtatSession {
  return {
    statut: 'connecte',
    compte: { ...COMPTE_FICTIF, fullName: NOM_LONG },
    adhesions: [
      { parkId: PARC, role: 'tenant', parkName: 'Parc de test', currency: 'XAF' },
    ],
  }
}

const PORTEFEUILLE = {
  collections: [],
  buildings: [
    {
      id: 'imm-1',
      name: IMMEUBLE_LONG,
      district: 'Bonamoussadi',
      units: [
        {
          id: UNITE,
          label: 'B7',
          type: 'T2',
          surfaceSqm: 52,
          rentMinor: 90000,
          tenant: { id: COMPTE_FICTIF.id, fullName: NOM_LONG, phoneE164: null },
          status: 'paid',
          leaseId: 'bail-1',
          leaseStartsOn: '2026-06-01T00:00:00.000Z',
          paidMinor: 90000,
          overdueDays: null,
        },
      ],
    },
  ],
  works: [],
  deposits: [
    {
      id: 'caution-1',
      unitId: UNITE,
      tenant: NOM_LONG,
      heldMinor: 290000,
      withheldMinor: 45000,
      status: 'settling',
      billableMinor: 45000,
    },
  ],
  readings: [],
  /*
    DOUZE RÉSERVES, DONT DES DESCRIPTIONS QUI TIENNENT SUR TROIS LIGNES.

    C'est ce document-ci qui travaille le plus la mise en page : il est le seul
    dont la longueur vienne des DONNÉES et non du gabarit, donc le seul à
    franchir un saut de page. Un état des lieux de sortie sur un logement rendu
    en mauvais état porte facilement une réserve par pièce, chacune décrite en
    une phrase — c'est ce que la modale de saisie invite à écrire.
  */
  inspections: [
    {
      id: 'edl-1',
      unitId: UNITE,
      leaseId: 'bail-1',
      kind: 'entry',
      performedOn: '2026-06-01T00:00:00.000Z',
      rooms: 4,
      issues: 12,
      findings: Array.from({ length: 12 }, (_, rang) => ({
        id: `reserve-${rang}`,
        room: `Chambre ${rang + 1} — mur nord, angle supérieur près de la fenêtre`,
        description:
          'Trace d’humidité au plafond avec peinture cloquée sur environ un mètre carré, ' +
          'accompagnée d’un décollement du joint de plinthe sur toute la longueur du mur, ' +
          'et d’une auréole brune qui redescend derrière le radiateur jusqu’à la prise.',
        severity: rang % 2 === 0 ? ('minor' as const) : ('major' as const),
        costMinor: null,
        photos: [],
      })),
      signedAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  notifications: [],
  /* Les échéances sont servies AU NIVEAU DU PARC, et non sur l'unité : c'est la
     forme du serveur, celle que `donneesReellesDuLocataire` emploie déjà. */
  leaseCharges: [
    {
      leaseId: 'bail-1',
      periodStart: '2026-07-01T00:00:00.000Z',
      dueOn: '2026-07-05T00:00:00.000Z',
      rentMinor: 90000,
      waterMinor: 6500,
      powerMinor: 7300,
      paidMinor: 99500,
      payments: [
        {
          amountMinor: 99500,
          method: 'transfer',
          paidOn: '2026-07-04T00:00:00.000Z',
          reference: 'VIR-0000000000000000-REFERENCE-INTERMINABLE',
        },
      ],
    },
  ],
}

/** Un texte posé par le document : sa position, sa taille, sa graisse. */
interface TextePose {
  x: number
  y: number
  taille: number
  gras: boolean
  contenu: string
}

/*
  LES CARACTÈRES DE WINANSI QUE LE LATIN-1 NE REND PAS.

  On relit les octets en latin-1 : c'est exact de 0xA0 à 0xFF, faux de 0x80 à
  0x9F, là où WinAnsi place la typographie. Sans ce retour, l'apostrophe du
  dictionnaire serait mesurée à la chasse d'un point d'interrogation — plus
  large — et la règle deviendrait faussement sévère.
*/
const RETOUR_WINANSI: Record<string, string> = {
  '\x92': '’',
  '\x91': '‘',
  '\x93': '“',
  '\x94': '”',
  '\x96': '–',
  '\x97': '—',
  '\x85': '…',
  '\x95': '•',
  '\x80': '€',
}

function textesPoses(octets: Uint8Array): TextePose[] {
  const fichier = Array.from(octets, (o) => String.fromCharCode(o)).join('')
  const motif = /BT \/(F1|F2) ([\d.]+) Tf ([\d.]+) ([\d.]+) Td \(([\s\S]*?)\) Tj ET/g
  return [...fichier.matchAll(motif)].map(([, police, taille, x, y, brut]) => ({
    x: Number(x),
    y: Number(y),
    taille: Number(taille),
    gras: police === 'F2',
    contenu: brut
      .replace(/\\([()\\])/g, '$1')
      .replace(/[\x80-\x9f]/g, (c) => RETOUR_WINANSI[c] ?? c),
  }))
}

/** Le nombre de pages annoncé par le document. */
function comptePages(octets: Uint8Array): number {
  const fichier = Array.from(octets, (o) => String.fromCharCode(o)).join('')
  return Number(/\/Type \/Pages [^>]*\/Count (\d+)/.exec(fichier)?.[1] ?? 0)
}

/** Le fichier produit par un bouton : ses textes posés et son compte de pages. */
async function telechargerEnDetail(nom: RegExp) {
  const faux = installerFauxServeur()
  faux.quand('GET', `/parks/${PARC}/portfolio`, { status: 200, body: PORTEFEUILLE })
  const capture = captureDownloads()
  try {
    await renderApp('/app/documents', { session: sessionLocataire() })
    await attendreLeChargement()
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: nom })[0])
    const [fichier] = await capture.settle()
    return { textes: textesPoses(fichier.bytes), pages: comptePages(fichier.bytes) }
  } finally {
    capture.restore()
  }
}

/** Les seuls textes, pour les deux règles qui n'ont pas besoin du reste. */
async function telecharger(nom: RegExp) {
  return (await telechargerEnDetail(nom)).textes
}

/**
 * LES TROIS DOCUMENTS, et non plus la seule quittance.
 *
 * La première rédaction de cette règle ne composait que la quittance, et sa
 * réserve le disait : le reçu de caution et l'état des lieux passent par la même
 * mise en page, mais aucun jeu d'essai ne les éprouvait. Or c'est l'état des
 * lieux qui la travaille le plus — le seul dont la longueur vienne des données,
 * donc le seul à franchir un saut de page.
 */
const DOCUMENTS = [
  {
    nom: 'quittance',
    bouton: /^Télécharger$/,
    /* Le nom du locataire, la référence d'opérateur, et le total de la période
       — les trois valeurs longues que ce document seul compose. */
    attendus: [NOM_LONG, 'VIR-0000000000000000-REFERENCE-INTERMINABLE', '103'],
    pagesMinimales: 1,
  },
  {
    nom: 'reçu de caution',
    bouton: /^Télécharger le reçu de caution$/,
    // Consigné, retenu, et le solde qui s'en déduit : 290 000 − 45 000.
    attendus: [NOM_LONG, '290', '45', '245'],
    pagesMinimales: 1,
  },
  {
    nom: 'état des lieux',
    bouton: /^Télécharger l’état des lieux$/,
    /* La DOUZIÈME réserve : si elle est là, aucune n'a été perdue au saut de
       page — le défaut qu'un document long produit en silence. */
    attendus: ['Chambre 12', 'Chambre 1 '],
    /* DEUX PAGES AU MOINS, et c'est une exigence et non un constat : douze
       réserves décrites en trois lignes ne tiennent pas sur une feuille, et un
       document qui n'en rendrait qu'une aurait perdu la moitié en chemin. */
    pagesMinimales: 2,
  },
]

describe.each(DOCUMENTS)('le document $nom tient dans sa page', ({ bouton, attendus, pagesMinimales }) => {
  it('ne pose aucun texte hors des marges', async () => {
    const textes = await telecharger(bouton)

    // GARDE DE LA GARDE : un motif qui cesserait de reconnaître la forme des
    // commandes rendrait une liste vide, et la règle passerait au vert sans
    // avoir rien lu.
    expect(textes.length, 'aucun texte relu dans le document').toBeGreaterThan(10)

    /*
      SECOND VERROU, ET IL EST LE VRAI. Un jeu d'essai qui n'atteindrait pas le
      document rendrait une règle verte sur des noms courts — c'est-à-dire une
      couverture affirmée et jamais exercée. Il a d'ailleurs servi dès sa
      première exécution : le nom de l'immeuble n'arrivait pas, et c'est ainsi
      qu'on a vu que les documents interrogeaient le module de démonstration.

      Sur le TEXTE RECOMPOSÉ et non commande par commande : une valeur trop
      longue est désormais coupée, donc répartie sur plusieurs lignes. Chercher
      la chaîne entière dans une seule commande reviendrait à exiger que le
      repli n'ait pas lieu, c'est-à-dire à interdire le remède.
    */
    const recompose = textes.map((texte) => texte.contenu).join(' ')
    /* Les trois documents nomment tous le logement et son immeuble ; c'est le
       seul élément long qu'ils partagent, et donc la seule exigence commune. Ce
       que chacun porte en propre est éprouvé par le cas de couverture, plus
       bas, qui vérifie qu'aucun n'est resté sur son gabarit vide. */
    expect(
      recompose.includes(IMMEUBLE_LONG),
      'le jeu d’essai n’atteint pas le document : le nom de l’immeuble',
    ).toBe(true)

    const debords = textes
      .map((texte) => {
        const largeur = largeurDuTexte(texte.contenu, texte.taille, texte.gras)
        const gauche = PAGE.marge - texte.x
        const droite = texte.x + largeur - (PAGE.largeur - PAGE.marge)
        const pire = Math.max(gauche, droite)
        return { texte, pire }
      })
      /* Un demi-point de tolérance : les coordonnées sont écrites à trois
         décimales, et l'arrondi ne doit pas compter pour un débordement. */
      .filter(({ pire }) => pire > 0.5)
      .map(({ texte, pire }) => `« ${texte.contenu} » dépasse de ${pire.toFixed(1)} pt`)

    expect(debords, 'ces textes sortent de la colonne du document').toEqual([])
  })

  /**
   * LA COUVERTURE, ET ELLE EST LA CONDITION DES DEUX AUTRES CAS.
   *
   * Une règle de mise en page qui s'exécuterait sur un document resté à son
   * gabarit — un en-tête, un pied, rien entre les deux — serait verte pour la
   * pire des raisons. Chaque document doit donc prouver qu'il a composé ce
   * qu'on lui a donné, et l'état des lieux qu'il a franchi son saut de page.
   */
  it('compose bien ce qu’on lui a donné', async () => {
    const { textes, pages } = await telechargerEnDetail(bouton)
    const recompose = textes.map((texte) => texte.contenu).join(' ')

    for (const attendu of attendus)
      expect(recompose.includes(attendu), `le document ne porte pas « ${attendu} »`).toBe(true)

    expect(pages, 'le document tient sur moins de pages qu’il n’en faut').toBeGreaterThanOrEqual(
      pagesMinimales,
    )
  })

  it('ne pose aucun texte hors de la feuille', async () => {
    const textes = await telecharger(bouton)

    /* En bas : la ligne de base doit rester au-dessus de la marge basse. Le
       pied de page l'occupe déjà, et un contenu qui descendrait jusque-là
       s'écrirait par-dessus. */
    const hors = textes
      .filter((texte) => texte.y < PAGE.marge - 0.5 || texte.y > PAGE.hauteur - PAGE.marge + 0.5)
      .map((texte) => `« ${texte.contenu} » à ${texte.y.toFixed(0)} pt`)

    expect(hors, 'ces textes sortent de la feuille').toEqual([])
  })
})
