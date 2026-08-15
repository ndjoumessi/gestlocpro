import { describe, expect, it } from 'vitest'
import {
  formatInviteCode,
  validateEmail,
  validateInviteCode,
  validateName,
  validatePassword,
  validatePhone,
  scorePassword,
} from './validation'

describe('mise en forme du code d’invitation', () => {
  it('regroupe une saisie complète', () => {
    expect(formatInviteCode('loc4a7b92cd')).toBe('LOC-4A7B-92CD')
  })

  it('reste stable frappe après frappe', () => {
    // Le défaut d'origine : le formateur ajoutait « LOC- » puis le reconsommait
    // comme saisie au caractère suivant, donnant « LOC-LOC4-A7B9 ». Poser la
    // valeur entière d'un coup ne le révélait pas — seule la frappe caractère
    // par caractère, celle d'un utilisateur réel, le fait apparaître.
    let valeur = ''
    for (const caractere of 'loc4a7b92cd') {
      valeur = formatInviteCode(valeur + caractere)
    }
    expect(valeur).toBe('LOC-4A7B-92CD')
  })

  it('est idempotente', () => {
    const une = formatInviteCode('loc4a7b92cd')
    expect(formatInviteCode(une)).toBe(une)
  })

  it('ignore ce que l’utilisateur colle en trop', () => {
    expect(formatInviteCode('LOC-4A7B-92CD-XXXX')).toBe('LOC-4A7B-92CD')
  })

  it('accepte un collage déjà ponctué', () => {
    expect(formatInviteCode('loc 4a7b 92cd')).toBe('LOC-4A7B-92CD')
  })
})

describe('validation du code d’invitation', () => {
  it('accepte le format attendu', () => {
    expect(validateInviteCode('LOC-4A7B-92CD')).toBeNull()
  })

  it('refuse un code incomplet en renvoyant une clé de message', () => {
    // Les validateurs renvoient une CLÉ et non une chaîne : une erreur déjà
    // affichée change de langue avec le reste de l'interface.
    expect(validateInviteCode('LOC-12')).toBe('auth.errors.inviteInvalid')
    expect(validateInviteCode('')).toBe('auth.errors.inviteRequired')
  })
})

describe('adresse e-mail', () => {
  it.each(['sarah@example.com', 'a.b+c@sous.domaine.fr'])('accepte %s', (valeur) => {
    expect(validateEmail(valeur)).toBeNull()
  })

  it.each(['', 'sarah@', '@example.com', 'sarah example.com'])('refuse « %s »', (valeur) => {
    expect(validateEmail(valeur)).not.toBeNull()
  })
})

describe('téléphone et nom', () => {
  it('refuse un numéro trop court mais accepte les séparateurs', () => {
    expect(validatePhone('677 88 99 00')).toBeNull()
    expect(validatePhone('12')).toBe('auth.errors.phoneInvalid')
    expect(validatePhone('')).toBe('auth.errors.phoneRequired')
  })

  it('refuse un nom d’une seule lettre', () => {
    expect(validateName('Arsène Nkomo')).toBeNull()
    expect(validateName('A')).toBe('auth.errors.nameRequired')
  })
})

describe('mot de passe', () => {
  it('n’exige une longueur minimale qu’à la création', () => {
    // À la connexion, refuser un mot de passe court renseignerait sur la règle
    // en vigueur sans rien protéger : le compte existe déjà.
    expect(validatePassword('court')).toBeNull()
    expect(validatePassword('court', { requireStrong: true })).toBe('auth.errors.passwordShort')
  })

  it('note la robustesse de façon croissante', () => {
    expect(scorePassword('abc')).toBe(0)
    expect(scorePassword('abcdefgh')).toBeGreaterThan(0)
    expect(scorePassword('Bonamoussadi2026!')).toBe(3)
  })
})
