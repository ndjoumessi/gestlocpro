/**
 * LES PLAFONDS, LE COMPTE GARDÉ, ET CE QUI NE S'OUVRE PAS.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══
 *
 * Ce sont des DONNÉES et une consultation, pas une mesure : deux largeurs, deux
 * langues, un nombre d'états écrit à la main, et la fonction qui choisit le
 * plafond selon la police imposée. Cent cinquante lignes dont l'essentiel est
 * l'HISTORIQUE des nombres — chaque palier avec le lot qui l'a fait bouger —,
 * et cet historique n'a rien à faire au milieu d'une boucle de mesure.
 *
 * Sorti de `modales.mjs` le 2026-10-01, pour la même raison que le registre
 * l'avait été la veille : `modales.mjs` avait dépassé son plafond de lisibilité, et
 * ce qu'on y lit le moins souvent est ce qui doit en sortir d'abord.
 *
 * `ATTENDUS` RESTE ÉCRIT À LA MAIN, et c'est le point : le dériver de
 * `MODALES.length` rendrait la garde d'accord avec elle-même. Le déplacer ne
 * change pas cela — il faut toujours toucher ce nombre pour ajouter une modale,
 * et le diff le montre toujours.
 */
import { exit } from 'node:process'
import { POLICE_LARGE } from '../police-large.mjs'

/**
 * LES DEUX QUI NE S'OUVRENT PAS, ET POURQUOI — voir l'en-tête de `modales.mjs`,
 * section « CE QU'IL NE MESURE PAS ».
 *
 * Écrites ici plutôt que passées sous silence : leur nombre entre dans le
 * compte gardé, donc une troisième modale qui deviendrait inatteignable ferait
 * rougir, et l'une de ces deux qui redeviendrait atteignable aussi.
 */
/*
  REDEVENUE VIDE, ET C'EST UN ÉTAT QUI SE GARDE COMME UN AUTRE.

  La mise en demeure y a passé un lot : son bouton était masqué en démonstration
  faute d'un chemin local honnête. Elle en est sortie par le haut — le
  fournisseur nomme désormais l'issue « démonstration », l'écran écrit « rien
  n'est enregistré », et la boîte s'ouvre. Les dix-huit modales du produit sont
  de nouveau toutes ouvrables.

  La liste reste, avec son compte : une dix-neuvième que la démonstration ne
  rendrait pas devrait s'y inscrire et faire bouger `NON_OUVRABLES_ATTENDUES`,
  donc apparaître dans un diff. Retirer la liste parce qu'elle est vide, c'est
  retirer le seul endroit où l'on remarquerait qu'elle a cessé de l'être.

  ANCIEN MOTIF, GARDÉ POUR MÉMOIRE.

  La mise en demeure est conditionnée à `unit.leaseId`, qu'aucun bail de la
  démonstration ne porte. C'est DÉLIBÉRÉ et il faut que ça le reste :
  `serveFormalNotice` rend `false` sans parc serveur, donc le bouton ouvrirait
  une boîte dont la confirmation ne ferait rien — un cul-de-sac sous un libellé
  qui promet un acte. Poser un `leaseId` fictif pour la faire entrer dans cette
  garde échangerait un trou de mesure contre un mensonge d'écran.

  C'est la différence avec le `tenantId` du lot précédent, où le chemin
  local existait : là-bas la donnée manquait sans raison, ici son absence EST la
  raison. La géométrie de cette boîte reste donc non mesurée, et c'est écrit.
*/
export const NON_OUVRABLES = []

/**
 * UN PLAFOND, DEUX POLICES — meme arbitrage que `plafond-coquille`.
 *
 * `--font-sans` commence par `system-ui`, qui designe un dessin DIFFERENT par
 * systeme : « Creer mon espace » rend 132,61 px sur macOS et 146,14 px sur
 * l'executeur Ubuntu, ou il vaut DejaVu Sans. Un corps de modale se compose de
 * texte : plus large, il est plus haut, et il defile davantage. Neuf des
 * trente-six etats depassaient leur plafond sous police large, jusqu'a +80 px
 * sur l'etat des lieux.
 *
 * CE N'EST PAS UN DEFAUT, C'EST UN COUT — le pied reste tenu, l'action reste
 * sous les yeux, et c'est ce que `modales.mjs` garde. Relever le plafond unique
 * aurait donne du mou a la mesure locale ; rogner le contenu aurait cache des
 * indications qui disent ce qu'un champ engage. On garde donc LES DEUX MESURES
 * VRAIES, et `defilLarge` porte celle de la police large.
 *
 * LES TRENTE-SIX SONT MESUREES, sans marge, pas seulement les neuf qui
 * depassaient : un plafond recopie d'une autre colonne serait un nombre, pas un
 * releve.
 */
export const LARGEURS = [360, 1280]
export const LANGUES = ['fr', 'en']
/*
  ATTENDUS EST UNE CONSTANTE ÉCRITE, JAMAIS UN PRODUIT CALCULÉ.

  `MODALES.length * LARGEURS.length * LANGUES.length` rendrait la garde
  d'accord avec elle-même : vider `MODALES`, et l'inspection comparerait 0 à 0
  puis se déclarerait verte. La même mutation a trouvé ce piège trois lots de
  suite. Ajouter une modale oblige à toucher ce nombre, et le diff le montre.

  48 = 12 modales ouvrables × 2 largeurs × 2 langues.
  0  = plus aucune modale hors de portée de la démonstration.

  Les deux nombres ont bougé ENSEMBLE, deux fois de suite : `ParkSettings` puis
  `Tariffs` sont passées de la seconde ligne à la première. C'est exactement ce
  que ce compte écrit à la main sert à rendre visible dans un diff.

  72 → 76 (2026-08-31) : `InviteGestionnaire`, le SECOND état de la modale
  d'invitation. Ce n'est pas une modale de plus, c'est un état de plus dans une
  modale déjà tenue — le premier que ce script mesure grâce au geste `apres`.

  76 → 80 (2026-08-31) : `ConfierImmeubles`, née avec la délégation par
  immeuble. Elle vient à quatre états comme toute modale ordinaire — deux
  largeurs, deux chasses.
  Une modale n'a pas un état, elle en a autant que ses champs, et le compte le
  dit maintenant.

  80 → 84 (2026-09-02) : `ParkSettings·devise`, le second état de la modale de
  correction du parc. Comme `InviteGestionnaire`, ce n'est pas une modale de
  plus mais un ÉTAT de plus — et c'est lui qui éteint l'aveu que
  `notes-conditionnelles` portait sur `app.parkSettings.currencyWarning`, en
  désignant ce script comme son propriétaire légitime.

  84 → 92 (2026-09-05) : `EditBuilding` et `EditUnit`, nées avec la correction
  du parc — deux modales ordinaires, donc huit états. Elles ferment le dernier
  trou de cet écran : un immeuble ne se corrigeait pas une fois qu'il portait un
  logement, et un logement ne se corrigeait pas du tout.

  92 → 96 (2026-09-05) : `RecordReading`, la saisie d'un relevé de compteur —
  le geste qui manquait sous l'écran des relevés, qu'aucune route n'alimentait.

  96 → 108 (2026-09-05) : `CorrigerFiche`, `CreerFiche` et `RelierLaFiche`, les
  trois modales que le clavier vient de prendre et dont la géométrie n'était
  mesurée nulle part. « Confier des immeubles » y était déjà, sous le nom
  `ConfierImmeubles` — le trou n'était donc que de trois sur quatre, ce qu'un
  registre par fichier ne pouvait pas dire.

  LES DEUX TIENNENT SANS DÉFILEMENT AUX QUATRE ÉTATS — 442 px de boîte au plus
  large pour l'immeuble, 708 pour le logement, note du loyer comprise. C'est
  mesuré, pas espéré : le plafond de zéro est le relevé lui-même.

  108 → 112 (2026-09-06) : `DeleteUnit`, le retrait d'un logement — le dernier
  objet du parc qui n'avait aucune issue. Une modale ordinaire, donc quatre
  états. Son `prealable` CRÉE le logement qu'elle va retirer : les douze du jeu
  de démonstration portent tous un bail, un versement ou un relevé, donc leurs
  douze croix sont fermées et le geste ne s'ouvre sur aucune d'elles.

  112 → 116 (2026-09-07) : `RelancerLocataire`, née avec la refonte de l'écran
  des locataires en fiches. Une modale ordinaire, donc quatre états. Elle
  confirme un envoi vers UNE personne, là où la relance des paiements en groupe
  plusieurs — mêmes mots, au singulier.

  LE MÊME LOT A DÉPLACÉ DEUX LIBELLÉS, et cette garde l'a dit avant tout le
  monde : « Corriger » et « Retirer » se sont repliés derrière trois points, et
  leurs noms accessibles portent désormais leur cible. Le script ouvrait déjà
  les menus ; il cherchait les anciens noms, et refusait plutôt que d'écrire
  « sans défaut » sur ce qu'il n'avait pas ouvert.
*/
export const ATTENDUS = 140
export const NON_OUVRABLES_ATTENDUES = 0

/**
 * Le plafond effectif, selon la police imposee.
 *
 * La garde refuse une entree sans `defilLarge` : une modale ajoutee demain qui
 * n'en porterait qu'un passerait au vert en mode police large sans etre gardee,
 * ce qui est exactement le silence que cette porte existe pour empecher.
 */
export function plafondDe(modale, largeur) {
  if (!POLICE_LARGE) return modale.defil[largeur]
  if (!modale.defilLarge || typeof modale.defilLarge[largeur] !== 'number') {
    console.error(
      `\n✗ modales : « ${modale.nom} » n'a pas de \`defilLarge\` pour ${largeur} px.\n` +
        '   Chaque plafond a deux valeurs depuis que les deux polices sont mesurees.\n' +
        '   Relancez `MESURER_EN_POLICE_LARGE=1 node scripts/modales.mjs` et inscrivez le releve.\n',
    )
    exit(1)
  }
  return modale.defilLarge[largeur]
}
