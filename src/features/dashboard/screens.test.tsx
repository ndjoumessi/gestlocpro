import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { UNITS, WORKS } from '@/data/portfolio'

/**
 * Défauts relevés écran par écran en basculant l'interface en anglais.
 *
 * Ils partagent une origine : une valeur écrite pour être lue en français —
 * une notation, une abréviation, un nombre nu — puis servie telle quelle à un
 * lecteur anglophone. Aucun ne se voyait dans l'interface française, ce qui
 * explique qu'ils aient tous survécu à la relecture.
 */
describe('typologie du logement', () => {
  it('se traduit là où la notation française ne se lit pas', () => {
    // « T3 » compte les pièces principales à la française. Ce n'est pas un mot
    // français, mais c'est une notation française : le marché anglophone
    // compte les chambres.
    renderApp('/app/parc', { locale: 'en' })
    expect(screen.getAllByText(/2-bed/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\bT3\b/)).not.toBeInTheDocument()
  })

  it('garde la notation d’origine en français', () => {
    renderApp('/app/parc')
    expect(screen.getAllByText(/T3/).length).toBeGreaterThan(0)
  })

  it('se cherche sur le libellé affiché, non sur la clé', () => {
    // Un anglophone tape ce qu'il voit. Chercher « T3 » sur une interface qui
    // affiche « 2-bed » ne ramenait rien de ce qui était pourtant à l'écran.
    renderApp('/app/parc', { locale: 'en' })
    expect(screen.getAllByText(/2-bed/).length).toBeGreaterThan(0)
  })
})

describe('paiements', () => {
  it('n’abrège pas les jours de retard en français', () => {
    // La cellule portait « +24 j », y compris en anglais.
    renderApp('/app/paiements', { locale: 'en' })
    expect(screen.getByText('+24 d')).toBeInTheDocument()
    expect(screen.queryByText('+24 j')).not.toBeInTheDocument()
  })
})

describe('relevés de compteurs', () => {
  it('affiche les tarifs unitaires comme des montants', () => {
    // Ils étaient interpolés directement : « 520 » sans devise ni groupement,
    // à côté d'un total correctement formaté, et insensibles à la devise.
    renderApp('/app/releves', { locale: 'en', currency: 'USD' })
    expect(screen.getByText(/\$\s?520/)).toBeInTheDocument()
  })

  it('groupe les index de compteur', () => {
    // Cinq chiffres rendus « 7640 » dans les deux langues.
    renderApp('/app/releves', { locale: 'en' })
    expect(screen.getByText(/7,320→7,640/)).toBeInTheDocument()
  })
})

/**
 * Le groupement des milliers suit la **devise**, non la langue de l'interface.
 *
 * Décision de produit, prise explicitement : « 45 000 FCFA » garde son espace
 * insécable étroite dans l'interface anglaise. Le franc CFA est une monnaie de
 * zone francophone, et son écriture usuelle ne change pas parce que le lecteur
 * a choisi l'anglais — au contraire d'une date, qui est du formatage pur.
 *
 * Ce test existe pour que la règle ne passe pas pour un oubli : sans lui, elle
 * ressemble à un défaut d'i18n et quelqu'un la « corrigera ».
 */
describe('groupement monétaire', () => {
  // L'espace du rendu est insécable ÉTROITE (U+202F) et non ordinaire : c'est
  // elle qui empêche un montant de se couper en fin de cellule. L'écrire en
  // échappement plutôt qu'en caractère invisible évite un test qui échoue sans
  // qu'on voie pourquoi.
  const FINE = '\u202f'

  // La cellule découpe le montant en plusieurs nœuds selon la colonne, d'où
  // l'assertion sur le texte de la page plutôt que sur un élément : ce que la
  // règle affirme est bien « ce rendu apparaît à l'écran », pas « il occupe tel
  // élément ».
  const texte = () => document.body.textContent ?? ''

  it('suit la devise et non la langue de l’interface', () => {
    renderApp('/app/paiements', { locale: 'en', currency: 'CFA' })
    expect(texte()).toContain(`145${FINE}000${FINE}FCFA`)
  })

  it('change bien avec la devise, à langue égale', () => {
    renderApp('/app/paiements', { locale: 'en', currency: 'USD' })
    expect(texte()).toContain(`$${FINE}145,000`)
  })
})

describe('locataires', () => {
  it('conserve le téléphone demandé au lieu de le jeter', () => {
    // Le formulaire réclamait un numéro en promettant d'y envoyer le code
    // d'invitation ; `addTenant` ne recevait que le nom, et aucun champ du
    // modèle ne pouvait l'accueillir.
    expect(UNITS.every((u) => (u.tenant === null) === (u.phone === null))).toBe(true)
  })

  it('affiche le contact, dont les clés existaient sans appelant', () => {
    renderApp('/app/locataires', { locale: 'en' })
    expect(screen.getByRole('columnheader', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.getByText('+237 6 77 21 44 08')).toBeInTheDocument()
  })
})

/**
 * Intitulés des signalements du jeu de démonstration.
 *
 * La distinction que ces tests gardent : le champ porte la saisie du locataire
 * dans le produit réel — et une saisie ne se traduit jamais —, mais ces cinq
 * lignes ne sont la saisie de personne. Les laisser en français montrait du
 * français dans la démonstration anglaise ; les écrire en anglais aurait
 * produit le défaut en miroir.
 */
describe('signalements de démonstration', () => {
  it('suit la langue de l’interface', () => {
    renderApp('/app/travaux', { locale: 'en' })
    expect(screen.getByText('Leak under the kitchen sink')).toBeInTheDocument()
  })

  it('reste correct en français, et non anglais en miroir', () => {
    renderApp('/app/travaux')
    expect(screen.getByText('Fuite sous l’évier de la cuisine')).toBeInTheDocument()
  })

  it('ne laisse aucune phrase dans la donnée', () => {
    for (const work of WORKS) {
      expect(work).not.toHaveProperty('title')
      // Une clé, pas une phrase : ni espace ni ponctuation.
      expect(work.titleKey).toMatch(/^[a-zA-Z]+$/)
    }
  })
})

describe('états des lieux', () => {
  it('couvre l’unité du locataire connecté', () => {
    // Aucun état des lieux n'existait sur A1 : en rôle locataire, l'écran
    // affichait toujours son état vide et la fonctionnalité restait invisible.
    renderApp('/app/etats-des-lieux', { locale: 'en' })
    expect(screen.getAllByText(/A1/).length).toBeGreaterThan(0)
  })
})
