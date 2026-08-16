import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureDownloads } from '@/test/downloads'
import { CSV_MIME, downloadTextFile } from './download'

/**
 * Remise du fichier au navigateur.
 *
 * `URL.createObjectURL` ne produit rien d'exploitable dans jsdom et le clic
 * d'une ancre `download` y déclencherait une navigation non implémentée : les
 * deux sont simulés par `test/downloads`, qui garde le fichier au lieu de le
 * télécharger.
 */
describe('téléchargement d’un fichier texte', () => {
  let capture: ReturnType<typeof captureDownloads> | null = null

  afterEach(() => {
    capture?.restore()
    capture = null
    vi.useRealTimers()
  })

  it('remet un fichier nommé, typé et complet', async () => {
    capture = captureDownloads()

    downloadTextFile('Unité;Locataire\r\nA1;Charles Ngassa\r\n', 'gestlocpro-paiements.csv')

    const [file] = await capture.settle()
    expect(file.name).toBe('gestlocpro-paiements.csv')
    expect(file.type).toBe(CSV_MIME)
    expect(file.text).toBe('Unité;Locataire\r\nA1;Charles Ngassa\r\n')
  })

  it('ne laisse aucune ancre derrière lui', () => {
    capture = captureDownloads()

    downloadTextFile('x', 'x.csv')

    // L'ancre est indispensable au clic mais ne doit pas rester dans la page :
    // une par export finirait par en accumuler autant que de clics.
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
  })

  it('révoque l’URL objet, mais pas dans le même tour de boucle', async () => {
    capture = captureDownloads()

    downloadTextFile('x', 'x.csv')

    // Safari abandonne le téléchargement si l'URL disparaît avant qu'il ne
    // l'ait consommée : la révocation est différée, et c'est délibéré.
    expect(capture.revoked()).toBe(0)
    await capture.settle()
    expect(capture.revoked()).toBe(1)
  })
})
