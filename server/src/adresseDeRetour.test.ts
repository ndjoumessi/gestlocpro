import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * TOUT CHEMIN DE RETOUR PASSE PAR `CLIENT_ORIGIN`, JAMAIS PAR UNE ADRESSE ÉCRITE.
 *
 * ═══ POURQUOI CETTE GARDE EXISTE MAINTENANT ═══
 *
 * Le produit s'est mis à vivre derrière un relais : le navigateur ne voit plus
 * l'hôte qui sert, il voit celui qui relaie. Six endroits du serveur ramènent
 * quelqu'un DANS le produit — le lien de réinitialisation, l'en-tête
 * `List-Unsubscribe`, et les quatre pieds de désabonnement (deux langues, deux
 * corps). Ils tirent tous leur adresse de `CLIENT_ORIGIN`, ce qui rend le
 * changement d'hôte possible en une variable.
 *
 * UNE SEULE ADRESSE ÉCRITE EN DUR SUFFIRAIT À CASSER CELA, et elle ne se
 * verrait pas : un lien de réinitialisation qui pointe vers l'ancien hôte
 * FONCTIONNE — il mène à un serveur qui répond. Il envoie seulement
 * l'utilisateur hors de l'adresse qu'on lui a apprise, et personne ne s'en
 * plaint jamais.
 *
 * ═══ CE QUE LA GARDE REGARDE ═══
 *
 * Les sources du serveur, hors tests et hors client généré. Elle tolère les
 * adresses de FOURNISSEURS — l'API de Resend, celle des taux de change — parce
 * qu'elles ne ramènent personne dans le produit : ce sont des appels sortants,
 * et leur hôte est précisément ce qu'on ne veut pas rendre configurable.
 */
const RACINE = join(import.meta.dirname, '..')

/** Les hôtes qu'on APPELLE, par opposition à ceux vers lesquels on renvoie.
    `api.twilio.com` y entre avec le canal SMS : un appel sortant de plus,
    dont l'hôte est précisément ce qu'on ne veut PAS rendre configurable. */
const FOURNISSEURS =
  /api\.resend\.com|api\.twilio\.com|api\.frankfurter\.dev|fonts\.(googleapis|gstatic)\.com|www\.w3\.org|openapi\.vercel\.sh/

function sources(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    if (entree === 'generated' || entree === 'node_modules') continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) trouves.push(...sources(chemin))
    else if (/\.ts$/.test(entree) && !/\.test\.ts$/.test(entree)) trouves.push(chemin)
  }
  return trouves
}

describe('les adresses de retour', () => {
  it('ne sont écrites en dur nulle part dans le serveur', () => {
    const fautifs: string[] = []
    for (const fichier of sources(join(RACINE, 'src'))) {
      const contenu = readFileSync(fichier, 'utf8')
      for (const ligne of contenu.split('\n')) {
        for (const [, hote] of ligne.matchAll(/(https?:\/\/[a-z0-9.-]+\.[a-z]{2,})/gi)) {
          if (FOURNISSEURS.test(hote!)) continue
          if (hote!.includes('localhost') || hote!.includes('127.0.0.1')) continue
          fautifs.push(`${fichier.replace(RACINE, 'server')} → ${hote}`)
        }
      }
    }
    expect(
      fautifs,
      'un lien de retour écrit en dur FONCTIONNE, et envoie l’utilisateur hors de ' +
        'l’adresse qu’on lui a apprise. Passez par `env.CLIENT_ORIGIN`.',
    ).toEqual([])
  })

  it('sont bien ONZE, et le compte est écrit à la main', () => {
    /*
      GARDE DU GARDE. « Aucune adresse en dur » et « plus aucun lien de retour »
      s'écrivent pareil dans un journal : si quelqu'un retirait le pied de
      désabonnement, la règle ci-dessus resterait verte sur un produit qui ne
      ramène plus personne. Le compte est donc écrit, et un diff le montre.

      11, et la ventilation compte : 1 pour le lien de réinitialisation, 1 pour
      l'en-tête `List-Unsubscribe`, 6 pour les pieds de désabonnement, et 3 pour
      le RÉSUMÉ du fil — son pied dit lui aussi où changer le réglage, en texte
      (1) et en HTML (2 : le `href` et le texte visible). SIX et
      non quatre — chaque pied HTML cite l'adresse DEUX fois, dans le `href` et
      dans le texte visible, parce qu'un lien dont on ne lit pas la destination
      ne se vérifie pas avant de cliquer. Deux langues : (1 texte + 2 HTML) × 2.

      J'avais écrit 4, puis 6, avant de compter. Le compte à la main sert
      exactement à cela : il oblige à regarder.
    */
    let usages = 0
    for (const fichier of sources(join(RACINE, 'src'))) {
      const contenu = readFileSync(fichier, 'utf8')
      if (fichier.endsWith('env.ts') || fichier.endsWith('index.ts')) continue
      if (fichier.endsWith('app.ts')) continue
      usages += [...contenu.matchAll(/env\.CLIENT_ORIGIN/g)].length
    }
    expect(usages, 'un chemin de retour a disparu, ou un autre est apparu').toBe(11)
  })
})
