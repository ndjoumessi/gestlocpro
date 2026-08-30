import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * LE FAVICON ET LA MARQUE SONT LE MÊME SIGNE, DANS DEUX FICHIERS.
 *
 * `public/logo.svg` est servi comme une ressource STATIQUE : il ne passe pas par
 * la feuille de style et ne peut donc pas lire `--color-accent`. Ses couleurs
 * sont écrites en clair, et c'est le seul endroit du dépôt où c'est justifié.
 *
 * Le prix est une TRIPLICATION : le signe vit dans `Logo.tsx`, ses couleurs dans
 * `tokens.css`, et le favicon recopie les deux. Rien ne les relie, rien ne
 * rougit si l'un bouge — c'est exactement la forme du défaut que ce fichier
 * remplace : le favicon peignait encore l'or `#C58E3E` plusieurs teintes après
 * son retrait, et il était le DERNIER endroit du dépôt où cet or existait
 * ailleurs que dans un commentaire.
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * Que les couleurs du favicon soient celles des jetons, et que son signe soit
 * celui du composant — quatre carrés, mêmes opacités, dans le même ordre. Ce
 * sont les deux façons dont ces fichiers peuvent diverger sans que rien ne se
 * casse : une marque redessinée d'un côté, un accent déplacé de l'autre.
 *
 * ═══ CE QU'ILS NE TIENNENT PAS ═══
 *
 * La géométrie. Que les carrés soient à la bonne place et à la bonne taille se
 * lit à l'œil, pas ici : comparer des nombres entre deux systèmes de coordonnées
 * — 24 unités dans le composant, 32 dans le favicon — reviendrait à réécrire la
 * conversion dans le test, donc à la vérifier contre elle-même.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..', '..')

/* La validité XML de ces fichiers est tenue par `svgAnalysable.test.ts`, du
   côté jsdom : la vérifier demande un DOM, que ce projet-ci n'a pas. */
const favicon = readFileSync(join(RACINE, 'public', 'logo.svg'), 'utf8')
const icone = readFileSync(join(RACINE, 'scripts', 'icone-app.mjs'), 'utf8')
const marque = readFileSync(join(RACINE, 'src', 'components', 'primitives', 'Logo.tsx'), 'utf8')
const jetons = readFileSync(join(ICI, 'tokens.css'), 'utf8')

/** Les commentaires ont le droit de citer les couleurs qu'ils racontent. */
const sansCommentaires = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

/** La valeur d'un jeton, lue dans le bloc clair — le premier du fichier. */
function jeton(nom: string): string {
  const trouve = new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{3,8})`).exec(jetons)
  expect(trouve, `le jeton --color-${nom} est introuvable`).not.toBeNull()
  return trouve![1]!.toLowerCase()
}

/**
 * Les opacités des carrés, dans l'ordre du document — `1` quand l'attribut est
 * absent, ce qui est sa valeur par défaut.
 *
 * ON EXTRAIT LA BALISE D'ABORD, L'ATTRIBUT ENSUITE, et une garde du garde l'a
 * imposé. La première rédaction cherchait les deux d'un coup —
 * `/<rect[^>]*?(?:opacity="([^"]*)")?[^>]*\/>/` — dont le groupe OPTIONNEL est
 * précédé d'un quantificateur paresseux : le moteur le saute systématiquement et
 * laisse `[^>]*` avaler l'attribut. Toutes les opacités rendaient `1`, les deux
 * premiers cas comparaient une liste uniforme à une autre et passaient au vert.
 * C'est le troisième cas, qui exige que les valeurs DIFFÈRENT, qui l'a dit.
 */
function opacites(source: string): string[] {
  return [...sansCommentaires(source).matchAll(/<rect\b[^>]*>/g)].map((balise) => {
    const trouve = /opacity="([^"]*)"/.exec(balise[0])
    return trouve ? trouve[1]! : '1'
  })
}

describe('le favicon', () => {
  it('peint l’accent des jetons, et rien d’autre', () => {
    const propre = sansCommentaires(favicon)
    const couleurs = [...propre.matchAll(/fill="(#[0-9a-fA-F]{3,8})"/g)].map((m) =>
      m[1]!.toLowerCase(),
    )

    expect(couleurs, 'le favicon ne peint plus rien').not.toHaveLength(0)
    expect(new Set(couleurs)).toEqual(new Set([jeton('accent'), jeton('on-accent')]))
  })

  it('porte le même signe que la marque de l’application', () => {
    /* Le fond du favicon est un `<rect>` de plus : le composant, lui, tient ce
       fond dans une classe. On compare donc les QUATRE derniers. */
    const duFavicon = opacites(favicon).slice(-4)
    const duComposant = opacites(marque).slice(-4)

    expect(duComposant, 'la marque du composant ne rend plus quatre carrés').toHaveLength(4)
    expect(duFavicon, 'le favicon ne rend plus quatre carrés').toHaveLength(4)
    expect(duFavicon).toEqual(duComposant)
  })

  /*
    GARDE DU GARDE — les opacités doivent DIRE quelque chose.

    Si les quatre valaient 1, les deux cas ci-dessus passeraient au vert en
    comparant une liste uniforme à une autre. Or c'est la décroissance qui porte
    la moitié du sens du signe — « états différents ». Un signe qui ne dit plus
    que « plusieurs logements » n'est pas celui qui a été retenu.
  */
  it('garde des états distincts, sans quoi la comparaison ne compare rien', () => {
    expect(new Set(opacites(favicon).slice(-4)).size).toBeGreaterThan(1)
  })
})

/**
 * L'ICÔNE D'ACCUEIL PART DU MÊME TRACÉ.
 *
 * Elle est produite par un script plutôt que déposée en binaire : un fichier
 * d'image commité ne dit ni d'où il vient, ni s'il a suivi la marque. Le script
 * porte les mêmes valeurs, et ce cas les compare — sans quoi l'icône de l'écran
 * d'accueil pourrait garder l'ancien signe pendant des mois sans que personne ne
 * l'ouvre.
 */
describe('l’icône d’accueil', () => {
  it('peint l’accent des jetons', () => {
    /* Bornée aux DEUX CONSTANTES NOMMÉES, et une mesure l'a imposé : une
       première rédaction cherchait n'importe quel triplet `0x..` et attrapait la
       signature PNG du script, qui en est un. Une garde qui ratisse large ne
       trouve pas plus, elle trouve autre chose. */
    const couleurs = [
      ...sansCommentaires(icone).matchAll(
        /const (?:SUR_)?ACCENT = \[0x([0-9a-f]{2}), 0x([0-9a-f]{2}), 0x([0-9a-f]{2})\]/g,
      ),
    ].map((m) => `#${m[1]}${m[2]}${m[3]}`)
    expect(couleurs, 'le script ne peint plus rien').not.toHaveLength(0)
    expect(new Set(couleurs)).toEqual(new Set([jeton('accent'), jeton('on-accent')]))
  })

  it('porte les mêmes opacités que la marque', () => {
    const duScript = [...sansCommentaires(icone).matchAll(/opacite:\s*([0-9.]+)/g)].map((m) =>
      String(Number(m[1])),
    )
    const duComposant = opacites(marque)
      .slice(-4)
      .map((o) => String(Number(o)))
    expect(duScript).toEqual(duComposant)
  })
})


/**
 * LE MANIFESTE NE CITE QUE CE QUI EXISTE, ET LES COULEURS DES JETONS.
 *
 * ═══ DEUX RECOPIES DE PLUS, DONC DEUX FAÇONS DE DIVERGER ═══
 *
 * `public/manifest.webmanifest` et les métas `theme-color` d'`index.html` sont
 * lus par le SYSTÈME, avant toute feuille de style : ils ne peuvent lire aucun
 * jeton, et leurs couleurs sont donc écrites en clair. C'est le même prix que
 * `logo.svg` paie déjà, et il se garde de la même façon.
 *
 * ═══ CELUI QUI COMPTE VRAIMENT EST LE SECOND ═══
 *
 * Un manifeste qui cite `/icone-256.png` quand le générateur produit 192, 512 et
 * 1024 ne casse RIEN de visible : la page se charge, l'application s'installe, et
 * l'icône est celle que le système a pu trouver — ou une capture de la page. Le
 * défaut ne se voit que sur l'écran d'accueil de quelqu'un d'autre, des semaines
 * plus tard. On confronte donc la liste du manifeste à `COTES`, la constante du
 * générateur, ET aux fichiers réellement présents dans `public/`.
 */
describe('le manifeste', () => {
  const manifeste = JSON.parse(
    readFileSync(join(RACINE, 'public', 'manifest.webmanifest'), 'utf8'),
  ) as {
    id: string
    background_color: string
    theme_color: string
    icons: { src: string; sizes: string }[]
  }
  const page = readFileSync(join(RACINE, 'index.html'), 'utf8')

  /**
   * L'IDENTITÉ DE L'APPLICATION INSTALLÉE, ET POURQUOI CE CAS EST UN VERROU.
   *
   * `id` est ce qui, pour Android, DÉSIGNE cette application. Sans lui,
   * l'identité se déduit de `start_url` : changer `/` un jour ferait de toutes
   * les installations existantes une AUTRE application — l'icône sur l'écran
   * d'accueil cesserait de recevoir les mises à jour, et une seconde icône
   * apparaîtrait à côté. Personne ne verrait rien du côté du dépôt.
   *
   * Ce cas ne vérifie donc pas que `id` existe : il le FIGE. La valeur est
   * écrite ici en toutes lettres, et la changer demande de changer ce test —
   * donc de lire cette phrase. C'est le seul champ du manifeste dont la
   * modification casse quelque chose chez quelqu'un d'autre, silencieusement.
   */
  it('porte une identité, et c’est la même qu’hier', () => {
    expect(
      manifeste.id,
      'le manifeste a perdu son `id` : les installations existantes deviendraient ' +
        'une autre application au premier changement de `start_url`',
    ).toBe('/')
  })

  it('peint le fond de la zone principale, dans les deux thèmes', () => {
    /* `jeton()` lit le bloc clair — le premier du fichier. Le sombre est la
       SECONDE occurrence, celle de `@media (prefers-color-scheme: dark)`. */
    const toutes = [...jetons.matchAll(/--color-paper:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) =>
      m[1]!.toLowerCase(),
    )
    expect(toutes.length, 'le jeton --color-paper est introuvable').toBeGreaterThanOrEqual(2)
    const [clair, sombre] = toutes

    expect(manifeste.background_color.toLowerCase()).toBe(clair)
    expect(manifeste.theme_color.toLowerCase()).toBe(clair)

    const metas = [...page.matchAll(/<meta name="theme-color"[^>]*content="(#[0-9a-fA-F]{3,8})"/g)]
      .map((m) => m[1]!.toLowerCase())
    expect(metas, 'les deux métas `theme-color` d’`index.html`').toEqual([clair, sombre])
  })

  it('ne cite que des icônes que le générateur rend et que `public/` porte', () => {
    const rendues = /const COTES = \[([^\]]+)\]/
      .exec(sansCommentaires(icone))?.[1]
      ?.split(',')
      .map((n) => n.trim())
    expect(rendues, '`COTES` est introuvable dans le générateur').toBeDefined()

    for (const { src, sizes } of manifeste.icons) {
      const cote = /^(\d+)x\1$/.exec(sizes)?.[1]
      expect(cote, `\`sizes\` malformé pour ${src}`).toBeDefined()
      expect(rendues, `le manifeste cite ${sizes}, que \`icone-app.mjs\` ne rend pas`).toContain(
        cote,
      )
      expect(src, 'le nom du fichier doit suivre sa taille').toBe(`/icone-${cote}.png`)
      expect(
        existsSync(join(RACINE, 'public', src.slice(1))),
        `${src} est cité par le manifeste mais absent de public/ — relancez \`node scripts/icone-app.mjs\``,
      ).toBe(true)
    }
  })
})
