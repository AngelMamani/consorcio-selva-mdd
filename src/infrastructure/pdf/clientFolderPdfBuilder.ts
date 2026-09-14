import { PDFDocument } from 'pdf-lib'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'
import { DomainError } from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'

GlobalWorkerOptions.workerSrc = pdfWorker

export type ClientFolderFile = {
  id: string
  name: string
  file: File
  kind: 'image' | 'pdf' | 'other'
  previewUrl?: string
  parentPath?: string
  relativePath?: string
}

export type ClientPdfPage =
  | {
      id: string
      label: string
      thumbUrl: string
      kind: 'image'
      file: File
    }
  | {
      id: string
      label: string
      thumbUrl: string
      kind: 'pdfPage'
      file: File
      pageIndex: number
      pdfBytes: ArrayBuffer
    }

/** Una carpeta de cliente → un PDF. */
export type ClientPdfJob = {
  id: string
  clientName: string
  folderPath: string
  files: ClientFolderFile[]
  outputName: string
}

export type PreparedClientPdf = {
  id: string
  label: string
  fileName: string
  pages: ClientPdfPage[]
}

type PathAwareFile = ClientFolderFile & {
  parentPath: string
  relativePath: string
}

function naturalName(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

function childFoldersWithMedia(
  files: PathAwareFile[],
  parentPath: string,
): Array<{ name: string; path: string }> {
  const map = new Map<string, string>()
  const prefix = parentPath ? `${parentPath}/` : ''
  for (const item of files) {
    if (item.kind !== 'image' && item.kind !== 'pdf') continue
    if (parentPath && !item.relativePath.startsWith(prefix)) continue
    const rest = parentPath
      ? item.relativePath.slice(prefix.length)
      : item.relativePath
    const slash = rest.indexOf('/')
    if (slash === -1) continue
    const name = rest.slice(0, slash)
    const path = parentPath ? `${parentPath}/${name}` : name
    map.set(path, name)
  }
  return [...map.entries()]
    .map(([path, name]) => ({ path, name }))
    .sort((a, b) => naturalName(a.name, b.name))
}

/** Todos los medios bajo una carpeta (incluye subcarpetas). */
export function mediaUnderFolder(
  files: PathAwareFile[],
  folderPath: string,
): ClientFolderFile[] {
  return files
    .filter((item) => {
      if (item.kind !== 'image' && item.kind !== 'pdf') return false
      if (!folderPath) return true
      return (
        item.parentPath === folderPath ||
        item.parentPath.startsWith(`${folderPath}/`)
      )
    })
    .sort((a, b) =>
      naturalName(a.relativePath || a.name, b.relativePath || b.name),
    )
}

/** Clientes = carpetas de primer nivel con medios. */
export function listRootClients(
  files: PathAwareFile[],
): Array<{ name: string; path: string }> {
  return childFoldersWithMedia(files, '')
}

/**
 * 1 cliente = 1 PDF.
 * - Si hay subcarpetas de cliente → un trabajo por cada una (medios recursivos).
 * - Si solo hay archivos en la raíz de la selección → un solo PDF con ese nombre.
 */
export function discoverClientJobs(
  files: PathAwareFile[],
  rootName: string,
): ClientPdfJob[] {
  const clients = listRootClients(files)
  if (clients.length > 0) {
    return clients
      .map((client) => {
        const media = mediaUnderFolder(files, client.path)
        return {
          id: client.path,
          clientName: client.name,
          folderPath: client.path,
          files: media,
          outputName: client.name,
        }
      })
      .filter((job) => job.files.length > 0)
  }

  const media = mediaUnderFolder(files, '')
  if (media.length === 0) return []
  return [
    {
      id: 'root',
      clientName: rootName,
      folderPath: '',
      files: media,
      outputName: rootName,
    },
  ]
}

export function discoverClientJobAtPath(
  files: PathAwareFile[],
  folderPath: string,
  clientName: string,
): ClientPdfJob | null {
  const media = mediaUnderFolder(files, folderPath)
  if (media.length === 0) return null
  return {
    id: folderPath || 'root',
    clientName,
    folderPath,
    files: media,
    outputName: clientName,
  }
}

async function imageToJpegBytes(file: File): Promise<Uint8Array> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () =>
        reject(new DomainError(`Imagen inválida: ${file.name}`))
      element.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new DomainError('No se pudo procesar la imagen')
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new DomainError('No se pudo convertir la imagen')),
        'image/jpeg',
        0.92,
      )
    })
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function sortKey(item: ClientFolderFile): string {
  return item.relativePath || item.name
}

export async function buildClientPdfPages(
  files: ClientFolderFile[],
  onProgress?: (label: string) => void,
): Promise<ClientPdfPage[]> {
  const pdfs = files
    .filter((item) => item.kind === 'pdf')
    .sort((a, b) => naturalName(sortKey(a), sortKey(b)))
  const images = files
    .filter((item) => item.kind === 'image')
    .sort((a, b) => naturalName(sortKey(a), sortKey(b)))

  if (pdfs.length === 0 && images.length === 0) {
    throw new DomainError(
      'Esta carpeta no tiene imágenes ni PDF para armar el documento',
    )
  }

  const pages: ClientPdfPage[] = []

  for (const pdfFile of pdfs) {
    onProgress?.(`Leyendo ${pdfFile.name}...`)
    const pdfBytes = await pdfFile.file.arrayBuffer()
    const loadingTask = getDocument({ data: pdfBytes.slice(0) })
    const pdf = await loadingTask.promise
    try {
      const pageCount = pdf.numPages
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        onProgress?.(
          `Previsualizando ${pdfFile.name} · pág. ${pageIndex + 1}/${pageCount}`,
        )
        const page = await pdf.getPage(pageIndex + 1)
        const viewport = page.getViewport({ scale: 0.45 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const context = canvas.getContext('2d')
        if (!context) {
          throw new DomainError('No se pudo previsualizar una página del PDF')
        }
        await page.render({ canvas, canvasContext: context, viewport }).promise
        pages.push({
          id: `${pdfFile.id}-p${pageIndex}`,
          label: `${pdfFile.name} · pág. ${pageIndex + 1}`,
          thumbUrl: canvas.toDataURL('image/jpeg', 0.85),
          kind: 'pdfPage',
          file: pdfFile.file,
          pageIndex,
          pdfBytes,
        })
      }
    } finally {
      pdf.cleanup()
    }
  }

  for (const image of images) {
    onProgress?.(`Previsualizando ${image.name}...`)
    pages.push({
      id: image.id,
      label: image.name,
      thumbUrl: image.previewUrl || URL.createObjectURL(image.file),
      kind: 'image',
      file: image.file,
    })
  }

  return pages
}

export async function assembleClientPdf(
  pages: ClientPdfPage[],
  requestedFileName: string,
  onProgress?: (label: string) => void,
): Promise<{ blob: Blob; fileName: string }> {
  if (pages.length === 0) {
    throw new DomainError('No hay páginas para generar el PDF')
  }

  const fileName = sanitizePdfFileName(requestedFileName)
  const merged = await PDFDocument.create()
  const pdfCache = new Map<string, PDFDocument>()

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    onProgress?.(`Armando página ${index + 1} de ${pages.length}...`)

    if (page.kind === 'image') {
      const jpeg = await imageToJpegBytes(page.file)
      const embedded = await merged.embedJpg(jpeg)
      const pdfPage = merged.addPage([embedded.width, embedded.height])
      pdfPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: embedded.width,
        height: embedded.height,
      })
      continue
    }

    const cacheKey = `${page.file.name}-${page.file.size}-${page.file.lastModified}`
    let source = pdfCache.get(cacheKey)
    if (!source) {
      source = await PDFDocument.load(page.pdfBytes, { ignoreEncryption: true })
      pdfCache.set(cacheKey, source)
    }
    const [copied] = await merged.copyPages(source, [page.pageIndex])
    merged.addPage(copied)
  }

  const output = await merged.save()
  const bytes = new Uint8Array(output)
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    fileName,
  }
}

export async function prepareClientJobs(
  jobs: ClientPdfJob[],
  onProgress?: (label: string) => void,
): Promise<PreparedClientPdf[]> {
  if (jobs.length === 0) {
    throw new DomainError('No se encontraron clientes con archivos para procesar')
  }

  const prepared: PreparedClientPdf[] = []
  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index]
    onProgress?.(
      `Cliente ${job.clientName} (${index + 1}/${jobs.length})...`,
    )
    const pages = await buildClientPdfPages(job.files, onProgress)
    prepared.push({
      id: job.id,
      label: job.outputName,
      fileName: sanitizePdfFileName(job.outputName),
      pages,
    })
  }
  return prepared
}

export async function zipPreparedPdfs(
  docs: PreparedClientPdf[],
  zipName: string,
  onProgress?: (label: string) => void,
): Promise<{ blob: Blob; fileName: string }> {
  if (docs.length === 0) {
    throw new DomainError('No hay PDFs para empaquetar')
  }
  const zip = new JSZip()
  for (let index = 0; index < docs.length; index += 1) {
    const doc = docs[index]
    onProgress?.(`Empaquetando ${doc.fileName} (${index + 1}/${docs.length})...`)
    const assembled = await assembleClientPdf(doc.pages, doc.fileName)
    zip.file(assembled.fileName, assembled.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  return {
    blob,
    fileName: sanitizePdfFileName(zipName).replace(/\.pdf$/i, '.zip'),
  }
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

function safeFolderName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
  return cleaned || 'PDFs-clientes'
}

/**
 * Guarda todos los PDFs en una subcarpeta dentro de la carpeta que elija el usuario.
 * Requiere Chromium (Chrome/Edge) con File System Access API.
 */
export async function savePreparedPdfsToFolder(
  docs: PreparedClientPdf[],
  folderName: string,
  onProgress?: (label: string) => void,
): Promise<{ folderName: string; count: number }> {
  if (docs.length === 0) {
    throw new DomainError('No hay PDFs para guardar')
  }

  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) {
    throw new DomainError(
      'Tu navegador no permite guardar en carpeta. Se usará descarga ZIP.',
    )
  }

  const parent = await picker.call(window, { mode: 'readwrite' })
  const outName = safeFolderName(folderName)
  const outDir = await parent.getDirectoryHandle(outName, { create: true })

  for (let index = 0; index < docs.length; index += 1) {
    const doc = docs[index]
    onProgress?.(
      `Guardando ${doc.fileName} (${index + 1}/${docs.length})...`,
    )
    const assembled = await assembleClientPdf(doc.pages, doc.fileName)
    const fileHandle = await outDir.getFileHandle(assembled.fileName, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(assembled.blob)
    await writable.close()
  }

  return { folderName: outName, count: docs.length }
}

export function canSavePdfsToFolder(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
}
