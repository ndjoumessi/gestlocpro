import { describe, expect, it } from 'vitest'
import { VERSION_STOCKAGE, signatureDeLaForme } from './persistence'

/**
 * La version du stockage doit suivre la forme des données.
 *
 * `persistence.ts` porte la règle depuis toujours : « à incrémenter dès que la
 * forme des données change ». Elle n'était écrite que dans un commentaire, et
 * un commentaire n'arrête personne. Le jour où on l'oublie, les utilisateurs
 * relisent un état enregistré sous l'ancienne forme, et l'écran ment sans rien
 * signaler.
 *
 * Ce n'est pas théorique : un état antérieur, sans `buildingId` sur les unités,
 * a produit un écran affichant « Trois immeubles, douze unités » en titre et
 * `0/0` dans chacune des trois cartes. Deux chiffres contradictoires sur le
 * même écran, et une régression qui a failli être signalée comme telle.
 *
 * Ce test compare la forme réelle à une signature figée. Il ne devine pas ce
 * qu'il faut faire — il oblige à s'arrêter et à choisir : soit la forme a
 * changé et `VERSION` doit être incrémentée, soit elle n'a pas changé et la
 * signature ci-dessous suffit à le prouver.
 */

/**
 * Signature attendue, arrêtée avec `VERSION`.
 *
 * En cas d'échec, la marche à suivre est dans le message d'erreur : incrémenter
 * `VERSION` dans `persistence.ts`, y consigner CE QUI a changé — le fichier en
 * tient l'historique, et il vaut de l'or le jour d'un doute — puis reporter la
 * nouvelle signature ici.
 *
 * Un changement qui n'affecte que le TYPE TypeScript n'a pas à passer par là :
 * `UnitTypeKey` a resserré `string` sans toucher aux valeurs enregistrées, et
 * les clés sont restées les mêmes. C'est bien la forme des données qui compte,
 * pas celle du code qui les lit.
 */
const SIGNATURE_ARRETEE = {
  version: 8,
  forme: {
    deposits: ['held', 'status', 'tenant', 'unitId', 'withheld'],
    units: [
      'buildingId',
      'id',
      'label',
      'leaseStart',
      'overdueDays',
      'paid',
      'phone',
      'rent',
      'status',
      'surface',
      'tenant',
      'tenantId',
      'type',
    ],
    works: [
      'approvedAmount',
      'id',
      'origin',
      'quotedAmount',
      'reportedAt',
      'reportedBy',
      'status',
      'titleKey',
      'trade',
      'unitId',
      'urgent',
    ],
  },
}

describe('version du stockage', () => {
  it('correspond à la forme réellement enregistrée', () => {
    const forme = signatureDeLaForme()

    expect(
      { version: VERSION_STOCKAGE, forme },
      "La forme des données persistées a changé, ou la signature n'a pas été " +
        'reportée. Si la forme a changé : incrémentez VERSION dans ' +
        'persistence.ts, consignez-y CE QUI a changé, puis reportez la nouvelle ' +
        'signature ici. Sans cela, les utilisateurs reliront un état périmé et ' +
        "l'écran affichera des chiffres qui se contredisent.",
    ).toEqual(SIGNATURE_ARRETEE)
  })

  it('échouerait si un champ disparaissait de la forme', () => {
    // Garde du garde : la détection doit fonctionner. Un test incapable de
    // reconnaître ce qu'il cherche passe toujours.
    const ampute = signatureDeLaForme({
      units: [{ id: 'A1', label: 'A1' } as never],
      works: [{ id: 'w' } as never],
      deposits: [{ unitId: 'A1' } as never],
    })
    expect(ampute).not.toEqual(SIGNATURE_ARRETEE.forme)
    expect(ampute.units).not.toContain('buildingId')
  })
})
