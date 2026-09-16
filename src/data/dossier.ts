import type { MessageKey } from '@/i18n/I18nProvider'

/**
 * LE DOSSIER PERSONNEL — ce que le serveur rend, nommé une fois pour tous.
 *
 * Le droit à la portabilité (RGPD, art. 20) n'est pas un écran de plus : c'est
 * la promesse que la personne peut EMPORTER ce que le produit sait d'elle. Le
 * serveur en décide l'étendue, bornée à ce que le demandeur lit déjà — voir
 * `server/src/parks/exportDesDonnees.test.ts`.
 *
 * LES LIGNES NE SONT PAS TYPÉES UNE À UNE, et c'est délibéré. Elles sortent
 * telles que le serveur les écrit ; les retyper ici créerait une seconde
 * définition à tenir en accord avec la première, pour un écran qui ne fait que
 * COMPTER les lignes et les écrire en CSV. Ce que ce module tient, en revanche,
 * c'est la LISTE des natures : une nature ajoutée au serveur et oubliée ici
 * sortirait du dossier sans que personne ne le voie.
 */
export type LigneDuDossier = Record<string, unknown>

export interface Dossier {
  exporteLe: string
  role: string
  compte: Record<string, unknown>
  parc: Record<string, unknown>
  immeubles: LigneDuDossier[]
  logements: LigneDuDossier[]
  locataires: LigneDuDossier[]
  baux: LigneDuDossier[]
  loyersAppeles: LigneDuDossier[]
  versements: LigneDuDossier[]
  cautions: LigneDuDossier[]
  releves: LigneDuDossier[]
  tarifs: LigneDuDossier[]
  etatsDesLieux: LigneDuDossier[]
  travaux: LigneDuDossier[]
  avis: LigneDuDossier[]
  adhesions: LigneDuDossier[]
  invitations: LigneDuDossier[]
  journal: LigneDuDossier[]
}

/** Les natures en LISTES, dans l'ordre où l'écran les montre. */
export const NATURES_DU_DOSSIER = [
  'immeubles',
  'logements',
  'locataires',
  'baux',
  'loyersAppeles',
  'versements',
  'cautions',
  'releves',
  'tarifs',
  'etatsDesLieux',
  'travaux',
  'avis',
  'adhesions',
  'invitations',
  'journal',
] as const

export type NatureDuDossier = (typeof NATURES_DU_DOSSIER)[number]

/** Le libellé d'une nature, dans la langue de qui exporte. */
export function cleDeNature(nature: NatureDuDossier): MessageKey {
  return `app.data.natures.${nature}` as MessageKey
}

/**
 * Les lignes d'une nature, mises à plat pour un tableur.
 *
 * Une cellule qui porterait un objet — les constats d'un état des lieux, par
 * exemple — s'écrirait `[object Object]` dans le fichier. Elle est donc rendue
 * en JSON : illisible d'un coup d'œil, mais VRAIE, et le dossier ne perd rien.
 */
export function cellulesDeLaLigne(ligne: LigneDuDossier, colonnes: string[]): string[] {
  return colonnes.map((colonne) => {
    const valeur = ligne[colonne]
    if (valeur === null || valeur === undefined) return ''
    if (typeof valeur === 'object') return JSON.stringify(valeur)
    return String(valeur)
  })
}

/** Les colonnes d'une nature : celles de sa première ligne, dans leur ordre. */
export function colonnesDeLaNature(lignes: LigneDuDossier[]): string[] {
  return lignes.length > 0 ? Object.keys(lignes[0]!) : []
}
