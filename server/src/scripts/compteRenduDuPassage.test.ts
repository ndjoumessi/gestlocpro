import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  HEURE_DU_RESUME_UTC,
  compteRenduDesRelances,
  compteRenduDesResumes,
  estLHeureDuResume,
} from './executerRelancesAutomatiques.js'

/**
 * LE COMPTE RENDU DU PASSAGE DISAIT « 0 » DE DEUX FAÇONS DIFFÉRENTES.
 *
 * ═══ CE QU'ON LISAIT EN PRODUCTION ═══
 *
 * Neuf passages horaires mesurés, tous identiques :
 *
 *     Relance automatique — 2 parc(s), 0 courriel(s) parti(s), 0 ignoré(s).
 *     Résumés du fil — 0 envoyé(s).
 *
 * Et ce zéro-là couvre DEUX états qui n'ont rien à voir : un parc dont ce
 * n'est pas l'heure, et un parc à son heure où aucun bail n'atteint le jalon.
 * Le premier est le fonctionnement normal vingt-trois fois sur vingt-quatre ;
 * le second est une information sur le PARC. Rien ne les séparait.
 *
 * La seconde ligne était pire : elle affichait « 0 envoyé » aussi bien quand
 * l'expéditeur avait cherché sans rien trouver que quand la borne horaire
 * l'avait empêché de tourner. Un compte rendu muet sur ce qu'il n'a pas fait se
 * lit comme s'il l'avait fait — c'est la faute exacte que ce dépôt a déjà payée
 * sur le mode à blanc, qui « voyait une famille de courriels sur deux ».
 *
 * ═══ POURQUOI CES FONCTIONS SONT EXPORTÉES ═══
 *
 * La borne du résumé vivait dans le bloc d'exécution directe, qu'on ne peut pas
 * importer sans déclencher le parcours complet. Sa garde LISAIT donc la source
 * à la recherche d'un motif — `heureDuResume ? await envoyer…`. Une garde qui
 * lit une forme casse au premier remaniement et ne dit rien du comportement.
 * Ces trois fonctions sont pures : elles s'éprouvent.
 */
describe('l’heure du résumé', () => {
  it('est celle-là, et pas une autre', () => {
    expect(estLHeureDuResume(new Date('2026-09-03T06:00:00Z'))).toBe(true)
    expect(estLHeureDuResume(new Date('2026-09-03T06:59:59Z'))).toBe(true)
    expect(estLHeureDuResume(new Date('2026-09-03T07:00:00Z'))).toBe(false)
    expect(estLHeureDuResume(new Date('2026-09-03T05:59:59Z'))).toBe(false)
  })

  it('suit la constante, et non un nombre recopié', () => {
    const uneHeure = 3_600_000
    const alHeure = new Date(Date.UTC(2026, 8, 3) + HEURE_DU_RESUME_UTC * uneHeure)
    expect(estLHeureDuResume(alHeure)).toBe(true)
  })
})

describe('le compte rendu des résumés', () => {
  it('DIT quand il n’a pas tourné, au lieu de rendre zéro', () => {
    const ligne = compteRenduDesResumes(null)
    expect(ligne).not.toMatch(/\b0\b/)
    expect(ligne, 'il doit nommer l’heure qui l’en empêche').toContain(String(HEURE_DU_RESUME_UTC))
  })

  it('dit zéro quand il a cherché sans rien trouver', () => {
    expect(compteRenduDesResumes(0)).toMatch(/0/)
    expect(compteRenduDesResumes(0)).not.toEqual(compteRenduDesResumes(null))
  })

  it('dit le compte quand il a envoyé', () => {
    expect(compteRenduDesResumes(3)).toMatch(/3/)
  })
})

describe('le compte rendu des relances', () => {
  const resultat = {
    parcsTraites: 5,
    parcsALHeure: 2,
    envoyes: 1,
    ignores: 1,
    partiraient: 2,
  }

  it('sépare les parcs PARCOURUS de ceux qui étaient À LEUR HEURE', () => {
    const ligne = compteRenduDesRelances(resultat, false)
    expect(ligne).toContain('5')
    expect(ligne, 'sans ce nombre, « 0 envoyé » ne se distingue pas de « pas l’heure »').toContain(
      '2',
    )
  })

  it('dit combien de baux ATTEIGNAIENT le jalon, envoi ou pas', () => {
    /* Zéro envoyé sur deux baux au jalon est une PANNE ; zéro envoyé sur zéro
       bail est un mardi ordinaire. Le compte rendu doit les distinguer. */
    const rien = compteRenduDesRelances(
      { parcsTraites: 5, parcsALHeure: 2, envoyes: 0, ignores: 0, partiraient: 0 },
      false,
    )
    const panne = compteRenduDesRelances(
      { parcsTraites: 5, parcsALHeure: 2, envoyes: 0, ignores: 2, partiraient: 2 },
      false,
    )
    expect(rien).not.toEqual(panne)
  })

  it('à blanc, ne prétend rien avoir envoyé', () => {
    const blanc = compteRenduDesRelances(resultat, true)
    expect(blanc).toMatch(/BLANC/i)
    /* `PARTIRAIENT` contient « parti » : on vise la formule du passage RÉEL,
       pas la sous-chaîne. Première rédaction rouge sur son propre piège. */
    expect(blanc, 'le blanc n’envoie pas').not.toContain('parti(s)')
  })
})

describe('la borne du résumé, dans le lanceur', () => {
  it('est bien APPLIQUÉE, et non seulement disponible', () => {
    /*
      La garde de forme d'avant cherchait `heureDuResume ? await envoyer…` et
      cassait au premier remaniement — celui-ci. On garde une lecture de source,
      parce que le bloc d'exécution directe reste inimportable, mais on demande
      le FAIT : la fonction d'heure est appelée avant l'expéditeur.
    */
    const source = readFileSync(join(import.meta.dirname, 'executerRelancesAutomatiques.ts'), 'utf8')
    const posee = source.indexOf('estLHeureDuResume(')
    const envoi = source.indexOf('envoyerLesResumesDuFil(')
    expect(posee, 'la borne horaire a disparu du lanceur').toBeGreaterThan(-1)
    expect(posee, 'l’expéditeur tourne avant que l’heure soit consultée').toBeLessThan(envoi)
  })
})
