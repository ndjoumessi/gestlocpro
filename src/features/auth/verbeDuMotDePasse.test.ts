import { describe, expect, it } from 'vitest'
import { validatePassword } from './validation'

/**
 * ON NE « CHOISIT » UN MOT DE PASSE QUE QUAND ON EN CRÉE UN.
 *
 * Le message du champ vide était unique — « Choisissez un mot de passe. » — et
 * servait les trois écrans qui portent un champ de mot de passe. Il était donc
 * juste à l'inscription et à la réinitialisation, où l'on en crée un, et FAUX à
 * la connexion, où l'on saisit celui qu'on a. C'est l'écran le plus ouvert des
 * trois, et s'y entendre dire « choisissez » évoque une création de compte au
 * moment précis où l'on cherche à rentrer chez soi.
 *
 * ═══ CE QUE CE FICHIER GARDE ═══
 *
 * Que les deux actes ne retombent jamais sur la même clé. C'est une régression
 * facile et silencieuse : fusionner deux messages voisins ressemble à un
 * rangement, l'écran continue d'afficher une phrase française correcte, et rien
 * ne rougit — c'est exactement ainsi que l'état précédent était né.
 *
 * On ne cite AUCUNE traduction : les clés suffisent, et exiger les mots
 * reviendrait à figer une rédaction qu'on doit pouvoir reprendre.
 */
describe('le verbe du champ vide', () => {
  it('distingue créer de saisir', () => {
    const creation = validatePassword('', { requireStrong: true })
    const connexion = validatePassword('')

    expect(creation).toBe('auth.errors.passwordChoose')
    expect(connexion).toBe('auth.errors.passwordEnter')
    expect(creation, 'les deux actes retombent sur le même message').not.toBe(connexion)
  })

  /*
    LA DISTINCTION NE VAUT QUE POUR LE CHAMP VIDE.

    Un mot de passe trop court n'est refusé qu'à la création — la connexion
    accepte n'importe quelle longueur non vide, puisqu'elle doit accepter le mot
    de passe qui existe déjà, si mauvais soit-il. Sans ce cas, on pourrait
    « corriger » la connexion en lui imposant le seuil et croire l'avoir
    améliorée : on aurait enfermé dehors tous les comptes plus anciens que la
    règle.
  */
  it('ne juge la longueur qu’à la création', () => {
    expect(validatePassword('court', { requireStrong: true })).toBe('auth.errors.passwordShort')
    expect(validatePassword('court')).toBeNull()
  })
})
