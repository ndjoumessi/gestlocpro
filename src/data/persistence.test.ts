import { describe, expect, it } from 'vitest'
import { hasStoredState, loadState, resetState, saveState } from './persistence'
import { DEPOSITS, UNITS, WORKS } from './portfolio'

const CLE = 'gestlocpro.portfolio'

/**
 * Persistance de l'état de démonstration.
 *
 * Ce qui compte ici n'est pas tant le chemin nominal que le comportement face à
 * un enregistrement abîmé : version périmée, JSON illisible, forme inattendue.
 * Une démonstration qui redémarre à zéro est un désagrément ; une application
 * qui refuse de s'afficher parce qu'un vieux payload traîne dans le navigateur
 * en est un autre, bien pire.
 */
describe('lecture et écriture', () => {
  it('rend le jeu de démonstration quand rien n’est enregistré', () => {
    expect(loadState().units).toEqual(UNITS)
    expect(hasStoredState()).toBe(false)
  })

  it('relit ce qui a été écrit', () => {
    const modifie = {
      units: UNITS.map((u) => (u.id === 'B4' ? { ...u, tenant: 'Awa Diallo' } : u)),
      works: loadState().works,
      deposits: loadState().deposits,
    }
    saveState(modifie)

    expect(hasStoredState()).toBe(true)
    expect(loadState().units.find((u) => u.id === 'B4')?.tenant).toBe('Awa Diallo')
  })

  it('efface sur demande et rend l’état initial', () => {
    saveState({ ...loadState(), units: [] as never })
    expect(resetState().units).toEqual(UNITS)
    expect(hasStoredState()).toBe(false)
  })
})

describe('enregistrement abîmé', () => {
  it('écarte un enregistrement dont le modèle a changé', () => {
    // Cas réel : le corps de métier est passé de la chaîne en clair
    // (« Plomberie ») à une clé de traduction (`plumbing`). Un enregistrement
    // de version 1 rendait `app.trades.Plomberie` à l'écran — la clé
    // introuvable, affichée telle quelle. C'est ce que l'incrément protège.
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        version: 1,
        etat: {
          units: [{ id: 'A1' }],
          works: [{ id: 'X', trade: 'Plomberie' }],
          deposits: [{ unitId: 'A1' }],
        },
      }),
    )

    const charge = loadState()
    expect(charge.works.every((w) => /^[a-z]+$/.test(w.trade))).toBe(true)
    expect(charge.units).toEqual(UNITS)
  })

  it('écarte un enregistrement où le locataire parti portait un libellé français', () => {
    // Le champ valait « Ancien locataire » en clair ; il vaut `null` depuis.
    // Un enregistrement antérieur ferait réapparaître ce français dans une
    // interface anglaise.
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        version: 2,
        etat: {
          units: [{ id: 'A1' }],
          works: [{ id: 'X', trade: 'plumbing' }],
          deposits: [{ unitId: 'B4', tenant: 'Ancien locataire' }],
        },
      }),
    )

    expect(loadState().deposits).toEqual(DEPOSITS)
  })

  it('écarte un enregistrement dont les unités n’ont pas de téléphone', () => {
    // Le formulaire de création réclamait un numéro en promettant d'y envoyer
    // le code d'invitation, puis le jetait faute de champ pour l'accueillir.
    // Un enregistrement de version 3 rendrait la colonne « Contact » vide pour
    // tout le parc.
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        version: 3,
        etat: {
          units: [{ id: 'A1', tenant: 'Charles Ngassa' }],
          works: [{ id: 'X', trade: 'plumbing' }],
          deposits: [{ unitId: 'A1', tenant: 'Charles Ngassa' }],
        },
      }),
    )

    expect(loadState().units).toEqual(UNITS)
    expect(loadState().units.every((u) => (u.tenant === null) === (u.phone === null))).toBe(true)
  })

  it('accepte la typologie du logement inchangée, qui n’a pas justifié d’incrément', () => {
    // Contre-exemple utile : `Unit.type` est passé de `string` à une union
    // TypeScript au même moment, et cela ne devait PAS invalider les
    // enregistrements — les valeurs `T1`…`T4` sont identiques. Ce qui compte
    // est la forme des données écrites, pas celle du code qui les lit.
    const etat = { ...loadState(), units: UNITS.map((u) => ({ ...u, type: 'T3' as const })) }
    saveState(etat)
    expect(loadState().units.every((u) => u.type === 'T3')).toBe(true)
  })

  it('écarte un enregistrement où l’intitulé d’un signalement était une phrase', () => {
    // Les intitulés du jeu de démonstration sont passés de la phrase en clair
    // à une clé, et le champ a changé de nom. Un enregistrement de version 4
    // rendrait un intitulé vide, `titleKey` étant absent.
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        version: 4,
        etat: {
          units: [{ id: 'A1', phone: '+237 6 77 21 44 08' }],
          works: [{ id: 'X', trade: 'plumbing', title: 'Fuite sous l’évier de la cuisine' }],
          deposits: [{ unitId: 'A1' }],
        },
      }),
    )

    expect(loadState().works).toEqual(WORKS)
    expect(loadState().works.every((w) => typeof w.titleKey === 'string')).toBe(true)
  })

  it('écarte une version périmée', () => {
    // Le jeu de démonstration a changé plusieurs fois pendant la construction —
    // dates en chaînes figées, puis en valeurs machine, statut « en attente »
    // ajouté. Sans ce garde, un vieil enregistrement les ressusciterait.
    window.localStorage.setItem(
      CLE,
      JSON.stringify({ version: 0, etat: { units: [{ id: 'X' }], works: [], deposits: [] } }),
    )
    expect(loadState().units).toEqual(UNITS)
    // L'enregistrement périmé est retiré plutôt que relu à chaque démarrage.
    expect(window.localStorage.getItem(CLE)).toBeNull()
  })

  it('écarte un JSON illisible', () => {
    window.localStorage.setItem(CLE, '{ ceci n’est pas du JSON')
    expect(loadState().units).toEqual(UNITS)
  })

  it('écarte une forme inattendue', () => {
    window.localStorage.setItem(CLE, JSON.stringify({ version: 1, etat: { units: 'oui' } }))
    expect(loadState().units).toEqual(UNITS)
  })

  it('écarte des collections vides, signe de corruption', () => {
    // Rien dans l'interface ne permet de vider le parc : une collection vide
    // n'est pas un état légitime.
    window.localStorage.setItem(
      CLE,
      JSON.stringify({ version: 1, etat: { units: [], works: [], deposits: [] } }),
    )
    expect(loadState().units).toEqual(UNITS)
  })

  it('survit à un stockage indisponible', () => {
    // Navigation privée, quota dépassé, stockage refusé par la politique du
    // navigateur : l'écriture échoue, la session continue en mémoire.
    const original = window.localStorage.setItem
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    expect(() => saveState(loadState())).not.toThrow()

    window.localStorage.setItem = original
  })
})
