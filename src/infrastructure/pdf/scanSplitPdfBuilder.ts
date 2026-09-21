import { PDFDocument } from 'pdf-lib'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'
import { DomainError } from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'

GlobalWorkerOptions.workerSrc = pdfWorker

export type ScanSourceKind = 'image' | 'pdf'

export type ScanSourceFile = {
  id: string
  name: string
  file: File
  kind: ScanSourceKind
}

export type FlattenedScanPage =
  | {
      id: string
      label: string
      kind: 'image'
      file: File
    }
  | {
      id: string
      label: string
      kind: 'pdfPage'
      file: File
      pageIndex: number
      pdfBytes: ArrayBuffer
    }

export type SplitPdfDoc = {
  id: string
  label: string
  fileName: string
  pageCount: number
  blob: Blob
}

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i
const PDF_EXT = /\.pdf$/i

export function classifyScanFile(file: File): ScanSourceKind | null {
  if (IMAGE_EXT.test(file.name) || file.type.startsWith('image/')) return 'image'
  if (PDF_EXT.test(file.name) || file.type === 'application/pdf') return 'pdf'
  return null
}

function naturalName(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
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
    if (!context) throw new DomainError('No se pudo procesar la imagen')
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

/** Aplana imágenes y PDFs en una secuencia ordenada de páginas. */
export async function flattenScanSources(
  sources: ScanSourceFile[],
  onProgress?: (label: string) => void,
): Promise<FlattenedScanPage[]> {
  const sorted = [...sources].sort((a, b) => naturalName(a.name, b.name))
  const pages: FlattenedScanPage[] = []

  for (const source of sorted) {
    if (source.kind === 'image') {
      pages.push({
        id: source.id,
        label: source.name,
        kind: 'image',
        file: source.file,
      })
      continue
    }

    onProgress?.(`Leyendo ${source.name}...`)
    const pdfBytes = await source.file.arrayBuffer()
    const loadingTask = getDocument({ data: pdfBytes.slice(0) })
    const pdf = await loadingTask.promise
    try {
      for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
        pages.push({
          id: `${source.id}-p${pageIndex}`,
          label: `${source.name} · pág. ${pageIndex + 1}`,
          kind: 'pdfPage',
          file: source.file,
          pageIndex,
          pdfBytes,
        })
      }
    } finally {
      pdf.cleanup()
    }
  }

  if (pages.length === 0) {
    throw new DomainError('No hay páginas para separar')
  }
  return pages
}

async function assemblePagesToPdf(
  pages: FlattenedScanPage[],
): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  const pdfCache = new Map<string, PDFDocument>()

  for (const page of pages) {
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

  return merged.save()
}

/**
 * Separa las páginas en PDFs de `pagesPerPdf` hojas cada uno
 * (el último puede tener menos).
 */
export async function splitPagesIntoPdfs(
  pages: FlattenedScanPage[],
  pagesPerPdf: number,
  baseName: string,
  onProgress?: (label: string) => void,
): Promise<SplitPdfDoc[]> {
  const size = Math.max(1, Math.floor(pagesPerPdf))
  if (pages.length === 0) {
    throw new DomainError('No hay páginas para separar')
  }

  const docs: SplitPdfDoc[] = []
  const totalGroups = Math.ceil(pages.length / size)

  for (let group = 0; group < totalGroups; group += 1) {
    const start = group * size
    const chunk = pages.slice(start, start + size)
    const from = start + 1
    const to = start + chunk.length
    onProgress?.(
      `Armando PDF ${group + 1}/${totalGroups} (págs. ${from}-${to})...`,
    )
    const bytes = await assemblePagesToPdf(chunk)
    const label = `${baseName} ${String(group + 1).padStart(3, '0')}`
    const fileName = sanitizePdfFileName(
      `${baseName}_${String(group + 1).padStart(3, '0')}_p${from}-${to}`,
    )
    docs.push({
      id: `group-${group}`,
      label,
      fileName,
      pageCount: chunk.length,
      blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    })
  }

  return docs
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
  return cleaned || 'escaneos-pdf'
}

export function canSaveScanPdfsToFolder(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
}

export async function pickOutputDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) {
    throw new DomainError(
      'Tu navegador no permite elegir carpeta. Usa Chrome o Edge.',
    )
  }
  return picker.call(window, { mode: 'readwrite' })
}

export async function saveSplitPdfsToDirectory(
  docs: SplitPdfDoc[],
  directory: FileSystemDirectoryHandle,
  subfolderName: string | null,
  onProgress?: (label: string) => void,
): Promise<{ folderName: string; count: number }> {
  if (docs.length === 0) {
    throw new DomainError('No hay PDFs para guardar')
  }

  let outDir = directory
  let folderName = directory.name
  if (subfolderName && subfolderName.trim()) {
    const name = safeFolderName(subfolderName)
    outDir = await directory.getDirectoryHandle(name, { create: true })
    folderName = name
  }

  for (let index = 0; index < docs.length; index += 1) {
    const doc = docs[index]
    onProgress?.(`Guardando ${doc.fileName} (${index + 1}/${docs.length})...`)
    const fileHandle = await outDir.getFileHandle(doc.fileName, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(doc.blob)
    await writable.close()
  }

  return { folderName, count: docs.length }
}

export async function zipSplitPdfs(
  docs: SplitPdfDoc[],
  zipName: string,
): Promise<{ blob: Blob; fileName: string }> {
  if (docs.length === 0) {
    throw new DomainError('No hay PDFs para empaquetar')
  }
  const zip = new JSZip()
  for (const doc of docs) {
    zip.file(doc.fileName, doc.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  return {
    blob,
    fileName: `${safeFolderName(zipName)}.zip`,
  }
}
