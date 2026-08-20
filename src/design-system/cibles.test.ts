import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde du plancher des CIBLES TACTILES.
 *
 * Le dépôt s'est donné 44 px et les honore quarante et une fois. Rien ne les
 * défendait : le lien vers le dossier d'un logement a vécu des lots entiers à
 * 18 × 17 px — la SEULE entrée vers cet écran — et ne s'est découvert qu'en
 * cherchant autre chose. C'est la cinquième fois dans ce dépôt qu'un invariant
 * tenu par la seule relecture se révèle par hasard.
 *
 * Un commentaire ne défend pas une règle. `Button.tsx` porte « min-h-11 = 44px,
 * la cible tactile minimale, sur toutes les tailles » depuis l'origine, et le
 * démenti vivait dans un autre fichier sans que personne le voie.
 *
 * Le contrôle porte sur les SOURCES et non sur le DOM, pour la raison que
 * `plancher.test.ts` et `zonesSures.test.ts` écrivent déjà : jsdom ne calcule
 * aucune hauteur. Monter un composant et interroger sa taille rendue mesurerait
 * jsdom, pas un téléphone. Le fichier est la source de vérité, c'est le fichier
 * qu'on interroge.
 *
 * QUATRE FAÇONS DE SATISFAIRE LA RÈGLE, et la quatrième est nommée :
 *
 *  1. porter un jeton de hauteur suffisant dans sa propre balise ;
 *  2. déléguer sa `className` à un identifiant — le fichier possède alors le
 *     plancher (voir la limite assumée plus bas) ;
 *  3. faire de son conteneur la cible, par un `::after` étendu sur ses bords :
 *     la cellule d'un tableau fait déjà 47 px, et l'y étendre donne une cible
 *     plus grande qu'un jeton de hauteur pour zéro déplacement ;
 *  4. figurer dans `EXEMPTIONS`, avec sa raison écrite.
 *
 * LIMITE ASSUMÉE, la même que `zonesSures.test.ts` : la granularité est celle
 * d'UNE balise ouvrante. Un contrôle qui délègue sa `className` à un identifiant
 * n'est vérifié qu'à l'échelle du fichier — `Button.tsx` tient son plancher
 * trois sauts plus loin, dans `SIZES`, et poursuivre une chaîne d'identifiants
 * coûterait plus que ce que ça garde. Ce qui est pris, et c'est l'essentiel :
 * un fichier de contrôle qui ne mentionne aucun plancher nulle part.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/** 44 px : la cible tactile minimale, en dessous de laquelle le doigt vise. */
const PLANCHER_PX = 44

/** Un pas de l'échelle d'espacement de Tailwind vaut 0.25rem, soit 4 px. */
const PAS_PX = 4

/**
 * 24 px : le seuil BAS de WCAG 2.5.8.
 *
 * En dessous de 44, la norme tolère encore une cible si un cercle de 24 px
 * centré dessus ne rencontre pas celui de sa voisine. C'est ce que peut offrir
 * une grille dense — douze mois sur une carte — quand 44 px reviendrait à
 * renoncer à des mois.
 */
const ESPACEMENT_MIN_PX = 24

/*
  Motifs assemblés par FRAGMENTS.

  Tailwind lit les sources comme du texte, fichiers de test compris, et
  générerait pour de bon toute classe citée ici en clair. Le piège a déjà coûté
  une classe fantôme dans le CSS livré, et `graisses.test.ts` le documente.
*/
const H = ['min', 'h'].join('-')
const HAUTEUR = new RegExp(`\\b(?:${H}|h|size|min-w)-(\\d+(?:\\.\\d+)?)\\b`, 'g')
const HAUTEUR_LIBRE = new RegExp(`\\b(?:${H}|h|size)-\\[([^\\]]+)\\]`, 'g')
const HAUTEUR_JETON = new RegExp(`\\b(?:${H}|h|size)-\\((--[a-z0-9-]+)\\)`, 'g')
const W = ['min', 'w'].join('-')
const LARGEUR = new RegExp(`\\b(?:${W}|w|size)-(\\d+(?:\\.\\d+)?)\\b`, 'g')

/**
 * ÉPINGLÉ SUR LES QUATRE BORDS de son conteneur.
 *
 * Un élément ainsi étendu fait la taille de ce qui le contient : le voile d'une
 * modale couvre la fenêtre, et le `::after` d'un lien couvre sa cellule — qui
 * fait déjà 47 px. Les deux idiomes disent la même chose et se gardent
 * ensemble. Limite assumée : on ne sait pas si le conteneur est grand. Un
 * conteneur minuscule tromperait la règle, mais rien dans ce produit n'épingle
 * une commande sur autre chose qu'une surface.
 */
const RECOUVREMENT = new RegExp(['inset', '0'].join('-'))

/** Un contrôle : ce qui se clique ou se tape, écrit en clair dans le JSX. */
const CONTROLE = /<(button|Link|a)\b/g

/**
 * `className={identifiant}` ou `className={fabrique(…)}` — la balise DÉLÈGUE.
 *
 * `DatePicker` appelle `controlClasses()`, qui vit dans `Field.tsx` et y porte
 * le plancher de tous les champs du produit. La géométrie n'est alors pas
 * l'affaire de la balise, et l'exiger d'elle pousserait à la dupliquer.
 *
 * `cn` EST EXCLU, et cette exclusion est le cœur de la règle. Il ne délègue
 * rien : il fusionne des classes écrites dans la balise même, sous les yeux du
 * lecteur. Le confondre avec une délégation faisait disparaître du rapport la
 * pastille du menu de compte et son `size-9` — trente-six pixels — en la
 * renvoyant à un plancher que le fichier porte AILLEURS. Une règle qui se
 * relâche ainsi ne garde plus que les fichiers, jamais les commandes.
 */
const DELEGUE = new RegExp(`className=\\{\\s*(?!${'cn'}\\b)[A-Za-z_$][\\w$]*\\s*[(}]`)

/* -------------------------------------------------------------------------- */
/* Exemptions                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Les exemptions sont NOMMÉES ET MOTIVÉES.
 *
 * Une liste d'exceptions sans raison écrite devient le tapis sous lequel on
 * glisse le prochain défaut — ce que ce contrôle existe pour empêcher. Chaque
 * entrée se repère par un fragment de sa balise, et non par un numéro de ligne
 * qui dériverait au premier remaniement.
 */
interface Exemption {
  fichier: string
  marqueur: string
  raison: string
  /**
   * LA CONTREPARTIE, quand l'exemption en a une.
   *
   * Une exemption sans condition est un laissez-passer : elle couvre le
   * contrôle entier, pour toujours, quoi qu'il devienne. La barre de graphe l'a
   * montré — sa raison s'était resserrée en prose (« le pas est désormais
   * planché à 24 px ») sans que rien ne tienne le resserrement, et retirer ce
   * plancher ne faisait rougir personne.
   *
   * Avec une contrepartie, l'exemption devient un ÉCHANGE : on dispense des
   * 44 px de hauteur contre une garantie qui, elle, se vérifie.
   */
  exige?: { verifie: (balise: string) => boolean; contrepartie: string }
}

const EXEMPTIONS: Exemption[] = [
  {
    fichier: 'routes/Login.tsx',
    marqueur: 'to="/inscription"',
    raison:
      'Lien EN PLEINE PHRASE — « Pas encore de compte ? S’inscrire ». WCAG 2.5.8 ' +
      'exempte explicitement une cible située dans une phrase ou un bloc de texte : ' +
      'l’agrandir romprait la ligne qui le contient.',
  },
  {
    fichier: 'routes/SignUp.tsx',
    marqueur: 'to="/connexion"',
    raison: 'Lien en pleine phrase, même raison que celui de Login.',
  },
  {
    fichier: 'components/layout/LienEvitement.tsx',
    marqueur: 'href="#main"',
    raison:
      'Le lien d’évitement n’existe qu’au FOCUS : hors focus il est retiré du flux, ' +
      'et une cible tactile pour un élément qu’aucun doigt ne peut atteindre ne veut ' +
      'rien dire. Au focus, il porte son propre rembourrage.',
  },
  {
    fichier: 'components/primitives/Charts.tsx',
    marqueur: 'key={bar.key ?? bar.label}',
    raison:
      'La barre de `MiniBarChart`. Sa HAUTEUR est la donnée : lui imposer un plancher ' +
      'mentirait sur la mesure. Sa LARGEUR, en revanche, n’est pas une mesure mais ' +
      'un pas de grille — et la première rédaction de cette raison couvrait les deux, ' +
      'ce qui la rendait infalsifiable. Le pas est planché à 24 px, seuil de ' +
      'WCAG 2.5.8, le graphe défilant dans sa propre boîte au-delà. Il n’atteindra ' +
      'pas 44 px sans renoncer à des mois, et c’est ce compromis-là qui est exempté, ' +
      'pas la mesure. La légende cliquable au-dessus, elle, porte son plancher.',
    exige: {
      verifie: porteUnPasSuffisant,
      contrepartie: 'un pas d’au moins 24 px, déclaré sur la barre',
    },
  },
  {
    fichier: 'components/primitives/Charts.tsx',
    marqueur: 'key={bar.label}',
    raison:
      'La barre de `StackedBarChart`, ET C’EST UN MANQUE CONNU, non un compromis. ' +
      'Elle n’a pas de plancher de pas ; la contrepartie de sa voisine l’a débusquée ' +
      'aussitôt écrite, alors qu’une raison commune aux deux graphes l’avait couverte ' +
      'sans que personne la voie. Le remède de `MiniBarChart` ne s’y transplante pas : ' +
      'sa zone de tracé porte la ligne d’objectif en position absolue, calée sur ' +
      '`inset-x-0`, et l’étiquette du montant déborde vers le haut. Y poser un ' +
      '`overflow` rognerait l’étiquette et figerait la ligne pendant que les barres ' +
      'défileraient sous elle. Il faut porter le défilement un cran plus haut et ' +
      'donner à la zone de tracé la largeur de son contenu — un lot à soi, mesuré ' +
      'comme l’a été celui de sa voisine.',
  },
  {
    fichier: 'components/layout/AppShell.tsx',
    marqueur: "aria-label={t('common.close')}",
    raison:
      'Le VOILE du tiroir, épinglé sur toute la fenêtre. Plus grand que tout plancher ' +
      'par construction ; un jeton de hauteur n’y ajouterait rien.',
  },
]

/* -------------------------------------------------------------------------- */
/* Lecture des sources                                                         */
/* -------------------------------------------------------------------------- */

/** Fichiers examinés : le JSX livré, pas les tests. */
function fichiersSources(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return fichiersSources(chemin)
    if (!/\.tsx$/.test(entree)) return []
    if (/\.test\.tsx$/.test(entree)) return []
    return [chemin]
  })
}

/**
 * Commentaires BLANCHIS, et non retirés.
 *
 * Les retirer écraserait un bloc de vingt lignes en une seule, et tout numéro
 * rapporté ensuite désignerait la mauvaise ligne. Dans un dépôt qui commente
 * autant, le décalage est systématique et rend le message du garde trompeur au
 * moment précis où on en a besoin.
 */
function sansCommentaires(source: string): string {
  const blanchir = (bloc: string) => bloc.replace(/[^\n]/g, ' ')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blanchir)
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant: string) => avant)
}

/**
 * Les attributs d'une balise ouvrante.
 *
 * On suit la profondeur des accolades et des parenthèses, et on IGNORE le `>`
 * d'une fonction fléchée. Sans cette précaution, la lecture s'arrête au premier
 * `onClick={() =>` venu : la première rédaction de ce contrôle rapportait
 * quarante-neuf manquements là où il y en avait dix-sept, en coupant les
 * balises avant leur `className`.
 */
function attributs(source: string, debut: number): string {
  let profondeur = 0
  for (let i = debut; i < source.length; i++) {
    const c = source[i]
    if (c === '{' || c === '(') profondeur++
    else if (c === '}' || c === ')') profondeur--
    else if (c === '>' && profondeur === 0 && source[i - 1] !== '=') return source.slice(debut, i)
  }
  return source.slice(debut)
}

/** Les jetons de dimension, lus une fois dans la feuille qui les déclare. */
const JETONS: Map<string, string> = new Map(
  [...readFileSync(join(ICI, 'tokens.css'), 'utf8').matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(
    ([, nom, valeur]) => [nom, valeur.trim()],
  ),
)

/**
 * Le CORPS d'une déclaration partagée.
 *
 * On saute la liste de paramètres d'une fonction fléchée — `(invalid, className)`
 * n'est pas le corps de `controlClasses` — puis on équilibre le bloc qui porte
 * vraiment les classes. Une première rédaction s'arrêtait à la première ligne
 * vide, ce qui ne trouvait rien : les commentaires blanchis laissent des lignes
 * d'espaces, jamais des lignes vides.
 */
function corpsDe(source: string, symbole: string): string | null {
  const entete = new RegExp(`\\b${symbole}\\b[^=\\n]*=`).exec(source)
  if (!entete) return null

  let i = entete.index + entete[0].length
  for (let garde = 0; garde < 8; garde++) {
    while (i < source.length && /[\s>=]/.test(source[i])) i++
    const ouvrant = source.indexOf('(', i) < 0 ? source.indexOf('{', i) : Math.min(
      ...[source.indexOf('(', i), source.indexOf('{', i)].filter((n) => n >= 0),
    )
    if (ouvrant < 0) return null

    const ouvre = source[ouvrant]
    const ferme = ouvre === '(' ? ')' : '}'
    let profondeur = 0
    let j = ouvrant
    for (; j < source.length; j++) {
      if (source[j] === ouvre) profondeur++
      else if (source[j] === ferme && --profondeur === 0) break
    }

    // Une liste de paramètres suivie de `=>` n'est pas encore le corps.
    if (source.slice(j + 1).trimStart().startsWith('=>')) {
      i = j + 1
      continue
    }
    return source.slice(ouvrant, j + 1)
  }
  return null
}

/** Longueur CSS en pixels. `null` si l'unité n'est pas absolue. */
function enPixels(longueur: string): number | null {
  const rem = /^(-?[\d.]+)rem$/.exec(longueur.trim())
  if (rem) return Number(rem[1]) * 16
  const px = /^(-?[\d.]+)px$/.exec(longueur.trim())
  if (px) return Number(px[1])
  return null
}

/** Ce fragment de source déclare-t-il une dimension au moins égale au plancher ? */
function porteUnPlancher(fragment: string): boolean {
  for (const [, pas] of fragment.matchAll(HAUTEUR)) {
    if (Number(pas) * PAS_PX >= PLANCHER_PX) return true
  }
  for (const [, longueur] of fragment.matchAll(HAUTEUR_LIBRE)) {
    const px = enPixels(longueur)
    if (px !== null && px >= PLANCHER_PX) return true
  }
  // `min-h-(--size-control-group)` : la hauteur vient d'un jeton, et un jeton
  // se lit. Le sélecteur de devise l'emploie pour s'aligner sur 50 px.
  for (const [, nom] of fragment.matchAll(HAUTEUR_JETON)) {
    const valeur = JETONS.get(nom)
    const px = valeur ? enPixels(valeur) : null
    if (px !== null && px >= PLANCHER_PX) return true
  }
  return false
}

/**
 * Les contrôles fautifs d'UNE source, sans toucher au disque.
 *
 * Séparé du parcours de l'arbre pour pouvoir être exercé sur une source
 * TÉMOIN. Un contrôle qui n'affirme qu'une absence — « aucun fautif » — ne
 * distingue pas un dépôt sain d'un détecteur cassé : élargir le recouvrement à
 * tout faisait passer l'ensemble du produit sans que rien ne rougisse.
 */
function fautifsDe(relatif: string, brut: string, exemptions: Exemption[] = EXEMPTIONS): string[] {
  const source = sansCommentaires(brut)
  const fautifs: string[] = []

  for (const trouve of source.matchAll(CONTROLE)) {
    const balise = attributs(source, trouve.index)
    const ligne = source.slice(0, trouve.index).split('\n').length

    if (porteUnPlancher(balise)) continue
    if (RECOUVREMENT.test(balise)) continue
    if (DELEGUE.test(balise) && porteUnPlancher(source)) continue

    const exemption = exemptions.find((e) => relatif === e.fichier && balise.includes(e.marqueur))
    if (exemption && (!exemption.exige || exemption.exige.verifie(balise))) continue

    // La contrepartie rompue se DIT : sans elle, le message renverrait à une
    // règle de 44 px qu'on avait précisément accepté de ne pas tenir ici.
    const pourquoi = exemption ? ` — exemption non honorée : ${exemption.exige!.contrepartie}` : ''
    fautifs.push(`${relatif}:${ligne} <${trouve[1]}>${pourquoi}`)
  }

  return fautifs
}

/** Ce fragment déclare-t-il une largeur au moins égale au seuil d'espacement ? */
function porteUnPasSuffisant(fragment: string): boolean {
  for (const [, pas] of fragment.matchAll(LARGEUR)) {
    if (Number(pas) * PAS_PX >= ESPACEMENT_MIN_PX) return true
  }
  return false
}

describe('plancher des cibles tactiles', () => {
  it('n’est franchi par aucun contrôle des sources', () => {
    const fautifs = fichiersSources(SRC).flatMap((chemin) =>
      fautifsDe(chemin.slice(SRC.length + 1), readFileSync(chemin, 'utf8')),
    )

    expect(fautifs).toEqual([])
  })

  /**
   * LE CAS POSITIF, sans lequel le reste ne garde rien.
   *
   * Trois mutations ont montré ce qui manquait : élargir le recouvrement à tout,
   * ou rendre `cn` à la délégation, faisait passer le produit entier en silence.
   * Un détecteur qui ne trouve rien est indiscernable d'un détecteur qui ne
   * cherche plus, et c'est cette confusion-là qu'un dépôt paie deux lots plus
   * tard.
   *
   * La source témoin porte les cinq formes, et la règle doit trancher les cinq
   * dans le bon sens. Les classes s'y assemblent par fragments, pour la raison
   * dite plus haut : Tailwind lit aussi ce fichier.
   */
  it('reconnaît les cinq formes sur une source témoin', () => {
    const plancher = `${H}-11`
    const recouvrement = ['after:inset', '0'].join('-')
    const temoin = [
      `<button className="px-2">nu</button>`,
      `<button className={cn('px-2')}>fusionné, sans plancher</button>`,
      `<button className={cn('${plancher} px-2')}>fusionné, avec</button>`,
      `<a className={partage}>délégué</a>`,
      `<a className="${recouvrement}">recouvrant</a>`,
      // Quarante pixels : quatre de moins, et c'est tout ce qui sépare une
      // cible tenable d'une cible manquée. Ce cas épingle la VALEUR du
      // plancher — sans lui, l'abaisser à 40 ne ferait rougir personne, car
      // rien dans le produit ne vit dans cet intervalle.
      `<button className="${H}-10 px-2">presque</button>`,
      `const partage = '${plancher} px-2'`,
    ].join('\n')

    // Les trois cités, et EUX SEULS. Le troisième porte son plancher, le
    // quatrième délègue à une source qui en mentionne un, le cinquième couvre
    // son conteneur.
    expect(fautifsDe('temoin.tsx', temoin)).toEqual([
      'temoin.tsx:1 <button>',
      'temoin.tsx:2 <button>',
      'temoin.tsx:6 <button>',
    ])
  })

  /**
   * UNE EXEMPTION N'EST ACCORDÉE QU'À SA CONTREPARTIE.
   *
   * Le mécanisme se garde ici plutôt que sur le produit, et pour la raison qui
   * revient à chaque fois : aujourd'hui les deux exemptions conditionnelles du
   * dépôt sont honorées, donc retirer la condition ne ferait rougir personne.
   * Le jour où quelqu'un l'ôterait « parce qu'elle gênait », l'échange
   * redeviendrait un laissez-passer en silence.
   */
  it('n’accorde une exemption qu’à sa contrepartie', () => {
    const assezLarge = `${W}-6`
    const temoin = [
      `<button className="px-2" data-temoin="oui">sans contrepartie</button>`,
      `<button className="px-2 ${assezLarge}" data-temoin="oui">avec</button>`,
    ].join('\n')

    const exemptions = [
      {
        fichier: 'temoin.tsx',
        marqueur: 'data-temoin="oui"',
        raison: 'Témoin.',
        exige: { verifie: porteUnPasSuffisant, contrepartie: 'un pas d’au moins 24 px' },
      },
    ]

    // Le second honore l'échange, le premier non — et le message dit ce qui
    // manque, plutôt que de renvoyer à des 44 px qu'on avait accepté de ne pas
    // tenir ici.
    expect(fautifsDe('temoin.tsx', temoin, exemptions)).toEqual([
      'temoin.tsx:1 <button> — exemption non honorée : un pas d’au moins 24 px',
    ])
  })

  /**
   * UNE CONTREPARTIE QUI ACCEPTE TOUT N'EN EST PAS UNE.
   *
   * Le témoin ci-dessus garde le mécanisme, avec sa propre liste ; il ne dit
   * rien des entrées RÉELLES. Remplacer la condition d'une exemption par
   * « vrai » la vidait donc en silence, puisque le produit l'honore aujourd'hui
   * et qu'aucune victime n'apparaissait. On soumet chaque condition à un
   * contrôle nu : celle qui l'accepte n'exige rien.
   */
  it('ne souffre aucune contrepartie qui accepte un contrôle nu', () => {
    const nu = '<button className="px-2" />'
    const laxistes = EXEMPTIONS.filter((e) => e.exige?.verifie(nu)).map((e) => e.marqueur)

    expect(laxistes).toEqual([])
  })

  /**
   * LES FABRIQUES PARTAGÉES, interrogées là où elles se déclarent.
   *
   * Le repli au fichier ne suffit pas ici, et deux mutations l'ont montré :
   * vider les trois tailles de `SIZES` de leur plancher, ou l'ôter à
   * `controlClasses`, ne faisait rougir personne. `IconButton` mentionne un
   * plancher vingt lignes plus bas, `DatePicker` en mentionne quatorze — les
   * fichiers passaient à ce titre, et la règle s'évaporait pour tous ceux qui
   * délèguent.
   *
   * Or ce sont les deux pièces les plus chères du produit : quarante et un
   * contrôles prennent leur hauteur du bouton partagé, et tout champ de saisie
   * la prend de `controlClasses`. Une règle qui vit à un seul endroit doit être
   * relue à cet endroit — c'est ce que fait `plancher.test.ts` avec
   * `tokens.css`.
   */
  const FABRIQUES = [
    {
      fichier: 'components/primitives/Button.tsx',
      symbole: 'SIZES',
      chaqueEntree: true,
      quoi: 'les tailles du bouton partagé',
    },
    {
      fichier: 'components/primitives/Field.tsx',
      symbole: 'controlClasses',
      chaqueEntree: false,
      quoi: 'la hauteur commune des champs de saisie',
    },
  ]

  it.each(FABRIQUES)('fait porter le plancher à $quoi', ({ fichier, symbole, chaqueEntree }) => {
    const source = sansCommentaires(readFileSync(join(SRC, fichier), 'utf8'))
    const corps = corpsDe(source, symbole)
    expect(corps).not.toBeNull()

    if (!chaqueEntree) {
      expect(porteUnPlancher(corps!) ? [] : [symbole]).toEqual([])
      return
    }

    // CHAQUE entrée, et non le corps entier : une seule taille sans plancher
    // passerait inaperçue derrière ses voisines.
    const entrees = [...corps!.matchAll(/(\w+):\s*'([^']*)'/g)]
    expect(entrees.length).toBeGreaterThan(0)
    expect(entrees.filter(([, , classes]) => !porteUnPlancher(classes)).map(([, nom]) => nom)).toEqual(
      [],
    )
  })

  /**
   * Une exemption qui ne désigne plus rien est une exemption qui ment.
   *
   * Le contrôle qu'elle couvrait a pu être corrigé, déplacé ou supprimé : la
   * ligne reste alors dans la liste, avec sa raison, et couvrira un jour un
   * contrôle qu'on n'a pas examiné. C'est ainsi qu'une liste d'exceptions
   * devient un tapis.
   */
  it('ne garde aucune exemption devenue sans objet', () => {
    const orphelines = EXEMPTIONS.filter((e) => {
      const chemin = join(SRC, e.fichier)
      const source = sansCommentaires(readFileSync(chemin, 'utf8'))
      return ![...source.matchAll(CONTROLE)].some((t) =>
        attributs(source, t.index).includes(e.marqueur),
      )
    }).map((e) => `${e.fichier} → ${e.marqueur}`)

    expect(orphelines).toEqual([])
  })
})
