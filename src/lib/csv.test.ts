import { describe, expect, it } from 'vitest'
import {
  UTF8_BOM,
  csvDelimiter,
  csvFilename,
  csvNumber,
  escapeCsvField,
  isoDay,
  isoMonth,
  serializeCsv,
} from './csv'

/**
 * Sérialisation CSV.
 *
 * Les trois boutons « Exporter le relevé » annonçaient un fichier sans le
 * produire. Ces cas couvrent ce que le fichier doit être une fois produit :
 * lisible par un tableur français comme anglais, et inoffensif quand la donnée
 * vient d'un formulaire.
 */
describe('échappement des champs', () => {
  it('laisse un champ ordinaire tel quel', () => {
    expect(escapeCsvField('Charles Ngassa', ';')).toBe('Charles Ngassa')
  })

  it('cite un champ contenant le séparateur', () => {
    expect(escapeCsvField('Ngassa; Charles', ';')).toBe('"Ngassa; Charles"')
  })

  it('cite aussi sur le séparateur de l’AUTRE langue', () => {
    // Un export français ouvert par un tableur configuré en virgule doit tenir
    // sur une seule colonne : citer les deux séparateurs coûte deux guillemets
    // et évite un fichier illisible.
    expect(escapeCsvField('Ngassa, Charles', ';')).toBe('"Ngassa, Charles"')
    expect(escapeCsvField('Ngassa; Charles', ',')).toBe('"Ngassa; Charles"')
  })

  it('double les guillemets et cite le champ', () => {
    expect(escapeCsvField('Villa "Deïdo"', ';')).toBe('"Villa ""Deïdo"""')
  })

  it('cite un champ contenant un retour à la ligne', () => {
    // Sans citation, la cellule devient une ligne : le fichier compte une
    // écriture de plus, et les colonnes se décalent jusqu'en bas.
    expect(escapeCsvField('Fuite\nsous l’évier', ';')).toBe('"Fuite\nsous l’évier"')
    expect(escapeCsvField('Fuite\r\nsous l’évier', ';')).toBe('"Fuite\r\nsous l’évier"')
  })

  it('rend une cellule vide pour une valeur absente', () => {
    expect(escapeCsvField(null, ';')).toBe('')
    expect(escapeCsvField(undefined, ';')).toBe('')
  })

  it('n’escamote pas la chaîne vide en la citant', () => {
    expect(escapeCsvField('', ';')).toBe('')
  })
})

/**
 * Injection de formule.
 *
 * Une cellule qui commence par `=`, `+`, `-` ou `@` est **exécutée** à
 * l'ouverture par Excel, LibreOffice et Google Sheets. Le nom d'un locataire
 * est de la donnée saisie : il peut porter n'importe quoi, et le fichier est
 * ouvert par le gestionnaire, sur sa machine.
 */
describe('injection de formule', () => {
  it('neutralise les quatre amorces de formule', () => {
    for (const amorce of ['=', '+', '-', '@']) {
      const nom = `${amorce}SUM(1+1)`
      // L'apostrophe fait lire la cellule comme du texte ; la citation garantit
      // qu'elle traverse l'analyseur du tableur intacte.
      expect(escapeCsvField(nom, ';')).toBe(`"'${nom}"`)
    }
  })

  it('désamorce la charge classique d’exécution de commande', () => {
    const charge = '=cmd|\' /C calc\'!A0'
    const sortie = escapeCsvField(charge, ';')
    expect(sortie.startsWith('"\'=')).toBe(true)
  })

  it('neutralise aussi la tabulation et le retour chariot en tête', () => {
    // Les tableurs les ignorent en début de cellule et évaluent la suite : sans
    // eux, la protection se contourne d'un seul caractère.
    expect(escapeCsvField('\t=1+1', ';')).toBe('"\'\t=1+1"')
    expect(escapeCsvField('\r=1+1', ';')).toBe('"\'\r=1+1"')
  })

  it('laisse un nombre négatif intact', () => {
    // `-45000` est un nombre, pas une expression : le neutraliser rendrait
    // toute retenue de caution illisible dans le tableur.
    expect(escapeCsvField(-45000, ';')).toBe('-45000')
  })

  it('ne neutralise pas un champ qui contient une amorce sans commencer par elle', () => {
    expect(escapeCsvField('Jean-Paul Eboa', ';')).toBe('Jean-Paul Eboa')
    expect(escapeCsvField('nom@domaine.com', ';')).toBe('nom@domaine.com')
  })
})

describe('document', () => {
  const LIGNES = [
    ['Unité', 'Locataire'],
    ['A1', 'Charles Ngassa'],
  ]

  it('ouvre par un BOM UTF-8', () => {
    // Sans lui, Excel lit le fichier dans l'encodage régional de la machine et
    // « Deïdo » devient illisible.
    expect(serializeCsv(LIGNES).startsWith(UTF8_BOM)).toBe(true)
    expect(UTF8_BOM).toHaveLength(1)
  })

  it('sépare les lignes par CRLF, comme le veut la RFC 4180', () => {
    expect(serializeCsv(LIGNES, { bom: false })).toBe('Unité;Locataire\r\nA1;Charles Ngassa\r\n')
  })

  it('emploie le séparateur demandé', () => {
    expect(serializeCsv(LIGNES, { bom: false, delimiter: ',' })).toBe(
      'Unité,Locataire\r\nA1,Charles Ngassa\r\n',
    )
  })

  it('rend un document vide sans lignes, BOM compris', () => {
    expect(serializeCsv([])).toBe(UTF8_BOM)
  })

  it('sérialise les nombres sans les formater', () => {
    // Le formatage — groupement, devise — est fait par l'écran avant d'arriver
    // ici : ce module ne connaît ni langue ni devise.
    expect(serializeCsv([[4120, null, 'x']], { bom: false })).toBe('4120;;x\r\n')
  })
})

describe('séparateur selon la langue', () => {
  it('donne le point-virgule au français et la virgule à l’anglais', () => {
    // Excel FR lit la virgule comme séparateur décimal : un fichier virgulé y
    // arrive sur une seule colonne.
    expect(csvDelimiter('fr')).toBe(';')
    expect(csvDelimiter('en')).toBe(',')
  })
})

/**
 * Montants calculables.
 *
 * Les cellules portaient `formatMoney` — « 145 000 FCFA », espace insécable
 * étroite et suffixe compris. Le fichier montrait exactement ce que montrait
 * l'écran, ce qui était la consigne, et il était **inutilisable pour ce à quoi
 * sert un CSV** : aucun tableur ne somme une colonne de texte.
 */
describe('nombres destinés au tableur', () => {
  it('n’émet aucun séparateur de milliers', () => {
    // L'espace qui embellit à l'écran coupe le nombre en deux à l'import.
    expect(csvNumber(1415000, 'fr')).toBe('1415000')
    expect(csvNumber(1415000, 'en')).toBe('1415000')
  })

  it('accorde le séparateur décimal au séparateur de colonnes', () => {
    // Les deux vont ensemble : un fichier français est délimité par des
    // points-virgules PARCE QUE la virgule y est décimale. Émettre « 1450.5 »
    // dans un fichier français produirait une date ou du texte.
    expect(csvNumber(1450.5, 'fr', 2)).toBe('1450,50')
    expect(csvNumber(1450.5, 'en', 2)).toBe('1450.50')
    expect(csvDelimiter('fr')).toBe(';')
    expect(csvDelimiter('en')).toBe(',')
  })

  it('respecte le nombre de décimales de la devise', () => {
    // Le franc CFA n'a pas de centime : « 145000,00 » y serait un faux
    // renseignement, pas une précision.
    expect(csvNumber(145000, 'fr', 0)).toBe('145000')
    expect(csvNumber(145000, 'fr', 2)).toBe('145000,00')
  })

  it('reste tel quel une fois échappé', () => {
    // Le nombre ne doit être ni cité ni neutralisé : citer « 1450,50 » dans un
    // fichier français le rendrait textuel, et l'on retomberait sur le défaut
    // d'origine par un autre chemin.
    expect(escapeCsvField(csvNumber(145000, 'en', 2), ',')).toBe('145000.00')
    // En français, la virgule décimale n'est PAS le séparateur de colonnes,
    // mais elle figure dans `MUST_QUOTE` : la citation est alors légitime et
    // les tableurs la lisent toujours comme un nombre.
    expect(escapeCsvField(csvNumber(1450.5, 'fr', 2), ';')).toBe('"1450,50"')
  })

  it('garde le signe d’un montant négatif', () => {
    // Une retenue de caution est négative, et ce n'est pas une formule. Sans
    // l'exemption, la garde anti-formule la préfixerait d'une apostrophe et la
    // rendrait textuelle — le défaut même que cette colonne corrige, revenu par
    // la couche d'échappement.
    expect(escapeCsvField(csvNumber(-45000, 'fr'), ';')).toBe('-45000')
    expect(escapeCsvField(csvNumber(-1450.5, 'fr', 2), ';')).toBe('"-1450,50"')
  })

  it('n’exempte que les nombres, pas ce qui leur ressemble', () => {
    // L'exemption est le point faible potentiel : elle doit être assez étroite
    // pour qu'aucune expression ne s'y glisse.
    for (const hostile of ['-1+1', '-45000;=cmd', '=1+1', '+1', '@SUM(A1)', '-1e9)']) {
      expect(escapeCsvField(hostile, ';')).toContain("'")
    }
  })
})

describe('nom de fichier', () => {
  it('est parlant et daté', () => {
    expect(csvFilename(['paiements'], '2026-08-16')).toBe('gestlocpro-paiements-2026-08-16.csv')
  })

  it('réduit un libellé traduit à une forme sûre', () => {
    // Le segment vient du dictionnaire : accents, espaces et apostrophes
    // typographiques doivent survivre au système de fichiers.
    expect(csvFilename(['Relevés d’eau', 'A1'], '2026-08')).toBe(
      'gestlocpro-releves-d-eau-a1-2026-08.csv',
    )
  })

  it('n’empile pas de tirets sur un segment vide', () => {
    expect(csvFilename(['paiements', ''], '2026-08-16')).toBe(
      'gestlocpro-paiements-2026-08-16.csv',
    )
  })

  it('horodate en ISO, jamais au format du pays', () => {
    // « 16/08/2026 » porte des barres obliques : un nom de fichier ne peut pas
    // en contenir, et l'ordre alphabétique d'un dossier ne suivrait plus le
    // temps.
    expect(isoDay(new Date(2026, 7, 16, 23, 30))).toBe('2026-08-16')
    expect(isoMonth({ year: 2026, month: 7 })).toBe('2026-08')
  })

  it('date sur l’heure LOCALE et non sur UTC', () => {
    // `toISOString()` aurait daté du 17 un export fait le 16 au soir à Douala,
    // et du 15 un export fait le 16 au matin à Montréal.
    const soir = new Date(2026, 0, 1, 23, 59)
    expect(isoDay(soir)).toBe('2026-01-01')
  })
})
