import { resolve } from 'node:path'
import { env } from '../env.js'
import { StockageLocal } from './local.js'
import type { Stockage } from './contrat.js'

/**
 * La sélection et la substitution, séparées du contrat.
 *
 * Le contrat vit dans `contrat.ts` et n'importe rien. Ce n'est pas un rangement
 * : l'implémentation locale a besoin du plafond et du lecteur d'entête, donc du
 * contrat. Si le contrat et l'instance vivaient dans le même fichier, l'import
 * ferait un cycle — et le cycle ne casserait pas à la compilation, il casserait
 * à l'exécution, sur `StockageLocal is not a constructor`, parce que l'instance
 * se construit au chargement du module.
 */

/**
 * Où l'implémentation locale pose ses octets.
 *
 * Hors de `src`, hors du dépôt git : ce sont des données, pas des sources. Le
 * dossier est créé à la volée — un développement qui n'envoie aucune photo n'a
 * pas à en trouver un vide.
 */
const RACINE_LOCALE = resolve(process.cwd(), '.stockage-local')

/**
 * Choisit l'implémentation.
 *
 * Deux clauses, dont la seconde est la seule qui mérite d'exister :
 *
 * - Rien de configuré → repli local. C'est l'état d'une machine de
 *   développement fraîchement clonée, et il doit marcher sans un secret.
 * - `NODE_ENV === 'test'` → repli local MÊME SI un dépôt réel est configuré.
 *   Sans cette clause, une suite lancée sur une machine où traînent les
 *   variables de production écrirait, effacerait et facturerait sur le seau
 *   réel — silencieusement, puisque rien dans un test ne dit quel dépôt il
 *   vise.
 */
export function choisirLeStockage(
  nodeEnv: string,
  fabriquerLocal: () => Stockage,
  fabriquerDistant?: () => Stockage,
): Stockage {
  if (nodeEnv === 'test') return fabriquerLocal()
  return fabriquerDistant ? fabriquerDistant() : fabriquerLocal()
}

/**
 * Le stockage du serveur.
 *
 * Une seule instance, choisie ici. Le jour où le dépôt distant est branché,
 * c'est le dernier argument de cet appel qui devient
 * `() => new StockageR2(...)` — et rien d'autre dans le dépôt ne bouge.
 */
let stockage: Stockage = choisirLeStockage(
  env.NODE_ENV,
  () => new StockageLocal(RACINE_LOCALE, env.SESSION_SECRET),
  undefined,
)

export function leStockage(): Stockage {
  return stockage
}

/** Réservé aux tests : remplace le stockage le temps d'un cas. */
export function remplacerStockage(remplacant: Stockage): () => void {
  const precedent = stockage
  stockage = remplacant
  return () => {
    stockage = precedent
  }
}
