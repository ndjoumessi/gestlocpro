import { vi, type MockInstance } from 'vitest'

/**
 * Interception des téléchargements.
 *
 * jsdom sait fabriquer un `Blob` mais ne sait pas le remettre à l'utilisateur :
 * `URL.createObjectURL` n'y produit rien d'exploitable, et cliquer sur une
 * ancre `download` déclencherait une navigation « not implemented ». On
 * remplace donc les deux, et l'on garde ce que la page a voulu télécharger.
 *
 * Le test ne vérifie pas une intention — « la fonction d'export a été
 * appelée » — mais le fichier lui-même : son nom, son contenu, son BOM. C'est
 * précisément la distinction que le défaut d'origine exploitait, puisque le
 * toast était appelé sans qu'aucun fichier n'existe.
 */
export interface CapturedFile {
  /** Valeur de l'attribut `download` de l'ancre. */
  name: string
  type: string
  /**
   * Contenu décodé, **BOM compris**.
   *
   * `Blob.text()` ne convient pas ici : la spécification lui fait retirer le
   * BOM au décodage, si bien qu'un export qui aurait cessé d'en produire
   * passerait quand même. On décode donc les octets bruts.
   */
  text: string
  /** Octets du fichier, pour vérifier l'encodage lui-même. */
  bytes: Uint8Array
}

export interface DownloadCapture {
  /**
   * Fichiers capturés, dans l'ordre. Leur contenu n'est lisible qu'après
   * `settle()` — un `Blob` ne se lit pas autrement qu'en promesse.
   */
  files: CapturedFile[]
  /** Attend la lecture des contenus et la révocation différée des URL objet. */
  settle: () => Promise<CapturedFile[]>
  /** Nombre d'URL objet révoquées — une fuite mémoire se voit ici. */
  revoked: () => number
  /** Rétablit `URL` et l'ancre dans leur état d'origine. */
  restore: () => void
}

/**
 * Remplace `URL.createObjectURL` et le clic d'ancre le temps d'un test.
 *
 * La lecture d'un `Blob` est asynchrone : le contenu n'est disponible qu'après
 * `settle()`. Le nom du fichier, lui, est connu dès le clic.
 */
export function captureDownloads(): DownloadCapture {
  const files: CapturedFile[] = []
  const blobs = new Map<string, Blob>()
  const reads: Promise<void>[] = []
  let revokeCount = 0
  let next = 0

  const createObjectURL: MockInstance = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation((blob: Blob | MediaSource) => {
      const url = `blob:http://localhost/${next++}`
      blobs.set(url, blob as Blob)
      return url
    })

  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
    if (blobs.delete(url)) revokeCount += 1
  })

  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      // `getAttribute` et non `.href` : le second résout l'URL contre celle du
      // document, ce qui déformerait la clé du registre.
      const url = this.getAttribute('href') ?? ''
      const blob = blobs.get(url)
      if (!blob) return

      const file: CapturedFile = {
        name: this.download,
        type: blob.type,
        text: '',
        bytes: new Uint8Array(),
      }
      files.push(file)
      reads.push(
        blob.arrayBuffer().then((buffer) => {
          file.bytes = new Uint8Array(buffer)
          file.text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer)
        }),
      )
    })

  return {
    files,
    settle: async () => {
      // Le tour de boucle laisse aussi passer la révocation différée de
      // `downloadTextFile`, programmée à zéro milliseconde.
      await new Promise((resolve) => setTimeout(resolve, 0))
      await Promise.all(reads)
      return files
    },
    revoked: () => revokeCount,
    restore: () => {
      createObjectURL.mockRestore()
      revokeObjectURL.mockRestore()
      click.mockRestore()
    },
  }
}
