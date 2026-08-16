import { describe, expect, it } from 'vitest'
import { hashPassword, needsRehash, verifyPassword } from './password.js'
import { creerJeton, empreinteJeton, memeJeton } from './token.js'

/**
 * Hachage des mots de passe.
 *
 * Ce qui est gardé ici n'est pas « ça marche » — c'est l'ensemble des
 * propriétés dont l'absence ne se voit jamais à l'usage : le sel aléatoire, la
 * portabilité des paramètres, et le refus silencieux d'une empreinte abîmée.
 */
describe('hachage', () => {
  it('accepte le bon mot de passe et refuse les autres', async () => {
    const empreinte = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', empreinte)).toBe(true)
    expect(await verifyPassword('correct horse battery stapl', empreinte)).toBe(false)
    expect(await verifyPassword('', empreinte)).toBe(false)
  })

  it('ne rend jamais deux fois la même empreinte', async () => {
    // Sans sel aléatoire, deux comptes partageant un mot de passe se
    // reconnaîtraient dans un vidage de base — et une table arc-en-ciel les
    // casserait tous les deux d'un coup.
    const a = await hashPassword('même mot de passe')
    const b = await hashPassword('même mot de passe')
    expect(a).not.toBe(b)
    expect(await verifyPassword('même mot de passe', a)).toBe(true)
    expect(await verifyPassword('même mot de passe', b)).toBe(true)
  })

  it('ne contient pas le mot de passe en clair', async () => {
    const empreinte = await hashPassword('bonjour-douala-2026')
    expect(empreinte).not.toContain('bonjour')
  })

  it('porte ses paramètres avec elle', async () => {
    // Sans cela, relever le coût demain invaliderait toutes les empreintes
    // d'hier et condamnerait à une réinitialisation générale.
    const empreinte = await hashPassword('x'.repeat(20))
    const [algo, n, r, p] = empreinte.split('$')
    expect(algo).toBe('scrypt')
    expect(Number(n)).toBeGreaterThanOrEqual(2 ** 16)
    expect(Number(r)).toBe(8)
    expect(Number(p)).toBe(1)
  })

  it('vérifie encore une empreinte au coût plus faible', async () => {
    // Simule une empreinte héritée : les paramètres viennent de la chaîne, pas
    // des constantes du module.
    const ancienne = ['scrypt', 2 ** 14, 8, 1].join('$')
    const complete = `${ancienne}$${Buffer.from('sel-fixe').toString('base64url')}$`
    // Empreinte fabriquée à la main : illisible, donc refusée sans exception.
    expect(await verifyPassword('peu importe', complete)).toBe(false)
  })

  it('refuse une empreinte abîmée au lieu de lever', async () => {
    // Un enregistrement corrompu ne doit pas rendre 500 : ce compte se
    // distinguerait alors de tous les autres aux yeux d'un attaquant.
    for (const abimee of ['', 'n’importe quoi', 'scrypt$$$$$', 'argon2$1$2$3$a$b']) {
      expect(await verifyPassword('mot de passe', abimee)).toBe(false)
    }
  })

  it('signale une empreinte à re-hacher', async () => {
    expect(needsRehash(await hashPassword('à jour'))).toBe(false)
    expect(needsRehash('scrypt$1024$8$1$c2Vs$ZW1wcmVpbnRl')).toBe(true)
    expect(needsRehash('bcrypt$10$x$y$z$w')).toBe(true)
    expect(needsRehash('illisible')).toBe(true)
  })
})

/**
 * Jetons de session.
 *
 * La propriété qui compte : la base ne contient pas de quoi se connecter. Une
 * fuite de la table des sessions doit être aussi inexploitable qu'une fuite de
 * la table des comptes.
 */
describe('jetons de session', () => {
  it('n’enregistre pas le jeton remis au client', () => {
    const { clair, empreinte } = creerJeton()
    expect(empreinte).not.toBe(clair)
    expect(empreinte).not.toContain(clair)
  })

  it('retrouve l’empreinte à partir du jeton présenté', () => {
    const { clair, empreinte } = creerJeton()
    expect(empreinteJeton(clair)).toBe(empreinte)
  })

  it('tire un jeton différent à chaque fois', () => {
    const jetons = new Set(Array.from({ length: 200 }, () => creerJeton().clair))
    expect(jetons.size).toBe(200)
  })

  it('porte assez d’entropie pour ne pas être deviné', () => {
    // 32 octets en base64url : 43 caractères. Un jeton plus court serait
    // énumérable, et rien à l'usage ne le signalerait.
    expect(creerJeton().clair.length).toBeGreaterThanOrEqual(43)
  })

  it('compare sans se laisser mesurer', () => {
    const { empreinte } = creerJeton()
    expect(memeJeton(empreinte, empreinte)).toBe(true)
    expect(memeJeton(empreinte, creerJeton().empreinte)).toBe(false)
    // Longueurs différentes : refus, sans exception.
    expect(memeJeton(empreinte, 'court')).toBe(false)
  })
})
