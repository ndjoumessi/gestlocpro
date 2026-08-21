import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { renderApp, screen } from '@/test/render'

/**
 * UNE CASE À COCHER QUI NE COMMANDE RIEN.
 *
 * « Rester connecté sur cet appareil » vivait sous le mot de passe de l'écran de
 * connexion, cochable, et rien ne la lisait : ni état, ni `onChange`, et
 * `connecter` ne prend que l'adresse et le mot de passe. `grep -rn "remember"
 * src/` rendait trois lignes — le composant et ses deux traductions. La case
 * promettait donc une durée de session que personne n'avait écrite, à l'endroit
 * précis où l'on décide de confier son mot de passe à un produit.
 *
 * Ce garde ne dit pas « pas de case ici » : il dit qu'une case du formulaire doit
 * être COMMANDÉE. Le jour où la session longue existera, la case pourra revenir —
 * avec son `checked` et son `onChange`, donc avec quelque chose qui la lit.
 *
 * On interroge les propriétés de REACT et non l'attribut du DOM, et c'est le
 * point du fichier : le DOM ne distingue pas une case contrôlée d'une case libre.
 * Les deux se cochent au clic, les deux portent `checked` après. Seul le rendu
 * sait laquelle des deux a été demandée.
 */
function proprietesReact(noeud: Element): Record<string, unknown> | null {
  const cle = Object.keys(noeud).find((k) => k.startsWith('__reactProps$'))
  if (!cle) return null
  return (noeud as unknown as Record<string, Record<string, unknown>>)[cle] ?? null
}

describe('connexion — aucune case qui ne commande rien', () => {
  it('n’offre que des cases dont l’état est lu', () => {
    renderApp('/connexion')

    const formulaire = screen.getByRole('button', { name: 'Se connecter' }).closest('form')
    expect(formulaire).not.toBeNull()

    const cases = Array.from(
      formulaire!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    )

    for (const boite of cases) {
      // Le nom accessible situe la case fautive dans le message d'échec : « une
      // case sans état » enverrait chercher dans tout le formulaire.
      const nom = boite.labels?.[0]?.textContent?.trim() || boite.name
      const props = proprietesReact(boite)
      expect(props, nom).not.toBeNull()
      expect(props!.checked, nom).toBeDefined()
      expect(props!.onChange, nom).toBeDefined()
    }
  })

  /**
   * LE CAS POSITIF, sans lequel le précédent ne garde rien.
   *
   * Le formulaire ne porte plus aucune case : la boucle ci-dessus ne s'exécute
   * pas, et réussirait quoi qu'on y remette si la détection venait à casser. On
   * éprouve donc `proprietesReact` sur une case libre montée à la main. Le jour
   * où React cessera d'attacher ses propriétés au nœud — renommage interne,
   * changement de version — ce cas tombera, bruyamment, au lieu de laisser le
   * garde s'éteindre en silence.
   *
   * La leçon vient de `vitrineHorsDemo` : une assertion en négatif ne se vérifie
   * pas toute seule, il lui faut son pendant.
   */
  it('sait reconnaître une case libre, faute de quoi il ne garderait rien', () => {
    render(<input type="checkbox" name="leurre" />)
    const props = proprietesReact(screen.getByRole('checkbox'))
    expect(props).not.toBeNull()
    expect(props!.checked).toBeUndefined()
  })
})
