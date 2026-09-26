import { describe, expect, it } from 'vitest'
import ROUTES_DU_SERVEUR from '../../server/src/auth/routes.ts?raw'
import { renderApp, screen } from '@/test/render'
import { DUREE_DU_LIEN_MINUTES } from '@/legal/reinitialisation'

/**
 * LA DURÉE D'UN LIEN DE RÉINITIALISATION, PROMISE ET TENUE.
 *
 * ═══ CE QUE CE CAS GARDE ═══
 *
 * « une heure » était écrit en toutes lettres à quatre endroits des
 * dictionnaires, et la durée réelle vivait dans `DUREE_REINITIALISATION_MS`,
 * côté serveur. Rien ne reliait les deux : une durée ramenée à trente minutes
 * pour de bonnes raisons de sécurité aurait laissé quatre phrases promettre le
 * double, dans les deux langues, sur l'écran qu'on ouvre quand on ne peut plus
 * entrer chez soi.
 *
 * Le dépôt tient déjà ce contrat pour le délai d'effacement des comptes —
 * `conditionsGenerales.test.tsx` lit la source du serveur pour que la
 * divergence rougisse. Une promesse faite sur l'écran d'un mot de passe oublié
 * n'engage pas moins qu'une ligne de conditions générales ; elle est seulement
 * lue par plus de monde.
 *
 * LU, JAMAIS RECOPIÉ. Le client ne peut pas importer le serveur — deux paquets,
 * deux compilations —, donc la constante est dupliquée ; ce fichier est le seul
 * endroit où les deux se regardent. La source est lue par `?raw` et non par
 * `node:fs` : ce fichier MONTE des pages, il lui faut les types du DOM.
 */
describe('la durée du lien de réinitialisation', () => {
  it('est celle que le serveur applique', async () => {
    /* `60 * 60 * 1000` : l'expression telle que le serveur l'écrit. On lit les
       DEUX facteurs plutôt que le produit — recopier « 3600000 » dans cette
       expression régulière la rendrait aveugle à la seule réécriture probable,
       celle qui change le nombre de minutes. */
    const trouve = /DUREE_REINITIALISATION_MS\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*1000/.exec(
      ROUTES_DU_SERVEUR,
    )
    expect(trouve, 'la constante du serveur est introuvable').toBeTruthy()

    const minutesDuServeur = (Number(trouve![1]) * Number(trouve![2])) / 60
    expect(DUREE_DU_LIEN_MINUTES).toBe(minutesDuServeur)
  })

  it('se dit sur l’écran qu’on garde ouvert en attendant le courriel', async () => {
    await renderApp('/mot-de-passe-oublie')

    /* AVANT L'ENVOI, le sous-titre la porte — c'est l'état d'avant, et il ne
       régresse pas. */
    expect(
      screen.getByText(new RegExp(`${DUREE_DU_LIEN_MINUTES} minutes`)),
      'la durée a disparu de la demande',
    ).toBeInTheDocument()
  })

  it('se dit aussi quand le lien n’est plus valable', async () => {
    /* UN JETON QUI N'EN EST PAS UN : l'écran de refus se rend sur la forme,
       sans aller voir le serveur. C'est le second endroit où la durée était
       écrite en toutes lettres. */
    await renderApp('/reinitialiser?token=pas-un-jeton')

    expect(
      await screen.findByText(new RegExp(`${DUREE_DU_LIEN_MINUTES} minutes`)),
      'le refus ne dit plus au bout de combien de temps un lien expire',
    ).toBeInTheDocument()
  })
})
