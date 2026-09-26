import { describe, expect, it } from 'vitest'
import { SESSION_ANONYME, renderApp, screen, userEvent } from '@/test/render'

/**
 * UN REFUS SE LIT ; UN BOUTON ÉTEINT NE DIT RIEN.
 *
 * ═══ CE QUE LA PREMIÈRE ÉTAPE MONTRAIT ═══
 *
 * « Continuer » en bleu pâle, désactivé tant qu'aucun rôle n'est choisi, et pas
 * un mot pour dire ce qui manque. Trois défauts sous une seule décision :
 *
 *   · un primaire éteint ressemble à un CHARGEMENT — c'est la même pâleur ;
 *   · il ne prend pas le focus, donc au clavier on l'atteint et on ne
 *     comprend pas pourquoi rien ne se passe — ou on ne l'atteint pas du tout ;
 *   · il n'énonce RIEN. Un bouton désactivé est une porte fermée sans écriteau.
 *
 * ═══ LA MAISON A DÉJÀ TRANCHÉ CE CAS ═══
 *
 * `goNext` porte un commentaire qui raconte l'incident : « un bouton principal
 * qui paraît inerte est la pire des pannes : il n'y a rien à lire, donc rien à
 * corriger ». La machinerie existe — le refus cherche le premier champ fautif,
 * l'amène à l'écran et lui donne le focus — et cette étape-ci en était exclue
 * par un `return` posé avant elle.
 *
 * On rend donc le bouton CLIQUABLE et le refus LISIBLE, au groupe de rôles.
 */
describe('le refus de la première étape', () => {
  it('se lit au lieu d’éteindre le bouton', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/inscription')

    const continuer = await screen.findByRole('button', { name: /Continuer/ })
    expect(continuer, 'le bouton est encore éteint').toBeEnabled()

    await utilisateur.click(continuer)

    /* `findAllByRole` : le formulaire annonce aussi le pas franchi — « étape 1
       sur 4 » — par une région vivante. On cherche CE refus-ci, pas le seul
       message de la page. */
    const alertes = await screen.findAllByRole('alert')
    expect(
      alertes.some((a) => /rôle/i.test(a.textContent ?? '')),
      'le refus ne s’écrit nulle part',
    ).toBe(true)
  })

  /**
   * ═══ LE REFUS SE LISAIT, MAIS LE FOCUS NE SUIVAIT PAS ═══
   *
   * `goNext` cherche le champ fautif par `[data-champ="…"], [name="…"]` et lui
   * donne le focus. Sur cette étape, le premier élément que ce sélecteur trouve
   * est le `<fieldset data-champ="role">` — et un `fieldset` sans `tabindex` NE
   * PREND PAS LE FOCUS. L'appel ne faisait donc rien, en silence : relevé au
   * navigateur, `document.activeElement` restait le bouton « Continuer ».
   *
   * C'est exactement le défaut que `goNext` documente pour `[name="pays"]`,
   * deux commentaires plus haut : un sélecteur qui désigne quelque chose
   * d'infocalisable échoue sans rien dire. La correction d'alors visait le
   * champ VISIBLE ; celle-ci vise ce qui est FOCALISABLE, et les groupes de
   * choix sont le cas que la première ne couvrait pas.
   *
   * CE QUE CELA COÛTE À QUI NAVIGUE AU CLAVIER : le refus est annoncé — la
   * région vivante s'en charge — mais le curseur reste sur le bouton, à dix
   * tabulations du groupe qu'il faut corriger, et au-dessus de lui. Il faut
   * revenir en ARRIÈRE dans l'ordre de tabulation pour atteindre ce que le
   * message demande de faire.
   */
  it('donne le focus au groupe fautif, et non au bouton', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/inscription')

    const continuer = await screen.findByRole('button', { name: /Continuer/ })
    await utilisateur.click(continuer)
    await screen.findAllByRole('alert')

    const actif = document.activeElement
    expect(actif, 'le focus est resté sur le bouton refusé').not.toBe(continuer)

    /* On n'exige pas UNE balise : ce qui compte est que le focus ait atterri
       DANS le groupe de rôles, sur quelque chose qui peut le recevoir. Exiger
       le premier bouton radio figerait une implémentation de `Choice`. */
    const groupe = document.querySelector('[data-champ="role"]')
    expect(groupe, 'le groupe de rôles a perdu son marqueur').not.toBeNull()
    expect(
      groupe!.contains(actif),
      'le focus n’est pas dans le groupe de rôles',
    ).toBe(true)
  })

  /**
   * LE CONTREPOIDS. Un rôle choisi, on passe.
   *
   * Un refus qui ne se lève jamais serait pire que le bouton éteint : la
   * première étape deviendrait un mur.
   */
  it('laisse passer dès qu’un rôle est choisi', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/inscription')

    await utilisateur.click(await screen.findByRole('radio', { name: /Propriétaire/ }))
    await utilisateur.click(screen.getByRole('button', { name: /Continuer/ }))

    expect(await screen.findByRole('heading', { name: /Votre identité/ })).toBeInTheDocument()
  })
})

/**
 * « MOT DE PASSE OUBLIÉ ? » APPARTIENT À SON CHAMP.
 *
 * Il flottait seul sur une ligne, aligné à droite, ENTRE le champ et le bouton
 * d'envoi : à mi-chemin des deux, il n'appartenait visiblement ni à l'un ni à
 * l'autre, et il séparait le dernier champ de l'action qui le suit — la seule
 * paire que l'œil doit lire d'un trait.
 *
 * Sa place est la ligne d'ÉTIQUETTE du champ, à droite du libellé : c'est là
 * qu'un lecteur le cherche, et c'est là qu'il désigne sans ambiguïté le mot de
 * passe dont il parle.
 */
describe('le lien de mot de passe oublié', () => {
  it('vit dans l’étiquette de son champ, pas entre le champ et l’action', async () => {
    await renderApp('/connexion', { session: SESSION_ANONYME })

    const lien = await screen.findByRole('link', { name: /Mot de passe oublié/ })
    const champ = await screen.findByLabelText(/Mot de passe/)

    /* LA RANGÉE D'ÉTIQUETTE, et pas seulement « quelque part dans le champ » :
       on prend l'étiquette liée à l'entrée par son `for`, et l'on exige que le
       lien soit son voisin immédiat. Viser un ancêtre plus lâche laisserait
       passer le lien posé n'importe où dans le formulaire — c'est-à-dire le
       défaut qu'on corrige. */
    const etiquette = document.querySelector(`label[for="${champ.id}"]`)
    expect(etiquette, 'le champ n’a pas d’étiquette liée').not.toBeNull()
    expect(
      etiquette!.parentElement!.contains(lien),
      'le lien flotte encore hors de la rangée d’étiquette',
    ).toBe(true)
    expect(lien).toBeVisible()
  })
})
