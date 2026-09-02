import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { politiqueDeSecurite } from './politiqueDeSecurite.js'

/**
 * LA VITRINE VERCEL PORTE LA MÊME POLITIQUE QUE LE SERVEUR.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══
 *
 * `gestlocpro.vercel.app` sert le paquet client SANS serveur : personne n'y
 * pose d'en-tête. Or c'est une page PUBLIQUE, et la laisser sans politique de
 * sécurité rendrait vrai ce que `politique-de-securite` interdit ailleurs. Elle
 * est donc écrite à la main dans `vercel.json`.
 *
 * ═══ ET UNE POLITIQUE ÉCRITE À LA MAIN SE PÉRIME ═══
 *
 * `script-src` contient l'EMPREINTE du script en ligne de `index.html` — le
 * bascule de thème. Elle se recalcule à chaque fois que ce script change d'un
 * caractère. Figée dans un fichier que rien ne relit, elle finirait par bloquer
 * le script qu'elle est censée autoriser : la vitrine s'afficherait SANS THÈME,
 * ou blanche, sans qu'aucune porte ne le dise.
 *
 * Ce cas recalcule la politique depuis le `index.html` construit, exactement
 * comme le serveur le fait, et refuse si les deux ont divergé. Le message dit
 * quoi recopier.
 *
 * ═══ CE QU'IL NE FAIT PAS ═══
 *
 * Il ne vérifie pas que Vercel APPLIQUE l'en-tête — c'est le déploiement qui en
 * décide, et aucune porte du dépôt n'interroge un hôte tiers. Il vérifie que ce
 * qu'on lui demande d'appliquer est juste.
 */
const RACINE = join(import.meta.dirname, '../..')

describe('la politique de la vitrine', () => {
  it('est celle que le serveur calculerait pour le même document', () => {
    const html = readFileSync(join(RACINE, 'dist/index.html'), 'utf8')
    const attendue = politiqueDeSecurite(html)

    const config = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8')) as {
      headers: { headers: { key: string; value: string }[] }[]
    }
    const posee = config.headers
      .flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value

    expect(
      posee,
      `la politique de \`vercel.json\` a divergé de celle du serveur.\n` +
        `Recopiez celle-ci :\n\n${attendue}\n`,
    ).toBe(attendue)
  })

  it('porte aussi les deux en-têtes que la politique ne couvre pas', () => {
    /* `nosniff` et `Referrer-Policy` sont posés par le serveur à côté de la
       politique, pour des raisons écrites à sa ligne. Une vitrine qui n'aurait
       que la politique serait plus faible que le produit sur deux points que
       personne ne remarquerait. */
    const config = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8')) as {
      headers: { headers: { key: string; value: string }[] }[]
    }
    const poses = new Map(config.headers.flatMap((h) => h.headers).map((h) => [h.key, h.value]))
    expect(poses.get('X-Content-Type-Options')).toBe('nosniff')
    expect(poses.get('Referrer-Policy')).toBe('same-origin')
  })

  it('déclare le MÊME hôte pour la construction et pour les redirections', () => {
    /*
      DEUX MOITIÉS DU MÊME RENVOI, ET ELLES DOIVENT S'ACCORDER.

      Les redirections attrapent une vraie requête — une adresse tapée, un
      rafraîchissement. `VITE_HOTE_APPLICATIF` attrape la navigation CLIENT, que
      React Router fait sans jamais toucher le bord : sans elle, cliquer « Se
      connecter » sur la vitrine rendait le formulaire, sur un hôte sans API.

      Si les deux désignaient des hôtes différents, un visiteur irait à un
      endroit en cliquant et à un autre en rafraîchissant — le pire des deux
      mondes, et rien ne le dirait.
    */
    const config = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8')) as {
      build: { env: Record<string, string> }
      redirects: { destination: string }[]
    }
    const hote = config.build.env.VITE_HOTE_APPLICATIF
    expect(hote, 'sans lui, la navigation client rend des écrans morts').toMatch(/^https:\/\//)
    for (const r of config.redirects) {
      expect(
        r.destination.startsWith(hote!),
        `la redirection vers ${r.destination} ne vise pas l’hôte déclaré à la construction`,
      ).toBe(true)
    }
  })

  it('n’envoie ni l’API ni les assets dans la réécriture du SPA', () => {
    /* La réécriture renvoie tout vers `index.html` pour que React Router tienne
       ses routes. Deux exceptions, et elles sont mesurées : un `/api/…` réécrit
       rendrait du HTML en 200 là où le client attend du JSON — bien pire qu'un
       404, que la vitrine encaisse déjà sans rien afficher de faux. */
    const config = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8')) as {
      rewrites: { source: string }[]
    }
    const source = config.rewrites[0]!.source
    const motif = new RegExp('^' + source.replace(/^\//, '/') + '$')
    expect(motif.test('/demo/parc'), 'une route du SPA doit être réécrite').toBe(true)
    expect(motif.test('/api/auth/me'), 'l’API ne doit jamais rendre du HTML').toBe(false)
    expect(motif.test('/assets/index-abc.js'), 'un asset se sert tel quel').toBe(false)
  })
})
