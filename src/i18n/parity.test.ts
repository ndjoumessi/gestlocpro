import { describe, expect, it } from 'vitest'
import { fr } from './fr'
import { en } from './en'
import { ALERTS, type AlertMessage } from '@/data/portfolio'

/**
 * Parité et cohérence des dictionnaires.
 *
 * Le typage de `en.ts` contre `fr.ts` garantit déjà qu'aucune clé ne manque.
 * Ce qu'il ne voit pas, et que ces tests couvrent :
 *
 *  - une variante de pluriel ajoutée d'un seul côté — `issues_one` en français
 *    sans son équivalent anglais passerait la compilation et rendrait la forme
 *    par défaut, donc « 1 issues » ;
 *  - un jeton d'interpolation présent dans une langue et absent de l'autre,
 *    qui laisserait un `{count}` littéral à l'écran ;
 *  - une traduction restée identique au français, signe d'un oubli.
 */

type Noeud = Record<string, unknown>

/** Aplatit un dictionnaire en chemins pointés. */
function aplatir(noeud: Noeud, prefixe = ''): Record<string, string> {
  const sortie: Record<string, string> = {}
  for (const [cle, valeur] of Object.entries(noeud)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle
    if (typeof valeur === 'string') sortie[chemin] = valeur
    else if (valeur && typeof valeur === 'object') Object.assign(sortie, aplatir(valeur as Noeud, chemin))
  }
  return sortie
}

const FR = aplatir(fr as unknown as Noeud)
const EN = aplatir(en as unknown as Noeud)

/** Jetons `{nom}` d'une chaîne, triés pour être comparables. */
const jetons = (texte: string) => [...texte.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('parité des dictionnaires', () => {
  it('couvre les mêmes chemins de part et d’autre', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort())
  })

  it('déclare les mêmes variantes de pluriel', () => {
    const variantes = (dict: Record<string, string>) =>
      Object.keys(dict)
        .filter((cle) => /_(zero|one|two|few|many|other)$/.test(cle))
        .sort()

    // Une variante d'un seul côté compile sans erreur et rend « 1 issues ».
    expect(variantes(EN)).toEqual(variantes(FR))
    expect(variantes(FR).length).toBeGreaterThan(5)
  })

  it('emploie les mêmes jetons d’interpolation dans les deux langues', () => {
    for (const [chemin, texteFr] of Object.entries(FR)) {
      expect({ chemin, jetons: jetons(EN[chemin] ?? '') }).toEqual({
        chemin,
        jetons: jetons(texteFr),
      })
    }
  })

  it('donne une variante de pluriel à toute clé interpolant {count}', () => {
    const sansVariante = Object.entries(FR)
      .filter(([chemin, texte]) => texte.includes('{count}') && !/_\w+$/.test(chemin))
      .filter(([chemin]) => !FR[`${chemin}_one`])
      .map(([chemin]) => chemin)

    expect(sansVariante).toEqual([])
  })

  it('ne laisse aucune valeur vide', () => {
    for (const [chemin, texte] of Object.entries(FR)) {
      expect({ chemin, vide: texte.trim().length === 0 }).toEqual({ chemin, vide: false })
      expect({ chemin, vide: (EN[chemin] ?? '').trim().length === 0 }).toEqual({
        chemin,
        vide: false,
      })
    }
  })

  it('ne laisse pas de phrase anglaise identique au français', () => {
    // Un mot isolé identique dans les deux langues est banal — « Type »,
    // « Contact », « Administration », « Vacant », « Mobile money ». Les
    // recenser produirait une liste d'exceptions qui grandirait à chaque ajout
    // et ne signalerait plus rien.
    //
    // Une PHRASE identique, en revanche, ne s'explique pas par le vocabulaire
    // commun : c'est une traduction oubliée. Le seuil retient ce signal-là.
    const SEUIL = 25

    const suspectes = Object.entries(FR)
      .filter(([chemin, texteFr]) => texteFr.length >= SEUIL && EN[chemin] === texteFr)
      .map(([chemin]) => chemin)

    expect(suspectes).toEqual([])
  })
})

/**
 * Chaque message d'alerte QUE LE PRODUIT PEUT ÉCRIRE a son gabarit.
 *
 * Deux d'entre eux n'en avaient pas — ceux de la relance et de la mise en
 * demeure, que seul le serveur écrit, jamais la démonstration. L'écran compose
 * `app.alerts.msg.<clé>.title` ; sans gabarit, le fournisseur d'i18n rend la
 * CLÉ BRUTE, et le gestionnaire lisait du texte technique dans sa liste.
 *
 * Le type `AlertMessage` est la seule liste qui les recense tous. La parcourir
 * ici lie les trois pièces — le type, le dictionnaire français, l'anglais — de
 * sorte qu'en ajouter une quatrième oblige à écrire les deux autres.
 */
describe('les messages d’alerte ont tous leur gabarit', () => {
  const MESSAGES: AlertMessage[] = [
    'rentOverdue',
    'quotePending',
    'metersMissing',
    'leaseRenewal',
    'partialPayment',
    'workDone',
    'receiptAvailable',
    'rentReminder',
    'formalNotice',
    /* Le signalement qui MONTE. `workReply` descend et n'est pas encore dans
       le jeu de démonstration ; celui-ci y est, donc le témoin le tient. */
    'tenantReport',
  ]

  it('recense bien tout le type, sans en oublier', () => {
    // Une liste écrite à la main peut prendre du retard sur le type qu'elle
    // couvre. Les messages du jeu de démonstration servent de témoin : ils
    // doivent tous s'y trouver.
    for (const alerte of ALERTS) expect(MESSAGES).toContain(alerte.message)
  })

  it('porte un titre et un détail dans les deux langues', () => {
    const manquants: string[] = []
    for (const message of MESSAGES) {
      for (const [langue, dico] of [['fr', FR], ['en', EN]] as const) {
        // `title` et `detail` sont les deux parties que `Alerts.tsx` demande.
        // Les variantes `_one` sont facultatives : toutes les alertes ne
        // comptent pas quelque chose.
        for (const part of ['title', 'detail']) {
          const chemin = `app.alerts.msg.${message}.${part}`
          if (!dico[chemin]) manquants.push(`${langue}: ${chemin}`)
        }
      }
    }
    expect(manquants).toEqual([])
  })
})
