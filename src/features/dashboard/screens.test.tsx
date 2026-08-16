import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'
import { UNITS } from '@/data/portfolio'

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

describe('états des lieux', () => {
  it('couvre l’unité du locataire connecté', () => {
    // Aucun état des lieux n'existait sur A1 : en rôle locataire, l'écran
    // affichait toujours son état vide et la fonctionnalité restait invisible.
    renderApp('/app/etats-des-lieux', { locale: 'en' })
    expect(screen.getAllByText(/A1/).length).toBeGreaterThan(0)
  })
})
